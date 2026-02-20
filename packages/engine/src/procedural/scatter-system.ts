import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { ScatterItem, Terrain } from "@otherside/shared";
import type { TerrainResult } from "./terrain-builder.js";
import { SeededRNG } from "./seeded-rng.js";

export interface ScatterResult {
  dispose(): void;
}

interface ScatterPlacement {
  kind: string;
  x: number;
  y: number;
  z: number;
  scale: number;
}

// ── Default scatter per biome ───────────────────────────────────────────

const DEFAULT_SCATTER: Record<string, ScatterItem[]> = {
  temperate: [
    { kind: "tree", density: 0.2, minScale: 0.5, maxScale: 1.5 },
    { kind: "rock", density: 0.1, minScale: 0.5, maxScale: 1.5 },
    { kind: "bush", density: 0.15, minScale: 0.5, maxScale: 1.5 },
  ],
  desert: [
    { kind: "rock", density: 0.08, minScale: 0.5, maxScale: 1.5 },
    { kind: "crystal", density: 0.02, minScale: 0.5, maxScale: 1.5 },
  ],
  arctic: [
    { kind: "rock", density: 0.05, minScale: 0.5, maxScale: 1.5 },
    { kind: "crystal", density: 0.03, minScale: 0.5, maxScale: 1.5 },
  ],
  volcanic: [
    { kind: "rock", density: 0.15, minScale: 0.5, maxScale: 1.5 },
  ],
};

// ── Biome-aware scatter colors ──────────────────────────────────────────

function getScatterColor(kind: string, biome: string): number {
  switch (kind) {
    case "tree":
      if (biome === "arctic") return 0x3a5a3a;
      if (biome === "desert") return 0x6a8a4a;
      return 0x2d5a27;
    case "rock":
      if (biome === "volcanic") return 0x333333;
      if (biome === "arctic") return 0x8899aa;
      return 0x777777;
    case "bush":
      if (biome === "desert") return 0x8a9a5a;
      return 0x3a6a2a;
    case "crystal":
      if (biome === "volcanic") return 0xff4400;
      if (biome === "arctic") return 0x88ccff;
      return 0xaa88ff;
    default:
      return 0x888888;
  }
}

// ── Generate scatter ────────────────────────────────────────────────────

