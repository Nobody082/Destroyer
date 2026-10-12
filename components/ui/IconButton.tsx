"use client";

import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  active?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", active = false, disabled, className = "", children, ...rest },
  ref
) {
  const dim = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const stateCls = active
    ? "bg-accent-soft text-accent border border-accent-line"
    : "bg-transparent text-muted hover:text-text hover:bg-surface-3 border border-transparent";

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md transition-ui shrink-0 ${dim} ${stateCls} ${
        disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "active:translate-y-[0.5px] cursor-pointer"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
