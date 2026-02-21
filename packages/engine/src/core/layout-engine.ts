import type {
  Arena,
  CoverObject,
  Entity,
  ShooterEnemy,
  ShooterPickup,
  Vec3,
  ArenaZone,
} from "@otherside/shared";
import { LAYOUT_TEMPLATES } from "@otherside/shared";
import type { LayoutTemplateDef, EnemyHint, PickupHint } from "@otherside/shared";

// ---------------------------------------------------------------------------
// Asset dimension lookup (from catalog.json)
// ---------------------------------------------------------------------------

const ASSET_DIMS: Record<string, { w: number; h: number; d: number }> = {
  kenney_block:          { w: 1,   h: 1,   d: 1   },
  kenney_bricks:         { w: 1,   h: 0.5, d: 1   },
  kenney_column:         { w: 0.5, h: 2,   d: 0.5 },
  kenney_column_damaged: { w: 0.5, h: 1.2, d: 0.5 },
  kenney_wall_low:       { w: 2,   h: 1,   d: 0.5 },
  kenney_wall:           { w: 2,   h: 2,   d: 0.4 },
  kenney_wall_high:      { w: 2,   h: 1.7, d: 0.5 },
  kenney_wall_gate:      { w: 2,   h: 2,   d: 0.4 },
  kenney_statue:         { w: 0.8, h: 2,   d: 0.8 },
  kenney_banner:         { w: 0.6, h: 2,   d: 0.1 },
  kenney_tree:           { w: 1.5, h: 3,   d: 1.5 },
};

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface LayoutResult {
  coverObjects: CoverObject[];
  wallEntities: Entity[];
  adjustedEnemies: ShooterEnemy[];
  adjustedPickups: ShooterPickup[];
  decorations: Entity[];
  playerSpawn: Vec3;
}

// ---------------------------------------------------------------------------
// LayoutEngine
// ---------------------------------------------------------------------------

export class LayoutEngine {
  static build(
    templateName: string,
    arena: Arena,
    zones: ArenaZone[],
    enemies: ShooterEnemy[],
    pickups: ShooterPickup[],
    theme?: string,
  ): LayoutResult {
    const template = LAYOUT_TEMPLATES[templateName];
    if (!template) {
      console.warn(`[LayoutEngine] Unknown template "${templateName}", returning empty layout`);
      return {
        coverObjects: [],
        wallEntities: [],
        adjustedEnemies: enemies,
        adjustedPickups: pickups,
        decorations: [],
        playerSpawn: { x: 0, y: 0, z: 0 },
      };
    }

    const sX = arena.size.x;
    const sZ = arena.size.z;

    /** Convert normalized 0-1 coords to world coords centered on origin */
    const toWorld = (nx: number, nz: number): { x: number; z: number } => ({
      x: (nx - 0.5) * sX,
      z: (nz - 0.5) * sZ,
    });

    const margin = 1.5;

    const inBounds = (x: number, z: number): boolean =>
      Math.abs(x) < sX / 2 - margin && Math.abs(z) < sZ / 2 - margin;

    // 1. Player spawn
    const spawnWorld = toWorld(template.playerSpawn.nx, template.playerSpawn.nz);
    const playerSpawn: Vec3 = { x: spawnWorld.x, y: 0, z: spawnWorld.z };

    // 2. Generate cover objects from clusters
    const coverObjects = generateCoverObjects(template, toWorld, inBounds);

    // 3. Tile wall lines
    const wallEntities = tileWallLines(template, toWorld, inBounds, sX, sZ);

    // 4. Place enemies using hints
    const adjustedEnemies = placeEnemies(template, enemies, toWorld, playerSpawn, sX, sZ);

    // 5. Place pickups using hints
    const adjustedPickups = placePickups(template, pickups, toWorld, sX, sZ);

    // 6. Generate decorations
    const decorations = generateDecorations(template, toWorld, inBounds, theme);

    // 7. Enforce density — total cover footprint ≤ 30% of arena floor
    enforceDensity(coverObjects, sX, sZ);

    return {
      coverObjects,
      wallEntities,
      adjustedEnemies,
      adjustedPickups,
      decorations,
      playerSpawn,
    };
  }
}

// ---------------------------------------------------------------------------
// Cover generation
// ---------------------------------------------------------------------------

