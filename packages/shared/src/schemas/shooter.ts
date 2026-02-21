import { z } from "zod";
import {
  Vec3Schema,
  ColorSchema,
  MeshSchema,
  MaterialSchema,
  PhysicsSchema,
  WorldConfigSchema,
  TransformSchema,
  TerrainSchema,
} from "../schema.js";

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

export const WeaponSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["hitscan", "projectile"]),
  damage: z.number().positive(),
  fireRate: z.number().positive(),
  reloadTime: z.number().positive(),
  magSize: z.number().int().positive(),
  maxReserve: z.number().int().positive(),
  spread: z.number().min(0).max(1).default(0),
  range: z.number().positive().default(50),
});

// ---------------------------------------------------------------------------
// Enemy
// ---------------------------------------------------------------------------

export const EnemyBehaviorSchema = z.object({
  aiType: z.enum(["patrol", "guard", "chase", "wander", "boss"]),
  patrolPath: z.array(Vec3Schema).min(2).optional(),
  guardPosition: Vec3Schema.optional(),
  aggroRange: z.number().positive().default(15),
  attackRange: z.number().positive().default(2),
});

export const ShooterEnemySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  health: z.number().positive(),
  moveSpeed: z.number().positive().default(3),
  transform: TransformSchema,
  mesh: MeshSchema,
  material: MaterialSchema,
  physics: PhysicsSchema.optional(),
  behavior: EnemyBehaviorSchema,
  spawnWave: z.number().int().min(1).optional(),
  weapon: z.string().optional(),
  accuracy: z.number().min(0).max(1).default(0.5),
  lootDrop: z.enum(["health", "ammo"]).optional(),
  assetId: z.string().optional(),  // reference to asset catalog entry
});

// ---------------------------------------------------------------------------
// Pickups — discriminated union on type
// ---------------------------------------------------------------------------

export const HealthPickupSchema = z.object({
  type: z.literal("health"),
  id: z.string().min(1),
  position: Vec3Schema,
  amount: z.number().positive(),
  respawnTime: z.number().positive().optional(),
});

export const ArmorPickupSchema = z.object({
  type: z.literal("armor"),
  id: z.string().min(1),
  position: Vec3Schema,
  amount: z.number().positive(),
  respawnTime: z.number().positive().optional(),
});

export const AmmoPickupSchema = z.object({
  type: z.literal("ammo"),
  id: z.string().min(1),
  position: Vec3Schema,
  amount: z.number().positive(),
  weaponId: z.string(),
});

export const WeaponPickupSchema = z.object({
  type: z.literal("weapon"),
  id: z.string().min(1),
  position: Vec3Schema,
  weaponId: z.string(),
});

export const ShooterPickupSchema = z.discriminatedUnion("type", [
  HealthPickupSchema,
  ArmorPickupSchema,
  AmmoPickupSchema,
  WeaponPickupSchema,
]);

// ---------------------------------------------------------------------------
// Layout system — zone-based level design
// ---------------------------------------------------------------------------

export const LayoutTemplateEnum = z.enum([
  "warehouse", "courtyard", "corridors", "rooftop", "bunker",
]);

export const ZoneTypeEnum = z.enum([
  "cover_heavy", "cover_light", "open_combat",
  "supply_cache", "sniper_perch", "landmark", "spawn_area",
]);

export const ZoneRegionEnum = z.enum([
  "north", "south", "east", "west",
  "northeast", "northwest", "southeast", "southwest", "center",
]);

