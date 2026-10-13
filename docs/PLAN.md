# Aug Lab — PLAN (single source of truth)

> Read this first. Don't re-derive. Tick boxes as work lands. Effects data: `python/catalog.json` (never hand-edit lists).

## 0. Notes distilled from the guide
- Augraphy models document degradation in 3 phases, applied in order: **ink → paper → post**.
  - ink: what happens to ink on paper (bleed-through, low-ink lines, ink shifter, dithering, letterpress…).
  - paper: paper texture/color (noise textures, color paper, watermark, brightness texture, stains…).
  - post: after printing/capture (bad photocopy, folding, book binding, lighting gradient, JPEG, markup, shadows…).
- Phases are wrapped by `AugraphyPipeline(ink_phase=[…], paper_phase=[…], post_phase=[…])`; call `pipeline(image)` → image.
- Albumentations runs **after** Augraphy (`A.Compose([...])(image=rgb)["image"]`) for camera/scan/geometry effects.
- Augraphy expects BGR/gray uint8 (OpenCV); Albumentations expects RGB uint8 → convert at the boundary.
- Each Augraphy aug has `p`; to force an explicit effect use `p=1` (and `force=True` on direct call).
- Numba-jitted Augraphy augs are slow on first call → warm up once per worker.
- The guide's code uses **legacy API names** (old Albumentations 1.x args such as `always_apply`, `var_limit`, `alpha_affine`;
  old Augraphy names). **TRUST the installed versions + `python/catalog.json`**, not the guide's snippets.
- Installed: see `docs/VERSIONS.md` (albumentations 2.x uses pydantic `InitSchema`; bad args raise `ValueError`).
- Some effects need a quick-fix constructor arg → `fix_args` in catalog; worker MUST merge `fix_args` under user params.
- Guide source file was not present in the workspace at Prompt 1 time; `docs/ref-guide.md` is reserved for it.

## 1. Architecture

Production on Vercel keeps Next.js as the UI and request coordinator. The browser uploads source images directly to a private Vercel Blob store (up to 25 MB); `app/api/generate` plans work and invokes `api/py-worker.py` for each task. Python Functions run the existing engine and store original/results/thumbnails in private Blob. `/api/result` streams those blobs back. Configure a private Blob store for the project so Vercel provides `BLOB_READ_WRITE_TOKEN`. Local development continues to use the persistent `.venv` worker pool below.

```text
Browser → private Blob upload → Next.js API (plan + NDJSON progress)
                                   └→ Vercel Python Function → Python engine → private Blob
```

Each Python task runs in its own invocation because Vercel Functions do not share a persistent worker process or filesystem. A generation request is capped by the configured Vercel function duration; large jobs can reach the platform's maximum.

```
Browser (one page, React client state)
  │ fetch / NDJSON stream
Next route handlers (app/api/*, export const runtime="nodejs", dynamic="force-dynamic")
  │ lib/server/pool.ts  — pool of persistent Python workers
  │ stdin/stdout JSON-lines (one JSON object per line, UTF-8)
python/worker.py  ×N  (imports cv2/augraphy/albumentations once, numba warm-up at start)
  │ images exchanged as FILES in  os.tmpdir()/aug-lab/<jobId>/   (never base64 over stdio,
  │ never inside the project folder)
```
- Pool size = `max(1, min(4, cpus-1))`, lazily created on first request, kept on `globalThis` (survives HMR).
- Python exe: `.venv/Scripts/python.exe` (win32) else `.venv/bin/python`.
- Protocol (request): `{"id","op":"run","job","input","out","lib","name","params","seed","format","quality"}`;
  ops: `ping`, `warmup`, `run`, `chain` (list of steps), `shutdown`.
- Protocol (response): `{"id","ok":true,"out","ms","w","h","changed"}` | `{"id","ok":false,"error","trace?"}`; worker
  prints `{"ready":true,"versions":{…}}` once after warm-up. stderr → server log only.
- Per-task timeout **90 s** → kill worker, respawn, report task error; job continues.
- Cancel: job flag checked before dispatch; in-flight tasks of a cancelled job → kill+respawn those workers.
- Temp: on server start delete `aug-lab/*` older than 1 h; TTL sweep every 10 min; job dir removed after TTL 1 h.
- Augraphy effects run inside `AugraphyPipeline` (correct phase slot); Albumentations via `A.Compose(seed=…)`.

## 2. API contracts
| Route | Method | In | Out |
|---|---|---|---|
| `/api/catalog` | GET | – | catalog.json (effects, versions, phase_order) |
| `/api/generate` | POST | multipart: `image` (file), `job` (JSON) | NDJSON stream |
| `/api/result/[job]/[id]` | GET | `?thumb=1` optional | image bytes (correct Content-Type, no-store) |
| `/api/cancel` | POST | `{"jobId"}` | `{"ok":true}` |

