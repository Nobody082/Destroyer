import type { CatalogEffect, GenerationMode } from "./types";

export interface PresetDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  mode: GenerationMode;
  repeats: number;
  count: number;
  kRange: [number, number];
  effectNames: string[];
}

export const PRESETS: PresetDefinition[] = [
  {
    id: "scan",
    title: "Scan",
    subtitle: "Bản quét tài liệu",
    description: "Mô phỏng tài liệu qua máy scan văn phòng với vệt sáng, nhiễu hạt nhẹ và lệch góc nhỏ.",
    mode: "mix",
    repeats: 1,
    count: 8,
    kRange: [2, 3],
    effectNames: [
      "LightingGradient",
      "NoiseTexturize",
      "BrightnessTexturize",
      "SubtleNoise",
      "DirtyRollers",
      "GaussNoise",
      "ImageCompression",
      "Rotate",
    ],
  },
  {
    id: "fax",
    title: "Fax",
    subtitle: "Bản gửi Fax",
    description: "Hiệu ứng bản truyền fax đen trắng, sọc mực đứt nét, dithering và giảm chất lượng.",
    mode: "mix",
    repeats: 1,
    count: 8,
    kRange: [2, 3],
    effectNames: [
      "Faxify",
      "LowInkPeriodicLines",
      "LowInkRandomLines",
      "Dithering",
      "Letterpress",
      "Downscale",
      "Posterize",
    ],
  },
  {
    id: "photocopy",
    title: "Photocopy",
    subtitle: "Bản sao chụp",
    description: "Bản photocopy nhiều thế hệ với bụi trống từ, viền đen, nhoè mực và tương phản gắt.",
    mode: "mix",
    repeats: 1,
    count: 8,
    kRange: [2, 3],
    effectNames: [
      "BadPhotoCopy",
      "DirtyDrum",
      "DirtyRollers",
      "Hollow",
      "LowLightNoise",
      "BleedThrough",
      "RandomToneCurve",
    ],
  },
  {
    id: "phone_photo",
    title: "Ảnh chụp điện thoại",
    subtitle: "Phone photo",
    description: "Ảnh chụp bằng camera cầm tay có bóng đổ, biến dạng phối cảnh, nhoè chuyển động và lệch sáng.",
    mode: "mix",
    repeats: 1,
    count: 10,
    kRange: [2, 4],
    effectNames: [
      "ShadowCast",
      "AmbientLighting",
      "LightingGradient",
      "BookBinding",
      "Perspective",
      "MotionBlur",
      "Defocus",
      "ColorJitter",
      "ISONoise",
      "OpticalDistortion",
    ],
  },
  {
    id: "aged_paper",
    title: "Giấy cũ",
    subtitle: "Aged paper",
    description: "Tài liệu lưu trữ lâu năm với giấy ố vàng, nếp gấp, vết bẩn, đóng dấu và sợi giấy sần.",
    mode: "mix",
    repeats: 1,
    count: 10,
    kRange: [2, 4],
    effectNames: [
      "ColorPaper",
      "DelaunayTessellation",
      "NoiseTexturize",
      "BrightnessTexturize",
      "Folding",
      "PageBorder",
      "WaterMark",
      "VoronoiTessellation",
      "Sepia",
    ],
  },
  {
    id: "ink_damage",
    title: "Hỏng mực",
    subtitle: "Ink damage",
    description: "Mực in bị loang, thấm ngược từ mặt sau, lệch bản in, mất nét hoặc bị ghi chú đè lên.",
    mode: "mix",
    repeats: 1,
    count: 8,
    kRange: [2, 3],
    effectNames: [
      "InkBleed",
      "BleedThrough",
      "InkShifter",
      "InkMottling",
      "LowInkPeriodicLines",
      "LowInkRandomLines",
      "Letterpress",
      "Markup",
      "Scribbles",
    ],
  },
  {
    id: "heavy",
    title: "Nặng",
    subtitle: "Heavy degradation",
    description: "Kết hợp đa tầng các hiệu ứng xuống cấp nặng từ mực, nền giấy đến quang học và hình học.",
    mode: "mix",
    repeats: 1,
    count: 12,
    kRange: [3, 5],
    effectNames: [
      "BadPhotoCopy",
      "InkBleed",
      "BleedThrough",
      "DirtyDrum",
      "Folding",
      "ShadowCast",
      "LightingGradient",
      "NoiseTexturize",
      "Markup",
      "Perspective",
      "GaussNoise",
      "MotionBlur",
      "ImageCompression",
    ],
  },
];

export function resolvePresetEffects(
  preset: PresetDefinition,
  allEffects: CatalogEffect[]
): CatalogEffect[] {
  const okEffects = allEffects.filter((e) => e.status === "ok");
  const byName = new Map<string, CatalogEffect>();
  for (const eff of okEffects) {
    // Prefer augraphy if name collides, or store first match
    if (!byName.has(eff.name) || eff.lib === "augraphy") {
      byName.set(eff.name, eff);
    }
  }

  const matched: CatalogEffect[] = [];
  for (const name of preset.effectNames) {
    const found = byName.get(name);
    if (found) {
      matched.push(found);
    }
  }

  // Fallback if catalog subset has fewer matches
  if (matched.length === 0 && okEffects.length > 0) {
    return okEffects.slice(0, Math.min(6, okEffects.length));
  }
  return matched;
}
