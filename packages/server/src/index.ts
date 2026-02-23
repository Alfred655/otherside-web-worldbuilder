import dotenv from "dotenv";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
// pnpm runs from packages/server/, so .env is two levels up at repo root
dotenv.config({ path: "../../.env" });

import express from "express";
import { GameGenerator, SpecRefiner } from "@otherside/ai";
import { generateAssetSummaryForAI } from "@otherside/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(express.json({ limit: "1mb" }));

// ── Spec summary helpers ────────────────────────────────────────────────────

function generateSpecSummary(spec: any): string {
  if (spec.template === "shooter") {
    const s = spec;
    const template = s.arena?.layoutTemplate ?? "custom";
    const w = s.arena?.size?.x ?? "?";
    const d = s.arena?.size?.z ?? "?";
    const enemyTypes = [...new Set((s.enemies ?? []).map((e: any) => e.name))];
    const weaponNames = (s.weapons ?? []).map((w: any) => w.name);
    const pickupCount = (s.pickups ?? []).length;
    const mode = s.rules?.mode ?? "elimination";
    const time = s.world?.timeOfDay ?? "";
    const parts = [
      `${template} arena (${w}x${d})`,
      `${s.enemies?.length ?? 0} enemies (${enemyTypes.join(", ")})`,
      `${weaponNames.length} weapons (${weaponNames.join(", ")})`,
      `${pickupCount} pickups`,
      mode,
    ];
    if (time) parts.push(time);
    return `Built "${s.name}" — ${parts.join(", ")}`;
  }
  // Classic spec
  const entities = spec.entities ?? [];
  const types: Record<string, number> = {};
  for (const e of entities) {
    types[e.type] = (types[e.type] ?? 0) + 1;
  }
  const breakdown = Object.entries(types).map(([t, c]) => `${c} ${t}${c > 1 ? "s" : ""}`).join(", ");
  const terrain = spec.terrain;
  const tw = terrain?.size?.x ?? "?";
  const td = terrain?.size?.z ?? "?";
  return `Built "${spec.name}" — terrain (${tw}x${td}), ${entities.length} entities (${breakdown}), ${spec.rules?.winCondition ?? "unknown"} mode`;
}

function generateRefineSummary(oldSpec: any, newSpec: any): string {
  const changes: string[] = [];

  // Enemy changes (shooter)
  if (newSpec.template === "shooter") {
    const oldEnemies = oldSpec.enemies ?? [];
    const newEnemies = newSpec.enemies ?? [];
    const oldIds = new Set(oldEnemies.map((e: any) => e.id));
    const added = newEnemies.filter((e: any) => !oldIds.has(e.id));
    const removedCount = oldEnemies.filter((e: any) => !new Set(newEnemies.map((n: any) => n.id)).has(e.id)).length;
    if (added.length > 0) changes.push(`Added ${added.length} enemies: ${added.map((e: any) => e.name).join(", ")}`);
    if (removedCount > 0) changes.push(`Removed ${removedCount} enemies`);

    // Weapon changes
    const oldWeapons = oldSpec.weapons ?? [];
    const newWeapons = newSpec.weapons ?? [];
    const oldWepIds = new Set(oldWeapons.map((w: any) => w.id));
    const addedWeapons = newWeapons.filter((w: any) => !oldWepIds.has(w.id));
    if (addedWeapons.length > 0) changes.push(`Added weapons: ${addedWeapons.map((w: any) => `${w.name} (dmg: ${w.damage})`).join(", ")}`);

    // Pickup changes
    const oldPickups = (oldSpec.pickups ?? []).length;
    const newPickups = (newSpec.pickups ?? []).length;
    if (newPickups !== oldPickups) changes.push(`Pickups: ${oldPickups} → ${newPickups}`);

    // Arena size
    const oldSize = oldSpec.arena?.size;
    const newSize = newSpec.arena?.size;
    if (oldSize && newSize && (oldSize.x !== newSize.x || oldSize.z !== newSize.z)) {
      changes.push(`Arena size: ${oldSize.x}x${oldSize.z} → ${newSize.x}x${newSize.z}`);
    }

    // Zone changes
    const oldZones = (oldSpec.arena?.zones ?? []).length;
    const newZones = (newSpec.arena?.zones ?? []).length;
    if (newZones !== oldZones) changes.push(`Zones: ${oldZones} → ${newZones}`);

    // Template change
    if (oldSpec.arena?.layoutTemplate !== newSpec.arena?.layoutTemplate) {
      changes.push(`Layout: ${oldSpec.arena?.layoutTemplate ?? "none"} → ${newSpec.arena?.layoutTemplate ?? "none"}`);
    }
  } else {
    // Classic spec
    const oldEntities = oldSpec.entities ?? [];
    const newEntities = newSpec.entities ?? [];
    const oldIds = new Set(oldEntities.map((e: any) => e.id));
    const added = newEntities.filter((e: any) => !oldIds.has(e.id));
    const removedCount = oldEntities.filter((e: any) => !new Set(newEntities.map((n: any) => n.id)).has(e.id)).length;
    if (added.length > 0) changes.push(`Added ${added.length} entities: ${added.map((e: any) => e.name).join(", ")}`);
    if (removedCount > 0) changes.push(`Removed ${removedCount} entities`);
  }

  // World/lighting changes (shared)
  const oldWorld = oldSpec.world ?? {};
  const newWorld = newSpec.world ?? {};
  if (oldWorld.timeOfDay !== newWorld.timeOfDay && newWorld.timeOfDay) {
    changes.push(`Time of day: ${oldWorld.timeOfDay ?? "none"} → ${newWorld.timeOfDay}`);
  }
  if (oldWorld.skyColor !== newWorld.skyColor) {
    changes.push(`Sky color: ${oldWorld.skyColor} → ${newWorld.skyColor}`);
  }
  if (!oldWorld.fog && newWorld.fog) {
    changes.push(`Added fog (${newWorld.fog.color})`);
  } else if (oldWorld.fog && !newWorld.fog) {
    changes.push(`Removed fog`);
  }
  if (oldWorld.ambientLightIntensity !== newWorld.ambientLightIntensity) {
    changes.push(`Ambient intensity: ${oldWorld.ambientLightIntensity} → ${newWorld.ambientLightIntensity}`);
  }

  if (changes.length === 0) changes.push("Minor adjustments applied");
  return `Updated "${newSpec.name}" — ${changes.join(". ")}`;
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey === "your-api-key-here") {
  console.warn(
    "⚠ ANTHROPIC_API_KEY not set in .env — /api/generate and /api/refine will fail",
  );
}

