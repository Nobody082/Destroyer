"use client";

import { CheckSquare, FilterX, Search, Sparkles, Square, Zap } from "lucide-react";
import React, { useMemo } from "react";
import { getEffectDocVi, getEffectTitleVi } from "@/lib/i18n";
import { PRESETS } from "@/lib/presets";
import {
  type AlbumentationsSubTab,
  type AugraphySubTab,
  type PickerTab,
  useAppStore,
} from "@/lib/store";
import { ChainEditor } from "./ChainEditor";
import { EffectRow } from "./EffectRow";
import { PresetGrid } from "./PresetGrid";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { Tabs } from "./ui/Tabs";

export function EffectPicker() {
  const { state, dispatch, okEffects, applyPreset, startGeneration } = useAppStore();
  const allEffects = useMemo(() => state.catalog?.effects ?? [], [state.catalog]);

  const augraphyEffects = useMemo(
    () => allEffects.filter((e) => e.lib === "augraphy"),
    [allEffects]
  );
  const albumentationsEffects = useMemo(
    () => allEffects.filter((e) => e.lib === "albumentations"),
    [allEffects]
  );

  const visibleEffects = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    let list =
      state.activeTab === "augraphy"
        ? augraphyEffects
        : state.activeTab === "albumentations"
          ? albumentationsEffects
          : [];

    if (state.activeTab === "augraphy" && state.augraphySubTab !== "all") {
      list = list.filter((e) => e.phase === state.augraphySubTab);
    } else if (state.activeTab === "albumentations" && state.albumentationsSubTab !== "all") {
      list = list.filter((e) => e.category === state.albumentationsSubTab);
    }

    if (q) {
      list = list.filter(
        (e) =>
          getEffectTitleVi(e).toLowerCase().includes(q) ||
          getEffectDocVi(e).toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          e.doc.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q)
      );
    }

    // Show supported ("ok") effects first, unsupported at bottom
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === "ok" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [
    state.activeTab,
    state.augraphySubTab,
    state.albumentationsSubTab,
    state.searchQuery,
    augraphyEffects,
    albumentationsEffects,
  ]);

  const visibleOkIds = useMemo(
    () => visibleEffects.filter((e) => e.status === "ok").map((e) => e.id),
    [visibleEffects]
  );

  const handleSelectAllVisible = () => {
    const set = new Set(state.selectedIds);
    for (const id of visibleOkIds) set.add(id);
    dispatch({ type: "SET_SELECTED_EFFECTS", payload: { ids: Array.from(set) } });
  };

  const handleDeselectVisible = () => {
    const removeSet = new Set(visibleOkIds);
    const remaining = state.selectedIds.filter((id) => !removeSet.has(id));
    dispatch({ type: "SET_SELECTED_EFFECTS", payload: { ids: remaining } });
  };

  const mainTabs: Array<{ id: PickerTab; label: string; count?: number }> = [
    { id: "presets", label: "Mẫu có sẵn", count: PRESETS.length },
    { id: "augraphy", label: "Augraphy", count: augraphyEffects.length },
    { id: "albumentations", label: "Albumentations", count: albumentationsEffects.length },
    { id: "chain", label: "Chuỗi", count: state.selectedIds.length },
  ];

  const augSubTabs: Array<{ id: AugraphySubTab; label: string; count: number }> = [
    { id: "all", label: "Tất cả", count: augraphyEffects.length },
    { id: "ink", label: "Mực", count: augraphyEffects.filter((e) => e.phase === "ink").length },
    { id: "paper", label: "Giấy", count: augraphyEffects.filter((e) => e.phase === "paper").length },
    { id: "post", label: "Hậu kỳ", count: augraphyEffects.filter((e) => e.phase === "post").length },
  ];

  const albSubTabs: Array<{ id: AlbumentationsSubTab; label: string; count: number }> = [
    { id: "all", label: "Tất cả", count: albumentationsEffects.length },
    {
      id: "pixel",
      label: "Điểm ảnh",
      count: albumentationsEffects.filter((e) => e.category === "pixel").length,
    },
    {
      id: "spatial",
      label: "Hình học",
      count: albumentationsEffects.filter((e) => e.category === "spatial").length,
    },
  ];

  return (
    <section
      aria-label="Bộ chọn hiệu ứng"
      className="bg-surface-1 border border-border rounded-lg p-4 flex flex-col gap-3 min-w-0"
    >
      {/* Top header + One-click Generate ALL */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-md font-semibold text-text">Hiệu ứng biến đổi</h2>
          <span className="text-xs text-muted num">
            Đã chọn <strong className="text-text">{state.selectedIds.length}</strong>/{okEffects.length} khả dụng
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={state.isGenerating || okEffects.length === 0}
            onClick={() => void startGeneration(true)}
            title="Chạy mọi hiệu ứng hợp lệ trong danh mục (mỗi hiệu ứng 1 ảnh)"
          >
            <Zap className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span className="num">Tạo tất cả ({okEffects.length})</span>
          </Button>
        </div>
      </div>

      {/* Quick Preset strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="text-2xs text-subtle shrink-0 flex items-center gap-1 mr-1">
          <Sparkles className="w-3 h-3 text-accent" aria-hidden="true" />
          Mẫu nhanh:
        </span>
        {PRESETS.map((preset) => {
          const active = state.activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => applyPreset(preset)}
              className={`h-6 px-2.5 rounded-sm text-xs font-medium transition-ui shrink-0 border cursor-pointer ${
                active
                  ? "bg-accent-soft text-accent border-accent-line"
                  : "bg-surface-2 text-muted border-border hover:text-text hover:bg-surface-3"
              }`}
            >
              {preset.title}
            </button>
          );
        })}
      </div>

      {/* Main Tabs */}
      <Tabs
        items={mainTabs}
        value={state.activeTab}
        onChange={(tab) => dispatch({ type: "SET_ACTIVE_TAB", payload: tab })}
        ariaLabel="Phân loại thư viện hiệu ứng"
      />

      {/* Tab Content */}
      {state.catalogLoading ? (
        <div className="flex flex-col gap-2 py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : state.catalogError ? (
        <EmptyState
          icon={<FilterX className="w-7 h-7 text-danger" />}
          title="Không tải được danh mục hiệu ứng"
          hint={state.catalogError}
        />
      ) : state.activeTab === "presets" ? (
        <PresetGrid />
      ) : state.activeTab === "chain" ? (
        <ChainEditor />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Sub-tabs + Search + Group Select All / None */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {state.activeTab === "augraphy" ? (
              <Tabs
                variant="segmented"
                items={augSubTabs}
                value={state.augraphySubTab}
                onChange={(sub) => dispatch({ type: "SET_AUGRAPHY_SUBTAB", payload: sub })}
                ariaLabel="Các pha của Augraphy"
              />
            ) : (
              <Tabs
                variant="segmented"
                items={albSubTabs}
                value={state.albumentationsSubTab}
                onChange={(sub) => dispatch({ type: "SET_ALBUMENTATIONS_SUBTAB", payload: sub })}
                ariaLabel="Nhóm hiệu ứng Albumentations"
              />
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="ghost" onClick={handleSelectAllVisible}>
                <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Chọn tất cả</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDeselectVisible}>
                <Square className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Bỏ chọn</span>
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search
              className="w-4 h-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Tìm kiếm hiệu ứng theo tên hoặc mô tả"
              placeholder="Tìm hiệu ứng (ví dụ: Loang mực, Nếp gấp, Làm mờ, InkBleed...)"
              value={state.searchQuery}
              onChange={(e) => dispatch({ type: "SET_SEARCH_QUERY", payload: e.target.value })}
              className="w-full h-8 pl-8 pr-3 rounded-sm bg-surface-2 border border-border text-sm text-text placeholder:text-subtle"
            />
          </div>

          {visibleEffects.length === 0 ? (
            <EmptyState
              icon={<Search className="w-7 h-7" />}
              title="Không tìm thấy hiệu ứng phù hợp"
              hint="Hãy thử từ khoá khác hoặc xoá bộ lọc tìm kiếm."
              action={
                state.searchQuery ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => dispatch({ type: "SET_SEARCH_QUERY", payload: "" })}
                  >
                    Xoá tìm kiếm
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div
              role="list"
              aria-label="Danh sách hiệu ứng"
              className="flex flex-col gap-1.5 max-h-[540px] overflow-y-auto pr-1"
            >
              {visibleEffects.map((eff) => (
                <EffectRow key={eff.id} effect={eff} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
