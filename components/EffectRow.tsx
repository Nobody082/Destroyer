"use client";

import { Settings2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { isSlowEffect } from "@/lib/catalog";
import { getEffectDocVi, getEffectTitleVi } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import type { CatalogEffect } from "@/lib/types";
import { ParamEditor } from "./ParamEditor";
import { Badge } from "./ui/Badge";
import { Checkbox } from "./ui/Checkbox";
import { IconButton } from "./ui/IconButton";
import { Popover } from "./ui/Popover";

const PHASE_LABELS: Record<string, string> = {
  ink: "Mực",
  paper: "Giấy",
  post: "Hậu kỳ",
  pixel: "Điểm ảnh",
  spatial: "Hình học",
};

export function EffectRow({ effect }: { effect: CatalogEffect }) {
  const { state, dispatch } = useAppStore();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement | null>(null);

  const isUnsupported = effect.status !== "ok";
  const isSelected = !isUnsupported && state.selectedIds.includes(effect.id);
  const slow = isSlowEffect(effect);
  const hasCustomParams = Boolean(
    state.effectParams[effect.id] && Object.keys(state.effectParams[effect.id]).length > 0
  );

  const groupTag = effect.lib === "augraphy" ? effect.phase : effect.category;
  const titleVi = getEffectTitleVi(effect);
  const docVi = getEffectDocVi(effect);

  const handleToggle = () => {
    if (isUnsupported) return;
    dispatch({ type: "TOGGLE_EFFECT", payload: effect.id });
  };

  return (
    <div
      title={
        isUnsupported
          ? `${titleVi} (${effect.name}) — Không hỗ trợ: ${effect.reason || "Không tương thích chế độ độc lập"}`
          : `${titleVi} (${effect.name}): ${docVi}`
      }
      className={`relative flex items-center justify-between gap-2 min-h-9 px-2.5 py-1.5 rounded-md border transition-ui ${
        isUnsupported
          ? "opacity-50 bg-surface-1 border-border cursor-not-allowed"
          : isSelected
            ? "bg-accent-soft border-accent-line"
            : "bg-surface-1 border-border hover:bg-surface-3"
      }`}
    >
      <label
        className={`flex items-center gap-2.5 flex-1 min-w-0 py-0.5 ${
          isUnsupported ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <Checkbox
          checked={isSelected}
          disabled={isUnsupported}
          label={`Chọn hiệu ứng ${titleVi}`}
          onChange={handleToggle}
        />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-sm font-medium text-text truncate">{titleVi}</span>
            <span className="text-2xs font-mono text-subtle shrink-0">{effect.name}</span>
          </div>
          <span className="text-xs text-muted truncate">
            {isUnsupported ? effect.reason || "Không hỗ trợ ở chế độ độc lập" : docVi}
          </span>
        </div>
      </label>

      <div className="flex items-center gap-1.5 shrink-0">
        {groupTag && (
          <Badge variant="neutral" className="hidden sm:inline-flex">
            {PHASE_LABELS[groupTag] || groupTag}
          </Badge>
        )}

        {isUnsupported ? (
          <Badge variant="danger">Không hỗ trợ</Badge>
        ) : (
          <>
            {slow && (
              <Badge variant="info" title={`Thời gian trung bình ~${effect.avg_ms} ms`}>
                Chậm
              </Badge>
            )}
            {typeof effect.avg_ms === "number" && (
              <span className="hidden xl:inline-block text-2xs text-subtle num w-12 text-right">
                {effect.avg_ms} ms
              </span>
            )}
            <IconButton
              ref={gearRef}
              size="sm"
              active={popoverOpen || hasCustomParams}
              label={`Tuỳ chỉnh tham số ${titleVi}`}
              onClick={(e) => {
                e.stopPropagation();
                setPopoverOpen((prev) => !prev);
              }}
            >
              <Settings2 className="w-4 h-4" aria-hidden="true" />
            </IconButton>
          </>
        )}
      </div>

      <Popover
        open={popoverOpen}
        onClose={() => setPopoverOpen(false)}
        triggerRef={gearRef}
        title={`Tham số: ${titleVi}`}
      >
        <ParamEditor effect={effect} />
      </Popover>
    </div>
  );
}
