import type { ShooterSpec } from "../schemas/shooter.js";

/**
 * Sample shooter: "Rooftop Standoff"
 *
 * Open circular arena on a rooftop, sniper enemies,
 * assault rifle, elimination mode.
 */
export const rooftopStandoffSpec: ShooterSpec = {
  name: "Rooftop Standoff",
  version: "1.0.0",
  template: "shooter",

  world: {
    skyColor: "#ff7744",
    ambientLightColor: "#ffa060",
    ambientLightIntensity: 0.7,
    fog: { color: "#ff9966", near: 30, far: 80 },
    gravity: { x: 0, y: -9.81, z: 0 },
    timeOfDay: "dusk",
  },

  arena: {
    shape: "circle",
    size: { x: 35, y: 3, z: 35 },
    wallHeight: 3,
    floorMaterial: { color: "#666666", roughness: 0.8, metalness: 0.2 },
    wallMaterial: { color: "#444444", roughness: 0.6, metalness: 0.4 },
    coverObjects: [
      {
        id: "ac-unit-1",
        transform: { position: { x: -6, y: 1, z: -6 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        mesh: { kind: "primitive", shape: "box", size: { x: 2.5, y: 2, z: 2 } },
        material: { color: "#888888", roughness: 0.7, metalness: 0.5 },
        destructible: false,
      },
      {
        id: "ac-unit-2",
        transform: { position: { x: 7, y: 1, z: 5 }, rotation: { x: 0, y: 0.8, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        mesh: { kind: "primitive", shape: "box", size: { x: 2.5, y: 2, z: 2 } },
        material: { color: "#888888", roughness: 0.7, metalness: 0.5 },
        destructible: false,
      },
      {
        id: "pipe-stack",
        transform: { position: { x: 0, y: 0.5, z: -10 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        mesh: { kind: "primitive", shape: "cylinder", size: { x: 1.5, y: 1, z: 1.5 } },
        material: { color: "#996633", roughness: 0.8, metalness: 0.3 },
        destructible: false,
      },
    ],
  },

  weapons: [
    { id: "assault-rifle", name: "Assault Rifle", type: "hitscan", damage: 12, fireRate: 8, reloadTime: 2, magSize: 30, maxReserve: 120, spread: 0.04, range: 60 },
  ],

  player: {
    spawnPoint: { x: 0, y: 2, z: 0 },
    health: 100,
    moveSpeed: 6,
    sprintSpeed: 9,
    jumpForce: 8,
    startingWeapon: "assault-rifle",
    startingAmmo: { "assault-rifle": 90 },
  },

  enemies: [
    {
      id: "sniper-1", name: "Rooftop Sniper", health: 60, moveSpeed: 1.5, accuracy: 0.7,
      transform: { position: { x: -14, y: 1, z: -10 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.6, y: 1.8, z: 0.6 } },
      material: { color: "#223344", roughness: 0.4, metalness: 0.6 },
      physics: { bodyType: "kinematic", collider: "cylinder" },
      behavior: { aiType: "guard", guardPosition: { x: -14, y: 1, z: -10 }, aggroRange: 25, attackRange: 3 },
    },
    {
      id: "sniper-2", name: "Rooftop Sniper", health: 60, moveSpeed: 1.5, accuracy: 0.7,
      transform: { position: { x: 14, y: 1, z: -8 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "cylinder", size: { x: 0.6, y: 1.8, z: 0.6 } },
      material: { color: "#223344", roughness: 0.4, metalness: 0.6 },
      physics: { bodyType: "kinematic", collider: "cylinder" },
      behavior: { aiType: "guard", guardPosition: { x: 14, y: 1, z: -8 }, aggroRange: 25, attackRange: 3 },
    },
    {
      id: "enforcer-1", name: "Enforcer", health: 80, moveSpeed: 3, accuracy: 0.5,
      transform: { position: { x: 0, y: 1, z: -14 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 1, y: 2, z: 0.8 } },
      material: { color: "#442233", roughness: 0.3, metalness: 0.7 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "chase", aggroRange: 20, attackRange: 2 },
      lootDrop: "ammo",
    },
    {
      id: "patroller-1", name: "Patrol Guard", health: 50, moveSpeed: 2.5, accuracy: 0.4,
      transform: { position: { x: -10, y: 1, z: 8 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.8, y: 1.8, z: 0.6 } },
      material: { color: "#334455", roughness: 0.5, metalness: 0.4 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "patrol", patrolPath: [{ x: -10, y: 1, z: 8 }, { x: 10, y: 1, z: 8 }, { x: 10, y: 1, z: -5 }], aggroRange: 15, attackRange: 2 },
    },
    {
      id: "patroller-2", name: "Patrol Guard", health: 50, moveSpeed: 2.5, accuracy: 0.4,
      transform: { position: { x: 10, y: 1, z: -12 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.8, y: 1.8, z: 0.6 } },
      material: { color: "#334455", roughness: 0.5, metalness: 0.4 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "patrol", patrolPath: [{ x: 10, y: 1, z: -12 }, { x: -5, y: 1, z: -12 }, { x: -5, y: 1, z: 5 }], aggroRange: 15, attackRange: 2 },
    },
  ],

  pickups: [
    { type: "health", id: "hp-1", position: { x: -12, y: 0.5, z: 5 }, amount: 30 },
    { type: "health", id: "hp-2", position: { x: 12, y: 0.5, z: 5 }, amount: 30 },
    { type: "ammo", id: "ammo-ar-1", position: { x: 0, y: 0.5, z: 8 }, amount: 30, weaponId: "assault-rifle" },
  ],

  rules: { mode: "elimination", winCondition: "defeat_all", loseCondition: "health_zero" },

  ui: {
    title: "Rooftop Standoff",
    description: "Eliminate all hostiles on the rooftop. Use cover and aim true.",
    showCrosshair: true, showAmmo: true, showWaveCounter: false,
  },
};
