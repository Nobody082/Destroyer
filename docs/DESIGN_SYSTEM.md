# Design System — "darkroom / technical lab"

Tokens live in `app/globals.css` (CSS variables + Tailwind `@theme inline`). Never hard-code colors/sizes in components.

## Principles
- Dark-first neutral graphite surfaces; content (images) is the hero. Chrome stays quiet.
- **One warm accent** (safelight amber) for primary action, selection, focus, progress. Nothing else is warm.
- Dense but calm: technical labels, tabular numbers, 4px grid. No gradients, no glassmorphism, no decorative imagery.
- Icons: **lucide-react only**, 16px in controls, 20px in headers, `aria-hidden` when paired with text.
- Fonts: system stack (`font-sans`), `font-mono` for ids/params/paths. No web fonts (offline).

## Color tokens (Tailwind utility → var)
| Role | Utility | Dark | Light |
|---|---|---|---|
| App background | `bg-bg` | #0e0f11 | #f6f5f2 |
| Panel | `bg-surface-1` | #15171a | #ffffff |
| Raised / input | `bg-surface-2` | #1c1f23 | #efede8 |
| Hover / pressed | `bg-surface-3` | #252930 | #e5e2db |
| Hairline | `border-border` | #2e333a | #d8d4cb |
| Strong border | `border-border-strong` | #434a54 | #b3ada1 |
| Text | `text-text` | #ebe9e5 | #1b1a17 |
| Secondary text | `text-muted` | #a8a6a1 | #54514a |
| Tertiary / hints | `text-subtle` | #8c8a85 | #67635b |
| Accent | `bg-accent` / `text-accent` | #f2a03d | #b45309 |
| On accent | `text-accent-fg` | #1a1206 | #ffffff |
| Accent tint | `bg-accent-soft`, `border-accent-line` | 14% | 10% |
| Status | `text-success/danger/info` + `bg-*-soft` | desaturated | darker |

- Contrast (AA): text ≥ 4.5:1 on bg and surface-1/2 in both themes; `text-subtle` only for ≥ 12px secondary info.
- Theme: `html[data-theme="light"|"dark"]`; absent → `prefers-color-scheme`. Toggle stores `localStorage["aug-theme"]`.

## Scales
- Spacing: 4px base (`--spacing: 4px`): 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48.
- Radius: `rounded-xs` 2 · `-sm` 4 (chips, inputs) · `-md` 6 (buttons, tiles) · `-lg` 10 (panels, popovers) · `-xl` 14 (modal).
- Shadow: `shadow-sm` (tiles hover) · `-md` (popover) · `-lg` (toast) · `-overlay` (modal). Dark uses borders more than shadows.
- Z-index: `z-sticky` 10 · `z-dropdown` 20 · `z-popover` 30 · `z-overlay` 40 · `z-modal` 50 · `z-toast` 60.
- Type: `text-2xs` 11 · `xs` 12 · `sm` 13 · `base` 14 (body) · `md` 16 · `lg` 18 · `xl` 22 · `2xl` 28. Weights 400/500/600.
- Numbers (counts, ms, px, %, ETA, sizes): class `num` → tabular numerals. Units in `text-subtle`.
- Motion: `--dur-fast` 120ms (hover), `--dur-base` 160ms (popover/tabs), `--dur-slow` 200ms (modal) — max 200ms.
  Use `transition-ui`. Only opacity/transform animate. `prefers-reduced-motion` → effectively instant (global rule).
- Focus: `:focus-visible` → 2px accent outline, 2px offset. Never remove without replacement.

## Layout
- Header 52px; sticky action bar 64px (`z-sticky`, `bg-surface-1`, top border).
- ≥1280: 3 columns `320px | 1fr | 420px`; 768–1279: 2 columns (left+picker / gallery below); <768: single stack,
  action bar fixed bottom with safe-area padding. Panels `bg-surface-1 border border-border rounded-lg p-4`.
- Image surfaces use `checker` background so transparency/edges are visible.

## Components & states
Every interactive component: default · hover (`bg-surface-3`) · active (pressed, translateY 0.5px) · focus-visible ring ·
disabled (`opacity-50`, `cursor-not-allowed`, no hover) · loading (spinner `Loader2 animate-spin`, keeps width).

