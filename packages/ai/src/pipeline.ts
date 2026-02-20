import Anthropic from "@anthropic-ai/sdk";
import { GameSpecSchema, type GameSpec } from "@otherside/shared";
import {
  DESIGNER_SYSTEM_PROMPT,
  BUILDER_SYSTEM_PROMPT,
  VALIDATOR_SYSTEM_PROMPT,
} from "./system-prompt.js";
import { selectTemplate, type GameTemplate } from "./templates.js";
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

export interface PipelineOptions {
  model?: string;
}

export interface PipelineResult {
  spec: GameSpec;
  designDoc: string;
}

export class GenerationPipeline {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, options: PipelineOptions = {}) {
    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? "claude-sonnet-4-6";
  }

  async generate(prompt: string): Promise<PipelineResult> {
    const template = selectTemplate(prompt);
    if (template) {
      console.log(`[Pipeline] Matched template: ${template.name}`);
    }

    // ── Step 1: Game Designer ──────────────────────────────────────────
    console.log("[Pipeline:Designer] Generating design document...");
    const designDoc = await this.runDesigner(prompt, template);
    console.log("[Pipeline:Designer] Output:\n" + designDoc);

    // ── Step 2: World Builder (with retries) ───────────────────────────
    console.log("[Pipeline:Builder] Converting to GameSpec JSON...");
    const rawSpec = await this.runBuilder(designDoc, template);
    console.log(
      `[Pipeline:Builder] Generated "${rawSpec.name}" with ${rawSpec.entities.length} entities`,
    );

    // ── Step 3: Validator ──────────────────────────────────────────────
    console.log("[Pipeline:Validator] Checking spec quality...");
    const finalSpec = await this.runValidator(rawSpec);

    return { spec: finalSpec, designDoc };
  }

  // ── Step 1: Designer ────────────────────────────────────────────────────

  private async runDesigner(
    prompt: string,
    template: GameTemplate | null,
  ): Promise<string> {
    let userContent = `Create a detailed game design for: "${prompt}"`;
    if (template) {
      userContent += `\n\nThis matches the "${template.name}" layout pattern. Use it as a guide:\n${template.description}`;
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: DESIGNER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    return response.content[0].type === "text"
      ? response.content[0].text
      : "";
  }

  // ── Step 2: Builder ─────────────────────────────────────────────────────

  private async runBuilder(
    designDoc: string,
    template: GameTemplate | null,
  ): Promise<GameSpec> {
    const MAX_RETRIES = 3;
    let lastError: string | null = null;
    let lastFailedJSON: string | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let userContent = `Convert this game design document to valid GameSpec JSON:\n\n${designDoc}`;
      if (template) {
        userContent += `\n\nLayout reference: ${template.description}`;
      }
      if (attempt > 0 && lastError) {
        userContent += `\n\n⚠ Previous attempt ${attempt} failed with error:\n${lastError}`;
        if (lastFailedJSON) {
          userContent += `\n\nFirst 2000 chars of failed output:\n${lastFailedJSON.slice(0, 2000)}`;
        }
        userContent += `\n\nGuidance: Reduce entity count if needed. Use primitive meshes for collectibles and props. Ensure all JSON is valid.`;
      }

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 32768,
        system: BUILDER_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userContent },
          { role: "assistant", content: "{" },
        ],
      });

      // Check for truncation
      if (response.stop_reason === "max_tokens") {
        lastError = "Output was truncated (exceeded max_tokens). Reduce to 8 entities max. Use primitive meshes instead of compound for collectibles and props.";
        lastFailedJSON = null;
        console.warn(
          `[Pipeline:Builder] Attempt ${attempt + 1}/${MAX_RETRIES} truncated (stop_reason=max_tokens)`,
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
        if (result.success) {
          return result.data;
        }
        // Format Zod issues with paths
        const issueMessages = result.error.issues
          .slice(0, 10)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("\n");
        lastError = issueMessages;
        lastFailedJSON = json;
        console.warn(
          `[Pipeline:Builder] Attempt ${attempt + 1}/${MAX_RETRIES} validation failed:\n`,
          issueMessages.slice(0, 300),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown parse error";
        lastError = `JSON parse error: ${msg}`;
        lastFailedJSON = json;
        console.warn(
          `[Pipeline:Builder] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
          msg.slice(0, 200),
        );
      }
    }

    throw new Error(
      `Failed to generate valid GameSpec after ${MAX_RETRIES} attempts: ${lastError}`,
    );
  }

  // ── Step 3: Validator ───────────────────────────────────────────────────

  private async runValidator(spec: GameSpec): Promise<GameSpec> {
    let issues = validateSpec(spec);
    if (issues.length === 0) {
      console.log("[Pipeline:Validator] No issues found ✓");
      return spec;
    }

    console.log(
      "[Pipeline:Validator] Found issues:",
      issues.map((i) => i.description),
    );

    // Try programmatic fixes first
    let fixed = autoFixSpec(spec, issues);
    issues = validateSpec(fixed);

    if (issues.length === 0) {
      console.log("[Pipeline:Validator] All issues fixed programmatically ✓");
      return fixed;
    }

    // Remaining issues — use LLM to fix
    console.log(
      "[Pipeline:Validator] Remaining issues, calling LLM to fix:",
      issues.map((i) => i.description),
    );

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 32768,
        system: VALIDATOR_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Fix these issues in the game spec:\n${issues.map((i) => `- ${i.description}`).join("\n")}\n\nCurrent spec:\n${JSON.stringify(fixed, null, 2)}`,
          },
          { role: "assistant", content: "{" },
        ],
      });

      if (response.stop_reason === "max_tokens") {
        console.warn("[Pipeline:Validator] LLM fix truncated, using programmatic fix");
        return fixed;
      }

      const rawText =
        response.content[0].type === "text" ? response.content[0].text : "";
      const text = "{" + rawText;
      const json = extractJSON(text);
      const result = GameSpecSchema.safeParse(JSON.parse(json));
      if (result.success) {
        console.log("[Pipeline:Validator] LLM fix applied ✓");
        return result.data;
      }
      console.warn(
        "[Pipeline:Validator] LLM fix produced invalid spec, using programmatic fix:",
        result.error.issues.slice(0, 3).map((i) => i.message).join("; "),
      );
      return fixed;
    } catch (err) {
      console.warn(
        "[Pipeline:Validator] LLM fix failed, using programmatic fix:",
        err instanceof Error ? err.message.slice(0, 100) : err,
      );
      return fixed;
    }
  }
}
