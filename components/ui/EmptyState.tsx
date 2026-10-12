"use client";

import React from "react";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, hint, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 rounded-lg border border-dashed border-border bg-surface-1/50 gap-2 ${className}`}
    >
      <div className="text-subtle flex items-center justify-center w-8 h-8" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-md font-medium text-text">{title}</h3>
      <p className="text-xs text-muted max-w-sm">{hint}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
