"""Smoke-test every catalog effect in an isolated subprocess (60s timeout).

    python python/smoke.py              # test all effects in python/catalog.json, update it in place
    python python/smoke.py --only Name1,Name2
    python python/smoke.py --one <lib> <Name> <img.png> '<kwargs-json>'   (internal)

Records per effect: status ok|unsupported, reason, avg_ms, changed, and `fix_args`
(constructor kwargs needed to make it run; the worker must apply them too).
Prints only counts + unsupported names.
"""
from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import tempfile
import time
import warnings
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
TIMEOUT = 60
MARK = "@@RESULT "

# One quick fix per effect, used only after the default construction failed.
# Keys: effect name -> constructor kwargs. Generic heuristics below cover required size args.
QUICK_FIX: dict[str, dict] = {
    "Crop": {"x_min": 0, "y_min": 0, "x_max": 600, "y_max": 800},
    "CropAndPad": {"percent": [-0.1, 0.1]},
    "GridElasticDeform": {"num_grid_xy": [4, 4], "magnitude": 10},
    "LongestMaxSize": {"max_size": 640},
    "SmallestMaxSize": {"max_size": 640},
}
GENERIC_REQUIRED = {
    "height": 512, "width": 512, "size": [512, 512], "max_size": 1024, "min_max_height": [600, 900],
    "crop_height": 512, "crop_width": 512, "x_max": 600, "y_max": 800, "x_min": 0, "y_min": 0,
    "pad_height_divisor": 32, "pad_width_divisor": 32, "scale": [0.5, 0.9], "min_height": 1024,
    "min_width": 1024, "target_size": [512, 512], "crop_size": [512, 512], "patch_size": [64, 64],
    "grid": [3, 3], "num_bits": 4, "interpolation": 1, "axes": "hw", "distortion_type": "radial",
}


def make_doc_image(path: Path, w: int = 800, h: int = 1000) -> Path:
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)

    def font(sz):
        try:
            return ImageFont.load_default(size=sz)
        except TypeError:
            return ImageFont.load_default()

    d.text((60, 40), "BÁO CÁO KIỂM THỬ / TEST REPORT", fill="black", font=font(30))
    d.line((60, 85, w - 60, 85), fill="black", width=2)
    rnd = random.Random(7)
    words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor".split()
    y = 110
    for _ in range(12):
        d.text((60, y), " ".join(rnd.choice(words) for _ in range(11)), fill=(20, 20, 20), font=font(18))
        y += 28
    # table
    x0, y0, cw, rh = 60, y + 20, 170, 36
    for r in range(7):
        for c in range(4):
            box = (x0 + c * cw, y0 + r * rh, x0 + (c + 1) * cw, y0 + (r + 1) * rh)
            d.rectangle(box, outline="black", width=1, fill=(230, 230, 230) if r == 0 else None)
            d.text((box[0] + 8, box[1] + 9), f"R{r}C{c}" if r else f"Col {c}", fill="black", font=font(16))
    # signature box + stamp-ish circle
    by = y0 + 7 * rh + 40
    d.rectangle((60, by, 400, by + 140), outline="black", width=3)
    d.text((75, by + 10), "Ký tên / Signature", fill="black", font=font(16))
    d.ellipse((520, by, 700, by + 140), outline=(180, 30, 30), width=4)
    d.text((560, by + 60), "APPROVED", fill=(180, 30, 30), font=font(18))
    img.save(path)
    return path


def to_uint8(a):
    import numpy as np
    if a is None:
        return None
    a = np.asarray(a)
    if a.dtype != np.uint8:
        a = a.astype(np.float32)
        if a.size and float(np.nanmax(a)) <= 1.0 + 1e-6:
            a = a * 255.0
        a = np.clip(np.nan_to_num(a), 0, 255).astype(np.uint8)
    return a


def apply_effect(lib: str, name: str, kwargs: dict, img_bgr):
    """Return uint8 output image (BGR for augraphy, RGB-in/RGB-out converted back to BGR)."""
    import cv2
    if lib == "augraphy":
        import augraphy
        cls = getattr(augraphy, name, None)
        if cls is None:
            import augraphy.augmentations as m
            cls = getattr(m, name)
        kw = dict(kwargs)
        kw.setdefault("p", 1)
        aug = cls(**kw)
        out = aug(img_bgr.copy(), force=True)
        if isinstance(out, tuple):
            out = out[0]
        return to_uint8(out)
    import albumentations as A
    cls = getattr(A, name)
    kw = dict(kwargs)
    kw["p"] = 1.0
    t = cls(**kw)
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    out = to_uint8(t(image=rgb)["image"])
    if out is not None and out.ndim == 3 and out.shape[2] == 3:
        out = cv2.cvtColor(out, cv2.COLOR_RGB2BGR)
    return out


def changed_vs(a, b) -> bool:
    import numpy as np
    if a.shape != b.shape:
        return True
    return float(np.mean(np.abs(a.astype(np.int16) - b.astype(np.int16)))) > 0.01


