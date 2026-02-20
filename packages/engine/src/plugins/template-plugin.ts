import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Entity, Vec3 } from "@otherside/shared";
import type { RuntimeEntity } from "../types.js";

export interface RaycastHit {
  entity: RuntimeEntity;
  point: THREE.Vector3;
  distance: number;
}

export interface GameRendererAPI {
  // Read-only scene access
  readonly camera: THREE.PerspectiveCamera;
  readonly scene: THREE.Scene;
  readonly world: RAPIER.World;
  readonly playerCollider: RAPIER.Collider;

  // Player state
  getPlayerPosition(): Vec3;
  isPointerLocked(): boolean;

  // Game state
  getScore(): number;
  addScore(n: number): void;
  getHealth(): number;
  setHealth(n: number): void;
  getGameState(): "waiting" | "playing" | "won" | "lost";
  endGame(state: "won" | "lost", message: string): void;

  // Entity management
  getEntities(): readonly RuntimeEntity[];
  spawnEntity(spec: Entity, spawned?: boolean): RuntimeEntity;
  destroyEntity(ent: RuntimeEntity): void;
  damageEntity(ent: RuntimeEntity, amount: number): void;

  // VFX + HUD
  performRaycast(maxRange: number): RaycastHit | null;
  showAttackLine(from: THREE.Vector3, to: THREE.Vector3): void;
  showHitMarker(): void;
  showDamageNumber(amount: number, worldPos: THREE.Vector3): void;
  flashAttack(): void;
  flashDamage(): void;
  showMessage(text: string): void;
  hideMessage(): void;
  getHUDContainer(): HTMLElement;
}

export interface TemplatePlugin {
  init(api: GameRendererAPI): void;
  update(dt: number): void;
  /** Return true to suppress default attack handling */
  onAttack(): boolean;
  /** Return true if the key was handled by the plugin */
  onKeyDown?(code: string): boolean;
  onEntityDestroyed?(ent: RuntimeEntity): void;
  /** Return non-null to suppress default end condition checks */
  checkEndConditions?(): "won" | "lost" | null;
  reset(): void;
  dispose(): void;
}
