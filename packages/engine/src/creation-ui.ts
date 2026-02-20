import type { GameSpec } from "@otherside/shared";

type SpecCallback = (spec: GameSpec) => void;

interface ChatMessage {
  role: "user" | "system" | "error";
  text: string;
}

export class CreationUI {
  private overlay!: HTMLDivElement;
  private loadingOverlay!: HTMLDivElement;
  private chatBar!: HTMLDivElement;
  private chatHistory!: HTMLDivElement;
  private chatInput!: HTMLInputElement;
  private chatSendBtn!: HTMLButtonElement;
  private errorEl!: HTMLDivElement;
  private currentSpec: GameSpec | null = null;
  private messages: ChatMessage[] = [];
  private onSpec: SpecCallback;
  private styleTag: HTMLStyleElement;

  constructor(onSpec: SpecCallback) {
    this.onSpec = onSpec;
    this.styleTag = this.injectStyles();
    this.buildOverlay();
    this.buildLoadingOverlay();
    this.buildChatBar();
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  private injectStyles(): HTMLStyleElement {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes ow-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes ow-fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .ow-btn {
        background: #6c63ff;
        color: #fff;
        border: none;
        padding: 12px 32px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }
      .ow-btn:hover { background: #5a52e0; }
      .ow-btn:active { transform: scale(0.97); }
      .ow-btn:disabled { background: #444; cursor: not-allowed; opacity: 0.6; }
    `;
    document.head.appendChild(style);
    return style;
  }

  // ── Creation overlay ────────────────────────────────────────────────────
  private buildOverlay() {
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      background: "#0a0a1a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "100",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    });

    const card = document.createElement("div");
    Object.assign(card.style, {
      background: "#1a1a2e",
      borderRadius: "16px",
      padding: "40px",
      maxWidth: "600px",
      width: "90%",
      boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    });

    const title = document.createElement("h1");
    Object.assign(title.style, {
      color: "#e0e0e0",
      fontSize: "28px",
      fontWeight: "700",
      margin: "0 0 8px 0",
    });
    title.textContent = "Otherside World Builder";

    const subtitle = document.createElement("p");
    Object.assign(subtitle.style, {
      color: "#888",
      fontSize: "14px",
      margin: "0 0 24px 0",
    });
    subtitle.textContent = "Describe a game and AI will build it for you";

    const textarea = document.createElement("textarea");
    Object.assign(textarea.style, {
      width: "100%",
      height: "140px",
      background: "#0d0d20",
      border: "1px solid #333",
      borderRadius: "8px",
      padding: "14px",
      color: "#e0e0e0",
      fontSize: "15px",
      fontFamily: "inherit",
      resize: "vertical",
      outline: "none",
      boxSizing: "border-box",
    });
    textarea.placeholder =
      "Describe your game... e.g. 'A zombie survival game on a floating island with health pickups and wave-based enemies'";
    textarea.addEventListener("focus", () => {
      textarea.style.borderColor = "#6c63ff";
    });
    textarea.addEventListener("blur", () => {
      textarea.style.borderColor = "#333";
    });

    this.errorEl = document.createElement("div");
    Object.assign(this.errorEl.style, {
      color: "#ff4444",
      fontSize: "14px",
      margin: "12px 0 0 0",
      display: "none",
    });

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, {
      display: "flex",
      justifyContent: "flex-end",
      marginTop: "16px",
      gap: "12px",
    });

    const generateBtn = document.createElement("button");
    generateBtn.className = "ow-btn";
    generateBtn.textContent = "Generate Game";
    generateBtn.onclick = () => this.handleGenerate(textarea.value, generateBtn, textarea);

    btnRow.appendChild(generateBtn);

    const hint = document.createElement("p");
    Object.assign(hint.style, {
      color: "#555",
      fontSize: "13px",
      margin: "20px 0 0 0",
      lineHeight: "1.5",
    });
    hint.innerHTML =
      'Try: <span style="color:#6c63ff">"A zombie survival game on a floating island"</span> or <span style="color:#6c63ff">"A peaceful zen garden with collectible crystals"</span>';

    card.append(title, subtitle, textarea, this.errorEl, btnRow, hint);
    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);

    // Auto-focus textarea
    setTimeout(() => textarea.focus(), 100);
  }

  // ── Loading overlay ─────────────────────────────────────────────────────
  private buildLoadingOverlay() {
    this.loadingOverlay = document.createElement("div");
    Object.assign(this.loadingOverlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(10, 10, 26, 0.92)",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      zIndex: "200",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    });

    const spinner = document.createElement("div");
    Object.assign(spinner.style, {
      width: "48px",
      height: "48px",
      border: "4px solid #333",
      borderTop: "4px solid #6c63ff",
      borderRadius: "50%",
      animation: "ow-spin 0.8s linear infinite",
    });

    const label = document.createElement("p");
    label.className = "ow-loading-label";
    Object.assign(label.style, {
      color: "#aaa",
      fontSize: "16px",
      marginTop: "20px",
    });
    label.textContent = "Generating your game...";

    this.loadingOverlay.append(spinner, label);
    document.body.appendChild(this.loadingOverlay);
  }

  private showLoading(text: string) {
    const label = this.loadingOverlay.querySelector(".ow-loading-label") as HTMLElement;
    if (label) label.textContent = text;
    this.loadingOverlay.style.display = "flex";
  }

  private hideLoading() {
    this.loadingOverlay.style.display = "none";
  }

  // ── Chat bar (refinement) ──────────────────────────────────────────────
  private buildChatBar() {
    this.chatBar = document.createElement("div");
    Object.assign(this.chatBar.style, {
      position: "fixed",
      bottom: "0",
      left: "0",
      right: "0",
      background: "rgba(20, 20, 40, 0.9)",
      backdropFilter: "blur(10px)",
      borderTop: "1px solid #333",
      padding: "0",
      zIndex: "50",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: "none",
    });

    this.chatHistory = document.createElement("div");
    Object.assign(this.chatHistory.style, {
      maxHeight: "150px",
      overflowY: "auto",
      padding: "8px 16px",
    });

    const inputRow = document.createElement("div");
    Object.assign(inputRow.style, {
      display: "flex",
      padding: "10px 16px",
      gap: "8px",
      borderTop: "1px solid #2a2a3e",
    });

    this.chatInput = document.createElement("input");
    Object.assign(this.chatInput.style, {
      flex: "1",
      background: "#0d0d20",
      border: "1px solid #333",
      borderRadius: "8px",
      padding: "10px 14px",
      color: "#e0e0e0",
      fontSize: "14px",
      fontFamily: "inherit",
      outline: "none",
    });
    this.chatInput.placeholder =
      "Refine your game... (e.g. 'add more enemies', 'make it nighttime')";
    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleRefine();
      }
    });

    this.chatSendBtn = document.createElement("button");
    this.chatSendBtn.className = "ow-btn";
    Object.assign(this.chatSendBtn.style, { padding: "10px 20px" });
    this.chatSendBtn.textContent = "Send";
    this.chatSendBtn.onclick = () => this.handleRefine();

    inputRow.append(this.chatInput, this.chatSendBtn);
    this.chatBar.append(this.chatHistory, inputRow);
  }

  private showChatBar() {
    this.chatBar.style.display = "block";
    document.body.appendChild(this.chatBar);
  }

  private addChatMessage(msg: ChatMessage) {
    this.messages.push(msg);
    const el = document.createElement("div");
    Object.assign(el.style, {
      padding: "4px 0",
      fontSize: "13px",
      animation: "ow-fadeIn 0.2s ease",
      color:
        msg.role === "user"
          ? "#a0a0c0"
          : msg.role === "error"
            ? "#ff4444"
            : "#6c63ff",
    });
    const prefix = msg.role === "user" ? "You" : msg.role === "error" ? "Error" : "AI";
    el.textContent = `${prefix}: ${msg.text}`;
    this.chatHistory.appendChild(el);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  // ── API calls ──────────────────────────────────────────────────────────
  private async handleGenerate(
    prompt: string,
    btn: HTMLButtonElement,
    textarea: HTMLTextAreaElement,
  ) {
    const trimmed = prompt.trim();
    if (!trimmed) {
      this.showError("Please describe your game first");
      return;
    }

    this.hideError();
    btn.disabled = true;
    textarea.disabled = true;
    btn.textContent = "Generating...";
    this.showLoading("Generating your game... (this takes 1–2 minutes)");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        let msg: string;
        try { msg = JSON.parse(text).error; } catch { msg = `HTTP ${res.status}: ${text.slice(0, 200)}`; }
        throw new Error(msg);
      }

      const { spec } = (await res.json()) as { spec: GameSpec };
      this.currentSpec = spec;

      // Hide creation overlay, show game + chat
      this.overlay.style.display = "none";
      this.hideLoading();
      this.showChatBar();

      this.addChatMessage({ role: "user", text: trimmed });
      this.addChatMessage({
        role: "system",
        text: `Generated "${spec.name}" — ${spec.entities.length} entities`,
      });

      this.onSpec(spec);
    } catch (err) {
      this.hideLoading();
      btn.disabled = false;
      textarea.disabled = false;
      btn.textContent = "Generate Game";
      let message: string;
      if (err instanceof DOMException && err.name === "AbortError") {
        message = "Request timed out (5 min). The AI may be overloaded — try again.";
      } else if (err instanceof TypeError) {
        message = `Network error: ${err.message}. Check that the server is running on port 3001.`;
        console.error("[CreationUI] fetch TypeError:", err);
      } else {
        message = err instanceof Error ? err.message : "Generation failed";
      }
      this.showError(message);
    }
  }

  private async handleRefine() {
    const instruction = this.chatInput.value.trim();
    if (!instruction || !this.currentSpec) return;

    this.chatInput.value = "";
    this.chatInput.disabled = true;
    this.chatSendBtn.disabled = true;
    this.addChatMessage({ role: "user", text: instruction });
    this.showLoading("Updating your game...");

    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: this.currentSpec, instruction }),
      });

      if (!res.ok) {
        const text = await res.text();
        let msg: string;
        try { msg = JSON.parse(text).error; } catch { msg = `HTTP ${res.status}: ${text.slice(0, 200)}`; }
        throw new Error(msg);
      }

      const { spec } = (await res.json()) as { spec: GameSpec };
      this.currentSpec = spec;

      this.hideLoading();
      this.chatInput.disabled = false;
      this.chatSendBtn.disabled = false;
      this.addChatMessage({
        role: "system",
        text: `Updated "${spec.name}" — ${spec.entities.length} entities`,
      });

      this.onSpec(spec);
    } catch (err) {
      this.hideLoading();
      this.chatInput.disabled = false;
      this.chatSendBtn.disabled = false;
      const message = err instanceof Error ? err.message : "Refinement failed";
      this.addChatMessage({ role: "error", text: message });
    }

    this.chatInput.focus();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private showError(message: string) {
    this.errorEl.textContent = message;
    this.errorEl.style.display = "block";
  }

  private hideError() {
    this.errorEl.style.display = "none";
  }

  dispose() {
    this.overlay.remove();
    this.loadingOverlay.remove();
    this.chatBar.remove();
    this.styleTag.remove();
  }
}
