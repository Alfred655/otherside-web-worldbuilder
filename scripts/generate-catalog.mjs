#!/usr/bin/env node
/**
 * Generates assets/catalog.json from all .glb files in assets/models/.
 * Run with: node scripts/generate-catalog.mjs
 */
import { readdirSync, writeFileSync } from "fs";
import path from "path";

const ASSETS_DIR = path.resolve("assets/models");
const OUTPUT = path.resolve("assets/catalog.json");

// Category directories → catalog category name
const CATEGORIES = [
  "characters",
  "enemies",
  "weapons",
  "cover",
  "environment",
  "props",
  "vehicles",
  "nature",
  "pickups",
];

// ── Tag rules: match filename patterns to tags ──────────────────────
function generateTags(filename, category) {
  const f = filename.toLowerCase();
  const tags = [category];

  // Blaster kit
  if (f.startsWith("blaster-")) tags.push("weapon", "gun", "blaster", "sci-fi", "ranged");
  if (f.includes("grenade")) tags.push("weapon", "grenade", "explosive", "throwable");
  if (f.includes("scope")) tags.push("attachment", "scope", "optic");
  if (f.includes("silencer")) tags.push("attachment", "silencer", "stealth");
  if (f.includes("clip-")) tags.push("ammo", "magazine", "clip");
  if (f.includes("bullet")) tags.push("ammo", "bullet", "projectile");
  if (f.includes("smoke")) tags.push("effect", "smoke", "vfx");

  // Crates & barrels
  if (f.includes("crate")) tags.push("crate", "container", "wood", "storage");
  if (f.includes("barrel")) tags.push("barrel", "container", "round");
  if (f.includes("box")) tags.push("box", "container");
  if (f.includes("pallet")) tags.push("pallet", "wood", "industrial");

  // Characters
  if (f.includes("character")) tags.push("character", "humanoid", "npc");
  if (f.includes("blocky")) tags.push("blocky", "stylized", "low-poly");
  if (f.includes("mini-")) tags.push("mini", "small", "cute");
  if (f.includes("female")) tags.push("female", "woman");
  if (f.includes("male") && !f.includes("female")) tags.push("male", "man");
  if (f.includes("soldier")) tags.push("soldier", "military", "armed");
  if (f.includes("keeper")) tags.push("keeper", "graveyard", "npc", "guard");

  // Enemies
  if (f.includes("ghost")) tags.push("ghost", "undead", "spooky", "floating");
  if (f.includes("skeleton")) tags.push("skeleton", "undead", "bones", "melee");
  if (f.includes("zombie")) tags.push("zombie", "undead", "slow", "melee");
  if (f.includes("vampire")) tags.push("vampire", "undead", "fast", "melee");
  if (f.includes("flying") || f.includes("drone")) tags.push("flying", "drone", "aerial");

  // Vehicles
  if (f.includes("ambulance")) tags.push("ambulance", "emergency", "medical");
  if (f.includes("firetruck")) tags.push("firetruck", "emergency", "fire");
  if (f.includes("police")) tags.push("police", "emergency", "law");
  if (f.includes("taxi")) tags.push("taxi", "civilian", "yellow");
  if (f.includes("sedan")) tags.push("sedan", "car", "civilian");
  if (f.includes("suv")) tags.push("suv", "car", "civilian");
  if (f.includes("hatchback")) tags.push("hatchback", "car", "civilian");
  if (f.includes("van")) tags.push("van", "civilian");
  if (f.includes("delivery")) tags.push("delivery", "van", "commercial");
  if (f.includes("truck")) tags.push("truck", "large", "commercial");
  if (f.includes("garbage")) tags.push("garbage", "utility");
  if (f.includes("tractor")) tags.push("tractor", "heavy", "industrial");
  if (f.includes("race")) tags.push("race", "fast", "sports");
  if (f.includes("kart")) tags.push("kart", "small", "racing");
  if (f.includes("sports")) tags.push("sports", "fast");
  if (f.includes("luxury")) tags.push("luxury");

  // Walls & environment
  if (f.includes("wall")) tags.push("wall", "structure");
  if (f.includes("road")) tags.push("road", "ground", "path");
  if (f.includes("roof")) tags.push("roof", "building", "top");
  if (f.includes("stairs") || f.includes("steps")) tags.push("stairs", "steps", "vertical");
  if (f.includes("door")) tags.push("door", "entrance");
  if (f.includes("window")) tags.push("window", "opening");
  if (f.includes("scaffold")) tags.push("scaffolding", "construction");
  if (f.includes("balcony")) tags.push("balcony", "elevated");
  if (f.includes("cliff")) tags.push("cliff", "terrain", "natural");
  if (f.includes("platform")) tags.push("platform", "elevated");
  if (f.includes("floor")) tags.push("floor", "ground", "tile");
  if (f.includes("plank")) tags.push("planks", "wood");
  if (f.includes("pillar")) tags.push("pillar", "column", "vertical");
  if (f.includes("arch")) tags.push("arch", "decorative");
  if (f.includes("fence")) tags.push("fence", "barrier");
  if (f.includes("gate")) tags.push("gate", "entrance");

  // Graveyard specific
  if (f.includes("gravestone") || f.includes("grave")) tags.push("grave", "graveyard", "spooky", "death");
  if (f.includes("coffin")) tags.push("coffin", "graveyard", "spooky");
  if (f.includes("crypt")) tags.push("crypt", "graveyard", "building", "spooky");
  if (f.includes("cross")) tags.push("cross", "religious", "graveyard");
  if (f.includes("iron-fence")) tags.push("iron", "metal", "gothic");
  if (f.includes("stone-wall")) tags.push("stone", "old");
  if (f.includes("brick-wall")) tags.push("brick", "old");
  if (f.includes("candle")) tags.push("candle", "light", "spooky");
  if (f.includes("lantern")) tags.push("lantern", "light");
  if (f.includes("lightpost")) tags.push("light", "post", "street");
  if (f.includes("pumpkin")) tags.push("pumpkin", "halloween", "spooky", "decoration");
  if (f.includes("altar")) tags.push("altar", "religious", "ritual");
  if (f.includes("bench")) tags.push("bench", "seating", "furniture");
  if (f.includes("fire-basket")) tags.push("fire", "light", "basket");
  if (f.includes("urn")) tags.push("urn", "vase", "decoration");
  if (f.includes("obelisk")) tags.push("obelisk", "monument");
  if (f.includes("column")) tags.push("column", "pillar");
  if (f.includes("hay")) tags.push("hay", "farm", "rural");
  if (f.includes("shovel")) tags.push("shovel", "tool");
  if (f.includes("debris")) tags.push("debris", "rubble", "destroyed");

  // Fantasy specific
  if (f.startsWith("fantasy-")) tags.push("fantasy", "medieval");
  if (f.includes("fountain")) tags.push("fountain", "water", "decoration");
  if (f.includes("hedge")) tags.push("hedge", "garden", "green");
  if (f.includes("banner")) tags.push("banner", "flag", "decoration");
  if (f.includes("stall")) tags.push("stall", "market", "shop");
  if (f.includes("chimney")) tags.push("chimney", "building");
  if (f.includes("watermill")) tags.push("watermill", "building", "water");
  if (f.includes("windmill")) tags.push("windmill", "building", "landmark");
  if (f.includes("cart")) tags.push("cart", "wagon");
  if (f.includes("overhang")) tags.push("overhang", "building");
  if (f.includes("wood")) tags.push("wood", "wooden");
  if (f.includes("stone")) tags.push("stone");
  if (f.includes("gable")) tags.push("gable");
  if (f.includes("corner")) tags.push("corner");
  if (f.includes("diagonal")) tags.push("diagonal");
  if (f.includes("curved")) tags.push("curved");
  if (f.includes("half")) tags.push("half");

  // Pirate specific
  if (f.startsWith("pirate-")) tags.push("pirate", "nautical");
  if (f.includes("ship")) tags.push("ship", "boat", "water");
  if (f.includes("cannon")) tags.push("cannon", "weapon", "naval");
  if (f.includes("flag")) tags.push("flag", "decoration");
  if (f.includes("chest")) tags.push("chest", "treasure", "loot");
  if (f.includes("bottle")) tags.push("bottle", "glass");
  if (f.includes("mast")) tags.push("mast", "ship", "tall");
  if (f.includes("palm")) tags.push("palm", "tree", "tropical");
  if (f.includes("castle")) tags.push("castle", "fortification");
  if (f.includes("tower")) tags.push("tower", "tall", "fortification");
  if (f.includes("structure")) tags.push("structure", "building");

  // Urban specific
  if (f.startsWith("urban-")) tags.push("urban", "city", "modern");
  if (f.includes("asphalt")) tags.push("asphalt", "paved");
  if (f.includes("dirt")) tags.push("dirt", "rural");
  if (f.includes("pavement")) tags.push("pavement", "sidewalk");
  if (f.includes("painted")) tags.push("painted", "colorful");
  if (f.includes("garage")) tags.push("garage");
  if (f.includes("dumpster")) tags.push("dumpster", "trash", "urban", "alley");
  if (f.includes("barrier")) tags.push("barrier", "blockade");
  if (f.includes("traffic")) tags.push("traffic", "road", "urban");
  if (f.includes("cone")) tags.push("cone", "road", "warning");
  if (f.includes("awning")) tags.push("awning", "shade", "storefront");
  if (f.includes("cable")) tags.push("cables", "wires", "electrical");
  if (f.includes("bricks")) tags.push("bricks", "brick", "rubble");
  if (f.includes("beam")) tags.push("beam", "metal", "construction");
  if (f.includes("metal")) tags.push("metal");
  if (f.includes("block")) tags.push("block", "solid");

  // Nature
  if (f.includes("tree") && !f.includes("drivetrain")) tags.push("tree", "nature", "foliage");
  if (f.includes("pine")) tags.push("pine", "tree", "conifer", "nature");
  if (f.includes("shrub")) tags.push("shrub", "bush", "nature");
  if (f.includes("rock")) tags.push("rock", "stone", "nature");
  if (f.includes("grass")) tags.push("grass", "vegetation", "nature");
  if (f.includes("trunk")) tags.push("trunk", "log", "wood", "nature");
  if (f.includes("patch")) tags.push("patch", "ground");
  if (f.includes("sand")) tags.push("sand", "beach");

  // Cover-specific
  if (f.includes("sandbag")) tags.push("sandbag", "military");
  if (f.includes("concrete")) tags.push("concrete", "indestructible");

  // Pickups
  if (f.includes("trophy")) tags.push("trophy", "gold", "reward", "collectible");
  if (f.includes("aid") || f.includes("defibrillator")) tags.push("health", "medical", "pickup");
  if (f.includes("glasses") || f.includes("sunglasses")) tags.push("accessory", "wearable");
  if (f.includes("mask")) tags.push("mask", "accessory");
  if (f.includes("hearing")) tags.push("hearing", "accessory");
  if (f.includes("cane")) tags.push("cane", "walking");
  if (f.includes("crutch")) tags.push("crutch", "medical");

  // Furniture & props
  if (f.includes("wheelchair")) tags.push("wheelchair", "mobility", "medical");
  if (f.includes("wheel") && !f.includes("wheelchair")) tags.push("wheel", "round");
  if (f.includes("target")) tags.push("target", "practice", "shooting");

  // Damaged variants
  if (f.includes("damaged") || f.includes("broken")) tags.push("damaged", "ruined", "worn");
  if (f.includes("old")) tags.push("old", "worn", "aged");

  // Unique dedup
  return [...new Set(tags)];
}