export function generateScatter(
  terrain: TerrainResult,
  terrainSpec: Terrain,
  scene: THREE.Scene,
  world: RAPIER.World,
  seed: number,
): ScatterResult {
  const sizeX = terrainSpec.size.x;
  const sizeZ = terrainSpec.size.z;
  const biome = terrainSpec.biome ?? "temperate";
  const scatterItems = terrainSpec.scatter ?? DEFAULT_SCATTER[biome] ?? [];
  const rng = new SeededRNG(seed + 12345);

  const cellSize = 3;
  const halfX = sizeX / 2;
  const halfZ = sizeZ / 2;

  // Collect placements per kind
  const placementsByKind = new Map<string, ScatterPlacement[]>();
  for (const item of scatterItems) {
    placementsByKind.set(item.kind, []);
  }

  for (const item of scatterItems) {
    const placements = placementsByKind.get(item.kind)!;

    for (let gx = -halfX + cellSize / 2; gx < halfX; gx += cellSize) {
      for (let gz = -halfZ + cellSize / 2; gz < halfZ; gz += cellSize) {
        if (rng.next() >= item.density) continue;

        // Jitter within cell
        const x = gx + rng.range(-cellSize * 0.4, cellSize * 0.4);
        const z = gz + rng.range(-cellSize * 0.4, cellSize * 0.4);

        // Skip if near terrain edge
        if (Math.abs(x) > halfX - 2 || Math.abs(z) > halfZ - 2) continue;

        const y = terrain.sampleHeight(x, z);

        // Skip steep slopes: approximate normal from neighbors
        const hL = terrain.sampleHeight(x - 0.5, z);
        const hR = terrain.sampleHeight(x + 0.5, z);
        const hD = terrain.sampleHeight(x, z - 0.5);
        const hU = terrain.sampleHeight(x, z + 0.5);
        const nx = hL - hR;
        const nz = hD - hU;
        const ny = 1.0; // approximation for small sample distance
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const normalY = ny / len;
        if (normalY < 0.7) continue;

        const scale = rng.range(item.minScale, item.maxScale);
        placements.push({ kind: item.kind, x, y, z, scale });
      }
    }
  }

  // Build instanced meshes per kind
  const meshes: THREE.InstancedMesh[] = [];
  const colliderBodies: RAPIER.RigidBody[] = [];
  const dummy = new THREE.Matrix4();

  for (const item of scatterItems) {
    const placements = placementsByKind.get(item.kind)!;
    if (placements.length === 0) continue;

    const color = getScatterColor(item.kind, biome);

    switch (item.kind) {
      case "tree": {
        // Trunk - instanced cylinders
        const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a });
        const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, placements.length);
        trunkMesh.castShadow = true;
        trunkMesh.receiveShadow = true;

        // Canopy - instanced cones
        const canopyGeo = new THREE.ConeGeometry(1.2, 2.5, 8);
        const canopyMat = new THREE.MeshStandardMaterial({ color });
        const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, placements.length);
        canopyMesh.castShadow = true;
        canopyMesh.receiveShadow = true;

        for (let i = 0; i < placements.length; i++) {
          const p = placements[i];
          // Trunk
          dummy.makeScale(p.scale, p.scale, p.scale);
          dummy.setPosition(p.x, p.y + p.scale, p.z);
          trunkMesh.setMatrixAt(i, dummy);
          // Canopy
          dummy.makeScale(p.scale, p.scale, p.scale);
          dummy.setPosition(p.x, p.y + p.scale * 2.5, p.z);
          canopyMesh.setMatrixAt(i, dummy);

          // Static box collider for trunk
          const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y + p.scale, p.z);
          const body = world.createRigidBody(bodyDesc);
          const colDesc = RAPIER.ColliderDesc.cuboid(0.2 * p.scale, p.scale, 0.2 * p.scale);
          world.createCollider(colDesc, body);
          colliderBodies.push(body);
        }

        trunkMesh.instanceMatrix.needsUpdate = true;
        canopyMesh.instanceMatrix.needsUpdate = true;
        scene.add(trunkMesh);
        scene.add(canopyMesh);
        meshes.push(trunkMesh, canopyMesh);
        break;
      }
      case "rock": {
        const geo = new THREE.SphereGeometry(0.5, 6, 5);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
        const inst = new THREE.InstancedMesh(geo, mat, placements.length);
        inst.castShadow = true;
        inst.receiveShadow = true;

        for (let i = 0; i < placements.length; i++) {
          const p = placements[i];
          // Non-uniform squash
          const sx = p.scale * rng.range(0.8, 1.4);
          const sy = p.scale * rng.range(0.4, 0.8);
          const sz = p.scale * rng.range(0.8, 1.4);
          dummy.makeScale(sx, sy, sz);
          dummy.setPosition(p.x, p.y + sy * 0.3, p.z);
          inst.setMatrixAt(i, dummy);

          // Collider for larger rocks
          if (p.scale > 0.8) {
            const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y + sy * 0.3, p.z);
            const body = world.createRigidBody(bodyDesc);
            const colDesc = RAPIER.ColliderDesc.cuboid(sx * 0.4, sy * 0.4, sz * 0.4);
            world.createCollider(colDesc, body);
            colliderBodies.push(body);
          }
        }

        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
        meshes.push(inst);
        break;
      }
      case "bush": {
        const geo = new THREE.SphereGeometry(0.4, 8, 6);
        const mat = new THREE.MeshStandardMaterial({ color });
        const inst = new THREE.InstancedMesh(geo, mat, placements.length);
        inst.receiveShadow = true;

        for (let i = 0; i < placements.length; i++) {
          const p = placements[i];
          dummy.makeScale(p.scale, p.scale * 0.7, p.scale);
          dummy.setPosition(p.x, p.y + p.scale * 0.15, p.z);
          inst.setMatrixAt(i, dummy);
        }

        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
        meshes.push(inst);
        break;
      }
      case "crystal": {
        const geo = new THREE.OctahedronGeometry(0.4, 0);
        const mat = new THREE.MeshStandardMaterial({
          color,
          metalness: 0.3,
          roughness: 0.2,
          transparent: true,
          opacity: 0.85,
        });
        const inst = new THREE.InstancedMesh(geo, mat, placements.length);
        inst.castShadow = true;

        for (let i = 0; i < placements.length; i++) {
          const p = placements[i];
          const sy = p.scale * rng.range(1.0, 2.0);
          dummy.makeScale(p.scale * 0.5, sy, p.scale * 0.5);
          dummy.setPosition(p.x, p.y + sy * 0.3, p.z);
          inst.setMatrixAt(i, dummy);
        }

        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
        meshes.push(inst);
        break;
      }
    }
  }

  return {
    dispose() {
      for (const m of meshes) {
        scene.remove(m);
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mt) => mt.dispose());
        } else {
          m.material.dispose();
        }
      }
      for (const b of colliderBodies) {
        world.removeRigidBody(b);
      }
    },
  };
}
