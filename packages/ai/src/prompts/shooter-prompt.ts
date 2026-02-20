export const SHOOTER_SCHEMA_DOCS = `## ShooterSpec Schema

{
  "name": string,
  "version": "1.0.0",
  "template": "shooter",
  "world": WorldConfig,
  "arena": Arena,
  "terrain": Terrain | omit,
  "weapons": Weapon[],           // at least 1
  "player": ShooterPlayerConfig,
  "enemies": ShooterEnemy[],     // at least 1
  "pickups": ShooterPickup[],    // can be empty
  "waveConfig": WaveConfig | omit,
  "rules": ShooterRules,
  "ui": ShooterUI
}

### WorldConfig
{
  "skyColor": "#rrggbb",
  "ambientLightColor": "#rrggbb",
  "ambientLightIntensity": number (0–5),
  "fog": { "color": "#rrggbb", "near": positive, "far": positive } | omit,
  "gravity": { "x": 0, "y": -9.81, "z": 0 },
  "timeOfDay": "dawn"|"morning"|"noon"|"afternoon"|"dusk"|"night"|"midnight" | omit
}

### Arena
{
  "shape": "rectangle" | "circle",
  "size": Vec3,                  // x=width, y=wallHeight, z=depth
  "wallHeight": positive (default 4),
  "floorMaterial": Material,
  "wallMaterial": Material,
  "coverObjects": CoverObject[]  // default []
}

### CoverObject
{
  "id": string,
  "transform": Transform,       // full transform with position, rotation, scale
  "mesh": Mesh,
  "material": Material,
  "destructible": boolean (default false),
  "health": positive | omit     // only if destructible
}

### Weapon
{
  "id": string,
  "name": string,
  "type": "hitscan" | "projectile",
  "damage": positive,
  "fireRate": positive,          // shots per second
  "reloadTime": positive,        // seconds
  "magSize": positive integer,
  "maxReserve": positive integer,
  "spread": 0–1 (default 0),    // 0=accurate, 1=wildly inaccurate
  "range": positive (default 50)
}

### ShooterEnemy
{
  "id": string,
  "name": string,
  "health": positive,
  "moveSpeed": positive (default 3),
  "transform": Transform,
  "mesh": Mesh,
  "material": Material,
  "physics": Physics | omit,
  "behavior": EnemyBehavior,
  "spawnWave": integer >= 1 | omit,
  "weapon": string | omit,       // weaponId for ranged enemies
  "accuracy": 0–1 (default 0.5),
  "lootDrop": "health" | "ammo" | omit
}

### EnemyBehavior
{
  "aiType": "patrol" | "guard" | "chase" | "wander" | "boss",
  "patrolPath": Vec3[] (≥2) | omit,  // required for patrol
  "guardPosition": Vec3 | omit,       // required for guard
  "aggroRange": positive (default 15),
  "attackRange": positive (default 2)
}

### ShooterPickup — discriminated on "type"
Health:  { "type": "health", "id": string, "position": Vec3, "amount": positive, "respawnTime": positive | omit }
Armor:   { "type": "armor",  "id": string, "position": Vec3, "amount": positive, "respawnTime": positive | omit }
Ammo:    { "type": "ammo",   "id": string, "position": Vec3, "amount": positive, "weaponId": string }
Weapon:  { "type": "weapon", "id": string, "position": Vec3, "weaponId": string }

### WaveConfig (omit for elimination/score_attack modes)
{
  "waves": Wave[],               // at least 1
  "timeBetweenWaves": positive (default 5)
}

### Wave
{
  "waveNumber": positive integer,
  "enemyIds": string[],          // at least 1 — must reference existing enemy IDs
  "spawnDelay": number >= 0 (default 0)
}

### ShooterPlayerConfig
{
  "spawnPoint": Vec3,
  "health": positive (default 100),
  "moveSpeed": positive (default 6),
  "sprintSpeed": positive (default 9),
  "jumpForce": positive (default 8),
  "startingWeapon": string,      // must match a weapons[].id
  "startingAmmo": { [weaponId]: positive integer } | omit
}

### ShooterRules
{
  "mode": "elimination" | "waves" | "score_attack",
  "winCondition": "defeat_all" | "survive_waves" | "reach_score",
  "winValue": positive | omit,  // score target for score_attack
  "loseCondition": "health_zero" | "time_expired",
  "timeLimitSeconds": positive | omit
}

### ShooterUI
{
  "title": string,
  "description": string,
  "showCrosshair": boolean (default true),
  "showAmmo": boolean (default true),
  "showWaveCounter": boolean (default false)
}

### Shared types
Material = { "color": "#rrggbb", "roughness": 0–1 (default 0.5), "metalness": 0–1 (default 0) }
Transform = { "position": Vec3, "rotation": Vec3 (default 0,0,0), "scale": Vec3 (default 1,1,1) }
Mesh — discriminated on "kind":
  Primitive: { "kind": "primitive", "shape": "box"|"sphere"|"cylinder"|"plane", "size": Vec3 }
  Compound:  { "kind": "compound", "parts": CompoundPart[], "boundingSize": Vec3 | omit }
Physics = { "bodyType": "static"|"dynamic"|"kinematic", "collider": "box"|"sphere"|"cylinder"|"capsule"|"mesh", "sensor": boolean | omit }
Vec3 = { "x": number, "y": number, "z": number }
All colors must be exactly 7 characters: "#" + 6 lowercase hex digits.`;

