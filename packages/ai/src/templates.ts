export interface GameTemplate {
  id: string;
  name: string;
  keywords: string[];
  description: string;
}

export const TEMPLATES: GameTemplate[] = [
  {
    id: "arena",
    name: "Arena",
    keywords: [
      "arena", "battle", "combat", "fight", "survival", "survive", "wave",
      "defend", "gladiator", "pit", "deathmatch", "brawl",
    ],
    description: `Arena Layout (30×1×30 square):
- Open combat area with clear sightlines
- Enemies patrol the perimeter or chase from corners, spaced 8–12 units apart
- 4 cover pillars/walls at strategic positions (±10, ±10)
- Collectibles scattered in the interior ring (radius 5–8 from center)
- Health packs at map edges (±12, 0) and (0, ±12)
- Player spawns at center (0, 2, 0)
- Dark atmospheric sky (#0a0a1a to #1a1a3e) with colored fog
- Neon/metallic enemy materials for visibility
- Win: defeat_all or reach_score. Lose: health_zero
- Use first_person camera, attackDamage 20–30, speed 5–7`,
  },
  {
    id: "corridor",
    name: "Corridor",
    keywords: [
      "corridor", "dungeon", "tunnel", "hallway", "gauntlet", "escape",
      "run", "linear", "path", "maze", "cave",
    ],
    description: `Corridor Layout (50×1×12 rectangular):
- Long narrow terrain — player progresses from one end to the other
- Enemies placed at intervals every 8–10 units along the Z axis
- Cover objects (boxes) along the sides for tactical gameplay
- Collectibles between enemy encounters at regular intervals
- Health packs halfway through and near the end
- Player spawns at (0, 2, -22) — near one end
- Indoor aesthetic: dim lighting (intensity 0.3–0.5), close fog (near 8, far 30)
- Goal/trigger at the far end for reach_goal win condition
- Use first_person camera, moderate speed 5–6
- Enemies can patrol short side-to-side paths or guard positions`,
  },
  {
    id: "open_world",
    name: "Open World",
    keywords: [
      "open", "world", "explore", "exploration", "adventure", "quest",
      "roam", "sandbox", "island", "field", "forest", "ranch", "farm",
      "garden", "park", "nature", "outdoor",
    ],
    description: `Open World Layout (60×1×60 large terrain):
- Spacious terrain with points of interest spread across the map
- Enemy camps: clusters of 2–3 NPCs at 3–4 locations, spaced 20+ units apart
- Collectibles distributed widely — some standalone, some near landmarks
- Landmark props (pillars, structures) marking key areas
- Health packs near enemy camps or at map edges
- Player spawns at center (0, 2, 0)
- Natural sky colors (#87ceeb daytime or #ff7744 sunset), light fog
- Bright ambient light (0.6–1.0) for visibility
- Terrain material: earthy/natural (#4a7c4e green, #8B7355 brown)
- Win: collect_all or reach_score. Lose: health_zero or fall_off
- Use first_person or third_person camera, speed 5–7`,
  },
  {
    id: "platformer",
    name: "Platformer",
    keywords: [
      "platform", "platformer", "jump", "jumping", "climb", "vertical",
      "tower", "obstacle", "parkour", "course", "race",
    ],
    description: `Platformer Layout (40×1×40 terrain):
- Ground level plus elevated platforms (box props) at heights 2, 4, 6
- Platforms: 3×1×3 boxes at various positions, some adjacent for paths
- Collectibles on platforms — must jump to reach them
- Enemies patrol ground level or stand guard on key platforms
- Use many prop boxes as platforms at different heights
- Player spawns on ground (0, 2, 0), must jump between platforms
- Bright, colorful aesthetic — distinct colors per platform level
- High jumpForce (10–12) for vertical gameplay
- Score-based collectibles on harder-to-reach platforms worth more
- Win: collect_all or reach_score. Lose: fall_off or health_zero
- Use first_person camera, speed 5–6, high jump`,
  },
];

/** Score each template against the prompt and return the best match, or null */
export function selectTemplate(prompt: string): GameTemplate | null {
  const lower = prompt.toLowerCase();
  let best: GameTemplate | null = null;
  let bestScore = 0;

  for (const tmpl of TEMPLATES) {
    let score = 0;
    for (const kw of tmpl.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = tmpl;
    }
  }

  return bestScore > 0 ? best : null;
}
