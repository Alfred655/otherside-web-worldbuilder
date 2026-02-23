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

BEFORE generating JSON, analyze the user's prompt and make these decisions:

1. THEME/MOOD: What is the core theme? (horror, military, fantasy, pirate, sci-fi, western, zombie, alien, medieval, etc.)
2. ARENA TEMPLATE: Which layout fits best?
   - "warehouse" for indoor/industrial/factory/lab settings
   - "courtyard" for open/outdoor/pirate/western/medieval settings
   - "corridors" for horror/maze/hospital/dungeon/claustrophobic settings
   - "rooftop" for urban/city/vertical/sci-fi/sniper settings
   - "bunker" for military/base/fortress/defense settings
3. ARENA SIZE: Match the prompt's scale and intensity:
   - Small/tight (24-28m): horror, claustrophobic, close quarters, corridors
   - Medium (28-34m): standard combat, most themes, indoor arenas
   - Large/open (34-40m): epic battles, outdoor themes, pirate, western
4. TIME OF DAY + LIGHTING: Match the mood (see LIGHTING RULES below)
5. ENEMY TYPES: Pick 2-3 DIFFERENT enemy types that fit the theme with different AI behaviors
6. WEAPON NAMES: Use theme-specific names, NOT generic "Pistol"/"Shotgun"

THEME-SPECIFIC WEAPON NAMING — weapons must feel like they belong in the world:
- Horror/Dark: "Rusty Revolver", "Sawed-Off Shotgun", "Crossbow", "Nail Gun"
- Sci-fi/Alien: "Plasma Pistol", "Ion Rifle", "Pulse Cannon", "Arc Blaster"
- Pirate/Nautical: "Flintlock", "Blunderbuss", "Hand Cannon", "Musket"
- Military/Tactical: "M9 Sidearm", "M4 Carbine", "RPG-7", "Combat Shotgun"
- Fantasy/Medieval: "Arcane Bolt", "Fire Staff", "Ice Shard", "Enchanted Crossbow"
- Western: "Six-Shooter", "Lever-Action Rifle", "Double-Barrel Shotgun", "Derringer"
- Zombie: "Makeshift Pistol", "Pipe Shotgun", "Hunting Rifle", "Molotov Launcher"
- Alien: "Disruptor", "Photon Blaster", "Gravity Gun", "Tesla Coil"

THEME-SPECIFIC LIGHTING — match atmosphere to theme:
- Horror/Dark/Zombie: timeOfDay "night" or "midnight", skyColor "#1a1a2e", ambientLightColor "#8888aa", ambientLightIntensity 0.3-0.4, fog color "#2a1a3a" or "#1a2a1a"
- Military/Tactical: timeOfDay "morning" or "noon", skyColor "#87ceeb", ambientLightColor "#ffffff", ambientLightIntensity 0.6, no fog
- Pirate/Nautical: timeOfDay "afternoon" or "dusk", skyColor "#ff8844" or "#cc6633", ambientLightColor "#ffddaa", ambientLightIntensity 0.5, warm fog "#ffaa66"
- Sci-fi/Alien: timeOfDay "dusk" or "night", skyColor "#0a0a2a" or "#1a0a2a", ambientLightColor "#aaccff", ambientLightIntensity 0.4, neon fog "#00ff88" or "#8800ff"
- Fantasy/Medieval: timeOfDay "dawn" or "morning", skyColor "#9988cc" or "#aabb99", ambientLightColor "#ffeecc", ambientLightIntensity 0.5, light fog "#ccbbdd"
- Western: timeOfDay "afternoon", skyColor "#ddaa55" or "#cc8833", ambientLightColor "#ffddbb", ambientLightIntensity 0.6, dusty fog "#ccaa77"
- Indoor (warehouse/bunker): ambientLightIntensity 0.5-0.7, warm ambientLightColor "#ffddcc" or "#ddccbb"
- NEVER use skyColor "#000000". Dark blue "#1a1a2e" is the darkest allowed.
- ambientLightColor must NEVER be very dark — use "#ffffff", "#ddccbb", "#aaccff", etc.

