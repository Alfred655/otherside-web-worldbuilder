import type { RuntimeEntity, SpawnRequest } from "./types.js";

const COLLECT_DISTANCE = 2.0;
const DAMAGE_DISTANCE = 1.8;
const DAMAGE_COOLDOWN = 1.0;

interface PatrolState {
  targetIndex: number;
}
interface DamageState {
  cooldown: number;
}
interface SpawnerState {
  timer: number;
  spawnedIds: string[];
}

export interface BehaviorEvents {
  scored: number;
  damaged: number;
  healed: number;
  spawnRequests: SpawnRequest[];
  destroyIds: string[];
}

export class BehaviorManager {
  private patrol = new Map<string, PatrolState>();
  private damage = new Map<string, DamageState>();
  private spawners = new Map<string, SpawnerState>();
  private spawnCounter = 0;

  tick(
    entities: RuntimeEntity[],
    playerPos: { x: number; y: number; z: number },
    dt: number,
  ): BehaviorEvents {
    const events: BehaviorEvents = {
      scored: 0,
      damaged: 0,
      healed: 0,
      spawnRequests: [],
      destroyIds: [],
    };

    for (const ent of entities) {
      if (!ent.active) continue;

      // age tracking (projectile lifetime)
      ent.age += dt;

      for (const b of ent.spec.behaviors) {
        switch (b.type) {
          case "patrol":
            this.tickPatrol(ent, b.path, b.speed, dt);
            break;
          case "follow_player":
            this.tickFollow(ent, playerPos, b.speed, b.maxDistance, dt);
            break;
          case "rotate":
            this.tickRotate(ent, b.axis, b.speed, dt);
            break;
          case "collectible":
            this.tickCollectible(ent, playerPos, b.effect, b.value, events);
            break;
          case "damage":
            this.tickDamage(ent, playerPos, b.amount, b.on, b.radius, dt, events);
            break;
          case "projectile":
            this.tickProjectile(ent, b.direction, b.speed, b.lifetime, dt, events);
            break;
          case "spawner":
            this.tickSpawner(ent, entities, playerPos, b, dt, events);
            break;
        }
      }
    }

    return events;
  }

  /** Generate a unique ID for a spawned entity */
  nextSpawnId(): string {
    return `spawned-${++this.spawnCounter}`;
  }

  /** Mark a spawned entity as belonging to a spawner */
  registerSpawned(spawnerId: string, spawnedId: string) {
    const st = this.spawners.get(spawnerId);
    if (st) st.spawnedIds.push(spawnedId);
  }

  reset() {
    this.patrol.clear();
    this.damage.clear();
    this.spawners.clear();
    this.spawnCounter = 0;
  }

  // ── Patrol ──────────────────────────────────────────────────────────────
  private tickPatrol(
    ent: RuntimeEntity,
    path: { x: number; y: number; z: number }[],
    speed: number,
    dt: number,
  ) {
    if (!ent.body || path.length < 2) return;

    let st = this.patrol.get(ent.spec.id);
    if (!st) {
      st = { targetIndex: 1 };
      this.patrol.set(ent.spec.id, st);
    }

    const pos = ent.body.translation();
    const t = path[st.targetIndex];
    const dx = t.x - pos.x;
    const dy = t.y - pos.y;
    const dz = t.z - pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 0.2) {
      st.targetIndex = (st.targetIndex + 1) % path.length;
      return;
    }