export const ArenaZoneSchema = z.object({
  type: ZoneTypeEnum,
  region: ZoneRegionEnum,
  description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------------

export const CoverObjectSchema = z.object({
  id: z.string().min(1),
  transform: TransformSchema,
  mesh: MeshSchema,
  material: MaterialSchema,
  destructible: z.boolean().default(false),
  health: z.number().positive().optional(),
  assetId: z.string().optional(),  // reference to asset catalog entry
});

export const ArenaSchema = z.object({
  shape: z.enum(["rectangle", "circle"]),
  size: Vec3Schema,
  wallHeight: z.number().positive().default(4),
  floorMaterial: MaterialSchema,
  wallMaterial: MaterialSchema,
  coverObjects: z.array(CoverObjectSchema).default([]),
  layoutTemplate: LayoutTemplateEnum.optional(),
  theme: z.string().optional(),
  zones: z.array(ArenaZoneSchema).optional(),
});

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------

export const WaveSchema = z.object({
  waveNumber: z.number().int().positive(),
  enemyIds: z.array(z.string()).min(1),
  spawnDelay: z.number().min(0).default(0),
});

export const WaveConfigSchema = z.object({
  waves: z.array(WaveSchema).min(1),
  timeBetweenWaves: z.number().positive().default(5),
});

// ---------------------------------------------------------------------------
// Player, Rules, UI
// ---------------------------------------------------------------------------

export const ShooterPlayerConfigSchema = z.object({
  spawnPoint: Vec3Schema,
  health: z.number().positive().default(100),
  moveSpeed: z.number().positive().default(6),
  sprintSpeed: z.number().positive().default(9),
  jumpForce: z.number().positive().default(8),
  startingWeapon: z.string(),
  startingAmmo: z.record(z.string(), z.number().int().positive()).optional(),
});

export const ShooterRulesSchema = z.object({
  mode: z.enum(["elimination", "waves", "score_attack"]),
  winCondition: z.enum(["defeat_all", "survive_waves", "reach_score"]),
  winValue: z.number().positive().optional(),
  loseCondition: z.enum(["health_zero", "time_expired"]),
  timeLimitSeconds: z.number().positive().optional(),
});

export const ShooterUISchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  showCrosshair: z.boolean().default(true),
  showAmmo: z.boolean().default(true),
  showWaveCounter: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Top-level ShooterSpec
// ---------------------------------------------------------------------------

export const ShooterSpecSchema = z.object({
  name: z.string().min(1),
  version: z.union([z.string(), z.number().transform(String)]).default("1.0.0"),
  template: z.literal("shooter"),
  world: WorldConfigSchema,
  arena: ArenaSchema,
  terrain: TerrainSchema.optional(),
  weapons: z.array(WeaponSchema).min(1),
  player: ShooterPlayerConfigSchema,
  enemies: z.array(ShooterEnemySchema).min(1),
  pickups: z.array(ShooterPickupSchema).default([]),
  waveConfig: WaveConfigSchema.optional(),
  rules: ShooterRulesSchema,
  ui: ShooterUISchema,
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Weapon = z.infer<typeof WeaponSchema>;
export type EnemyBehavior = z.infer<typeof EnemyBehaviorSchema>;
export type ShooterEnemy = z.infer<typeof ShooterEnemySchema>;
export type HealthPickup = z.infer<typeof HealthPickupSchema>;
export type ArmorPickup = z.infer<typeof ArmorPickupSchema>;
export type AmmoPickup = z.infer<typeof AmmoPickupSchema>;
export type WeaponPickup = z.infer<typeof WeaponPickupSchema>;
export type ShooterPickup = z.infer<typeof ShooterPickupSchema>;
export type CoverObject = z.infer<typeof CoverObjectSchema>;
export type Arena = z.infer<typeof ArenaSchema>;
export type Wave = z.infer<typeof WaveSchema>;
export type WaveConfig = z.infer<typeof WaveConfigSchema>;
export type ShooterPlayerConfig = z.infer<typeof ShooterPlayerConfigSchema>;
export type ShooterRules = z.infer<typeof ShooterRulesSchema>;
export type ShooterUI = z.infer<typeof ShooterUISchema>;
export type ShooterSpec = z.infer<typeof ShooterSpecSchema>;
export type LayoutTemplate = z.infer<typeof LayoutTemplateEnum>;
export type ZoneType = z.infer<typeof ZoneTypeEnum>;
export type ZoneRegion = z.infer<typeof ZoneRegionEnum>;
export type ArenaZone = z.infer<typeof ArenaZoneSchema>;
