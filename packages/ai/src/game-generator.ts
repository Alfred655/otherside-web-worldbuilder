import {
  GenerationPipeline,
  type PipelineOptions,
  type PipelineResult,
} from "./pipeline.js";
import { ShooterPipeline } from "./shooter-pipeline.js";
import type { ShooterSpec } from "@otherside/shared";

export interface GenerateOptions extends PipelineOptions {}

export type GenerateResult = PipelineResult | { spec: ShooterSpec };

export class GameGenerator {
  private pipeline: GenerationPipeline;
  private shooterPipeline: ShooterPipeline;

  constructor(apiKey: string, options: GenerateOptions = {}) {
    this.pipeline = new GenerationPipeline(apiKey, options);
    this.shooterPipeline = new ShooterPipeline(apiKey, options);
  }

  /** Provide the asset catalog summary so generated specs reference real 3D models */
  setAssetSummary(summary: string) {
    this.pipeline.setAssetSummary(summary);
    this.shooterPipeline.setAssetSummary(summary);
  }

  async generate(
    prompt: string,
    onProgress?: (status: string) => void,
    template?: string,
  ): Promise<GenerateResult> {
    if (template === "shooter") {
      const spec = await this.shooterPipeline.generate(prompt, onProgress);
      return { spec };
    }

    // Default: legacy GameSpec pipeline
    return this.pipeline.generate(prompt, onProgress);
  }
}
