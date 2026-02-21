import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Arena } from "@otherside/shared";
import type { AssetLoader } from "./asset-loader.js";

export interface WorldBuilderResult {
  dispose(): void;
}

const ENV_ASSET_IDS = [
  "kenney_floor",
  "kenney_floor_detail",
  "kenney_wall",
  "kenney_wall_corner",
] as const;

/** Compute the axis-aligned bounding box size of a loaded model */
function measureModel(model: THREE.Group): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(model);
  return box.getSize(new THREE.Vector3());
}

export class WorldBuilder {
  /** Preload the environment tile models needed for tiling */
  static async preloadAssets(assetLoader: AssetLoader): Promise<void> {
    await Promise.all(ENV_ASSET_IDS.map((id) => assetLoader.loadModel(id)));
  }

  /**
   * Build a tiled arena environment from Kenney modular pieces.
   * Physics: invisible cuboids (1 floor + 4 walls).
   * Visuals: InstancedMesh tiles layered on top.
   */
  static build(
    arena: Arena,
    scene: THREE.Scene,
    world: RAPIER.World,
    assetLoader: AssetLoader,
  ): WorldBuilderResult {
    const floorRef = assetLoader.getModelSync("kenney_floor");
    const floorDetailRef = assetLoader.getModelSync("kenney_floor_detail");
    const wallRef = assetLoader.getModelSync("kenney_wall");
    const cornerRef = assetLoader.getModelSync("kenney_wall_corner");

    if (!floorRef || !wallRef) {
      console.warn("[WorldBuilder] Critical models missing — using primitive fallback");
      return WorldBuilder.buildFallback(arena, scene, world);
    }

    const objectsToRemove: THREE.Object3D[] = [];
    const bodiesToRemove: RAPIER.RigidBody[] = [];

    // ── Measure actual model bounding boxes for precise spacing ─────────
    const floorDims = measureModel(floorRef);
    const tileW = floorDims.x || 2;  // floor tile width (X)
    const tileD = floorDims.z || 2;  // floor tile depth (Z)

    const wallDims = measureModel(wallRef);
    const wallSegW = wallDims.x || 2; // wall segment width

    console.log(
      `[WorldBuilder] Model dims — floor: ${tileW.toFixed(2)}×${tileD.toFixed(2)}m, wall seg: ${wallSegW.toFixed(2)}m wide`,
    );

    // Snap arena to tile boundaries
    const tilesX = Math.ceil(arena.size.x / tileW);
    const tilesZ = Math.ceil(arena.size.z / tileD);
    const snappedX = tilesX * tileW;
    const snappedZ = tilesZ * tileD;
    const halfX = snappedX / 2;
    const halfZ = snappedZ / 2;

    // ── Floor tiles (checkerboard pattern) ──────────────────────────────
    const totalTiles = tilesX * tilesZ;
    let countA = 0;
    let countB = 0;
    for (let ix = 0; ix < tilesX; ix++) {
      for (let iz = 0; iz < tilesZ; iz++) {
        if ((ix + iz) % 2 === 0) countA++;
        else countB++;
      }
    }

    const useDetail = !!floorDetailRef && countB > 0;
    if (!useDetail) countA = totalTiles;

    const floorA = createInstanced(floorRef, countA, scene);
    objectsToRemove.push(...floorA.meshes);

    let floorB: InstancedSet | null = null;
    if (useDetail) {
      floorB = createInstanced(floorDetailRef!, countB, scene);
      objectsToRemove.push(...floorB.meshes);
    }

    const mat4 = new THREE.Matrix4();
    let idxA = 0;
    let idxB = 0;
    for (let ix = 0; ix < tilesX; ix++) {
      for (let iz = 0; iz < tilesZ; iz++) {
        // Place tiles edge-to-edge using measured tile size
        const x = (ix - tilesX / 2 + 0.5) * tileW;
        const z = (iz - tilesZ / 2 + 0.5) * tileD;
        mat4.identity().setPosition(x, 0, z);

        if ((ix + iz) % 2 === 0 || !floorB) {
          floorA.setMatrix(idxA++, mat4);
        } else {
          floorB.setMatrix(idxB++, mat4);
        }
      }
    }
    floorA.finalize();
    floorB?.finalize();

    // ── Wall segments — single row, facing inward ───────────────────────
    // Use measured wall segment width for spacing along the perimeter
    const wallsNS = Math.ceil(snappedX / wallSegW); // segments per north/south side
    const wallsEW = Math.ceil(snappedZ / wallSegW); // segments per east/west side
    const totalWalls = (wallsNS + wallsEW) * 2;

    const wallInst = createInstanced(wallRef, totalWalls, scene);
    objectsToRemove.push(...wallInst.meshes);

    const pos = new THREE.Vector3();
    const rot = new THREE.Quaternion();
    const scl = new THREE.Vector3(1, 1, 1);
    const euler = new THREE.Euler();
    let wi = 0;

    // Kenney wall models typically face -Z. To make the textured side face
    // inward (toward arena center), we rotate each side appropriately:
    // North (z = -halfZ): face +Z → rotate 180°
    for (let i = 0; i < wallsNS; i++) {
      pos.set((i - wallsNS / 2 + 0.5) * wallSegW, 0, -halfZ);
      euler.set(0, Math.PI, 0);
      rot.setFromEuler(euler);
      mat4.compose(pos, rot, scl);
      wallInst.setMatrix(wi++, mat4);
    }

    // South (z = +halfZ): face -Z → no rotation
    for (let i = 0; i < wallsNS; i++) {
      pos.set((i - wallsNS / 2 + 0.5) * wallSegW, 0, halfZ);
      euler.set(0, 0, 0);
      rot.setFromEuler(euler);
      mat4.compose(pos, rot, scl);
      wallInst.setMatrix(wi++, mat4);
    }

    // West (x = -halfX): face +X → rotate -90°
    for (let i = 0; i < wallsEW; i++) {
      pos.set(-halfX, 0, (i - wallsEW / 2 + 0.5) * wallSegW);
      euler.set(0, -Math.PI / 2, 0);
      rot.setFromEuler(euler);
      mat4.compose(pos, rot, scl);
      wallInst.setMatrix(wi++, mat4);
    }

    // East (x = +halfX): face -X → rotate +90°
    for (let i = 0; i < wallsEW; i++) {
      pos.set(halfX, 0, (i - wallsEW / 2 + 0.5) * wallSegW);
      euler.set(0, Math.PI / 2, 0);
      rot.setFromEuler(euler);
      mat4.compose(pos, rot, scl);
      wallInst.setMatrix(wi++, mat4);
    }

    wallInst.finalize();

    // ── Corner pieces (4 cloned, single row) ────────────────────────────
    if (cornerRef) {
      // Rotation so the inner faces of the L-shaped corner face the arena
      const cornerDefs: [number, number, number][] = [
        [-halfX, -halfZ, Math.PI],         // NW — inner faces toward +X, +Z
        [halfX, -halfZ, -Math.PI / 2],     // NE — inner faces toward -X, +Z
        [-halfX, halfZ, Math.PI / 2],      // SW — inner faces toward +X, -Z
        [halfX, halfZ, 0],                 // SE — inner faces toward -X, -Z
      ];

      for (const [cx, cz, cRot] of cornerDefs) {
        const clone = cornerRef.clone();
        clone.position.set(cx, 0, cz);
        clone.rotation.set(0, cRot, 0);
        scene.add(clone);
        objectsToRemove.push(clone);
      }
    }

    // ── Physics cuboids ─────────────────────────────────────────────────
    // Floor (thin slab at y = 0)
    const floorBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(snappedX / 2, 0.05, snappedZ / 2).setFriction(1.0),
      floorBody,
    );
    bodiesToRemove.push(floorBody);

