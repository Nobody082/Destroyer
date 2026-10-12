"use client";

import React from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export function Checkbox({ label, className = "", disabled, ...rest }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      disabled={disabled}
      aria-label={label}
      style={{ accentColor: "var(--accent)" }}
      className={`w-4 h-4 rounded-xs border border-border-strong bg-surface-2 transition-ui ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
      {...rest}
    />
  );
}
