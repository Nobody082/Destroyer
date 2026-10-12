"use client";

import { Archive, FolderDown, Play, Square, Zap } from "lucide-react";
import React, { useState } from "react";
import { downloadAsZip, saveToFolderOrFallback } from "@/lib/download";
import { useAppStore } from "@/lib/store";
import { Button } from "./ui/Button";
import { ProgressBar } from "./ui/ProgressBar";

export function ActionBar() {
  const { state, okEffects, startGeneration, cancelGeneration, addToast } = useAppStore();
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  const targetExportItems =
    state.selectedResultIds.length > 0
      ? state.results.filter((r) => state.selectedResultIds.includes(r.id))
      : state.results;

  const canGenerate =
    Boolean(state.sourceImage) && state.selectedIds.length > 0 && !state.isGenerating;
  const canGenerateAll =
    Boolean(state.sourceImage) && okEffects.length > 0 && !state.isGenerating;
  const canDownload = targetExportItems.length > 0 && !state.isGenerating && !exportProgress;

  const handleDownloadZip = async () => {
    if (!canDownload) return;
    try {
      setExportProgress({ done: 0, total: targetExportItems.length });
      await downloadAsZip({
        items: targetExportItems,
        originalResult: state.originalResult,
        manifest: state.manifest,
        failures: state.failures,
        sourceName: state.sourceImage?.name,
        onProgress: (done, total) => setExportProgress({ done, total }),
      });
      addToast(`Đã đóng gói và tải xuống ${targetExportItems.length} ảnh (ZIP).`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setExportProgress(null);
    }
  };

  const handleSaveToFolder = async () => {
    if (!canDownload) return;
    try {
      setExportProgress({ done: 0, total: targetExportItems.length });
      const mode = await saveToFolderOrFallback({
        items: targetExportItems,
        originalResult: state.originalResult,
        manifest: state.manifest,
        failures: state.failures,
        sourceName: state.sourceImage?.name,
        onProgress: (done, total) => setExportProgress({ done, total }),
        onFallbackNotice: () => {
          addToast(
            "Trình duyệt không hỗ trợ ghi trực tiếp vào thư mục. Đang chuyển sang tải tệp ZIP.",
            "info"
          );
        },
      });
      if (mode === "folder") {
        addToast(`Đã lưu ${targetExportItems.length} ảnh kết quả vào thư mục.`, "success");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled directory picker dialog
      } else {
        addToast(err instanceof Error ? err.message : String(err), "error");
      }
    } finally {
      setExportProgress(null);
    }
  };

  return (
    <div
      role="region"
      aria-label="Thanh tác vụ chính"
      className="fixed bottom-0 left-0 right-0 md:sticky md:bottom-0 h-[64px] px-4 bg-surface-1 border-t border-border z-sticky flex items-center justify-between gap-3"
    >
      {/* Left: Generate / Cancel */}
      <div className="flex items-center gap-2 shrink-0">
        {!state.isGenerating ? (
          <>
            <Button
              variant="primary"
              size="md"
              disabled={!canGenerate}
              onClick={() => void startGeneration(false)}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              <span>Tạo ảnh</span>
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={!canGenerateAll}
              onClick={() => void startGeneration(true)}
              className="hidden sm:inline-flex"
            >
              <Zap className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Tạo tất cả</span>
            </Button>
          </>
        ) : (
          <Button variant="danger" size="md" onClick={() => void cancelGeneration()}>
            <Square className="w-4 h-4" aria-hidden="true" />
            <span>Huỷ</span>
          </Button>
        )}
      </div>

      {/* Center: Progress bar or Status summary */}
      <div className="flex-1 max-w-md hidden sm:flex items-center justify-center min-w-0">
        {state.isGenerating ? (
          <ProgressBar
            done={state.progress.done}
            total={state.progress.total}
            etaMs={state.progress.etaMs}
            elapsedMs={state.progress.elapsedMs}
          />
        ) : exportProgress ? (
          <ProgressBar
            done={exportProgress.done}
            total={exportProgress.total}
            label={`Đang đóng gói tệp… ${exportProgress.done}/${exportProgress.total}`}
          />
        ) : (
          <div className="text-xs text-muted num truncate">
            {!state.sourceImage ? (
              <span>Chưa có ảnh · Hãy kéo thả hoặc dán ảnh (Ctrl+V)</span>
            ) : state.results.length > 0 ? (
              <span>
                Xong <strong className="text-text">{state.results.length}</strong> ảnh
                {state.failures.length > 0 ? (
                  <span className="text-danger"> · {state.failures.length} lỗi</span>
                ) : null}
                {state.lastUsedSeed !== null ? (
                  <span className="text-subtle font-mono"> · Seed {state.lastUsedSeed}</span>
                ) : null}
              </span>
            ) : (
              <span>
                Sẵn sàng · Đã chọn <strong className="text-text">{state.selectedIds.length}</strong> hiệu ứng
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Download ZIP + Save to Folder */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="md"
          loading={Boolean(exportProgress)}
          disabled={!canDownload}
          onClick={() => void handleDownloadZip()}
          title={
            state.selectedResultIds.length > 0
              ? `Tải ZIP gồm ${state.selectedResultIds.length} ảnh đã chọn`
              : `Tải ZIP toàn bộ ${state.results.length} ảnh kết quả`
          }
        >
          <Archive className="w-4 h-4" aria-hidden="true" />
          <span className="num">
            Tải ZIP
            {state.selectedResultIds.length > 0
              ? ` (${state.selectedResultIds.length})`
              : state.results.length > 0
                ? ` (${state.results.length})`
                : ""}
          </span>
        </Button>

        <Button
          variant="secondary"
          size="md"
          disabled={!canDownload}
          onClick={() => void handleSaveToFolder()}
          className="hidden sm:inline-flex"
          title="Lưu trực tiếp các ảnh kết quả vào 1 thư mục trên máy"
        >
          <FolderDown className="w-4 h-4" aria-hidden="true" />
          <span>Lưu vào thư mục</span>
        </Button>
      </div>
    </div>
  );
}
