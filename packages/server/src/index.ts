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
    console.log(
      `[generate] Done: "${spec.name}" (template: ${template ?? "classic"})`,
    );
    sendEvent("complete", { spec });
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
    let refined;
    if (template === "shooter" || spec.template === "shooter") {
      refined = await refiner.refineShooter(spec, instruction);
      console.log(`[refine] Done: "${refined.name}" (${refined.enemies.length} enemies)`);
    } else {
      refined = await refiner.refine(spec, instruction);
      console.log(`[refine] Done: "${refined.name}" (${refined.entities.length} entities)`);
    }
    res.json({ spec: refined });
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
