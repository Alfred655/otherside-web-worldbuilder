import * as THREE from "three";
import type { CompoundPart } from "@otherside/shared";
import { SeededRNG } from "./seeded-rng.js";

export type CharacterPreset = "humanoid" | "creature" | "flying" | "turret";

/**
 * Build a THREE.Group from an array of CompoundPart specs.
 * Each child mesh is named with its index for animator access.
 */
export function buildCompoundMesh(
  parts: CompoundPart[],
  defaultColor: string,
): THREE.Group {
  const group = new THREE.Group();

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const geo = makePartGeometry(part.shape, part.size);
    const color = part.color ?? defaultColor;
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(part.offset.x, part.offset.y, part.offset.z);
    mesh.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z);
    mesh.name = `part_${i}`;

    // Shadow optimization: only the largest parts cast shadows
    const vol = part.size.x * part.size.y * part.size.z;
    mesh.castShadow = vol > 0.3;
    mesh.receiveShadow = true;

    group.add(mesh);
  }

  return group;
}

function makePartGeometry(
  shape: "box" | "sphere" | "cylinder",
  size: { x: number; y: number; z: number },
): THREE.BufferGeometry {
  switch (shape) {
    case "box":
      return new THREE.BoxGeometry(size.x, size.y, size.z);
    case "sphere":
      return new THREE.SphereGeometry(size.x / 2, 12, 12);
    case "cylinder":
      return new THREE.CylinderGeometry(size.x / 2, size.x / 2, size.y, 12);
  }
}

// ── Preset character blueprints ─────────────────────────────────────────

interface PartDef {
  name: string;
  shape: "box" | "sphere" | "cylinder";
  size: [number, number, number];
  offset: [number, number, number];
  rotation?: [number, number, number];
  colorVariation?: number;
}

const HUMANOID_PARTS: PartDef[] = [
  { name: "body",     shape: "box",      size: [0.6, 0.8, 0.4], offset: [0, 0.8, 0] },
  { name: "head",     shape: "sphere",   size: [0.4, 0.4, 0.4], offset: [0, 1.5, 0] },
  { name: "leftArm",  shape: "box",      size: [0.2, 0.6, 0.2], offset: [-0.5, 0.8, 0], colorVariation: -0.05 },
  { name: "rightArm", shape: "box",      size: [0.2, 0.6, 0.2], offset: [0.5, 0.8, 0], colorVariation: -0.05 },
  { name: "leftLeg",  shape: "box",      size: [0.25, 0.6, 0.25], offset: [-0.15, 0.1, 0], colorVariation: -0.1 },
  { name: "rightLeg", shape: "box",      size: [0.25, 0.6, 0.25], offset: [0.15, 0.1, 0], colorVariation: -0.1 },
];

const CREATURE_PARTS: PartDef[] = [
  { name: "body",     shape: "box",      size: [0.5, 0.5, 1.2], offset: [0, 0.5, 0] },
  { name: "head",     shape: "sphere",   size: [0.45, 0.45, 0.45], offset: [0, 0.6, 0.7] },
  { name: "legFL",    shape: "cylinder",  size: [0.12, 0.5, 0.12], offset: [-0.25, 0.1, 0.35] },
  { name: "legFR",    shape: "cylinder",  size: [0.12, 0.5, 0.12], offset: [0.25, 0.1, 0.35] },
  { name: "legBL",    shape: "cylinder",  size: [0.12, 0.5, 0.12], offset: [-0.25, 0.1, -0.35] },
  { name: "legBR",    shape: "cylinder",  size: [0.12, 0.5, 0.12], offset: [0.25, 0.1, -0.35] },
  { name: "tail",     shape: "box",      size: [0.1, 0.1, 0.5], offset: [0, 0.4, -0.8], colorVariation: -0.05 },
];

const FLYING_PARTS: PartDef[] = [
  { name: "body",     shape: "sphere",   size: [0.5, 0.4, 0.6], offset: [0, 0.5, 0] },
  { name: "wingL",    shape: "box",      size: [1.0, 0.05, 0.5], offset: [-0.7, 0.5, 0], rotation: [0, 0, 0.2] },
  { name: "wingR",    shape: "box",      size: [1.0, 0.05, 0.5], offset: [0.7, 0.5, 0], rotation: [0, 0, -0.2] },
  { name: "tail",     shape: "box",      size: [0.15, 0.15, 0.4], offset: [0, 0.45, -0.5], colorVariation: -0.08 },
];

const TURRET_PARTS: PartDef[] = [
  { name: "base",     shape: "cylinder",  size: [0.8, 0.3, 0.8], offset: [0, 0.15, 0] },
  { name: "body",     shape: "box",      size: [0.6, 0.5, 0.6], offset: [0, 0.55, 0] },
  { name: "barrel",   shape: "cylinder",  size: [0.12, 0.8, 0.12], offset: [0, 0.65, 0.5], rotation: [Math.PI / 2, 0, 0] },
];

const PRESET_MAP: Record<CharacterPreset, PartDef[]> = {
  humanoid: HUMANOID_PARTS,
  creature: CREATURE_PARTS,
  flying: FLYING_PARTS,
  turret: TURRET_PARTS,
};

/**
 * Build a character from a named preset with seed-based variation.
 */
export function buildCharacterPreset(
  preset: CharacterPreset,
  baseColor: string,
  scale: number,
  seed: number,
): THREE.Group {
  const rng = new SeededRNG(seed);
  const partDefs = PRESET_MAP[preset];
  const baseRGB = new THREE.Color(baseColor);

  const group = new THREE.Group();

  for (const def of partDefs) {
    // Seed-based variation: ±10% limb proportions
    const sizeVar = 1 + rng.range(-0.1, 0.1);
    const sx = def.size[0] * scale * sizeVar;
    const sy = def.size[1] * scale * sizeVar;
    const sz = def.size[2] * scale * sizeVar;

    const geo = makePartGeometry(def.shape, { x: sx, y: sy, z: sz });

    // ±5% color brightness variation
    const colorVar = def.colorVariation ?? 0;
    const brightness = 1 + colorVar + rng.range(-0.05, 0.05);
    const partColor = baseRGB.clone().multiplyScalar(brightness);
    const mat = new THREE.MeshStandardMaterial({ color: partColor });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      def.offset[0] * scale,
      def.offset[1] * scale,
      def.offset[2] * scale,
    );
    if (def.rotation) {
      mesh.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);
    }
    mesh.name = def.name;

    // Shadow: only main body/head cast shadow
    const vol = sx * sy * sz;
    mesh.castShadow = vol > 0.05;
    mesh.receiveShadow = true;

    group.add(mesh);
  }

  return group;
}

/**
 * Collect all MeshStandardMaterial instances from a Group hierarchy.
 */
export function collectMaterials(obj: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const mats: THREE.MeshStandardMaterial[] = [];
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      mats.push(child.material);
    }
  });
  return mats;
}
