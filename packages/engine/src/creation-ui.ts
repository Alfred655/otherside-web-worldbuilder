import type { GameSpec, ShooterSpec } from "@otherside/shared";

type AnySpec = GameSpec | ShooterSpec;
type SpecCallback = (spec: AnySpec) => void | Promise<void>;

interface ChatMessage {
  role: "user" | "system" | "error";
  text: string;
}

interface ExampleCard {
  title: string;
  description: string;
  prompt: string;
  accent: string;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  placeholder: string;
  examples: ExampleCard[];
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: "shooter",
    name: "Shooter",
    description: "First-person shooter with weapons, enemies, and wave-based combat",
    icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="2"/></svg>`,
    accent: "#ff4444",
    placeholder: "Describe your shooter... e.g. 'A neon arena with assault rifles and wave-based zombies'",
    examples: [
      {
        title: "Warehouse Assault",
        description: "Clear waves of enemies in a dark warehouse. Use pistol and shotgun, find ammo pickups between waves.",
        prompt: "A dark warehouse arena shooter. I start with a pistol and find a shotgun. Enemies come in 3 waves — grunts first, then armored heavies, then a boss. Crates for cover, ammo pickups scattered around.",
        accent: "#ff4444",
      },
      {
        title: "Rooftop Standoff",
        description: "Sniper battle on city rooftops at dusk. Take out enemies with an assault rifle in elimination mode.",
        prompt: "A rooftop arena at dusk with a city skyline backdrop. I have an assault rifle. Enemies include snipers on platforms and enforcers that rush me. Elimination mode — kill all enemies to win.",
        accent: "#ff6b35",
      },
      {
        title: "Alien Hive",
        description: "Fight alien creatures in a sci-fi facility. Neon lights, plasma weapons, and swarms of bugs.",
        prompt: "A sci-fi facility overrun by alien bugs. Neon green lighting, metal walls. I have a plasma rifle. Aliens come in waves — small swarmers first, then large brutes. Health and ammo pickups in corners.",
        accent: "#00ff88",
      },
    ],
  },
  {
    id: "classic",
    name: "Classic",
    description: "Open-ended 3D game with custom entities, behaviors, and win conditions",
    icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4"/><path d="M8 10v4"/><circle cx="16" cy="10" r="1"/><circle cx="18" cy="12" r="1"/></svg>`,
    accent: "#00e5ff",
    placeholder: "Describe your game... e.g. 'A gladiator arena where I fight skeleton warriors'",
    examples: [
      {
        title: "Gladiator v Skeletons",
        description: "Battle waves of skeleton warriors in a Roman colosseum. Dodge attacks, collect power-ups, and survive.",
        prompt: "A gladiator arena where I fight waves of skeleton warriors. The arena is a Roman colosseum with stone pillars. Skeletons spawn in waves, there are health potions scattered around, and I win after defeating 10 enemies.",
        accent: "#00e5ff",
      },
      {
        title: "Army Battle",
        description: "An open battlefield with two squads fighting each other. Play as a lone mercenary, collect gold from fallen soldiers, and reach 50 gold to win.",
        prompt: "An open battlefield with two squads of 5 soldiers each fighting each other. Use spawner entities for each squad. The player is a lone mercenary who can fight for either side. Collectible gold coins drop when soldiers die. Reach 50 gold to win.",
        accent: "#a855f7",
      },
      {
        title: "Dungeon Puzzle",
        description: "Navigate through dark dungeon rooms solving puzzles. Find keys, avoid traps, and reach the exit.",
        prompt: "A dungeon puzzle game with dark corridors and rooms. I need to find 3 keys to unlock the exit door. There are spike traps to avoid, torch-lit hallways, and patrolling guard enemies.",
        accent: "#ec4899",
      },
    ],
  },
];

