// ---------------------------------------------------------------------------
// Semantic Asset Matching — maps vague user language to the best catalog asset
// ---------------------------------------------------------------------------

import type { AssetCatalog, AssetEntry } from "./asset-catalog.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AssetMatch {
  asset: AssetEntry;
  score: number;
}

export interface ThemePreset {
  name: string;
  keywords: string[];
  preferences: Partial<Record<AssetCategory, string[]>>;
  preferredAssets: Partial<Record<AssetCategory, string[]>>;
}

type AssetCategory = keyof AssetCatalog["assets"];

// ── Semantic Tag Map ───────────────────────────────────────────────────────
// Maps user vocabulary (what they type) → catalog tags (what assets have)

export const SEMANTIC_TAG_MAP: Record<string, string[]> = {
  // Objects — cover & containers
  box: ["crate", "box", "container", "storage"],
  crate: ["crate", "container", "wood", "storage"],
  barrel: ["barrel", "container", "round"],
  drum: ["barrel", "container", "round"],
  cargo: ["crate", "container", "storage"],
  container: ["container", "crate", "storage"],
  pallet: ["pallet", "wood", "industrial"],
  dumpster: ["dumpster", "trash", "urban"],
  trash: ["dumpster", "trash"],
  coffin: ["coffin", "graveyard", "spooky"],
  hay: ["hay", "farm", "rural"],
  sandbag: ["barrier", "blockade", "military"],
  barricade: ["barrier", "blockade"],
  barrier: ["barrier", "blockade"],
  fence: ["fence", "structure"],
  wall: ["wall", "barrier", "structure"],
  cone: ["traffic", "cone", "urban"],

  // Nature
  tree: ["tree", "foliage", "vegetation"],
  forest: ["tree", "foliage", "vegetation"],
  woods: ["tree", "foliage", "vegetation"],
  rock: ["rock", "stone"],
  boulder: ["rock", "stone"],
  stone: ["stone", "rock"],
  bush: ["shrub", "hedge", "vegetation"],
  shrub: ["shrub", "hedge", "vegetation"],
  hedge: ["hedge", "vegetation"],
  grass: ["grass", "vegetation"],
  palm: ["palm", "tropical"],
  pine: ["pine", "tree"],
  plant: ["vegetation", "foliage"],

  // Characters & enemies
  soldier: ["soldier", "military", "armed"],
  guard: ["soldier", "military", "guard"],
  troop: ["soldier", "military"],
  warrior: ["soldier", "armed", "melee"],
  zombie: ["zombie", "undead", "slow"],
  undead: ["undead", "zombie", "skeleton"],
  walker: ["zombie", "undead"],
  skeleton: ["skeleton", "undead", "bones"],
  ghost: ["ghost", "undead", "spooky", "floating"],
  vampire: ["vampire", "undead", "fast"],
  monster: ["undead", "melee"],
  creature: ["undead", "melee"],
  robot: ["drone", "sci-fi"],
  drone: ["flying", "drone", "aerial"],
  mech: ["drone", "sci-fi"],
  flying: ["flying", "aerial", "drone"],
  keeper: ["keeper", "graveyard", "guard"],
  criminal: ["male", "man"],
  cyborg: ["female", "sci-fi"],
  survivor: ["male", "female"],
  skater: ["male", "female"],

  // Vehicles
  car: ["car", "civilian"],
  truck: ["truck", "large", "commercial"],
  van: ["van", "civilian"],
  taxi: ["taxi", "civilian"],
  ambulance: ["ambulance", "emergency", "medical"],
  police: ["police", "emergency", "law"],
  firetruck: ["firetruck", "emergency", "fire"],
  kart: ["kart", "small", "racing"],
  tractor: ["tractor", "heavy", "industrial"],
  suv: ["suv", "car", "civilian"],
  sedan: ["sedan", "car", "civilian"],
  racer: ["race", "fast", "sports"],

  // Props & decoration
  furniture: ["decoration", "bench"],
  desk: ["decoration", "furniture"],
  table: ["decoration", "furniture"],
  bench: ["bench", "seat"],
  column: ["column", "pillar"],
  pillar: ["column", "pillar"],
  lantern: ["lantern", "light"],
  lamp: ["lantern", "light"],
  light: ["light", "lantern"],
  cannon: ["cannon", "weapon"],
  flag: ["flag", "banner"],
  banner: ["banner", "flag"],
  fountain: ["fountain", "water"],
  statue: ["statue", "decoration"],
  gravestone: ["gravestone", "grave", "graveyard"],
  tombstone: ["gravestone", "grave", "graveyard"],
  grave: ["grave", "graveyard", "death"],
  cross: ["cross", "graveyard"],
  pumpkin: ["pumpkin", "spooky"],
  ship: ["ship", "pirate", "nautical"],
  boat: ["boat", "pirate", "nautical"],
  chest: ["chest", "treasure", "pirate"],
  cart: ["cart", "wheel"],
  stall: ["stall", "market"],
  windmill: ["windmill", "farm"],
  watermill: ["watermill", "water"],

  // Theme mood words
  dark: ["spooky", "graveyard", "death"],
  spooky: ["spooky", "graveyard", "death", "undead"],
  horror: ["spooky", "graveyard", "death", "undead"],
  scary: ["spooky", "graveyard", "death", "undead"],
  creepy: ["spooky", "graveyard", "death", "undead"],
  haunted: ["spooky", "graveyard", "death", "undead"],
  military: ["military", "soldier", "armed", "barrier"],
  army: ["military", "soldier", "armed"],
  combat: ["military", "armed", "weapon"],
  scifi: ["sci-fi", "blaster", "drone"],
  futuristic: ["sci-fi", "modern", "metal"],
  space: ["sci-fi", "blaster", "drone"],
  medieval: ["fantasy", "medieval", "stone"],
  fantasy: ["fantasy", "medieval", "stone"],
  castle: ["fantasy", "medieval", "castle"],
  pirate: ["pirate", "nautical", "ship"],
  nautical: ["pirate", "nautical"],
  warehouse: ["crate", "industrial", "storage"],
  factory: ["industrial", "metal", "crate"],
  industrial: ["industrial", "metal", "crate"],
  urban: ["urban", "city", "modern"],
  city: ["urban", "city", "modern"],
  farm: ["hay", "farm", "rural"],
  rural: ["hay", "farm", "rural"],
  graveyard: ["graveyard", "spooky", "death", "grave"],
  cemetery: ["graveyard", "spooky", "death", "grave"],
  tropical: ["palm", "tropical", "pirate"],
  beach: ["palm", "tropical", "sand", "pirate"],
  desert: ["sand", "rock", "stone"],
};

