import Anthropic from "@anthropic-ai/sdk";
import { GameSpecSchema, ShooterSpecSchema, type GameSpec, type ShooterSpec } from "@otherside/shared";
import { REFINE_SYSTEM_PROMPT } from "./system-prompt.js";
import { SHOOTER_REFINE_PROMPT } from "./prompts/shooter-prompt.js";
import { validateSpec, autoFixSpec } from "./validator.js";
import { validateShooterSpec, autoFixShooterSpec } from "./shooter-validator.js";
import { extractJSON } from "./llm-runner.js";

export interface RefineOptions {
  model?: string;
}

const MAX_RETRIES = 3;

interface GenericIssue {
  description: string;
}

export class SpecRefiner {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, options: RefineOptions = {}) {
    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? "claude-sonnet-4-6";
  }

  async refine(spec: GameSpec, instruction: string): Promise<GameSpec> {
    return this.refineGeneric(
      spec,
      instruction,
      REFINE_SYSTEM_PROMPT,
      GameSpecSchema,
      (s) => validateSpec(s as GameSpec) as GenericIssue[],
      (s, issues) => autoFixSpec(s as GameSpec, issues as any) as unknown as GameSpec,
    ) as Promise<GameSpec>;
  }

  async refineShooter(spec: ShooterSpec, instruction: string): Promise<ShooterSpec> {
    return this.refineGeneric(
      spec,
      instruction,
      SHOOTER_REFINE_PROMPT,
      ShooterSpecSchema,
      (s) => validateShooterSpec(s as ShooterSpec) as GenericIssue[],
      (s, issues) => autoFixShooterSpec(s as ShooterSpec, issues as any) as unknown as ShooterSpec,
    ) as Promise<ShooterSpec>;
  }

  private async refineGeneric<T>(
    spec: T,
    instruction: string,
    systemPrompt: string,
    schema: { safeParse: (data: unknown) => any },
    validate: (spec: T) => GenericIssue[],
    autoFix: (spec: T, issues: GenericIssue[]) => T,
  ): Promise<T> {
    let lastError: string | null = null;
    let lastFailedJSON: string | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let userContent = `Current game spec:\n${JSON.stringify(spec, null, 2)}\n\nModification: ${instruction}`;
      if (attempt > 0 && lastError) {
        userContent += `\n\n⚠ Previous attempt ${attempt} failed with error:\n${lastError}`;
        if (lastFailedJSON) {
          userContent += `\n\nFirst 2000 chars of failed output:\n${lastFailedJSON.slice(0, 2000)}`;
        }
        userContent += `\n\nGuidance: Ensure all JSON is valid. Use primitive meshes.`;
      }

      const response = await this.client.messages.stream({
        model: this.model,
        max_tokens: 32768,
        system: systemPrompt,
        messages: [
          { role: "user", content: userContent },
        ],
      }).finalMessage();

      if (response.stop_reason === "max_tokens") {
        lastError = "Output was truncated (exceeded max_tokens). Reduce entity count.";
        lastFailedJSON = null;
        console.warn(
          `[Refiner] Attempt ${attempt + 1}/${MAX_RETRIES} truncated (stop_reason=max_tokens)`,
        );
        continue;
      }

      const rawText =
        response.content[0].type === "text" ? response.content[0].text : "";
      const json = extractJSON(rawText);

      try {
        const parsed = JSON.parse(json);
        const result = schema.safeParse(parsed);
        if (!result.success) {
          const issueMessages = result.error.issues
            .slice(0, 10)
            .map((issue: any) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n");
          lastError = issueMessages;
          lastFailedJSON = json;
          console.warn(
            `[Refiner] Attempt ${attempt + 1}/${MAX_RETRIES} validation failed:\n`,
            issueMessages.slice(0, 300),
          );
          continue;
        }

        let refined = result.data as T;

        // Run validation on the refined spec
        const issues = validate(refined);
        if (issues.length > 0) {
          console.log(
            "[Refiner] Auto-fixing issues:",
            issues.map(i => i.description),
          );
          refined = autoFix(refined, issues);
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
      `Failed to refine spec after ${MAX_RETRIES} attempts: ${lastError}`,
    );
  }
}
