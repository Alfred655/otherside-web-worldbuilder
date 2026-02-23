// ---------------------------------------------------------------------------
// Asset Catalog — types and helpers for the 3D asset registry
// ---------------------------------------------------------------------------

import { generateThemeMatchingRules } from "./asset-matching.js";

export interface AssetEntry {
  id: string;
  file: string;           // relative path from assets/ e.g. "models/crate_01.glb"
  name: string;           // human readable name
  tags: string[];         // searchable tags e.g. ["cover", "wood", "destructible"]
  category: "characters" | "enemies" | "weapons" | "cover" | "pickups" | "environment" | "props" | "vehicles" | "nature";
  defaultScale: number;   // default scale when placed in world
  colliderType: "box" | "capsule" | "sphere" | "mesh"; // physics collider shape
  dimensions?: {          // approximate size in meters
    width: number;
    height: number;
    depth: number;
  };
  animations?: string[];  // list of animation names if rigged
  thumbnail?: string;     // path to thumbnail image
}

export interface AssetCatalog {
  meta: {
    version: string;
    description: string;
  };
  assets: {
    characters: Record<string, AssetEntry>;
    enemies: Record<string, AssetEntry>;
    weapons: Record<string, AssetEntry>;
    cover: Record<string, AssetEntry>;
    pickups: Record<string, AssetEntry>;
    environment: Record<string, AssetEntry>;
    props: Record<string, AssetEntry>;
    vehicles: Record<string, AssetEntry>;
    nature: Record<string, AssetEntry>;
  };
}

/** Get all assets as a flat array */
export function getAllAssets(catalog: AssetCatalog): AssetEntry[] {
  return Object.values(catalog.assets).flatMap(category => Object.values(category));
}

/** Find asset by ID across all categories */
export function findAssetById(catalog: AssetCatalog, id: string): AssetEntry | undefined {
  for (const category of Object.values(catalog.assets)) {
    if (id in category) return category[id];
  }
  return undefined;
}

/** Find assets by tag */
export function findAssetsByTag(catalog: AssetCatalog, tag: string): AssetEntry[] {
  return getAllAssets(catalog).filter(asset => asset.tags.includes(tag));
}

/** Find assets by category */
export function findAssetsByCategory(
  catalog: AssetCatalog,
  category: keyof AssetCatalog["assets"],
): AssetEntry[] {
  return Object.values(catalog.assets[category]);
}

/** Category labels for AI readability */
const CATEGORY_LABELS: Record<string, string> = {
  characters: "CHARACTERS (for player models and friendly NPCs)",
  enemies: "ENEMIES (for hostile NPCs and monsters)",
  weapons: "WEAPONS (guns, blasters, melee weapons)",
  cover: "COVER (crates, barrels, barriers, dumpsters — objects that block bullets)",
  pickups: "PICKUPS (health items, collectibles, powerups)",
  environment: "ENVIRONMENT (walls, floors, doors, stairs, roads, roofs, fences, platforms)",
  props: "PROPS (decorations, furniture, gravestones, ships, flags, lights, fountains)",
  vehicles: "VEHICLES (cars, trucks, emergency vehicles, karts)",
  nature: "NATURE (trees, rocks, grass, palms, bushes)",
};

/** Generate a summary of available assets for the AI system prompt */
export function generateAssetSummaryForAI(catalog: AssetCatalog): string {
  const lines: string[] = [
    "AVAILABLE 3D ASSETS (use these assetId values in specs):",
    "",
  ];

  for (const [categoryName, categoryAssets] of Object.entries(catalog.assets)) {
    const entries = Object.values(categoryAssets) as AssetEntry[];
    if (entries.length === 0) continue;

    const label = CATEGORY_LABELS[categoryName] ?? categoryName.toUpperCase();
    lines.push(label + ":");
    for (const asset of entries) {
      const dim = asset.dimensions;
      const dimStr = dim ? `, ${dim.width}x${dim.height}x${dim.depth}m` : "";
      lines.push(`- ${asset.id}: ${asset.name} (tags: ${asset.tags.join(", ")}${dimStr})`);
    }
    lines.push("");
  }

  if (lines.length <= 2) {
    lines.push("No assets available. Use primitive shapes as fallback.");
    lines.push("");
  }

  lines.push("ASSET USAGE RULES:");
  lines.push("- When generating a game spec, ALWAYS reference real assets from the catalog by their assetId.");
  lines.push("- Pick assets that match the theme. Military theme uses sandbags and concrete barriers. Warehouse theme uses wooden crates and barrels. Fantasy theme uses medieval props.");
  lines.push("- For enemies, always assign a character or enemy model assetId. Never leave enemies without a model.");
  lines.push("- For cover objects, always use a real cover asset. Pick varied assets, not the same crate repeated 20 times.");
  lines.push("- For environment pieces, use floor and wall assets that match the theme.");
  lines.push("- For decorative props, pick 3-8 props that fit the theme and place them in zones.");
  lines.push("- If you need something that does not exist in the catalog, describe it in the mesh field and the engine will use a primitive fallback. But prefer real assets whenever possible.");
  lines.push("- VARIETY: never use the same asset more than 5 times in a single arena. Mix different crate sizes, different barrel types, different prop models.");
  lines.push("");
  lines.push(generateThemeMatchingRules());

  return lines.join("\n");
}
