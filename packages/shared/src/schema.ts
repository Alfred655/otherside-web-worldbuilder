import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color (#rrggbb)");

// ---------------------------------------------------------------------------
// World config
// ---------------------------------------------------------------------------

export const FogSchema = z.object({
  color: ColorSchema,
  near: z.number().positive(),
  far: z.number().positive(),
});

export const WorldConfigSchema = z.object({
  skyColor: ColorSchema,
  ambientLightColor: ColorSchema,
  ambientLightIntensity: z.number().min(0).max(5).default(0.4),
  fog: FogSchema.optional(),
  gravity: Vec3Schema.default({ x: 0, y: -9.81, z: 0 }),
  timeOfDay: z.enum(["dawn", "morning", "noon", "afternoon", "dusk", "night", "midnight"]).optional(),
});

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

export const ScatterItemSchema = z.object({
  kind: z.enum(["tree", "rock", "bush", "crystal"]),
  density: z.number().min(0).max(1).default(0.3),
  minScale: z.number().positive().default(0.5),
  maxScale: z.number().positive().default(1.5),
});

export const TerrainSchema = z.object({
  type: z.enum(["flat", "heightmap", "procedural"]),
  size: Vec3Schema,
  material: z.object({
    color: ColorSchema,
    texture: z.string().optional(),
    proceduralTexture: z.enum(["wood", "stone", "metal", "fabric"]).optional(),
    metalness: z.number().min(0).max(1).default(0),
    roughness: z.number().min(0).max(1).default(0.8),
  }),
  seed: z.number().int().optional(),
  biome: z.enum(["temperate", "desert", "arctic", "volcanic"]).optional(),
  scatter: z.array(ScatterItemSchema).optional(),
});

// ---------------------------------------------------------------------------
// Mesh
// ---------------------------------------------------------------------------

export const PrimitiveMeshSchema = z.object({
  kind: z.literal("primitive"),
  shape: z.enum(["box", "sphere", "cylinder", "plane"]),
  size: Vec3Schema.optional(),
});

export const ModelMeshSchema = z.object({
  kind: z.literal("model"),
  url: z.string().url(),
});

export const CompoundPartSchema = z.object({
  shape: z.enum(["box", "sphere", "cylinder"]),
  size: Vec3Schema,
  offset: Vec3Schema,
  rotation: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  color: ColorSchema.optional(),
});

export const CompoundMeshSchema = z.object({
  kind: z.literal("compound"),
  parts: z.array(CompoundPartSchema).min(1),
  boundingSize: Vec3Schema.optional(),
});

export const MeshSchema = z.discriminatedUnion("kind", [
  PrimitiveMeshSchema,
  ModelMeshSchema,
  CompoundMeshSchema,
]);

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------

export const MaterialSchema = z.object({
  color: ColorSchema,
  texture: z.string().optional(),
  proceduralTexture: z.enum(["wood", "stone", "metal", "fabric"]).optional(),
  metalness: z.number().min(0).max(1).default(0),
  roughness: z.number().min(0).max(1).default(0.5),
});

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------

export const ColliderShape = z.enum(["box", "sphere", "cylinder", "capsule", "mesh"]);

export const PhysicsSchema = z.object({
  bodyType: z.enum(["static", "dynamic", "kinematic"]),
  collider: ColliderShape,
  mass: z.number().positive().optional(),
  restitution: z.number().min(0).max(1).optional(),
  friction: z.number().min(0).optional(),
  sensor: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Behaviors — discriminated union on `type`
// ---------------------------------------------------------------------------

export const PatrolBehaviorSchema = z.object({
  type: z.literal("patrol"),
  path: z.array(Vec3Schema).min(2),
  speed: z.number().positive().default(2),
});

export const FollowPlayerBehaviorSchema = z.object({
  type: z.literal("follow_player"),
  speed: z.number().positive(),
  maxDistance: z.number().positive().optional(),
});

export const RotateBehaviorSchema = z.object({
  type: z.literal("rotate"),
  axis: z.enum(["x", "y", "z"]),
  speed: z.number(),
});

export const CollectibleBehaviorSchema = z.object({
  type: z.literal("collectible"),
  effect: z.enum(["score", "health", "speed_boost", "shield"]),
  value: z.number().positive().default(1),
});

export const DamageBehaviorSchema = z.object({
  type: z.literal("damage"),
  amount: z.number().positive(),
  on: z.enum(["contact", "proximity"]),
  radius: z.number().positive().optional(),
});

export const ProjectileBehaviorSchema = z.object({
  type: z.literal("projectile"),
  direction: Vec3Schema,
  speed: z.number().positive(),
  damage: z.number().positive(),
  lifetime: z.number().positive().default(5),
});

// ── Spawner (non-recursive: templates use BasicBehaviorSchema) ──────────

const BasicBehaviorSchema = z.discriminatedUnion("type", [
  PatrolBehaviorSchema,
  FollowPlayerBehaviorSchema,
  RotateBehaviorSchema,
  CollectibleBehaviorSchema,
  DamageBehaviorSchema,
  ProjectileBehaviorSchema,
]);

export const SpawnTemplateSchema = z.object({
  name: z.string(),
  type: z.enum(["npc", "prop", "collectible", "projectile"]),
  mesh: MeshSchema,
  material: MaterialSchema,
  physics: PhysicsSchema.optional(),
  behaviors: z.array(BasicBehaviorSchema).default([]),
  health: z.number().positive().optional(),
});

export const SpawnerBehaviorSchema = z.object({
  type: z.literal("spawner"),
  template: SpawnTemplateSchema,
  interval: z.number().positive(),
  maxCount: z.number().int().positive().default(5),
  spawnOffset: Vec3Schema.optional(),
  aimAtPlayer: z.boolean().default(false),
});

// ── Full behavior union (includes spawner) ──────────────────────────────

export const BehaviorSchema = z.discriminatedUnion("type", [
  PatrolBehaviorSchema,
  FollowPlayerBehaviorSchema,
  RotateBehaviorSchema,
  CollectibleBehaviorSchema,
  DamageBehaviorSchema,
  ProjectileBehaviorSchema,
  SpawnerBehaviorSchema,
]);

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

export const TransformSchema = z.object({
  position: Vec3Schema,
  rotation: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  scale: Vec3Schema.default({ x: 1, y: 1, z: 1 }),
});

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export const EntityTypeSchema = z.enum([
  "player",
  "npc",
  "prop",
  "collectible",
  "trigger",
  "projectile",
]);

export const EntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: EntityTypeSchema,
  transform: TransformSchema,
  mesh: MeshSchema,
  material: MaterialSchema,
  physics: PhysicsSchema.optional(),
  behaviors: z.array(BehaviorSchema).default([]),
  health: z.number().positive().optional(),
});

// ---------------------------------------------------------------------------
// Player config
// ---------------------------------------------------------------------------

export const PlayerConfigSchema = z.object({
  spawnPoint: Vec3Schema,
  movementSpeed: z.number().positive().default(5),
  jumpForce: z.number().positive().default(8),
  cameraMode: z.enum(["first_person", "third_person"]).default("third_person"),
  attackDamage: z.number().positive().default(25),
  attackRange: z.number().positive().default(50),
  attackCooldown: z.number().positive().default(0.5),
});

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const WinConditionSchema = z.enum([
  "collect_all",
  "reach_score",
  "survive_time",
  "reach_goal",
  "defeat_all",
]);

export const LoseConditionSchema = z.enum([
  "health_zero",
  "time_expired",
  "fall_off",
]);

export const RulesSchema = z.object({
  winCondition: WinConditionSchema,
  loseCondition: LoseConditionSchema,
  scoreTarget: z.number().int().positive().optional(),
  timeLimitSeconds: z.number().positive().optional(),
});

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export const HudElementSchema = z.enum([
  "score",
  "health",
  "timer",
  "minimap",
  "crosshair",
]);

export const UISchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  hudElements: z.array(HudElementSchema).default(["score", "health"]),
});

