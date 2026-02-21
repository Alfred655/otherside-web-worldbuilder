import type {
  ShooterSpec,
  ShooterEnemy,
  ShooterPickup,
  CoverObject,
  GameSpec,
  Entity,
  Behavior,
  Vec3,
} from "@otherside/shared";

export interface ShooterAdapterResult {
  gameSpec: GameSpec;
  /** Maps enemy IDs to their wave number (undefined = wave 1 / no wave) */
  waveMap: Map<string, number>;
  /** Set of entity IDs that are ammo or weapon pickups (plugin handles proximity) */
  specialPickupIds: Set<string>;
}

export function shooterToGameSpec(spec: ShooterSpec): ShooterAdapterResult {
  const entities: Entity[] = [];
  const waveMap = new Map<string, number>();
  const specialPickupIds = new Set<string>();

  // Convert enemies
  for (const enemy of spec.enemies) {
    entities.push(enemyToEntity(enemy));
    if (enemy.spawnWave) {
      waveMap.set(enemy.id, enemy.spawnWave);
    }
  }

  // Convert pickups
  for (const pickup of spec.pickups) {
    const ent = pickupToEntity(pickup);
    entities.push(ent);
    if (pickup.type === "ammo" || pickup.type === "weapon") {
      specialPickupIds.add(pickup.id);
    }
  }

  // Convert cover objects
  for (const cover of spec.arena.coverObjects) {
    entities.push(coverToEntity(cover));
  }

  // Convert arena walls to entities
  const wallEntities = arenaWallsToEntities(spec.arena);
  for (const wall of wallEntities) {
    entities.push(wall);
  }

  // Map rules
  const winCondition = spec.rules.winCondition === "reach_score" ? "reach_score" as const : "defeat_all" as const;
  const scoreTarget = spec.rules.winCondition === "reach_score" ? spec.rules.winValue : undefined;

  const gameSpec: GameSpec = {
    name: spec.name,
    version: spec.version,
    world: spec.world,
    terrain: spec.terrain ?? {
      type: "flat",
      size: spec.arena.size,
      material: {
        color: spec.arena.floorMaterial.color,
        roughness: spec.arena.floorMaterial.roughness,
        metalness: spec.arena.floorMaterial.metalness,
      },
    },
    entities,
    player: {
      spawnPoint: spec.player.spawnPoint,
      movementSpeed: spec.player.moveSpeed,
      jumpForce: spec.player.jumpForce,
      cameraMode: "first_person",
      // Use weapon damage for attack damage (plugin overrides attack anyway)
      attackDamage: spec.weapons[0]?.damage ?? 25,
      attackRange: spec.weapons[0]?.range ?? 50,
      attackCooldown: spec.weapons[0] ? 1 / spec.weapons[0].fireRate : 0.5,
    },
    rules: {
      winCondition,
      loseCondition: spec.rules.loseCondition === "time_expired" ? "time_expired" : "health_zero",
      scoreTarget,
      timeLimitSeconds: spec.rules.timeLimitSeconds,
    },
    ui: {
      title: spec.ui.title,
      description: spec.ui.description,
      hudElements: ["health", "score", "crosshair"],
    },
  };

  return { gameSpec, waveMap, specialPickupIds };
}

function enemyToEntity(enemy: ShooterEnemy): Entity {
  const behaviors: Behavior[] = [];

  switch (enemy.behavior.aiType) {
    case "patrol":
      if (enemy.behavior.patrolPath && enemy.behavior.patrolPath.length >= 2) {
        behaviors.push({
          type: "patrol",
          path: enemy.behavior.patrolPath,
          speed: enemy.moveSpeed,
        });
      } else {
        // Fallback: small patrol around spawn
        const p = enemy.transform.position;
        behaviors.push({
          type: "patrol",
          path: [
            { x: p.x - 3, y: p.y, z: p.z },
            { x: p.x + 3, y: p.y, z: p.z },
          ],
          speed: enemy.moveSpeed,
        });
      }
      break;

    case "guard":
      {
        const gp = enemy.behavior.guardPosition ?? enemy.transform.position;
        behaviors.push({
          type: "patrol",
          path: [
            { x: gp.x - 1, y: gp.y, z: gp.z },
            { x: gp.x + 1, y: gp.y, z: gp.z },
          ],
          speed: enemy.moveSpeed * 0.3,
        });
      }
      break;

    case "chase":
      behaviors.push({
        type: "follow_player",
        speed: enemy.moveSpeed,
        maxDistance: enemy.behavior.aggroRange,
      });
      break;

    case "wander":
      {
        const wp = enemy.transform.position;
        behaviors.push({
          type: "patrol",
          path: [
            { x: wp.x - 5, y: wp.y, z: wp.z - 5 },
            { x: wp.x + 5, y: wp.y, z: wp.z - 5 },
            { x: wp.x + 5, y: wp.y, z: wp.z + 5 },
            { x: wp.x - 5, y: wp.y, z: wp.z + 5 },
          ],
          speed: enemy.moveSpeed,
        });
      }
      break;

    case "boss":
      behaviors.push({
        type: "follow_player",
        speed: enemy.moveSpeed,
        maxDistance: enemy.behavior.aggroRange,
      });
      break;
  }

  // All enemies deal contact damage
  behaviors.push({
    type: "damage",
    amount: 10,
    on: "contact",
  });

  return {
    id: enemy.id,
    name: enemy.name,
    type: "npc",
    transform: enemy.transform,
    mesh: enemy.mesh,
    material: enemy.material,
    physics: enemy.physics ?? { bodyType: "kinematic", collider: "capsule" },
    behaviors,
    health: enemy.health,
    ...(enemy.assetId ? { assetId: enemy.assetId } : {}),
  };
}

