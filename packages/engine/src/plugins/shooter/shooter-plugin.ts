import * as THREE from "three";
import type { ShooterSpec, Weapon, Entity, ShooterEnemy } from "@otherside/shared";
import type { TemplatePlugin, GameRendererAPI } from "../template-plugin.js";
import type { RuntimeEntity } from "../../types.js";

interface WeaponState {
  weapon: Weapon;
  currentMag: number;
  reserveAmmo: number;
  reloading: boolean;
  reloadTimer: number;
  fireCooldown: number;
}

export class ShooterPlugin implements TemplatePlugin {
  private api!: GameRendererAPI;
  private spec: ShooterSpec;
  private waveMap: Map<string, number>;
  private specialPickupIds: Set<string>;

  // Weapon state
  private weapons: Map<string, WeaponState> = new Map();
  private currentWeaponId: string;
  private availableWeapons: string[] = [];

  // Wave state
  private currentWave = 1;
  private waveActive = false;
  private waveTimer = 0;
  private waveEnemiesAlive = 0;
  private totalWaves: number;
  private deferredEnemySpecs: Map<number, Entity[]> = new Map();

  // HUD elements
  private hudContainer: HTMLElement | null = null;
  private ammoEl: HTMLElement | null = null;
  private waveEl: HTMLElement | null = null;
  private reloadEl: HTMLElement | null = null;
  private weaponNameEl: HTMLElement | null = null;

  constructor(
    spec: ShooterSpec,
    waveMap: Map<string, number>,
    specialPickupIds: Set<string>,
    /** Pre-converted entity specs for deferred wave spawning */
    private allEnemyEntities: Map<string, Entity>,
  ) {
    this.spec = spec;
    this.waveMap = waveMap;
    this.specialPickupIds = specialPickupIds;
    this.currentWeaponId = spec.player.startingWeapon;
    this.totalWaves = spec.waveConfig?.waves.length ?? 1;
  }

  init(api: GameRendererAPI): void {
    this.api = api;

    // Initialize weapon states
    for (const weapon of this.spec.weapons) {
      const isStarting = weapon.id === this.spec.player.startingWeapon;
      const startingAmmo = this.spec.player.startingAmmo;
      this.weapons.set(weapon.id, {
        weapon,
        currentMag: isStarting ? weapon.magSize : 0,
        reserveAmmo: startingAmmo?.[weapon.id] ?? weapon.maxReserve,
        reloading: false,
        reloadTimer: 0,
        fireCooldown: 0,
      });
      if (isStarting) {
        this.availableWeapons.push(weapon.id);
      }
    }

    // Set up wave system: categorize enemies by wave
    if (this.spec.waveConfig) {
      for (const wave of this.spec.waveConfig.waves) {
        if (wave.waveNumber === 1) continue; // Wave 1 already spawned by engine
        const specs: Entity[] = [];
        for (const enemyId of wave.enemyIds) {
          const entSpec = this.allEnemyEntities.get(enemyId);
          if (entSpec) specs.push(entSpec);
        }
        this.deferredEnemySpecs.set(wave.waveNumber, specs);
      }

      // Count wave 1 enemies
      const wave1 = this.spec.waveConfig.waves.find(w => w.waveNumber === 1);
      this.waveEnemiesAlive = wave1?.enemyIds.length ?? 0;
      this.waveActive = true;
    }

    this.buildHUD();
  }

