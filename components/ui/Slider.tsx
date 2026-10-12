"use client";

import React from "react";

export interface SliderProps {
  id?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  unit?: string;
}

export function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  unit,
}: SliderProps) {
  const safeVal = Number.isFinite(value) ? value : min;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-text truncate">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={safeVal}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isNaN(v)) {
                onChange(Math.max(min, Math.min(max, v)));
              }
            }}
            className="w-16 h-7 px-2 rounded-sm bg-surface-2 border border-border text-xs text-right num text-text"
          />
          {unit && <span className="text-2xs text-subtle num">{unit}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xs text-subtle num">{min}</span>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={Math.max(min, Math.min(max, safeVal))}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ accentColor: "var(--accent)" }}
          className="flex-1 h-1.5 bg-surface-3 rounded-xs cursor-pointer"
        />
        <span className="text-2xs text-subtle num">{max}</span>
      </div>
    </div>
  );
}