// ---------------------------------------------------------------------------
// Top-level GameSpec
// ---------------------------------------------------------------------------

export const GameSpecSchema = z.object({
  name: z.string().min(1),
  version: z.string().default("1.0.0"),
  world: WorldConfigSchema,
  terrain: TerrainSchema,
  entities: z.array(EntitySchema).min(1),
  player: PlayerConfigSchema,
  rules: RulesSchema,
  ui: UISchema,
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Fog = z.infer<typeof FogSchema>;
export type WorldConfig = z.infer<typeof WorldConfigSchema>;
export type Terrain = z.infer<typeof TerrainSchema>;
export type ScatterItem = z.infer<typeof ScatterItemSchema>;
export type PrimitiveMesh = z.infer<typeof PrimitiveMeshSchema>;
export type ModelMesh = z.infer<typeof ModelMeshSchema>;
export type CompoundPart = z.infer<typeof CompoundPartSchema>;
export type CompoundMesh = z.infer<typeof CompoundMeshSchema>;
export type Mesh = z.infer<typeof MeshSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type ColliderShapeType = z.infer<typeof ColliderShape>;
export type Physics = z.infer<typeof PhysicsSchema>;
export type PatrolBehavior = z.infer<typeof PatrolBehaviorSchema>;
export type FollowPlayerBehavior = z.infer<typeof FollowPlayerBehaviorSchema>;
export type RotateBehavior = z.infer<typeof RotateBehaviorSchema>;
export type CollectibleBehavior = z.infer<typeof CollectibleBehaviorSchema>;
export type DamageBehavior = z.infer<typeof DamageBehaviorSchema>;
export type ProjectileBehavior = z.infer<typeof ProjectileBehaviorSchema>;
export type SpawnTemplate = z.infer<typeof SpawnTemplateSchema>;
export type SpawnerBehavior = z.infer<typeof SpawnerBehaviorSchema>;
export type Behavior = z.infer<typeof BehaviorSchema>;
export type Transform = z.infer<typeof TransformSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type PlayerConfig = z.infer<typeof PlayerConfigSchema>;
export type WinCondition = z.infer<typeof WinConditionSchema>;
export type LoseCondition = z.infer<typeof LoseConditionSchema>;
export type Rules = z.infer<typeof RulesSchema>;
export type HudElement = z.infer<typeof HudElementSchema>;
export type UI = z.infer<typeof UISchema>;
export type GameSpec = z.infer<typeof GameSpecSchema>;
