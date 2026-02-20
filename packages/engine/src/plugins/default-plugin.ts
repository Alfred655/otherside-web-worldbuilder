import type { TemplatePlugin, GameRendererAPI } from "./template-plugin.js";

/** No-op plugin for legacy GameSpec — all methods return defaults/false/null. */
export class DefaultPlugin implements TemplatePlugin {
  init(_api: GameRendererAPI): void {}
  update(_dt: number): void {}
  onAttack(): boolean { return false; }
  onKeyDown?(_code: string): boolean { return false; }
  checkEndConditions?(): "won" | "lost" | null { return null; }
  reset(): void {}
  dispose(): void {}
}