// ── Theme Presets ──────────────────────────────────────────────────────────

export const THEME_PRESETS: Record<string, ThemePreset> = {
  military: {
    name: "military",
    keywords: ["military", "army", "soldier", "combat", "war", "battlefield", "bunker", "base"],
    preferences: {
      enemies: ["soldier", "military", "armed"],
      cover: ["barrier", "blockade", "urban", "crate"],
      props: ["urban", "military", "barrel"],
      environment: ["urban", "wall", "structure"],
      vehicles: ["truck", "police", "emergency"],
    },
    preferredAssets: {
      enemies: ["kenney_soldier", "character_soldier", "criminal_male", "survivor_male"],
      cover: ["urban_barrier_strong_type_a", "urban_barrier_strong_type_b", "urban_block", "dumpster_closed", "urban_barrier_type_a", "urban_barrier_type_b"],
      props: ["urban_detail_beam", "urban_detail_bench", "urban_planks"],
      vehicles: ["truck", "police", "urban_truck_grey"],
    },
  },
  horror: {
    name: "horror",
    keywords: ["horror", "scary", "spooky", "dark", "creepy", "haunted", "undead", "graveyard", "cemetery", "nightmare"],
    preferences: {
      enemies: ["zombie", "undead", "skeleton", "ghost", "spooky"],
      cover: ["coffin", "graveyard", "spooky"],
      props: ["graveyard", "grave", "spooky", "death", "pumpkin"],
      environment: ["graveyard", "stone", "iron"],
      nature: ["pine", "rock", "graveyard"],
    },
    preferredAssets: {
      enemies: ["zombie", "skeleton", "ghost", "vampire", "zombie_animated_a", "zombie_animated_c", "zombie_female_animated", "zombie_male_animated"],
      cover: ["coffin", "coffin_old", "hay_bale", "hay_bale_bundled"],
      props: ["graveyard_gravestone_cross_large", "graveyard_gravestone_decorative", "graveyard_fire_basket", "graveyard_pumpkin_carved"],
      nature: ["graveyard_pine_crooked", "graveyard_rocks", "graveyard_trunk"],
    },
  },
  warehouse: {
    name: "warehouse",
    keywords: ["warehouse", "factory", "industrial", "storage", "dock", "loading"],
    preferences: {
      enemies: ["soldier", "armed", "humanoid"],
      cover: ["crate", "container", "wood", "pallet", "industrial"],
      props: ["industrial", "wood", "barrel"],
      environment: ["urban", "wall", "structure"],
    },
    preferredAssets: {
      enemies: ["kenney_soldier", "character_soldier", "criminal_male", "survivor_male"],
      cover: ["crate_medium", "crate_small", "crate_wide", "pallet", "pallet_small", "pirate_barrel", "pirate_crate"],
      props: ["urban_detail_beam", "urban_planks"],
    },
  },
  outdoor: {
    name: "outdoor",
    keywords: ["outdoor", "forest", "woods", "park", "nature", "field", "garden", "jungle"],
    preferences: {
      enemies: ["humanoid", "melee"],
      cover: ["hay", "farm", "rural", "crate"],
      props: ["tree", "vegetation", "rock"],
      nature: ["tree", "rock", "grass", "foliage"],
      environment: ["grass", "dirt"],
    },
    preferredAssets: {
      enemies: ["survivor_male", "survivor_female", "criminal_male"],
      cover: ["hay_bale", "hay_bale_bundled", "crate_medium", "crate_wide"],
      nature: ["urban_tree_large", "urban_tree_park_large", "fantasy_rock_large", "urban_grass"],
    },
  },
  scifi: {
    name: "scifi",
    keywords: ["scifi", "sci-fi", "futuristic", "space", "cyber", "robot", "mech", "neon"],
    preferences: {
      enemies: ["flying", "drone", "sci-fi"],
      cover: ["urban", "barrier", "blockade", "modern"],
      props: ["urban", "modern", "metal"],
      weapons: ["blaster", "sci-fi", "ranged"],
    },
    preferredAssets: {
      enemies: ["kenney_enemy_flying", "cyborg_female", "criminal_male"],
      cover: ["urban_barrier_strong_type_a", "urban_barrier_strong_type_b", "urban_block", "urban_barrier_type_a"],
      weapons: ["blaster_a", "blaster_b", "blaster_c", "blaster_repeater"],
    },
  },
  pirate: {
    name: "pirate",
    keywords: ["pirate", "nautical", "ship", "ocean", "sea", "treasure", "island", "coastal"],
    preferences: {
      enemies: ["skeleton", "undead", "pirate"],
      cover: ["barrel", "crate", "pirate", "nautical"],
      props: ["pirate", "nautical", "ship", "flag"],
      environment: ["pirate", "castle", "platform"],
      nature: ["palm", "tropical", "sand", "rock"],
    },
    preferredAssets: {
      enemies: ["skeleton", "ghost", "graveyard_keeper"],
      cover: ["pirate_barrel", "pirate_crate", "pirate_crate_bottles", "crate_medium"],
      props: ["pirate_cannon", "pirate_chest", "pirate_flag_pirate", "pirate_ship_wreck"],
      nature: ["pirate_palm_detailed_bend", "pirate_palm_straight", "pirate_rocks_a", "pirate_rocks_b"],
    },
  },
  fantasy: {
    name: "fantasy",
    keywords: ["fantasy", "medieval", "castle", "knight", "dragon", "magic", "kingdom", "dungeon"],
    preferences: {
      enemies: ["skeleton", "undead", "melee"],
      cover: ["crate", "wood", "barrel"],
      props: ["fantasy", "medieval", "stone", "fountain"],
      environment: ["fantasy", "medieval", "wall", "stone"],
      nature: ["tree", "rock", "foliage"],
    },
    preferredAssets: {
      enemies: ["skeleton", "vampire", "ghost", "graveyard_keeper"],
      cover: ["crate_medium", "crate_wide", "pirate_barrel", "hay_bale"],
      props: ["fantasy_fountain_round", "fantasy_lantern", "fantasy_banner_red", "fantasy_cart"],
      nature: ["fantasy_tree_high_round", "fantasy_rock_large", "fantasy_tree"],
    },
  },
};

