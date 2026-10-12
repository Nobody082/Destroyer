"use client";

import React, { useEffect, useRef } from "react";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  title?: string;
  children: React.ReactNode;
  align?: "left" | "right";
}

export function Popover({
  open,
  onClose,
  triggerRef,
  title,
  children,
  align = "right",
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const triggerEl = triggerRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        triggerEl?.focus();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerEl?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title || "Tuỳ chỉnh tham số"}
      className={`absolute top-full mt-1.5 w-80 max-w-[360px] bg-surface-1 border border-border-strong rounded-lg shadow-md p-3 z-popover ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      {children}
    </div>
  );
}
