---
name: ui-design-system
description: Rules for building UI in this app (darkroom/technical-lab design system, tokens in app/globals.css, Vietnamese microcopy). Use for any component, layout, styling or copy work.
---
# ui-design-system

Full spec: `docs/DESIGN_SYSTEM.md`. Tokens: `app/globals.css`. Read the relevant section, don't re-invent.

## Hard rules
- Colors only via token utilities: `bg-bg|surface-1|surface-2|surface-3`, `border-border|border-strong`,
  `text-text|muted|subtle`, `bg-accent text-accent-fg`, `bg-accent-soft`, `text-success|danger|info`, `bg-*-soft`.
  No raw hex, no Tailwind palette colors (`zinc-800`, `amber-500`…), no gradients.
- ONE warm accent (amber) = primary action, selection, focus, progress. One primary button per area.
- Spacing on the 4px scale (`p-1`=4px … `p-6`=24px). Radius `rounded-sm|md|lg|xl`. Shadows `shadow-sm|md|lg|overlay`.
- Z-index only `z-sticky|dropdown|popover|overlay|modal|toast`.
- Numbers (counts, ms, px, sizes, ETA, %) get class `num` (tabular numerals).
- Motion: `transition-ui` (≤200ms), animate opacity/transform only; reduced-motion handled globally — don't override.
- Focus: keep the global `:focus-visible` ring; custom controls must be focusable and keyboard-operable.
- Icons: `lucide-react` only, 16px in controls; icon-only buttons need `aria-label` + `title` in Vietnamese.
- No UI libraries, no web fonts, no images from the network (offline app).
- Theme: `html[data-theme]` + `localStorage["aug-theme"]`; absent → system. Test both themes.

## Components
Button, IconButton, Chip/Badge, Tabs, Checkbox row, Slider, Select, Toggle, Popover, Modal/Lightbox, Toast,
ProgressBar, Dropzone, ResultTile, EmptyState — sizes/states in DESIGN_SYSTEM.md §Components. Put primitives in
`components/ui/`, compose features in `components/`. Every interactive element: hover, active, focus-visible, disabled,
loading states.

## A11y
- Native elements first (`button`, `input[type=range|checkbox]`, `select`). Tabs: `role=tablist` + arrow keys.
- Modal: focus trap, Esc, restore focus. Toggle: `role=switch aria-checked`. Progress: `role=progressbar`.
- AA contrast; don't put `text-subtle` on `surface-3` for body text.

## Copy (Vietnamese, short, direct, no "!")
"Tạo ảnh", "Tạo tất cả", "Huỷ", "Tải ZIP", "Lưu vào thư mục", "Chưa có ảnh", "Không hỗ trợ", "Đang tạo… 12/80".
Errors = what happened + what to do. Effect/library names stay in English.