## Few-Shot Examples — PARTIAL snippets showing only key differentiating fields.
## Your output MUST be a COMPLETE ShooterSpec with ALL required top-level fields:
## name, version, template ("shooter"), world, arena, weapons, player (with spawnPoint, startingWeapon), enemies, pickups, rules (with mode, winCondition, loseCondition), ui (with title, description).

EXAMPLE 1 — "a pirate ship battle":
"arena": { "shape":"rectangle", "size":{"x":35,"y":4,"z":35}, "layoutTemplate":"courtyard", "theme":"pirate dock battle", "coverObjects":[], "zones":[
  {"type":"spawn_area","region":"south","description":"Dock entrance"},
  {"type":"landmark","region":"center","description":"Ship mast and cargo"},
  {"type":"cover_heavy","region":"north","description":"Cannon positions"},
  {"type":"supply_cache","region":"east","description":"Rum barrels and loot"},
  {"type":"open_combat","region":"west","description":"Open deck"}] },
"world": { "skyColor":"#ff7744", "ambientLightColor":"#ffddaa", "ambientLightIntensity":0.5, "fog":{"color":"#ffaa66","near":20,"far":60}, "timeOfDay":"dusk", "gravity":{"x":0,"y":-9.81,"z":0} },
"weapons": [{ "id":"flintlock", "name":"Flintlock", "type":"hitscan", "damage":20, "fireRate":1.5, "reloadTime":2.5, "magSize":6, "maxReserve":36, "spread":0.04, "range":40 }],
"enemies": [
  { "id":"skeleton-1", "name":"Skeleton Pirate", "health":35, "assetId":"skeleton", "behavior":{"aiType":"patrol","aggroRange":14,"attackRange":2} },
  { "id":"ghost-1", "name":"Ship Ghost", "health":25, "assetId":"ghost", "behavior":{"aiType":"wander","aggroRange":18,"attackRange":3} }]

EXAMPLE 2 — "zombie survival in a hospital":
"arena": { "shape":"rectangle", "size":{"x":26,"y":4,"z":26}, "layoutTemplate":"corridors", "theme":"abandoned hospital", "coverObjects":[], "zones":[
  {"type":"spawn_area","region":"southwest","description":"Emergency exit"},
  {"type":"cover_heavy","region":"north","description":"Overturned gurneys"},
  {"type":"open_combat","region":"center","description":"Main hallway junction"},
  {"type":"supply_cache","region":"northeast","description":"Medicine storage"},
  {"type":"cover_light","region":"east","description":"Waiting room chairs"},
  {"type":"sniper_perch","region":"northwest","description":"Elevated nurse station"}] },
"world": { "skyColor":"#1a1a2e", "ambientLightColor":"#8888aa", "ambientLightIntensity":0.35, "fog":{"color":"#1a2a1a","near":8,"far":35}, "timeOfDay":"night", "gravity":{"x":0,"y":-9.81,"z":0} },
"weapons": [{ "id":"pipe-shotgun", "name":"Pipe Shotgun", "type":"hitscan", "damage":40, "fireRate":1.0, "reloadTime":2.0, "magSize":4, "maxReserve":24, "spread":0.12, "range":25 }],
"enemies": [
  { "id":"zombie-1", "name":"Infected Patient", "health":30, "assetId":"zombie", "behavior":{"aiType":"chase","aggroRange":12,"attackRange":2} },
  { "id":"zombie-2", "name":"Zombie Nurse", "health":45, "assetId":"zombie_animated_a", "behavior":{"aiType":"patrol","aggroRange":15,"attackRange":2} }]

EXAMPLE 3 — "alien invasion on a rooftop":
"arena": { "shape":"rectangle", "size":{"x":32,"y":4,"z":26}, "layoutTemplate":"rooftop", "theme":"neon city rooftop", "coverObjects":[], "zones":[
  {"type":"spawn_area","region":"south","description":"Rooftop access stairs"},
  {"type":"cover_heavy","region":"west","description":"HVAC units and generators"},
  {"type":"open_combat","region":"center","description":"Open helipad"},
  {"type":"sniper_perch","region":"north","description":"Water tower vantage"},
  {"type":"supply_cache","region":"east","description":"Emergency supply crate"}] },
