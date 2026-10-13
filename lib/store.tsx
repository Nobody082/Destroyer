"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { upload as uploadBlob } from "@vercel/blob/client";
import { buildEffectDefaults, indexCatalogEffects } from "./catalog";
import { type PresetDefinition, resolvePresetEffects } from "./presets";
import type {
  AlbumentationsCategory,
  AugraphyPhase,
  CatalogData,
  CatalogEffect,
  GeneratedResultItem,
  GenerationMode,
  JobFailureItem,
  JobManifest,
  OutputFormat,
} from "./types";

export interface SourceImageInfo {
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  width: number;
  height: number;
  type: string;
}

export interface ToastItem {
  id: string;
  kind: "info" | "success" | "error";
  message: string;
}

export type PickerTab = "presets" | "augraphy" | "albumentations" | "chain";
export type AugraphySubTab = "all" | AugraphyPhase;
export type AlbumentationsSubTab = "all" | AlbumentationsCategory;
export type GalleryLibFilter = "all" | "augraphy" | "albumentations" | "multi";

export interface AppState {
  catalog: CatalogData | null;
  catalogLoading: boolean;
  catalogError: string | null;

  sourceImage: SourceImageInfo | null;
  imageError: string | null;

  mode: GenerationMode;
  repeats: number;
  count: number;
  kRange: [number, number];
  seedInput: string;
  lastUsedSeed: number | null;
  maxSideEnabled: boolean;
  maxSide: number;
  format: OutputFormat;
  quality: number;

  selectedIds: string[];
  effectParams: Record<string, Record<string, unknown>>;
  activePresetId: string | null;

  activeTab: PickerTab;
  augraphySubTab: AugraphySubTab;
  albumentationsSubTab: AlbumentationsSubTab;
  searchQuery: string;

  isGenerating: boolean;
  jobId: string | null;
  progress: {
    done: number;
    total: number;
    etaMs: number;
    elapsedMs: number;
  };
  originalResult: {
    url: string;
    thumbUrl: string;
    w: number;
    h: number;
    path: string;
  } | null;
  results: GeneratedResultItem[];
  selectedResultIds: string[];
  failures: JobFailureItem[];
  manifest: JobManifest | null;

  galleryLibFilter: GalleryLibFilter;
  gallerySearch: string;
  lightboxResultId: string | null;
  showFailedPanel: boolean;
  helpOpen: boolean;

  toasts: ToastItem[];
}

const STORAGE_KEY = "aug-lab-settings-v1";

const initialState: AppState = {
  catalog: null,
  catalogLoading: true,
  catalogError: null,

  sourceImage: null,
  imageError: null,

  mode: "each",
  repeats: 1,
  count: 8,
  kRange: [2, 3],
  seedInput: "",
  lastUsedSeed: null,
  maxSideEnabled: true,
  maxSide: 1600,
  format: "png",
  quality: 92,

  selectedIds: [],
  effectParams: {},
  activePresetId: null,

  activeTab: "augraphy",
  augraphySubTab: "all",
  albumentationsSubTab: "all",
  searchQuery: "",

  isGenerating: false,
  jobId: null,
  progress: { done: 0, total: 0, etaMs: 0, elapsedMs: 0 },
  originalResult: null,
  results: [],
  selectedResultIds: [],
  failures: [],
  manifest: null,

  galleryLibFilter: "all",
  gallerySearch: "",
  lightboxResultId: null,
  showFailedPanel: false,
  helpOpen: false,

  toasts: [],
};

