import RAPIER from "@dimforge/rapier3d-compat";
import type { GameSpec, ShooterSpec } from "@otherside/shared";
import { GameRenderer } from "./game-renderer.js";
import { CreationUI } from "./creation-ui.js";
import { AssetLoader } from "./asset-loader.js";
import { shooterToGameSpec } from "./adapters/shooter-adapter.js";
import { ShooterPlugin } from "./plugins/shooter/shooter-plugin.js";
import { ArenaBuilder } from "./arena-builder.js";

async function main() {
  await RAPIER.init();

  // Initialize asset system — loads catalog.json once at startup
  const assetLoader = new AssetLoader();
  await assetLoader.loadCatalog();

  let currentGame: GameRenderer | null = null;
  let currentArena: ArenaBuilder | null = null;

  const loadSpec = async (spec: GameSpec | ShooterSpec) => {
    if (currentGame) {
      currentGame.dispose();
      currentGame = null;
    }
    currentArena = null;

    // Preload any assets referenced in the spec before building the game
    await assetLoader.preloadForSpec(spec);

    if (isShooterSpec(spec)) {
      const { gameSpec, waveMap, specialPickupIds } = shooterToGameSpec(spec);

      // Build entity map for deferred wave spawning
      const allEnemyEntities = new Map<string, (typeof gameSpec.entities)[number]>();
      for (const ent of gameSpec.entities) {
        if (ent.type === "npc") {
          allEnemyEntities.set(ent.id, ent);
        }
      }

      // Filter out non-wave-1 enemies from initial entities
      if (spec.waveConfig) {
        const wave1Ids = new Set(
          spec.waveConfig.waves.find(w => w.waveNumber === 1)?.enemyIds ?? [],
        );
        gameSpec.entities = gameSpec.entities.filter(ent => {
          if (ent.type !== "npc") return true;
          return !waveMap.has(ent.id) || wave1Ids.has(ent.id);
        });
      }

      const plugin = new ShooterPlugin(spec, waveMap, specialPickupIds, allEnemyEntities);

      currentGame = new GameRenderer(gameSpec);
      currentGame.setPlugin(plugin);
      currentGame.setAssetLoader(assetLoader);
      currentGame.init();

      currentArena = new ArenaBuilder();

      currentGame.start();
    } else {
      currentGame = new GameRenderer(spec);
      currentGame.setAssetLoader(assetLoader);
      currentGame.init();
      currentGame.start();
    }
  };

  new CreationUI(loadSpec);
}

function isShooterSpec(spec: any): spec is ShooterSpec {
  return spec.template === "shooter";
}

main();
