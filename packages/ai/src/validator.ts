import type { GameSpec, Entity, Vec3 } from "@otherside/shared";

export interface ValidationIssue {
  type:
    | "enemy_near_spawn"
    | "overlap"
    | "clustered_collectibles"
    | "out_of_bounds"
    | "patrol_out_of_bounds";
  entityId?: string;
  description: string;
}

function dist3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function distXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function entityRadius(e: Entity): number {
  if (e.mesh.kind === "primitive" && e.mesh.size) {
    const s = e.mesh.size;
    const sc = e.transform.scale;
    return Math.max(s.x * sc.x, s.y * sc.y, s.z * sc.z) / 2;
  }
  if (e.mesh.kind === "compound") {
    if (e.mesh.boundingSize) {
      const bs = e.mesh.boundingSize;
      const sc = e.transform.scale;
      return Math.max(bs.x * sc.x, bs.y * sc.y, bs.z * sc.z) / 2;
    }
    // Compute AABB from parts
    let maxExtent = 0;
    for (const p of e.mesh.parts) {
      const ext = Math.max(
        Math.abs(p.offset.x) + p.size.x / 2,
        Math.abs(p.offset.y) + p.size.y / 2,
        Math.abs(p.offset.z) + p.size.z / 2,
      );
      maxExtent = Math.max(maxExtent, ext);
    }
    const sc = e.transform.scale;
    return maxExtent * Math.max(sc.x, sc.y, sc.z);
  }
  return 0.5;
}

// ── Validate ────────────────────────────────────────────────────────────────

export function validateSpec(spec: GameSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const spawn = spec.player.spawnPoint;
  const halfX = spec.terrain.size.x / 2;
  const halfZ = spec.terrain.size.z / 2;

  for (const ent of spec.entities) {
    const pos = ent.transform.position;

    // 1. Enemies too close to player spawn (min 10 units XZ)
    if (ent.type === "npc" && distXZ(pos, spawn) < 10) {
      issues.push({
        type: "enemy_near_spawn",
        entityId: ent.id,
        description: `Enemy "${ent.name}" (${ent.id}) is ${distXZ(pos, spawn).toFixed(1)} units from player spawn — minimum is 10`,
      });
    }

    // 2. Entity outside terrain bounds (with 1-unit margin)
    if (Math.abs(pos.x) > halfX - 1 || Math.abs(pos.z) > halfZ - 1) {
      issues.push({
        type: "out_of_bounds",
        entityId: ent.id,
        description: `"${ent.name}" (${ent.id}) at (${pos.x}, ${pos.z}) is outside terrain (±${halfX - 1})`,
      });
    }

    // 3. Patrol paths outside terrain
    for (const b of ent.behaviors) {
      if (b.type === "patrol") {
        for (const pt of b.path) {
          if (Math.abs(pt.x) > halfX - 1 || Math.abs(pt.z) > halfZ - 1) {
            issues.push({
              type: "patrol_out_of_bounds",
              entityId: ent.id,
              description: `"${ent.name}" patrol point (${pt.x}, ${pt.z}) is outside terrain`,
            });
            break; // one issue per entity is enough
          }
        }
      }
    }
  }

  // 4. Overlapping entities — only check NPC-NPC and NPC-collectible overlaps.
  //    Props (walls, pillars, torches) naturally overlap with adjacent entities.
  const gameplay = spec.entities.filter(
    (e) => e.type === "npc" || e.type === "collectible",
  );
  for (let i = 0; i < gameplay.length; i++) {
    for (let j = i + 1; j < gameplay.length; j++) {
      const a = gameplay[i];
      const b = gameplay[j];
      const minDist = entityRadius(a) + entityRadius(b);
      if (dist3(a.transform.position, b.transform.position) < minDist * 0.8) {
        issues.push({
          type: "overlap",
          entityId: b.id,
          description: `"${a.name}" overlaps with "${b.name}"`,
        });
      }
    }
  }

  // 5. Collectibles clustered together
  const collectibles = spec.entities.filter((e) => e.type === "collectible");
  if (collectibles.length >= 3) {
    const cx =
      collectibles.reduce((s, e) => s + e.transform.position.x, 0) /
      collectibles.length;
    const cz =
      collectibles.reduce((s, e) => s + e.transform.position.z, 0) /
      collectibles.length;
    const avgDist =
      collectibles.reduce((s, e) => {
        const dx = e.transform.position.x - cx;
        const dz = e.transform.position.z - cz;
        return s + Math.sqrt(dx * dx + dz * dz);
      }, 0) / collectibles.length;

    const terrainRadius = Math.max(halfX, halfZ);
    if (avgDist < terrainRadius * 0.15) {
      issues.push({
        type: "clustered_collectibles",
        description: `Collectibles are clustered (avg ${avgDist.toFixed(1)} units from centroid — terrain radius is ${terrainRadius})`,
      });
    }
  }

  return issues;
}

