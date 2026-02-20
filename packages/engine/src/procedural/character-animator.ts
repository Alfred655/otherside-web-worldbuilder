import * as THREE from "three";

export type AnimPreset = "humanoid" | "creature" | "flying" | "turret";

export interface CharacterAnimation {
  update(dt: number, isMoving: boolean): void;
  dispose(): void;
}

/**
 * Create procedural animation for a character group.
 * CONSTRAINT: only modifies child-level local transforms, never the root Group position.
 */
export function createCharacterAnimation(
  group: THREE.Group,
  presetType: AnimPreset,
): CharacterAnimation {
  let time = 0;

  // Cache child references
  const children = new Map<string, THREE.Object3D>();
  for (const child of group.children) {
    if (child.name) children.set(child.name, child);
  }

  // Store original positions/rotations for reset
  const originals = new Map<string, { pos: THREE.Vector3; rot: THREE.Euler }>();
  for (const [name, child] of children) {
    originals.set(name, {
      pos: child.position.clone(),
      rot: child.rotation.clone(),
    });
  }

  function resetToOriginals() {
    for (const [name, child] of children) {
      const orig = originals.get(name);
      if (orig) {
        child.position.copy(orig.pos);
        child.rotation.copy(orig.rot);
      }
    }
  }

  const animators: Record<AnimPreset, (dt: number, isMoving: boolean) => void> = {
    humanoid(dt, isMoving) {
      time += dt;
      const body = children.get("body");
      const head = children.get("head");
      const leftArm = children.get("leftArm");
      const rightArm = children.get("rightArm");
      const leftLeg = children.get("leftLeg");
      const rightLeg = children.get("rightLeg");

      if (isMoving) {
        // Walk cycle: arms/legs swing opposite
        const swing = Math.sin(time * 8) * 0.4;
        if (leftArm) {
          const orig = originals.get("leftArm")!;
          leftArm.rotation.set(swing, 0, 0);
          leftArm.position.y = orig.pos.y;
        }
        if (rightArm) {
          const orig = originals.get("rightArm")!;
          rightArm.rotation.set(-swing, 0, 0);
          rightArm.position.y = orig.pos.y;
        }
        if (leftLeg) {
          leftLeg.rotation.set(-swing, 0, 0);
        }
        if (rightLeg) {
          rightLeg.rotation.set(swing, 0, 0);
        }
        // Slight body tilt
        if (body) {
          body.rotation.x = Math.sin(time * 8) * 0.02;
        }
      } else {
        // Idle bob
        resetToOriginals();
        const bob = Math.sin(time * 2) * 0.03;
        if (body) body.position.y = originals.get("body")!.pos.y + bob;
        if (head) head.position.y = originals.get("head")!.pos.y + bob;
      }
    },

    creature(dt, isMoving) {
      time += dt;
      const body = children.get("body");
      const legFL = children.get("legFL");
      const legFR = children.get("legFR");
      const legBL = children.get("legBL");
      const legBR = children.get("legBR");
      const tail = children.get("tail");

      if (isMoving) {
        // Trot gait: diagonal pairs
        const swing = Math.sin(time * 10) * 0.35;
        if (legFL) legFL.rotation.set(swing, 0, 0);
        if (legBR) legBR.rotation.set(swing, 0, 0);
        if (legFR) legFR.rotation.set(-swing, 0, 0);
        if (legBL) legBL.rotation.set(-swing, 0, 0);
        // Body bounce
        if (body) body.position.y = originals.get("body")!.pos.y + Math.abs(Math.sin(time * 10)) * 0.05;
      } else {
        resetToOriginals();
        const bob = Math.sin(time * 2) * 0.02;
        if (body) body.position.y = originals.get("body")!.pos.y + bob;
      }

      // Tail wag
      if (tail) {
        tail.rotation.y = Math.sin(time * 4) * 0.3;
      }
    },

    flying(dt, isMoving) {
      time += dt;
      const body = children.get("body");
      const wingL = children.get("wingL");
      const wingR = children.get("wingR");

      // Wings always flap
      const flapSpeed = isMoving ? 15 : 6;
      const flapAngle = isMoving ? 0.5 : 0.3;
      const flap = Math.sin(time * flapSpeed) * flapAngle;

      if (wingL) {
        const orig = originals.get("wingL")!;
        wingL.rotation.set(orig.rot.x, orig.rot.y, orig.rot.z + flap);
      }
      if (wingR) {
        const orig = originals.get("wingR")!;
        wingR.rotation.set(orig.rot.x, orig.rot.y, orig.rot.z - flap);
      }

      // Forward tilt when moving
      if (body) {
        body.rotation.x = isMoving ? 0.15 : 0;
        body.position.y = originals.get("body")!.pos.y + Math.sin(time * 3) * 0.05;
      }
    },

    turret(dt, _isMoving) {
      time += dt;
      const barrel = children.get("barrel");

      // Slight barrel oscillation
      if (barrel) {
        const orig = originals.get("barrel")!;
        barrel.rotation.x = orig.rot.x + Math.sin(time * 1.5) * 0.05;
      }
    },
  };

  const animator = animators[presetType];

  return {
    update(dt: number, isMoving: boolean) {
      animator(dt, isMoving);
    },
    dispose() {
      // Nothing to dispose — just stops being called
    },
  };
}

/**
 * Detect animation preset from a group's child names.
 */
export function detectPreset(group: THREE.Group): AnimPreset | null {
  const names = new Set(group.children.map((c) => c.name));
  if (names.has("wingL") || names.has("wingR")) return "flying";
  if (names.has("barrel")) return "turret";
  if (names.has("legFL") || names.has("legFR")) return "creature";
  if (names.has("leftArm") || names.has("rightArm")) return "humanoid";
  // Generic compound meshes without named parts — no animation
  return null;
}