"world": { "skyColor":"#0a0a2a", "ambientLightColor":"#aaccff", "ambientLightIntensity":0.4, "fog":{"color":"#00ff88","near":15,"far":50}, "timeOfDay":"night", "gravity":{"x":0,"y":-9.81,"z":0} },
"weapons": [{ "id":"plasma-pistol", "name":"Plasma Pistol", "type":"hitscan", "damage":14, "fireRate":4, "reloadTime":1.2, "magSize":16, "maxReserve":80, "spread":0.03, "range":50 }],
"enemies": [
  { "id":"alien-1", "name":"Drone Scout", "health":25, "assetId":"kenney_enemy_flying", "behavior":{"aiType":"wander","aggroRange":20,"attackRange":4} },
  { "id":"cyborg-1", "name":"Cyborg Enforcer", "health":60, "assetId":"cyborg_female", "behavior":{"aiType":"guard","aggroRange":16,"attackRange":3} }]

EXAMPLE 4 — "medieval castle defense":
"arena": { "shape":"rectangle", "size":{"x":30,"y":4,"z":26}, "layoutTemplate":"bunker", "theme":"stone castle courtyard", "coverObjects":[], "zones":[
  {"type":"spawn_area","region":"south","description":"Castle gate entrance"},
  {"type":"cover_heavy","region":"east","description":"Stone rampart positions"},
  {"type":"landmark","region":"center","description":"Castle fountain and statue"},
  {"type":"open_combat","region":"north","description":"Courtyard killing ground"},
  {"type":"supply_cache","region":"west","description":"Armory alcove"},
  {"type":"sniper_perch","region":"northeast","description":"Tower overlook"}] },
"world": { "skyColor":"#9988cc", "ambientLightColor":"#ffeecc", "ambientLightIntensity":0.5, "fog":{"color":"#ccbbdd","near":20,"far":55}, "timeOfDay":"dawn", "gravity":{"x":0,"y":-9.81,"z":0} },
"weapons": [{ "id":"crossbow", "name":"Enchanted Crossbow", "type":"hitscan", "damage":22, "fireRate":2, "reloadTime":1.8, "magSize":8, "maxReserve":40, "spread":0.02, "range":55 }],
"enemies": [
  { "id":"skel-1", "name":"Skeleton Knight", "health":50, "assetId":"skeleton", "behavior":{"aiType":"guard","aggroRange":14,"attackRange":2} },
  { "id":"vamp-1", "name":"Vampire Lord", "health":80, "assetId":"vampire", "behavior":{"aiType":"boss","aggroRange":20,"attackRange":3} }]

EXAMPLE 5 — "wild west shootout":
"arena": { "shape":"rectangle", "size":{"x":36,"y":4,"z":32}, "layoutTemplate":"courtyard", "theme":"dusty frontier town", "coverObjects":[], "zones":[
  {"type":"spawn_area","region":"south","description":"Saloon entrance"},
  {"type":"cover_heavy","region":"west","description":"Overturned wagon"},
  {"type":"open_combat","region":"center","description":"Main street standoff"},
  {"type":"cover_light","region":"east","description":"Market stall debris"},
  {"type":"supply_cache","region":"north","description":"Sheriff's office"},
  {"type":"sniper_perch","region":"northwest","description":"Clock tower"}] },
"world": { "skyColor":"#ddaa55", "ambientLightColor":"#ffddbb", "ambientLightIntensity":0.6, "fog":{"color":"#ccaa77","near":25,"far":65}, "timeOfDay":"afternoon", "gravity":{"x":0,"y":-9.81,"z":0} },
"weapons": [{ "id":"six-shooter", "name":"Six-Shooter", "type":"hitscan", "damage":18, "fireRate":2.5, "reloadTime":2.0, "magSize":6, "maxReserve":42, "spread":0.03, "range":45 }],
"enemies": [
  { "id":"bandit-1", "name":"Outlaw", "health":40, "assetId":"kenney_soldier", "behavior":{"aiType":"patrol","aggroRange":16,"attackRange":2} },
  { "id":"bandit-2", "name":"Sharpshooter", "health":30, "assetId":"criminal_male", "behavior":{"aiType":"guard","aggroRange":22,"attackRange":5} }]

