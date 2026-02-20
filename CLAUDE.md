# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# All commands use npx pnpm (pnpm is not installed globally)
npx pnpm dev              # Run engine + server in parallel (recommended)
npx pnpm dev:engine       # Vite dev server on port 3000 (browser UI)
npx pnpm dev:server       # Express API server on port 3001
npx pnpm build            # Build all packages
npx pnpm typecheck        # Type check all packages

# Single-package commands
npx pnpm --filter @otherside/engine typecheck
npx pnpm --filter @otherside/server typecheck
npx pnpm --filter @otherside/shared typecheck
npx pnpm --filter @otherside/ai typecheck

# Install dependencies
npx pnpm install
```

No test runner or linter is configured yet.

## Running the App

1. Set `ANTHROPIC_API_KEY` in `.env` at the repo root (never committed — in `.gitignore`)
2. Run `npx pnpm dev` to start both servers
3. Open **http://localhost:3000** (Vite UI). Do NOT use port 3001 — that's the API-only server.
4. Vite proxies `/api/*` requests to Express on port 3001. Changes to `vite.config.ts` require a full Vite restart (HMR doesn't reload proxy config).

## Architecture

This is a **pnpm workspace monorepo** for a 3D game engine/worldbuilder that uses AI to generate playable 3D games from natural language descriptions.

### Packages

- **`packages/shared`** (`@otherside/shared`) — Zod schemas and inferred TypeScript types defining the `GameSpec` format. All game data (entities, behaviors, terrain, rules, player config) is validated through `schema.ts`. Sample game specs live in `sample-specs/`.

- **`packages/ai`** (`@otherside/ai`) — AI generation layer using the Anthropic SDK (`@anthropic-ai/sdk`). Contains a 2-step generation pipeline (merged generator + validator) and a spec refiner. Runs server-side only (API key never exposed to browser).

- **`packages/server`** (`@otherside/server`) — Express 5 backend. Exposes `POST /api/generate` (SSE streaming) and `POST /api/refine` (JSON) endpoints. Loads `ANTHROPIC_API_KEY` from root `.env` via `dotenv.config({ path: "../../.env" })` (pnpm runs from the package directory, not repo root). All server timeouts are set to 0 (disabled) since LLM pipeline calls can take several minutes.

- **`packages/engine`** (`@otherside/engine`) — Browser-based 3D game client using Three.js for rendering and Rapier WASM (`@dimforge/rapier3d-compat`) for physics. Vite bundles and serves it on port 3000, with proxy to port 3001 for API calls.

### AI Generation Pipeline (`packages/ai`)

The pipeline (`pipeline.ts`) runs 2 steps using `claude-sonnet-4-6`, with real-time progress via an `onProgress` callback:

1. **Generator** (`max_tokens: 32768`, 3 retries, streamed) — Single merged LLM call that takes user prompt → valid `GameSpec` JSON directly. Combines creative design (theme, entities, behaviors) with technical building (schema compliance, physics rules) in one `GENERATOR_SYSTEM_PROMPT`. Matched against a template library (`templates.ts`) with 4 layout patterns: arena, corridor, open_world, platformer.

2. **Validator** — Runs programmatic checks (`validator.ts`): enemy spawn distance, out-of-bounds, patrol bounds, NPC/collectible overlaps, collectible clustering. `autoFixSpec()` fixes issues programmatically first. Only calls LLM (`claude-haiku-4-5-20251001` for speed) if programmatic fix leaves remaining issues.

Key design decisions:
- Designer + Builder merged into a single LLM call to cut generation time
- `onProgress` callback emits status strings ("Designing and building your world...", "Validating...", "Retrying...") consumed by server SSE endpoint
- Validator LLM fix uses Haiku (fast + cheap) since it's a rare path with graceful fallback
- `claude-sonnet-4-6` does NOT support assistant message prefill — use `extractJSON()` to find JSON in response instead
- Overlap detection only checks NPC and collectible entities — props (walls, pillars) naturally overlap with adjacent entities
- Generator prompt caps entities at 12 total + max 4 props to keep pipeline fast
- `SpecRefiner` also validates + auto-fixes after refinement
- Total pipeline time: ~20-40s happy path (single LLM call ~20-40s)

### Engine Architecture

The engine follows this runtime flow: `main.ts` → init Rapier WASM → show `CreationUI` → user describes game → fetch `/api/generate` → `GameRenderer.init()` → `GameRenderer.start()`. Refinements hit `/api/refine`, dispose the old renderer, and create a new one with the updated spec.

**`creation-ui.ts`** is the DOM-based creation/refinement interface. Shows a full-screen input overlay initially, then a chat bar at the bottom after game generation. Generation uses SSE streaming (`/api/generate` returns `text/event-stream`) to show real-time progress updates in the loading overlay. Refinement uses standard JSON fetch (`/api/refine`). Uses AbortController with 5-minute timeout on fetch calls.

**`game-renderer.ts`** is the core game orchestrator (~800 lines). It owns:
- Fixed-timestep game loop (60Hz physics, requestAnimationFrame render)
- Entity spawning/destruction with physics body lifecycle
- `colliderMap: Map<number, RuntimeEntity>` mapping Rapier collider handles to entities
- Raycast attack system (left-click → `world.castRay` with player collider excluded via `filterExcludeCollider`)
- Rapier `EventQueue` for collision detection
- Win/lose condition checking
- `dispose()` cleans up canvas, physics world, event listeners

**`behavior-manager.ts`** runs all 7 behavior types each tick, returning a `BehaviorEvents` struct (scored, damaged, healed, spawnRequests, destroyIds) that the game renderer applies.

**`player-controller.ts`** handles first-person controls: Pointer Lock API, WASD movement, mouse look, gravity + jump via Rapier's `KinematicCharacterController`.

**`hud.ts`** is a DOM-based overlay (not canvas) for score, health, crosshair, hit markers, damage numbers, and game state messages.

### Schema Design

`GameSpec` is a single Zod object that fully describes a playable game. Key patterns:
- `BehaviorSchema` is a discriminated union on `type` with 7 variants
- `SpawnerBehaviorSchema` uses a non-recursive `SpawnTemplateSchema` (which only allows `BasicBehaviorSchema`, excluding spawner) to avoid circular references
- `MeshSchema` is a discriminated union on `kind` (primitive vs model)
- All types are inferred from Zod schemas (`z.infer<typeof ...>`)

### Cross-Package Dependencies

`shared` is a devDependency of `engine`, `server`, and `ai` via `workspace:*`. `ai` is a devDependency of `server`. Module resolution uses TypeScript's `"bundler"` mode, so packages import directly from source (`@otherside/shared` resolves to `packages/shared/src/index.ts`).

## Key Conventions

- TypeScript strict mode, ES2022 target, ESNext modules
- Rapier uses `@dimforge/rapier3d-compat` (WASM, requires async `init()` before use)
- Rapier raycast: always exclude the player's own collider via `filterExcludeCollider` (6th arg of `world.castRay`) and offset ray origin 0.5 units forward — the camera sits inside the player's capsule
- Physics bodies: kinematic for player and patrolling NPCs, dynamic for projectiles, fixed for terrain/static props
- Entities with `sensor: true` physics trigger collision events without physical blocking
- `RuntimeEntity` (in `types.ts`) bridges the spec-level `Entity` with runtime state (Three.js mesh, Rapier body/collider, health, active flag)
- Attack line VFX uses `CylinderGeometry` mesh, not `THREE.Line` (macOS WebGL ignores `linewidth > 1`)
- dotenv path: server loads `.env` from `../../.env` relative to its package dir since pnpm sets CWD to the package directory
- Vite proxy config: target uses `127.0.0.1` (not `localhost`) to avoid IPv4/IPv6 resolution issues; `configure` callback logs proxy requests/responses/errors for debugging; flushes headers for SSE (`text/event-stream`) responses to prevent buffering
