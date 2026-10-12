"use client";

import { RotateCcw } from "lucide-react";
import React, { useState } from "react";
import { buildEffectDefaults, getEditableParams } from "@/lib/catalog";
import { getEffectDocVi, getEffectTitleVi } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import type { CatalogEffect, CatalogParam } from "@/lib/types";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { Slider } from "./ui/Slider";
import { Toggle } from "./ui/Toggle";

function inferNumericBounds(param: CatalogParam): { min: number; max: number; step: number } {
  const def = typeof param.default === "number" ? param.default : 0;
  if (param.kind === "int") {
    if (param.name.includes("angle") || param.name.includes("rotate")) {
      return { min: -180, max: 180, step: 1 };
    }
    if (def > 100) {
      return { min: 0, max: Math.max(500, def * 4), step: 1 };
    }
    const min = def < 0 ? Math.min(-10, def * 2) : 0;
    const max = Math.max(20, Math.abs(def) * 4 || 100);
    return { min, max, step: 1 };
  }
  // float
  if (def >= 0 && def <= 1) {
    return { min: 0, max: 1, step: 0.01 };
  }
  const min = def < 0 ? Math.floor(def * 2) : 0;
  const max = Math.max(2, Math.ceil(Math.abs(def) * 4) || 10);
  return { min, max, step: 0.05 };
}

function JsonParamInput({
  param,
  value,
  onChange,
}: {
  param: CatalogParam;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const [text, setText] = useState<string>(() => {
    try {
      return value === undefined ? "" : JSON.stringify(value);
    } catch {
      return String(value ?? "");
    }
  });
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-text">{param.name}</label>
        <span className="text-2xs text-subtle">JSON</span>
      </div>
      <textarea
        rows={2}
        value={text}
        aria-label={param.name}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (!next.trim()) {
            setErr(null);
            onChange(param.default);
            return;
          }
          try {
            const parsed = JSON.parse(next);
            setErr(null);
            onChange(parsed);
          } catch {
            setErr("JSON chưa hợp lệ");
          }
        }}
        className={`w-full px-2 py-1 rounded-sm bg-surface-2 border text-xs font-mono text-text ${
          err ? "border-danger" : "border-border"
        }`}
      />
      {err && <span className="text-2xs text-danger">{err}</span>}
    </div>
  );
}

export function ParamEditor({ effect }: { effect: CatalogEffect }) {
  const { state, dispatch, getEffectiveParams } = useAppStore();
  const editableParams = getEditableParams(effect);
  const currentValues = getEffectiveParams(effect);
  const hasOverrides = Boolean(
    state.effectParams[effect.id] && Object.keys(state.effectParams[effect.id]).length > 0
  );
  const titleVi = getEffectTitleVi(effect);
  const docVi = getEffectDocVi(effect);

  const handleParamChange = (paramName: string, value: unknown) => {
    dispatch({
      type: "SET_EFFECT_PARAM",
      payload: { effectId: effect.id, paramName, value },
    });
  };

  const handleReset = () => {
    dispatch({
      type: "RESET_EFFECT_PARAMS",
      payload: { effectId: effect.id, defaults: buildEffectDefaults(effect) },
    });
  };

  if (editableParams.length === 0) {
    return (
      <div className="flex flex-col gap-1.5 text-xs text-muted py-1">
        <p className="text-text font-medium">{docVi}</p>
        <p>
          Hiệu ứng này không có tham số tuỳ chỉnh bổ sung (chạy với <code className="font-mono">p=1</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-border">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-text truncate">{titleVi}</div>
          <div className="text-2xs text-subtle font-mono truncate">{effect.id}</div>
          <p className="text-2xs text-muted mt-0.5 leading-relaxed">{docVi}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={!hasOverrides}
          onClick={handleReset}
          title="Đặt lại tham số mặc định"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Đặt lại</span>
        </Button>
      </div>

      {editableParams.map((param) => {
        const val = currentValues[param.name];

        if (param.kind === "bool") {
          return (
            <Toggle
              key={param.name}
              id={`param-${effect.id}-${param.name}`}
              label={param.name}
              checked={Boolean(val)}
              onChange={(checked) => handleParamChange(param.name, checked)}
            />
          );
        }

        if (param.kind === "choice" && Array.isArray(param.choices) && param.choices.length > 0) {
          const opts = param.choices.map((c) => ({
            value: String(c),
            label: String(c),
          }));
          return (
            <div key={param.name} className="flex flex-col gap-1">
              <label
                htmlFor={`param-${effect.id}-${param.name}`}
                className="text-xs font-mono text-text"
              >
                {param.name}
              </label>
              <Select
                id={`param-${effect.id}-${param.name}`}
                label={param.name}
                value={String(val ?? param.choices[0])}
                options={opts}
                onChange={(selectedStr) => {
                  const originalChoice = param.choices?.find((c) => String(c) === selectedStr);
                  handleParamChange(param.name, originalChoice ?? selectedStr);
                }}
              />
            </div>
          );
        }

        if (param.kind === "int" || param.kind === "float") {
          const bounds = inferNumericBounds(param);
          const numVal = typeof val === "number" ? val : Number(param.default) || 0;
          return (
            <Slider
              key={param.name}
              id={`param-${effect.id}-${param.name}`}
              label={param.name}
              value={numVal}
              min={bounds.min}
              max={bounds.max}
              step={bounds.step}
              onChange={(nextNum) =>
                handleParamChange(
                  param.name,
                  param.kind === "int" ? Math.round(nextNum) : Number(nextNum.toFixed(4))
                )
              }
            />
          );
        }

        if (param.kind === "range") {
          const pair =
            Array.isArray(val) && val.length === 2
              ? [Number(val[0]) || 0, Number(val[1]) || 0]
              : [0, 1];
          const isInt = param.numeric === "int";
          const step = isInt ? 1 : 0.05;
          return (
            <div key={param.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-text">{param.name}</span>
                <span className="text-2xs text-subtle">Khoảng [min, max]</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step={step}
                  aria-label={`${param.name} tối thiểu`}
                  value={pair[0]}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      const clean = isInt ? Math.round(v) : v;
                      handleParamChange(param.name, [clean, Math.max(clean, pair[1])]);
                    }
                  }}
                  className="h-7 px-2 rounded-sm bg-surface-2 border border-border text-xs num text-text"
                />
                <input
                  type="number"
                  step={step}
                  aria-label={`${param.name} tối đa`}
                  value={pair[1]}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      const clean = isInt ? Math.round(v) : v;
                      handleParamChange(param.name, [Math.min(pair[0], clean), clean]);
                    }
                  }}
                  className="h-7 px-2 rounded-sm bg-surface-2 border border-border text-xs num text-text"
                />
              </div>
            </div>
          );
        }

        if (param.kind === "str") {
          return (
            <div key={param.name} className="flex flex-col gap-1">
              <label
                htmlFor={`param-${effect.id}-${param.name}`}
                className="text-xs font-mono text-text"
              >
                {param.name}
              </label>
              <input
                id={`param-${effect.id}-${param.name}`}
                type="text"
                value={String(val ?? "")}
                onChange={(e) => handleParamChange(param.name, e.target.value)}
                className="h-7 px-2 rounded-sm bg-surface-2 border border-border text-xs text-text"
              />
            </div>
          );
        }

        return (
          <JsonParamInput
            key={param.name}
            param={param}
            value={val}
            onChange={(nextVal) => handleParamChange(param.name, nextVal)}
          />
        );
      })}
    </div>
  );
}