    const factor = Math.min((speed * dt) / dist, 1);
    ent.body.setNextKinematicTranslation({
      x: pos.x + dx * factor,
      y: pos.y + dy * factor,
      z: pos.z + dz * factor,
    });
  }

  // ── Follow player ─────────────────────────────────────────────────────
  private tickFollow(
    ent: RuntimeEntity,
    playerPos: { x: number; y: number; z: number },
    speed: number,
    maxDistance: number | undefined,
    dt: number,
  ) {
    if (!ent.body) return;

    const pos = ent.body.translation();
    const dx = playerPos.x - pos.x;
    const dz = playerPos.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (maxDistance !== undefined && dist > maxDistance) return;
    if (dist < 1.0) return;

    const factor = Math.min((speed * dt) / dist, 1);
    ent.body.setNextKinematicTranslation({
      x: pos.x + dx * factor,
      y: pos.y,
      z: pos.z + dz * factor,
    });
  }

  // ── Rotate ────────────────────────────────────────────────────────────
  private tickRotate(
    ent: RuntimeEntity,
    axis: "x" | "y" | "z",
    speed: number,
    dt: number,
  ) {
    ent.object3d.rotation[axis] += speed * dt;
  }

  // ── Collectible ───────────────────────────────────────────────────────
  private tickCollectible(
    ent: RuntimeEntity,
    playerPos: { x: number; y: number; z: number },
    effect: string,
    value: number,
    events: BehaviorEvents,
  ) {
    const pos = ent.body ? ent.body.translation() : ent.object3d.position;
    const dx = playerPos.x - pos.x;
    const dy = playerPos.y - pos.y;
    const dz = playerPos.z - pos.z;

    if (Math.sqrt(dx * dx + dy * dy + dz * dz) < COLLECT_DISTANCE) {
      ent.active = false;
      ent.object3d.visible = false;
      if (effect === "score") events.scored += value;
      else if (effect === "health") events.healed += value;
    }
  }

  // ── Damage (contact / proximity) ──────────────────────────────────────
  private tickDamage(
    ent: RuntimeEntity,
    playerPos: { x: number; y: number; z: number },
    amount: number,
    on: "contact" | "proximity",
    radius: number | undefined,
    dt: number,
    events: BehaviorEvents,
  ) {
    let st = this.damage.get(ent.spec.id);
    if (!st) {
      st = { cooldown: 0 };
      this.damage.set(ent.spec.id, st);
    }

    st.cooldown = Math.max(0, st.cooldown - dt);
    if (st.cooldown > 0) return;

    const pos = ent.body ? ent.body.translation() : ent.object3d.position;
    const dx = playerPos.x - pos.x;
    const dy = playerPos.y - pos.y;
    const dz = playerPos.z - pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const threshold = on === "proximity" && radius ? radius : DAMAGE_DISTANCE;
    if (dist < threshold) {
      st.cooldown = DAMAGE_COOLDOWN;
      events.damaged += amount;
    }
  }

  // ── Projectile ────────────────────────────────────────────────────────
  private tickProjectile(
    ent: RuntimeEntity,
    direction: { x: number; y: number; z: number },
    speed: number,
    lifetime: number,
    _dt: number,
    events: BehaviorEvents,
  ) {
    if (ent.age > lifetime) {
      events.destroyIds.push(ent.spec.id);
      return;
    }

    if (!ent.body) return;

    // direction is already normalised in the spec (or close enough)
    const len = Math.sqrt(
      direction.x * direction.x +
      direction.y * direction.y +
      direction.z * direction.z,
    );
    const nx = direction.x / (len || 1);
    const ny = direction.y / (len || 1);
    const nz = direction.z / (len || 1);

    const pos = ent.body.translation();
    const step = speed * _dt;
    ent.body.setNextKinematicTranslation({
      x: pos.x + nx * step,
      y: pos.y + ny * step,
      z: pos.z + nz * step,
    });
  }

  // ── Spawner ───────────────────────────────────────────────────────────
  private tickSpawner(
    ent: RuntimeEntity,
    allEntities: RuntimeEntity[],
    playerPos: { x: number; y: number; z: number },
    b: {
      template: RuntimeEntity["spec"] extends infer _ ? any : never;
      interval: number;
      maxCount: number;
      spawnOffset?: { x: number; y: number; z: number };
      aimAtPlayer: boolean;
    },
    dt: number,
    events: BehaviorEvents,
  ) {
    let st = this.spawners.get(ent.spec.id);
    if (!st) {
      st = { timer: b.interval, spawnedIds: [] };
      this.spawners.set(ent.spec.id, st);
    }

    // prune dead spawned entities from the count
    st.spawnedIds = st.spawnedIds.filter((id) =>
      allEntities.some((e) => e.spec.id === id && e.active),
    );

    st.timer -= dt;
    if (st.timer > 0) return;

    st.timer = b.interval;
    if (st.spawnedIds.length >= b.maxCount) return;

    const pos = ent.body ? ent.body.translation() : ent.object3d.position;
    const off = b.spawnOffset ?? { x: 0, y: 1, z: 0 };

    const req: SpawnRequest = {
      template: b.template,
      position: { x: pos.x + off.x, y: pos.y + off.y, z: pos.z + off.z },
    };

    if (b.aimAtPlayer) {
      req.aimTarget = { ...playerPos };
    }

    events.spawnRequests.push(req);
  }
}