def one(lib: str, name: str, img_path: str, kwargs: dict) -> dict:
    import cv2
    import numpy as np
    random.seed(1)
    np.random.seed(1)
    img = cv2.imread(img_path, cv2.IMREAD_COLOR)
    t0 = time.perf_counter()
    out = apply_effect(lib, name, kwargs, img)
    first = (time.perf_counter() - t0) * 1000
    if out is None:
        raise RuntimeError("effect returned None")
    ms = first
    if first < 2000:  # second timed run (excludes numba JIT warm-up)
        t0 = time.perf_counter()
        apply_effect(lib, name, kwargs, img)
        ms = (time.perf_counter() - t0) * 1000
    return {"ms": round(ms, 1), "changed": changed_vs(img, out), "shape": list(out.shape)}


def run_sub(lib, name, img, kwargs) -> dict:
    cmd = [sys.executable, str(Path(__file__).resolve()), "--one", lib, name, str(img), json.dumps(kwargs)]
    env = dict(os.environ, PYTHONWARNINGS="ignore", NO_ALBUMENTATIONS_UPDATE="1", PYTHONIOENCODING="utf-8")
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT, env=env, encoding="utf-8",
                           errors="replace")
    except subprocess.TimeoutExpired:
        return {"ok": False, "reason": f"timeout > {TIMEOUT}s"}
    for line in p.stdout.splitlines():
        if line.startswith(MARK):
            return json.loads(line[len(MARK):])
    tail = (p.stderr or p.stdout or "").strip().splitlines()
    return {"ok": False, "reason": (tail[-1] if tail else f"exit {p.returncode}")[:300]}


def guess_fix(effect: dict, reason: str) -> dict | None:
    if effect["name"] in QUICK_FIX:
        return QUICK_FIX[effect["name"]]
    fix = {}
    for prm in effect.get("params", []):
        if prm.get("required") and prm["name"] in GENERIC_REQUIRED:
            fix[prm["name"]] = GENERIC_REQUIRED[prm["name"]]
    return fix or None


def test_effect(effect: dict, img: Path) -> dict:
    base = effect.get("fix_args") or {}
    r = run_sub(effect["lib"], effect["name"], img, base)
    if not r.get("ok") and not r.get("reason", "").startswith("timeout"):
        # the ONE quick fix: supply args if known, else a plain retry (random params can hit edge cases)
        fix = guess_fix(effect, r.get("reason", "")) or base
        r2 = run_sub(effect["lib"], effect["name"], img, fix)
        if r2.get("ok"):
            r2["fix_args"] = fix
            return r2
        r["reason"] = r2.get("reason", r.get("reason"))
    return r


def run_all(catalog_path: Path = HERE / "catalog.json", only: set | None = None) -> dict:
    cat = json.loads(Path(catalog_path).read_text(encoding="utf-8"))
    tmp = Path(tempfile.gettempdir()) / "aug-lab" / "_smoke"
    tmp.mkdir(parents=True, exist_ok=True)
    img = make_doc_image(tmp / "doc.png")
    effects = [e for e in cat["effects"] if not only or e["name"] in only]
    workers = max(1, min(8, (os.cpu_count() or 2) - 1))
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(lambda e: test_effect(e, img), effects))
    # timeouts under parallel load: one sequential retry without contention
    for i, (e, r) in enumerate(zip(effects, results)):
        if not r.get("ok") and r.get("reason", "").startswith("timeout"):
            results[i] = run_sub(e["lib"], e["name"], img, e.get("fix_args") or {})
    for e, r in zip(effects, results):
        if r.get("ok"):
            e.update(status="ok", reason="", avg_ms=r["ms"], changed=bool(r["changed"]))
            if r.get("fix_args"):
                e["fix_args"] = r["fix_args"]
        else:
            e.update(status="unsupported", reason=r.get("reason", "unknown"), avg_ms=None, changed=False)
    cat["smoke"] = {"image": "synthetic 800x1000 document", "timeout_s": TIMEOUT,
                    "at": time.strftime("%Y-%m-%dT%H:%M:%S")}
    Path(catalog_path).write_text(json.dumps(cat, indent=1, ensure_ascii=False), encoding="utf-8")
    summarize(cat)
    return cat


def summarize(cat: dict):
    groups: dict[str, list[int]] = {}
    for e in cat["effects"]:
        g = f"{e['lib']}/{e.get('phase') or e.get('category')}"
        s = groups.setdefault(g, [0, 0])
        s[0 if e["status"] == "ok" else 1] += 1
    for g, (ok, bad) in sorted(groups.items()):
        print(f"{g}: ok={ok} unsupported={bad}")
    nochg = [e["name"] for e in cat["effects"] if e["status"] == "ok" and not e["changed"]]
    bad = [e["name"] for e in cat["effects"] if e["status"] != "ok"]
    print("unsupported:", ", ".join(bad) or "-")
    print("ok-but-unchanged:", ", ".join(nochg) or "-")


if __name__ == "__main__":
    if len(sys.argv) >= 6 and sys.argv[1] == "--one":
        try:
            res = one(sys.argv[2], sys.argv[3], sys.argv[4], json.loads(sys.argv[5]))
            res["ok"] = True
        except Exception as ex:  # report, never crash silently
            res = {"ok": False, "reason": f"{type(ex).__name__}: {ex}"[:300]}
        print(MARK + json.dumps(res), flush=True)
    else:
        only = None
        if "--only" in sys.argv:
            only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
        run_all(only=only)
