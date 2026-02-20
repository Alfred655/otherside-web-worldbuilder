import Anthropic from "@anthropic-ai/sdk";
import { GameSpecSchema, type GameSpec } from "@otherside/shared";
import { REFINE_SYSTEM_PROMPT } from "./system-prompt.js";
import { validateSpec, autoFixSpec } from "./validator.js";

function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let json = "";
  if (fenceMatch) {
    json = fenceMatch[1].trim();
  } else {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) json = text.slice(start, end + 1);
    else json = text.trim();
  }
  // Safe trailing comma repair only
  json = json.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
  return json;
}

export interface RefineOptions {
  model?: string;
}

const MAX_RETRIES = 3;

export class SpecRefiner {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, options: RefineOptions = {}) {
    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? "claude-sonnet-4-6";
  }

  async refine(spec: GameSpec, instruction: string): Promise<GameSpec> {
    let lastError: string | null = null;
    let lastFailedJSON: string | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let userContent = `Current game spec:\n${JSON.stringify(spec, null, 2)}\n\nModification: ${instruction}`;
      if (attempt > 0 && lastError) {
        userContent += `\n\n⚠ Previous attempt ${attempt} failed with error:\n${lastError}`;
        if (lastFailedJSON) {
          userContent += `\n\nFirst 2000 chars of failed output:\n${lastFailedJSON.slice(0, 2000)}`;
        }
        userContent += `\n\nGuidance: Ensure all JSON is valid. Use primitive meshes for collectibles and props.`;
      }

      const response = await this.client.messages.stream({
        model: this.model,
        max_tokens: 32768,
        system: REFINE_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userContent },
          { role: "assistant", content: "{" },
        ],
      }).finalMessage();

      // Check for truncation
      if (response.stop_reason === "max_tokens") {
        lastError = "Output was truncated (exceeded max_tokens). Reduce entity count. Use primitive meshes instead of compound for collectibles and props.";
        lastFailedJSON = null;
        console.warn(
          `[Refiner] Attempt ${attempt + 1}/${MAX_RETRIES} truncated (stop_reason=max_tokens)`,
        );
        continue;
      }

      const rawText =
        response.content[0].type === "text" ? response.content[0].text : "";
      // Prepend the prefill "{" to reconstruct full JSON
      const text = "{" + rawText;
      const json = extractJSON(text);

      try {
        const parsed = JSON.parse(json);
        const result = GameSpecSchema.safeParse(parsed);
        if (!result.success) {
          const issueMessages = result.error.issues
            .slice(0, 10)
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n");
          lastError = issueMessages;
          lastFailedJSON = json;
          console.warn(
            `[Refiner] Attempt ${attempt + 1}/${MAX_RETRIES} validation failed:\n`,
            issueMessages.slice(0, 300),
          );
          continue;
        }

        let refined = result.data;

        // Run validation on the refined spec
        const issues = validateSpec(refined);
        if (issues.length > 0) {
          console.log(
            "[Refiner] Auto-fixing issues:",
            issues.map((i) => i.description),
          );
          refined = autoFixSpec(refined, issues);
        }

        return refined;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown parse error";
        lastError = `JSON parse error: ${msg}`;
        lastFailedJSON = json;
        console.warn(
          `[Refiner] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
          msg.slice(0, 200),
        );
      }
    }

    throw new Error(
      `Failed to refine GameSpec after ${MAX_RETRIES} attempts: ${lastError}`,
    );
  }
}
