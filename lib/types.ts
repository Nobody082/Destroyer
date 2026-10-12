export type ParamKind = "int" | "float" | "bool" | "str" | "choice" | "range" | "json";

export interface CatalogParam {
  name: string;
  kind: ParamKind;
  default: unknown;
  choices?: Array<string | number>;
  numeric?: "int" | "float";
  required?: boolean;
}

export type AugraphyPhase = "ink" | "paper" | "post";
export type AlbumentationsCategory = "pixel" | "spatial";
export type EffectLibrary = "augraphy" | "albumentations";

export interface CatalogEffect {
  id: string;
  lib: EffectLibrary;
  name: string;
  phase?: AugraphyPhase;
  category?: AlbumentationsCategory;
  phase_source?: string;
  module?: string;
  doc: string;
  params: CatalogParam[];
  status: "ok" | "unsupported";
  reason?: string | null;
  avg_ms?: number | null;
  changed?: boolean;
  fix_args?: Record<string, unknown>;
}

export interface PythonHealthStatus {
  ok: boolean;
  pythonExe?: string;
  error?: string;
  fixCommand?: string;
}

export interface CatalogData {
  schema: number;
  versions: Record<string, string>;
  phase_order: AugraphyPhase[];
  effects: CatalogEffect[];
  excluded?: Array<{ lib: string; name: string; reason: string }>;
  smoke?: Record<string, unknown>;
  pythonHealth?: PythonHealthStatus;
}

export type GenerationMode = "each" | "mix" | "chain";
export type OutputFormat = "png" | "jpg" | "webp";

export interface SelectedEffectConfig {
  id: string;
  params: Record<string, unknown>;
}

export interface JobRequestPayload {
  mode: GenerationMode;
  effects: SelectedEffectConfig[];
  repeats: number;
  count: number;
  kRange: [number, number];
  seed: number | null;
  maxSide: number | null;
  format: OutputFormat;
  quality: number;
  sourceName?: string;
}

export interface PlannedStep {
  id: string;
  lib: EffectLibrary;
  name: string;
  phase?: AugraphyPhase;
  category?: AlbumentationsCategory;
  params: Record<string, unknown>;
}

export interface PlannedTask {
  id: string;
  index: number;
  effectIds: string[];
  steps: PlannedStep[];
  label: string;
  seed: number;
  relativePath: string;
}

export interface GeneratedResultItem {
  id: string;
  jobId: string;
  effects: string[];
  label: string;
  url: string;
  thumbUrl: string;
  ms: number;
  w: number;
  h: number;
  changed: boolean;
  path: string;
  seed?: number;
}

export interface JobFailureItem {
  id?: string;
  effect?: string;
  message: string;
}

export interface JobManifest {
  jobId: string;
  createdAt: string;
  sourceFileName: string;
  seed: number;
  mode: GenerationMode;
  format: OutputFormat;
  quality: number;
  maxSide: number | null;
  original: {
    path: string;
    width: number;
    height: number;
    url: string;
  };
  versions: Record<string, string>;
  totalPlanned: number;
  okCount: number;
  failedCount: number;
  cancelled: boolean;
  elapsedMs: number;
  results: Array<{
    id: string;
    path: string;
    label: string;
    effects: string[];
    params: Record<string, Record<string, unknown>>;
    seed: number;
    ms: number;
    width: number;
    height: number;
    changed: boolean;
  }>;
  failures: JobFailureItem[];
}

export type StreamEvent =
  | {
      type: "start";
      jobId: string;
      seed: number;
      total: number;
      original: { url: string; thumbUrl: string; w: number; h: number; path: string };
    }
  | {
      type: "progress";
      done: number;
      total: number;
      etaMs: number;
      elapsedMs: number;
    }
  | {
      type: "result";
      id: string;
      effects: string[];
      label: string;
      url: string;
      thumbUrl: string;
      ms: number;
      w: number;
      h: number;
      changed: boolean;
      path: string;
      seed?: number;
    }
  | {
      type: "error";
      id?: string;
      effect?: string;
      message: string;
    }
  | {
      type: "done";
      jobId: string;
      ok: number;
      failed: number;
      ms: number;
      cancelled?: boolean;
      seed: number;
      manifest: JobManifest;
    };