// ── Dimensions heuristics ───────────────────────────────────────────
function guessDimensions(filename, category) {
  const f = filename.toLowerCase();

  // Characters
  if (category === "characters") {
    if (f.includes("mini")) return { width: 0.4, height: 1.0, depth: 0.4 };
    if (f.includes("blocky")) return { width: 0.5, height: 1.2, depth: 0.5 };
    return { width: 0.6, height: 1.5, depth: 0.6 };
  }
  // Enemies
  if (category === "enemies") {
    if (f.includes("ghost")) return { width: 0.8, height: 1.5, depth: 0.8 };
    if (f.includes("flying")) return { width: 1.5, height: 1.5, depth: 1.5 };
    return { width: 0.6, height: 1.5, depth: 0.6 };
  }
  // Weapons
  if (category === "weapons") {
    if (f.includes("grenade")) return { width: 0.1, height: 0.15, depth: 0.1 };
    return { width: 0.3, height: 0.2, depth: 0.6 };
  }
  // Vehicles
  if (category === "vehicles") {
    if (f.includes("kart")) return { width: 1.0, height: 0.8, depth: 1.5 };
    if (f.includes("truck") || f.includes("firetruck") || f.includes("garbage")) return { width: 2.5, height: 3.0, depth: 6.0 };
    if (f.includes("tractor")) return { width: 2.0, height: 2.5, depth: 3.5 };
    return { width: 2.0, height: 1.5, depth: 4.0 };
  }
  // Cover
  if (category === "cover") {
    if (f.includes("dumpster")) return { width: 1.5, height: 1.2, depth: 1.0 };
    if (f.includes("barrel")) return { width: 0.5, height: 1.0, depth: 0.5 };
    if (f.includes("hay")) return { width: 1.0, height: 0.8, depth: 1.0 };
    if (f.includes("coffin")) return { width: 0.6, height: 0.5, depth: 2.0 };
    if (f.includes("pallet")) return { width: 1.2, height: 0.15, depth: 1.2 };
    if (f.includes("cone")) return { width: 0.3, height: 0.5, depth: 0.3 };
    if (f.includes("small")) return { width: 0.5, height: 0.5, depth: 0.5 };
    if (f.includes("wide")) return { width: 1.5, height: 0.8, depth: 0.8 };
    if (f.includes("medium")) return { width: 0.8, height: 0.8, depth: 0.8 };
    return { width: 1.0, height: 1.0, depth: 1.0 };
  }
  // Environment
  if (category === "environment") {
    if (f.includes("wall")) return { width: 2.0, height: 2.0, depth: 0.4 };
    if (f.includes("road")) return { width: 2.0, height: 0.1, depth: 2.0 };
    if (f.includes("roof")) return { width: 2.0, height: 0.5, depth: 2.0 };
    if (f.includes("stairs")) return { width: 2.0, height: 2.0, depth: 2.0 };
    if (f.includes("door")) return { width: 1.0, height: 2.0, depth: 0.2 };
    if (f.includes("window")) return { width: 1.0, height: 1.0, depth: 0.2 };
    if (f.includes("scaffold")) return { width: 2.0, height: 3.0, depth: 1.0 };
    if (f.includes("balcony")) return { width: 2.0, height: 1.0, depth: 1.0 };
    if (f.includes("cliff")) return { width: 2.0, height: 2.0, depth: 2.0 };
    if (f.includes("platform")) return { width: 2.0, height: 0.5, depth: 2.0 };
    if (f.includes("floor")) return { width: 2.0, height: 0.1, depth: 2.0 };
    if (f.includes("pillar") || f.includes("column")) return { width: 0.5, height: 2.0, depth: 0.5 };
    if (f.includes("fence")) return { width: 2.0, height: 1.5, depth: 0.1 };
    if (f.includes("crypt-large")) return { width: 3.0, height: 3.0, depth: 3.0 };
    if (f.includes("crypt")) return { width: 2.0, height: 2.0, depth: 2.0 };
    if (f.includes("tower")) return { width: 3.0, height: 5.0, depth: 3.0 };
    if (f.includes("castle")) return { width: 2.0, height: 3.0, depth: 0.5 };
    if (f.includes("plank")) return { width: 2.0, height: 0.1, depth: 1.0 };
    if (f.includes("border")) return { width: 2.0, height: 0.3, depth: 0.3 };
    return { width: 2.0, height: 2.0, depth: 2.0 };
  }
  // Props
  if (category === "props") {
    if (f.includes("ship-large") || f.includes("ship-pirate-large")) return { width: 4.0, height: 6.0, depth: 12.0 };
    if (f.includes("ship-medium") || f.includes("ship-pirate-medium")) return { width: 3.0, height: 4.0, depth: 8.0 };
    if (f.includes("ship")) return { width: 2.0, height: 3.0, depth: 6.0 };
    if (f.includes("boat")) return { width: 1.5, height: 1.0, depth: 3.0 };
    if (f.includes("cannon")) return { width: 0.8, height: 0.8, depth: 1.5 };
    if (f.includes("gravestone") || f.includes("cross")) return { width: 0.5, height: 1.0, depth: 0.2 };
    if (f.includes("fountain")) return { width: 2.0, height: 1.0, depth: 2.0 };
    if (f.includes("stall")) return { width: 2.0, height: 2.0, depth: 1.5 };
    if (f.includes("watermill")) return { width: 3.0, height: 3.0, depth: 3.0 };
    if (f.includes("windmill")) return { width: 2.0, height: 5.0, depth: 2.0 };
    if (f.includes("cart")) return { width: 1.5, height: 1.0, depth: 2.0 };
    if (f.includes("lightpost")) return { width: 0.3, height: 3.0, depth: 0.3 };
    if (f.includes("bench")) return { width: 1.5, height: 0.8, depth: 0.5 };
    if (f.includes("lantern")) return { width: 0.3, height: 0.4, depth: 0.3 };
    if (f.includes("candle")) return { width: 0.1, height: 0.2, depth: 0.1 };
    if (f.includes("pumpkin")) return { width: 0.4, height: 0.4, depth: 0.4 };
    if (f.includes("flag")) return { width: 0.6, height: 2.0, depth: 0.1 };
    if (f.includes("banner")) return { width: 0.6, height: 2.0, depth: 0.1 };
    if (f.includes("target")) return { width: 0.6, height: 1.5, depth: 0.3 };
    if (f.includes("statue")) return { width: 0.8, height: 2.0, depth: 0.8 };
    if (f.includes("chest")) return { width: 0.8, height: 0.5, depth: 0.5 };
    if (f.includes("hedge")) return { width: 1.0, height: 1.0, depth: 0.5 };
    if (f.includes("chimney")) return { width: 0.5, height: 1.0, depth: 0.5 };
    if (f.includes("awning")) return { width: 2.0, height: 0.3, depth: 1.0 };
    if (f.includes("light")) return { width: 0.5, height: 0.5, depth: 0.5 };
    if (f.includes("wheelchair")) return { width: 0.7, height: 1.0, depth: 0.9 };
    if (f.includes("debris")) return { width: 0.5, height: 0.3, depth: 0.5 };
    if (f.includes("wheel")) return { width: 0.6, height: 0.6, depth: 0.2 };
    if (f.includes("cable")) return { width: 2.0, height: 0.5, depth: 0.1 };
    if (f.includes("brick")) return { width: 0.5, height: 0.3, depth: 0.5 };
    if (f.includes("beam")) return { width: 0.2, height: 0.2, depth: 2.0 };
    if (f.includes("scope") || f.includes("silencer") || f.includes("clip")) return { width: 0.1, height: 0.1, depth: 0.3 };
    if (f.includes("bullet")) return { width: 0.05, height: 0.05, depth: 0.1 };
    return { width: 0.5, height: 0.5, depth: 0.5 };
  }
  // Nature
  if (category === "nature") {
    if (f.includes("palm")) return { width: 2.0, height: 4.0, depth: 2.0 };
    if (f.includes("pine") || f.includes("tree-high") || f.includes("tree-large") || f.includes("tree-park")) return { width: 2.0, height: 4.0, depth: 2.0 };
    if (f.includes("tree")) return { width: 1.5, height: 3.0, depth: 1.5 };
    if (f.includes("shrub")) return { width: 1.0, height: 0.8, depth: 1.0 };
    if (f.includes("rock-large") || f.includes("rocks-tall")) return { width: 1.5, height: 1.5, depth: 1.5 };
    if (f.includes("rock")) return { width: 0.8, height: 0.5, depth: 0.8 };
    if (f.includes("trunk-long")) return { width: 0.4, height: 0.4, depth: 3.0 };
    if (f.includes("trunk")) return { width: 0.4, height: 0.4, depth: 1.5 };
    if (f.includes("grass")) return { width: 0.5, height: 0.3, depth: 0.5 };
    if (f.includes("patch")) return { width: 1.0, height: 0.1, depth: 1.0 };
    return { width: 1.0, height: 1.0, depth: 1.0 };
  }
  // Pickups
  if (category === "pickups") {
    if (f.includes("defibrillator")) return { width: 0.3, height: 0.4, depth: 0.1 };
    if (f.includes("trophy")) return { width: 0.3, height: 0.5, depth: 0.3 };
    return { width: 0.2, height: 0.3, depth: 0.2 };
  }
  return { width: 1.0, height: 1.0, depth: 1.0 };
}

