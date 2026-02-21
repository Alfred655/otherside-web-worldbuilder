import type { LayoutTemplateDef } from "./types.js";

/**
 * Bunker — Military base (26-34m × 22-30m)
 *
 * Layout: Interior partition walls (kenney_wall_low) creating command area
 * and supply room. Sandbag positions, command table area, supply crates.
 * Multiple entry points, defensible positions.
 */
export const bunkerTemplate: LayoutTemplateDef = {
  id: "bunker",
  name: "Bunker",
  description: "Military base with sandbags, command area, and supply room",
  recommendedSize: { minX: 26, maxX: 34, minZ: 22, maxZ: 30 },
  playerSpawn: { nx: 0.5, nz: 0.88 },

  coverClusters: [
    // Sandbag position (forward left) — bricks in L-shape
    {
      id: "sandbag-left",
      anchor: { nx: 0.25, nz: 0.55 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_bricks", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_bricks", rotY: 0 },
        { dx: 0, dz: 0.8, assetId: "kenney_bricks", rotY: Math.PI / 2 },
      ],
    },
    // Sandbag position (forward right) — bricks in L-shape mirrored
    {
      id: "sandbag-right",
      anchor: { nx: 0.75, nz: 0.55 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_bricks", rotY: 0 },
        { dx: -1.2, dz: 0, assetId: "kenney_bricks", rotY: 0 },
        { dx: 0, dz: 0.8, assetId: "kenney_bricks", rotY: Math.PI / 2 },
      ],
    },
    // Command table area — blocks forming desk-like structure
    {
      id: "command-table",
      anchor: { nx: 0.3, nz: 0.22 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 2.4, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 0.6, dz: 1.2, assetId: "kenney_bricks", rotY: 0 },
      ],
    },
    // Supply crates (NE corner)
    {
      id: "supply-crates",
      anchor: { nx: 0.8, nz: 0.2 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_block", rotY: 0.2 },
        { dx: 0.6, dz: 1.2, assetId: "kenney_block", rotY: 0 },
      ],
    },
    // Entry corridor cover — defensive position near south entrance
    {
      id: "entry-cover",
      anchor: { nx: 0.5, nz: 0.72 },
      rotation: 0,
      pieces: [
        { dx: -1, dz: 0, assetId: "kenney_wall_low", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_wall_low", rotY: 0 },
      ],
    },
    // Center corridor column pair
    {
      id: "center-columns",
      anchor: { nx: 0.5, nz: 0.42 },
      rotation: 0,
      pieces: [
        { dx: -2, dz: 0, assetId: "kenney_column", rotY: 0 },
        { dx: 2, dz: 0, assetId: "kenney_column", rotY: 0 },
      ],
    },
  ],

  wallLines: [
    // Command area partition (NW) — separates command room
    {
      id: "command-partition",
      start: { nx: 0.12, nz: 0.38 },
      end: { nx: 0.45, nz: 0.38 },
      assetId: "kenney_wall_low",
      gaps: [0.7],
    },
    // Supply room partition (NE) — separates supply room
    {
      id: "supply-partition",
      start: { nx: 0.55, nz: 0.38 },
      end: { nx: 0.88, nz: 0.38 },
      assetId: "kenney_wall_low",
      gaps: [0.3],
    },
    // Center divider — partial wall creating entry funnel
    {
      id: "center-divider",
      start: { nx: 0.4, nz: 0.62 },
      end: { nx: 0.6, nz: 0.62 },
      assetId: "kenney_wall_low",
      gaps: [0.5],
    },
  ],

  decorations: [
    { nx: 0.15, nz: 0.12, rotation: 0, assetId: "kenney_banner", themeTags: ["military"] },
    { nx: 0.85, nz: 0.12, rotation: 0, assetId: "kenney_banner", themeTags: ["military"] },
    { nx: 0.5, nz: 0.12, rotation: 0, assetId: "kenney_banner", themeTags: ["military"] },
  ],

  zones: [
    { region: "south", defaultType: "spawn_area", cx: 0.5, cz: 0.88, width: 0.3, depth: 0.2 },
    { region: "center", defaultType: "open_combat", cx: 0.5, cz: 0.55, width: 0.4, depth: 0.2 },
    { region: "northwest", defaultType: "cover_heavy", cx: 0.3, cz: 0.22, width: 0.35, depth: 0.25 },
    { region: "northeast", defaultType: "supply_cache", cx: 0.8, cz: 0.2, width: 0.25, depth: 0.25 },
    { region: "west", defaultType: "cover_light", cx: 0.25, cz: 0.55, width: 0.2, depth: 0.2 },
    { region: "east", defaultType: "cover_light", cx: 0.75, cz: 0.55, width: 0.2, depth: 0.2 },
  ],

  enemyHints: [
    {
      region: "northwest",
      offsets: [{ nx: 0.28, nz: 0.2 }, { nx: 0.35, nz: 0.25 }],
      preferredAI: ["guard", "patrol"],
      capacity: 3,
    },
    {
      region: "northeast",
      offsets: [{ nx: 0.78, nz: 0.18 }, { nx: 0.82, nz: 0.22 }],
      preferredAI: ["guard"],
      capacity: 2,
    },
    {
      region: "center",
      offsets: [{ nx: 0.5, nz: 0.52 }, { nx: 0.45, nz: 0.58 }],
      preferredAI: ["patrol", "wander"],
      capacity: 3,
    },
    {
      region: "west",
      offsets: [{ nx: 0.22, nz: 0.55 }],
      preferredAI: ["guard"],
      capacity: 2,
    },
  ],

  pickupHints: [
    { region: "northeast", nx: 0.82, nz: 0.18, preferredTypes: ["weapon", "ammo"] },
    { region: "northwest", nx: 0.2, nz: 0.22, preferredTypes: ["ammo"] },
    { region: "center", nx: 0.5, nz: 0.5, preferredTypes: ["health"] },
    { region: "east", nx: 0.8, nz: 0.58, preferredTypes: ["health", "armor"] },
  ],

  lanes: [
    // South entry to command area
    { from: { nx: 0.5, nz: 0.88 }, to: { nx: 0.5, nz: 0.15 }, width: 3 },
    // West flank
    { from: { nx: 0.15, nz: 0.85 }, to: { nx: 0.15, nz: 0.15 }, width: 2.5 },
    // East flank
    { from: { nx: 0.85, nz: 0.85 }, to: { nx: 0.85, nz: 0.15 }, width: 2.5 },
    // Cross lane at sandbag line
    { from: { nx: 0.15, nz: 0.55 }, to: { nx: 0.85, nz: 0.55 }, width: 2.5 },
  ],
};