    // 4 wall cuboids (full arena wallHeight for reliable blocking)
    const wh = arena.wallHeight;
    const wt = 0.25;
    const wallPhysics: [number, number, number, number, number, number][] = [
      [0, wh / 2, -halfZ, snappedX / 2, wh / 2, wt],   // North
      [0, wh / 2, halfZ, snappedX / 2, wh / 2, wt],     // South
      [-halfX, wh / 2, 0, wt, wh / 2, snappedZ / 2],    // West
      [halfX, wh / 2, 0, wt, wh / 2, snappedZ / 2],     // East
    ];
    for (const [x, y, z, hw, hh, hd] of wallPhysics) {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hw, hh, hd).setFriction(0.5),
        body,
      );
      bodiesToRemove.push(body);
    }

    console.log(
      `[WorldBuilder] Built ${totalTiles} floor tiles (${tileW.toFixed(2)}×${tileD.toFixed(2)}m) + ${totalWalls} wall segs (${wallSegW.toFixed(2)}m) + 4 corners`,
    );

    return {
      dispose() {
        for (const obj of objectsToRemove) {
          scene.remove(obj);
          if (obj instanceof THREE.InstancedMesh) {
            obj.dispose();
          }
        }
        for (const body of bodiesToRemove) {
          world.removeRigidBody(body);
        }
      },
    };
  }

  /** Fallback: primitive colored boxes (replicates old ArenaBuilder) */
  private static buildFallback(
    arena: Arena,
    scene: THREE.Scene,
    world: RAPIER.World,
  ): WorldBuilderResult {
    const { size, wallHeight, floorMaterial: floorMat, wallMaterial: wallMat } = arena;
    const objectsToRemove: THREE.Object3D[] = [];
    const bodiesToRemove: RAPIER.RigidBody[] = [];

    // Floor
    const floorGeo = new THREE.BoxGeometry(size.x, 1, size.z);
    const floorMatl = new THREE.MeshStandardMaterial({
      color: floorMat.color,
      roughness: floorMat.roughness,
      metalness: floorMat.metalness,
    });
    const floor = new THREE.Mesh(floorGeo, floorMatl);
    floor.position.set(0, -0.5, 0);
    floor.receiveShadow = true;
    scene.add(floor);
    objectsToRemove.push(floor);

    const grid = new THREE.GridHelper(
      Math.max(size.x, size.z),
      Math.max(size.x, size.z),
      0x444466,
      0x333355,
    );
    scene.add(grid);
    objectsToRemove.push(grid);

    // Floor physics
    const floorBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x / 2, 0.5, size.z / 2).setFriction(1.0),
      floorBody,
    );
    bodiesToRemove.push(floorBody);

    // Walls
    const wallMatl = new THREE.MeshStandardMaterial({
      color: wallMat.color,
      roughness: wallMat.roughness,
      metalness: wallMat.metalness,
    });
    const wallDefs: [number, number, number, number][] = [
      [0, -size.z / 2, size.x, 0.5],
      [0, size.z / 2, size.x, 0.5],
      [-size.x / 2, 0, 0.5, size.z],
      [size.x / 2, 0, 0.5, size.z],
    ];
    for (const [x, z, w, d] of wallDefs) {
      const geo = new THREE.BoxGeometry(w, wallHeight, d);
      const mesh = new THREE.Mesh(geo, wallMatl);
      mesh.position.set(x, wallHeight / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      objectsToRemove.push(mesh);

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(x, wallHeight / 2, z),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, wallHeight / 2, d / 2).setFriction(0.5),
        body,
      );
      bodiesToRemove.push(body);
    }

    return {
      dispose() {
        for (const obj of objectsToRemove) {
          scene.remove(obj);
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const mat = obj.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else (mat as THREE.Material).dispose();
          }
        }
        for (const body of bodiesToRemove) {
          world.removeRigidBody(body);
        }
      },
    };
  }
}

