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
  "coverObjects": CoverObject[],  // default [] — leave EMPTY when using layoutTemplate
  "layoutTemplate": "warehouse"|"courtyard"|"corridors"|"rooftop"|"bunker" | omit,
  "theme": string | omit,         // e.g. "dark warehouse", "medieval courtyard"
  "zones": ArenaZone[] | omit     // zone descriptions for layout engine
}

### ArenaZone
{
  "type": "cover_heavy"|"cover_light"|"open_combat"|"supply_cache"|"sniper_perch"|"landmark"|"spawn_area",
  "region": "north"|"south"|"east"|"west"|"center"|"northeast"|"northwest"|"southeast"|"southwest",
  "description": string | omit
}

### CoverObject
{
  "id": string,
  "transform": Transform,       // full transform with position, rotation, scale
  "mesh": Mesh,
  "material": Material,
  "destructible": boolean (default false),
  "health": positive | omit,    // only if destructible
  "assetId": string | omit      // reference to asset catalog — if set, engine loads a 3D model instead of primitive mesh
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
  "lootDrop": "health" | "ammo" | omit,
  "assetId": string | omit      // reference to asset catalog — if set, engine loads a 3D model instead of primitive mesh
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
- ALL enemies MUST have position.y = 0 and scale = {x:1, y:1, z:1}
- ALL enemies MUST have "assetId": "kenney_soldier" (ground enemies) or "assetId": "kenney_enemy_flying" (flying/drone enemies). NEVER omit assetId on enemies.
- ALL enemies MUST have mesh size {x:0.6, y:1.5, z:0.6} and collider "capsule" — this ensures the physics collider matches the 3D model.
- Spread values: 0-0.03 = accurate, 0.04-0.08 = moderate, 0.1-0.2 = wide
- Fire rates: pistol 2-4, rifle 6-10, shotgun 0.8-1.5
- showWaveCounter MUST be true when mode is "waves" — players need to see wave progress

CONSTRAINTS:
- Maximum 12 enemies total across all waves
- Maximum 3 weapons
- Maximum 8 pickups
- All colors: lowercase hex "#rrggbb"

ASSET SYSTEM:
- For ENEMIES: always use "assetId": "kenney_soldier" for humanoid/soldier enemies, "assetId": "kenney_enemy_flying" for flying/drone/alien enemies. This is critical for enemy visibility.
- When assetId is set, always use scale {"x":1,"y":1,"z":1} and position.y = 0.

ARENA CONSTRUCTION — the engine automatically builds the arena floor and walls using modular 3D tiles:
- Do NOT create entities for floor or walls — the arena config handles them.

LAYOUT SYSTEM — ALWAYS use template-based layouts:
1. Pick a layoutTemplate:
   - "warehouse": Indoor 3-lane arena (25-35m x 20-28m) with shelving rows, office, loading dock
   - "courtyard": Open center (28-38m x 28-38m) with landmark, L-shaped building walls
   - "corridors": Compact maze (24-32m x 24-32m) with hallways, rooms, central hub
   - "rooftop": Open surface (28-36m x 22-30m) with HVAC units, water tower, low walls
   - "bunker": Military base (26-34m x 22-30m) with sandbags, command area, supply room

2. Set coverObjects to [] (empty array). The engine generates all cover from the template.

3. Set theme to a short description (e.g. "dark warehouse", "medieval courtyard", "military bunker").

4. Define 4-8 zones describing the arena:
   Types: cover_heavy, cover_light, open_combat, supply_cache, sniper_perch, landmark, spawn_area
   Regions: north, south, east, west, center, northeast, northwest, southeast, southwest

5. Arena size MUST be within the template's recommended range. Use "rectangle" shape.

6. For enemies: provide type, behavior, and wave info. Set position to {x:0, y:0, z:0}.
   The engine places them at good zone positions automatically.

7. For pickups: provide type and amount. Set position to {x:0, y:0, z:0}.
   The engine places them in appropriate supply_cache zones.

ZONE DESIGN PRINCIPLES:
- Include at least one "spawn_area" zone (player starts here)
- Include at least one "open_combat" zone
- Mix cover_heavy and cover_light for variety
- Place supply_cache zones away from spawn (exploration reward)
- Use sniper_perch for guard enemies with long sight lines

LIGHTING RULES — the arena must always be well-lit and visible:
- ambientLightIntensity MUST be at least 0.5 for indoor/warehouse themes, at least 0.3 for outdoor.
- ambientLightColor should be a warm or neutral tone, NEVER very dark (use "#ffffff" or "#ddccbb", NOT "#111111").
- For indoor themes (warehouse, bunker, factory): ambientLightIntensity 0.5-0.7, warm ambientLightColor.
- For outdoor themes (desert, forest, ruins): ambientLightIntensity 0.4-0.6, timeOfDay "morning" or "afternoon" for good light.
- For dusk/night themes: ambientLightIntensity 0.3-0.4 but use warm fog color to add atmosphere.
- skyColor should NEVER be "#000000". Use dark blue "#1a1a2e" for night, warm tones for day.

Output ONLY valid JSON — no markdown, no code fences, no commentary.

${SHOOTER_SCHEMA_DOCS}

## Example weapon:
{ "id": "pistol", "name": "Pistol", "type": "hitscan", "damage": 15, "fireRate": 3, "reloadTime": 1.5, "magSize": 12, "maxReserve": 60, "spread": 0.02, "range": 50 }

## Example enemy (with layout — placeholder position):
{ "id": "grunt-1", "name": "Grunt", "health": 40, "moveSpeed": 3, "accuracy": 0.5,
  "transform": { "position": { "x": 0, "y": 0, "z": 0 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "scale": { "x": 1, "y": 1, "z": 1 } },
  "mesh": { "kind": "primitive", "shape": "box", "size": { "x": 0.6, "y": 1.5, "z": 0.6 } },
  "material": { "color": "#884422", "roughness": 0.6, "metalness": 0.2 },
  "physics": { "bodyType": "kinematic", "collider": "capsule" },
  "behavior": { "aiType": "patrol", "aggroRange": 15, "attackRange": 2 },
  "assetId": "kenney_soldier",
  "spawnWave": 1 }

## Example arena with layout:
"arena": {
  "shape": "rectangle",
  "size": { "x": 30, "y": 4, "z": 24 },
  "wallHeight": 4,
  "floorMaterial": { "color": "#555544", "roughness": 0.9, "metalness": 0 },
  "wallMaterial": { "color": "#666655", "roughness": 0.8, "metalness": 0 },
  "coverObjects": [],
  "layoutTemplate": "warehouse",
  "theme": "dark warehouse",
  "zones": [
    { "type": "spawn_area", "region": "southwest", "description": "Player entry point" },
    { "type": "cover_heavy", "region": "northwest", "description": "Office area with heavy cover" },
    { "type": "open_combat", "region": "center", "description": "Main combat area between lanes" },
    { "type": "supply_cache", "region": "northeast", "description": "Loading dock with supplies" },
    { "type": "cover_light", "region": "east", "description": "Side corridor with light cover" }
  ]
}

## Example pickup (placeholder position):
{ "type": "ammo", "id": "ammo-1", "position": { "x": 0, "y": 0, "z": 0 }, "amount": 24, "weaponId": "pistol" }

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
- All colors: exactly "#" + 6 lowercase hex digits. "template" must be "shooter".
- For ENEMIES: always use "assetId": "kenney_soldier" for humanoid enemies, "assetId": "kenney_enemy_flying" for flying enemies.

LAYOUT SYSTEM:
- If the spec has a "layoutTemplate", PRESERVE it. Do NOT remove it or add coverObjects.
- For layout changes (e.g. "add more cover", "make it more open"), modify the zones array instead.
- To change arena style, you may change the layoutTemplate to a different template.
- coverObjects MUST stay empty ([]) when layoutTemplate is set — the engine generates cover.
- Enemies and pickups should keep placeholder positions {x:0,y:0,z:0} — the engine repositions them.

LIGHTING RULES:
- ambientLightIntensity MUST be at least 0.5 for indoor, 0.3 for outdoor.
- ambientLightColor should be warm/neutral, NEVER very dark.
- skyColor should NEVER be "#000000".`;
