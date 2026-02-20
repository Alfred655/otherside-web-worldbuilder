import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type {
  GameSpec,
  Entity,
  Mesh as MeshSpec,
  Vec3,
  SpawnTemplate,
} from "@otherside/shared";
import type { RuntimeEntity, SpawnRequest } from "./types.js";
import { PlayerController } from "./player-controller.js";
import { BehaviorManager } from "./behavior-manager.js";
import { HealthBar } from "./health-bar.js";
import { HUD } from "./hud.js";
import {
  buildProceduralSky,
  buildProceduralTerrain,
  generateScatter,
  buildCompoundMesh,
  collectMaterials,
  generateTexture,
  hashString,
  createCharacterAnimation,
  detectPreset,
} from "./procedural/index.js";
import type {
  SkyResult,
  TerrainResult,
  ScatterResult,
  CharacterAnimation,
} from "./procedural/index.js";

export type { RuntimeEntity } from "./types.js";

const FIXED_DT = 1 / 60;
const PLAYER_HALF_HEIGHT = 0.45;
const PLAYER_RADIUS = 0.3;
const FALL_Y = -20;
const ATTACK_FLASH_DURATION = 0.35;

type GameState = "waiting" | "playing" | "won" | "lost";

export class GameRenderer {
  // Three.js
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  // Rapier
  private world!: RAPIER.World;
  private eventQueue!: RAPIER.EventQueue;

  // Game objects
  private entities: RuntimeEntity[] = [];
  private playerCtrl!: PlayerController;
  private playerColliderHandle = -1;
  private playerCollider: RAPIER.Collider | null = null;
  private behaviors = new BehaviorManager();
  private hud!: HUD;

  // Collision map: collider handle → entity
  private colliderMap = new Map<number, RuntimeEntity>();

  // State
  private score = 0;
  private health = 100;
  private state: GameState = "waiting";
  private lastTime = 0;
  private accumulator = 0;
  private animId = 0;
  private attackCooldown = 0;

  // Damage flash timers
  private flashTimers = new Map<string, number>();

  // Attack line VFX (uses a mesh since THREE.Line linewidth > 1 is ignored on macOS)
  private attackLine: THREE.Mesh | null = null;
  private attackLineTimer = 0;

  // Procedural systems
  private sky: SkyResult | null = null;
  private terrainResult: TerrainResult | null = null;
  private scatterResult: ScatterResult | null = null;
  private characterAnimations = new Map<string, CharacterAnimation>();
  private lastEntityPositions = new Map<string, THREE.Vector3>();

  constructor(private spec: GameSpec) {}

