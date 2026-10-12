import JSZip from "jszip";
import { sanitizeFileSegment } from "./jobPlan";
import type { GeneratedResultItem, JobFailureItem, JobManifest } from "./types";

interface FileSystemWritableFileStreamLike {
  write(data: Blob | BufferSource | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

interface FileSystemDirectoryHandleLike {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
    }) => Promise<FileSystemDirectoryHandleLike>;
  }
}

export function getAugmentedFolderName(sourceName?: string): string {
  const base = (sourceName || "document").replace(/\.[^.]+$/, "");
  const clean = sanitizeFileSegment(base) || "document";
  return `${clean}_augmented`;
}

function ensureUniquePath(rawPath: string, used: Set<string>): string {
  const normalized = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!used.has(normalized)) {
    used.add(normalized);
    return normalized;
  }
  const dotIdx = normalized.lastIndexOf(".");
  const stem = dotIdx !== -1 ? normalized.slice(0, dotIdx) : normalized;
  const ext = dotIdx !== -1 ? normalized.slice(dotIdx) : "";
  let counter = 2;
  while (used.has(`${stem}_${counter}${ext}`)) {
    counter++;
  }
  const unique = `${stem}_${counter}${ext}`;
  used.add(unique);
  return unique;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function getEffectFileName(item: GeneratedResultItem): string {
  const rawBase = item.path.replace(/\\/g, "/").split("/").pop() || "";
  const dotIdx = rawBase.lastIndexOf(".");
  const ext = dotIdx !== -1 ? rawBase.slice(dotIdx + 1).toLowerCase() : "png";

  const effectNames =
    item.effects && item.effects.length > 0
      ? item.effects
          .map((id) => {
            const idx = id.lastIndexOf(".");
            return idx !== -1 ? id.slice(idx + 1) : id;
          })
          .join("+")
      : item.label.replace(/\s+#\d+$/, "");

  const repeatMatch = item.label.match(/#(\d+)$/);
  const stem = sanitizeFileSegment(effectNames || item.label || "result");
  const withRepeat = repeatMatch ? `${stem}_${repeatMatch[1].padStart(2, "0")}` : stem;
  return `${withRepeat}.${ext || "png"}`;
}

export async function downloadSingleResult(item: GeneratedResultItem): Promise<void> {
  const res = await fetch(item.url);
  if (!res.ok) {
    throw new Error("Không thể tải ảnh kết quả từ máy chủ.");
  }
  const blob = await res.blob();
  const fileName = getEffectFileName(item);
  triggerBlobDownload(blob, fileName);
}

export interface BatchExportOptions {
  items: GeneratedResultItem[];
  originalResult?: { url: string; path: string; w: number; h: number } | null;
  manifest?: JobManifest | null;
  failures?: JobFailureItem[];
  sourceName?: string;
  onProgress?: (done: number, total: number) => void;
}

export async function downloadAsZip(opts: BatchExportOptions): Promise<void> {
  if (opts.items.length === 0) {
    throw new Error("Không có ảnh nào để tải về.");
  }

  const zip = new JSZip();
  const folderName = getAugmentedFolderName(opts.sourceName);
  const root = zip.folder(folderName)!;
  const usedPaths = new Set<string>();

  const totalSteps = opts.items.length;
  let doneSteps = 0;

  for (const item of opts.items) {
    const res = await fetch(item.url);
    if (!res.ok) {
      throw new Error(`Không thể tải tệp kết quả: ${item.label}`);
    }
    const blob = await res.blob();
    const flatName = ensureUniquePath(getEffectFileName(item), usedPaths);
    root.file(flatName, blob);
    doneSteps++;
    opts.onProgress?.(doneSteps, totalSteps);
  }

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  triggerBlobDownload(zipBlob, `${folderName}.zip`);
}

async function writeFlatFile(
  dirHandle: FileSystemDirectoryHandleLike,
  fileName: string,
  data: Blob | string
): Promise<void> {
  const cleanName = fileName.replace(/[\\/]+/g, "_");
  const fileHandle = await dirHandle.getFileHandle(cleanName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function saveToFolderOrFallback(
  opts: BatchExportOptions & {
    onFallbackNotice?: () => void;
  }
): Promise<"folder" | "zip"> {
  if (!supportsDirectoryPicker()) {
    opts.onFallbackNotice?.();
    await downloadAsZip(opts);
    return "zip";
  }

  const parentDir = await window.showDirectoryPicker!({ mode: "readwrite" });
  const folderName = getAugmentedFolderName(opts.sourceName);
  const targetRoot = await parentDir.getDirectoryHandle(folderName, { create: true });

  const usedPaths = new Set<string>();
  const totalSteps = opts.items.length;
  let doneSteps = 0;

  for (const item of opts.items) {
    const res = await fetch(item.url);
    if (!res.ok) {
      throw new Error(`Không thể tải tệp kết quả: ${item.label}`);
    }
    const blob = await res.blob();
    const flatName = ensureUniquePath(getEffectFileName(item), usedPaths);
    await writeFlatFile(targetRoot, flatName, blob);
    doneSteps++;
    opts.onProgress?.(doneSteps, totalSteps);
  }

  return "folder";
}