const generator = new GameGenerator(apiKey ?? "");
const refiner = new SpecRefiner(apiKey ?? "");

// Load asset catalog and inject summary into AI generator
const catalogPath = path.resolve(__dirname, "../../../assets/catalog.json");
try {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));
  const summary = generateAssetSummaryForAI(catalog);
  generator.setAssetSummary(summary);
  refiner.setAssetSummary(summary);
  const assetCount = Object.values(catalog.assets ?? {}).reduce(
    (sum: number, cat: any) => sum + Object.keys(cat).length, 0,
  );
  console.log(`[assets] Loaded catalog with ${assetCount} assets`);
} catch (err) {
  console.warn("[assets] Could not load asset catalog:", err instanceof Error ? err.message : err);
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/generate", async (req, res) => {
  const { prompt, template } = req.body;
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Missing 'prompt' string in request body" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendEvent = (type: string, data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const { spec } = await generator.generate(prompt, (status) => {
      sendEvent("status", { message: status });
    }, template);
    const summary = generateSpecSummary(spec);
    console.log(
      `[generate] Done: "${spec.name}" (template: ${template ?? "classic"})`,
    );
    sendEvent("complete", { spec, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[generate] Error:", message);
    sendEvent("error", { message });
  }

  res.end();
});

app.post("/api/refine", async (req, res) => {
  const { spec, instruction, template } = req.body;
  if (!spec || !instruction || typeof instruction !== "string") {
    res
      .status(400)
      .json({ error: "Missing 'spec' and/or 'instruction' in request body" });
    return;
  }

  try {
    const oldSpec = spec;
    let refined;
    if (template === "shooter" || spec.template === "shooter") {
      refined = await refiner.refineShooter(spec, instruction);
      console.log(`[refine] Done: "${refined.name}" (${refined.enemies.length} enemies)`);
    } else {
      refined = await refiner.refine(spec, instruction);
      console.log(`[refine] Done: "${refined.name}" (${refined.entities.length} entities)`);
    }
    const summary = generateRefineSummary(oldSpec, refined);
    res.json({ spec: refined, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refinement failed";
    console.error("[refine] Error:", message);
    res.status(500).json({ error: message });
  }
});

// In production, serve the Vite-built frontend
const engineDist = path.resolve(__dirname, "../../engine/dist");
app.use(express.static(engineDist));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(engineDist, "index.html"));
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// LLM pipeline can take 60-90s — disable socket timeouts so the proxy
// doesn't drop the connection while waiting for the Anthropic API.
server.timeout = 0;
server.keepAliveTimeout = 0;
server.headersTimeout = 0;
server.requestTimeout = 0;