function generateCoverObjects(
  template: LayoutTemplateDef,
  toWorld: (nx: number, nz: number) => { x: number; z: number },
  inBounds: (x: number, z: number) => boolean,
): CoverObject[] {
  const covers: CoverObject[] = [];
  let idx = 0;

  for (const cluster of template.coverClusters) {
    const anchor = toWorld(cluster.anchor.nx, cluster.anchor.nz);
    const cosR = Math.cos(cluster.rotation);
    const sinR = Math.sin(cluster.rotation);

    for (const piece of cluster.pieces) {
      // Rotate piece offset by cluster rotation
      const rx = piece.dx * cosR - piece.dz * sinR;
      const rz = piece.dx * sinR + piece.dz * cosR;

      const wx = anchor.x + rx;
      const wz = anchor.z + rz;

      if (!inBounds(wx, wz)) continue;

      const dims = ASSET_DIMS[piece.assetId] ?? { w: 1, h: 1, d: 1 };

      covers.push({
        id: `layout-cover-${idx++}`,
        transform: {
          position: { x: wx, y: 0, z: wz },
          rotation: { x: 0, y: cluster.rotation + piece.rotY, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        mesh: {
          kind: "primitive",
          shape: "box",
          size: { x: dims.w, y: dims.h, z: dims.d },
        },
        material: { color: "#888888", roughness: 0.8, metalness: 0 },
        destructible: false,
        assetId: piece.assetId,
      });
    }
  }

  return covers;
}

// ---------------------------------------------------------------------------
// Wall line tiling
// ---------------------------------------------------------------------------

function tileWallLines(
  template: LayoutTemplateDef,
  toWorld: (nx: number, nz: number) => { x: number; z: number },
  inBounds: (x: number, z: number) => boolean,
  arenaX: number,
  arenaZ: number,
): Entity[] {
  const entities: Entity[] = [];
  let idx = 0;

  for (const wallLine of template.wallLines) {
    const start = toWorld(wallLine.start.nx, wallLine.start.nz);
    const end = toWorld(wallLine.end.nx, wallLine.end.nz);

    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lineLen = Math.sqrt(dx * dx + dz * dz);
    if (lineLen < 0.1) continue;

    // Direction unit vector along the line
    const dirX = dx / lineLen;
    const dirZ = dz / lineLen;

    // Rotation: wall faces perpendicular to line direction
    const angle = Math.atan2(dz, dx);

    const dims = ASSET_DIMS[wallLine.assetId] ?? { w: 2, h: 2, d: 0.4 };
    const segWidth = dims.w;
    const segCount = Math.max(1, Math.round(lineLen / segWidth));
    const actualStep = lineLen / segCount;

    // Pre-compute gap positions in world-distance along line
    const gapPositions = (wallLine.gaps ?? []).map(g => g * lineLen);
    const gapRadius = segWidth * 0.6; // how wide the gap is

    for (let i = 0; i < segCount; i++) {
      const t = (i + 0.5) * actualStep;  // distance along line to segment center

      // Check if this segment falls in a gap
      const inGap = gapPositions.some(gp => Math.abs(t - gp) < gapRadius);
      if (inGap) continue;

      const wx = start.x + dirX * t;
      const wz = start.z + dirZ * t;

      if (!inBounds(wx, wz)) continue;

      entities.push({
        id: `layout-wall-${idx++}`,
        name: "Interior Wall",
        type: "prop",
        transform: {
          position: { x: wx, y: 0, z: wz },
          rotation: { x: 0, y: angle, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        mesh: {
          kind: "primitive",
          shape: "box",
          size: { x: dims.w, y: dims.h, z: dims.d },
        },
        material: { color: "#999999", roughness: 0.7, metalness: 0 },
        physics: { bodyType: "static", collider: "box" },
        behaviors: [],
        assetId: wallLine.assetId,
      });
    }
  }

  return entities;
}

// ---------------------------------------------------------------------------
// Enemy placement
// ---------------------------------------------------------------------------

function placeEnemies(
  template: LayoutTemplateDef,
  enemies: ShooterEnemy[],
  toWorld: (nx: number, nz: number) => { x: number; z: number },
  playerSpawn: Vec3,
  arenaX: number,
  arenaZ: number,
): ShooterEnemy[] {
  const result: ShooterEnemy[] = JSON.parse(JSON.stringify(enemies));
  const hints = [...template.enemyHints];
  const usedCapacity = new Map<number, number>();

  for (const enemy of result) {
    // Find best matching hint based on AI type preference
    const hintIdx = findBestHint(hints, usedCapacity, enemy.behavior.aiType);

    if (hintIdx >= 0) {
      const hint = hints[hintIdx];
      const used = usedCapacity.get(hintIdx) ?? 0;

      // Pick an offset position (cycle through available offsets)
      const offset = hint.offsets[used % hint.offsets.length];
      const pos = toWorld(offset.nx, offset.nz);

      // If over capacity, offset perpendicular by 2m per overflow
      const overflow = Math.max(0, used - hint.offsets.length);
      if (overflow > 0) {
        // Perpendicular offset
        pos.x += (overflow % 2 === 0 ? 1 : -1) * 2 * Math.ceil(overflow / 2);
      }

      // Clamp to bounds
      const halfX = arenaX / 2 - 2;
      const halfZ = arenaZ / 2 - 2;
      pos.x = Math.max(-halfX, Math.min(halfX, pos.x));
      pos.z = Math.max(-halfZ, Math.min(halfZ, pos.z));

      enemy.transform.position = { x: pos.x, y: 0, z: pos.z };
      usedCapacity.set(hintIdx, used + 1);
    }

    // Verify 10-unit minimum from player spawn; nudge if too close
    const dist = distXZ(enemy.transform.position, playerSpawn);
    if (dist < 10) {
      const angle = Math.atan2(
        enemy.transform.position.z - playerSpawn.z,
        enemy.transform.position.x - playerSpawn.x,
      );
      enemy.transform.position.x = playerSpawn.x + Math.cos(angle) * 12;
      enemy.transform.position.z = playerSpawn.z + Math.sin(angle) * 12;

      // Clamp again
      const halfX = arenaX / 2 - 2;
      const halfZ = arenaZ / 2 - 2;
      enemy.transform.position.x = Math.max(-halfX, Math.min(halfX, enemy.transform.position.x));
      enemy.transform.position.z = Math.max(-halfZ, Math.min(halfZ, enemy.transform.position.z));
    }

    // Regenerate patrol/behavior paths based on new position
    regenerateBehaviorPaths(enemy, template);
  }

  return result;
}

function findBestHint(
  hints: EnemyHint[],
  usedCapacity: Map<number, number>,
  aiType: string,
): number {
  let bestIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < hints.length; i++) {
    const used = usedCapacity.get(i) ?? 0;
    if (used >= hints[i].capacity) continue;

    let score = 1; // base score
    if (hints[i].preferredAI.includes(aiType)) score += 2;
    if (used === 0) score += 1; // prefer unused hints

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

function regenerateBehaviorPaths(enemy: ShooterEnemy, template: LayoutTemplateDef): void {
  const p = enemy.transform.position;

  switch (enemy.behavior.aiType) {
    case "patrol": {
      // Find nearest lane and patrol along it (±3m)
      const lane = findNearestLane(template, p);
      if (lane) {
        enemy.behavior.patrolPath = [
          { x: p.x - lane.dx * 3, y: 0, z: p.z - lane.dz * 3 },
          { x: p.x + lane.dx * 3, y: 0, z: p.z + lane.dz * 3 },
        ];
      } else {
        enemy.behavior.patrolPath = [
          { x: p.x - 3, y: 0, z: p.z },
          { x: p.x + 3, y: 0, z: p.z },
        ];
      }
      break;
    }
    case "guard":
      enemy.behavior.guardPosition = { x: p.x, y: 0, z: p.z };
      enemy.behavior.patrolPath = undefined;
      break;
    case "wander":
      enemy.behavior.patrolPath = [
        { x: p.x - 4, y: 0, z: p.z - 4 },
        { x: p.x + 4, y: 0, z: p.z - 4 },
        { x: p.x + 4, y: 0, z: p.z + 4 },
        { x: p.x - 4, y: 0, z: p.z + 4 },
      ];
      break;
    // chase & boss don't need paths
  }
}

function findNearestLane(
  template: LayoutTemplateDef,
  pos: Vec3,
): { dx: number; dz: number } | null {
  if (template.lanes.length === 0) return null;

  let bestDist = Infinity;
  let bestDir: { dx: number; dz: number } | null = null;

  for (const lane of template.lanes) {
    // Approximate: distance from pos to lane midpoint
    const mx = (lane.from.nx + lane.to.nx) / 2;
    const mz = (lane.from.nz + lane.to.nz) / 2;
    // Use raw normalized since we just want relative proximity
    const dist = Math.abs(mx - 0.5) + Math.abs(mz - 0.5); // rough estimate

    const ldx = lane.to.nx - lane.from.nx;
    const ldz = lane.to.nz - lane.from.nz;
    const len = Math.sqrt(ldx * ldx + ldz * ldz);
    if (len < 0.01) continue;

    // Just use nearest by midpoint for simplicity
    const midDist = Math.sqrt(
      (pos.x - (mx - 0.5)) ** 2 + (pos.z - (mz - 0.5)) ** 2,
    );

    if (midDist < bestDist) {
      bestDist = midDist;
      bestDir = { dx: ldx / len, dz: ldz / len };
    }
  }

  return bestDir;
}

// ---------------------------------------------------------------------------
// Pickup placement
// ---------------------------------------------------------------------------

function placePickups(
  template: LayoutTemplateDef,
  pickups: ShooterPickup[],
  toWorld: (nx: number, nz: number) => { x: number; z: number },
  arenaX: number,
  arenaZ: number,
): ShooterPickup[] {
  const result: ShooterPickup[] = JSON.parse(JSON.stringify(pickups));
  const usedHints = new Set<number>();

  for (const pickup of result) {
    const hintIdx = findBestPickupHint(template.pickupHints, usedHints, pickup.type);

    if (hintIdx >= 0) {
      const hint = template.pickupHints[hintIdx];
      const pos = toWorld(hint.nx, hint.nz);
      usedHints.add(hintIdx);

      // Clamp
      const halfX = arenaX / 2 - 2;
      const halfZ = arenaZ / 2 - 2;
      pickup.position = {
        x: Math.max(-halfX, Math.min(halfX, pos.x)),
        y: 0.5,
        z: Math.max(-halfZ, Math.min(halfZ, pos.z)),
      };
    }
  }

  return result;
}

function findBestPickupHint(
  hints: PickupHint[],
  used: Set<number>,
  pickupType: string,
): number {
  let bestIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < hints.length; i++) {
    if (used.has(i)) continue;

    let score = 1;
    if (hints[i].preferredTypes.includes(pickupType)) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // If all hints used, allow reuse
  if (bestIdx < 0 && hints.length > 0) {
    bestIdx = 0;
  }

  return bestIdx;
}

// ---------------------------------------------------------------------------
// Decorations
// ---------------------------------------------------------------------------

function generateDecorations(
  template: LayoutTemplateDef,
  toWorld: (nx: number, nz: number) => { x: number; z: number },
  inBounds: (x: number, z: number) => boolean,
  theme?: string,
): Entity[] {
  const entities: Entity[] = [];
  let idx = 0;

  for (const dec of template.decorations) {
    // Filter by theme if specified
    if (theme && dec.themeTags.length > 0) {
      const lowerTheme = theme.toLowerCase();
      const matches = dec.themeTags.some(tag => lowerTheme.includes(tag));
      if (!matches) continue;
    }

    const pos = toWorld(dec.nx, dec.nz);
    if (!inBounds(pos.x, pos.z)) continue;

    const dims = ASSET_DIMS[dec.assetId] ?? { w: 0.5, h: 1, d: 0.5 };

    entities.push({
      id: `layout-decor-${idx++}`,
      name: "Decoration",
      type: "prop",
      transform: {
        position: { x: pos.x, y: 0, z: pos.z },
        rotation: { x: 0, y: dec.rotation, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: {
        kind: "primitive",
        shape: "box",
        size: { x: dims.w, y: dims.h, z: dims.d },
      },
      material: { color: "#aaaaaa", roughness: 0.5, metalness: 0 },
      behaviors: [],
      assetId: dec.assetId,
      // No physics — decorations don't block movement
    });
  }

  return entities;
}

// ---------------------------------------------------------------------------
// Density enforcement
// ---------------------------------------------------------------------------

function enforceDensity(covers: CoverObject[], arenaX: number, arenaZ: number): void {
  const arenaFloor = arenaX * arenaZ;
  const maxFootprint = arenaFloor * 0.3;

  let totalFootprint = 0;
  const toRemove: number[] = [];

  for (let i = 0; i < covers.length; i++) {
    const dims = ASSET_DIMS[covers[i].assetId ?? ""] ?? { w: 1, h: 1, d: 1 };
    const footprint = dims.w * dims.d;
    totalFootprint += footprint;

    if (totalFootprint > maxFootprint) {
      toRemove.push(i);
    }
  }

  // Remove excess from the end
  for (let i = toRemove.length - 1; i >= 0; i--) {
    covers.splice(toRemove[i], 1);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function distXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
