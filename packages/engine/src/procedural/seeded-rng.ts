/**
 * Deterministic random number generation and Perlin noise for procedural content.
 */

// ── Seeded RNG (mulberry32) ────────────────────────────────────────────────

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] (inclusive) */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Create a new RNG forked from this one (deterministic child) */
  fork(): SeededRNG {
    return new SeededRNG((this.next() * 0x7fffffff) | 0);
  }
}

// ── Hash a string to a seed ────────────────────────────────────────────────

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash;
}

// ── 2D Perlin Noise ────────────────────────────────────────────────────────

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function dot2(g: number[], x: number, y: number): number {
  return g[0] * x + g[1] * y;
}

export class PerlinNoise2D {
  private perm: Uint8Array;

  constructor(seed: number) {
    const rng = new SeededRNG(seed);
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** Returns noise value in approximately [-1, 1] */
  sample(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = this.perm[this.perm[X] + Y] & 7;
    const ab = this.perm[this.perm[X] + Y + 1] & 7;
    const ba = this.perm[this.perm[X + 1] + Y] & 7;
    const bb = this.perm[this.perm[X + 1] + Y + 1] & 7;

    const n00 = dot2(GRAD2[aa], xf, yf);
    const n10 = dot2(GRAD2[ba], xf - 1, yf);
    const n01 = dot2(GRAD2[ab], xf, yf - 1);
    const n11 = dot2(GRAD2[bb], xf - 1, yf - 1);

    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }
}

// ── Fractal Brownian Motion ────────────────────────────────────────────────

export function fbm2D(
  noise: PerlinNoise2D,
  x: number,
  y: number,
  octaves: number,
  lacunarity = 2.0,
  persistence = 0.5,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise.sample(x * frequency, y * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / maxAmplitude;
}
