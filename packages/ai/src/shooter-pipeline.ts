import Anthropic from "@anthropic-ai/sdk";
import { ShooterSpecSchema, type ShooterSpec } from "@otherside/shared";
import { runWithRetry, extractJSON } from "./llm-runner.js";
import {
  SHOOTER_GENERATOR_PROMPT,
  SHOOTER_VALIDATOR_PROMPT,
} from "./prompts/shooter-prompt.js";
import { validateShooterSpec, autoFixShooterSpec } from "./shooter-validator.js";

export interface ShooterPipelineOptions {
  model?: string;
}

export class ShooterPipeline {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, options: ShooterPipelineOptions = {}) {
    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? "claude-sonnet-4-6";
  }

  async generate(
    prompt: string,
    onProgress?: (status: string) => void,
  ): Promise<ShooterSpec> {
    // Step 1: Generate via runWithRetry
    onProgress?.("Designing your shooter...");
    console.log("[ShooterPipeline] Generating ShooterSpec JSON...");

    const rawSpec = await runWithRetry<ShooterSpec>({
      client: this.client,
      model: this.model,
      system: SHOOTER_GENERATOR_PROMPT,
      buildUserContent: (attempt, lastError, lastFailedJSON) => {
        let content = `Create a complete FPS shooter game for: "${prompt}"`;
        if (attempt > 0 && lastError) {
          content += `\n\n⚠ Previous attempt ${attempt} failed with error:\n${lastError}`;
          if (lastFailedJSON) {
            content += `\n\nFirst 2000 chars of failed output:\n${lastFailedJSON.slice(0, 2000)}`;
          }
          content += `\n\nGuidance: Reduce enemy count if needed. Ensure all weapon/enemy cross-references are valid. Use primitive meshes.`;
        }
        return content;
      },
      schema: ShooterSpecSchema,
      maxRetries: 3,
      maxTokens: 32768,
      onProgress,
      retryLabel: "ShooterPipeline",
    });

    console.log(
      `[ShooterPipeline] Generated "${rawSpec.name}" with ${rawSpec.enemies.length} enemies, ${rawSpec.weapons.length} weapons`,
    );

    // Step 2: Validate
    onProgress?.("Validating...");
    console.log("[ShooterPipeline] Checking spec quality...");
    const finalSpec = await this.runValidator(rawSpec, onProgress);

    return finalSpec;
  }

  private async runValidator(
    spec: ShooterSpec,
    onProgress?: (status: string) => void,
  ): Promise<ShooterSpec> {
    let issues = validateShooterSpec(spec);
    if (issues.length === 0) {
      console.log("[ShooterPipeline:Validator] No issues found ✓");
      return spec;
    }

    console.log(
      "[ShooterPipeline:Validator] Found issues:",
      issues.map(i => i.description),
    );

    // Try programmatic fixes first
    onProgress?.("Auto-fixing issues...");
    let fixed = autoFixShooterSpec(spec, issues);
    issues = validateShooterSpec(fixed);

    if (issues.length === 0) {
      console.log("[ShooterPipeline:Validator] All issues fixed programmatically ✓");
      return fixed;
    }

    // Remaining issues — use Haiku to fix (fast + cheap for this rare path)
    console.log(
      "[ShooterPipeline:Validator] Remaining issues, calling LLM to fix:",
      issues.map(i => i.description),
    );

    try {
      const response = await this.client.messages
        .stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 32768,
          system: SHOOTER_VALIDATOR_PROMPT,
          messages: [
            {
              role: "user",
              content: `Fix these issues in the shooter spec:\n${issues.map(i => `- ${i.description}`).join("\n")}\n\nCurrent spec:\n${JSON.stringify(fixed, null, 2)}`,
            },
          ],
        })
        .finalMessage();

      if (response.stop_reason === "max_tokens") {
        console.warn(
          "[ShooterPipeline:Validator] LLM fix truncated, using programmatic fix",
        );
        return fixed;
      }

      const rawText =
        response.content[0].type === "text" ? response.content[0].text : "";
      const json = extractJSON(rawText);
      const result = ShooterSpecSchema.safeParse(JSON.parse(json));
      if (result.success) {
        console.log("[ShooterPipeline:Validator] LLM fix applied ✓");
        return result.data;
      }
      console.warn(
        "[ShooterPipeline:Validator] LLM fix produced invalid spec, using programmatic fix:",
        result.error.issues
          .slice(0, 3)
          .map(i => i.message)
          .join("; "),
      );
      return fixed;
    } catch (err) {
      console.warn(
        "[ShooterPipeline:Validator] LLM fix failed, using programmatic fix:",
        err instanceof Error ? err.message.slice(0, 100) : err,
      );
      return fixed;
    }
  }
}
