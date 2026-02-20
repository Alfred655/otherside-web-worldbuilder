import * as THREE from "three";
import type { Terrain } from "@otherside/shared";
import { SeededRNG, PerlinNoise2D, fbm2D, hashString } from "./seeded-rng.js";

export interface TerrainResult {
  mesh: THREE.Mesh;
  /** Sample terrain height at world (x, z). Returns 0 for out-of-bounds. */
  sampleHeight(x: number, z: number): number;
  /** Column-major float array for Rapier heightfield. Length = (nrows+1) * (ncols+1). */
  heights: Float32Array;
  nrows: number;
  ncols: number;
  dispose(): void;
}

// ── Biome noise parameters ──────────────────────────────────────────────

interface BiomeParams {
  octaves: number;
  lacunarity: number;
  persistence: number;
  heightScale: number;
  noiseScale: number;
}

const BIOME_PARAMS: Record<string, BiomeParams> = {
  temperate: { octaves: 5, lacunarity: 2.0, persistence: 0.5, heightScale: 6, noiseScale: 0.03 },
  desert:    { octaves: 3, lacunarity: 2.2, persistence: 0.4, heightScale: 4, noiseScale: 0.02 },
  arctic:    { octaves: 4, lacunarity: 2.0, persistence: 0.45, heightScale: 3, noiseScale: 0.025 },
  volcanic:  { octaves: 6, lacunarity: 2.1, persistence: 0.55, heightScale: 10, noiseScale: 0.04 },
};

// ── Biome color ramps (height-based) ────────────────────────────────────

interface ColorStop { height: number; color: THREE.Color }

function getColorRamp(biome: string): ColorStop[] {
  switch (biome) {
    case "temperate":
      return [
        { height: 0.0, color: new THREE.Color(0xd2b48c) },  // sand
        { height: 0.2, color: new THREE.Color(0x4a7c3f) },  // grass
        { height: 0.6, color: new THREE.Color(0x6e6e6e) },  // rock
        { height: 0.85, color: new THREE.Color(0xfafafa) },  // snow
      ];
    case "desert":
      return [
        { height: 0.0, color: new THREE.Color(0xf4e0b0) },  // light sand
        { height: 0.3, color: new THREE.Color(0xd4a860) },  // mid sand
        { height: 0.6, color: new THREE.Color(0xb08040) },  // dark sand
        { height: 1.0, color: new THREE.Color(0x8a6030) },  // deep sand
      ];
    case "arctic":
      return [
        { height: 0.0, color: new THREE.Color(0xeeeeff) },  // white
        { height: 0.3, color: new THREE.Color(0xd0d8f0) },  // blue-white
        { height: 0.7, color: new THREE.Color(0x8899aa) },  // rock
        { height: 1.0, color: new THREE.Color(0xffffff) },  // peak snow
      ];
    case "volcanic":
      return [
        { height: 0.0, color: new THREE.Color(0xff4500) },  // lava orange
        { height: 0.15, color: new THREE.Color(0x8b0000) },  // dark red
        { height: 0.4, color: new THREE.Color(0x333333) },  // dark rock
        { height: 1.0, color: new THREE.Color(0x222222) },  // black rock
      ];
    default:
      return [
        { height: 0.0, color: new THREE.Color(0x4a7c3f) },
        { height: 1.0, color: new THREE.Color(0x6e6e6e) },
      ];
  }
}

function sampleRamp(ramp: ColorStop[], t: number): THREE.Color {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < ramp.length - 1; i++) {
    if (clamped <= ramp[i + 1].height) {
      const local = (clamped - ramp[i].height) / (ramp[i + 1].height - ramp[i].height);
      return ramp[i].color.clone().lerp(ramp[i + 1].color, local);
    }
  }
  return ramp[ramp.length - 1].color.clone();
}

// ── Build procedural terrain ────────────────────────────────────────────

