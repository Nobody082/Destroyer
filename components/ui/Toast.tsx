"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import React from "react";
import { useAppStore } from "@/lib/store";
import { IconButton } from "./IconButton";

export function ToastViewport() {
  const { state, dismissToast } = useAppStore();

  if (state.toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 sm:bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-5 z-toast flex flex-col gap-2 w-[calc(100vw-24px)] max-w-sm pointer-events-none"
    >
      {state.toasts.map((t) => {
        const isError = t.kind === "error";
        const isSuccess = t.kind === "success";
        return (
          <div
            key={t.id}
            role={isError ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-lg bg-surface-1 border shadow-lg transition-ui ${
              isError
                ? "border-danger text-text"
                : isSuccess
                  ? "border-success text-text"
                  : "border-border-strong text-text"
            }`}
          >
            {isError ? (
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" aria-hidden="true" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <Info className="w-4 h-4 text-info shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <p className="text-xs leading-relaxed flex-1 break-words">{t.message}</p>
            <IconButton
              size="sm"
              label="Đóng thông báo"
              onClick={() => dismissToast(t.id)}
              className="-mt-1 -mr-1"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}
