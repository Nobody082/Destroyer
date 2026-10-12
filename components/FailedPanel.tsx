"use client";

import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import React from "react";
import { formatEffectLabelVi } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Badge } from "./ui/Badge";

export function FailedPanel() {
  const { state, dispatch } = useAppStore();
  const count = state.failures.length;

  if (count === 0) return null;

  return (
    <div className="rounded-md border border-danger bg-danger-soft/40 overflow-hidden">
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "SET_SHOW_FAILED_PANEL", payload: !state.showFailedPanel })
        }
        aria-expanded={state.showFailedPanel}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs font-medium text-text hover:bg-danger-soft transition-ui cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" aria-hidden="true" />
          <span>Chi tiết lỗi khi xử lý</span>
          <Badge variant="danger" className="num">
            {count} lỗi
          </Badge>
        </div>
        {state.showFailedPanel ? (
          <ChevronUp className="w-4 h-4 text-muted" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
        )}
      </button>

      {state.showFailedPanel && (
        <div className="p-2.5 border-t border-danger/30 bg-surface-1 max-h-48 overflow-y-auto flex flex-col gap-1.5">
          {state.failures.map((f, idx) => (
            <div
              key={`${f.id || idx}-${idx}`}
              className="text-xs flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 p-1.5 rounded-sm bg-surface-2 border border-border"
            >
              <span className="font-semibold text-danger shrink-0">
                {f.effect ? formatEffectLabelVi(f.effect) : f.id || "Tác vụ"}:
              </span>
              <span className="text-muted break-all">{f.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
