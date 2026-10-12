"use client";

import { ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { downloadSingleResult } from "@/lib/download";
import { formatEffectLabelVi } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { BeforeAfter } from "./BeforeAfter";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

export function Lightbox() {
  const { state, dispatch, addToast } = useAppStore();

  const currentIndex = useMemo(() => {
    if (!state.lightboxResultId) return -1;
    return state.results.findIndex((r) => r.id === state.lightboxResultId);
  }, [state.lightboxResultId, state.results]);

  const currentItem = currentIndex >= 0 ? state.results[currentIndex] : null;

  useEffect(() => {
    if (!currentItem) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl?.getAttribute("role") === "slider") {
        return; // Let the BeforeAfter slider handle ←/→ when focused
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIdx = (currentIndex - 1 + state.results.length) % state.results.length;
        const prev = state.results[prevIdx];
        if (prev) dispatch({ type: "SET_LIGHTBOX_RESULT", payload: prev.id });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIdx = (currentIndex + 1) % state.results.length;
        const next = state.results[nextIdx];
        if (next) dispatch({ type: "SET_LIGHTBOX_RESULT", payload: next.id });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentItem, currentIndex, state.results, dispatch]);

  if (!currentItem) return null;

  const beforeUrl =
    state.originalResult?.url || state.sourceImage?.previewUrl || currentItem.url;
  const labelVi = formatEffectLabelVi(currentItem.label);

  const goPrev = () => {
    const prevIdx = (currentIndex - 1 + state.results.length) % state.results.length;
    const prev = state.results[prevIdx];
    if (prev) dispatch({ type: "SET_LIGHTBOX_RESULT", payload: prev.id });
  };

  const goNext = () => {
    const nextIdx = (currentIndex + 1) % state.results.length;
    const next = state.results[nextIdx];
    if (next) dispatch({ type: "SET_LIGHTBOX_RESULT", payload: next.id });
  };

  return (
    <Modal
      open={Boolean(currentItem)}
      onClose={() => dispatch({ type: "SET_LIGHTBOX_RESULT", payload: null })}
      title={`${labelVi} (${currentIndex + 1}/${state.results.length})`}
      maxWidthClass="max-w-5xl"
    >
      <div className="flex flex-col gap-3">
        <BeforeAfter beforeUrl={beforeUrl} afterUrl={currentItem.url} alt={labelVi} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="accent" className="font-mono">
              {currentItem.path}
            </Badge>
            <Badge variant="neutral" className="num">
              {currentItem.w} × {currentItem.h} px
            </Badge>
            <Badge variant="neutral" className="num">
              {currentItem.ms} ms
            </Badge>
            {typeof currentItem.seed === "number" && (
              <Badge variant="neutral" className="font-mono num">
                Seed: {currentItem.seed}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                disabled={state.results.length <= 1}
                onClick={goPrev}
                title="Ảnh trước (←)"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                <span>Trước</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={state.results.length <= 1}
                onClick={goNext}
                title="Ảnh tiếp theo (→)"
              >
                <span>Tiếp</span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  try {
                    await downloadSingleResult(currentItem);
                  } catch (err) {
                    addToast(err instanceof Error ? err.message : String(err), "error");
                  }
                }}
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tải ảnh này</span>
              </Button>

              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  dispatch({ type: "DELETE_RESULTS", payload: [currentItem.id] });
                }}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Xoá</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
