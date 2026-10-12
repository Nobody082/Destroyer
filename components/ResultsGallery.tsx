"use client";

import { CheckSquare, Images, Search, Square, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import { formatEffectLabelVi } from "@/lib/i18n";
import { type GalleryLibFilter, useAppStore } from "@/lib/store";
import { FailedPanel } from "./FailedPanel";
import { ResultTile } from "./ResultTile";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { Tabs } from "./ui/Tabs";

const PAGE_SIZE = 120;

export function ResultsGallery() {
  const { state, dispatch } = useAppStore();
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  const filteredResults = useMemo(() => {
    const q = state.gallerySearch.trim().toLowerCase();
    return state.results.filter((r) => {
      if (state.galleryLibFilter === "augraphy") {
        if (!r.effects.every((id) => id.startsWith("augraphy."))) return false;
      } else if (state.galleryLibFilter === "albumentations") {
        if (!r.effects.every((id) => id.startsWith("albumentations."))) return false;
      } else if (state.galleryLibFilter === "multi") {
        if (r.effects.length <= 1) return false;
      }
      if (q) {
        const labelVi = formatEffectLabelVi(r.label).toLowerCase();
        if (
          !labelVi.includes(q) &&
          !r.label.toLowerCase().includes(q) &&
          !r.path.toLowerCase().includes(q) &&
          !r.effects.some((id) => id.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [state.results, state.galleryLibFilter, state.gallerySearch]);

  const filterTabs: Array<{ id: GalleryLibFilter; label: string; count: number }> = useMemo(
    () => [
      { id: "all", label: "Tất cả", count: state.results.length },
      {
        id: "augraphy",
        label: "Augraphy",
        count: state.results.filter((r) => r.effects.every((id) => id.startsWith("augraphy."))).length,
      },
      {
        id: "albumentations",
        label: "Albumentations",
        count: state.results.filter((r) =>
          r.effects.every((id) => id.startsWith("albumentations."))
        ).length,
      },
      {
        id: "multi",
        label: "Phối hợp",
        count: state.results.filter((r) => r.effects.length > 1).length,
      },
    ],
    [state.results]
  );

  const displayedResults = useMemo(
    () => filteredResults.slice(0, visibleLimit),
    [filteredResults, visibleLimit]
  );

  const pendingSkeletonCount = state.isGenerating
    ? Math.min(8, Math.max(1, state.progress.total - state.progress.done))
    : 0;

  return (
    <section
      aria-label="Thư viện ảnh kết quả"
      className="bg-surface-1 border border-border rounded-lg p-4 flex flex-col gap-3 min-w-0"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-md font-semibold text-text">Kết quả</h2>
          <Badge variant="neutral" className="num">
            {state.results.length} ảnh
          </Badge>
          {state.selectedResultIds.length > 0 && (
            <Badge variant="accent" className="num">
              Đã chọn {state.selectedResultIds.length}
            </Badge>
          )}
        </div>

        {state.results.length > 0 && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                dispatch({
                  type: "SELECT_ALL_RESULTS",
                  payload: filteredResults.map((r) => r.id),
                })
              }
            >
              <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Chọn tất cả</span>
            </Button>
            {state.selectedResultIds.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dispatch({ type: "CLEAR_RESULT_SELECTION" })}
                >
                  <Square className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Bỏ chọn</span>
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    dispatch({ type: "DELETE_RESULTS", payload: state.selectedResultIds })
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="num">Xoá ({state.selectedResultIds.length})</span>
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Failures panel if any */}
      <FailedPanel />

      {state.results.length > 0 && (
        <div className="flex flex-col gap-2">
          <Tabs
            variant="segmented"
            items={filterTabs}
            value={state.galleryLibFilter}
            onChange={(val) => {
              setVisibleLimit(PAGE_SIZE);
              dispatch({ type: "SET_GALLERY_LIB_FILTER", payload: val });
            }}
            ariaLabel="Lọc kết quả theo thư viện"
          />

          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Lọc ảnh kết quả theo tên hiệu ứng"
              placeholder="Lọc kết quả theo hiệu ứng..."
              value={state.gallerySearch}
              onChange={(e) => {
                setVisibleLimit(PAGE_SIZE);
                dispatch({ type: "SET_GALLERY_SEARCH", payload: e.target.value });
              }}
              className="w-full h-7 pl-8 pr-2.5 rounded-sm bg-surface-2 border border-border text-xs text-text placeholder:text-subtle"
            />
          </div>
        </div>
      )}

      {state.results.length === 0 && !state.isGenerating ? (
        <EmptyState
          icon={<Images className="w-7 h-7" />}
          title="Kết quả sẽ hiện ở đây"
          hint={
            !state.sourceImage
              ? "Tải lên một ảnh ở cột bên trái, chọn hiệu ứng và bấm Tạo ảnh."
              : state.failures.length > 0
                ? "Tất cả tác vụ trong lần chạy vừa rồi đều gặp lỗi. Xem bảng chi tiết lỗi ở trên."
                : "Bấm Tạo ảnh hoặc Tạo tất cả ở thanh công cụ để bắt đầu xử lý."
          }
          className="my-4"
        />
      ) : (
        <div className="flex flex-col gap-3 max-h-[680px] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-2.5">
            {displayedResults.map((item) => (
              <ResultTile key={item.id} item={item} />
            ))}
            {Array.from({ length: pendingSkeletonCount }).map((_, idx) => (
              <div
                key={`skel-${idx}`}
                className="flex flex-col rounded-md border border-border bg-surface-2 overflow-hidden"
              >
                <div className="aspect-square w-full bg-surface-2 animate-pulse" />
                <div className="px-2 py-1.5 bg-surface-1 border-t border-border flex items-center justify-between">
                  <span className="h-3 w-20 bg-surface-3 rounded-xs animate-pulse" />
                  <span className="h-3 w-8 bg-surface-3 rounded-xs animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {filteredResults.length > visibleLimit && (
            <div className="flex justify-center pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
              >
                <span className="num">
                  Hiện thêm ({filteredResults.length - visibleLimit} ảnh còn lại)
                </span>
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
