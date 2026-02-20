import dotenv from "dotenv";
// pnpm runs from packages/server/, so .env is two levels up at repo root
dotenv.config({ path: "../../.env" });

import express from "express";
import { GameGenerator, SpecRefiner } from "@otherside/ai";

const app = express();
const PORT = 3001;

app.use(express.json({ limit: "1mb" }));

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey === "your-api-key-here") {
  console.warn(
    "⚠ ANTHROPIC_API_KEY not set in .env — /api/generate and /api/refine will fail",
  );
}

const generator = new GameGenerator(apiKey ?? "");
const refiner = new SpecRefiner(apiKey ?? "");

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Missing 'prompt' string in request body" });
    return;
  }

  try {
    const { spec, designDoc } = await generator.generate(prompt);
    console.log(`[generate] Done: "${spec.name}" (${spec.entities.length} entities)`);
    res.json({ spec, designDoc });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[generate] Error:", message);
    res.status(500).json({ error: message });
  }
});

app.post("/api/refine", async (req, res) => {
  const { spec, instruction } = req.body;
  if (!spec || !instruction || typeof instruction !== "string") {
    res
      .status(400)
      .json({ error: "Missing 'spec' and/or 'instruction' in request body" });
    return;
  }

  try {
    const refined = await refiner.refine(spec, instruction);
    console.log(`[refine] Done: "${refined.name}" (${refined.entities.length} entities)`);
    res.json({ spec: refined });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refinement failed";
    console.error("[refine] Error:", message);
    res.status(500).json({ error: message });
  }
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