- Validate: type ∈ png/jpg/jpeg/webp/bmp/tiff (magic bytes + mime), size ≤ **25 MB** → 400/413 JSON `{error}` (Vietnamese).
- Optional downscale: max side default **1600** px, toggle off = original size.
- `job` JSON: `{mode:"each"|"mix"|"chain", effects:[{id, params}], repeats, count, kRange:[min,max], seed, maxSide|null,
  format:"png"|"jpg"|"webp", quality}`.
- NDJSON events (one per line):
  - `{type:"start", jobId, total, original:{url,w,h}}`
  - `{type:"progress", done, total, etaMs}`
  - `{type:"result", id, effects:[ids], label, url, thumbUrl, ms, path}` (path = path inside output folder)
  - `{type:"error", id?, effect?, message}` (per-effect; never aborts job)
  - `{type:"done", jobId, ok, failed, ms, manifest}`
- `[job]`/`[id]` validated with `^[a-zA-Z0-9_-]+$` (no path traversal).

## 3. Generation modes
- [x] **Each alone**: every selected effect × repeats R (R default 1).
- [x] **Random mix**: N variants; each picks k ∈ [kMin,kMax] random selected effects; Augraphy ordered ink→paper→post
      first, Albumentations after. Label `A+B+C`.
- [x] **Fixed chain**: user-ordered list, R repeats (different seeds per repeat).
- [x] **Presets** (prebuilt pool + mode): Scan, Fax, Photocopy, Phone photo (Ảnh chụp điện thoại), Aged paper (Giấy cũ),
      Ink damage (Hỏng mực), Heavy (Nặng). Defined in `lib/presets.ts` by effect *names*, filtered to `status==="ok"`.
- [x] **Generate ALL** one-click = every `ok` effect alone, R=1.
- [x] Seed field (number; blank → random, shown after run). Same seed + same job = same output.
- [x] Explicit effects run with `p=1`.
- [x] Param editor from catalog schema: int/float → slider+number; range → two inputs; bool → toggle; choice → select;
      str → text; json → textarea (validated JSON). "Reset" per effect. Required params pre-filled from `fix_args`.
- [x] Failures listed in "Lỗi" panel with effect + reason; job keeps going.

## 4. Output
- Formats: PNG / JPG (quality 1–100, default 92) / WEBP (quality).
- Folder layout:
```
<name>_augmented/
  original.<ext>
  augraphy/<Effect>/<Effect>_001.<ext>
  albumentations/<Effect>/<Effect>_001.<ext>
  mix/mix_001__A+B.<ext>
  chain/chain_001__A+B+C.<ext>
  manifest.json   # seed, mode, effects, params, timings, versions, failures
```
- Download ZIP (jszip, client-side, streamed from `/api/result`), and **Lưu vào thư mục** via File System Access API
  (`showDirectoryPicker`), fallback to ZIP when unsupported. Download selected or all.

## 5. UI spec (one page, Vietnamese)
- Header: logo "Aug Lab", versions chip, theme toggle (Sun/Moon), help.
- Left column: **Dropzone** (drag-drop, click to pick, Ctrl+V paste anywhere, preview, file info: name/size/WxH/type,
  Replace/Clear) + **Settings** (mode, repeats/count/k range, seed, max side toggle, format+quality).
- Center: **Effect picker** tabs: `Presets | Augraphy [Mực/Giấy/Hậu kỳ] | Albumentations [Pixel/Hình học] | Chuỗi`;
  search; per-group select all/none; status badge (ok / không hỗ trợ / chậm when avg_ms>1500); tooltip = doc;
  gear → param popover. Chain tab: ordered list with up/down/remove.
- Right / bottom: **Results gallery**: lazy thumbs (`loading="lazy"`, `/api/result?thumb=1`), effect label, ms;
  click → **Lightbox** with before/after slider, prev/next, keyboard (←/→/Esc); per-item select checkbox / delete.
- Sticky **action bar**: Generate (Tạo ảnh), progress bar + `done/total` + ETA, Cancel (Huỷ), Download (Tải về ▾).
- Responsive: 390 (stacked: dropzone → picker → gallery, action bar fixed bottom), 768 (2 cols), 1280 (3 cols).
- Empty states: no image, no effects selected, no results; error states: invalid file, worker crash, all failed.