// ── Stopwords ──────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "and",
  "or", "is", "it", "my", "some", "few", "that", "this", "its", "like",
  "be", "are", "was", "has", "have", "from", "by",
]);

// ── detectTheme ────────────────────────────────────────────────────────────

export function detectTheme(text: string): ThemePreset | null {
  const lower = text.toLowerCase();
  let best: ThemePreset | null = null;
  let bestCount = 0;

  for (const preset of Object.values(THEME_PRESETS)) {
    let count = 0;
    for (const kw of preset.keywords) {
      if (lower.includes(kw)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = preset;
    }
  }

  return bestCount > 0 ? best : null;
}

// ── findBestAsset ──────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w))
    .map(w => w.replace(/s$/, "")); // simple plural strip
}

function expandTokens(tokens: string[]): Set<string> {
  const tags = new Set<string>();
  for (const t of tokens) {
    const mapped = SEMANTIC_TAG_MAP[t];
    if (mapped) {
      for (const tag of mapped) tags.add(tag);
    }
    // Also add the raw token as a potential tag
    tags.add(t);
  }
  return tags;
}

function scoreAsset(
  asset: AssetEntry,
  tokens: string[],
  expandedTags: Set<string>,
  theme: ThemePreset | null,
  themeRole: AssetCategory | undefined,
): number {
  let score = 0;
  const assetTags = new Set(asset.tags);

  // +1.0 per expanded tag matching asset tag
  for (const tag of expandedTags) {
    if (assetTags.has(tag)) score += 1.0;
  }

  // +0.5 per original token found in asset name or id
  const idLower = asset.id.toLowerCase();
  const nameLower = asset.name.toLowerCase();
  for (const t of tokens) {
    if (idLower.includes(t) || nameLower.includes(t)) score += 0.5;
  }

  // Theme bonuses
  if (theme) {
    // +0.75 per theme preference tag matching asset tag
    const prefTags = themeRole && theme.preferences[themeRole];
    if (prefTags) {
      for (const pt of prefTags) {
        if (assetTags.has(pt)) score += 0.75;
      }
    }

    // +3.0 if asset is in theme's preferredAssets list
    const preferred = themeRole && theme.preferredAssets[themeRole];
    if (preferred && preferred.includes(asset.id)) {
      score += 3.0;
    }
  }

  return score;
}

