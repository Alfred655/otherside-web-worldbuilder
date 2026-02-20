import type { GameSpec } from "@otherside/shared";
import {
  GenerationPipeline,
  type PipelineOptions,
  type PipelineResult,
} from "./pipeline.js";

export interface GenerateOptions extends PipelineOptions {}

export class GameGenerator {
  private pipeline: GenerationPipeline;

  constructor(apiKey: string, options: GenerateOptions = {}) {
    this.pipeline = new GenerationPipeline(apiKey, options);
  }

  async generate(prompt: string): Promise<PipelineResult> {
    return this.pipeline.generate(prompt);
  }
}