  // ── Initialisation ──────────────────────────────────────────────────────
  init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.spec.world.skyColor);

    if (this.spec.world.fog) {
      this.scene.fog = new THREE.Fog(
        this.spec.world.fog.color,
        this.spec.world.fog.near,
        this.spec.world.fog.far,
      );
    }

    // lights
    const ambient = new THREE.AmbientLight(
      this.spec.world.ambientLightColor,
      this.spec.world.ambientLightIntensity,
    );
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 80;
    const S = 30;
    sun.shadow.camera.left = -S;
    sun.shadow.camera.right = S;
    sun.shadow.camera.top = S;
    sun.shadow.camera.bottom = -S;
    this.scene.add(sun);

    // Procedural sky (if timeOfDay is set)
    this.sky = buildProceduralSky(
      this.scene,
      this.spec.world,
      { x: this.spec.terrain.size.x, z: this.spec.terrain.size.z },
    );
    if (this.sky) {
      // Update directional light to match sun direction
      sun.position.copy(this.sky.sunDirection.clone().multiplyScalar(30));
      sun.intensity = this.sky.sunDirection.y > 0 ? 1.0 : 0.15;
      if (this.sky.sunDirection.y <= 0) {
        sun.color.set(0x4466aa); // moonlight tint
      }
    }

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );

    // physics
    this.world = new RAPIER.World(this.spec.world.gravity);
    this.eventQueue = new RAPIER.EventQueue(true);

    this.buildTerrain();

    for (const entSpec of this.spec.entities) {
      const ent = this.spawnEntity(entSpec, false);
      this.entities.push(ent);
    }

    this.initPlayer();
    this.hud = new HUD(this.spec.ui.hudElements);

    window.addEventListener("resize", this.onResize);
    document.addEventListener("mousedown", this.onMouseDown);
    this.renderer.domElement.addEventListener("click", this.onClick);
  }

  // ── Game loop ───────────────────────────────────────────────────────────
  start() {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private loop = (time: number) => {
    this.animId = requestAnimationFrame(this.loop);

    const frameDt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    if (this.state !== "playing") {
      // still update health bars billboard in waiting state
      this.updateHealthBars();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // attack cooldown
    this.attackCooldown = Math.max(0, this.attackCooldown - frameDt);

    // attack line VFX decay
    if (this.attackLine) {
      this.attackLineTimer -= frameDt;
      if (this.attackLineTimer <= 0) {
        this.scene.remove(this.attackLine);
        this.attackLine.geometry.dispose();
        (this.attackLine.material as THREE.Material).dispose();
        this.attackLine = null;
      } else {
        // Fade out the attack line
        const mat = this.attackLine.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, this.attackLineTimer / ATTACK_FLASH_DURATION);
      }
    }

    // damage flash decay
    for (const [id, t] of this.flashTimers) {
      const remaining = t - frameDt;
      if (remaining <= 0) {
        this.flashTimers.delete(id);
        const ent = this.entities.find((e) => e.spec.id === id);
        if (ent) this.restoreColor(ent);
      } else {
        this.flashTimers.set(id, remaining);
      }
    }

    // fixed-step physics + behaviors
    this.accumulator += frameDt;
    while (this.accumulator >= FIXED_DT) {
      const events = this.behaviors.tick(
        this.entities,
        this.playerCtrl.position,
        FIXED_DT,
      );
      this.applyBehaviorEvents(events);
      this.playerCtrl.update(FIXED_DT);
      this.world.step(this.eventQueue);
      this.processCollisionEvents();
      this.accumulator -= FIXED_DT;
    }

    this.syncTransforms();

    // Animate procedural sky (cloud movement)
    this.sky?.update(frameDt);

    // Tick character animations
    for (const ent of this.entities) {
      if (!ent.active) continue;
      const anim = this.characterAnimations.get(ent.spec.id);
      if (!anim) continue;
      const lastPos = this.lastEntityPositions.get(ent.spec.id);
      const curPos = ent.object3d.position;
      let isMoving = false;
      if (lastPos) {
        const dx = curPos.x - lastPos.x;
        const dz = curPos.z - lastPos.z;
        isMoving = (dx * dx + dz * dz) > 0.0001;
        lastPos.copy(curPos);
      }
      anim.update(frameDt, isMoving);
    }

    this.updateHealthBars();
    this.checkEndConditions();
    this.hud.tick(frameDt);
    this.hud.update(this.score, this.health);
    this.renderer.render(this.scene, this.camera);
  };

  // ── Behavior event processing ─────────────────────────────────────────
  private applyBehaviorEvents(events: ReturnType<BehaviorManager["tick"]>) {
    this.score += events.scored;
    if (events.damaged > 0) {
      this.health -= events.damaged;
      this.hud.flashDamage();
    }
    this.health = Math.min(100, this.health + events.healed);

    for (const id of events.destroyIds) {
      const ent = this.entities.find((e) => e.spec.id === id);
      if (ent) this.destroyEntity(ent);
    }

    for (const req of events.spawnRequests) {
      this.handleSpawnRequest(req);
    }
  }

  // ── Collision events (Rapier EventQueue) ──────────────────────────────
  private processCollisionEvents() {
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;

      const isPlayer1 = h1 === this.playerColliderHandle;
      const isPlayer2 = h2 === this.playerColliderHandle;
      if (!isPlayer1 && !isPlayer2) return; // only care about player collisions

      const otherHandle = isPlayer1 ? h2 : h1;
      const ent = this.colliderMap.get(otherHandle);
      if (!ent || !ent.active) return;

      // Projectile → damage player and destroy projectile
      if (ent.spec.type === "projectile") {
        const projBehavior = ent.spec.behaviors.find(
          (b) => b.type === "projectile",
        );
        if (projBehavior && projBehavior.type === "projectile") {
          this.health -= projBehavior.damage;
          this.hud.flashDamage();
          this.destroyEntity(ent);
        }
      }
    });
  }

  // ── Terrain ─────────────────────────────────────────────────────────────
  private buildTerrain() {
    const { size, material } = this.spec.terrain;

    if (this.spec.terrain.type === "procedural") {
      // Procedural terrain with heightmap
      this.terrainResult = buildProceduralTerrain(
        this.spec.terrain,
        this.spec.name,
        this.scene,
      );

      // Rapier heightfield collider
      const { heights, nrows, ncols } = this.terrainResult;
      const bodyDesc = RAPIER.RigidBodyDesc.fixed();
      const body = this.world.createRigidBody(bodyDesc);
      const colDesc = RAPIER.ColliderDesc.heightfield(
        nrows,
        ncols,
        heights,
        { x: size.x, y: 1, z: size.z },
      ).setFriction(1.0);
      this.world.createCollider(colDesc, body);

      // Scatter system
      const seed = this.spec.terrain.seed ?? hashString(this.spec.name);
      this.scatterResult = generateScatter(
        this.terrainResult,
        this.spec.terrain,
        this.scene,
        this.world,
        seed,
      );
      return;
    }

    // Flat terrain (existing path)
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({
      color: material.color,
      roughness: material.roughness,
      metalness: material.metalness,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -size.y / 2, 0);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const grid = new THREE.GridHelper(
      Math.max(size.x, size.z),
      Math.max(size.x, size.z),
      0x444466,
      0x333355,
    );
    this.scene.add(grid);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -size.y / 2, 0);
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2,
    ).setFriction(1.0);
    this.world.createCollider(colDesc, body);
  }

  // ── Entity spawning ─────────────────────────────────────────────────────
  private spawnEntity(entSpec: Entity, spawned: boolean): RuntimeEntity {
    const { transform, mesh: meshSpec, material: matSpec, physics } = entSpec;
    const scale = transform.scale;

    let object3d: THREE.Object3D;
    let materials: THREE.MeshStandardMaterial[];

    if (meshSpec.kind === "compound") {
      // Compound mesh — group of parts
      const group = buildCompoundMesh(meshSpec.parts, matSpec.color);
      group.position.set(transform.position.x, transform.position.y, transform.position.z);
      group.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
      this.scene.add(group);
      object3d = group;
      materials = collectMaterials(group);

      // Set up character animation if parts match a known preset
      const preset = detectPreset(group);
      if (preset) {
        const anim = createCharacterAnimation(group, preset);
        this.characterAnimations.set(entSpec.id, anim);
        this.lastEntityPositions.set(entSpec.id, new THREE.Vector3(
          transform.position.x, transform.position.y, transform.position.z,
        ));
      }
    } else {
      // Primitive or model mesh — single mesh
      const geo = this.makeGeometry(meshSpec, scale);
      const mat = this.buildMaterial(matSpec);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
      mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      object3d = mesh;
      materials = [mat];
    }

    let body: RAPIER.RigidBody | null = null;
    let collider: RAPIER.Collider | null = null;

    if (physics) {
      const bodyDesc = this.makeBodyDesc(physics.bodyType, transform.position);
      body = this.world.createRigidBody(bodyDesc);
      const colDesc = this.makeColliderDesc(physics.collider, meshSpec, scale);
      if (colDesc) {
        if (physics.friction !== undefined) colDesc.setFriction(physics.friction);
        if (physics.restitution !== undefined) colDesc.setRestitution(physics.restitution);
        if (physics.mass !== undefined) colDesc.setMass(physics.mass);
        if (physics.sensor) colDesc.setSensor(true);
        colDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        collider = this.world.createCollider(colDesc, body);
      }
    }

    // health
    const hp = entSpec.health ?? 0;
    let healthBar: HealthBar | null = null;
    if (hp > 0 && entSpec.type === "npc") {
      healthBar = new HealthBar();
      healthBar.group.position.set(0, 1.5, 0);
      object3d.add(healthBar.group);
    }

    const ent: RuntimeEntity = {
      spec: entSpec,
      object3d,
      body,
      collider,
      active: true,
      health: hp,
      maxHealth: hp,
      healthBar,
      materials,
      spawned,
      age: 0,
    };

    if (collider) {
      this.colliderMap.set(collider.handle, ent);
    }

    return ent;
  }

  /** Build a MeshStandardMaterial, applying procedural texture if specified. */
  private buildMaterial(matSpec: { color: string; roughness: number; metalness: number; proceduralTexture?: string }): THREE.MeshStandardMaterial {
    const opts: THREE.MeshStandardMaterialParameters = {
      color: matSpec.color,
      roughness: matSpec.roughness,
      metalness: matSpec.metalness,
    };

    if (matSpec.proceduralTexture) {
      const tex = generateTexture(
        matSpec.proceduralTexture as "wood" | "stone" | "metal" | "fabric",
        matSpec.color,
      );
      opts.map = tex;
    }

    return new THREE.MeshStandardMaterial(opts);
  }

  /** Spawn an entity at runtime from a SpawnTemplate */
  private handleSpawnRequest(req: SpawnRequest) {
    const id = this.behaviors.nextSpawnId();

    // Build a full Entity spec from the template
    const tmpl = req.template;
    const behaviors = [...tmpl.behaviors];

    // If aimAtPlayer, find projectile behavior and override direction
    if (req.aimTarget) {
      for (let i = 0; i < behaviors.length; i++) {
        const b = behaviors[i];
        if (b.type === "projectile") {
          const dx = req.aimTarget.x - req.position.x;
          const dy = req.aimTarget.y - req.position.y;
          const dz = req.aimTarget.z - req.position.z;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          behaviors[i] = { ...b, direction: { x: dx / len, y: dy / len, z: dz / len } };
        }
      }
    }

    const entSpec: Entity = {
      id,
      name: tmpl.name,
      type: tmpl.type,
      transform: {
        position: req.position,
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: tmpl.mesh,
      material: tmpl.material,
      physics: tmpl.physics,
      behaviors,
      health: tmpl.health,
    };

    const ent = this.spawnEntity(entSpec, true);
    this.entities.push(ent);

    // register with the spawner's count tracking
    // find which spawner requested this (the last one that made a request
    // in this tick with the matching template name)
    for (const parent of this.entities) {
      if (!parent.active) continue;
      for (const b of parent.spec.behaviors) {
        if (b.type === "spawner" && b.template.name === tmpl.name) {
          this.behaviors.registerSpawned(parent.spec.id, id);
          break;
        }
      }
    }
  }

  // ── Geometry / body / collider helpers ────────────────────────────────
  private makeGeometry(meshSpec: MeshSpec, scale: Vec3): THREE.BufferGeometry {
    const s =
      meshSpec.kind === "primitive" && meshSpec.size
        ? meshSpec.size
        : { x: 1, y: 1, z: 1 };

    if (meshSpec.kind === "model" || meshSpec.kind === "compound") {
      return new THREE.BoxGeometry(scale.x, scale.y, scale.z);
    }

    switch (meshSpec.shape) {
      case "box":
        return new THREE.BoxGeometry(s.x * scale.x, s.y * scale.y, s.z * scale.z);
      case "sphere":
        return new THREE.SphereGeometry((s.x * scale.x) / 2, 24, 24);
      case "cylinder":
        return new THREE.CylinderGeometry(
          (s.x * scale.x) / 2,
          (s.x * scale.x) / 2,
          s.y * scale.y,
          24,
        );
      case "plane":
        return new THREE.PlaneGeometry(s.x * scale.x, s.z * scale.z);
      default:
        return new THREE.BoxGeometry(scale.x, scale.y, scale.z);
    }
  }

  private makeBodyDesc(
    type: "static" | "dynamic" | "kinematic",
    pos: Vec3,
  ): RAPIER.RigidBodyDesc {
    switch (type) {
      case "static":
        return RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
      case "dynamic":
        return RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z);
      case "kinematic":
        return RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          pos.x,
          pos.y,
          pos.z,
        );
    }
  }

  private makeColliderDesc(
    shape: string,
    meshSpec: MeshSpec,
    scale: Vec3,
  ): RAPIER.ColliderDesc | null {
    // Compound mesh: use boundingSize or compute AABB from parts
    if (meshSpec.kind === "compound") {
      const bs = meshSpec.boundingSize ?? this.computeCompoundBounds(meshSpec.parts);
      if (shape === "capsule") {
        return RAPIER.ColliderDesc.capsule(
          (bs.y * scale.y) / 2,
          (Math.max(bs.x, bs.z) * scale.x) / 2,
        );
      }
      return RAPIER.ColliderDesc.cuboid(
        (bs.x * scale.x) / 2,
        (bs.y * scale.y) / 2,
        (bs.z * scale.z) / 2,
      );
    }

    const s =
      meshSpec.kind === "primitive" && meshSpec.size
        ? meshSpec.size
        : { x: 1, y: 1, z: 1 };

    switch (shape) {
      case "box":
        return RAPIER.ColliderDesc.cuboid(
          (s.x * scale.x) / 2,
          (s.y * scale.y) / 2,
          (s.z * scale.z) / 2,
        );
      case "sphere":
        return RAPIER.ColliderDesc.ball((s.x * scale.x) / 2);
      case "cylinder":
        return RAPIER.ColliderDesc.cylinder(
          (s.y * scale.y) / 2,
          (s.x * scale.x) / 2,
        );
      case "capsule":
        return RAPIER.ColliderDesc.capsule(
          (s.y * scale.y) / 2,
          (s.x * scale.x) / 2,
        );
      default:
        return RAPIER.ColliderDesc.cuboid(
          (s.x * scale.x) / 2,
          (s.y * scale.y) / 2,
          (s.z * scale.z) / 2,
        );
    }
  }

  private computeCompoundBounds(parts: { size: Vec3; offset: Vec3 }[]): Vec3 {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of parts) {
      const hx = p.size.x / 2, hy = p.size.y / 2, hz = p.size.z / 2;
      minX = Math.min(minX, p.offset.x - hx);
      maxX = Math.max(maxX, p.offset.x + hx);
      minY = Math.min(minY, p.offset.y - hy);
      maxY = Math.max(maxY, p.offset.y + hy);
      minZ = Math.min(minZ, p.offset.z - hz);
      maxZ = Math.max(maxZ, p.offset.z + hz);
    }
    return { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
  }

  // ── Player ──────────────────────────────────────────────────────────────
  private initPlayer() {
    const sp = this.spec.player.spawnPoint;

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      sp.x,
      sp.y,
      sp.z,
    );
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(colDesc, body);
    this.playerColliderHandle = collider.handle;
    this.playerCollider = collider;

    const charCtrl = this.world.createCharacterController(0.02);
    charCtrl.enableAutostep(0.4, 0.2, true);
    charCtrl.enableSnapToGround(0.4);
    charCtrl.setApplyImpulsesToDynamicBodies(true);

    this.playerCtrl = new PlayerController(
      this.camera,
      this.renderer.domElement,
      body,
      collider,
      charCtrl,
      this.spec.player,
      this.spec.world.gravity.y,
    );
  }

  // ── Attack (left-click raycast) ────────────────────────────────────────
  private performAttack() {
    const camOrigin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    this.camera.getWorldPosition(camOrigin);
    this.camera.getWorldDirection(dir);

    // Offset origin 0.5 units forward so the ray starts OUTSIDE the player's
    // capsule collider (camera is inside it). Without this, castRay returns
    // the player's own collider at toi=0 and never reaches enemies.
    const origin = camOrigin.clone().add(dir.clone().multiplyScalar(0.5));

    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
    );

    const maxToi = this.spec.player.attackRange;

    // Exclude the player's own collider from the raycast
    const hit = this.world.castRay(
      ray,
      maxToi,
      true,
      undefined,            // filterFlags
      undefined,            // filterGroups
      this.playerCollider!, // filterExcludeCollider
    );

    // always draw attack line so the player sees the shot
    const endDist = hit ? hit.timeOfImpact : 15;
    const end = origin.clone().add(dir.clone().multiplyScalar(endDist));
    this.showAttackLine(camOrigin, end);

    // Pulse the crosshair on every click — impossible to miss
    this.hud.flashAttack();

    if (!hit) return;

    const hitCollider = hit.collider;

    const ent = this.colliderMap.get(hitCollider.handle);

    if (!ent || !ent.active || ent.maxHealth <= 0) return;

    const dmg = this.spec.player.attackDamage;
    ent.health -= dmg;
    this.flashEntity(ent);
    this.hud.showHitMarker();
    this.hud.showDamageNumber(dmg);

    if (ent.health <= 0) {
      this.destroyEntity(ent);
    }
  }

  /** Draw a visible tube from origin to hit point (THREE.Line linewidth is 1px on macOS) */
  private showAttackLine(from: THREE.Vector3, to: THREE.Vector3) {
    if (this.attackLine) {
      this.scene.remove(this.attackLine);
      this.attackLine.geometry.dispose();
    }

    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const length = from.distanceTo(to);
    const direction = new THREE.Vector3().subVectors(to, from).normalize();

    // Cylinder aligned along the ray
    const geo = new THREE.CylinderGeometry(0.02, 0.02, length, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffff44,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    this.attackLine = new THREE.Mesh(geo, mat);
    this.attackLine.position.copy(mid);

    // Align cylinder (default Y-axis) to the ray direction
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, direction);
    this.attackLine.quaternion.copy(quat);

    this.attackLine.renderOrder = 999;
    this.scene.add(this.attackLine);
    this.attackLineTimer = ATTACK_FLASH_DURATION;
  }

  private flashEntity(ent: RuntimeEntity) {
    for (const mat of ent.materials) {
      mat.emissive.set(0xff2222);
      mat.emissiveIntensity = 1.0;
    }
    this.flashTimers.set(ent.spec.id, 0.2);
  }

  private restoreColor(ent: RuntimeEntity) {
    for (const mat of ent.materials) {
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
    }
  }

  // ── Entity destruction ────────────────────────────────────────────────
  private destroyEntity(ent: RuntimeEntity) {
    ent.active = false;
    ent.object3d.visible = false;
    if (ent.healthBar) ent.healthBar.group.visible = false;
    if (ent.collider) {
      this.colliderMap.delete(ent.collider.handle);
    }
    if (ent.body) {
      this.world.removeRigidBody(ent.body);
      ent.body = null;
      ent.collider = null;
    }
    // Clean up character animation
    const anim = this.characterAnimations.get(ent.spec.id);
    if (anim) {
      anim.dispose();
      this.characterAnimations.delete(ent.spec.id);
      this.lastEntityPositions.delete(ent.spec.id);
    }
  }

  // ── Sync Three.js ← Rapier ─────────────────────────────────────────────
  private syncTransforms() {
    for (const ent of this.entities) {
      if (!ent.active || !ent.body) continue;
      const pos = ent.body.translation();
      ent.object3d.position.set(pos.x, pos.y, pos.z);
      if (ent.spec.physics?.bodyType === "dynamic") {
        const rot = ent.body.rotation();
        ent.object3d.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      }
    }
  }

  private updateHealthBars() {
    for (const ent of this.entities) {
      if (!ent.healthBar || !ent.active) continue;
      ent.healthBar.update(ent.health / ent.maxHealth, this.camera);
    }
  }

  // ── Win / Lose ──────────────────────────────────────────────────────────
  private checkEndConditions() {
    // always check fall
    if (this.playerCtrl.position.y < FALL_Y) {
      this.endGame("lost", "You fell off!");
      return;
    }

    if (this.health <= 0) {
      this.endGame("lost", "Game Over");
      return;
    }

    switch (this.spec.rules.winCondition) {
      case "reach_score":
        if (this.spec.rules.scoreTarget && this.score >= this.spec.rules.scoreTarget) {
          this.endGame("won", "You win!");
        }
        break;
      case "collect_all": {
        const left = this.entities.filter(
          (e) => e.spec.type === "collectible" && e.active,
        );
        if (left.length === 0) this.endGame("won", "You collected everything!");
        break;
      }
      case "defeat_all": {
        const left = this.entities.filter(
          (e) => e.spec.type === "npc" && e.active && !e.spawned,
        );
        if (left.length === 0) this.endGame("won", "All enemies defeated!");
        break;
      }
    }
  }

  private endGame(state: "won" | "lost", message: string) {
    this.state = state;
    this.playerCtrl.exitLock();
    this.hud.showMessage(message);
    this.hud.hideCrosshair();
    this.hud.showPrompt("Click to restart");
  }

  private restart() {
    // Remove spawned entities
    for (const ent of this.entities) {
      if (ent.spawned) this.destroyEntity(ent);
    }
    this.entities = this.entities.filter((e) => !e.spawned);

    // Reset original entities
    for (const ent of this.entities) {
      const spec = ent.spec;
      ent.active = true;
      ent.object3d.visible = true;
      ent.health = ent.maxHealth;
      ent.age = 0;
      if (ent.healthBar) ent.healthBar.group.visible = true;
      this.restoreColor(ent);

      // re-create physics body if it was destroyed
      if (!ent.body && spec.physics) {
        const bodyDesc = this.makeBodyDesc(
          spec.physics.bodyType,
          spec.transform.position,
        );
        ent.body = this.world.createRigidBody(bodyDesc);
        const colDesc = this.makeColliderDesc(
          spec.physics.collider,
          spec.mesh,
          spec.transform.scale,
        );
        if (colDesc) {
          if (spec.physics.sensor) colDesc.setSensor(true);
          colDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
          ent.collider = this.world.createCollider(colDesc, ent.body);
          this.colliderMap.set(ent.collider.handle, ent);
        }
      } else if (ent.body) {
        ent.body.setTranslation(spec.transform.position, true);
      }

      ent.object3d.position.set(
        spec.transform.position.x,
        spec.transform.position.y,
        spec.transform.position.z,
      );
    }

    this.score = 0;
    this.health = 100;
    this.state = "playing";
    this.behaviors.reset();
    this.flashTimers.clear();

    const sp = this.spec.player.spawnPoint;
    this.playerCtrl.resetTo(sp.x, sp.y, sp.z);

    this.hud.hideMessage();
    this.hud.hidePrompt();
    this.hud.showCrosshair();
    this.hud.update(0, 100);
    this.playerCtrl.requestLock();
  }

  // ── Events ──────────────────────────────────────────────────────────────
  private onClick = () => {
    if (this.state === "waiting") {
      this.state = "playing";
      this.hud.hidePrompt();
      this.hud.showCrosshair();
      this.playerCtrl.requestLock();
    } else if (this.state === "won" || this.state === "lost") {
      this.restart();
    } else if (!this.playerCtrl.isLocked) {
      this.playerCtrl.requestLock();
      this.hud.hidePrompt();
      this.hud.showCrosshair();
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.state !== "playing") return;
    if (!this.playerCtrl.isLocked) return;
    if (e.button !== 0) return;
    if (this.attackCooldown > 0) return;

    this.attackCooldown = this.spec.player.attackCooldown;
    this.performAttack();
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  // ── Cleanup ─────────────────────────────────────────────────────────────
  dispose() {
    cancelAnimationFrame(this.animId);
    this.playerCtrl.dispose();
    this.hud.dispose();
    this.sky?.dispose();
    this.terrainResult?.dispose();
    this.scatterResult?.dispose();
    for (const anim of this.characterAnimations.values()) anim.dispose();
    this.characterAnimations.clear();
    this.lastEntityPositions.clear();
    this.renderer.domElement.removeEventListener("click", this.onClick);
    document.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.remove();
    this.renderer.dispose();
    this.eventQueue.free();
    this.world.free();
  }
}
