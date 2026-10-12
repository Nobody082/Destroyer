"use client";

import React from "react";

export interface ToggleProps {
  id?: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}

export function Toggle({ id, label, checked, onChange, disabled = false, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col min-w-0">
        <label htmlFor={id} className="text-xs font-medium text-text cursor-pointer select-none truncate">
          {label}
        </label>
        {description && <span className="text-2xs text-muted truncate">{description}</span>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex items-center w-8 h-[18px] rounded-xl transition-ui shrink-0 border ${
          checked ? "bg-accent border-transparent" : "bg-surface-3 border-border-strong"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          aria-hidden="true"
          className={`inline-block w-3.5 h-3.5 rounded-xl transition-ui transform ${
            checked ? "translate-x-[15px] bg-accent-fg" : "translate-x-[1px] bg-text"
          }`}
        />
      </button>
    </div>
  );
}
