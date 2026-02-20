import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AssetCatalog, AssetEntry } from "@otherside/shared";

const CATALOG_URL = "/assets/catalog.json";
const ASSETS_BASE = "/assets/";

export class AssetLoader {
  private catalog: AssetCatalog | null = null;
  private modelCache = new Map<string, THREE.Group>();
  private loadingPromises = new Map<string, Promise<THREE.Group | null>>();
  private gltfLoader = new GLTFLoader();

  /** Fetch and parse catalog.json. Safe to call multiple times — no-ops after first load. */
  async loadCatalog(): Promise<AssetCatalog | null> {
    if (this.catalog) return this.catalog;

    try {
      const res = await fetch(CATALOG_URL);
      if (!res.ok) {
        console.warn(`[AssetLoader] Failed to fetch catalog: ${res.status}`);
        return null;
      }
      this.catalog = (await res.json()) as AssetCatalog;
      const count = this.catalog
        ? Object.values(this.catalog.assets).reduce(
            (sum, cat) => sum + Object.keys(cat).length,
            0,
          )
        : 0;
      console.log(`[AssetLoader] Catalog loaded — ${count} assets registered`);
      return this.catalog;
    } catch (err) {
      console.warn("[AssetLoader] Could not load catalog:", err);
      return null;
    }
  }

  /** Get the loaded catalog (null if not loaded yet) */
  getCatalog(): AssetCatalog | null {
    return this.catalog;
  }

  /** Look up a catalog entry by assetId */
  getEntry(assetId: string): AssetEntry | undefined {
    if (!this.catalog) return undefined;
    for (const category of Object.values(this.catalog.assets)) {
      if (assetId in category) return category[assetId];
    }
    return undefined;
  }

  /**
   * Synchronously get a cached model clone. Returns null if not preloaded.
   * Use this in synchronous code paths (e.g. spawnEntity) after preloadForSpec().
   */
  getModelSync(assetId: string): THREE.Group | null {
    const cached = this.modelCache.get(assetId);
    return cached ? cached.clone() : null;
  }

  /**
   * Load a 3D model by assetId.
   * Returns a cloned Group so each entity gets its own instance.
   * Returns null if the asset doesn't exist or loading fails.
   */
  async loadModel(assetId: string): Promise<THREE.Group | null> {
    // Already cached — return a clone
    const cached = this.modelCache.get(assetId);
    if (cached) return cached.clone();

    // Already loading — wait for the same promise
    const pending = this.loadingPromises.get(assetId);
    if (pending) {
      const result = await pending;
      return result ? result.clone() : null;
    }

    // Look up in catalog
    const entry = this.getEntry(assetId);
    if (!entry) {
      console.warn(`[AssetLoader] Unknown assetId: "${assetId}"`);
      return null;
    }

    // Start loading
    const promise = this.loadGLB(entry);
    this.loadingPromises.set(assetId, promise);

    const result = await promise;
    this.loadingPromises.delete(assetId);

    if (result) {
      this.modelCache.set(assetId, result);
      return result.clone();
    }
    return null;
  }

  /**
   * Preload all assets referenced by a spec before the game starts.
   * Scans for assetId fields anywhere in the spec and loads them in parallel.
   */
  async preloadForSpec(spec: unknown): Promise<void> {
    const assetIds = this.collectAssetIds(spec);
    if (assetIds.size === 0) return;

    console.log(`[AssetLoader] Preloading ${assetIds.size} assets...`);
    const promises = Array.from(assetIds).map((id) => this.loadModel(id));
    await Promise.all(promises);
    console.log(`[AssetLoader] Preload complete`);
  }

  /** Dispose all cached models */
  dispose(): void {
    for (const group of this.modelCache.values()) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          const mat = child.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat?.dispose();
          }
        }
      });
    }
    this.modelCache.clear();
    this.loadingPromises.clear();
  }

  // ── Private helpers ─────────────────────────────────────────────

  private async loadGLB(entry: AssetEntry): Promise<THREE.Group | null> {
    const url = ASSETS_BASE + entry.file;
    try {
      const gltf = await this.gltfLoader.loadAsync(url);
      const model = gltf.scene;

      // Apply default scale
      if (entry.defaultScale !== 1) {
        model.scale.setScalar(entry.defaultScale);
      }

      // Enable shadows on all meshes
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      console.log(`[AssetLoader] Loaded "${entry.id}" from ${entry.file}`);
      return model;
    } catch (err) {
      console.warn(`[AssetLoader] Failed to load "${entry.id}" from ${url}:`, err);
      return null;
    }
  }

  /** Recursively scan an object for all `assetId` string values */
  private collectAssetIds(obj: unknown): Set<string> {
    const ids = new Set<string>();
    this.walkForAssetIds(obj, ids);
    return ids;
  }

  private walkForAssetIds(obj: unknown, ids: Set<string>): void {
    if (obj === null || obj === undefined || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.walkForAssetIds(item, ids);
      }
      return;
    }

    const record = obj as Record<string, unknown>;
    if (typeof record.assetId === "string" && record.assetId.length > 0) {
      ids.add(record.assetId);
    }
    for (const value of Object.values(record)) {
      this.walkForAssetIds(value, ids);
    }
  }
}
