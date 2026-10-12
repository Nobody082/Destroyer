"use client";

import React, { useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  variant?: "underline" | "segmented";
  className?: string;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  variant = "underline",
  className = "",
}: TabsProps<T>) {
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    e.preventDefault();
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = items.length - 1;

    const nextItem = items[nextIdx];
    if (nextItem) {
      onChange(nextItem.id);
      btnRefs.current[nextIdx]?.focus();
    }
  };

  if (variant === "segmented") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={`inline-flex items-center p-1 bg-surface-2 rounded-md border border-border gap-1 flex-wrap ${className}`}
      >
        {items.map((item, idx) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              ref={(el) => {
                btnRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`h-7 px-2.5 rounded-sm text-xs font-medium transition-ui inline-flex items-center gap-1.5 cursor-pointer ${
                active
                  ? "bg-surface-3 text-text shadow-sm border border-border-strong"
                  : "text-muted hover:text-text border border-transparent"
              }`}
            >
              <span>{item.label}</span>
              {typeof item.count === "number" && (
                <span className="num text-2xs text-subtle">{item.count}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center border-b border-border gap-1 overflow-x-auto ${className}`}
    >
      {items.map((item, idx) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              btnRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`relative h-9 px-3 text-sm font-medium transition-ui inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              active ? "text-text" : "text-muted hover:text-text"
            }`}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className={`num text-2xs px-1.5 py-0.5 rounded-xs ${
                  active ? "bg-accent-soft text-accent" : "bg-surface-2 text-subtle"
                }`}
              >
                {item.count}
              </span>
            )}
            {active && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
