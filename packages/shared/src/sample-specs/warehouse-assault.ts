import type { ShooterSpec } from "../schemas/shooter.js";

/**
 * Sample shooter: "Warehouse Assault"
 *
 * Rectangular arena with crate cover, 3 waves of grunts,
 * pistol + shotgun, ammo/health pickups.
 */
export const warehouseAssaultSpec: ShooterSpec = {
  name: "Warehouse Assault",
  version: "1.0.0",
  template: "shooter",

  world: {
    skyColor: "#1a1a2e",
    ambientLightColor: "#404060",
    ambientLightIntensity: 0.5,
    fog: { color: "#1a1a2e", near: 20, far: 60 },
    gravity: { x: 0, y: -9.81, z: 0 },
  },

  arena: {
    shape: "rectangle",
    size: { x: 40, y: 4, z: 30 },
    wallHeight: 4,
    floorMaterial: { color: "#3a3a3a", roughness: 0.9, metalness: 0.1 },
    wallMaterial: { color: "#555555", roughness: 0.7, metalness: 0.3 },
    coverObjects: [
      {
        id: "crate-1",
        transform: { position: { x: -8, y: 1, z: 5 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        mesh: { kind: "primitive", shape: "box", size: { x: 2, y: 2, z: 2 } },
        material: { color: "#8b6914", roughness: 0.8, metalness: 0.1 },
        destructible: false,
      },
      {
        id: "crate-2",
        transform: { position: { x: 8, y: 1, z: -5 }, rotation: { x: 0, y: 0.4, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        mesh: { kind: "primitive", shape: "box", size: { x: 2, y: 2, z: 2 } },
        material: { color: "#8b6914", roughness: 0.8, metalness: 0.1 },
        destructible: false,
      },
      {
        id: "barrel-1",
        transform: { position: { x: 0, y: 0.75, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        mesh: { kind: "primitive", shape: "cylinder", size: { x: 1, y: 1.5, z: 1 } },
        material: { color: "#cc3333", roughness: 0.5, metalness: 0.4 },
        destructible: true,
        health: 30,
      },
      {
        id: "crate-stack",
        transform: { position: { x: -3, y: 1.5, z: -8 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        mesh: { kind: "primitive", shape: "box", size: { x: 3, y: 3, z: 2 } },
        material: { color: "#6b5a14", roughness: 0.8, metalness: 0.1 },
        destructible: false,
      },
    ],
  },

  weapons: [
    { id: "pistol", name: "Pistol", type: "hitscan", damage: 15, fireRate: 3, reloadTime: 1.5, magSize: 12, maxReserve: 60, spread: 0.02, range: 50 },
    { id: "shotgun", name: "Shotgun", type: "hitscan", damage: 40, fireRate: 1, reloadTime: 2.5, magSize: 6, maxReserve: 30, spread: 0.15, range: 20 },
  ],

  player: {
    spawnPoint: { x: 0, y: 2, z: 12 },
    health: 100,
    moveSpeed: 6,
    sprintSpeed: 9,
    jumpForce: 8,
    startingWeapon: "pistol",
    startingAmmo: { pistol: 36, shotgun: 12 },
  },

  enemies: [
    // Wave 1
    {
      id: "grunt-1", name: "Warehouse Grunt", health: 40, moveSpeed: 3, accuracy: 0.5,
      transform: { position: { x: -12, y: 1, z: -8 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.8, y: 1.8, z: 0.6 } },
      material: { color: "#884422", roughness: 0.6, metalness: 0.2 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "patrol", patrolPath: [{ x: -12, y: 1, z: -8 }, { x: -12, y: 1, z: 5 }], aggroRange: 15, attackRange: 2 },
      spawnWave: 1,
    },
    {
      id: "grunt-2", name: "Warehouse Grunt", health: 40, moveSpeed: 3.5, accuracy: 0.5,
      transform: { position: { x: 12, y: 1, z: -5 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.8, y: 1.8, z: 0.6 } },
      material: { color: "#884422", roughness: 0.6, metalness: 0.2 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "chase", aggroRange: 18, attackRange: 2 },
      spawnWave: 1,
    },
    {
      id: "grunt-3", name: "Warehouse Grunt", health: 40, moveSpeed: 2.5, accuracy: 0.5,
      transform: { position: { x: 0, y: 1, z: -12 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.8, y: 1.8, z: 0.6 } },
      material: { color: "#884422", roughness: 0.6, metalness: 0.2 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "guard", guardPosition: { x: 0, y: 1, z: -12 }, aggroRange: 12, attackRange: 2 },
      spawnWave: 1,
    },
    // Wave 2
    {
      id: "heavy-1", name: "Heavy Grunt", health: 70, moveSpeed: 2, accuracy: 0.5,
      transform: { position: { x: -15, y: 1, z: -10 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1.2, y: 1.2, z: 1.2 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 1, y: 2, z: 0.8 } },
      material: { color: "#663311", roughness: 0.5, metalness: 0.4 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "chase", aggroRange: 20, attackRange: 2.5 },
      spawnWave: 2,
    },
    {
      id: "heavy-2", name: "Heavy Grunt", health: 70, moveSpeed: 2, accuracy: 0.5,
      transform: { position: { x: 15, y: 1, z: -10 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1.2, y: 1.2, z: 1.2 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 1, y: 2, z: 0.8 } },
      material: { color: "#663311", roughness: 0.5, metalness: 0.4 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "patrol", patrolPath: [{ x: 15, y: 1, z: -10 }, { x: 10, y: 1, z: 5 }, { x: 15, y: 1, z: 10 }], aggroRange: 15, attackRange: 2.5 },
      spawnWave: 2,
    },
    {
      id: "flanker-1", name: "Flanker", health: 30, moveSpeed: 5, accuracy: 0.5,
      transform: { position: { x: 0, y: 1, z: -13 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.9, y: 0.9, z: 0.9 } },
      mesh: { kind: "primitive", shape: "sphere", size: { x: 1.2, y: 1.2, z: 1.2 } },
      material: { color: "#cc4400", roughness: 0.3, metalness: 0.6 },
      physics: { bodyType: "kinematic", collider: "sphere" },
      behavior: { aiType: "chase", aggroRange: 25, attackRange: 1.5 },
      spawnWave: 2,
    },
    // Wave 3
    {
      id: "boss-1", name: "Warehouse Boss", health: 200, moveSpeed: 2, accuracy: 0.5,
      transform: { position: { x: 0, y: 1.2, z: -12 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1.5, y: 1.5, z: 1.5 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 1.5, y: 2.5, z: 1 } },
      material: { color: "#440022", roughness: 0.3, metalness: 0.8 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "boss", aggroRange: 30, attackRange: 3 },
      spawnWave: 3, lootDrop: "health",
    },
    {
      id: "boss-guard-1", name: "Boss Guard", health: 50, moveSpeed: 3, accuracy: 0.5,
      transform: { position: { x: -8, y: 1, z: -12 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.8, y: 1.8, z: 0.6 } },
      material: { color: "#441122", roughness: 0.5, metalness: 0.5 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "chase", aggroRange: 20, attackRange: 2 },
      spawnWave: 3,
    },
    {
      id: "boss-guard-2", name: "Boss Guard", health: 50, moveSpeed: 3, accuracy: 0.5,
      transform: { position: { x: 8, y: 1, z: -12 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      mesh: { kind: "primitive", shape: "box", size: { x: 0.8, y: 1.8, z: 0.6 } },
      material: { color: "#441122", roughness: 0.5, metalness: 0.5 },
      physics: { bodyType: "kinematic", collider: "box" },
      behavior: { aiType: "chase", aggroRange: 20, attackRange: 2 },
      spawnWave: 3,
    },
  ],

  pickups: [
    { type: "health", id: "hp-1", position: { x: -15, y: 0.5, z: 10 }, amount: 25 },
    { type: "health", id: "hp-2", position: { x: 15, y: 0.5, z: 10 }, amount: 25 },
    { type: "ammo", id: "ammo-pistol-1", position: { x: -10, y: 0.5, z: 0 }, amount: 24, weaponId: "pistol" },
    { type: "ammo", id: "ammo-shotgun-1", position: { x: 10, y: 0.5, z: 0 }, amount: 6, weaponId: "shotgun" },
    { type: "weapon", id: "shotgun-pickup", position: { x: 5, y: 0.5, z: 8 }, weaponId: "shotgun" },
  ],

  waveConfig: {
    waves: [
      { waveNumber: 1, enemyIds: ["grunt-1", "grunt-2", "grunt-3"], spawnDelay: 0 },
      { waveNumber: 2, enemyIds: ["heavy-1", "heavy-2", "flanker-1"], spawnDelay: 0 },
      { waveNumber: 3, enemyIds: ["boss-1", "boss-guard-1", "boss-guard-2"], spawnDelay: 0 },
    ],
    timeBetweenWaves: 5,
  },

  rules: { mode: "waves", winCondition: "survive_waves", loseCondition: "health_zero" },

  ui: {
    title: "Warehouse Assault",
    description: "Clear out the warehouse! Defeat all waves of enemies to win.",
    showCrosshair: true, showAmmo: true, showWaveCounter: true,
  },
};
