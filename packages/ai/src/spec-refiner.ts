import Anthropic from "@anthropic-ai/sdk";
import { GameSpecSchema, type GameSpec } from "@otherside/shared";
import { REFINE_SYSTEM_PROMPT } from "./system-prompt.js";
import { validateSpec, autoFixSpec } from "./validator.js";

function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
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
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let userContent = `Current game spec:\n${JSON.stringify(spec, null, 2)}\n\nModification: ${instruction}`;
      if (attempt > 0 && lastError) {
        userContent += `\n\n⚠ Previous attempt failed: ${lastError.message}\nPlease fix and return valid JSON.`;
      }

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16384,
        system: REFINE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const json = extractJSON(text);

      try {
        const parsed = JSON.parse(json);
        let refined = GameSpecSchema.parse(parsed);

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
        lastError =
          err instanceof Error ? err : new Error("Unknown parse error");
        console.warn(
          `[Refiner] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
          lastError.message.slice(0, 200),
        );
      }
    }

    throw new Error(
      `Failed to refine GameSpec after ${MAX_RETRIES} attempts: ${lastError?.message}`,
    );
  }
}
