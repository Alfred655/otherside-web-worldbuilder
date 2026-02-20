import * as THREE from "three";
import { SeededRNG, PerlinNoise2D, fbm2D, hashString } from "./seeded-rng.js";

type TextureType = "wood" | "stone" | "metal" | "fabric";

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Generate a tileable procedural texture using Canvas 2D.
 * Results are cached by type+color to avoid regeneration.
 */
export function generateTexture(
  type: TextureType,
  baseColor: string,
  size = 256,
): THREE.CanvasTexture {
  const key = `${type}-${baseColor}-${size}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const base = parseHex(baseColor);
  const seed = hashString(key);
  const rng = new SeededRNG(seed);
  const noise = new PerlinNoise2D(seed);

  switch (type) {
    case "wood":
      drawWood(ctx, size, base, rng, noise);
      break;
    case "stone":
      drawStone(ctx, size, base, rng, noise);
      break;
    case "metal":
      drawMetal(ctx, size, base, rng, noise);
      break;
    case "fabric":
      drawFabric(ctx, size, base, rng, noise);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  textureCache.set(key, texture);
  return texture;
}

// ── Color helpers ─────────────────────────────────────────────────────────

interface RGB { r: number; g: number; b: number }

function parseHex(hex: string): RGB {
  const val = parseInt(hex.slice(1), 16);
  return { r: (val >> 16) & 0xff, g: (val >> 8) & 0xff, b: val & 0xff };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function setPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
) {
  ctx.fillStyle = `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
  ctx.fillRect(x, y, 1, 1);
}

// ── Toroidal noise (tileable) ─────────────────────────────────────────────

function tileNoise(noise: PerlinNoise2D, x: number, y: number, size: number, scale: number): number {
  const nx = x / size;
  const ny = y / size;
  // Sample on a torus for seamless tiling
  const angle1 = nx * Math.PI * 2;
  const angle2 = ny * Math.PI * 2;
  return noise.sample(
    Math.cos(angle1) * scale + scale,
    Math.sin(angle1) * scale + Math.cos(angle2) * scale + scale * 2,
  ) * 0.5 + noise.sample(
    Math.sin(angle2) * scale + scale * 3,
    Math.cos(angle2) * scale + Math.sin(angle1) * scale + scale * 4,
  ) * 0.5;
}

// ── Wood ──────────────────────────────────────────────────────────────────

function drawWood(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: RGB,
  rng: SeededRNG,
  noise: PerlinNoise2D,
) {
  const dark = { r: base.r * 0.6, g: base.g * 0.5, b: base.b * 0.4 };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Horizontal grain
      const grain = Math.sin((y / size) * 40 + tileNoise(noise, x, y, size, 4) * 6) * 0.5 + 0.5;
      const n = tileNoise(noise, x, y, size, 8) * 0.15;
      const t = grain + n;
      const r = base.r + (dark.r - base.r) * t;
      const g = base.g + (dark.g - base.g) * t;
      const b = base.b + (dark.b - base.b) * t;
      setPixel(ctx, x, y, r, g, b);
    }
  }

  // Knot holes
  const knots = 2 + Math.floor(rng.next() * 2);
  for (let k = 0; k < knots; k++) {
    const kx = rng.range(size * 0.1, size * 0.9);
    const ky = rng.range(size * 0.1, size * 0.9);
    const kr = rng.range(4, 10);
    for (let dy = -kr; dy <= kr; dy++) {
      for (let dx = -kr; dx <= kr; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < kr) {
          const px = Math.round(kx + dx) % size;
          const py = Math.round(ky + dy) % size;
          const falloff = 1 - dist / kr;
          const darkness = falloff * 0.4;
          setPixel(
            ctx, px < 0 ? px + size : px, py < 0 ? py + size : py,
            dark.r * (1 - darkness * 0.5), dark.g * (1 - darkness * 0.5), dark.b * (1 - darkness * 0.3),
          );
        }
      }
    }
  }
}

// ── Stone ─────────────────────────────────────────────────────────────────

function drawStone(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: RGB,
  rng: SeededRNG,
  noise: PerlinNoise2D,
) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n1 = tileNoise(noise, x, y, size, 4) * 0.4;
      const n2 = tileNoise(noise, x * 2.3, y * 2.3, size, 8) * 0.2;
      const speckle = rng.next() * 0.06 - 0.03;
      const brightness = 1 + n1 + n2 + speckle;
      setPixel(ctx, x, y, base.r * brightness, base.g * brightness, base.b * brightness);
    }
  }

  // Random-walk cracks
  const cracks = 3 + Math.floor(rng.next() * 3);
  for (let c = 0; c < cracks; c++) {
    let cx = rng.range(0, size);
    let cy = rng.range(0, size);
    const steps = 20 + Math.floor(rng.next() * 40);
    for (let s = 0; s < steps; s++) {
      cx += rng.range(-2, 2);
      cy += rng.range(-1, 2);
      const px = ((Math.round(cx) % size) + size) % size;
      const py = ((Math.round(cy) % size) + size) % size;
      setPixel(ctx, px, py, base.r * 0.4, base.g * 0.4, base.b * 0.4);
    }
  }
}

// ── Metal ─────────────────────────────────────────────────────────────────

function drawMetal(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: RGB,
  _rng: SeededRNG,
  noise: PerlinNoise2D,
) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Brushed horizontal stripes
      const stripe = Math.sin((x / size) * 120) * 0.03;
      const n = tileNoise(noise, x, y, size, 6) * 0.08;
      // Specular highlights
      const highlight = Math.pow(Math.max(0, tileNoise(noise, x * 0.5, y * 0.5, size, 3)), 3) * 0.15;
      const brightness = 1 + stripe + n + highlight;
      setPixel(ctx, x, y, base.r * brightness, base.g * brightness, base.b * brightness);
    }
  }
}

// ── Fabric ────────────────────────────────────────────────────────────────

function drawFabric(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: RGB,
  _rng: SeededRNG,
  noise: PerlinNoise2D,
) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Crosshatch weave pattern
      const warpThread = ((x % 4) < 2) ? 0.05 : -0.05;
      const weftThread = ((y % 4) < 2) ? 0.05 : -0.05;
      const weave = ((x + y) % 4 < 2) ? warpThread : weftThread;
      const n = tileNoise(noise, x, y, size, 10) * 0.1;
      const brightness = 1 + weave + n;
      setPixel(ctx, x, y, base.r * brightness, base.g * brightness, base.b * brightness);
    }
  }
}