export function findBestAsset(
  catalog: AssetCatalog,
  description: string,
  category?: AssetCategory,
  theme?: ThemePreset | null,
): AssetMatch | null {
  const tokens = tokenize(description);
  if (tokens.length === 0) return null;

  const expandedTags = expandTokens(tokens);
  let bestMatch: AssetMatch | null = null;

  const categories = category
    ? [catalog.assets[category]]
    : Object.values(catalog.assets);

  for (const catAssets of categories) {
    for (const asset of Object.values(catAssets) as AssetEntry[]) {
      const s = scoreAsset(asset, tokens, expandedTags, theme ?? null, category);
      if (s > 0 && (!bestMatch || s > bestMatch.score)) {
        bestMatch = { asset, score: s };
      }
    }
  }

  return bestMatch;
}

// ── findBestAssets ─────────────────────────────────────────────────────────

export function findBestAssets(
  catalog: AssetCatalog,
  description: string,
  count: number,
  category?: AssetCategory,
  theme?: ThemePreset | null,
): AssetMatch[] {
  const tokens = tokenize(description);
  if (tokens.length === 0) return [];

  const expandedTags = expandTokens(tokens);
  const matches: AssetMatch[] = [];

  const categories = category
    ? [catalog.assets[category]]
    : Object.values(catalog.assets);

  for (const catAssets of categories) {
    for (const asset of Object.values(catAssets) as AssetEntry[]) {
      const s = scoreAsset(asset, tokens, expandedTags, theme ?? null, category);
      if (s > 0) {
        matches.push({ asset, score: s });
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);

  // Deduplicate by asset id (shouldn't happen normally but just in case)
  const seen = new Set<string>();
  const result: AssetMatch[] = [];
  for (const m of matches) {
    if (!seen.has(m.asset.id) && result.length < count) {
      seen.add(m.asset.id);
      result.push(m);
    }
  }

  return result;
}

// ── generateThemeMatchingRules ─────────────────────────────────────────────

export function generateThemeMatchingRules(): string {
  const lines: string[] = [
    "THEME → ASSET MATCHING GUIDE:",
    "When the user's description suggests a theme, prefer these assets:",
    "",
  ];

  for (const preset of Object.values(THEME_PRESETS)) {
    const kw = preset.keywords.slice(0, 4).join(", ");
    lines.push(`${preset.name.toUpperCase()} (keywords: ${kw}):`);

    for (const [role, ids] of Object.entries(preset.preferredAssets)) {
      if (ids && ids.length > 0) {
        lines.push(`  ${role}: ${ids.slice(0, 4).join(", ")}`);
      }
    }
    lines.push("");
  }

  lines.push("Priority: theme-preferred assets > literal description match > any category match.");
  lines.push("Always pick 3-5 DIFFERENT cover assets per arena for variety. Max 4 reuses of any single asset.");
  return lines.join("\n");
}

// ── mapEntityTypeToCategory ────────────────────────────────────────────────

export function mapEntityTypeToCategory(
  entityType: string,
): AssetCategory | undefined {
  switch (entityType) {
    case "npc":
      return "enemies";
    case "prop":
      return "cover";
    case "collectible":
      return "pickups";
    case "projectile":
      return undefined;
    case "trigger":
      return undefined;
    default:
      return undefined;
  }
}