function pickupToEntity(pickup: ShooterPickup): Entity {
  const behaviors: Behavior[] = [
    { type: "rotate", axis: "y", speed: 2 },
  ];

  // Health and armor pickups use collectible behavior
  if (pickup.type === "health") {
    behaviors.push({ type: "collectible", effect: "health", value: pickup.amount });
  } else if (pickup.type === "armor") {
    behaviors.push({ type: "collectible", effect: "shield", value: pickup.amount });
  }
  // Ammo and weapon pickups have no collectible behavior — plugin handles proximity

  const isCollectibleType = pickup.type === "health" || pickup.type === "armor";

  return {
    id: pickup.id,
    name: pickupName(pickup),
    type: "collectible",
    transform: {
      position: pickup.position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 0.6, y: 0.6, z: 0.6 },
    },
    mesh: { kind: "primitive", shape: pickupShape(pickup), size: pickupSize(pickup) },
    material: { color: pickupColor(pickup), roughness: 0.3, metalness: 0.6 },
    physics: {
      bodyType: "static",
      collider: pickupShape(pickup) === "cylinder" ? "cylinder" : "box",
      sensor: isCollectibleType,
    },
    behaviors,
  };
}

function pickupName(p: ShooterPickup): string {
  switch (p.type) {
    case "health": return "Health Pack";
    case "armor": return "Armor";
    case "ammo": return "Ammo Crate";
    case "weapon": return "Weapon Pickup";
  }
}

function pickupShape(p: ShooterPickup): "box" | "sphere" | "cylinder" | "plane" {
  switch (p.type) {
    case "health": return "box";
    case "armor": return "box";
    case "ammo": return "box";
    case "weapon": return "cylinder";
  }
}

function pickupSize(p: ShooterPickup): Vec3 {
  switch (p.type) {
    case "health": return { x: 0.6, y: 0.6, z: 0.6 };
    case "armor": return { x: 0.7, y: 0.5, z: 0.7 };
    case "ammo": return { x: 0.5, y: 0.4, z: 0.5 };
    case "weapon": return { x: 0.4, y: 0.8, z: 0.4 };
  }
}

function pickupColor(p: ShooterPickup): string {
  switch (p.type) {
    case "health": return "#ff4444";
    case "armor": return "#4488ff";
    case "ammo": return "#ffaa00";
    case "weapon": return "#44ff88";
  }
}

function arenaWallsToEntities(arena: import("@otherside/shared").Arena): Entity[] {
  const walls: Entity[] = [];
  const { size, wallHeight } = arena;
  const wallMat = arena.wallMaterial;
  const h = wallHeight;

  if (arena.shape === "rectangle") {
    const halfX = size.x / 2;
    const halfZ = size.z / 2;
    const wallDefs: { id: string; x: number; z: number; sx: number; sz: number }[] = [
      { id: "arena-wall-back", x: 0, z: -halfZ, sx: size.x, sz: 0.5 },
      { id: "arena-wall-front", x: 0, z: halfZ, sx: size.x, sz: 0.5 },
      { id: "arena-wall-left", x: -halfX, z: 0, sx: 0.5, sz: size.z },
      { id: "arena-wall-right", x: halfX, z: 0, sx: 0.5, sz: size.z },
    ];

    for (const def of wallDefs) {
      walls.push({
        id: def.id,
        name: "Arena Wall",
        type: "prop",
        transform: {
          position: { x: def.x, y: h / 2, z: def.z },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        mesh: { kind: "primitive", shape: "box", size: { x: def.sx, y: h, z: def.sz } },
        material: { color: wallMat.color, roughness: wallMat.roughness, metalness: wallMat.metalness },
        physics: { bodyType: "static", collider: "box" },
        behaviors: [],
      });
    }
  } else {
    // Circle: 20 segments
    const radius = size.x / 2;
    const segments = 20;
    const segWidth = (2 * Math.PI * radius) / segments;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      walls.push({
        id: `arena-wall-${i}`,
        name: "Arena Wall",
        type: "prop",
        transform: {
          position: { x, y: h / 2, z },
          rotation: { x: 0, y: -angle + Math.PI / 2, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        mesh: { kind: "primitive", shape: "box", size: { x: segWidth, y: h, z: 0.5 } },
        material: { color: wallMat.color, roughness: wallMat.roughness, metalness: wallMat.metalness },
        physics: { bodyType: "static", collider: "box" },
        behaviors: [],
      });
    }
  }

  return walls;
}

function coverToEntity(cover: CoverObject): Entity {
  const behaviors: Behavior[] = [];

  return {
    id: cover.id,
    name: `Cover ${cover.id}`,
    type: "prop",
    transform: cover.transform,
    mesh: cover.mesh,
    material: cover.material,
    physics: { bodyType: "static", collider: "box" },
    behaviors,
    health: cover.destructible ? cover.health : undefined,
    ...(cover.assetId ? { assetId: cover.assetId } : {}),
  };
}