## 6. File tree (target)
```
app/
  layout.tsx  page.tsx  globals.css
  api/catalog/route.ts  api/generate/route.ts  api/result/[job]/[id]/route.ts  api/cancel/route.ts
components/
  Header.tsx Dropzone.tsx SettingsPanel.tsx EffectPicker.tsx EffectRow.tsx ParamEditor.tsx ChainEditor.tsx
  PresetGrid.tsx ResultsGallery.tsx ResultTile.tsx Lightbox.tsx BeforeAfter.tsx ActionBar.tsx FailedPanel.tsx
  ui/ (Button IconButton Badge Tabs Checkbox Slider Select Toggle Popover Modal Toast ProgressBar EmptyState)
lib/
  types.ts catalog.ts presets.ts jobPlan.ts (expand modes → task list, seeded RNG) download.ts (zip + FS API)
  server/ pool.ts worker.ts tmp.ts validate.ts paths.ts
python/
  worker.py  build_catalog.py  smoke.py  catalog.json
scripts/ensure-env.mjs
docs/ PLAN.md DESIGN_SYSTEM.md VERSIONS.md ref-guide.md
.agent/skills/{aug-catalog,py-worker-bridge,ui-design-system,qa-verify}/SKILL.md  .agent/rules/project.md  AGENTS.md
```

## 7. Prompt 1 — Foundation (this prompt)
- [x] Next.js App Router + TS + Tailwind v4 + ESLint scaffold, port 3002, `predev` env guard
- [x] Deps: jszip, lucide-react; system font stack (offline)
- [x] vendor/augraphy + vendor/albumentations cloned, editable installs in `.venv` (Python 3.12)
- [x] Exactly one OpenCV wheel (opencv-python-headless 4.x); imports verified; docs/VERSIONS.md
- [x] `python/build_catalog.py` + `python/smoke.py` → `python/catalog.json`
- [x] `scripts/ensure-env.mjs` self-heal (<1 s fast path)
- [x] docs/PLAN.md, docs/DESIGN_SYSTEM.md + tokens in app/globals.css
- [x] Skills + AGENTS.md + .agent/rules/project.md
- [x] Placeholder page returns 200 on :3002
- [ ] docs/ref-guide.md (guide file was not provided in workspace)

## 8. Prompt 2 — Build tasks
### P1 Python worker + pool
- [x] `python/worker.py`: JSONL loop, `ready` handshake, numba warm-up (run 1 tiny Augraphy aug), ops run/chain/ping
- [x] load image (cv2.imdecode from file, IMREAD_COLOR; keep alpha out), downscale, apply, save format/quality
- [x] Augraphy via `AugraphyPipeline` in phase slot; Albumentations via `A.Compose(seed)`; merge `fix_args`; p=1
- [x] float outputs → uint8; grayscale → keep 1ch; thumbnail (max 320 px webp) per result
- [x] `lib/server/pool.ts`: spawn N, queue, 90 s timeout → kill/respawn, cancel by jobId, crash → respawn
- [x] `lib/server/tmp.ts`: `os.tmpdir()/aug-lab/<jobId>`, startup cleanup + TTL 1 h sweep
### P2 API routes
- [x] `/api/catalog` (cached read), `/api/generate` (validate, plan, NDJSON stream, ETA), `/api/result`, `/api/cancel`
- [x] Error JSON in Vietnamese; request abort → cancel job
### P3 State + catalog UI
- [x] `lib/types.ts` from catalog schema; client store (useReducer + context), persisted settings (localStorage)
- [x] EffectPicker tabs/subgroups, search, select all/none, badges, doc tooltip
### P4 Dropzone / paste
- [x] drag-drop, click, Ctrl+V (window paste listener), preview, info, replace/clear, client-side type/size check
### P5 Modes / presets / params
- [x] Settings panel; `lib/jobPlan.ts` deterministic expansion (seeded PRNG mulberry32); presets; Generate ALL
- [x] ParamEditor generated from schema; chain editor
### P6 Gallery / lightbox
- [x] streamed results appear live; lazy thumbs; select/delete; lightbox with before/after slider + keyboard
### P7 Download
- [x] ZIP (selected/all) with folder layout + manifest.json; File System Access "save to folder" + fallback
### P8 Polish / a11y / states
- [x] empty + error states, toasts, failed panel, focus management (modal trap, return focus), aria labels,
      reduced motion, responsive 390/768/1280, light/dark toggle, Vietnamese microcopy review

## 9. Definition of done
- [x] `npm run dev` on clean clone self-heals env and serves :3002
- [x] Drop/paste/pick image → Generate ALL produces one output per `ok` effect; failures listed, job completes
- [x] All 3 modes + 7 presets + seed reproducibility verified
- [x] ZIP and Save-to-folder produce the documented layout with manifest.json
- [x] Cancel stops work within 2 s; a hung effect is killed at 90 s and the worker respawns
- [x] No temp files inside project; tmp cleaned after 1 h
- [x] `npm run lint` and `npx tsc --noEmit` clean; no console errors; AA contrast; keyboard-only usable

