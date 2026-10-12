---
name: py-worker-bridge
description: Protocol and rules for the Node <-> Python worker pool (JSON-lines over stdin/stdout, temp-file image exchange, timeout/cancel/respawn). Use when writing or debugging python/worker.py, lib/server/pool.ts, or /api/generate.
---
# py-worker-bridge

## Process model
- Route handlers: `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`
- Pool on `globalThis.__augPool` (survives HMR). Size `max(1, min(4, os.cpus().length - 1))`. Lazy start.
- Spawn: `.venv/Scripts/python.exe` (win32) or `.venv/bin/python`, args `["-u", "python/worker.py"]`, cwd = project root,
  env `PYTHONIOENCODING=utf-8`, `PYTHONUNBUFFERED=1`, `NO_ALBUMENTATIONS_UPDATE=1`. `windowsHide: true`.
- Worker imports libs once, warms Numba (one tiny Augraphy aug), then prints `{"ready":true,"versions":{...}}`.

## Protocol (one JSON object per line, UTF-8, `\n`)
- Request: `{"id","op":"run"|"chain"|"ping"|"shutdown","job","input","out","thumb","steps":[{"lib","name","params"}],
  "seed","format":"png"|"jpg"|"webp","quality","maxSide"}` (`run` = chain of 1 step).
- Response: `{"id","ok":true,"out","thumb","ms","w","h","changed"}` or `{"id","ok":false,"error","trace"}`.
- stdout is protocol ONLY: redirect stray prints (`sys.stdout = sys.stderr` inside apply; write responses via saved fd).
- Never send image bytes/base64 over stdio. Read lines with a buffered splitter (chunks may split lines).

## Files
- Root: `path.join(os.tmpdir(), "aug-lab", jobId)` — never inside the project. `input.<ext>`, `res/<id>.<fmt>`, `thumb/<id>.webp`.
- Startup: delete `aug-lab/*` with mtime > 1 h; sweep every 10 min. Validate ids `^[a-zA-Z0-9_-]+$`.

## Execution rules
- Merge order: `{...effect.fix_args, ...userParams, p: 1}`. Augraphy: BGR uint8, inside `AugraphyPipeline` phase slot;
  Albumentations: RGB, `A.Compose([...], seed=seed)`. Chain/mix: Augraphy (ink→paper→post) first, then Albumentations.
- Seed per task = `hash(jobSeed, taskIndex)`; set `random.seed`, `np.random.seed`, Compose seed.
- Float output → uint8 (×255 if max ≤ 1); keep 1-channel; save via `cv2.imencode` (+ `IMWRITE_JPEG_QUALITY`/`WEBP`).

## Timeout / cancel / respawn
- Per task 90 s timer → `child.kill()` (win: `taskkill /pid <pid> /T /F` fallback), reject task with "Quá thời gian (90s)",
  spawn replacement, continue queue. Exit/crash mid-task → same path.
- Cancel(jobId): drop queued tasks of job; kill+respawn workers busy with that job; stream `{type:"done", cancelled:true}`.
- Client disconnect (`request.signal` abort) = cancel.
- Debug: `echo {"id":"1","op":"ping"} | .venv/Scripts/python python/worker.py`.