  update(dt: number): void {
    // Update weapon cooldowns and reload
    const ws = this.weapons.get(this.currentWeaponId);
    if (ws) {
      ws.fireCooldown = Math.max(0, ws.fireCooldown - dt);

      if (ws.reloading) {
        ws.reloadTimer -= dt;
        if (ws.reloadTimer <= 0) {
          ws.reloading = false;
          const ammoNeeded = ws.weapon.magSize - ws.currentMag;
          const ammoAvailable = Math.min(ammoNeeded, ws.reserveAmmo);
          ws.currentMag += ammoAvailable;
          ws.reserveAmmo -= ammoAvailable;
        }
      }
    }

    // Wave timer (between waves)
    if (!this.waveActive && this.waveTimer > 0) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.spawnNextWave();
      }
    }

    // Check ammo/weapon pickup proximity
    this.checkSpecialPickups();

    // Update HUD
    this.updateHUD();
  }

  onAttack(): boolean {
    const ws = this.weapons.get(this.currentWeaponId);
    if (!ws) return false;

    // Can't fire while reloading
    if (ws.reloading) return true;

    // Cooldown check
    if (ws.fireCooldown > 0) return true;

    // Empty mag — auto-reload
    if (ws.currentMag <= 0) {
      this.startReload();
      return true;
    }

    // Fire!
    ws.currentMag--;
    ws.fireCooldown = 1 / ws.weapon.fireRate;

    // Apply weapon spread
    const spread = ws.weapon.spread;
    if (spread > 0) {
      // Nudge camera direction slightly for spread (visual only for hitscan)
    }

    // Raycast
    const hit = this.api.performRaycast(ws.weapon.range);

    // Get attack line endpoints — offset origin forward so line starts past player
    const cam = this.api.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.position.clone().add(dir.clone().multiplyScalar(0.5));
    const endDist = hit ? hit.distance : ws.weapon.range;
    const end = origin.clone().add(dir.clone().multiplyScalar(endDist));

    this.api.showAttackLine(origin, end);
    this.api.flashAttack();
    this.showMuzzleFlash();

    if (hit) {
      this.api.damageEntity(hit.entity, ws.weapon.damage);
      this.api.showHitMarker();
      this.api.showDamageNumber(ws.weapon.damage, hit.point);
    }

    // Auto-reload when mag empties
    if (ws.currentMag <= 0 && ws.reserveAmmo > 0) {
      this.startReload();
    }

    return true; // suppress default attack
  }

  onKeyDown(code: string): boolean {
    if (code === "KeyR") {
      this.startReload();
      return true;
    }

    // Number keys to switch weapons
    if (code >= "Digit1" && code <= "Digit9") {
      const idx = parseInt(code.charAt(5)) - 1;
      if (idx < this.availableWeapons.length) {
        const newWeaponId = this.availableWeapons[idx];
        if (newWeaponId !== this.currentWeaponId) {
          // Cancel reload on weapon switch
          const oldWs = this.weapons.get(this.currentWeaponId);
          if (oldWs) oldWs.reloading = false;
          this.currentWeaponId = newWeaponId;
        }
        return true;
      }
    }

    return false;
  }

  onEntityDestroyed(ent: RuntimeEntity): void {
    // Check if this is a wave enemy
    const wave = this.waveMap.get(ent.spec.id);
    if (wave !== undefined && wave === this.currentWave) {
      this.waveEnemiesAlive--;

      // Loot drop
      const enemySpec = this.spec.enemies.find(e => e.id === ent.spec.id);
      if (enemySpec?.lootDrop) {
        this.handleLootDrop(enemySpec, ent);
      }

      // Wave cleared?
      if (this.waveEnemiesAlive <= 0 && this.waveActive) {
        this.waveActive = false;
        if (this.currentWave < this.totalWaves) {
          this.api.showMessage(`Wave ${this.currentWave} cleared!`);
          this.waveTimer = this.spec.waveConfig?.timeBetweenWaves ?? 5;
        }
      }
    }
  }

  checkEndConditions(): "won" | "lost" | null {
    // Wave mode: all waves cleared and all enemies dead
    if (this.spec.waveConfig) {
      if (this.currentWave >= this.totalWaves && this.waveEnemiesAlive <= 0 && !this.waveActive) {
        // Double check: this gets set when last wave enemy dies. But waveActive is set to false first.
        // Actually we should check: all waves done and no enemies alive
        return "won";
      }
    }

    // Elimination mode: all enemies dead
    if (this.spec.rules.mode === "elimination") {
      const aliveEnemies = this.api.getEntities().filter(
        e => e.spec.type === "npc" && e.active,
      );
      if (aliveEnemies.length === 0) {
        return "won";
      }
    }

    return null;
  }

  reset(): void {
    this.currentWave = 1;
    this.waveActive = false;
    this.waveTimer = 0;
    this.waveEnemiesAlive = 0;
    this.availableWeapons = [this.spec.player.startingWeapon];

    // Reset weapon states
    for (const weapon of this.spec.weapons) {
      const isStarting = weapon.id === this.spec.player.startingWeapon;
      const startingAmmo = this.spec.player.startingAmmo;
      this.weapons.set(weapon.id, {
        weapon,
        currentMag: isStarting ? weapon.magSize : 0,
        reserveAmmo: startingAmmo?.[weapon.id] ?? weapon.maxReserve,
        reloading: false,
        reloadTimer: 0,
        fireCooldown: 0,
      });
    }

    // Re-init wave counting
    if (this.spec.waveConfig) {
      const wave1 = this.spec.waveConfig.waves.find(w => w.waveNumber === 1);
      this.waveEnemiesAlive = wave1?.enemyIds.length ?? 0;
      this.waveActive = true;
    }
  }

  dispose(): void {
    this.ammoEl?.remove();
    this.waveEl?.remove();
    this.reloadEl?.remove();
    this.weaponNameEl?.remove();
  }

  // ── Private helpers ─────────────────────────────────────────────

  private startReload(): void {
    const ws = this.weapons.get(this.currentWeaponId);
    if (!ws || ws.reloading || ws.currentMag >= ws.weapon.magSize || ws.reserveAmmo <= 0) return;

    ws.reloading = true;
    ws.reloadTimer = ws.weapon.reloadTime;
  }

  private spawnNextWave(): void {
    this.currentWave++;
    this.api.hideMessage();

    const specs = this.deferredEnemySpecs.get(this.currentWave);
    if (!specs || specs.length === 0) return;

    this.api.showMessage(`Wave ${this.currentWave}!`);
    setTimeout(() => this.api.hideMessage(), 2000);

    for (const spec of specs) {
      this.api.spawnEntity(spec, false);
    }

    this.waveEnemiesAlive = specs.length;
    this.waveActive = true;
  }

  private checkSpecialPickups(): void {
    const playerPos = this.api.getPlayerPosition();
    const entities = this.api.getEntities();

    for (const ent of entities) {
      if (!ent.active || !this.specialPickupIds.has(ent.spec.id)) continue;

      const pos = ent.spec.transform.position;
      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 2.5) {
        this.collectSpecialPickup(ent);
      }
    }
  }

  private collectSpecialPickup(ent: RuntimeEntity): void {
    const pickup = this.spec.pickups.find(p => p.id === ent.spec.id);
    if (!pickup) return;

    if (pickup.type === "ammo") {
      const ws = this.weapons.get(pickup.weaponId);
      if (ws) {
        ws.reserveAmmo = Math.min(ws.weapon.maxReserve, ws.reserveAmmo + pickup.amount);
        this.api.destroyEntity(ent);
      }
    } else if (pickup.type === "weapon") {
      if (!this.availableWeapons.includes(pickup.weaponId)) {
        this.availableWeapons.push(pickup.weaponId);
        // Fill the mag for the new weapon
        const ws = this.weapons.get(pickup.weaponId);
        if (ws) {
          ws.currentMag = ws.weapon.magSize;
        }
      }
      this.api.destroyEntity(ent);
    }
  }

  private handleLootDrop(enemySpec: ShooterEnemy, ent: RuntimeEntity): void {
    if (enemySpec.lootDrop === "health") {
      const hp = this.api.getHealth();
      this.api.setHealth(Math.min(100, hp + 20));
    } else if (enemySpec.lootDrop === "ammo") {
      const ws = this.weapons.get(this.currentWeaponId);
      if (ws) {
        ws.reserveAmmo = Math.min(ws.weapon.maxReserve, ws.reserveAmmo + ws.weapon.magSize);
      }
    }
  }

  /** Brief full-screen flash to simulate muzzle flash — gives instant visual feedback */
  private showMuzzleFlash(): void {
    if (!this.hudContainer) return;
    const flash = document.createElement("div");
    Object.assign(flash.style, {
      position: "absolute",
      inset: "0",
      background: "radial-gradient(circle at 50% 80%, rgba(255,200,50,0.25), transparent 60%)",
      pointerEvents: "none",
      transition: "opacity 0.1s ease-out",
      opacity: "1",
    });
    this.hudContainer.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = "0"; });
    setTimeout(() => flash.remove(), 120);
  }

  // ── HUD ─────────────────────────────────────────────────────────

  private buildHUD(): void {
    this.hudContainer = this.api.getHUDContainer();

    // Ammo counter (bottom-right)
    if (this.spec.ui.showAmmo) {
      this.ammoEl = document.createElement("div");
      Object.assign(this.ammoEl.style, {
        position: "absolute",
        bottom: "60px",
        right: "24px",
        fontSize: "22px",
        fontFamily: "'Courier New', monospace",
        color: "#ffffff",
        textShadow: "0 0 6px rgba(0,0,0,0.8)",
        pointerEvents: "none",
      });
      this.hudContainer.appendChild(this.ammoEl);

      // Weapon name
      this.weaponNameEl = document.createElement("div");
      Object.assign(this.weaponNameEl.style, {
        position: "absolute",
        bottom: "40px",
        right: "24px",
        fontSize: "14px",
        fontFamily: "'Courier New', monospace",
        color: "rgba(255,255,255,0.5)",
        textShadow: "0 0 4px rgba(0,0,0,0.8)",
        pointerEvents: "none",
      });
      this.hudContainer.appendChild(this.weaponNameEl);
    }

    // Wave counter (top-center)
    if (this.spec.ui.showWaveCounter && this.spec.waveConfig) {
      this.waveEl = document.createElement("div");
      Object.assign(this.waveEl.style, {
        position: "absolute",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: "18px",
        fontFamily: "'Courier New', monospace",
        color: "#00e5ff",
        textShadow: "0 0 6px rgba(0,0,0,0.8)",
        pointerEvents: "none",
      });
      this.hudContainer.appendChild(this.waveEl);
    }

    // Reload indicator (center)
    this.reloadEl = document.createElement("div");
    Object.assign(this.reloadEl.style, {
      position: "absolute",
      top: "55%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "16px",
      fontFamily: "'Courier New', monospace",
      color: "#ffaa00",
      textShadow: "0 0 6px rgba(0,0,0,0.8)",
      pointerEvents: "none",
      display: "none",
    });
    this.reloadEl.textContent = "RELOADING...";
    this.hudContainer.appendChild(this.reloadEl);
  }

  private updateHUD(): void {
    const ws = this.weapons.get(this.currentWeaponId);
    if (!ws) return;

    if (this.ammoEl) {
      this.ammoEl.textContent = `${ws.currentMag} / ${ws.reserveAmmo}`;
      this.ammoEl.style.color = ws.currentMag <= 3 ? "#ff4444" : "#ffffff";
    }

    if (this.weaponNameEl) {
      const idx = this.availableWeapons.indexOf(this.currentWeaponId);
      this.weaponNameEl.textContent = `[${idx + 1}] ${ws.weapon.name}`;
    }

    if (this.waveEl) {
      this.waveEl.textContent = `Wave ${this.currentWave} / ${this.totalWaves}`;
    }

    if (this.reloadEl) {
      this.reloadEl.style.display = ws.reloading ? "block" : "none";
    }
  }
}
