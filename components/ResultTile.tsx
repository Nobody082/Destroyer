"use client";

import { Expand, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { formatEffectLabelVi } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import type { GeneratedResultItem } from "@/lib/types";
import { Checkbox } from "./ui/Checkbox";
import { IconButton } from "./ui/IconButton";

export const ResultTile = React.memo(function ResultTile({
  item,
}: {
  item: GeneratedResultItem;
}) {
  const { state, dispatch } = useAppStore();
  const [loaded, setLoaded] = useState(false);
  const isSelected = state.selectedResultIds.includes(item.id);
  const labelVi = formatEffectLabelVi(item.label);

  return (
    <div
      style={{ contentVisibility: "auto", containIntrinsicSize: "200px 232px" }}
      className={`group relative flex flex-col rounded-md border bg-surface-2 overflow-hidden transition-ui hover:shadow-sm ${
        isSelected
          ? "border-accent ring-2 ring-accent"
          : "border-border hover:border-border-strong"
      }`}
    >
      {/* Image area */}
      <button
        type="button"
        onClick={() => dispatch({ type: "SET_LIGHTBOX_RESULT", payload: item.id })}
        aria-label={`Xem chi tiết ảnh ${labelVi}`}
        className="relative aspect-square w-full checker overflow-hidden flex items-center justify-center cursor-pointer"
      >
        {!loaded && (
          <div className="absolute inset-0 bg-surface-2 animate-pulse" aria-hidden="true" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbUrl}
          alt={labelVi}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-contain transition-ui ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />

        <span
          aria-hidden="true"
          className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-sm bg-surface-1/85 border border-border text-text flex items-center justify-center opacity-0 group-hover:opacity-100 transition-ui"
        >
          <Expand className="w-3.5 h-3.5" />
        </span>
      </button>

      {/* Top overlay controls (checkbox + delete) */}
      <div
        className={`absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none transition-ui ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
        }`}
      >
        <label
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto w-6 h-6 rounded-sm bg-surface-1/90 border border-border flex items-center justify-center cursor-pointer"
          title="Chọn ảnh này"
        >
          <Checkbox
            checked={isSelected}
            label={`Chọn ảnh ${labelVi}`}
            onChange={() => dispatch({ type: "TOGGLE_RESULT_SELECT", payload: item.id })}
          />
        </label>

        <div className="pointer-events-auto">
          <IconButton
            size="sm"
            label={`Xoá ảnh ${labelVi}`}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "DELETE_RESULTS", payload: [item.id] });
            }}
            className="w-6 h-6 bg-surface-1/90 border border-border hover:bg-danger-soft text-danger"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 py-1.5 bg-surface-1 border-t border-border flex items-center justify-between gap-1.5">
        <span className="text-xs font-medium text-text truncate" title={`${labelVi} (${item.label})`}>
          {labelVi}
        </span>
        <span className="text-2xs text-subtle num shrink-0">{item.ms} ms</span>
      </div>
    </div>
  );
});
