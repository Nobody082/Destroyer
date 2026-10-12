# AGENTS.md — Aug Lab

**State lives in `docs/PLAN.md`. Read it first; don't re-derive. Tick boxes when done.**

## Stack
- Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 (no `src/`, alias `@/*`), npm. UI deps: jszip, lucide-react only.
- Python 3.12 `.venv` (win `.venv/Scripts/python.exe`, else `.venv/bin/python`): augraphy + albumentations (editable from
  `vendor/`), numba, numpy, pillow, opencv-python-headless 4.x (exactly one OpenCV wheel).
- Python runs as persistent child workers spawned by route handlers (JSONL over stdio, images via `os.tmpdir()/aug-lab`).
- Single page, Vietnamese UI, offline (system fonts), no DB/auth/separate server. Port **3002**.

## Commands
- `npm run dev` — the ONLY way to start (predev runs `scripts/ensure-env.mjs`, self-heals env + catalog).
- `npm run catalog` — rebuild `python/catalog.json` (introspection + smoke). `npm run setup:env` — force env setup.
- `npx tsc --noEmit`, `npm run lint` — must be clean.

## Key files
- `docs/PLAN.md` (plan/status), `docs/DESIGN_SYSTEM.md` + `app/globals.css` (tokens), `docs/VERSIONS.md`.
- `python/catalog.json` = truth for effects/params (never hand-write lists). Guide snippets use legacy APIs.
- Skills: `.agent/skills/{aug-catalog,py-worker-bridge,ui-design-system,qa-verify}`.

## Token rules
- No narration, no restating the task. Batch several file writes per step.
- Never open big files; use head/grep/wc. Never read library source: use Python introspection scripts only.
- Read `docs/ref-guide.md` at most once per session. Final replies ≤ 10 lines.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
