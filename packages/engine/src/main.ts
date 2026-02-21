import RAPIER from "@dimforge/rapier3d-compat";
import type { GameSpec, ShooterSpec, Entity } from "@otherside/shared";
import { GameRenderer } from "./game-renderer.js";
import { CreationUI } from "./creation-ui.js";
import { AssetLoader } from "./asset-loader.js";
import { shooterToGameSpec } from "./adapters/shooter-adapter.js";
import { ShooterPlugin } from "./plugins/shooter/shooter-plugin.js";
import { WorldBuilder } from "./world-builder.js";
import { LayoutEngine } from "./core/layout-engine.js";
import { validateLayout } from "./core/layout-validator.js";

async function main() {
  await RAPIER.init();

  // Initialize asset system — loads catalog.json once at startup
  const assetLoader = new AssetLoader();
  await assetLoader.loadCatalog();

  let currentGame: GameRenderer | null = null;

  const loadSpec = async (spec: GameSpec | ShooterSpec) => {
    if (currentGame) {
      currentGame.dispose();
      currentGame = null;
    }

    // Preload any assets referenced in the spec before building the game
    await assetLoader.preloadForSpec(spec);

    if (isShooterSpec(spec)) {
      const useWorldBuilder = spec.arena.shape === "rectangle";

      // Preload tiled environment models for rectangle arenas
      if (useWorldBuilder) {
        await WorldBuilder.preloadAssets(assetLoader);
      }

      // ── Layout Engine: generate cover, walls, and positions from template ──
      let layoutWallEntities: Entity[] | null = null;
      let layoutDecorations: Entity[] | null = null;

      if (spec.arena.layoutTemplate) {
        const layout = LayoutEngine.build(
          spec.arena.layoutTemplate,
          spec.arena,
          spec.arena.zones ?? [],
          spec.enemies,
          spec.pickups,
          spec.arena.theme,
        );

        // Validate (warnings only)
        const issues = validateLayout(
          layout.coverObjects, layout.wallEntities, spec.arena, layout.playerSpawn,
        );
        if (issues.length > 0) {
          console.warn("[LayoutEngine] Issues:", issues.map(i => i.description));
        }

        // Apply layout results back to spec
        spec.arena.coverObjects = layout.coverObjects;
        spec.enemies = layout.adjustedEnemies;
        spec.pickups = layout.adjustedPickups;
        spec.player.spawnPoint = layout.playerSpawn;
        layoutWallEntities = layout.wallEntities;
        layoutDecorations = layout.decorations;

        console.log(
          `[LayoutEngine] Template "${spec.arena.layoutTemplate}": ` +
          `${layout.coverObjects.length} cover, ${layout.wallEntities.length} walls, ` +
          `${layout.decorations.length} decorations`,
        );

        // Preload layout-generated asset models (not in original spec)
        const layoutAssetIds = new Set<string>();
        for (const c of layout.coverObjects) if (c.assetId) layoutAssetIds.add(c.assetId);
        for (const w of layout.wallEntities) if (w.assetId) layoutAssetIds.add(w.assetId);
        for (const d of layout.decorations) if (d.assetId) layoutAssetIds.add(d.assetId);
        if (layoutAssetIds.size > 0) {
          console.log(`[LayoutEngine] Preloading ${layoutAssetIds.size} layout assets`);
          await Promise.all(Array.from(layoutAssetIds).map(id => assetLoader.loadModel(id)));
        }
      }

      const { gameSpec, waveMap, specialPickupIds } = shooterToGameSpec(spec);

      // ── Debug: log all enemies from the spec ─────────────────────────
      console.log(`[Shooter] Enemies in spec: ${spec.enemies.length}`);
      for (const e of spec.enemies) {
        const pos = e.transform.position;
        console.log(
          `  enemy "${e.id}" pos=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) ` +
          `wave=${e.spawnWave ?? "none"} asset=${e.assetId ?? "NONE"} hp=${e.health}`,
        );
      }
      if (spec.waveConfig) {
        for (const w of spec.waveConfig.waves) {
          console.log(`  wave ${w.waveNumber}: enemies=[${w.enemyIds.join(", ")}]`);
        }
      }

      // Build entity map for deferred wave spawning
      const allEnemyEntities = new Map<string, (typeof gameSpec.entities)[number]>();
      for (const ent of gameSpec.entities) {
        if (ent.type === "npc") {
          allEnemyEntities.set(ent.id, ent);
        }
      }
      console.log(`[Shooter] NPC entities in gameSpec: ${allEnemyEntities.size}`);

      // Filter out non-wave-1 enemies from initial entities
      if (spec.waveConfig) {
        const wave1Ids = new Set(
          spec.waveConfig.waves.find(w => w.waveNumber === 1)?.enemyIds ?? [],
        );
        console.log(`[Shooter] Wave 1 enemy IDs: [${Array.from(wave1Ids).join(", ")}]`);
        gameSpec.entities = gameSpec.entities.filter(ent => {
          if (ent.type !== "npc") return true;
          const keep = !waveMap.has(ent.id) || wave1Ids.has(ent.id);
          if (!keep) console.log(`  deferring "${ent.id}" (wave ${waveMap.get(ent.id)})`);
          return keep;
        });
        console.log(`[Shooter] Entities after wave filter: ${gameSpec.entities.length} (${gameSpec.entities.filter(e => e.type === "npc").length} NPCs)`);
      }

      // WorldBuilder handles walls visually + physically — filter adapter-generated wall entities
      if (useWorldBuilder) {
        gameSpec.entities = gameSpec.entities.filter(
          ent => !ent.id.startsWith("arena-wall-"),
        );
      }

      // Inject LayoutEngine wall entities and decorations
      if (layoutWallEntities) gameSpec.entities.push(...layoutWallEntities);
      if (layoutDecorations) gameSpec.entities.push(...layoutDecorations);

      const plugin = new ShooterPlugin(spec, waveMap, specialPickupIds, allEnemyEntities);

      currentGame = new GameRenderer(gameSpec);
      currentGame.setPlugin(plugin);
      currentGame.setAssetLoader(assetLoader);
      if (useWorldBuilder) {
        currentGame.setArena(spec.arena);
      }
      currentGame.init();
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
