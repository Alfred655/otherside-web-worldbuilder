#!/usr/bin/env node

/**
 * Add a 3D asset to the catalog.
 *
 * Usage:
 *   node scripts/add-asset.js \
 *     --file ~/Downloads/crate.glb \
 *     --id wooden_crate_01 \
 *     --name "Wooden Crate" \
 *     --category cover \
 *     --tags cover,wood,destructible \
 *     --collider box \
 *     --scale 1.0
 *
 * Options:
 *   --file       Path to the .glb file to import (required)
 *   --id         Unique asset ID (required)
 *   --name       Human-readable name (required)
 *   --category   One of: enemies, weapons, cover, pickups, environment, props (required)
 *   --tags       Comma-separated tags (required)
 *   --collider   Collider type: box, capsule, sphere, mesh (default: box)
 *   --scale      Default scale (default: 1.0)
 *   --width      Width in meters (optional)
 *   --height     Height in meters (optional)
 *   --depth      Depth in meters (optional)
 *   --animations Comma-separated animation names (optional)
 *   --thumbnail  Path to thumbnail image (optional, copied to assets/thumbs/)
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { basename, resolve, join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const CATALOG_PATH = join(ROOT, "assets", "catalog.json");
const MODELS_DIR = join(ROOT, "assets", "models");
const THUMBS_DIR = join(ROOT, "assets", "thumbs");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith("--")) {
        args[key] = val;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);

  // Validate required args
  const required = ["file", "id", "name", "category", "tags"];
  for (const key of required) {
    if (!args[key]) {
      console.error(`Missing required argument: --${key}`);
      console.error("Run with no arguments to see usage.");
      process.exit(1);
    }
  }

  const validCategories = ["enemies", "weapons", "cover", "pickups", "environment", "props"];
  if (!validCategories.includes(args.category)) {
    console.error(`Invalid category "${args.category}". Must be one of: ${validCategories.join(", ")}`);
    process.exit(1);
  }

  const validColliders = ["box", "capsule", "sphere", "mesh"];
  const collider = args.collider || "box";
  if (!validColliders.includes(collider)) {
    console.error(`Invalid collider "${collider}". Must be one of: ${validColliders.join(", ")}`);
    process.exit(1);
  }

  const srcFile = resolve(args.file);
  if (!existsSync(srcFile)) {
    console.error(`File not found: ${srcFile}`);
    process.exit(1);
  }

  // Load catalog
  if (!existsSync(CATALOG_PATH)) {
    console.error(`Catalog not found at ${CATALOG_PATH}`);
    process.exit(1);
  }
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));

  // Check for duplicate ID
  for (const cat of Object.values(catalog.assets)) {
    if (args.id in cat) {
      console.error(`Asset ID "${args.id}" already exists in the catalog`);
      process.exit(1);
    }
  }

  // Copy .glb to assets/models/
  const modelFilename = basename(srcFile);
  const destFile = join(MODELS_DIR, modelFilename);
  copyFileSync(srcFile, destFile);
  console.log(`Copied ${srcFile} -> ${destFile}`);

  // Build catalog entry
  const entry = {
    id: args.id,
    file: `models/${modelFilename}`,
    name: args.name,
    tags: args.tags.split(",").map((t) => t.trim()),
    category: args.category,
    defaultScale: parseFloat(args.scale || "1.0"),
    colliderType: collider,
  };

  // Optional dimensions
  if (args.width || args.height || args.depth) {
    entry.dimensions = {
      width: parseFloat(args.width || "1"),
      height: parseFloat(args.height || "1"),
      depth: parseFloat(args.depth || "1"),
    };
  }

  // Optional animations
  if (args.animations) {
    entry.animations = args.animations.split(",").map((a) => a.trim());
  }

  // Optional thumbnail
  if (args.thumbnail) {
    const thumbSrc = resolve(args.thumbnail);
    if (existsSync(thumbSrc)) {
      const thumbFilename = basename(thumbSrc);
      const thumbDest = join(THUMBS_DIR, thumbFilename);
      copyFileSync(thumbSrc, thumbDest);
      entry.thumbnail = `thumbs/${thumbFilename}`;
      console.log(`Copied thumbnail ${thumbSrc} -> ${thumbDest}`);
    } else {
      console.warn(`Thumbnail not found: ${thumbSrc}, skipping`);
    }
  }

  // Add to catalog
  catalog.assets[args.category][args.id] = entry;

  // Write catalog
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Added "${args.id}" to catalog under "${args.category}"`);
  console.log(`  Name: ${args.name}`);
  console.log(`  File: ${entry.file}`);
  console.log(`  Tags: ${entry.tags.join(", ")}`);
  console.log(`  Scale: ${entry.defaultScale}`);
  console.log(`  Collider: ${entry.colliderType}`);
}

main();
