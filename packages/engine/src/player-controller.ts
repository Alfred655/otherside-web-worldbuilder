import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PlayerConfig } from "@otherside/shared";

const EYE_OFFSET = 0.55;
const MAX_PITCH = Math.PI / 2 - 0.01;

export class PlayerController {
  private yaw = 0;
  private pitch = 0;
  private verticalVelocity = 0;
  private keys = new Set<string>();
  private locked = false;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onPointerLockChange: () => void;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private body: RAPIER.RigidBody,
    private collider: RAPIER.Collider,
    private controller: RAPIER.KinematicCharacterController,
    private config: PlayerConfig,
    private gravity: number,
  ) {
    this.camera.rotation.order = "YXZ";

    this.onKeyDown = (e) => this.keys.add(e.code);
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onMouseMove = (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.002;
      this.pitch -= e.movementY * 0.002;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    };
    this.onPointerLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.keys.clear();
    };

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
  }

  get isLocked() {
    return this.locked;
  }

  get position(): { x: number; y: number; z: number } {
    return this.body.translation();
  }

  requestLock() {
    this.canvas.requestPointerLock();
  }

  exitLock() {
    if (this.locked) document.exitPointerLock();
  }

  resetTo(x: number, y: number, z: number) {
    this.body.setNextKinematicTranslation({ x, y, z });
    this.verticalVelocity = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.keys.clear();
  }

  update(dt: number) {
    if (!this.locked) return;

    // --- horizontal movement ---
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.yaw,
    );
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.yaw,
    );

    const move = new THREE.Vector3();
    if (this.keys.has("KeyW")) move.add(forward);
    if (this.keys.has("KeyS")) move.sub(forward);
    if (this.keys.has("KeyD")) move.add(right);
    if (this.keys.has("KeyA")) move.sub(right);
    if (move.lengthSq() > 0) move.normalize();
    move.multiplyScalar(this.config.movementSpeed * dt);

    // --- gravity + jump ---
    this.verticalVelocity += this.gravity * dt;

    if (this.keys.has("Space") && this.controller.computedGrounded()) {
      this.verticalVelocity = this.config.jumpForce;
    }

    const desired = { x: move.x, y: this.verticalVelocity * dt, z: move.z };
    this.controller.computeColliderMovement(this.collider, desired);

    const corrected = this.controller.computedMovement();
    if (this.controller.computedGrounded() && this.verticalVelocity < 0) {
      this.verticalVelocity = 0;
    }

    const pos = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: pos.x + corrected.x,
      y: pos.y + corrected.y,
      z: pos.z + corrected.z,
    });

    // --- camera ---
    const p = this.body.translation();
    this.camera.position.set(p.x, p.y + EYE_OFFSET, p.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  dispose() {
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
  }
}
