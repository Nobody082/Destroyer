"use client";

import { Loader2 } from "lucide-react";
import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, disabled, className = "", children, ...rest },
  ref
) {
  const isDisabled = disabled || loading;

  const sizeClasses =
    size === "sm"
      ? "h-7 px-3 text-xs"
      : size === "lg"
        ? "h-10 px-5 text-sm"
        : "h-8 px-4 text-sm";

  const variantClasses =
    variant === "primary"
      ? "bg-accent text-accent-fg border border-transparent hover:bg-accent-hover"
      : variant === "danger"
        ? "bg-transparent text-danger border border-border hover:bg-danger-soft"
        : variant === "ghost"
          ? "bg-transparent text-text border border-transparent hover:bg-surface-3"
          : "bg-surface-2 text-text border border-border hover:bg-surface-3";

  return (
    <button
      ref={ref}
      type="button"
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-ui select-none ${sizeClasses} ${variantClasses} ${
        isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "active:translate-y-[0.5px] cursor-pointer"
      } ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
});
