import type { LayoutTemplateDef } from "./types.js";

/**
 * Rooftop — Open surface (28-36m × 22-30m)
 *
 * Layout: No interior walls. HVAC units, water tower, perimeter brick walls,
 * bridge section, corner vents. Wide open sight lines with varying cover heights.
 */
export const rooftopTemplate: LayoutTemplateDef = {
  id: "rooftop",
  name: "Rooftop",
  description: "Open rooftop with HVAC units, water tower, and low walls",
  recommendedSize: { minX: 28, maxX: 36, minZ: 22, maxZ: 30 },
  playerSpawn: { nx: 0.15, nz: 0.85 },

  coverClusters: [
    // HVAC unit cluster — blocks + column (tall industrial cover)
    {
      id: "hvac-north",
      anchor: { nx: 0.35, nz: 0.22 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 1.2, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 0.6, dz: -1, assetId: "kenney_column", rotY: 0 },
      ],
    },
    // Water tower — 3 columns forming a triangle
    {
      id: "water-tower",
      anchor: { nx: 0.7, nz: 0.35 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_column", rotY: 0 },
        { dx: 1.5, dz: 0, assetId: "kenney_column", rotY: 0 },
        { dx: 0.75, dz: -1.3, assetId: "kenney_column", rotY: 0 },
      ],
    },
    // Perimeter brick walls (west) — low cover along edge
    {
      id: "west-bricks",
      anchor: { nx: 0.12, nz: 0.45 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_bricks", rotY: Math.PI / 2 },
        { dx: 0, dz: 1.2, assetId: "kenney_bricks", rotY: Math.PI / 2 },
        { dx: 0, dz: 2.4, assetId: "kenney_bricks", rotY: Math.PI / 2 },
      ],
    },
    // Bridge section — wall_low + blocks forming elevated crossing
    {
      id: "bridge-section",
      anchor: { nx: 0.5, nz: 0.6 },
      rotation: 0,
      pieces: [
        { dx: -2, dz: 0, assetId: "kenney_wall_low", rotY: 0 },
        { dx: 0, dz: 0, assetId: "kenney_wall_low", rotY: 0 },
        { dx: -2.5, dz: 0, assetId: "kenney_block", rotY: 0 },
        { dx: 2.2, dz: 0, assetId: "kenney_block", rotY: 0 },
      ],
    },
    // Corner vent — damaged columns
    {
      id: "corner-vent",
      anchor: { nx: 0.85, nz: 0.78 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_column_damaged", rotY: 0 },
        { dx: 1.2, dz: 0.3, assetId: "kenney_column_damaged", rotY: 0.5 },
      ],
    },
    // South entry cover
    {
      id: "south-entry",
      anchor: { nx: 0.35, nz: 0.82 },
      rotation: 0,
      pieces: [
        { dx: 0, dz: 0, assetId: "kenney_bricks", rotY: 0 },
        { dx: 1.3, dz: 0.3, assetId: "kenney_block", rotY: 0 },
      ],
    },
  ],

  wallLines: [],  // No interior walls on rooftop

  decorations: [],  // Minimal rooftop theme

  zones: [
    { region: "southwest", defaultType: "spawn_area", cx: 0.15, cz: 0.85, width: 0.25, depth: 0.25 },
    { region: "center", defaultType: "open_combat", cx: 0.5, cz: 0.5, width: 0.4, depth: 0.3 },
    { region: "north", defaultType: "cover_heavy", cx: 0.35, cz: 0.22, width: 0.3, depth: 0.2 },
    { region: "northeast", defaultType: "sniper_perch", cx: 0.7, cz: 0.35, width: 0.25, depth: 0.25 },
    { region: "west", defaultType: "cover_light", cx: 0.12, cz: 0.45, width: 0.15, depth: 0.3 },
    { region: "southeast", defaultType: "supply_cache", cx: 0.85, cz: 0.78, width: 0.2, depth: 0.2 },
  ],

  enemyHints: [
    {
      region: "north",
      offsets: [{ nx: 0.35, nz: 0.2 }, { nx: 0.4, nz: 0.25 }],
      preferredAI: ["guard", "patrol"],
      capacity: 3,
    },
    {
      region: "northeast",
      offsets: [{ nx: 0.72, nz: 0.32 }],
      preferredAI: ["guard"],
      capacity: 2,
    },
    {
      region: "center",
      offsets: [{ nx: 0.5, nz: 0.5 }, { nx: 0.45, nz: 0.55 }],
      preferredAI: ["wander", "chase"],
      capacity: 3,
    },
    {
      region: "southeast",
      offsets: [{ nx: 0.82, nz: 0.75 }],
      preferredAI: ["patrol"],
      capacity: 2,
    },
  ],

  pickupHints: [
    { region: "north", nx: 0.38, nz: 0.18, preferredTypes: ["ammo"] },
    { region: "center", nx: 0.48, nz: 0.55, preferredTypes: ["health"] },
    { region: "southeast", nx: 0.88, nz: 0.8, preferredTypes: ["weapon", "ammo"] },
    { region: "west", nx: 0.1, nz: 0.5, preferredTypes: ["health", "armor"] },
  ],

  lanes: [
    // West side lane
    { from: { nx: 0.15, nz: 0.85 }, to: { nx: 0.15, nz: 0.15 }, width: 3 },
    // South lane
    { from: { nx: 0.15, nz: 0.82 }, to: { nx: 0.85, nz: 0.82 }, width: 3 },
    // Center diagonal
    { from: { nx: 0.2, nz: 0.75 }, to: { nx: 0.8, nz: 0.25 }, width: 3 },
    // East lane
    { from: { nx: 0.85, nz: 0.85 }, to: { nx: 0.85, nz: 0.15 }, width: 3 },
  ],
};
