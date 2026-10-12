import { buildEffectDefaults } from "./catalog";
import type {
  AugraphyPhase,
  CatalogEffect,
  JobRequestPayload,
  OutputFormat,
  PlannedStep,
  PlannedTask,
} from "./types";

const PHASE_RANK: Record<AugraphyPhase, number> = {
  ink: 0,
  paper: 1,
  post: 2,
};

/**
 * Deterministic 32-bit PRNG (mulberry32).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic task seed derived from (jobSeed, taskIndex).
 */
export function deriveTaskSeed(jobSeed: number, taskIndex: number): number {
  let h = (jobSeed ^ Math.imul(taskIndex + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) & 0x7fffffff;
}

export function sanitizeFileSegment(raw: string): string {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9+_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned.slice(0, 96) || "item";
}

export function padIndex(n: number, width = 3): string {
  return String(n).padStart(width, "0");
}

export function formatExt(fmt: OutputFormat): string {
  if (fmt === "jpg") return "jpg";
  if (fmt === "webp") return "webp";
  return "png";
}

export function sortEffectsCanonical<T extends { lib: string; phase?: AugraphyPhase }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.lib !== b.lib) {
      return a.lib === "augraphy" ? -1 : 1;
    }
    if (a.lib === "augraphy" && b.lib === "augraphy") {
      const pa = PHASE_RANK[a.phase ?? "post"] ?? 2;
      const pb = PHASE_RANK[b.phase ?? "post"] ?? 2;
      return pa - pb;
    }
    return 0;
  });
}

export function buildJobPlan(
  job: JobRequestPayload,
  catalogMap: Map<string, CatalogEffect>,
  resolvedSeed: number
): PlannedTask[] {
  const ext = formatExt(job.format);
  const repeats = Math.max(1, Math.min(50, Math.floor(job.repeats || 1)));
  const count = Math.max(1, Math.min(200, Math.floor(job.count || 1)));

  const resolvedSelections: PlannedStep[] = [];
  for (const item of job.effects || []) {
    const meta = catalogMap.get(item.id);
    if (!meta || meta.status !== "ok") continue;
    const defaults = buildEffectDefaults(meta);
    const mergedParams = { ...defaults, ...(item.params || {}) };
    resolvedSelections.push({
      id: meta.id,
      lib: meta.lib,
      name: meta.name,
      phase: meta.phase,
      category: meta.category,
      params: mergedParams,
    });
  }

  if (resolvedSelections.length === 0) {
    return [];
  }

  const tasks: PlannedTask[] = [];
  let taskIdx = 0;
  const usedPaths = new Set<string>();

  const claimUniqueFlatPath = (baseName: string): string => {
    const candidate = `${baseName}.${ext}`;
    if (!usedPaths.has(candidate)) {
      usedPaths.add(candidate);
      return candidate;
    }
    let counter = 2;
    while (usedPaths.has(`${baseName}_${padIndex(counter, 2)}.${ext}`)) {
      counter++;
    }
    const unique = `${baseName}_${padIndex(counter, 2)}.${ext}`;
    usedPaths.add(unique);
    return unique;
  };

  if (job.mode === "each") {
    for (const step of resolvedSelections) {
      const safeName = sanitizeFileSegment(step.name);
      for (let r = 1; r <= repeats; r++) {
        const index = ++taskIdx;
        const id = `t_${padIndex(index, 4)}`;
        const seed = deriveTaskSeed(resolvedSeed, index);
        const fileStem = repeats > 1 ? `${safeName}_${padIndex(r, 2)}` : safeName;
        const relativePath = claimUniqueFlatPath(fileStem);
        tasks.push({
          id,
          index,
          effectIds: [step.id],
          steps: [step],
          label: repeats > 1 ? `${step.name} #${r}` : step.name,
          seed,
          relativePath,
        });
      }
    }
    return tasks;
  }

  if (job.mode === "mix") {
    const rng = mulberry32(resolvedSeed);
    const poolSize = resolvedSelections.length;
    const rawMin = Math.max(1, Math.floor(job.kRange?.[0] ?? 2));
    const rawMax = Math.max(rawMin, Math.floor(job.kRange?.[1] ?? 3));
    const kMin = Math.min(rawMin, poolSize);
    const kMax = Math.min(rawMax, poolSize);

    for (let i = 1; i <= count; i++) {
      const index = ++taskIdx;
      const id = `t_${padIndex(index, 4)}`;
      const k = kMin + Math.floor(rng() * (kMax - kMin + 1));

      // Fisher-Yates partial shuffle using seeded PRNG
      const poolCopy = [...resolvedSelections];
      for (let j = 0; j < k; j++) {
        const pickIdx = j + Math.floor(rng() * (poolCopy.length - j));
        const tmp = poolCopy[j];
        poolCopy[j] = poolCopy[pickIdx];
        poolCopy[pickIdx] = tmp;
      }

      const chosen = sortEffectsCanonical(poolCopy.slice(0, k));
      const label = chosen.map((c) => c.name).join("+");
      const safeCombo = sanitizeFileSegment(label);
      const seed = deriveTaskSeed(resolvedSeed, index);
      const relativePath = claimUniqueFlatPath(safeCombo);

      tasks.push({
        id,
        index,
        effectIds: chosen.map((c) => c.id),
        steps: chosen,
        label,
        seed,
        relativePath,
      });
    }
    return tasks;
  }

  // mode === "chain": user-ordered list; engine executes Augraphy first (in phase slots) then Albumentations
  const chainSteps = [...resolvedSelections];
  const label = chainSteps.map((c) => c.name).join("+");
  const safeCombo = sanitizeFileSegment(label);

  for (let r = 1; r <= repeats; r++) {
    const index = ++taskIdx;
    const id = `t_${padIndex(index, 4)}`;
    const seed = deriveTaskSeed(resolvedSeed, index);
    const fileStem = repeats > 1 ? `${safeCombo}_${padIndex(r, 2)}` : safeCombo;
    const relativePath = claimUniqueFlatPath(fileStem);
    tasks.push({
      id,
      index,
      effectIds: chainSteps.map((c) => c.id),
      steps: chainSteps,
      label: repeats > 1 ? `${label} #${r}` : label,
      seed,
      relativePath,
    });
  }

  return tasks;
}
