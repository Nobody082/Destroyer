"use client";

import { MoveHorizontal } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";

export interface BeforeAfterProps {
  beforeUrl: string;
  afterUrl: string;
  alt: string;
}

export function BeforeAfter({ beforeUrl, afterUrl, alt }: BeforeAfterProps) {
  const [split, setSplit] = useState(50);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(0, Math.min(100, Math.round(pct))));
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={(e) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        updateFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        if (draggingRef.current) {
          draggingRef.current = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }
      }}
      className="relative w-full h-[56dvh] min-h-[300px] max-h-[640px] rounded-lg border border-border checker overflow-hidden select-none touch-none"
    >
      {/* After (Augmented Result) full layer */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt={`Kết quả: ${alt}`}
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />

      {/* Before (Original) clipped layer */}
      <div
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="Ảnh gốc"
          draggable={false}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Labels */}
      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-sm bg-surface-1/90 border border-border text-2xs font-medium text-text pointer-events-none">
        Gốc
      </span>
      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-sm bg-surface-1/90 border border-border text-2xs font-medium text-accent pointer-events-none">
        Kết quả
      </span>

      {/* Divider Line + Keyboard Handle */}
      <div
        style={{ left: `${split}%` }}
        className="absolute top-0 bottom-0 w-0.5 bg-accent -translate-x-1/2 pointer-events-none"
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Thanh trượt so sánh ảnh gốc và kết quả"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={split}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              e.stopPropagation();
              setSplit((s) => Math.max(0, s - 5));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              e.stopPropagation();
              setSplit((s) => Math.min(100, s + 5));
            } else if (e.key === "Home") {
              e.preventDefault();
              e.stopPropagation();
              setSplit(0);
            } else if (e.key === "End") {
              e.preventDefault();
              e.stopPropagation();
              setSplit(100);
            }
          }}
          className="pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-accent text-accent-fg shadow-md flex items-center justify-center cursor-ew-resize"
        >
          <MoveHorizontal className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
