import type { ZoneRegion, ZoneType } from "../schemas/shooter.js";

export interface CoverCluster {
  id: string;
  /** Cluster center — normalized 0-1, scaled to arena */
  anchor: { nx: number; nz: number };
  /** Y-rotation of entire cluster (radians) */
  rotation: number;
  /** Individual pieces — offsets in METERS from cluster center */
  pieces: {
    dx: number;
    dz: number;
    assetId: string;
    rotY: number;
  }[];
}

export interface WallLine {
  id: string;
  /** Start/end in normalized 0-1 coords */
  start: { nx: number; nz: number };
  end: { nx: number; nz: number };
  /** Wall asset to tile along the line */
  assetId: "kenney_wall_low" | "kenney_wall" | "kenney_wall_high";
  /** Normalized positions along line [0-1] where gaps exist (doorways) */
  gaps?: number[];
}

export interface TemplateDecoration {
  nx: number;
  nz: number;
  rotation: number;
  assetId: string;
  themeTags: string[];
}

export interface EnemyHint {
  region: ZoneRegion;
  offsets: { nx: number; nz: number }[];
  preferredAI: string[];
  /** How many enemies can share this hint (extras offset perpendicular) */
  capacity: number;
}

export interface PickupHint {
  region: ZoneRegion;
  nx: number;
  nz: number;
  preferredTypes: string[];
}

export interface LayoutTemplateDef {
  id: string;
  name: string;
  description: string;
  /** Recommended arena size range */
  recommendedSize: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Player spawn in normalized coords */
  playerSpawn: { nx: number; nz: number };
  /** Cover clusters — anchor normalized, piece offsets in meters */
  coverClusters: CoverCluster[];
  /** Interior wall lines — tiled by LayoutEngine into wall segments */
  wallLines: WallLine[];
  /** Decorative props (no physics) */
  decorations: TemplateDecoration[];
  /** Zone definitions */
  zones: {
    region: ZoneRegion;
    defaultType: ZoneType;
    cx: number;
    cz: number;
    width: number;
    depth: number;
  }[];
  /** Enemy placement hints */
  enemyHints: EnemyHint[];
  /** Pickup placement hints */
  pickupHints: PickupHint[];
  /** Clear movement lanes (must stay unblocked) */
  lanes: {
    from: { nx: number; nz: number };
    to: { nx: number; nz: number };
    width: number;
  }[];
}
