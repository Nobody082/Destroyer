---
name: aug-catalog
description: Regenerate, validate and interpret python/catalog.json (Augraphy + Albumentations effect catalog built by introspection + smoke test). Use when effects are missing/wrong, after upgrading a vendor lib, or when marking an effect unsupported.
---
# aug-catalog

## Regenerate
- Full: `npm run catalog` (= `node scripts/ensure-env.mjs --catalog`) or `.venv/Scripts/python python/build_catalog.py` (Win) / `.venv/bin/python python/build_catalog.py`.
- Introspection only (fast, ~3 s): add `--no-smoke`. Smoke only / subset: `python python/smoke.py [--only A,B]`.
- Smoke = isolated subprocess per effect, synthetic 800x1000 doc, p=1, 60 s timeout, parallel (cpus-1, max 8). ~1-2 min.

## Schema (`catalog.json`)
- top: `schema, versions{python,numpy,opencv,numba,augraphy,albumentations}, phase_order, effects[], excluded[], smoke{}`
- effect: `id` (`augraphy.Name` / `albumentations.Name`), `lib`, `name`, `phase` (augraphy: ink|paper|post) or
  `category` (albumentations: pixel|spatial), `doc`, `params[]`, `status` ok|unsupported, `reason`, `avg_ms`, `changed`,
  optional `fix_args` (constructor kwargs REQUIRED to run; worker merges them under user params), `phase_source`.
- param: `{name, kind: int|float|bool|str|choice|range|json, default, choices?, numeric? (range: int|float), required?}`.

## Rules
- Never hand-write effect lists. Discovery: concrete subclasses exposed on the public module (`augraphy.X`, `A.X`).
- Augraphy phase comes from `default_augraphy_pipeline()` ink/paper/post lists; not found → `post` (`phase_source: fallback`).
- Excluded (not in `effects`, listed in `excluded` with reason): containers (Compose/OneOf/…/Lambda/Function/Interop),
  transforms needing bboxes/masks/keypoints/metadata/reference or foreground images, 3D volume transforms.
- `changed:false` is informational (identity defaults like Affine) — still `ok`.

## Mark unsupported / fix an effect
1. Reproduce: `python python/smoke.py --only Name`.
2. If it needs an arg: add ONE entry to `QUICK_FIX` in `python/smoke.py` (`"Name": {kw: value}`), rerun `--only Name`.
3. If it can't work standalone: add the name to `ALB_DATA_DEPENDENT` / `AUG_CONTAINERS` in `build_catalog.py` (excluded),
   or leave it failing → smoke records `status: unsupported` + reason. UI hides/greys unsupported effects.
4. Validate: `python -c "import json;c=json.load(open('python/catalog.json'));print(len(c['effects']))"`.