CRITICAL RULES:
- Every enemy.weapon MUST reference a valid weapons[].id (or omit it for melee)
- player.startingWeapon MUST match a weapons[].id
- waveConfig.waves[].enemyIds MUST reference existing enemies[].id values
- All entity positions must be within arena bounds (±size.x/2 for X, ±size.z/2 for Z)
- Enemies must be at least 10 units (XZ distance) from player spawn
- ALL enemies MUST have position.y = 0 and scale = {x:1, y:1, z:1}
- ALL enemies MUST have an assetId from the catalog. Use character/enemy assets matching the theme (e.g. "kenney_soldier", "skeleton", "zombie", "ghost", "vampire", "kenney_enemy_flying"). NEVER omit assetId on enemies.
- ALL enemies MUST have mesh size {x:0.6, y:1.5, z:0.6} and collider "capsule" — this ensures the physics collider matches the 3D model.
- Spread values: 0-0.03 = accurate, 0.04-0.08 = moderate, 0.1-0.2 = wide
- Fire rates: pistol 2-4, rifle 6-10, shotgun 0.8-1.5
- showWaveCounter MUST be true when mode is "waves" — players need to see wave progress

CONSTRAINTS:
- Maximum 12 enemies total across all waves
- Maximum 3 weapons
- Maximum 8 pickups
- All colors: lowercase hex "#rrggbb"

ASSET SYSTEM — THEME-AWARE SELECTION:
- An asset catalog of 3D models is provided below. ALWAYS set "assetId" on enemies and cover objects.
- Match assets to the game's theme:
  MILITARY/COMBAT: enemies→"kenney_soldier","character_soldier","criminal_male". Cover→"urban_barrier_strong_type_a","urban_barrier_strong_type_b","urban_block","dumpster_closed".
  HORROR/SPOOKY/DARK: enemies→"zombie","skeleton","ghost","vampire","zombie_animated_a". Cover→"coffin","coffin_old","hay_bale","hay_bale_bundled".
  WAREHOUSE/INDUSTRIAL: enemies→"kenney_soldier","criminal_male","survivor_male". Cover→"crate_medium","crate_small","crate_wide","pallet","pallet_small","pirate_barrel".
  SCI-FI/FUTURISTIC: enemies→"kenney_enemy_flying","cyborg_female","criminal_male". Cover→"urban_barrier_strong_type_a","urban_block","urban_barrier_type_a".
  PIRATE/NAUTICAL: enemies→"skeleton","ghost","graveyard_keeper". Cover→"pirate_barrel","pirate_crate","pirate_crate_bottles","crate_medium".
  FANTASY/MEDIEVAL: enemies→"skeleton","vampire","ghost","graveyard_keeper". Cover→"crate_medium","crate_wide","pirate_barrel","hay_bale".
- Priority: theme-preferred assets > literal description match > any category match.
- VARIETY: use 3-5 DIFFERENT cover asset types per arena. Never reuse the same assetId more than 4 times.
- NEVER omit assetId on enemies or cover objects. Every enemy and every cover object MUST have a valid assetId.
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

Output ONLY valid JSON — no markdown, no code fences, no commentary.

\${SHOOTER_SCHEMA_DOCS}