export class CreationUI {
  private overlay!: HTMLDivElement;
  private loadingOverlay!: HTMLDivElement;
  private chatBar!: HTMLDivElement;
  private chatHistory!: HTMLDivElement;
  private chatInput!: HTMLInputElement;
  private chatSendBtn!: HTMLButtonElement;
  private errorEl!: HTMLDivElement;
  private textarea!: HTMLTextAreaElement;
  private generateBtn!: HTMLButtonElement;
  private currentSpec: AnySpec | null = null;
  private selectedTemplate: string = "";
  private messages: ChatMessage[] = [];
  private onSpec: SpecCallback;
  private styleTag: HTMLStyleElement;
  private templateScreen!: HTMLDivElement;
  private inputScreen!: HTMLDivElement;

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
      /* ── Base ─────────────────────────────────────── */
      @keyframes savi-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes savi-fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes savi-float1 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(30px, -50px) scale(1.05); }
        66% { transform: translate(-20px, 20px) scale(0.95); }
      }
      @keyframes savi-float2 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(-40px, 30px) scale(1.1); }
        66% { transform: translate(25px, -40px) scale(0.9); }
      }
      @keyframes savi-float3 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(20px, 40px) scale(0.95); }
        66% { transform: translate(-30px, -30px) scale(1.05); }
      }
      @keyframes savi-borderGlow {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }

      /* ── Overlay / Landing ───────────────────────── */
      .savi-overlay {
        position: fixed;
        inset: 0;
        background: #0B0416;
        z-index: 100;
        font-family: 'Space Grotesk', sans-serif;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .savi-grid-bg {
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(0, 229, 255, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 229, 255, 0.04) 1px, transparent 1px);
        background-size: 50px 50px;
        mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 70%);
        -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 70%);
        z-index: 0;
      }

      /* ── Blobs ───────────────────────────────────── */
      .savi-blob {
        position: fixed;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.35;
        pointer-events: none;
        z-index: 0;
      }
      .savi-blob-1 {
        width: 500px; height: 500px;
        background: #7c3aed;
        top: -10%; left: -5%;
        animation: savi-float1 20s ease-in-out infinite;
      }
      .savi-blob-2 {
        width: 400px; height: 400px;
        background: #2563eb;
        top: 30%; right: -8%;
        animation: savi-float2 25s ease-in-out infinite;
      }
      .savi-blob-3 {
        width: 350px; height: 350px;
        background: #ec4899;
        bottom: -5%; left: 30%;
        animation: savi-float3 22s ease-in-out infinite;
      }


      /* ── Content Container ───────────────────────── */
      .savi-content {
        position: relative;
        z-index: 1;
        max-width: 900px;
        margin: 0 auto;
        padding: 80px 24px 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      /* ── Hero ─────────────────────────────────────── */
      .savi-hero-title {
        font-family: 'Alyrak', 'Space Grotesk', sans-serif;
        font-size: clamp(42px, 8vw, 120px);
        font-weight: 400;
        line-height: 1;
        text-align: center;
        text-transform: uppercase;
        white-space: nowrap;
        margin-bottom: 24px;
        color: #ffffff;
        letter-spacing: 3px;
        text-shadow: 0 0 40px rgba(0, 229, 255, 0.15);
      }
      .savi-subtitle {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 17px;
        color: rgba(255, 255, 255, 0.65);
        text-align: center;
        max-width: 560px;
        margin-bottom: 48px;
        font-weight: 400;
        line-height: 1.7;
        letter-spacing: 0.2px;
      }

      /* ── Input Group ─────────────────────────────── */
      .savi-input-group {
        width: 100%;
        position: relative;
        margin-bottom: 40px;
      }
      .savi-input-glow {
        position: relative;
        padding: 2px;
        border-radius: 16px;
        background: linear-gradient(135deg, #00e5ff, #a855f7, #ec4899, #00e5ff);
        background-size: 300% 300%;
        animation: savi-borderGlow 4s ease-in-out infinite;
      }
      .savi-input-inner {
        background: #110822;
        border-radius: 14px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .savi-textarea-row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .savi-lightning-icon {
        flex-shrink: 0;
        margin-top: 4px;
        color: #00e5ff;
        opacity: 0.7;
      }
      .savi-textarea {
        flex: 1;
        background: transparent;
        border: none;
        color: #e0e0e0;
        font-size: 16px;
        font-family: 'Space Grotesk', sans-serif;
        resize: none;
        outline: none;
        min-height: 80px;
        line-height: 1.5;
      }
      .savi-textarea::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }
      .savi-input-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .savi-error {
        color: #ff4444;
        font-size: 14px;
        display: none;
      }

      /* ── Buttons ──────────────────────────────────── */
      .savi-btn {
        background: #00e5ff;
        color: #000;
        border: none;
        padding: 12px 32px;
        font-family: 'Magtsx', 'Space Grotesk', sans-serif;
        font-size: 15px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
        clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
      }
      .savi-btn:hover {
        background: #33ecff;
        box-shadow: 0 0 20px rgba(0, 229, 255, 0.4);
      }
      .savi-btn:active { transform: scale(0.97); }
      .savi-btn:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
        box-shadow: none;
      }

      /* ── Example Cards ───────────────────────────── */
      .savi-examples-label {
        font-family: 'Magtsx', 'Space Grotesk', sans-serif;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 20px;
        text-align: center;
      }
      .savi-examples {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        width: 100%;
        margin-bottom: 60px;
      }
      @media (max-width: 700px) {
        .savi-examples { grid-template-columns: 1fr; }
      }
      .savi-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 20px;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s, transform 0.2s;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      .savi-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.15);
        transform: translateY(-2px);
      }
      .savi-card-accent {
        width: 32px;
        height: 3px;
        border-radius: 2px;
        margin-bottom: 12px;
      }
      .savi-card-title {
        font-family: 'Magtsx', 'Space Grotesk', sans-serif;
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 8px;
      }
      .savi-card-desc {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.5;
      }

      /* ── Template Cards ──────────────────────────── */
      .savi-template-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        width: 100%;
        max-width: 600px;
        margin-bottom: 48px;
      }
      @media (max-width: 500px) {
        .savi-template-grid { grid-template-columns: 1fr; }
      }
      .savi-template-card {
        background: rgba(255, 255, 255, 0.04);
        border: 2px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 28px 24px;
        cursor: pointer;
        transition: background 0.2s, border-color 0.3s, transform 0.2s, box-shadow 0.3s;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .savi-template-card:hover {
        background: rgba(255, 255, 255, 0.08);
        transform: translateY(-3px);
      }
      .savi-template-card-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.8;
      }
      .savi-template-card-name {
        font-family: 'Magtsx', 'Space Grotesk', sans-serif;
        font-size: 20px;
        font-weight: 700;
        color: #fff;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .savi-template-card-desc {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.45);
        line-height: 1.5;
      }
      .savi-back-btn {
        background: none;
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.5);
        padding: 6px 16px;
        border-radius: 6px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 13px;
        cursor: pointer;
        transition: border-color 0.2s, color 0.2s;
        align-self: flex-start;
        margin-bottom: 16px;
      }
      .savi-back-btn:hover {
        border-color: rgba(255, 255, 255, 0.3);
        color: rgba(255, 255, 255, 0.7);
      }

      /* ── Footer ──────────────────────────────────── */
      .savi-footer {
        text-align: center;
        padding: 20px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        width: 100%;
      }
      .savi-footer-text {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.3);
      }
      .savi-footer-brand {
        color: rgba(255, 255, 255, 0.5);
        font-weight: 600;
      }

      /* ── Loading Overlay ─────────────────────────── */
      .savi-loading {
        position: fixed;
        inset: 0;
        background: rgba(11, 4, 22, 0.92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: none;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        z-index: 200;
        font-family: 'Space Grotesk', sans-serif;
      }
      .savi-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top: 3px solid #00e5ff;
        border-radius: 50%;
        animation: savi-spin 0.8s linear infinite;
      }
      .savi-loading-label {
        color: rgba(255, 255, 255, 0.6);
        font-size: 16px;
        margin-top: 20px;
      }

      /* ── Chat Bar ────────────────────────────────── */
      .savi-chat {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(11, 4, 22, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-top: 1px solid rgba(0, 229, 255, 0.2);
        z-index: 50;
        font-family: 'Space Grotesk', sans-serif;
        display: none;
      }
      .savi-chat-history {
        max-height: 150px;
        overflow-y: auto;
        padding: 8px 16px;
      }
      .savi-chat-input-row {
        display: flex;
        padding: 10px 16px;
        gap: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }
      .savi-chat-input {
        flex: 1;
        background: #110822;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 10px 14px;
        color: #e0e0e0;
        font-size: 14px;
        font-family: 'Space Grotesk', sans-serif;
        outline: none;
        transition: border-color 0.2s;
      }
      .savi-chat-input:focus {
        border-color: rgba(0, 229, 255, 0.4);
      }
      .savi-chat-input::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }
      .savi-chat-msg {
        padding: 4px 0;
        font-size: 13px;
        animation: savi-fadeIn 0.2s ease;
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  // ── Creation overlay ────────────────────────────────────────────────────
  private buildOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.className = "savi-overlay";

    // Grid background
    const gridBg = document.createElement("div");
    gridBg.className = "savi-grid-bg";

    // Animated blobs
    const blob1 = document.createElement("div");
    blob1.className = "savi-blob savi-blob-1";
    const blob2 = document.createElement("div");
    blob2.className = "savi-blob savi-blob-2";
    const blob3 = document.createElement("div");
    blob3.className = "savi-blob savi-blob-3";

    // ── Template selection screen ───────────────────────────
    this.templateScreen = document.createElement("div");
    this.templateScreen.className = "savi-content";

    const heroTitle = document.createElement("h1");
    heroTitle.className = "savi-hero-title";
    heroTitle.textContent = "Build Worlds With Words";

    const heroSub = document.createElement("p");
    heroSub.className = "savi-subtitle";
    heroSub.textContent = "Choose a game template to get started.";

    const templateGrid = document.createElement("div");
    templateGrid.className = "savi-template-grid";

    for (const tpl of TEMPLATE_OPTIONS) {
      const card = document.createElement("div");
      card.className = "savi-template-card";
      card.onclick = () => this.selectTemplate(tpl);
      card.onmouseenter = () => {
        card.style.borderColor = tpl.accent;
        card.style.boxShadow = `0 0 24px ${tpl.accent}33`;
      };
      card.onmouseleave = () => {
        card.style.borderColor = "rgba(255, 255, 255, 0.08)";
        card.style.boxShadow = "none";
      };

      const icon = document.createElement("div");
      icon.className = "savi-template-card-icon";
      icon.style.color = tpl.accent;
      icon.innerHTML = tpl.icon;

      const name = document.createElement("div");
      name.className = "savi-template-card-name";
      name.textContent = tpl.name;

      const desc = document.createElement("div");
      desc.className = "savi-template-card-desc";
      desc.textContent = tpl.description;

      card.append(icon, name, desc);
      templateGrid.appendChild(card);
    }

    this.templateScreen.append(heroTitle, heroSub, templateGrid);

    // ── Input screen (initially hidden) ─────────────────────
    this.inputScreen = document.createElement("div");
    this.inputScreen.className = "savi-content";
    this.inputScreen.style.display = "none";

    const backBtn = document.createElement("button");
    backBtn.className = "savi-back-btn";
    backBtn.textContent = "< Back to templates";
    backBtn.onclick = () => this.showTemplateScreen();

    // Input group
    const inputGroup = document.createElement("div");
    inputGroup.className = "savi-input-group";

    const inputGlow = document.createElement("div");
    inputGlow.className = "savi-input-glow";

    const inputInner = document.createElement("div");
    inputInner.className = "savi-input-inner";

    const textareaRow = document.createElement("div");
    textareaRow.className = "savi-textarea-row";

    const lightningIcon = document.createElement("div");
    lightningIcon.className = "savi-lightning-icon";
    lightningIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

    this.textarea = document.createElement("textarea");
    this.textarea.className = "savi-textarea";
    this.textarea.rows = 3;

    textareaRow.append(lightningIcon, this.textarea);

    const actionsRow = document.createElement("div");
    actionsRow.className = "savi-input-actions";

    this.errorEl = document.createElement("div");
    this.errorEl.className = "savi-error";

    this.generateBtn = document.createElement("button");
    this.generateBtn.className = "savi-btn";
    this.generateBtn.textContent = "Generate";
    this.generateBtn.onclick = () =>
      this.handleGenerate(this.textarea.value, this.generateBtn, this.textarea);

    actionsRow.append(this.errorEl, this.generateBtn);

    inputInner.append(textareaRow, actionsRow);
    inputGlow.appendChild(inputInner);
    inputGroup.appendChild(inputGlow);

    // Examples label
    const examplesLabel = document.createElement("div");
    examplesLabel.className = "savi-examples-label";
    examplesLabel.textContent = "Examples";

    const examplesGrid = document.createElement("div");
    examplesGrid.className = "savi-examples";

    // Examples will be populated by selectTemplate
    this.inputScreen.append(backBtn, inputGroup, examplesLabel, examplesGrid);

    // Assemble
    this.overlay.append(gridBg, blob1, blob2, blob3, this.templateScreen, this.inputScreen);
    document.body.appendChild(this.overlay);
  }

  private selectTemplate(tpl: TemplateOption) {
    this.selectedTemplate = tpl.id === "classic" ? "" : tpl.id;

    // Update placeholder
    this.textarea.placeholder = tpl.placeholder;
    this.textarea.value = "";

    // Update examples
    const examplesGrid = this.inputScreen.querySelector(".savi-examples")!;
    examplesGrid.innerHTML = "";
    for (const card of tpl.examples) {
      const cardEl = document.createElement("div");
      cardEl.className = "savi-card";
      cardEl.onclick = () => {
        this.textarea.value = card.prompt;
        this.textarea.focus();
        this.overlay.scrollTo({ top: 0, behavior: "smooth" });
      };

      const accent = document.createElement("div");
      accent.className = "savi-card-accent";
      accent.style.background = card.accent;

      const cardTitle = document.createElement("div");
      cardTitle.className = "savi-card-title";
      cardTitle.textContent = card.title;

      const cardDesc = document.createElement("div");
      cardDesc.className = "savi-card-desc";
      cardDesc.textContent = card.description;

      cardEl.append(accent, cardTitle, cardDesc);
      examplesGrid.appendChild(cardEl);
    }

    // Switch screens
    this.templateScreen.style.display = "none";
    this.inputScreen.style.display = "flex";
    this.overlay.scrollTo({ top: 0 });
    setTimeout(() => this.textarea.focus(), 100);
  }

  private showTemplateScreen() {
    this.inputScreen.style.display = "none";
    this.templateScreen.style.display = "flex";
    this.selectedTemplate = "";
    this.textarea.value = "";
    this.hideError();
    this.overlay.scrollTo({ top: 0 });
  }

  // ── Loading overlay ─────────────────────────────────────────────────────
  private buildLoadingOverlay() {
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.className = "savi-loading";

    const spinner = document.createElement("div");
    spinner.className = "savi-spinner";

    const label = document.createElement("p");
    label.className = "savi-loading-label";
    label.textContent = "Generating your game...";

    this.loadingOverlay.append(spinner, label);
    document.body.appendChild(this.loadingOverlay);
  }

  private showLoading(text: string) {
    const label = this.loadingOverlay.querySelector(
      ".savi-loading-label",
    ) as HTMLElement;
    if (label) label.textContent = text;
    this.loadingOverlay.style.display = "flex";
  }

  private hideLoading() {
    this.loadingOverlay.style.display = "none";
  }

  // ── Chat bar (refinement) ──────────────────────────────────────────────
  private buildChatBar() {
    this.chatBar = document.createElement("div");
    this.chatBar.className = "savi-chat";

    this.chatHistory = document.createElement("div");
    this.chatHistory.className = "savi-chat-history";

    const inputRow = document.createElement("div");
    inputRow.className = "savi-chat-input-row";

    this.chatInput = document.createElement("input");
    this.chatInput.className = "savi-chat-input";
    this.chatInput.placeholder =
      "Refine your game... (e.g. 'add more enemies', 'make it nighttime')";
    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleRefine();
      }
    });

    this.chatSendBtn = document.createElement("button");
    this.chatSendBtn.className = "savi-btn";
    this.chatSendBtn.style.padding = "10px 20px";
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
    el.className = "savi-chat-msg";
    el.style.color =
      msg.role === "user"
        ? "rgba(255, 255, 255, 0.5)"
        : msg.role === "error"
          ? "#ff4444"
          : "#00e5ff";
    const prefix =
      msg.role === "user" ? "You" : msg.role === "error" ? "Error" : "Savi";
    el.textContent = `${prefix}: ${msg.text}`;
    this.chatHistory.appendChild(el);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  // ── API calls ──────────────────────────────────────────────────────────
  private updateLoadingText(text: string) {
    const label = this.loadingOverlay.querySelector(
      ".savi-loading-label",
    ) as HTMLElement;
    if (label) label.textContent = text;
  }

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
    this.showLoading("Designing and building your world... (takes about 4-5 minutes)");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, template: this.selectedTemplate || undefined }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const text = await res.text();
        let msg: string;
        try {
          msg = JSON.parse(text).error;
        } catch {
          msg = `HTTP ${res.status}: ${text.slice(0, 200)}`;
        }
        throw new Error(msg);
      }

      // Read SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let spec: AnySpec | null = null;

      let sseError: string | null = null;

      const parseSSEBuffer = () => {
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!; // Keep incomplete chunk
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "status") {
              this.updateLoadingText(event.message);
            } else if (event.type === "complete") {
              spec = event.spec as AnySpec;
            } else if (event.type === "error") {
              sseError = event.message;
            }
          } catch (e) {
            console.error("[SSE] Failed to parse event:", line.slice(0, 200), e);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        parseSSEBuffer();
      }

      // Process any remaining data in the buffer after stream ends
      buffer += decoder.decode(); // flush decoder
      if (buffer.trim()) {
        buffer += "\n\n"; // ensure trailing delimiter so split works
        parseSSEBuffer();
      }

      if (sseError) {
        throw new Error(sseError);
      }

      if (!spec) {
        throw new Error("No game spec received from server");
      }

      // TypeScript can't track closure mutations for narrowing, so cast here
      const receivedSpec = spec as AnySpec;
      this.currentSpec = receivedSpec;

      // Hide creation overlay, show game + chat
      this.overlay.style.display = "none";
      this.hideLoading();
      this.showChatBar();

      this.addChatMessage({ role: "user", text: trimmed });
      const entityCount = "entities" in receivedSpec
        ? `${(receivedSpec as GameSpec).entities.length} entities`
        : `${(receivedSpec as ShooterSpec).enemies.length} enemies, ${(receivedSpec as ShooterSpec).weapons.length} weapons`;
      this.addChatMessage({
        role: "system",
        text: `Generated "${receivedSpec.name}" — ${entityCount}`,
      });

      await this.onSpec(receivedSpec);
    } catch (err) {
      this.hideLoading();
      btn.disabled = false;
      textarea.disabled = false;
      btn.textContent = "Generate";
      let message: string;
      if (err instanceof DOMException && err.name === "AbortError") {
        message =
          "Request timed out (5 min). The AI may be overloaded — try again.";
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
        body: JSON.stringify({
          spec: this.currentSpec,
          instruction,
          template: this.selectedTemplate || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let msg: string;
        try {
          msg = JSON.parse(text).error;
        } catch {
          msg = `HTTP ${res.status}: ${text.slice(0, 200)}`;
        }
        throw new Error(msg);
      }

      const { spec } = (await res.json()) as { spec: AnySpec };
      this.currentSpec = spec;

      this.hideLoading();
      this.chatInput.disabled = false;
      this.chatSendBtn.disabled = false;
      const refineCount = "entities" in spec
        ? `${(spec as GameSpec).entities.length} entities`
        : `${(spec as ShooterSpec).enemies.length} enemies, ${(spec as ShooterSpec).weapons.length} weapons`;
      this.addChatMessage({
        role: "system",
        text: `Updated "${spec.name}" — ${refineCount}`,
      });

      await this.onSpec(spec);
    } catch (err) {
      this.hideLoading();
      this.chatInput.disabled = false;
      this.chatSendBtn.disabled = false;
      const message =
        err instanceof Error ? err.message : "Refinement failed";
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
