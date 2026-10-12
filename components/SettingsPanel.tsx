"use client";

import { Dices } from "lucide-react";
import React from "react";
import { useAppStore } from "@/lib/store";
import type { GenerationMode, OutputFormat } from "@/lib/types";
import { IconButton } from "./ui/IconButton";
import { Select } from "./ui/Select";
import { Slider } from "./ui/Slider";
import { Toggle } from "./ui/Toggle";

const MODE_OPTIONS: Array<{ value: GenerationMode; label: string; desc: string }> = [
  {
    value: "each",
    label: "Mỗi hiệu ứng một ảnh",
    desc: "Chạy độc lập từng hiệu ứng đã chọn × R lần lặp.",
  },
  {
    value: "mix",
    label: "Trộn ngẫu nhiên (Mix)",
    desc: "Tạo N ảnh, mỗi ảnh kết hợp ngẫu nhiên k hiệu ứng (Mực → Giấy → Hậu kỳ → Albumentations).",
  },
  {
    value: "chain",
    label: "Chuỗi cố định (Chain)",
    desc: "Áp dụng nối tiếp toàn bộ hiệu ứng đã chọn vào cùng một ảnh × R lần lặp.",
  },
];

const FORMAT_OPTIONS: Array<{ value: OutputFormat; label: string }> = [
  { value: "png", label: "PNG (Không nén mất dữ liệu)" },
  { value: "jpg", label: "JPG (Nhẹ, nén có kiểm soát)" },
  { value: "webp", label: "WEBP (Hiện đại, tối ưu dung lượng)" },
];

export function SettingsPanel() {
  const { state, dispatch } = useAppStore();

  const currentModeInfo = MODE_OPTIONS.find((m) => m.value === state.mode) || MODE_OPTIONS[0];

  const randomizeSeed = () => {
    const rnd = Math.floor(100_000 + Math.random() * 900_000_000);
    dispatch({ type: "SET_SEED_INPUT", payload: String(rnd) });
  };

  return (
    <section
      aria-label="Cấu hình tạo ảnh"
      className="bg-surface-1 border border-border rounded-lg p-4 flex flex-col gap-3.5"
    >
      <h2 className="text-md font-semibold text-text">Cấu hình</h2>

      {/* Mode Selection */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="setting-mode" className="text-xs font-medium text-text">
          Chế độ tạo biến thể
        </label>
        <Select
          id="setting-mode"
          label="Chế độ tạo biến thể"
          value={state.mode}
          options={MODE_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
          onChange={(val) => dispatch({ type: "SET_MODE", payload: val })}
        />
        <p className="text-2xs text-muted leading-relaxed">{currentModeInfo.desc}</p>
      </div>

      {/* Mode-specific counts */}
      {state.mode === "mix" ? (
        <>
          <Slider
            id="setting-mix-count"
            label="Số lượng ảnh cần tạo (N)"
            value={state.count}
            min={1}
            max={100}
            step={1}
            unit="ảnh"
            onChange={(val) => dispatch({ type: "SET_COUNT", payload: val })}
          />

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text">Số hiệu ứng ghép mỗi ảnh (k)</span>
              <span className="text-2xs text-subtle num">
                {state.kRange[0]} – {state.kRange[1]} hiệu ứng
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <label htmlFor="setting-k-min" className="text-2xs text-muted shrink-0">
                  Từ
                </label>
                <input
                  id="setting-k-min"
                  type="number"
                  min={1}
                  max={10}
                  value={state.kRange[0]}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) {
                      dispatch({
                        type: "SET_K_RANGE",
                        payload: [v, Math.max(v, state.kRange[1])],
                      });
                    }
                  }}
                  className="w-full h-7 px-2 rounded-sm bg-surface-2 border border-border text-xs num text-text"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="setting-k-max" className="text-2xs text-muted shrink-0">
                  Đến
                </label>
                <input
                  id="setting-k-max"
                  type="number"
                  min={1}
                  max={10}
                  value={state.kRange[1]}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) {
                      dispatch({
                        type: "SET_K_RANGE",
                        payload: [Math.min(state.kRange[0], v), v],
                      });
                    }
                  }}
                  className="w-full h-7 px-2 rounded-sm bg-surface-2 border border-border text-xs num text-text"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <Slider
          id="setting-repeats"
          label="Số lần lặp (R)"
          value={state.repeats}
          min={1}
          max={20}
          step={1}
          unit="lần"
          onChange={(val) => dispatch({ type: "SET_REPEATS", payload: val })}
        />
      )}

      {/* Seed */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="setting-seed" className="text-xs font-medium text-text">
            Hạt giống ngẫu nhiên (Seed)
          </label>
          {state.lastUsedSeed !== null && (
            <button
              type="button"
              title="Bấm để cố định seed của lần chạy gần nhất"
              onClick={() =>
                dispatch({ type: "SET_SEED_INPUT", payload: String(state.lastUsedSeed) })
              }
              className="text-2xs font-mono num text-accent hover:underline cursor-pointer"
            >
              Vừa dùng: {state.lastUsedSeed}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            id="setting-seed"
            type="number"
            placeholder="Để trống = ngẫu nhiên"
            value={state.seedInput}
            onChange={(e) => dispatch({ type: "SET_SEED_INPUT", payload: e.target.value })}
            className="flex-1 h-8 px-2.5 rounded-sm bg-surface-2 border border-border text-xs font-mono num text-text placeholder:text-subtle"
          />
          <IconButton label="Sinh số Seed ngẫu nhiên" onClick={randomizeSeed}>
            <Dices className="w-4 h-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {/* Max side downscale */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border">
        <Toggle
          id="setting-max-side-toggle"
          label="Thu nhỏ cạnh lớn nhất"
          description="Tăng tốc xử lý cho ảnh độ phân giải cao"
          checked={state.maxSideEnabled}
          onChange={(checked) => dispatch({ type: "SET_MAX_SIDE_ENABLED", payload: checked })}
        />
        {state.maxSideEnabled && (
          <Slider
            id="setting-max-side"
            label="Kích thước cạnh tối đa"
            value={state.maxSide}
            min={512}
            max={4096}
            step={64}
            unit="px"
            onChange={(val) => dispatch({ type: "SET_MAX_SIDE", payload: val })}
          />
        )}
      </div>

      {/* Format & Quality */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border">
        <div className="flex flex-col gap-1">
          <label htmlFor="setting-format" className="text-xs font-medium text-text">
            Định dạng ảnh đầu ra
          </label>
          <Select
            id="setting-format"
            label="Định dạng ảnh đầu ra"
            value={state.format}
            options={FORMAT_OPTIONS}
            onChange={(val) => dispatch({ type: "SET_FORMAT", payload: val })}
          />
        </div>

        {(state.format === "jpg" || state.format === "webp") && (
          <Slider
            id="setting-quality"
            label="Chất lượng nén"
            value={state.quality}
            min={10}
            max={100}
            step={1}
            unit="%"
            onChange={(val) => dispatch({ type: "SET_QUALITY", payload: val })}
          />
        )}
      </div>
    </section>
  );
}
