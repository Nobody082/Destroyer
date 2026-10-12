"use client";

import { ArrowDown, ArrowUp, Layers, Settings2, Trash2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { getEffectDocVi, getEffectTitleVi } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import type { CatalogEffect } from "@/lib/types";
import { ParamEditor } from "./ParamEditor";
import { Badge } from "./ui/Badge";
import { EmptyState } from "./ui/EmptyState";
import { IconButton } from "./ui/IconButton";
import { Popover } from "./ui/Popover";

const GROUP_LABELS: Record<string, string> = {
  ink: "Mực",
  paper: "Giấy",
  post: "Hậu kỳ",
  pixel: "Điểm ảnh",
  spatial: "Hình học",
};

function ChainStepRow({
  effect,
  index,
  total,
}: {
  effect: CatalogEffect;
  index: number;
  total: number;
}) {
  const { dispatch } = useAppStore();
  const [open, setOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement | null>(null);
  const titleVi = getEffectTitleVi(effect);
  const docVi = getEffectDocVi(effect);
  const groupKey = (effect.lib === "augraphy" ? effect.phase : effect.category) || "";
  const groupLabel = GROUP_LABELS[groupKey] || groupKey;

  return (
    <div className="relative flex items-center justify-between gap-2 p-2.5 rounded-md bg-surface-2 border border-border">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-6 h-6 rounded-sm bg-surface-3 text-xs font-mono num text-text flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-text truncate">{titleVi}</span>
            <span className="text-2xs font-mono text-subtle">{effect.name}</span>
            <Badge variant="neutral">
              {effect.lib === "augraphy" ? `Augraphy · ${groupLabel}` : `Albumentations · ${groupLabel}`}
            </Badge>
          </div>
          <p className="text-2xs text-muted truncate">{docVi}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <IconButton
          size="sm"
          label="Di chuyển lên"
          disabled={index === 0}
          onClick={() => dispatch({ type: "MOVE_CHAIN_ITEM", payload: { index, direction: -1 } })}
        >
          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
        </IconButton>
        <IconButton
          size="sm"
          label="Di chuyển xuống"
          disabled={index === total - 1}
          onClick={() => dispatch({ type: "MOVE_CHAIN_ITEM", payload: { index, direction: 1 } })}
        >
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
        </IconButton>
        <IconButton
          ref={gearRef}
          size="sm"
          active={open}
          label={`Tham số ${titleVi}`}
          onClick={() => setOpen((p) => !p)}
        >
          <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
        </IconButton>
        <IconButton
          size="sm"
          label={`Xoá ${titleVi} khỏi chuỗi`}
          onClick={() => dispatch({ type: "REMOVE_CHAIN_ITEM", payload: effect.id })}
        >
          <Trash2 className="w-3.5 h-3.5 text-danger" aria-hidden="true" />
        </IconButton>
      </div>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={gearRef}
        title={`Tham số: ${titleVi}`}
      >
        <ParamEditor effect={effect} />
      </Popover>
    </div>
  );
}

export function ChainEditor() {
  const { state, dispatch, catalogMap } = useAppStore();
  const selectedEffects = state.selectedIds
    .map((id) => catalogMap.get(id))
    .filter((e): e is CatalogEffect => Boolean(e && e.status === "ok"));

  if (selectedEffects.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="w-7 h-7" />}
        title="Chưa chọn hiệu ứng nào trong chuỗi"
        hint="Hãy chuyển sang thẻ Augraphy hoặc Albumentations để đánh dấu các hiệu ứng cần đưa vào chuỗi."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted">
        <span>
          Thứ tự thực thi: các hiệu ứng <strong className="text-text">Augraphy</strong> chạy trước (theo pha Mực → Giấy → Hậu kỳ), sau đó tới{" "}
          <strong className="text-text">Albumentations</strong> theo đúng thứ tự bên dưới.
        </span>
        {state.mode !== "chain" && (
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_MODE", payload: "chain" })}
            className="text-accent hover:underline shrink-0 font-medium cursor-pointer"
          >
            Bật chế độ Chuỗi cố định
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {selectedEffects.map((eff, idx) => (
          <ChainStepRow
            key={eff.id}
            effect={eff}
            index={idx}
            total={selectedEffects.length}
          />
        ))}
      </div>
    </div>
  );
}