type Action =
  | { type: "CATALOG_LOADED"; payload: CatalogData }
  | { type: "CATALOG_ERROR"; payload: string }
  | { type: "HYDRATE_SETTINGS"; payload: Partial<AppState> }
  | { type: "SET_SOURCE_IMAGE"; payload: SourceImageInfo | null }
  | { type: "SET_IMAGE_ERROR"; payload: string | null }
  | { type: "SET_MODE"; payload: GenerationMode }
  | { type: "SET_REPEATS"; payload: number }
  | { type: "SET_COUNT"; payload: number }
  | { type: "SET_K_RANGE"; payload: [number, number] }
  | { type: "SET_SEED_INPUT"; payload: string }
  | { type: "SET_MAX_SIDE_ENABLED"; payload: boolean }
  | { type: "SET_MAX_SIDE"; payload: number }
  | { type: "SET_FORMAT"; payload: OutputFormat }
  | { type: "SET_QUALITY"; payload: number }
  | { type: "TOGGLE_EFFECT"; payload: string }
  | { type: "SET_SELECTED_EFFECTS"; payload: { ids: string[]; presetId?: string | null } }
  | { type: "SET_EFFECT_PARAM"; payload: { effectId: string; paramName: string; value: unknown } }
  | { type: "RESET_EFFECT_PARAMS"; payload: { effectId: string; defaults: Record<string, unknown> } }
  | { type: "MOVE_CHAIN_ITEM"; payload: { index: number; direction: -1 | 1 } }
  | { type: "REMOVE_CHAIN_ITEM"; payload: string }
  | { type: "SET_ACTIVE_TAB"; payload: PickerTab }
  | { type: "SET_AUGRAPHY_SUBTAB"; payload: AugraphySubTab }
  | { type: "SET_ALBUMENTATIONS_SUBTAB"; payload: AlbumentationsSubTab }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "JOB_INIT"; payload: { total: number } }
  | {
      type: "JOB_STARTED";
      payload: {
        jobId: string;
        seed: number;
        total: number;
        original: { url: string; thumbUrl: string; w: number; h: number; path: string };
      };
    }
  | { type: "JOB_PROGRESS"; payload: { done: number; total: number; etaMs: number; elapsedMs: number } }
  | { type: "JOB_RESULT"; payload: GeneratedResultItem }
  | { type: "JOB_ERROR"; payload: JobFailureItem }
  | { type: "JOB_DONE"; payload: { manifest?: JobManifest | null; seed?: number } }
  | { type: "TOGGLE_RESULT_SELECT"; payload: string }
  | { type: "SELECT_ALL_RESULTS"; payload: string[] }
  | { type: "CLEAR_RESULT_SELECTION" }
  | { type: "DELETE_RESULTS"; payload: string[] }
  | { type: "CLEAR_ALL_RESULTS" }
  | { type: "SET_GALLERY_LIB_FILTER"; payload: GalleryLibFilter }
  | { type: "SET_GALLERY_SEARCH"; payload: string }
  | { type: "SET_LIGHTBOX_RESULT"; payload: string | null }
  | { type: "SET_SHOW_FAILED_PANEL"; payload: boolean }
  | { type: "SET_HELP_OPEN"; payload: boolean }
  | { type: "ADD_TOAST"; payload: ToastItem }
  | { type: "DISMISS_TOAST"; payload: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "CATALOG_LOADED": {
      const okEffects = action.payload.effects.filter((e) => e.status === "ok");
      // Default selection if empty: pick 4 representative effects so the user can also click "Tạo ảnh" immediately
      let selectedIds = state.selectedIds.filter((id) => okEffects.some((e) => e.id === id));
      if (selectedIds.length === 0 && okEffects.length > 0) {
        const preferred = ["augraphy.InkBleed", "augraphy.BadPhotoCopy", "augraphy.LightingGradient", "albumentations.GaussNoise"];
        selectedIds = preferred.filter((id) => okEffects.some((e) => e.id === id));
        if (selectedIds.length === 0) {
          selectedIds = okEffects.slice(0, 4).map((e) => e.id);
        }
      }
      return {
        ...state,
        catalog: action.payload,
        catalogLoading: false,
        catalogError: null,
        selectedIds,
      };
    }
    case "CATALOG_ERROR":
      return { ...state, catalogLoading: false, catalogError: action.payload };
    case "HYDRATE_SETTINGS":
      return { ...state, ...action.payload };
    case "SET_SOURCE_IMAGE":
      return { ...state, sourceImage: action.payload, imageError: null };
    case "SET_IMAGE_ERROR":
      return { ...state, imageError: action.payload };
    case "SET_MODE":
      return { ...state, mode: action.payload, activePresetId: null };
    case "SET_REPEATS":
      return { ...state, repeats: Math.max(1, Math.min(50, action.payload)) };
    case "SET_COUNT":
      return { ...state, count: Math.max(1, Math.min(200, action.payload)) };
    case "SET_K_RANGE": {
      const [a, b] = action.payload;
      const min = Math.max(1, Math.min(20, a));
      const max = Math.max(min, Math.min(20, b));
      return { ...state, kRange: [min, max] };
    }
    case "SET_SEED_INPUT":
      return { ...state, seedInput: action.payload };
    case "SET_MAX_SIDE_ENABLED":
      return { ...state, maxSideEnabled: action.payload };
    case "SET_MAX_SIDE":
      return { ...state, maxSide: Math.max(256, Math.min(8192, action.payload)) };
    case "SET_FORMAT":
      return { ...state, format: action.payload };
    case "SET_QUALITY":
      return { ...state, quality: Math.max(1, Math.min(100, action.payload)) };
    case "TOGGLE_EFFECT": {
      const id = action.payload;
      const exists = state.selectedIds.includes(id);
      const nextIds = exists ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id];
      return { ...state, selectedIds: nextIds, activePresetId: null };
    }
    case "SET_SELECTED_EFFECTS":
      return {
        ...state,
        selectedIds: action.payload.ids,
        activePresetId: action.payload.presetId !== undefined ? action.payload.presetId : null,
      };
    case "SET_EFFECT_PARAM": {
      const { effectId, paramName, value } = action.payload;
      const prev = state.effectParams[effectId] || {};
      return {
        ...state,
        effectParams: {
          ...state.effectParams,
          [effectId]: { ...prev, [paramName]: value },
        },
      };
    }
    case "RESET_EFFECT_PARAMS": {
      const { effectId } = action.payload;
      const next = { ...state.effectParams };
      delete next[effectId];
      return { ...state, effectParams: next };
    }
    case "MOVE_CHAIN_ITEM": {
      const { index, direction } = action.payload;
      const target = index + direction;
      if (index < 0 || index >= state.selectedIds.length || target < 0 || target >= state.selectedIds.length) {
        return state;
      }
      const copy = [...state.selectedIds];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return { ...state, selectedIds: copy, activePresetId: null };
    }
    case "REMOVE_CHAIN_ITEM":
      return {
        ...state,
        selectedIds: state.selectedIds.filter((id) => id !== action.payload),
        activePresetId: null,
      };
    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload };
    case "SET_AUGRAPHY_SUBTAB":
      return { ...state, augraphySubTab: action.payload };
    case "SET_ALBUMENTATIONS_SUBTAB":
      return { ...state, albumentationsSubTab: action.payload };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };
    case "JOB_INIT":
      return {
        ...state,
        isGenerating: true,
        jobId: null,
        progress: { done: 0, total: action.payload.total, etaMs: 0, elapsedMs: 0 },
        results: [],
        selectedResultIds: [],
        failures: [],
        manifest: null,
        showFailedPanel: false,
      };
    case "JOB_STARTED":
      return {
        ...state,
        isGenerating: true,
        jobId: action.payload.jobId,
        lastUsedSeed: action.payload.seed,
        progress: { done: 0, total: action.payload.total, etaMs: 0, elapsedMs: 0 },
        originalResult: action.payload.original,
      };
    case "JOB_PROGRESS":
      return {
        ...state,
        progress: action.payload,
      };
    case "JOB_RESULT":
      return {
        ...state,
        results: [...state.results, action.payload],
      };
    case "JOB_ERROR":
      return {
        ...state,
        failures: [...state.failures, action.payload],
      };
    case "JOB_DONE":
      return {
        ...state,
        isGenerating: false,
        manifest: action.payload.manifest ?? state.manifest,
        lastUsedSeed: action.payload.seed ?? state.lastUsedSeed,
      };
    case "TOGGLE_RESULT_SELECT": {
      const id = action.payload;
      const has = state.selectedResultIds.includes(id);
      return {
        ...state,
        selectedResultIds: has
          ? state.selectedResultIds.filter((x) => x !== id)
          : [...state.selectedResultIds, id],
      };
    }
    case "SELECT_ALL_RESULTS":
      return { ...state, selectedResultIds: action.payload };
    case "CLEAR_RESULT_SELECTION":
      return { ...state, selectedResultIds: [] };
    case "DELETE_RESULTS": {
      const toRemove = new Set(action.payload);
      const nextLightbox =
        state.lightboxResultId && toRemove.has(state.lightboxResultId) ? null : state.lightboxResultId;
      return {
        ...state,
        results: state.results.filter((r) => !toRemove.has(r.id)),
        selectedResultIds: state.selectedResultIds.filter((id) => !toRemove.has(id)),
        lightboxResultId: nextLightbox,
      };
    }
    case "CLEAR_ALL_RESULTS":
      return {
        ...state,
        results: [],
        selectedResultIds: [],
        failures: [],
        manifest: null,
        lightboxResultId: null,
      };
    case "SET_GALLERY_LIB_FILTER":
      return { ...state, galleryLibFilter: action.payload };
    case "SET_GALLERY_SEARCH":
      return { ...state, gallerySearch: action.payload };
    case "SET_LIGHTBOX_RESULT":
      return { ...state, lightboxResultId: action.payload };
    case "SET_SHOW_FAILED_PANEL":
      return { ...state, showFailedPanel: action.payload };
    case "SET_HELP_OPEN":
      return { ...state, helpOpen: action.payload };
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [...state.toasts.slice(-2), action.payload],
      };
    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  catalogMap: Map<string, CatalogEffect>;
  okEffects: CatalogEffect[];
  addToast: (message: string, kind?: ToastItem["kind"]) => void;
  dismissToast: (id: string) => void;
  applyPreset: (preset: PresetDefinition) => void;
  getEffectiveParams: (effect: CatalogEffect) => Record<string, unknown>;
  setSourceFile: (file: File | null) => Promise<void>;
  startGeneration: (overrideAllOk?: boolean) => Promise<void>;
  cancelGeneration: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevPreviewUrlRef = useRef<string | null>(null);

  const catalogMap = useMemo(() => indexCatalogEffects(state.catalog), [state.catalog]);
  const okEffects = useMemo(
    () => (state.catalog ? state.catalog.effects.filter((e) => e.status === "ok") : []),
    [state.catalog]
  );

  const addToast = useCallback((message: string, kind: ToastItem["kind"] = "info") => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    dispatch({ type: "ADD_TOAST", payload: { id, kind, message } });
    if (kind !== "error") {
      setTimeout(() => {
        dispatch({ type: "DISMISS_TOAST", payload: id });
      }, 4000);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: "DISMISS_TOAST", payload: id });
  }, []);

  // Hydrate persisted settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AppState>;
      const patch: Partial<AppState> = {};
      if (parsed.mode === "each" || parsed.mode === "mix" || parsed.mode === "chain") patch.mode = parsed.mode;
      if (typeof parsed.repeats === "number") patch.repeats = parsed.repeats;
      if (typeof parsed.count === "number") patch.count = parsed.count;
      if (Array.isArray(parsed.kRange) && parsed.kRange.length === 2) patch.kRange = parsed.kRange;
      if (typeof parsed.maxSideEnabled === "boolean") patch.maxSideEnabled = parsed.maxSideEnabled;
      if (typeof parsed.maxSide === "number") patch.maxSide = parsed.maxSide;
      if (parsed.format === "png" || parsed.format === "jpg" || parsed.format === "webp") patch.format = parsed.format;
      if (typeof parsed.quality === "number") patch.quality = parsed.quality;
      dispatch({ type: "HYDRATE_SETTINGS", payload: patch });
    } catch {
      // ignore
    }
  }, []);

  // Save settings on change
  useEffect(() => {
    try {
      const toSave = {
        mode: state.mode,
        repeats: state.repeats,
        count: state.count,
        kRange: state.kRange,
        maxSideEnabled: state.maxSideEnabled,
        maxSide: state.maxSide,
        format: state.format,
        quality: state.quality,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignore
    }
  }, [
    state.mode,
    state.repeats,
    state.count,
    state.kRange,
    state.maxSideEnabled,
    state.maxSide,
    state.format,
    state.quality,
  ]);

  // Load catalog on mount
  useEffect(() => {
    let active = true;
    fetch("/api/catalog", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Lỗi HTTP ${res.status}`);
        }
        return res.json() as Promise<CatalogData>;
      })
      .then((data) => {
        if (!active) return;
        dispatch({ type: "CATALOG_LOADED", payload: data });
      })
      .catch((err) => {
        if (!active) return;
        dispatch({
          type: "CATALOG_ERROR",
          payload: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      active = false;
    };
  }, []);

  // Cleanup preview object URL on unmount
  useEffect(() => {
    return () => {
      if (prevPreviewUrlRef.current) {
        URL.revokeObjectURL(prevPreviewUrlRef.current);
      }
    };
  }, []);

  const setSourceFile = useCallback(
    async (rawFile: File | null) => {
      if (!rawFile) {
        if (prevPreviewUrlRef.current) {
          URL.revokeObjectURL(prevPreviewUrlRef.current);
          prevPreviewUrlRef.current = null;
        }
        dispatch({ type: "SET_SOURCE_IMAGE", payload: null });
        return;
      }

      if (rawFile.size === 0) {
        const msg = "Tệp ảnh rỗng hoặc không hợp lệ.";
        dispatch({ type: "SET_IMAGE_ERROR", payload: msg });
        addToast(msg, "error");
        return;
      }

      if (rawFile.size > 25 * 1024 * 1024) {
        const msg = "Ảnh quá lớn (tối đa 25 MB).";
        dispatch({ type: "SET_IMAGE_ERROR", payload: msg });
        addToast(msg, "error");
        return;
      }

      // Inspect magic bytes (first 16 bytes) so pasted/dropped files without extension or MIME work
      let magicExt: "png" | "jpg" | "webp" | "bmp" | "tiff" | null = null;
      let magicMime = "";
      try {
        const headBuf = new Uint8Array(await rawFile.slice(0, 16).arrayBuffer());
        if (
          headBuf.length >= 8 &&
          headBuf[0] === 0x89 &&
          headBuf[1] === 0x50 &&
          headBuf[2] === 0x4e &&
          headBuf[3] === 0x47
        ) {
          magicExt = "png";
          magicMime = "image/png";
        } else if (headBuf.length >= 3 && headBuf[0] === 0xff && headBuf[1] === 0xd8 && headBuf[2] === 0xff) {
          magicExt = "jpg";
          magicMime = "image/jpeg";
        } else if (
          headBuf.length >= 12 &&
          headBuf[0] === 0x52 &&
          headBuf[1] === 0x49 &&
          headBuf[2] === 0x46 &&
          headBuf[3] === 0x46 &&
          headBuf[8] === 0x57 &&
          headBuf[9] === 0x45 &&
          headBuf[10] === 0x42 &&
          headBuf[11] === 0x50
        ) {
          magicExt = "webp";
          magicMime = "image/webp";
        } else if (headBuf.length >= 2 && headBuf[0] === 0x42 && headBuf[1] === 0x4d) {
          magicExt = "bmp";
          magicMime = "image/bmp";
        } else if (
          headBuf.length >= 4 &&
          ((headBuf[0] === 0x49 && headBuf[1] === 0x49 && headBuf[2] === 0x2a && headBuf[3] === 0x00) ||
            (headBuf[0] === 0x4d && headBuf[1] === 0x4d && headBuf[2] === 0x00 && headBuf[3] === 0x2a))
        ) {
          magicExt = "tiff";
          magicMime = "image/tiff";
        }
      } catch {
        // ignore slice errors
      }

      const extMatch = /\.(png|jpe?g|jfif|webp|bmp|tiff?)$/i.test(rawFile.name || "");
      const mimeMatch = /^image\/(png|jpeg|jpg|pjpeg|webp|bmp|x-ms-bmp|tiff)$/i.test(rawFile.type || "");
      const isOtherBrowserImage = /^image\//i.test(rawFile.type || "") && !mimeMatch && !magicExt;

      if (!magicExt && !extMatch && !mimeMatch && !isOtherBrowserImage) {
        const msg = "Định dạng không hỗ trợ. Dùng PNG, JPG, WEBP, BMP, TIFF.";
        dispatch({ type: "SET_IMAGE_ERROR", payload: msg });
        addToast(msg, "error");
        return;
      }

      let file = rawFile;
      if (magicExt && (!rawFile.type || !extMatch)) {
        const baseName = (rawFile.name || "clipboard").replace(/\.[^.]+$/, "") || "clipboard";
        const normalizedName = extMatch ? rawFile.name : `${baseName}.${magicExt}`;
        file = new File([rawFile], normalizedName, { type: magicMime });
      }

      let objectUrl = URL.createObjectURL(file);
      let width = 0;
      let height = 0;
      try {
        const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = objectUrl;
        });

        if (loadedImg) {
          width = loadedImg.naturalWidth || 0;
          height = loadedImg.naturalHeight || 0;

          // If the pasted/dropped image was another browser image format (e.g. AVIF/GIF/SVG)
          // or lacked valid server magic bytes, transcode it to PNG on the client so the Python worker accepts it.
          if (!magicExt && width > 0 && height > 0) {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(loadedImg, 0, 0);
              const pngBlob = await new Promise<Blob | null>((resBlob) =>
                canvas.toBlob((b) => resBlob(b), "image/png")
              );
              if (pngBlob) {
                URL.revokeObjectURL(objectUrl);
                const baseName = (file.name || "clipboard").replace(/\.[^.]+$/, "") || "clipboard";
                file = new File([pngBlob], `${baseName}.png`, { type: "image/png" });
                objectUrl = URL.createObjectURL(file);
                magicExt = "png";
              }
            }
          }
        } else if (isOtherBrowserImage) {
          URL.revokeObjectURL(objectUrl);
          const msg = "Định dạng không hỗ trợ. Dùng PNG, JPG, WEBP, BMP, TIFF.";
          dispatch({ type: "SET_IMAGE_ERROR", payload: msg });
          addToast(msg, "error");
          return;
        }
      } catch {
        // TIFF may not decode in all browsers via <img>; server still decodes via OpenCV/Pillow
      }

      if (prevPreviewUrlRef.current) {
        URL.revokeObjectURL(prevPreviewUrlRef.current);
      }
      prevPreviewUrlRef.current = objectUrl;

      const resolvedType = (
        magicExt ||
        file.type ||
        file.name.split(".").pop() ||
        "image"
      )
        .toUpperCase()
        .replace("IMAGE/", "");

      dispatch({
        type: "SET_SOURCE_IMAGE",
        payload: {
          file,
          previewUrl: objectUrl,
          name: file.name || "clipboard.png",
          size: file.size,
          width,
          height,
          type: resolvedType,
        },
      });
    },
    [addToast]
  );

  const applyPreset = useCallback(
    (preset: PresetDefinition) => {
      if (!state.catalog) return;
      const resolved = resolvePresetEffects(preset, state.catalog.effects);
      dispatch({ type: "SET_MODE", payload: preset.mode });
      dispatch({ type: "SET_REPEATS", payload: preset.repeats });
      dispatch({ type: "SET_COUNT", payload: preset.count });
      dispatch({ type: "SET_K_RANGE", payload: preset.kRange });
      dispatch({
        type: "SET_SELECTED_EFFECTS",
        payload: { ids: resolved.map((e) => e.id), presetId: preset.id },
      });
      addToast(`Đã áp dụng mẫu "${preset.title}" (${resolved.length} hiệu ứng).`, "info");
    },
    [state.catalog, addToast]
  );

  const getEffectiveParams = useCallback(
    (effect: CatalogEffect): Record<string, unknown> => {
      const defaults = buildEffectDefaults(effect);
      const overrides = state.effectParams[effect.id] || {};
      return { ...defaults, ...overrides };
    },
    [state.effectParams]
  );

  const cancelGeneration = useCallback(async () => {
    const activeJobId = state.jobId;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (activeJobId) {
      try {
        await fetch("/api/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: activeJobId }),
        });
      } catch {
        // ignore
      }
    }
    dispatch({ type: "JOB_DONE", payload: {} });
    addToast("Đã huỷ quá trình tạo ảnh. Các ảnh đã xong vẫn được giữ lại.", "info");
  }, [state.jobId, addToast]);

  const startGeneration = useCallback(
    async (overrideAllOk = false) => {
      if (!state.sourceImage) {
        addToast("Chưa có ảnh đầu vào. Hãy kéo thả hoặc dán một ảnh trước.", "error");
        return;
      }
      if (!state.catalog) {
        addToast("Danh mục hiệu ứng chưa sẵn sàng.", "error");
        return;
      }

      const targetIds = overrideAllOk ? okEffects.map((e) => e.id) : state.selectedIds;
      const validIds = targetIds.filter((id) => {
        const eff = catalogMap.get(id);
        return eff && eff.status === "ok";
      });

      if (validIds.length === 0) {
        addToast("Chưa chọn hiệu ứng hợp lệ nào để tạo ảnh.", "error");
        return;
      }

      const effectiveMode: GenerationMode = overrideAllOk ? "each" : state.mode;
      const effectiveRepeats = overrideAllOk ? 1 : state.repeats;

      if (overrideAllOk) {
        dispatch({ type: "SET_MODE", payload: "each" });
        dispatch({ type: "SET_REPEATS", payload: 1 });
        dispatch({ type: "SET_SELECTED_EFFECTS", payload: { ids: validIds, presetId: null } });
      }

      const totalPlanned =
        effectiveMode === "each"
          ? validIds.length * effectiveRepeats
          : effectiveMode === "mix"
            ? state.count
            : effectiveRepeats;

      dispatch({ type: "JOB_INIT", payload: { total: totalPlanned } });

      const parsedSeed =
        state.seedInput.trim() !== "" && Number.isFinite(Number(state.seedInput.trim()))
          ? Math.abs(Math.floor(Number(state.seedInput.trim())))
          : null;

      const jobPayload = {
        mode: effectiveMode,
        effects: validIds.map((id) => ({
          id,
          params: state.effectParams[id] || {},
        })),
        repeats: effectiveRepeats,
        count: state.count,
        kRange: state.kRange,
        seed: parsedSeed,
        maxSide: state.maxSideEnabled ? state.maxSide : null,
        format: state.format,
        quality: state.quality,
        sourceName: state.sourceImage.name,
      };

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const capabilitiesResponse = await fetch("/api/blob-upload", { signal: controller.signal });
        const capabilities = (await capabilitiesResponse.json().catch(() => ({}))) as {
          required?: boolean;
          enabled?: boolean;
        };

        let res: Response;
        if (capabilities.required) {
          if (!capabilities.enabled) {
            throw new Error("Vercel Blob chưa được kết nối. Hãy tạo Blob store riêng tư trong Storage của project.");
          }
          const blob = await uploadBlob(
            `uploads/${crypto.randomUUID()}/${state.sourceImage.name}`,
            state.sourceImage.file,
            {
              access: "private",
              handleUploadUrl: "/api/blob-upload",
              multipart: true,
              contentType: state.sourceImage.type || "application/octet-stream",
              abortSignal: controller.signal,
            }
          );
          res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imagePath: blob.pathname, imageName: state.sourceImage.name, job: jobPayload }),
            signal: controller.signal,
          });
        } else {
          const formData = new FormData();
          formData.append("image", state.sourceImage.file, state.sourceImage.name);
          formData.append("job", JSON.stringify(jobPayload));
          res = await fetch("/api/generate", { method: "POST", body: formData, signal: controller.signal });
        }

        if (!res.ok || !res.body) {
          const errJson = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errJson.error || `Lỗi máy chủ (${res.status}).`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let activeJobId = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl = buffer.indexOf("\n");
          while (nl !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) {
              try {
                const ev = JSON.parse(line);
                if (ev.type === "start") {
                  activeJobId = ev.jobId;
                  dispatch({
                    type: "JOB_STARTED",
                    payload: {
                      jobId: ev.jobId,
                      seed: ev.seed,
                      total: ev.total,
                      original: ev.original,
                    },
                  });
                } else if (ev.type === "progress") {
                  dispatch({
                    type: "JOB_PROGRESS",
                    payload: {
                      done: ev.done,
                      total: ev.total,
                      etaMs: ev.etaMs,
                      elapsedMs: ev.elapsedMs,
                    },
                  });
                } else if (ev.type === "result") {
                  dispatch({
                    type: "JOB_RESULT",
                    payload: {
                      id: ev.id,
                      jobId: activeJobId,
                      effects: ev.effects,
                      label: ev.label,
                      url: ev.url,
                      thumbUrl: ev.thumbUrl,
                      ms: ev.ms,
                      w: ev.w,
                      h: ev.h,
                      changed: ev.changed,
                      path: ev.path,
                      seed: ev.seed,
                    },
                  });
                } else if (ev.type === "error") {
                  dispatch({
                    type: "JOB_ERROR",
                    payload: {
                      id: ev.id,
                      effect: ev.effect,
                      message: ev.message,
                    },
                  });
                } else if (ev.type === "done") {
                  dispatch({
                    type: "JOB_DONE",
                    payload: {
                      manifest: ev.manifest,
                      seed: ev.seed,
                    },
                  });
                  if (!ev.cancelled) {
                    const failText = ev.failed > 0 ? ` · ${ev.failed} lỗi` : "";
                    addToast(`Xong ${ev.ok} ảnh${failText}`, ev.failed > 0 && ev.ok === 0 ? "error" : "success");
                  }
                }
              } catch {
                // ignore malformed line
              }
            }
            nl = buffer.indexOf("\n");
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          dispatch({ type: "JOB_DONE", payload: {} });
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        dispatch({ type: "JOB_ERROR", payload: { message: msg } });
        dispatch({ type: "JOB_DONE", payload: {} });
        addToast(msg, "error");
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [
      state.sourceImage,
      state.catalog,
      state.selectedIds,
      state.mode,
      state.repeats,
      state.count,
      state.kRange,
      state.seedInput,
      state.effectParams,
      state.maxSideEnabled,
      state.maxSide,
      state.format,
      state.quality,
      okEffects,
      catalogMap,
      addToast,
    ]
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      dispatch,
      catalogMap,
      okEffects,
      addToast,
      dismissToast,
      applyPreset,
      getEffectiveParams,
      setSourceFile,
      startGeneration,
      cancelGeneration,
    }),
    [
      state,
      catalogMap,
      okEffects,
      addToast,
      dismissToast,
      applyPreset,
      getEffectiveParams,
      setSourceFile,
      startGeneration,
      cancelGeneration,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }
  return ctx;
}