// ── InstancedMesh helper ────────────────────────────────────────────────────

interface InstancedEntry {
  mesh: THREE.InstancedMesh;
  childMatrix: THREE.Matrix4;
}

interface InstancedSet {
  meshes: THREE.InstancedMesh[];
  setMatrix(index: number, matrix: THREE.Matrix4): void;
  finalize(): void;
}

/**
 * Traverse a GLB Group, create one InstancedMesh per child Mesh,
 * and return a handle to set per-instance transforms.
 *
 * Does NOT own geometry/material — they're shared with AssetLoader cache.
 */
function createInstanced(
  refModel: THREE.Group,
  count: number,
  scene: THREE.Scene,
): InstancedSet {
  const entries: InstancedEntry[] = [];

  refModel.updateMatrixWorld(true);
  const groupInverse = refModel.matrixWorld.clone().invert();

  refModel.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const childMatrix = new THREE.Matrix4().multiplyMatrices(
        groupInverse,
        child.matrixWorld,
      );
      const inst = new THREE.InstancedMesh(child.geometry, child.material, count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      scene.add(inst);
      entries.push({ mesh: inst, childMatrix });
    }
  });

  const composed = new THREE.Matrix4();
  return {
    meshes: entries.map((e) => e.mesh),
    setMatrix(index: number, matrix: THREE.Matrix4) {
      for (const entry of entries) {
        composed.multiplyMatrices(matrix, entry.childMatrix);
        entry.mesh.setMatrixAt(index, composed);
      }
    },
    finalize() {
      for (const entry of entries) {
        entry.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
