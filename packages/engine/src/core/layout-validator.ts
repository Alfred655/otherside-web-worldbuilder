import type { Arena, CoverObject, Entity, Vec3 } from "@otherside/shared";

export interface LayoutIssue {
  type: "overlap" | "unreachable" | "density" | "lane_blocked";
  description: string;
}

interface AABB {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
}

// Asset dimensions for footprint calculation
const ASSET_DIMS: Record<string, { w: number; d: number }> = {
  kenney_block:          { w: 1,   d: 1   },
  kenney_bricks:         { w: 1,   d: 1   },
  kenney_column:         { w: 0.5, d: 0.5 },
  kenney_column_damaged: { w: 0.5, d: 0.5 },
  kenney_wall_low:       { w: 2,   d: 0.5 },
  kenney_wall:           { w: 2,   d: 0.4 },
  kenney_wall_high:      { w: 2,   d: 0.5 },
  kenney_wall_gate:      { w: 2,   d: 0.4 },
};

/**
 * Post-layout validation — returns issues as warnings.
 * Non-fatal: logged, and overlapping objects are auto-removed.
 */
export function validateLayout(
  coverObjects: CoverObject[],
  wallEntities: Entity[],
  arena: Arena,
  playerSpawn: Vec3,
): LayoutIssue[] {
  const issues: LayoutIssue[] = [];

  // Collect all solid AABBs
  const allBoxes: { id: string; aabb: AABB }[] = [];

  for (const cover of coverObjects) {
    allBoxes.push({ id: cover.id, aabb: entityToAABB(cover.transform.position, cover.assetId) });
  }
  for (const wall of wallEntities) {
    allBoxes.push({ id: wall.id, aabb: entityToAABB(wall.transform.position, wall.assetId) });
  }

  // 1. Overlap check — AABB intersection
  const overlapIds = new Set<string>();
  for (let i = 0; i < allBoxes.length; i++) {
    for (let j = i + 1; j < allBoxes.length; j++) {
      if (aabbIntersects(allBoxes[i].aabb, allBoxes[j].aabb)) {
        overlapIds.add(allBoxes[j].id); // mark later one for removal
        issues.push({
          type: "overlap",
          description: `Objects "${allBoxes[i].id}" and "${allBoxes[j].id}" overlap`,
        });
      }
    }
  }

  // Auto-remove overlapping cover objects
  for (let i = coverObjects.length - 1; i >= 0; i--) {
    if (overlapIds.has(coverObjects[i].id)) {
      coverObjects.splice(i, 1);
    }
  }

  // 2. Flood fill reachability — 1m grid
  const halfX = arena.size.x / 2;
  const halfZ = arena.size.z / 2;
  const gridRes = 1; // 1m per cell
  const gridW = Math.ceil(arena.size.x / gridRes);
  const gridH = Math.ceil(arena.size.z / gridRes);
  const blocked = new Uint8Array(gridW * gridH);

  // Mark cells blocked by cover/walls
  for (const box of allBoxes) {
    if (overlapIds.has(box.id)) continue; // skip removed
    const a = box.aabb;
    const gx0 = Math.max(0, Math.floor((a.minX + halfX) / gridRes));
    const gx1 = Math.min(gridW - 1, Math.floor((a.maxX + halfX) / gridRes));
    const gz0 = Math.max(0, Math.floor((a.minZ + halfZ) / gridRes));
    const gz1 = Math.min(gridH - 1, Math.floor((a.maxZ + halfZ) / gridRes));
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        blocked[gz * gridW + gx] = 1;
      }
    }
  }

  // Flood fill from player spawn
  const spawnGX = Math.max(0, Math.min(gridW - 1, Math.floor((playerSpawn.x + halfX) / gridRes)));
  const spawnGZ = Math.max(0, Math.min(gridH - 1, Math.floor((playerSpawn.z + halfZ) / gridRes)));
  const visited = new Uint8Array(gridW * gridH);
  const stack: number[] = [];

  if (!blocked[spawnGZ * gridW + spawnGX]) {
    stack.push(spawnGX, spawnGZ);
    visited[spawnGZ * gridW + spawnGX] = 1;
  }

  while (stack.length > 0) {
    const cz = stack.pop()!;
    const cx = stack.pop()!;

    const neighbors = [
      [cx - 1, cz], [cx + 1, cz],
      [cx, cz - 1], [cx, cz + 1],
    ];

    for (const [nx, nz] of neighbors) {
      if (nx < 0 || nx >= gridW || nz < 0 || nz >= gridH) continue;
      const idx = nz * gridW + nx;
      if (blocked[idx] || visited[idx]) continue;
      visited[idx] = 1;
      stack.push(nx, nz);
    }
  }

  // Count reachable vs total open cells
  let totalOpen = 0;
  let reachable = 0;
  for (let i = 0; i < gridW * gridH; i++) {
    if (!blocked[i]) {
      totalOpen++;
      if (visited[i]) reachable++;
    }
  }

  if (totalOpen > 0 && reachable / totalOpen < 0.7) {
    issues.push({
      type: "unreachable",
      description: `Only ${((reachable / totalOpen) * 100).toFixed(0)}% of arena is reachable from spawn (threshold: 70%)`,
    });
  }

  // 3. Quadrant density
  const quadrants = [
    { name: "NW", minX: -halfX, maxX: 0, minZ: -halfZ, maxZ: 0 },
    { name: "NE", minX: 0, maxX: halfX, minZ: -halfZ, maxZ: 0 },
    { name: "SW", minX: -halfX, maxX: 0, minZ: 0, maxZ: halfZ },
    { name: "SE", minX: 0, maxX: halfX, minZ: 0, maxZ: halfZ },
  ];

  for (const quad of quadrants) {
    const quadArea = (quad.maxX - quad.minX) * (quad.maxZ - quad.minZ);
    let coveredArea = 0;

    for (const box of allBoxes) {
      if (overlapIds.has(box.id)) continue;
      const a = box.aabb;
      const ox = Math.max(0, Math.min(a.maxX, quad.maxX) - Math.max(a.minX, quad.minX));
      const oz = Math.max(0, Math.min(a.maxZ, quad.maxZ) - Math.max(a.minZ, quad.minZ));
      coveredArea += ox * oz;
    }

    if (quadArea > 0 && coveredArea / quadArea > 0.6) {
      issues.push({
        type: "density",
        description: `Quadrant ${quad.name} has ${((coveredArea / quadArea) * 100).toFixed(0)}% coverage (threshold: 60%)`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entityToAABB(pos: Vec3, assetId?: string): AABB {
  const dims = ASSET_DIMS[assetId ?? ""] ?? { w: 1, d: 1 };
  const hw = dims.w / 2;
  const hd = dims.d / 2;
  return {
    minX: pos.x - hw,
    maxX: pos.x + hw,
    minZ: pos.z - hd,
    maxZ: pos.z + hd,
  };
}

function aabbIntersects(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}
