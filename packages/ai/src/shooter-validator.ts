import type { ShooterSpec, Vec3 } from "@otherside/shared";

export interface ShooterValidationIssue {
  type:
    | "invalid_weapon_ref"
    | "invalid_starting_weapon"
    | "invalid_wave_enemy_ref"
    | "enemy_near_spawn"
    | "out_of_bounds"
    | "pickup_out_of_bounds";
  entityId?: string;
  description: string;
}

function distXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function validateShooterSpec(spec: ShooterSpec): ShooterValidationIssue[] {
  const issues: ShooterValidationIssue[] = [];
  const weaponIds = new Set(spec.weapons.map(w => w.id));
  const enemyIds = new Set(spec.enemies.map(e => e.id));
  const spawn = spec.player.spawnPoint;
  const halfX = spec.arena.size.x / 2;
  const halfZ = spec.arena.size.z / 2;

  // When layoutTemplate is present, LayoutEngine handles spatial positioning
  const hasLayout = !!spec.arena.layoutTemplate;

  // Cross-reference checks (always run — semantic, not spatial)
  if (!weaponIds.has(spec.player.startingWeapon)) {
    issues.push({
      type: "invalid_starting_weapon",
      description: `player.startingWeapon "${spec.player.startingWeapon}" does not match any weapon ID`,
    });
  }

  for (const enemy of spec.enemies) {
    if (enemy.weapon && !weaponIds.has(enemy.weapon)) {
      issues.push({
        type: "invalid_weapon_ref",
        entityId: enemy.id,
        description: `Enemy "${enemy.name}" (${enemy.id}) references weapon "${enemy.weapon}" which doesn't exist`,
      });
    }
  }

  if (spec.waveConfig) {
    for (const wave of spec.waveConfig.waves) {
      for (const eid of wave.enemyIds) {
        if (!enemyIds.has(eid)) {
          issues.push({
            type: "invalid_wave_enemy_ref",
            description: `Wave ${wave.waveNumber} references enemy ID "${eid}" which doesn't exist`,
          });
        }
      }
    }
  }

  // Spatial checks — skip when LayoutEngine handles positioning
  if (!hasLayout) {
    for (const enemy of spec.enemies) {
      const pos = enemy.transform.position;

      // Enemies too close to player spawn
      if (distXZ(pos, spawn) < 10) {
        issues.push({
          type: "enemy_near_spawn",
          entityId: enemy.id,
          description: `Enemy "${enemy.name}" (${enemy.id}) is ${distXZ(pos, spawn).toFixed(1)} units from player spawn — minimum is 10`,
        });
      }

      // Out of bounds
      if (Math.abs(pos.x) > halfX - 1 || Math.abs(pos.z) > halfZ - 1) {
        issues.push({
          type: "out_of_bounds",
          entityId: enemy.id,
          description: `Enemy "${enemy.name}" (${enemy.id}) at (${pos.x}, ${pos.z}) is outside arena bounds`,
        });
      }
    }

    // Pickup bounds
    for (const pickup of spec.pickups) {
      const pos = pickup.position;
      if (Math.abs(pos.x) > halfX - 1 || Math.abs(pos.z) > halfZ - 1) {
        issues.push({
          type: "pickup_out_of_bounds",
          entityId: pickup.id,
          description: `Pickup "${pickup.id}" at (${pos.x}, ${pos.z}) is outside arena bounds`,
        });
      }
    }
  }

  return issues;
}

export function autoFixShooterSpec(
  spec: ShooterSpec,
  issues: ShooterValidationIssue[],
): ShooterSpec {
  const fixed: ShooterSpec = JSON.parse(JSON.stringify(spec));
  const weaponIds = new Set(fixed.weapons.map(w => w.id));
  const enemyIds = new Set(fixed.enemies.map(e => e.id));
  const spawn = fixed.player.spawnPoint;
  const halfX = fixed.arena.size.x / 2 - 2;
  const halfZ = fixed.arena.size.z / 2 - 2;

  const issueTypes = new Set(issues.map(i => i.type));
  const issueEntityIds = new Set(issues.map(i => i.entityId).filter(Boolean));

  // Fix invalid starting weapon
  if (issueTypes.has("invalid_starting_weapon") && fixed.weapons.length > 0) {
    fixed.player.startingWeapon = fixed.weapons[0].id;
  }

  // Fix invalid weapon refs
  if (issueTypes.has("invalid_weapon_ref")) {
    for (const enemy of fixed.enemies) {
      if (enemy.weapon && !weaponIds.has(enemy.weapon)) {
        enemy.weapon = fixed.weapons[0]?.id;
      }
    }
  }

  // Fix invalid wave enemy refs
  if (issueTypes.has("invalid_wave_enemy_ref") && fixed.waveConfig) {
    for (const wave of fixed.waveConfig.waves) {
      wave.enemyIds = wave.enemyIds.filter(id => enemyIds.has(id));
      if (wave.enemyIds.length === 0 && fixed.enemies.length > 0) {
        wave.enemyIds = [fixed.enemies[0].id];
      }
    }
  }

  // Fix enemies too close to spawn
  if (issueTypes.has("enemy_near_spawn")) {
    for (const enemy of fixed.enemies) {
      if (!issueEntityIds.has(enemy.id)) continue;
      if (distXZ(enemy.transform.position, spawn) >= 10) continue;

      const angle = Math.random() * Math.PI * 2;
      const r = 12;
      let nx = spawn.x + Math.cos(angle) * r;
      let nz = spawn.z + Math.sin(angle) * r;
      nx = Math.max(-halfX, Math.min(halfX, nx));
      nz = Math.max(-halfZ, Math.min(halfZ, nz));
      enemy.transform.position.x = Math.round(nx * 10) / 10;
      enemy.transform.position.z = Math.round(nz * 10) / 10;

      // Fix patrol paths
      if (enemy.behavior.patrolPath && enemy.behavior.patrolPath.length > 0) {
        enemy.behavior.patrolPath[0].x = enemy.transform.position.x;
        enemy.behavior.patrolPath[0].z = enemy.transform.position.z;
      }
    }
  }

  // Fix out-of-bounds entities
  if (issueTypes.has("out_of_bounds")) {
    for (const enemy of fixed.enemies) {
      if (!issueEntityIds.has(enemy.id)) continue;
      enemy.transform.position.x = Math.max(-halfX, Math.min(halfX, enemy.transform.position.x));
      enemy.transform.position.z = Math.max(-halfZ, Math.min(halfZ, enemy.transform.position.z));
    }
  }

  // Fix out-of-bounds pickups
  if (issueTypes.has("pickup_out_of_bounds")) {
    for (const pickup of fixed.pickups) {
      if (!issueEntityIds.has(pickup.id)) continue;
      pickup.position.x = Math.max(-halfX, Math.min(halfX, pickup.position.x));
      pickup.position.z = Math.max(-halfZ, Math.min(halfZ, pickup.position.z));
    }
  }

  return fixed;
}
