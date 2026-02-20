import type { GameSpec } from "../schema.js";

/**
 * Sample game: "Arena Survivor"
 *
 * A floating platform arena. Defeat all enemies to win.
 * - 3 patrolling sentinels (melee damage on contact)
 * - 1 hunter that chases the player
 * - 1 turret spawner that fires projectiles
 * - 5 score crystals + 3 health pickups
 * - 4 slowly-rotating decorative pillars
 *
 * Left-click to attack, WASD to move, Space to jump.
 */
export const arenaSpec: GameSpec = {
  name: "Arena Survivor",
  version: "2.0.0",

  world: {
    skyColor: "#0a0a1a",
    ambientLightColor: "#404060",
    ambientLightIntensity: 0.5,
    fog: {
      color: "#0a0a1a",
      near: 20,
      far: 80,
    },
    gravity: { x: 0, y: -9.81, z: 0 },
  },

  terrain: {
    type: "flat",
    size: { x: 30, y: 1, z: 30 },
    material: {
      color: "#2d2d44",
      roughness: 0.9,
      metalness: 0.1,
    },
  },

  player: {
    spawnPoint: { x: 0, y: 2, z: 0 },
    movementSpeed: 6,
    jumpForce: 10,
    cameraMode: "first_person",
    attackDamage: 25,
    attackRange: 50,
    attackCooldown: 0.4,
  },

  entities: [
    // ======== Enemies ========

    // ── 3 Patrol sentinels ──────────────────────────────────────────────
    {
      id: "sentinel-1",
      name: "Sentinel Alpha",
      type: "npc",
      health: 75,
      transform: {
        position: { x: 8, y: 0.75, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: { kind: "primitive", shape: "sphere", size: { x: 1.5, y: 1.5, z: 1.5 } },
      material: { color: "#ff3366", roughness: 0.3, metalness: 0.7 },
      physics: { bodyType: "kinematic", collider: "sphere" },
      behaviors: [
        {
          type: "patrol",
          path: [
            { x: 8, y: 0.75, z: 0 },
            { x: 8, y: 0.75, z: 10 },
            { x: -2, y: 0.75, z: 10 },
            { x: -2, y: 0.75, z: 0 },
          ],
          speed: 3,
        },
        { type: "damage", amount: 15, on: "contact" },
        { type: "rotate", axis: "y", speed: 2 },
      ],
    },
    {
      id: "sentinel-2",
      name: "Sentinel Beta",
      type: "npc",
      health: 75,
      transform: {
        position: { x: -8, y: 0.75, z: -5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: { kind: "primitive", shape: "sphere", size: { x: 1.5, y: 1.5, z: 1.5 } },
      material: { color: "#ff3366", roughness: 0.3, metalness: 0.7 },
      physics: { bodyType: "kinematic", collider: "sphere" },
      behaviors: [
        {
          type: "patrol",
          path: [
            { x: -8, y: 0.75, z: -5 },
            { x: -8, y: 0.75, z: 5 },
            { x: 0, y: 0.75, z: 5 },
          ],
          speed: 2.5,
        },
        { type: "damage", amount: 15, on: "contact" },
      ],
    },
    {
      id: "sentinel-3",
      name: "Sentinel Gamma",
      type: "npc",
      health: 100,
      transform: {
        position: { x: 0, y: 0.75, z: -10 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.2, y: 1.2, z: 1.2 },
      },
      mesh: { kind: "primitive", shape: "sphere", size: { x: 1.8, y: 1.8, z: 1.8 } },
      material: { color: "#cc2255", roughness: 0.2, metalness: 0.8 },
      physics: { bodyType: "kinematic", collider: "sphere" },
      behaviors: [
        {
          type: "patrol",
          path: [
            { x: 0, y: 0.75, z: -10 },
            { x: 10, y: 0.75, z: -10 },
            { x: 10, y: 0.75, z: -2 },
            { x: 0, y: 0.75, z: -2 },
          ],
          speed: 4,
        },
        { type: "damage", amount: 20, on: "contact" },
        { type: "rotate", axis: "y", speed: 3 },
      ],
    },

    // ── Hunter (follows player) ─────────────────────────────────────────
    {
      id: "hunter",
      name: "Hunter",
      type: "npc",
      health: 100,
      transform: {
        position: { x: -10, y: 0.6, z: -10 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: { kind: "primitive", shape: "box", size: { x: 1.2, y: 1.2, z: 1.2 } },
      material: { color: "#ff6600", roughness: 0.3, metalness: 0.5 },
      physics: { bodyType: "kinematic", collider: "box" },
      behaviors: [
        { type: "follow_player", speed: 3.5, maxDistance: 18 },
        { type: "damage", amount: 20, on: "contact" },
        { type: "rotate", axis: "y", speed: 1.5 },
      ],
    },

    // ── Turret spawner ──────────────────────────────────────────────────
    {
      id: "turret",
      name: "Turret",
      type: "npc",
      health: 150,
      transform: {
        position: { x: 12, y: 0.75, z: -12 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 1.5, y: 1.5, z: 1.5 } },
      material: { color: "#aa00ff", roughness: 0.2, metalness: 0.9 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [
        { type: "rotate", axis: "y", speed: 1 },
        {
          type: "spawner",
          interval: 3,
          maxCount: 3,
          aimAtPlayer: true,
          spawnOffset: { x: 0, y: 1.5, z: 0 },
          template: {
            name: "Plasma Bolt",
            type: "projectile",
            mesh: { kind: "primitive", shape: "sphere", size: { x: 0.4, y: 0.4, z: 0.4 } },
            material: { color: "#ff00ff", roughness: 0.0, metalness: 1.0 },
            physics: { bodyType: "kinematic", collider: "sphere", sensor: true },
            behaviors: [
              { type: "projectile", direction: { x: 0, y: 0, z: -1 }, speed: 12, damage: 15, lifetime: 4 },
            ],
          },
        },
      ],
    },

    // ======== Collectibles ========

    // ── Score crystals (5) ──────────────────────────────────────────────
    {
      id: "crystal-1",
      name: "Score Crystal",
      type: "collectible",
      transform: {
        position: { x: 5, y: 1.2, z: 5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.3, y: 0.8, z: 0.3 } },
      material: { color: "#44ffaa", roughness: 0.1, metalness: 0.9 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [
        { type: "collectible", effect: "score", value: 10 },
        { type: "rotate", axis: "y", speed: 2 },
      ],
    },
    {
      id: "crystal-2",
      name: "Score Crystal",
      type: "collectible",
      transform: {
        position: { x: -7, y: 1.2, z: 3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.3, y: 0.8, z: 0.3 } },
      material: { color: "#44ffaa", roughness: 0.1, metalness: 0.9 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [
        { type: "collectible", effect: "score", value: 10 },
        { type: "rotate", axis: "y", speed: 2 },
      ],
    },
    {
      id: "crystal-3",
      name: "Score Crystal",
      type: "collectible",
      transform: {
        position: { x: 10, y: 1.2, z: -8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.3, y: 0.8, z: 0.3 } },
      material: { color: "#44ffaa", roughness: 0.1, metalness: 0.9 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [
        { type: "collectible", effect: "score", value: 10 },
        { type: "rotate", axis: "y", speed: 2 },
      ],
    },
    {
      id: "crystal-4",
      name: "Score Crystal",
      type: "collectible",
      transform: {
        position: { x: -3, y: 1.2, z: -12 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.3, y: 0.8, z: 0.3 } },
      material: { color: "#44ffaa", roughness: 0.1, metalness: 0.9 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [
        { type: "collectible", effect: "score", value: 10 },
        { type: "rotate", axis: "y", speed: 2 },
      ],
    },
    {
      id: "crystal-5",
      name: "Score Crystal",
      type: "collectible",
      transform: {
        position: { x: 0, y: 1.2, z: 8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.3, y: 0.8, z: 0.3 } },
      material: { color: "#44ffaa", roughness: 0.1, metalness: 0.9 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [
        { type: "collectible", effect: "score", value: 10 },
        { type: "rotate", axis: "y", speed: 2 },
      ],
    },

    // ── Health pickups (3) ──────────────────────────────────────────────
    {
      id: "health-1",
      name: "Health Pack",
      type: "collectible",
      transform: {
        position: { x: -12, y: 1.0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.6, y: 0.6, z: 0.6 },
      },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.6, y: 0.6, z: 0.6 } },
      material: { color: "#ff4444", roughness: 0.2, metalness: 0.3 },
      physics: { bodyType: "static", collider: "box" },
      behaviors: [
        { type: "collectible", effect: "health", value: 30 },
        { type: "rotate", axis: "y", speed: 1.5 },
      ],
    },
    {
      id: "health-2",
      name: "Health Pack",
      type: "collectible",
      transform: {
        position: { x: 6, y: 1.0, z: -5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.6, y: 0.6, z: 0.6 },
      },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.6, y: 0.6, z: 0.6 } },
      material: { color: "#ff4444", roughness: 0.2, metalness: 0.3 },
      physics: { bodyType: "static", collider: "box" },
      behaviors: [
        { type: "collectible", effect: "health", value: 30 },
        { type: "rotate", axis: "y", speed: 1.5 },
      ],
    },
    {
      id: "health-3",
      name: "Health Pack",
      type: "collectible",
      transform: {
        position: { x: -5, y: 1.0, z: 10 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.6, y: 0.6, z: 0.6 },
      },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.6, y: 0.6, z: 0.6 } },
      material: { color: "#ff4444", roughness: 0.2, metalness: 0.3 },
      physics: { bodyType: "static", collider: "box" },
      behaviors: [
        { type: "collectible", effect: "health", value: 30 },
        { type: "rotate", axis: "y", speed: 1.5 },
      ],
    },

    // ======== Props (decorative pillars) ========
    {
      id: "pillar-1",
      name: "Corner Pillar NE",
      type: "prop",
      transform: {
        position: { x: 13, y: 1.5, z: 13 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.5, y: 3, z: 0.5 } },
      material: { color: "#6c63ff", roughness: 0.4, metalness: 0.6 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [{ type: "rotate", axis: "y", speed: 0.3 }],
    },
    {
      id: "pillar-2",
      name: "Corner Pillar NW",
      type: "prop",
      transform: {
        position: { x: -13, y: 1.5, z: 13 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.5, y: 3, z: 0.5 } },
      material: { color: "#6c63ff", roughness: 0.4, metalness: 0.6 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [{ type: "rotate", axis: "y", speed: 0.3 }],
    },
    {
      id: "pillar-3",
      name: "Corner Pillar SE",
      type: "prop",
      transform: {
        position: { x: 13, y: 1.5, z: -13 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.5, y: 3, z: 0.5 } },
      material: { color: "#6c63ff", roughness: 0.4, metalness: 0.6 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [{ type: "rotate", axis: "y", speed: 0.3 }],
    },
    {
      id: "pillar-4",
      name: "Corner Pillar SW",
      type: "prop",
      transform: {
        position: { x: -13, y: 1.5, z: -13 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.5, y: 3, z: 0.5 } },
      material: { color: "#6c63ff", roughness: 0.4, metalness: 0.6 },
      physics: { bodyType: "static", collider: "cylinder" },
      behaviors: [{ type: "rotate", axis: "y", speed: 0.3 }],
    },
  ],

  rules: {
    winCondition: "defeat_all",
    loseCondition: "health_zero",
  },

  ui: {
    title: "Arena Survivor",
    description:
      "Defeat all enemies to win! Collect crystals for score and health packs to heal. Left-click to attack.",
    hudElements: ["score", "health"],
  },
};
