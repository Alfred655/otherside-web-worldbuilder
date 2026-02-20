// ---------------------------------------------------------------------------
// Asset Catalog — types and helpers for the 3D asset registry
// ---------------------------------------------------------------------------

export interface AssetEntry {
  id: string;
  file: string;           // relative path from assets/ e.g. "models/crate_01.glb"
  name: string;           // human readable name
  tags: string[];         // searchable tags e.g. ["cover", "wood", "destructible"]
  category: "enemies" | "weapons" | "cover" | "pickups" | "environment" | "props";
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
    enemies: Record<string, AssetEntry>;
    weapons: Record<string, AssetEntry>;
    cover: Record<string, AssetEntry>;
    pickups: Record<string, AssetEntry>;
    environment: Record<string, AssetEntry>;
    props: Record<string, AssetEntry>;
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

/** Generate a summary of available assets for the AI system prompt */
export function generateAssetSummaryForAI(catalog: AssetCatalog): string {
  const lines: string[] = ["## Available 3D Assets", ""];

  for (const [categoryName, categoryAssets] of Object.entries(catalog.assets)) {
    const entries = Object.values(categoryAssets) as AssetEntry[];
    if (entries.length === 0) continue;

    lines.push(`### ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}`);
    for (const asset of entries) {
      lines.push(`- **${asset.id}**: ${asset.name} (tags: ${asset.tags.join(", ")})`);
    }
    lines.push("");
  }

  if (lines.length <= 2) {
    lines.push("No assets available. Use primitive shapes as fallback.");
  }

  lines.push("");
  lines.push("When generating specs, use assetId to reference these assets.");
  lines.push("If no suitable asset exists, omit assetId and the engine will use primitive shapes.");

  return lines.join("\n");
}
