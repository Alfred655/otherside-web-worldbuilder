import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Arena } from "@otherside/shared";

interface ArenaMeshes {
  floor: THREE.Mesh;
  walls: THREE.Mesh[];
  bodies: RAPIER.RigidBody[];
}

export class ArenaBuilder {
  private meshes: ArenaMeshes | null = null;

  build(arena: Arena, scene: THREE.Scene, world: RAPIER.World): void {
    if (arena.shape === "rectangle") {
      this.meshes = this.buildRectangle(arena, scene, world);
    } else {
      this.meshes = this.buildCircle(arena, scene, world);
    }
  }

  private buildRectangle(arena: Arena, scene: THREE.Scene, world: RAPIER.World): ArenaMeshes {
    const { size, wallHeight, floorMaterial: floorMat, wallMaterial: wallMat } = arena;
    const walls: THREE.Mesh[] = [];
    const bodies: RAPIER.RigidBody[] = [];

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

    // Floor physics
    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const floorBody = world.createRigidBody(floorBodyDesc);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x / 2, 0.5, size.z / 2).setFriction(1.0),
      floorBody,
    );
    bodies.push(floorBody);

    // Grid helper
    const grid = new THREE.GridHelper(
      Math.max(size.x, size.z),
      Math.max(size.x, size.z),
      0x444466,
      0x333355,
    );
    scene.add(grid);

    // Walls
    const wallPositions: [number, number, number, number, number][] = [
      // [x, z, width, depth, rotY]
      [0, -size.z / 2, size.x, 0.5, 0],          // back
      [0, size.z / 2, size.x, 0.5, 0],            // front
      [-size.x / 2, 0, 0.5, size.z, 0],           // left
      [size.x / 2, 0, 0.5, size.z, 0],            // right
    ];

    const wallMatl = new THREE.MeshStandardMaterial({
      color: wallMat.color,
      roughness: wallMat.roughness,
      metalness: wallMat.metalness,
    });

    for (const [x, z, w, d] of wallPositions) {
      const geo = new THREE.BoxGeometry(w, wallHeight, d);
      const mesh = new THREE.Mesh(geo, wallMatl);
      mesh.position.set(x, wallHeight / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      walls.push(mesh);

      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, wallHeight / 2, z);
      const body = world.createRigidBody(bodyDesc);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, wallHeight / 2, d / 2).setFriction(0.5),
        body,
      );
      bodies.push(body);
    }

    return { floor, walls, bodies };
  }

  private buildCircle(arena: Arena, scene: THREE.Scene, world: RAPIER.World): ArenaMeshes {
    const { size, wallHeight, floorMaterial: floorMat, wallMaterial: wallMat } = arena;
    const radius = size.x / 2;
    const walls: THREE.Mesh[] = [];
    const bodies: RAPIER.RigidBody[] = [];

    // Floor — flat cylinder
    const floorGeo = new THREE.CylinderGeometry(radius, radius, 1, 32);
    const floorMatl = new THREE.MeshStandardMaterial({
      color: floorMat.color,
      roughness: floorMat.roughness,
      metalness: floorMat.metalness,
    });
    const floor = new THREE.Mesh(floorGeo, floorMatl);
    floor.position.set(0, -0.5, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor physics (approximate with a cuboid)
    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const floorBody = world.createRigidBody(floorBodyDesc);
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.5, radius).setFriction(1.0),
      floorBody,
    );
    bodies.push(floorBody);

    // Wall segments — 20 boxes arranged in a circle
    const segments = 20;
    const segmentWidth = (2 * Math.PI * radius) / segments;
    const wallMatl = new THREE.MeshStandardMaterial({
      color: wallMat.color,
      roughness: wallMat.roughness,
      metalness: wallMat.metalness,
    });

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const geo = new THREE.BoxGeometry(segmentWidth, wallHeight, 0.5);
      const mesh = new THREE.Mesh(geo, wallMatl);
      mesh.position.set(x, wallHeight / 2, z);
      mesh.rotation.y = -angle + Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      walls.push(mesh);

      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, wallHeight / 2, z);
      const body = world.createRigidBody(bodyDesc);
      const colDesc = RAPIER.ColliderDesc.cuboid(segmentWidth / 2, wallHeight / 2, 0.25)
        .setFriction(0.5);
      // Rotate the collider
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle + Math.PI / 2, 0));
      colDesc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
      world.createCollider(colDesc, body);
      bodies.push(body);
    }

    return { floor, walls, bodies };
  }

  dispose(scene: THREE.Scene, world: RAPIER.World): void {
    if (!this.meshes) return;

    scene.remove(this.meshes.floor);
    this.meshes.floor.geometry.dispose();
    (this.meshes.floor.material as THREE.Material).dispose();

    for (const wall of this.meshes.walls) {
      scene.remove(wall);
      wall.geometry.dispose();
      (wall.material as THREE.Material).dispose();
    }

    for (const body of this.meshes.bodies) {
      world.removeRigidBody(body);
    }

    this.meshes = null;
  }
}
