import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Entity, SpawnTemplate } from "@otherside/shared";
import type { HealthBar } from "./health-bar.js";

export interface RuntimeEntity {
  spec: Entity;
  object3d: THREE.Mesh;
  body: RAPIER.RigidBody | null;
  collider: RAPIER.Collider | null;
  active: boolean;
  health: number;
  maxHealth: number;
  healthBar: HealthBar | null;
  /** true for entities created at runtime by a spawner */
  spawned: boolean;
  /** seconds since spawn (used for projectile lifetime) */
  age: number;
}

export interface SpawnRequest {
  template: SpawnTemplate;
  position: { x: number; y: number; z: number };
  /** If set, override projectile direction to aim at this point */
  aimTarget?: { x: number; y: number; z: number };
}
