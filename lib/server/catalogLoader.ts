import fs from "node:fs/promises";
import type { CatalogData } from "@/lib/types";
import { CATALOG_PATH } from "./paths";

declare global {
  var __augCatalogCache: { mtimeMs: number; data: CatalogData } | undefined;
}

export async function loadCatalogFromDisk(): Promise<CatalogData> {
  const stat = await fs.stat(CATALOG_PATH);
  const cached = globalThis.__augCatalogCache;
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.data;
  }
  const raw = await fs.readFile(CATALOG_PATH, "utf8");
  const parsed = JSON.parse(raw) as CatalogData;
  globalThis.__augCatalogCache = { mtimeMs: stat.mtimeMs, data: parsed };
  return parsed;
}