export function buildProceduralTerrain(
  terrainSpec: Terrain,
  specName: string,
  scene: THREE.Scene,
): TerrainResult {
  const sizeX = terrainSpec.size.x;
  const sizeZ = terrainSpec.size.z;
  const seed = terrainSpec.seed ?? hashString(specName);
  const biome = terrainSpec.biome ?? "temperate";
  const params = BIOME_PARAMS[biome] ?? BIOME_PARAMS.temperate;

  const segments = Math.min(128, Math.max(32, Math.floor(Math.max(sizeX, sizeZ))));
  const segsX = segments;
  const segsZ = segments;

  const rng = new SeededRNG(seed);
  const noise = new PerlinNoise2D(seed);
  // Offset noise sampling to add per-seed variation
  const offsetX = rng.range(-1000, 1000);
  const offsetZ = rng.range(-1000, 1000);

  // Create plane geometry (XZ plane)
  const geo = new THREE.PlaneGeometry(sizeX, sizeZ, segsX, segsZ);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const vertCount = posAttr.count;

  // Build height data
  // PlaneGeometry after rotateX(-PI/2): X is right, Y is up, Z is "forward"
  // Vertices are laid out: cols = segsX+1, rows = segsZ+1
  const cols = segsX + 1;
  const rows = segsZ + 1;

  // Store heights for sampling and Rapier
  const heightData = new Float32Array(rows * cols);

  for (let i = 0; i < vertCount; i++) {
    const wx = posAttr.getX(i);
    const wz = posAttr.getZ(i);
    const nx = (wx + sizeX / 2) / sizeX;
    const nz = (wz + sizeZ / 2) / sizeZ;

    const h = fbm2D(
      noise,
      (nx + offsetX) / params.noiseScale,
      (nz + offsetZ) / params.noiseScale,
      params.octaves,
      params.lacunarity,
      params.persistence,
    ) * params.heightScale;

    // Edge falloff — flatten near terrain edges
    const edgeX = 1 - Math.pow(Math.abs(nx - 0.5) * 2, 4);
    const edgeZ = 1 - Math.pow(Math.abs(nz - 0.5) * 2, 4);
    const falloff = edgeX * edgeZ;
    const finalH = h * falloff;

    posAttr.setY(i, finalH);

    // Store in row-major for our own sampling
    const col = i % cols;
    const row = Math.floor(i / cols);
    heightData[row * cols + col] = finalH;
  }

  posAttr.needsUpdate = true;
  geo.computeVertexNormals();

  // Vertex colors based on biome
  const ramp = getColorRamp(biome);
  const colors = new Float32Array(vertCount * 3);
  const normalAttr = geo.attributes.normal;

  // Find height range for normalization
  let minH = Infinity, maxH = -Infinity;
  for (let i = 0; i < vertCount; i++) {
    const y = posAttr.getY(i);
    if (y < minH) minH = y;
    if (y > maxH) maxH = y;
  }
  const heightRange = maxH - minH || 1;

  for (let i = 0; i < vertCount; i++) {
    const y = posAttr.getY(i);
    const normalY = normalAttr.getY(i);
    const t = (y - minH) / heightRange;

    // Blend: steep slopes get more rock-like colors
    const slopeInfluence = 1 - Math.abs(normalY);
    const adjustedT = Math.min(1, t + slopeInfluence * 0.3);

    const c = sampleRamp(ramp, adjustedT);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: terrainSpec.material.roughness,
    metalness: terrainSpec.material.metalness,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Build Rapier heightfield data — COLUMN-MAJOR indexing
  // Rapier expects heights[col * nrows + row] where nrows = segsZ, ncols = segsX
  // Our PlaneGeometry has (segsX+1) columns and (segsZ+1) rows
  // Rapier nrows and ncols represent the number of cells (not vertices),
  // so the array length must be (nrows+1) * (ncols+1)
  const nrows = segsZ;
  const ncols = segsX;
  const rapierHeights = new Float32Array((nrows + 1) * (ncols + 1));

  for (let col = 0; col <= ncols; col++) {
    for (let row = 0; row <= nrows; row++) {
      // Column-major for Rapier
      rapierHeights[col * (nrows + 1) + row] = heightData[row * cols + col];
    }
  }

  // Assertion
  const expectedLen = (nrows + 1) * (ncols + 1);
  if (rapierHeights.length !== expectedLen) {
    console.error(`Heightfield length mismatch: got ${rapierHeights.length}, expected ${expectedLen}`);
  }

  // Height sampling via bilinear interpolation
  function sampleHeight(x: number, z: number): number {
    // Convert world coords to grid coords
    const gx = ((x + sizeX / 2) / sizeX) * segsX;
    const gz = ((z + sizeZ / 2) / sizeZ) * segsZ;

    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;

    if (ix < 0 || ix >= cols - 1 || iz < 0 || iz >= rows - 1) return 0;

    const h00 = heightData[iz * cols + ix];
    const h10 = heightData[iz * cols + ix + 1];
    const h01 = heightData[(iz + 1) * cols + ix];
    const h11 = heightData[(iz + 1) * cols + ix + 1];

    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;
    return h0 + (h1 - h0) * fz;
  }

  return {
    mesh,
    sampleHeight,
    heights: rapierHeights,
    nrows,
    ncols,
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}
