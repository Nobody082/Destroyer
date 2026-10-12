---
name: qa-verify
description: Verification commands and acceptance checklist for Aug Lab (env, catalog, API, UI, downloads). Use before declaring any phase done, and for Prompt 3 QA.
---
# qa-verify

## Commands (run from repo root; Windows paths shown, use `.venv/bin/python` on macOS/Linux)
- Env fast check: `node scripts/ensure-env.mjs` (must exit 0 in < 1 s); deep: `node scripts/ensure-env.mjs --deep`.
- Imports: `.venv\Scripts\python -c "import cv2, augraphy, albumentations; print(cv2.__version__)"`.
- One OpenCV wheel: `.venv\Scripts\python -m pip list | findstr /i opencv` → only `opencv-python-headless`.
- Catalog: `.venv\Scripts\python python\smoke.py --only GaussNoise,InkBleed` (subset) / `npm run catalog` (full).
- Types + lint: `npx tsc --noEmit` and `npm run lint` (0 errors).
- Dev: `npm run dev` → `curl -s -o NUL -w "%{http_code}" http://localhost:3002/` = 200. Stop the server afterwards.
- API: `curl http://localhost:3002/api/catalog`;
  `curl -N -F image=@test.png -F "job={\"mode\":\"each\",\"effects\":[{\"id\":\"albumentations.Blur\"}],\"repeats\":1}" http://localhost:3002/api/generate`.
- Worker: `echo {"id":"1","op":"ping"} | .venv\Scripts\python python\worker.py`.

## Checklist
- [ ] Clean clone: delete `.venv` + `python/catalog.json` → `npm run dev` self-heals and serves :3002.
- [ ] Upload via drag-drop, click, Ctrl+V; reject >25 MB and non-image with Vietnamese message.
- [ ] Generate ALL: one result per `ok` effect; failures in "Lỗi" panel; job finishes; progress + ETA move.
- [ ] Each alone ×R, Random mix (N, k range, order ink→paper→post→albumentations), Fixed chain ×R.
- [ ] All 7 presets run. Same seed → identical outputs (compare hashes); blank seed → shown after run.
- [ ] Param editor: every kind (int/float/range/bool/choice/str/json) round-trips into worker params.
- [ ] Cancel stops within 2 s; simulated hang (sleep effect) killed at 90 s, worker respawns, next task runs.
- [ ] ZIP + Save-to-folder: layout `<name>_augmented/{original,augraphy,albumentations,mix,chain,manifest.json}`.
- [ ] Formats PNG/JPG/WEBP + quality honored; max-side downscale on/off.
- [ ] Temp only under `%TEMP%/aug-lab/<jobId>`; nothing written in the project; TTL cleanup works.
- [ ] UI at 390/768/1280, dark + light, keyboard-only flow, focus rings visible, reduced motion, no console errors.
- [ ] Lightbox: before/after slider (mouse + keys), ←/→, Esc, focus returns.
- [ ] Tick results in `docs/PLAN.md` §9.
