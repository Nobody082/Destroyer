import type { CatalogData, CatalogEffect, CatalogParam } from "./types";

export function buildEffectDefaults(effect: CatalogEffect): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const p of effect.params || []) {
    if (p.name === "p" || p.name === "always_apply") continue;
    if (p.default !== undefined) {
      defaults[p.name] = structuredClone(p.default);
    }
  }
  if (effect.fix_args) {
    for (const [k, v] of Object.entries(effect.fix_args)) {
      defaults[k] = structuredClone(v);
    }
  }
  return defaults;
}

export function getEditableParams(effect: CatalogEffect): CatalogParam[] {
  return (effect.params || []).filter((p) => p.name !== "p" && p.name !== "always_apply");
}

export function isSlowEffect(effect: CatalogEffect): boolean {
  return typeof effect.avg_ms === "number" && effect.avg_ms > 1500;
}

export function indexCatalogEffects(catalog: CatalogData | null): Map<string, CatalogEffect> {
  const map = new Map<string, CatalogEffect>();
  if (!catalog) return map;
  for (const eff of catalog.effects) {
    map.set(eff.id, eff);
  }
  return map;
}
