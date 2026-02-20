import type { HudElement } from "@otherside/shared";

export class HUD {
  private container: HTMLDivElement;
  private scoreEl: HTMLDivElement | null = null;
  private healthEl: HTMLDivElement | null = null;
  private messageEl: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private crosshairEl: HTMLDivElement;
  private hitMarkerEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private hitMarkerTimer = 0;
  private damageNumbers: { el: HTMLDivElement; timer: number }[] = [];

  constructor(elements: HudElement[]) {
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      fontFamily: "'Courier New', monospace",
      color: "#ffffff",
      zIndex: "10",
    });

    if (elements.includes("score")) {
      this.scoreEl = this.makeEl({
        position: "absolute",
        top: "20px",
        left: "24px",
        fontSize: "22px",
        textShadow: "0 0 6px rgba(0,0,0,0.8)",
      });
      this.scoreEl.textContent = "Score: 0";
      this.container.appendChild(this.scoreEl);
    }

    if (elements.includes("health")) {
      this.healthEl = this.makeEl({
        position: "absolute",
        top: "20px",
        right: "24px",
        fontSize: "22px",
        textShadow: "0 0 6px rgba(0,0,0,0.8)",
      });
      this.healthEl.textContent = "Health: 100";
      this.container.appendChild(this.healthEl);
    }

    // Crosshair — larger, more visible
    this.crosshairEl = this.makeEl({
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "28px",
      fontWeight: "bold",
      opacity: "0.8",
      display: "none",
      textShadow: "0 0 4px rgba(0,0,0,0.9)",
      transition: "color 0.05s",
    });
    this.crosshairEl.textContent = "+";
    this.container.appendChild(this.crosshairEl);

    // Hit marker — red X that flashes over crosshair on hit
    this.hitMarkerEl = this.makeEl({
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "36px",
      fontWeight: "bold",
      color: "#ff3333",
      opacity: "0",
      textShadow: "0 0 8px rgba(255,0,0,0.8)",
      transition: "opacity 0.15s",
    });
    this.hitMarkerEl.textContent = "\u2715"; // ✕
    this.container.appendChild(this.hitMarkerEl);

    this.messageEl = this.makeEl({
      position: "absolute",
      top: "40%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "36px",
      textAlign: "center",
      textShadow: "0 0 10px rgba(0,0,0,0.9)",
      display: "none",
    });
    this.container.appendChild(this.messageEl);

    this.promptEl = this.makeEl({
      position: "absolute",
      top: "55%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "20px",
      textAlign: "center",
      opacity: "0.7",
    });
    this.promptEl.textContent = "Click to play";
    this.container.appendChild(this.promptEl);

    // Controls hint — shown during gameplay
    this.hintEl = this.makeEl({
      position: "absolute",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: "14px",
      opacity: "0.5",
      textAlign: "center",
      display: "none",
    });
    this.hintEl.textContent = "WASD move \u2022 Mouse look \u2022 Left-click attack \u2022 Space jump";
    this.container.appendChild(this.hintEl);

    document.body.appendChild(this.container);
  }

  private makeEl(styles: Partial<CSSStyleDeclaration>): HTMLDivElement {
    const el = document.createElement("div");
    Object.assign(el.style, styles);
    return el;
  }

  update(score: number, health: number) {
    if (this.scoreEl) this.scoreEl.textContent = `Score: ${score}`;
    if (this.healthEl) {
      const hp = Math.max(0, Math.round(health));
      this.healthEl.textContent = `Health: ${hp}`;
      this.healthEl.style.color = hp <= 25 ? "#ff4444" : "#ffffff";
    }
  }

  /** Call each frame with delta time to decay transient effects */
  tick(dt: number) {
    // hit marker fade
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= dt;
      if (this.hitMarkerTimer <= 0) {
        this.hitMarkerEl.style.opacity = "0";
        this.crosshairEl.style.color = "#ffffff";
      }
    }

    // floating damage numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.timer -= dt;
      // float upward
      const currentTop = parseFloat(dn.el.style.top);
      dn.el.style.top = `${currentTop - dt * 60}px`;
      dn.el.style.opacity = String(Math.max(0, dn.timer / 0.8));
      if (dn.timer <= 0) {
        dn.el.remove();
        this.damageNumbers.splice(i, 1);
      }
    }
  }

  /** Flash the hit marker (red X) on a successful attack */
  showHitMarker() {
    this.hitMarkerEl.style.opacity = "1";
    this.crosshairEl.style.color = "#ff3333";
    this.hitMarkerTimer = 0.25;
  }

  /** Show a floating damage number at screen center (offset randomly) */
  showDamageNumber(amount: number) {
    const offsetX = (Math.random() - 0.5) * 60;
    const el = this.makeEl({
      position: "absolute",
      top: `${window.innerHeight / 2 - 40}px`,
      left: `${window.innerWidth / 2 + offsetX}px`,
      fontSize: "24px",
      fontWeight: "bold",
      color: "#ffcc00",
      textShadow: "0 0 6px rgba(0,0,0,0.9)",
      transition: "none",
    });
    el.textContent = `-${amount}`;
    this.container.appendChild(el);
    this.damageNumbers.push({ el, timer: 0.8 });
  }

  /** Flash the screen edge red briefly when the player takes damage */
  flashDamage() {
    const flash = this.makeEl({
      position: "absolute",
      inset: "0",
      border: "4px solid rgba(255,0,0,0.6)",
      borderRadius: "0",
      transition: "opacity 0.4s",
      opacity: "1",
    });
    this.container.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = "0";
    });
    setTimeout(() => flash.remove(), 500);
  }

  /** Pulse crosshair on every attack attempt — gives immediate feedback that click registered */
  flashAttack() {
    // Scale up the crosshair briefly
    this.crosshairEl.style.transform = "translate(-50%, -50%) scale(1.8)";
    this.crosshairEl.style.color = "#ffff44";
    this.crosshairEl.style.transition = "transform 0.15s ease-out, color 0.15s ease-out";
    setTimeout(() => {
      this.crosshairEl.style.transform = "translate(-50%, -50%) scale(1)";
      // Only reset color if hit marker isn't active
      if (this.hitMarkerTimer <= 0) {
        this.crosshairEl.style.color = "#ffffff";
      }
    }, 150);
  }

  showCrosshair() {
    this.crosshairEl.style.display = "block";
    this.hintEl.style.display = "block";
  }

  hideCrosshair() {
    this.crosshairEl.style.display = "none";
    this.hintEl.style.display = "none";
  }

  showMessage(text: string) {
    this.messageEl.textContent = text;
    this.messageEl.style.display = "block";
  }

  hideMessage() {
    this.messageEl.style.display = "none";
  }

  showPrompt(text: string) {
    this.promptEl.textContent = text;
    this.promptEl.style.display = "block";
  }

  hidePrompt() {
    this.promptEl.style.display = "none";
  }

  dispose() {
    this.container.remove();
  }
}