// ── Collider type heuristic ─────────────────────────────────────────
function guessCollider(filename, category) {
  const f = filename.toLowerCase();
  if (category === "characters" || category === "enemies") return "capsule";
  if (f.includes("barrel") || f.includes("cone") || f.includes("ball") ||
      f.includes("sphere") || f.includes("round") || f.includes("pumpkin") ||
      f.includes("urn") || f.includes("candle")) return "sphere";
  if (f.includes("tree") || f.includes("pine") || f.includes("palm") ||
      f.includes("pillar") || f.includes("column") || f.includes("post") ||
      f.includes("lightpost") || f.includes("pole")) return "capsule";
  return "box";
}

// ── Human-readable name from filename ───────────────────────────────
function generateName(filename) {
  return filename
    .replace(/\.glb$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── ID from filename: snake_case ────────────────────────────────────
function generateId(filename) {
  return filename.replace(/\.glb$/, "").replace(/-/g, "_");
}

// ── Build catalog ───────────────────────────────────────────────────
const catalog = {
  meta: {
    version: "2.0",
    description:
      "Asset catalog for Otherside Web Worldbuilder. The AI reads this to know which 3D models are available when generating game specs.",
  },
  assets: {},
};

let total = 0;
for (const category of CATEGORIES) {
  const dir = path.join(ASSETS_DIR, category);
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".glb")).sort();
  } catch {
    files = [];
  }

  const categoryAssets = {};
  for (const file of files) {
    const id = generateId(file);
    categoryAssets[id] = {
      id,
      file: `models/${category}/${file}`,
      name: generateName(file),
      tags: generateTags(file, category),
      category,
      defaultScale: 1.0,
      colliderType: guessCollider(file, category),
      dimensions: guessDimensions(file, category),
    };
    total++;
  }
  catalog.assets[category] = categoryAssets;
}

