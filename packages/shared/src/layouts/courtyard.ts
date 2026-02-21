import type { LayoutTemplateDef } from "./types.js";

/**
 * Courtyard — Open center (28-38m × 28-38m), square-ish
 *
 * Layout: L-shaped building walls on N+E sides (kenney_wall_high) with gate gaps.
 * Center statue landmark, crate stacks in corners, barrel positions, tree cover.
 */
export const courtyardTemplate: LayoutTemplateDef = {
  id: "courtyard",
  name: "Courtyard",
  description: "Open center with landmark, L-shaped building walls, and corner cover",
  recommendedSize: { minX: 28, maxX: 38, minZ: 28, maxZ: 38 },
  playerSpawn: { nx: 0.2, nz: 0.8 },

  coverClusters: [
    // Center statue cluster — statue + 2 brick walls for cover
    {
      id: "center-statue",
      anchor: { nx: 0.5, nz: 0.5 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_column", rotY: 0 },
        { dx: -1.5, dz: 1, assetId: "kenney_bricks", rotY: 0 },
        { dx: 1.5, dz: -1, assetId: "kenney_bricks", rotY: 0 },
      ],
    },
    // NW crate stack — 3 blocks
    {
      id: "nw-crates",
      anchor: { nx: 0.2, nz: 0.25 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_block", rotY: 0.3 },
        { dx: 0.6, dz: 1.2, assetId: "kenney_block", rotY: 0 },
      ],
    },
    // SE barrel position — 2 blocks near building corner
    {
      id: "se-barrels",
      anchor: { nx: 0.78, nz: 0.72 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_block", rotY: 0.5 },
        { dx: 1.3, dz: 0.3, assetId: "kenney_block", rotY: 0 },
      ],
    },
    // South tree line — 2 columns (represent decorative cover)
    {
      id: "south-trees",
      anchor: { nx: 0.45, nz: 0.78 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_column", rotY: 0 },
        { dx: 3, dz: 0, assetId: "kenney_column", rotY: 0 },
      ],
    },
    // NE defensive position — wall_low + block
    {
      id: "ne-defense",
      anchor: { nx: 0.75, nz: 0.2 },
      rotation: Math.PI / 4,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_wall_low", rotY: 0 },
        { dx: 2.2, dz: 0.5, assetId: "kenney_block", rotY: 0 },
      ],
    },
    // West cover — bricks forming low barricade
    {
      id: "west-barricade",
      anchor: { nx: 0.15, nz: 0.5 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_bricks", rotY: Math.PI / 2 },
        { dx: 0, dz: 1.2, assetId: "kenney_bricks", rotY: Math.PI / 2 },
        { dx: 0.8, dz: 0.6, assetId: "kenney_block", rotY: 0 },
      ],
    },
  ],

  wallLines: [
    // North building wall
    {
      id: "north-building",
      start: { nx: 0.35, nz: 0.12 },
      end: { nx: 0.88, nz: 0.12 },
      assetId: "kenney_wall_high",
      gaps: [0.5],
    },
    // East building wall (continuing from north wall)
    {
      id: "east-building",
      start: { nx: 0.88, nz: 0.12 },
      end: { nx: 0.88, nz: 0.65 },
      assetId: "kenney_wall_high",
      gaps: [0.55],
    },
  ],

  decorations: [
    { nx: 0.12, nz: 0.3, rotation: 0, assetId: "kenney_tree", themeTags: ["outdoor"] },
    { nx: 0.3, nz: 0.88, rotation: 0, assetId: "kenney_tree", themeTags: ["outdoor"] },
    { nx: 0.7, nz: 0.88, rotation: 0.5, assetId: "kenney_tree", themeTags: ["outdoor"] },
    { nx: 0.5, nz: 0.12, rotation: 0, assetId: "kenney_banner", themeTags: ["medieval"] },
  ],

  zones: [
    { region: "southwest", defaultType: "spawn_area", cx: 0.2, cz: 0.8, width: 0.3, depth: 0.3 },
    { region: "center", defaultType: "landmark", cx: 0.5, cz: 0.5, width: 0.3, depth: 0.3 },
    { region: "northwest", defaultType: "cover_heavy", cx: 0.2, cz: 0.25, width: 0.3, depth: 0.3 },
    { region: "northeast", defaultType: "cover_light", cx: 0.75, cz: 0.2, width: 0.3, depth: 0.25 },
    { region: "east", defaultType: "sniper_perch", cx: 0.85, cz: 0.4, width: 0.2, depth: 0.3 },
    { region: "south", defaultType: "open_combat", cx: 0.5, cz: 0.75, width: 0.4, depth: 0.2 },
    { region: "southeast", defaultType: "supply_cache", cx: 0.78, cz: 0.72, width: 0.2, depth: 0.2 },
  ],

  enemyHints: [
    {
      region: "northeast",
      offsets: [{ nx: 0.75, nz: 0.22 }, { nx: 0.8, nz: 0.18 }],
      preferredAI: ["guard", "patrol"],
      capacity: 3,
    },
    {
      region: "center",
      offsets: [{ nx: 0.52, nz: 0.48 }, { nx: 0.48, nz: 0.52 }],
      preferredAI: ["wander", "patrol"],
      capacity: 3,
    },
    {
      region: "east",
      offsets: [{ nx: 0.86, nz: 0.38 }],
      preferredAI: ["guard"],
      capacity: 2,
    },
    {
      region: "northwest",
      offsets: [{ nx: 0.22, nz: 0.28 }],
      preferredAI: ["patrol", "wander"],
      capacity: 2,
    },
  ],

  pickupHints: [
    { region: "northwest", nx: 0.18, nz: 0.22, preferredTypes: ["ammo"] },
    { region: "center", nx: 0.5, nz: 0.55, preferredTypes: ["health"] },
    { region: "southeast", nx: 0.8, nz: 0.75, preferredTypes: ["weapon", "ammo"] },
    { region: "east", nx: 0.88, nz: 0.5, preferredTypes: ["health", "armor"] },
  ],

  lanes: [
    // SW to NW lane (west side)
    { from: { nx: 0.2, nz: 0.8 }, to: { nx: 0.2, nz: 0.2 }, width: 3 },
    // SW to SE lane (south)
    { from: { nx: 0.2, nz: 0.78 }, to: { nx: 0.8, nz: 0.78 }, width: 3 },
    // Center cross lanes
    { from: { nx: 0.15, nz: 0.5 }, to: { nx: 0.85, nz: 0.5 }, width: 3 },
    { from: { nx: 0.5, nz: 0.15 }, to: { nx: 0.5, nz: 0.85 }, width: 3 },
  ],
};
