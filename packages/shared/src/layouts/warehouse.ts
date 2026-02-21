import type { LayoutTemplateDef } from "./types.js";

/**
 * Warehouse — Indoor 3-lane arena (25-35m × 20-28m)
 *
 * Layout: Two lengthwise wall_low dividers create 3 parallel lanes.
 * Each divider has 1-2 gaps for cross-movement.
 * Cover clusters at lane intersections, office corner, loading dock.
 */
export const warehouseTemplate: LayoutTemplateDef = {
  id: "warehouse",
  name: "Warehouse",
  description: "Indoor 3-lane arena with shelving rows, office corner, and loading dock",
  recommendedSize: { minX: 25, maxX: 35, minZ: 20, maxZ: 28 },
  playerSpawn: { nx: 0.15, nz: 0.85 },

  coverClusters: [
    // Lane intersection cluster (center-left) — 2 crates + 1 low wall forming cover position
    {
      id: "lane-intersection-1",
      anchor: { nx: 0.35, nz: 0.5 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 0.6, dz: 1.2, assetId: "kenney_wall_low", rotY: Math.PI / 2 },
      ],
    },
    // Lane intersection cluster (center-right) — crate pair
    {
      id: "lane-intersection-2",
      anchor: { nx: 0.65, nz: 0.5 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 0, dz: 1.2, assetId: "kenney_block", rotY: 0 },
        { dx: -1.2, dz: 0.6, assetId: "kenney_bricks", rotY: 0 },
      ],
    },
    // Office corner (NW) — L-shaped cover with blocks and low wall
    {
      id: "office-corner",
      anchor: { nx: 0.15, nz: 0.2 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_wall_low", rotY: 0 },
        { dx: 2.2, dz: 0, assetId: "kenney_wall_low", rotY: 0 },
        { dx: 4.2, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 0, dz: 0.7, assetId: "kenney_wall_low", rotY: Math.PI / 2 },
      ],
    },
    // Loading dock (NE) — block cluster
    {
      id: "loading-dock",
      anchor: { nx: 0.82, nz: 0.2 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 0, dz: 1.2, assetId: "kenney_block", rotY: 0 },
        { dx: 1.2, dz: 1.2, assetId: "kenney_bricks", rotY: 0 },
      ],
    },
    // South entry cover — small barricade near player spawn
    {
      id: "south-entry",
      anchor: { nx: 0.4, nz: 0.78 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_bricks", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_bricks", rotY: 0 },
      ],
    },
    // East corridor cover
    {
      id: "east-corridor",
      anchor: { nx: 0.85, nz: 0.6 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_column", rotY: 0 },
        { dx: 0, dz: 2.5, assetId: "kenney_column", rotY: 0 },
      ],
    },
  ],

  wallLines: [
    // Left divider wall (creates left/center lane boundary)
    {
      id: "divider-left",
      start: { nx: 0.33, nz: 0.15 },
      end: { nx: 0.33, nz: 0.85 },
      assetId: "kenney_wall_low",
      gaps: [0.35, 0.7],
    },
    // Right divider wall (creates center/right lane boundary)
    {
      id: "divider-right",
      start: { nx: 0.67, nz: 0.15 },
      end: { nx: 0.67, nz: 0.85 },
      assetId: "kenney_wall_low",
      gaps: [0.4, 0.75],
    },
  ],

  decorations: [
    { nx: 0.1, nz: 0.1, rotation: 0, assetId: "kenney_banner", themeTags: ["indoor", "industrial"] },
    { nx: 0.9, nz: 0.1, rotation: Math.PI, assetId: "kenney_banner", themeTags: ["indoor", "industrial"] },
  ],

  zones: [
    { region: "southwest", defaultType: "spawn_area", cx: 0.15, cz: 0.85, width: 0.3, depth: 0.3 },
    { region: "northwest", defaultType: "cover_heavy", cx: 0.15, cz: 0.2, width: 0.3, depth: 0.35 },
    { region: "center", defaultType: "open_combat", cx: 0.5, cz: 0.5, width: 0.3, depth: 0.4 },
    { region: "northeast", defaultType: "supply_cache", cx: 0.82, cz: 0.2, width: 0.3, depth: 0.3 },
    { region: "east", defaultType: "cover_light", cx: 0.85, cz: 0.5, width: 0.2, depth: 0.4 },
    { region: "south", defaultType: "cover_light", cx: 0.5, cz: 0.8, width: 0.3, depth: 0.2 },
  ],

  enemyHints: [
    {
      region: "northwest",
      offsets: [{ nx: 0.18, nz: 0.22 }, { nx: 0.12, nz: 0.28 }],
      preferredAI: ["guard", "patrol"],
      capacity: 3,
    },
    {
      region: "center",
      offsets: [{ nx: 0.5, nz: 0.45 }, { nx: 0.45, nz: 0.55 }],
      preferredAI: ["patrol", "wander"],
      capacity: 3,
    },
    {
      region: "northeast",
      offsets: [{ nx: 0.8, nz: 0.18 }, { nx: 0.85, nz: 0.25 }],
      preferredAI: ["guard", "wander"],
      capacity: 3,
    },
    {
      region: "east",
      offsets: [{ nx: 0.85, nz: 0.55 }],
      preferredAI: ["patrol"],
      capacity: 2,
    },
  ],

  pickupHints: [
    { region: "northwest", nx: 0.12, nz: 0.18, preferredTypes: ["ammo"] },
    { region: "center", nx: 0.5, nz: 0.5, preferredTypes: ["health"] },
    { region: "northeast", nx: 0.85, nz: 0.18, preferredTypes: ["weapon", "ammo"] },
    { region: "east", nx: 0.88, nz: 0.65, preferredTypes: ["health", "armor"] },
  ],

  lanes: [
    // Left lane (player side → far end)
    { from: { nx: 0.17, nz: 0.85 }, to: { nx: 0.17, nz: 0.15 }, width: 3 },
    // Center lane
    { from: { nx: 0.5, nz: 0.85 }, to: { nx: 0.5, nz: 0.15 }, width: 3 },
    // Right lane
    { from: { nx: 0.82, nz: 0.85 }, to: { nx: 0.82, nz: 0.15 }, width: 3 },
    // Cross lane at gap positions
    { from: { nx: 0.15, nz: 0.5 }, to: { nx: 0.85, nz: 0.5 }, width: 2.5 },
    { from: { nx: 0.15, nz: 0.3 }, to: { nx: 0.85, nz: 0.3 }, width: 2.5 },
  ],
};