export const SHOOTER_GENERATOR_PROMPT = `You are a creative FPS game designer and technical builder. Given a user's game description, design and build a complete ShooterSpec as valid JSON.

Think creatively about:
- Theme, mood, time of day, hex colors, lighting, fog
- Arena: shape (rectangle/circle), size, floor/wall materials, cover objects for tactical gameplay
- Weapons: balanced damage, fire rate, ammo economy. Pistol ~12-15 dmg, shotgun ~30-45, rifle ~10-15 per shot
- Enemies: varied AI types (patrol, guard, chase, wander, boss), health, speed, accuracy
- Wave progression: start easy, escalate difficulty. More enemies, tougher enemies in later waves
- Pickups: health packs near arena edges, ammo in safe spots, weapon pickups to reward exploration

CRITICAL RULES:
- Every enemy.weapon MUST reference a valid weapons[].id (or omit it for melee)
- player.startingWeapon MUST match a weapons[].id
- waveConfig.waves[].enemyIds MUST reference existing enemies[].id values
- All entity positions must be within arena bounds (±size.x/2 for X, ±size.z/2 for Z)
- Enemies must be at least 10 units (XZ distance) from player spawn
- Entity Y = half their height above 0 (sitting on floor)
- Cover objects should create sight lines and flanking opportunities
- Spread values: 0-0.03 = accurate, 0.04-0.08 = moderate, 0.1-0.2 = wide
- Fire rates: pistol 2-4, rifle 6-10, shotgun 0.8-1.5

CONSTRAINTS:
- Maximum 12 enemies total across all waves
- Maximum 3 weapons
- Maximum 8 pickups
- Maximum 6 cover objects
- Use primitive meshes for enemies and cover — keep it simple
- All colors: lowercase hex "#rrggbb"

Output ONLY valid JSON — no markdown, no code fences, no commentary.

${SHOOTER_SCHEMA_DOCS}

## Example weapon:
{ "id": "pistol", "name": "Pistol", "type": "hitscan", "damage": 15, "fireRate": 3, "reloadTime": 1.5, "magSize": 12, "maxReserve": 60, "spread": 0.02, "range": 50 }

## Example enemy:
{ "id": "grunt-1", "name": "Grunt", "health": 40, "moveSpeed": 3, "accuracy": 0.5,
  "transform": { "position": { "x": 12, "y": 1, "z": -8 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "scale": { "x": 1, "y": 1, "z": 1 } },
  "mesh": { "kind": "primitive", "shape": "box", "size": { "x": 0.8, "y": 1.8, "z": 0.6 } },
  "material": { "color": "#884422", "roughness": 0.6, "metalness": 0.2 },
  "physics": { "bodyType": "kinematic", "collider": "box" },
  "behavior": { "aiType": "patrol", "patrolPath": [{ "x": 12, "y": 1, "z": -8 }, { "x": 12, "y": 1, "z": 5 }], "aggroRange": 15, "attackRange": 2 },
  "spawnWave": 1 }

## Example pickup:
{ "type": "ammo", "id": "ammo-1", "position": { "x": -10, "y": 0.5, "z": 0 }, "amount": 24, "weaponId": "pistol" }

Be creative with the theme. Make the game FUN and well-balanced.`;

export const SHOOTER_VALIDATOR_PROMPT = `You are a game spec validator. Fix the issues listed below and return the COMPLETE corrected ShooterSpec as **pure JSON** (no markdown, no code fences).

${SHOOTER_SCHEMA_DOCS}

Fix each issue while keeping the rest of the spec intact. Make minimal changes needed to resolve problems.`;

export const SHOOTER_REFINE_PROMPT = `You are an FPS game designer AI. Modify an existing ShooterSpec according to the user's instruction. Return the COMPLETE updated spec as **pure JSON** (no markdown, no code fences, no commentary).

${SHOOTER_SCHEMA_DOCS}

Rules:
- Preserve existing weapons/enemies/settings unless the modification explicitly changes them.
- Generate unique IDs for new entities (don't conflict with existing ones).
- Every enemy.weapon must reference a valid weapons[].id.
- player.startingWeapon must match a weapons[].id.
- waveConfig.waves[].enemyIds must reference existing enemies[].id values.
- For difficulty changes: adjust enemy health/speed/count, weapon damage, or ammo amounts.
- Always return the FULL spec, not just changed parts.
- All colors: exactly "#" + 6 lowercase hex digits. "template" must be "shooter".`;