// ── Backward compatibility aliases ──────────────────────────────────
// The old catalog used kenney_ prefixed IDs. Add aliases so layout templates
// and shooter prompts that reference old IDs still work.
const ALIASES = {
  // Old enemies → now in characters category
  kenney_soldier:          { sourceId: "character_soldier",   category: "enemies" },
  kenney_enemy_flying:     { sourceId: "enemy_flying",        category: "enemies" },
  // Old weapons
  kenney_blaster:          { sourceId: "blaster",             category: "weapons" },
  kenney_blaster_repeater: { sourceId: "blaster_repeater",    category: "weapons" },
  kenney_sword:            { sourceId: "weapon_sword",        category: "weapons" },
  kenney_spear:            { sourceId: "weapon_spear",        category: "weapons" },
  kenney_weapon_rack:      { sourceId: "weapon_rack",         category: "weapons" },
  // Old cover → now in props or cover
  kenney_block:            { sourceId: "block",               category: "cover" },
  kenney_bricks:           { sourceId: "bricks",              category: "cover" },
  kenney_column:           { sourceId: "column",              category: "cover" },
  kenney_column_damaged:   { sourceId: "column_damaged",      category: "cover" },
  kenney_wall_low:         { sourceId: "wall_low",            category: "cover" },
  // Old pickups
  kenney_trophy:           { sourceId: "trophy",              category: "pickups" },
  // Old environment
  kenney_floor:            { sourceId: "floor",               category: "environment" },
  kenney_floor_detail:     { sourceId: "floor_detail",        category: "environment" },
  kenney_wall:             { sourceId: "wall",                category: "environment" },
  kenney_wall_corner:      { sourceId: "wall_corner",         category: "environment" },
  kenney_wall_gate:        { sourceId: "wall_gate",           category: "environment" },
  kenney_wall_high:        { sourceId: "wall_high",           category: "environment" },
  kenney_border_straight:  { sourceId: "border_straight",     category: "environment" },
  kenney_border_corner:    { sourceId: "border_corner",       category: "environment" },
  kenney_stairs:           { sourceId: "stairs",              category: "environment" },
  kenney_stairs_corner:    { sourceId: "stairs_corner",       category: "environment" },
  kenney_stairs_corner_inner: { sourceId: "stairs_corner_inner", category: "environment" },
  kenney_platform:         { sourceId: "platform",            category: "environment" },
  kenney_platform_grass:   { sourceId: "platform_large_grass", category: "environment" },
  kenney_cloud:            { sourceId: "cloud",               category: "environment" },
  kenney_grass:            { sourceId: "grass",               category: "environment" },
  kenney_grass_small:      { sourceId: "grass_small",         category: "environment" },
  // Old props
  kenney_banner:           { sourceId: "banner",              category: "props" },
  kenney_statue:           { sourceId: "statue",              category: "props" },
  kenney_tree:             { sourceId: "tree",                category: "props" },
};

let aliasCount = 0;
for (const [aliasId, { sourceId, category: aliasCat }] of Object.entries(ALIASES)) {
  // Find source entry across all categories
  let source = null;
  for (const catAssets of Object.values(catalog.assets)) {
    if (sourceId in catAssets) { source = catAssets[sourceId]; break; }
  }
  if (!source) {
    console.warn(`  alias "${aliasId}" → "${sourceId}" — source NOT FOUND, skipping`);
    continue;
  }
  // Add alias entry in the target category
  catalog.assets[aliasCat][aliasId] = {
    ...source,
    id: aliasId,
    category: aliasCat,
  };
  aliasCount++;
}

writeFileSync(OUTPUT, JSON.stringify(catalog, null, 2) + "\n");
console.log(`Wrote ${total} assets + ${aliasCount} aliases to ${OUTPUT}`);
for (const [cat, assets] of Object.entries(catalog.assets)) {
  console.log(`  ${cat}: ${Object.keys(assets).length}`);
}
