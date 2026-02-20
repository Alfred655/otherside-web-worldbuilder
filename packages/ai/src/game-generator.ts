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

  async generate(
    prompt: string,
    onProgress?: (status: string) => void,
  ): Promise<PipelineResult> {
    return this.pipeline.generate(prompt, onProgress);
  }
}