// ── Auto-fix ────────────────────────────────────────────────────────────────

export function autoFixSpec(
  spec: GameSpec,
  issues: ValidationIssue[],
): GameSpec {
  // Deep clone so we don't mutate the original
  const fixed: GameSpec = JSON.parse(JSON.stringify(spec));
  const spawn = fixed.player.spawnPoint;
  const halfX = fixed.terrain.size.x / 2 - 2;
  const halfZ = fixed.terrain.size.z / 2 - 2;

  const issueTypes = new Set(issues.map((i) => i.type));
  const issueEntityIds = new Set(issues.map((i) => i.entityId));

  // Fix enemies too close to spawn — move them outward
  if (issueTypes.has("enemy_near_spawn")) {
    for (const ent of fixed.entities) {
      if (ent.type !== "npc" || !issueEntityIds.has(ent.id)) continue;
      if (distXZ(ent.transform.position, spawn) >= 10) continue;

      // Place at a random angle, 12 units from spawn
      const angle = Math.random() * Math.PI * 2;
      const r = 12;
      let nx = spawn.x + Math.cos(angle) * r;
      let nz = spawn.z + Math.sin(angle) * r;
      nx = Math.max(-halfX, Math.min(halfX, nx));
      nz = Math.max(-halfZ, Math.min(halfZ, nz));
      ent.transform.position.x = Math.round(nx * 10) / 10;
      ent.transform.position.z = Math.round(nz * 10) / 10;

      // Also fix patrol paths to start from new position
      for (const b of ent.behaviors) {
        if (b.type === "patrol" && b.path.length > 0) {
          b.path[0].x = ent.transform.position.x;
          b.path[0].z = ent.transform.position.z;
          b.path[0].y = ent.transform.position.y;
        }
      }
    }
  }

  // Fix out-of-bounds entities — clamp to terrain
  if (issueTypes.has("out_of_bounds")) {
    for (const ent of fixed.entities) {
      if (!issueEntityIds.has(ent.id)) continue;
      ent.transform.position.x = Math.max(
        -halfX,
        Math.min(halfX, ent.transform.position.x),
      );
      ent.transform.position.z = Math.max(
        -halfZ,
        Math.min(halfZ, ent.transform.position.z),
      );
    }
  }

  // Fix patrol paths out of bounds — clamp
  if (issueTypes.has("patrol_out_of_bounds")) {
    for (const ent of fixed.entities) {
      if (!issueEntityIds.has(ent.id)) continue;
      for (const b of ent.behaviors) {
        if (b.type === "patrol") {
          for (const pt of b.path) {
            pt.x = Math.max(-halfX, Math.min(halfX, pt.x));
            pt.z = Math.max(-halfZ, Math.min(halfZ, pt.z));
          }
        }
      }
    }
  }

  // Fix overlapping entities — nudge apart
  if (issueTypes.has("overlap")) {
    for (let i = 0; i < fixed.entities.length; i++) {
      for (let j = i + 1; j < fixed.entities.length; j++) {
        const a = fixed.entities[i];
        const b = fixed.entities[j];
        const minDist = entityRadius(a) + entityRadius(b);
        const d = dist3(a.transform.position, b.transform.position);
        if (d < minDist * 0.8) {
          // Push entity b away from a by 2 units in a random direction
          const angle = Math.random() * Math.PI * 2;
          b.transform.position.x += Math.cos(angle) * 2;
          b.transform.position.z += Math.sin(angle) * 2;
          b.transform.position.x = Math.max(
            -halfX,
            Math.min(halfX, b.transform.position.x),
          );
          b.transform.position.z = Math.max(
            -halfZ,
            Math.min(halfZ, b.transform.position.z),
          );
        }
      }
    }
  }

  // Fix clustered collectibles — redistribute in a ring
  if (issueTypes.has("clustered_collectibles")) {
    const collectibles = fixed.entities.filter(
      (e) => e.type === "collectible",
    );
    const count = collectibles.length;
    if (count >= 3) {
      const ringRadius = Math.min(halfX, halfZ) * 0.6;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        collectibles[i].transform.position.x =
          Math.round(Math.cos(angle) * ringRadius * 10) / 10;
        collectibles[i].transform.position.z =
          Math.round(Math.sin(angle) * ringRadius * 10) / 10;
      }
    }
  }

  return fixed;
}