## Example enemy (with layout — placeholder position):
{ "id": "grunt-1", "name": "Grunt", "health": 40, "moveSpeed": 3, "accuracy": 0.5,
  "transform": { "position": { "x": 0, "y": 0, "z": 0 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "scale": { "x": 1, "y": 1, "z": 1 } },
  "mesh": { "kind": "primitive", "shape": "box", "size": { "x": 0.6, "y": 1.5, "z": 0.6 } },
  "material": { "color": "#884422", "roughness": 0.6, "metalness": 0.2 },
  "physics": { "bodyType": "kinematic", "collider": "capsule" },
  "behavior": { "aiType": "patrol", "aggroRange": 15, "attackRange": 2 },
  "assetId": "kenney_soldier",
  "spawnWave": 1 }

## Example pickup (placeholder position):
{ "type": "ammo", "id": "ammo-1", "position": { "x": 0, "y": 0, "z": 0 }, "amount": 24, "weaponId": "pistol" }

Be creative with the theme. Make the game FUN and well-balanced.`;

export const SHOOTER_VALIDATOR_PROMPT = `You are a game spec validator. Fix the issues listed below and return the COMPLETE corrected ShooterSpec as **pure JSON** (no markdown, no code fences).

${SHOOTER_SCHEMA_DOCS}

Fix each issue while keeping the rest of the spec intact. Make minimal changes needed to resolve problems.`;

export const SHOOTER_REFINE_PROMPT = `You are an FPS game designer AI. Modify an existing ShooterSpec according to the user's instruction. Return the COMPLETE updated spec as **pure JSON** (no markdown, no code fences, no commentary).

REFINEMENT PHILOSOPHY: Your job is to make DRAMATIC, VISIBLE changes. The user should immediately notice what changed when the game reloads. Small tweaks are failures. Every refinement must produce a noticeably different game.

STRUCTURAL ADDITION GUIDE — what "add X" means in practice:
- "add a house/building" → add 4-6 new zones with cover_heavy/landmark types forming a structure area, add a "landmark" zone, describe it in zone descriptions
- "add more enemies" → add 3-4 NEW enemy entries with DIFFERENT types and behaviors from existing ones, increase total enemy count by at least 50%
- "make it harder" → increase enemy count by 50%, boost enemy health by 30%, reduce pickup count, add a boss enemy if none exists, increase enemy accuracy
- "make it nighttime" → change ALL of: timeOfDay to "night", skyColor to "#1a1a2e", ambientLightColor to "#8888aa", ambientLightIntensity to 0.3-0.4, ADD fog with dark color "#2a1a3a"
- "make it daytime" → change ALL of: timeOfDay to "morning" or "afternoon", skyColor to "#87ceeb", ambientLightColor to "#ffffff", ambientLightIntensity to 0.6, REMOVE fog or lighten it
- "add a sniper tower" → add "sniper_perch" zone in a corner region, add 1-2 guard-type enemies with high accuracy (0.7+) and long aggroRange (20+)
- "add more weapons" → add 2 weapons with distinct stats (one fast/weak, one slow/powerful), add ammo pickups for them

REFINEMENT MAGNITUDE RULES:
- Atmosphere changes: modify ALL of skyColor, ambientLightColor, ambientLightIntensity, fog, and timeOfDay together. Not just one field.
- Enemy additions: add at least 2-3 new enemies with DIFFERENT types/behaviors from existing ones. Never just clone an existing enemy.
- Zone changes: add at least 2 new zones when user requests structural changes.
- Weapon changes: if adding weapons, add 2 with distinct stats (one fast/weak, one slow/powerful).
- Difficulty changes: adjust at least 3 fields (enemy count, health, accuracy, pickup count, damage).

${SHOOTER_SCHEMA_DOCS}

Rules:
- Preserve existing weapons/enemies/settings unless the modification explicitly changes them.
- Generate unique IDs for new entities (don't conflict with existing ones).
- Every enemy.weapon must reference a valid weapons[].id.
- player.startingWeapon must match a weapons[].id.
- waveConfig.waves[].enemyIds must reference existing enemies[].id values.
- Always return the FULL spec, not just changed parts.
- All colors: exactly "#" + 6 lowercase hex digits. "template" must be "shooter".
- For ENEMIES: always assign an assetId from the catalog matching the theme. Military→"kenney_soldier","character_soldier". Horror→"zombie","skeleton","ghost","vampire". Sci-fi→"kenney_enemy_flying","cyborg_female". Pirate/Fantasy→"skeleton","ghost","graveyard_keeper". NEVER omit assetId on enemies.
- For COVER: always assign an assetId. Use theme-appropriate assets with variety (3-5 different types).

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