- **Button**: heights sm 28 / md 32 / lg 40; px 3/4/5; `rounded-md text-sm font-medium`.
  primary = `bg-accent text-accent-fg hover:bg-accent-hover`; secondary = `bg-surface-2 border-border`;
  ghost = transparent `hover:bg-surface-3`; danger = `text-danger hover:bg-danger-soft`. One primary per area.
- **IconButton**: square 28/32, ghost style, requires `aria-label` + `title` (Vietnamese).
- **Chip/Badge**: h-5, px-2, `text-2xs` uppercase-free, `rounded-sm`. Variants: neutral (`surface-2`/`muted`),
  accent (`accent-soft`/`accent`), success, danger ("Không hỗ trợ"), info ("Chậm"). Selectable chip = `aria-pressed`.
- **Tabs**: underline style; active = `text-text` + 2px accent bar; inactive `text-muted`; roving tabindex, ←/→ keys,
  `role=tablist/tab/tabpanel`. Sub-tabs are segmented control (`bg-surface-2`, active `bg-surface-3`).
- **Checkbox row**: full-row hit target h-9, checkbox 16px (`accent-color: var(--accent)`), name `text-sm`,
  doc `text-xs text-muted` truncated, right side: badges + gear IconButton. Selected row `bg-accent-soft`.
- **Slider**: native `input[type=range]` with `accent-color`; paired number input (w-16, `num`); shows min/max.
- **Select**: native `<select>` styled `bg-surface-2 border rounded-sm h-8 text-sm`, ChevronDown icon.
- **Toggle**: `role=switch` `aria-checked`, 32×18 track, off `surface-3`, on `accent`; label on the left.
- **Popover**: `bg-surface-1 border rounded-lg shadow-md p-3 z-popover`, max-w 360, closes on Esc/outside click,
  returns focus to trigger. Used for param editor.
- **Modal/Lightbox**: scrim `bg-scrim z-overlay`; panel `rounded-xl shadow-overlay z-modal`; focus trap; Esc closes;
  ←/→ navigate; before/after slider = draggable divider (keyboard ←/→ 5%), labels "Gốc" / "Kết quả".
- **Toast**: bottom-right (bottom-center on mobile), `z-toast`, auto-dismiss 4s (errors stay), `role=status`
  (`role=alert` for errors), max 3 stacked.
- **ProgressBar**: h-1.5 `bg-surface-3`, fill `bg-accent`, `role=progressbar aria-valuenow`; text `done/total · ETA`
  in `num`. Indeterminate = striped opacity pulse (disabled under reduced motion).
- **Dropzone**: dashed `border-2 border-border-strong rounded-lg` min-h 180, icon `ImagePlus`, copy
  "Kéo thả ảnh, bấm để chọn hoặc dán (Ctrl+V)". Drag-over: `border-accent bg-accent-soft`. Error: `border-danger`.
  Loaded: preview (contain, checker bg) + info row (`num`) + "Đổi ảnh" / "Xoá".
- **ResultTile**: aspect-square, `rounded-md border`, image `object-contain checker`; footer label (effect, `text-xs`
  truncate) + ms (`num text-subtle`); hover shows select checkbox + delete; selected = 2px accent ring.
  Skeleton while loading (surface-2 pulse).
- **EmptyState**: centered icon 32px `text-subtle`, title `text-md font-medium`, one line hint `text-muted`, optional
  single action button.

## Microcopy (Vietnamese — short, direct, no exclamation marks)
- Actions: "Tạo ảnh", "Tạo tất cả", "Huỷ", "Tải ZIP", "Lưu vào thư mục", "Chọn tất cả", "Bỏ chọn", "Đổi ảnh", "Xoá".
- Status: "Đang tạo… 12/80 · còn ~20 giây", "Xong 78 ảnh · 2 lỗi", "Không hỗ trợ", "Chậm".
- Errors: say what + what to do: "Ảnh quá lớn (tối đa 25 MB).", "Định dạng không hỗ trợ. Dùng PNG, JPG, WEBP, BMP, TIFF."
- Empty: "Chưa có ảnh", "Chưa chọn hiệu ứng", "Kết quả sẽ hiện ở đây".
- Use sentence case; keep library/effect names in English as-is.
