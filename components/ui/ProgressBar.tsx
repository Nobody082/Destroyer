"use client";

import React from "react";

export interface ProgressBarProps {
  done: number;
  total: number;
  etaMs?: number;
  elapsedMs?: number;
  indeterminate?: boolean;
  label?: string;
}

export function formatDurationVi(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0 giây";
  const sec = Math.max(1, Math.round(ms / 1000));
  if (sec < 60) return `${sec} giây`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}p ${s}s` : `${m} phút`;
}

export function ProgressBar({
  done,
  total,
  etaMs = 0,
  elapsedMs = 0,
  indeterminate = false,
  label,
}: ProgressBarProps) {
  const safeTotal = Math.max(1, total);
  const pct = Math.min(100, Math.max(0, Math.round((done / safeTotal) * 100)));

  return (
    <div className="flex flex-col gap-1 w-full min-w-[160px]">
      <div className="flex items-center justify-between gap-2 text-xs num">
        <span className="text-text font-medium truncate">
          {label ?? `Đang tạo… ${done}/${total}`}
        </span>
        <span className="text-subtle shrink-0">
          {done > 0 && done < total && etaMs > 0
            ? `còn ~${formatDurationVi(etaMs)}`
            : elapsedMs > 0
              ? formatDurationVi(elapsedMs)
              : `${pct}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label ?? "Tiến độ tạo ảnh"}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={done}
        className="w-full h-1.5 bg-surface-3 rounded-xs overflow-hidden"
      >
        <div
          style={{ width: indeterminate ? "40%" : `${pct}%` }}
          className={`h-full bg-accent transition-ui ${indeterminate ? "animate-pulse" : ""}`}
        />
      </div>
    </div>
  );
}
