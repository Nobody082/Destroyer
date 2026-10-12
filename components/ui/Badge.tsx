"use client";

import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "accent" | "success" | "danger" | "info";
}

export function Badge({ variant = "neutral", className = "", children, ...rest }: BadgeProps) {
  const variantCls =
    variant === "accent"
      ? "bg-accent-soft text-accent border-accent-line"
      : variant === "success"
        ? "bg-success-soft text-success border-transparent"
        : variant === "danger"
          ? "bg-danger-soft text-danger border-transparent"
          : variant === "info"
            ? "bg-info-soft text-info border-transparent"
            : "bg-surface-2 text-muted border-border";

  return (
    <span
      className={`inline-flex items-center h-5 px-2 text-2xs font-medium rounded-sm border shrink-0 whitespace-nowrap ${variantCls} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
