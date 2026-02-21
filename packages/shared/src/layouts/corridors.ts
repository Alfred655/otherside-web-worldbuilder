import type { LayoutTemplateDef } from "./types.js";

/**
 * Corridors — Compact maze (24-32m × 24-32m)
 *
 * Layout: Cross-shaped corridor walls creating 4 rooms around a central hub.
 * Each wall has 1 gap (doorway). Tight sight lines, close-quarters combat.
 */
export const corridorsTemplate: LayoutTemplateDef = {
  id: "corridors",
  name: "Corridors",
  description: "Compact maze with hallways, rooms, and central hub",
  recommendedSize: { minX: 24, maxX: 32, minZ: 24, maxZ: 32 },
  playerSpawn: { nx: 0.15, nz: 0.85 },

  coverClusters: [
    // Central hub cover — blocks in the crossroads
    {
      id: "hub-center",
      anchor: { nx: 0.5, nz: 0.5 },
      rotation: 0,
      pieces: [
        { dx: -1.5, dz: -1.5, assetId: "kenney_block", rotY: 0 },
        { dx: 1.5, dz: -1.5, assetId: "kenney_block", rotY: 0 },
        { dx: -1.5, dz: 1.5, assetId: "kenney_block", rotY: 0 },
        { dx: 1.5, dz: 1.5, assetId: "kenney_block", rotY: 0 },
      ],
    },
    // NW room — supply cache with defensive position
    {
      id: "nw-supply",
      anchor: { nx: 0.25, nz: 0.25 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_bricks", rotY: 0 },
        { dx: 0, dz: 1.2, assetId: "kenney_bricks", rotY: Math.PI / 2 },
      ],
    },
    // SE corner defensive position
    {
      id: "se-defense",
      anchor: { nx: 0.75, nz: 0.75 },
      rotation: Math.PI,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_wall_low", rotY: 0 },
        { dx: -0.5, dz: -1.5, assetId: "kenney_block", rotY: 0 },
      ],
    },
    // NE room — ambush corner
    {
      id: "ne-ambush",
      anchor: { nx: 0.75, nz: 0.25 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_column", rotY: 0 },
        { dx: 1.5, dz: 1, assetId: "kenney_bricks", rotY: Math.PI / 2 },
      ],
    },
  ],

  wallLines: [
    // North-south wall (west half) — west rooms divider
    {
      id: "wall-ns-west",
      start: { nx: 0.38, nz: 0.12 },
      end: { nx: 0.38, nz: 0.42 },
      assetId: "kenney_wall",
      gaps: [0.5],
    },
    // North-south wall (west half, south section)
    {
      id: "wall-ns-west-s",
      start: { nx: 0.38, nz: 0.58 },
      end: { nx: 0.38, nz: 0.88 },
      assetId: "kenney_wall",
      gaps: [0.5],
    },
    // North-south wall (east half) — east rooms divider
    {
      id: "wall-ns-east",
      start: { nx: 0.62, nz: 0.12 },
      end: { nx: 0.62, nz: 0.42 },
      assetId: "kenney_wall",
      gaps: [0.5],
    },
    // North-south wall (east half, south section)
    {
      id: "wall-ns-east-s",
      start: { nx: 0.62, nz: 0.58 },
      end: { nx: 0.62, nz: 0.88 },
      assetId: "kenney_wall",
      gaps: [0.5],
    },
    // East-west wall (north) — north rooms divider
    {
      id: "wall-ew-north",
      start: { nx: 0.12, nz: 0.38 },
      end: { nx: 0.42, nz: 0.38 },
      assetId: "kenney_wall",
      gaps: [0.5],
    },
    // East-west wall (north, east section)
    {
      id: "wall-ew-north-e",
      start: { nx: 0.58, nz: 0.38 },
      end: { nx: 0.88, nz: 0.38 },
      assetId: "kenney_wall",
      gaps: [0.5],
    },
    // East-west wall (south) — south rooms divider
    {
      id: "wall-ew-south",
      start: { nx: 0.12, nz: 0.62 },
      end: { nx: 0.42, nz: 0.62 },
      assetId: "kenney_wall",
      gaps: [0.5],
    },
    // East-west wall (south, east section)
    {
      id: "wall-ew-south-e",
      start: { nx: 0.58, nz: 0.62 },
      end: { nx: 0.88, nz: 0.62 },
      assetId: "kenney_wall",
      gaps: [0.5],
    },
  ],

  decorations: [
    { nx: 0.25, nz: 0.12, rotation: 0, assetId: "kenney_banner", themeTags: ["indoor", "military"] },
    { nx: 0.75, nz: 0.12, rotation: 0, assetId: "kenney_banner", themeTags: ["indoor", "military"] },
    { nx: 0.25, nz: 0.88, rotation: Math.PI, assetId: "kenney_banner", themeTags: ["indoor"] },
    { nx: 0.75, nz: 0.88, rotation: Math.PI, assetId: "kenney_banner", themeTags: ["indoor"] },
  ],

  zones: [
    { region: "southwest", defaultType: "spawn_area", cx: 0.25, cz: 0.75, width: 0.25, depth: 0.25 },
    { region: "center", defaultType: "open_combat", cx: 0.5, cz: 0.5, width: 0.2, depth: 0.2 },
    { region: "northwest", defaultType: "supply_cache", cx: 0.25, cz: 0.25, width: 0.25, depth: 0.25 },
    { region: "northeast", defaultType: "cover_heavy", cx: 0.75, cz: 0.25, width: 0.25, depth: 0.25 },
    { region: "southeast", defaultType: "cover_light", cx: 0.75, cz: 0.75, width: 0.25, depth: 0.25 },
  ],

  enemyHints: [
    {
      region: "northeast",
      offsets: [{ nx: 0.75, nz: 0.25 }, { nx: 0.78, nz: 0.28 }],
      preferredAI: ["guard", "patrol"],
      capacity: 3,
    },
    {
      region: "center",
      offsets: [{ nx: 0.5, nz: 0.48 }],
      preferredAI: ["wander", "chase"],
      capacity: 2,
    },
    {
      region: "northwest",
      offsets: [{ nx: 0.25, nz: 0.25 }],
      preferredAI: ["guard"],
      capacity: 2,
    },
    {
      region: "southeast",
      offsets: [{ nx: 0.72, nz: 0.72 }, { nx: 0.78, nz: 0.78 }],
      preferredAI: ["patrol", "guard"],
      capacity: 3,
    },
  ],

  pickupHints: [
    { region: "northwest", nx: 0.22, nz: 0.22, preferredTypes: ["weapon", "ammo"] },
    { region: "center", nx: 0.5, nz: 0.5, preferredTypes: ["health"] },
    { region: "southeast", nx: 0.78, nz: 0.78, preferredTypes: ["ammo"] },
    { region: "northeast", nx: 0.78, nz: 0.22, preferredTypes: ["health", "armor"] },
  ],

  lanes: [
    // North-south center corridor
    { from: { nx: 0.5, nz: 0.12 }, to: { nx: 0.5, nz: 0.88 }, width: 2.5 },
    // East-west center corridor
    { from: { nx: 0.12, nz: 0.5 }, to: { nx: 0.88, nz: 0.5 }, width: 2.5 },
  ],
};
