import RAPIER from "@dimforge/rapier3d-compat";
import type { GameSpec } from "@otherside/shared";
import { GameRenderer } from "./game-renderer.js";
import { CreationUI } from "./creation-ui.js";

async function main() {
  await RAPIER.init();

  let currentGame: GameRenderer | null = null;

  const loadSpec = (spec: GameSpec) => {
    if (currentGame) {
      currentGame.dispose();
      currentGame = null;
    }
    currentGame = new GameRenderer(spec);
    currentGame.init();
    currentGame.start();
  };

  new CreationUI(loadSpec);
}

main();
