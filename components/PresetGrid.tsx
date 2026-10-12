"use client";

import { Play, Sparkles } from "lucide-react";
import React from "react";
import { getEffectDocVi, getEffectTitleVi } from "@/lib/i18n";
import { PRESETS, resolvePresetEffects } from "@/lib/presets";
import { useAppStore } from "@/lib/store";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

export function PresetGrid() {
  const { state, applyPreset, startGeneration } = useAppStore();
  const allEffects = state.catalog?.effects || [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {PRESETS.map((preset) => {
        const resolved = resolvePresetEffects(preset, allEffects);
        const isActive = state.activePresetId === preset.id;

        return (
          <div
            key={preset.id}
            className={`flex flex-col justify-between gap-2.5 p-3 rounded-lg border transition-ui ${
              isActive
                ? "bg-accent-soft border-accent-line"
                : "bg-surface-2/60 border-border hover:border-border-strong"
            }`}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-text truncate">{preset.title}</h4>
                </div>
                <Badge variant={isActive ? "accent" : "neutral"} className="num">
                  {resolved.length} hiệu ứng · {preset.count} ảnh
                </Badge>
              </div>
              <p className="text-xs text-muted leading-relaxed">{preset.description}</p>
            </div>

            <div className="flex flex-wrap gap-1 pt-1">
              {resolved.slice(0, 5).map((eff) => (
                <span
                  key={eff.id}
                  title={`${getEffectTitleVi(eff)} (${eff.name}): ${getEffectDocVi(eff)}`}
                  className="px-1.5 py-0.5 rounded-xs bg-surface-1 border border-border text-2xs text-subtle"
                >
                  {getEffectTitleVi(eff)}
                </span>
              ))}
              {resolved.length > 5 && (
                <span className="px-1.5 py-0.5 text-2xs text-subtle num">
                  +{resolved.length - 5}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
              <Button
                size="sm"
                variant={isActive ? "primary" : "secondary"}
                onClick={() => applyPreset(preset)}
              >
                {isActive ? "Đang chọn mẫu này" : "Chọn mẫu"}
              </Button>
              {state.sourceImage && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={state.isGenerating}
                  onClick={() => {
                    applyPreset(preset);
                    setTimeout(() => {
                      void startGeneration(false);
                    }, 0);
                  }}
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Chạy ngay</span>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
