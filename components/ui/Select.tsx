"use client";

import { ChevronDown } from "lucide-react";
import React from "react";

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string | number = string> {
  id?: string;
  label?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

export function Select<T extends string | number = string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: SelectProps<T>) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        id={id}
        aria-label={label}
        disabled={disabled}
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const match = options.find((o) => String(o.value) === raw);
          if (match) {
            onChange(match.value);
          }
        }}
        className={`w-full h-8 pl-2.5 pr-7 rounded-sm bg-surface-2 border border-border text-sm text-text appearance-none transition-ui ${
          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-surface-3 cursor-pointer"
        }`}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)} className="bg-surface-1 text-text">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="w-4 h-4 text-muted pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>
  );
}
