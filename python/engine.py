from __future__ import annotations

import inspect
import json
import os
import random
import time
from pathlib import Path
from typing import Any

import albumentations as A
import augraphy
import cv2
import numpy as np

CATALOG_PATH = Path(__file__).resolve().parent / "catalog.json"


def _load_catalog() -> tuple[dict[tuple[str, str], dict[str, Any]], dict[str, str]]:
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    versions: dict[str, str] = {}
    if CATALOG_PATH.exists():
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        versions = data.get("versions") or {}
        for eff in data.get("effects") or []:
            lib = eff.get("lib")
            name = eff.get("name")
            if lib and name:
                by_key[(lib, name)] = eff
    return by_key, versions


CATALOG_BY_KEY, CATALOG_VERSIONS = _load_catalog()
_SIGNATURE_CACHE: dict[type, set[str] | None] = {}
_INPUT_CACHE: dict[tuple[str, float, int | None], np.ndarray] = {}
_MAX_INPUT_CACHE = 4


def get_versions() -> dict[str, str]:
    if CATALOG_VERSIONS:
        return CATALOG_VERSIONS
    import numba
    import platform

    return {
        "python": platform.python_version(),
        "numpy": np.__version__,
        "opencv": cv2.__version__,
        "numba": numba.__version__,
        "augraphy": getattr(augraphy, "__version__", "unknown"),
        "albumentations": getattr(A, "__version__", "unknown"),
    }


def set_seeds(seed: int) -> int:
    seed_32 = int(seed) & 0x7FFFFFFF
    random.seed(seed_32)
    np.random.seed(seed_32)
    if hasattr(cv2, "setRNGSeed"):
        try:
            cv2.setRNGSeed(seed_32)
        except Exception:
            pass
    return seed_32


def _patch_augraphy_numba() -> None:
    """Fix Numba 0.68 parfor type-inference AssertionError in NoiseGenerator.generate_worley_noise."""
    try:
        import numba
        from augraphy.utilities.noisegenerator import NoiseGenerator

        fn = getattr(NoiseGenerator, "generate_worley_noise", None)
        if fn is not None and hasattr(fn, "py_func"):
            NoiseGenerator.generate_worley_noise = staticmethod(
                numba.njit(parallel=False, cache=True)(fn.py_func)
            )
    except Exception:
        pass


_patch_augraphy_numba()


def warmup() -> None:
    set_seeds(42)
    dummy = np.full((96, 96, 3), 245, dtype=np.uint8)
    dummy[20:76, 20:76] = 35
    try:
        ink_cls = getattr(augraphy, "InkBleed", None)
        if ink_cls is not None:
            pipe = augraphy.AugraphyPipeline(
                ink_phase=[ink_cls(p=1)],
                paper_phase=[],
                post_phase=[],
            )
            _ = pipe(dummy.copy())
    except Exception:
        pass
    try:
        comp = A.Compose([A.Blur(p=1.0)], seed=42)
        _ = comp(image=dummy.copy())["image"]
    except Exception:
        pass


def _accepted_kwargs(cls: type) -> set[str] | None:
    if cls in _SIGNATURE_CACHE:
        return _SIGNATURE_CACHE[cls]
    try:
        sig = inspect.signature(cls.__init__)
        for param in sig.parameters.values():
            if param.kind == inspect.Parameter.VAR_KEYWORD:
                _SIGNATURE_CACHE[cls] = None
                return None
        names = {
            name
            for name, param in sig.parameters.items()
            if name != "self"
            and param.kind
            in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)
        }
        _SIGNATURE_CACHE[cls] = names
        return names
    except Exception:
        _SIGNATURE_CACHE[cls] = None
        return None


def _coerce_param(val: Any, pmeta: dict[str, Any] | None) -> Any:
    if val is None or pmeta is None:
        return val
    kind = pmeta.get("kind")
    numeric = pmeta.get("numeric")
    try:
        if kind == "int":
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                return int(round(val))
            if isinstance(val, str) and val.strip():
                return int(round(float(val.strip())))
        elif kind == "float":
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                return float(val)
            if isinstance(val, str) and val.strip():
                return float(val.strip())
        elif kind == "bool":
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                return val.lower() in ("true", "1", "yes")
            return bool(val)
        elif kind == "range":
            if isinstance(val, (list, tuple)) and len(val) == 2:
                a, b = val[0], val[1]
                if numeric == "int":
                    ia, ib = int(round(float(a))), int(round(float(b)))
                    if ia > ib:
                        ia, ib = ib, ia
                    return (ia, ib)
                fa, fb = float(a), float(b)
                if fa > fb:
                    fa, fb = fb, fa
                return (fa, fb)
        elif kind == "json":
            if isinstance(val, str):
                s = val.strip()
                if not s:
                    return pmeta.get("default")
                parsed = json.loads(s)
                if isinstance(pmeta.get("default"), tuple) and isinstance(parsed, list):
                    return tuple(parsed)
                return parsed
            if isinstance(pmeta.get("default"), tuple) and isinstance(val, list):
                return tuple(val)
    except Exception:
        return val
    return val


def _clamp_spatial_params(merged: dict[str, Any], img_shape: tuple[int, int] | None) -> None:
    if not img_shape:
        return
    in_h, in_w = int(img_shape[0]), int(img_shape[1])
    if in_h <= 0 or in_w <= 0:
        return

    for hk in ("height", "crop_height"):
        if isinstance(merged.get(hk), (int, float)) and int(merged[hk]) > in_h:
            merged[hk] = max(1, int(in_h * 0.85))
    for wk in ("width", "crop_width"):
        if isinstance(merged.get(wk), (int, float)) and int(merged[wk]) > in_w:
            merged[wk] = max(1, int(in_w * 0.85))

    for sk in ("size", "crop_size", "target_size"):
        val = merged.get(sk)
        if isinstance(val, (list, tuple)) and len(val) == 2:
            sh, sw = int(val[0]), int(val[1])
            if sh > in_h or sw > in_w:
                merged[sk] = (
                    min(sh, max(1, int(in_h * 0.85))),
                    min(sw, max(1, int(in_w * 0.85))),
                )

    if "min_max_height" in merged and isinstance(merged["min_max_height"], (list, tuple)) and len(merged["min_max_height"]) == 2:
        a, b = int(merged["min_max_height"][0]), int(merged["min_max_height"][1])
        if b > in_h or a > in_h:
            hi = max(2, int(in_h * 0.9))
            lo = max(1, min(a, int(in_h * 0.6), hi - 1))
            merged["min_max_height"] = (lo, hi)

    if "x_max" in merged or "y_max" in merged:
        x_min = int(merged.get("x_min", 0) or 0)
        y_min = int(merged.get("y_min", 0) or 0)
        x_max = int(merged.get("x_max", in_w) or in_w)
        y_max = int(merged.get("y_max", in_h) or in_h)
        if x_max > in_w:
            x_max = max(1, int(in_w * 0.85))
        if y_max > in_h:
            y_max = max(1, int(in_h * 0.85))
        if x_min >= x_max:
            x_min = max(0, x_max - 1)
        if y_min >= y_max:
            y_min = max(0, y_max - 1)
        merged["x_min"] = x_min
        merged["y_min"] = y_min
        merged["x_max"] = x_max
        merged["y_max"] = y_max


def instantiate_effect(
    lib: str,
    name: str,
    user_params: dict[str, Any] | None,
    img_shape: tuple[int, int] | None = None,
) -> tuple[Any, dict[str, Any]]:
    meta = CATALOG_BY_KEY.get((lib, name)) or {}
    if lib == "augraphy":
        cls = getattr(augraphy, name, None)
    elif lib == "albumentations":
        cls = getattr(A, name, None)
    else:
        raise ValueError(f"Unknown library: {lib}")

    if cls is None:
        raise ValueError(f"Transform not found: {lib}.{name}")

    param_map = {p["name"]: p for p in (meta.get("params") or []) if "name" in p}
    fix_args = dict(meta.get("fix_args") or {})
    merged: dict[str, Any] = {}

    for k, v in fix_args.items():
        merged[k] = tuple(v) if isinstance(v, list) else v

    if user_params:
        for k, v in user_params.items():
            if v is None:
                continue
            merged[k] = _coerce_param(v, param_map.get(k))

    if lib == "albumentations":
        _clamp_spatial_params(merged, img_shape)

    merged["p"] = 1.0 if lib == "albumentations" else 1

    accepted = _accepted_kwargs(cls)
    if accepted is not None:
        filtered = {k: v for k, v in merged.items() if k in accepted}
    else:
        filtered = merged

    try:
        instance = cls(**filtered)
    except Exception:
        # Fallback to fix_args + p=1 if a user param caused schema rejection
        fallback = {k: (tuple(v) if isinstance(v, list) else v) for k, v in fix_args.items()}
        if lib == "albumentations":
            _clamp_spatial_params(fallback, img_shape)
        fallback["p"] = 1.0 if lib == "albumentations" else 1
        if accepted is not None:
            fallback = {k: v for k, v in fallback.items() if k in accepted}
        instance = cls(**fallback)

    return instance, meta


def normalize_image(img: Any, keep_gray: bool = True) -> np.ndarray:
    if isinstance(img, dict) and "output" in img:
        img = img["output"]
    elif isinstance(img, dict) and "image" in img:
        img = img["image"]
    elif isinstance(img, (tuple, list)) and len(img) > 0:
        img = img[0]

    arr = np.asarray(img)
    if arr.size == 0:
        raise ValueError("Empty image returned by transform")

    if arr.dtype.kind == "f":
        max_v = float(np.nanmax(arr)) if arr.size else 1.0
        min_v = float(np.nanmin(arr)) if arr.size else 0.0
        if max_v <= 1.0 + 1e-3 and min_v >= -1e-3:
            arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
        else:
            arr = np.clip(arr, 0, 255).astype(np.uint8)
    elif arr.dtype == np.bool_:
        arr = (arr.astype(np.uint8)) * 255
    elif arr.dtype != np.uint8:
        arr = np.clip(arr, 0, 255).astype(np.uint8)

    if arr.ndim == 3 and arr.shape[2] == 1:
        arr = arr[:, :, 0]
    elif arr.ndim == 3 and arr.shape[2] == 4:
        arr = cv2.cvtColor(arr, cv2.COLOR_BGRA2BGR)

    if not keep_gray and arr.ndim == 2:
        arr = cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)

    return np.ascontiguousarray(arr)


def load_input_image(input_path: str, max_side: int | None) -> np.ndarray:
    norm_max = int(max_side) if (max_side and int(max_side) > 0) else None
    try:
        mtime = os.path.getmtime(input_path)
    except OSError:
        mtime = 0.0

    cache_key = (input_path, mtime, norm_max)
    cached = _INPUT_CACHE.get(cache_key)
    if cached is not None:
        return cached.copy()

    buf = np.fromfile(input_path, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        from PIL import Image

        with Image.open(input_path) as pil_img:
            rgb = np.asarray(pil_img.convert("RGB"), dtype=np.uint8)
            img = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    img = normalize_image(img, keep_gray=False)
    h, w = img.shape[:2]
    if norm_max is not None and max(h, w) > norm_max:
        scale = norm_max / float(max(h, w))
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    if len(_INPUT_CACHE) >= _MAX_INPUT_CACHE:
        oldest_key = next(iter(_INPUT_CACHE))
        _INPUT_CACHE.pop(oldest_key, None)
    _INPUT_CACHE[cache_key] = img
    return img.copy()


def encode_image(img: np.ndarray, out_path: str, fmt: str = "png", quality: int = 92) -> None:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    f = (fmt or "png").lower().strip(".")
    q = max(1, min(100, int(quality or 92)))
    if f in ("jpg", "jpeg"):
        ext = ".jpg"
        params = [cv2.IMWRITE_JPEG_QUALITY, q]
    elif f == "webp":
        ext = ".webp"
        params = [cv2.IMWRITE_WEBP_QUALITY, q]
    else:
        ext = ".png"
        params = [cv2.IMWRITE_PNG_COMPRESSION, 3]

    ok, buf = cv2.imencode(ext, img, params)
    if not ok:
        raise RuntimeError(f"cv2.imencode failed for format {f}")
    buf.tofile(out_path)


def write_thumbnail(img: np.ndarray, thumb_path: str, max_px: int = 320) -> None:
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    h, w = img.shape[:2]
    if max(h, w) > max_px:
        scale = max_px / float(max(h, w))
        tw = max(1, int(round(w * scale)))
        th = max(1, int(round(h * scale)))
        thumb = cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA)
    else:
        thumb = img
    ok, buf = cv2.imencode(".webp", thumb, [cv2.IMWRITE_WEBP_QUALITY, 80])
    if not ok:
        raise RuntimeError("cv2.imencode failed for thumbnail")
    buf.tofile(thumb_path)


def prepare_original(
    input_path: str,
    out_path: str,
    thumb_path: str | None,
    max_side: int | None,
    fmt: str = "png",
    quality: int = 92,
) -> dict[str, Any]:
    t0 = time.perf_counter()
    img = load_input_image(input_path, max_side)
    encode_image(img, out_path, fmt=fmt, quality=quality)
    if thumb_path:
        write_thumbnail(img, thumb_path)
    h, w = img.shape[:2]
    ms = int(round((time.perf_counter() - t0) * 1000))
    return {"out": out_path, "thumb": thumb_path, "w": int(w), "h": int(h), "ms": ms, "changed": False}


def execute_steps(
    input_path: str,
    out_path: str,
    thumb_path: str | None,
    steps: list[dict[str, Any]],
    seed: int = 42,
    fmt: str = "png",
    quality: int = 92,
    max_side: int | None = 1600,
) -> dict[str, Any]:
    t0 = time.perf_counter()
    seed_32 = set_seeds(seed)

    orig_bgr = load_input_image(input_path, max_side)
    work = orig_bgr.copy()

    for s in steps:
        if s.get("name") == "__sleep__":
            time.sleep(float((s.get("params") or {}).get("seconds", 5)))
        elif s.get("name") == "__crash__":
            os._exit(1)

    aug_steps = [s for s in steps if s.get("lib") == "augraphy"]
    alb_steps = [s for s in steps if s.get("lib") == "albumentations"]

    # 1. Augraphy first (via AugraphyPipeline in ink -> paper -> post slots)
    if aug_steps:
        ink_phase: list[Any] = []
        paper_phase: list[Any] = []
        post_phase: list[Any] = []
        for s in aug_steps:
            inst, meta = instantiate_effect("augraphy", s["name"], s.get("params"))
            phase = s.get("phase") or meta.get("phase") or "post"
            if phase == "ink":
                ink_phase.append(inst)
            elif phase == "paper":
                paper_phase.append(inst)
            else:
                post_phase.append(inst)

        set_seeds(seed_32)
        pipeline = augraphy.AugraphyPipeline(
            ink_phase=ink_phase,
            paper_phase=paper_phase,
            post_phase=post_phase,
        )
        raw_out = pipeline(work)
        work = normalize_image(raw_out, keep_gray=False)

    # 2. Albumentations second (via A.Compose on RGB uint8)
    if alb_steps:
        if work.ndim == 2:
            work = cv2.cvtColor(work, cv2.COLOR_GRAY2BGR)
        in_h, in_w = work.shape[:2]
        rgb = cv2.cvtColor(work, cv2.COLOR_BGR2RGB)
        transforms: list[Any] = []
        has_spatial = False
        for s in alb_steps:
            inst, meta = instantiate_effect(
                "albumentations",
                s["name"],
                s.get("params"),
                img_shape=(in_h, in_w),
            )
            transforms.append(inst)
            if (s.get("category") or meta.get("category")) == "spatial":
                has_spatial = True

        set_seeds(seed_32)
        try:
            comp = A.Compose(transforms, seed=seed_32)
        except TypeError:
            comp = A.Compose(transforms)

        res_rgb = comp(image=rgb)["image"]
        res_norm = normalize_image(res_rgb, keep_gray=False)
        if not has_spatial and res_norm.shape[:2] != (in_h, in_w):
            res_norm = cv2.resize(res_norm, (in_w, in_h), interpolation=cv2.INTER_LINEAR)

        if res_norm.ndim == 3 and res_norm.shape[2] == 3:
            work = cv2.cvtColor(res_norm, cv2.COLOR_RGB2BGR)
        else:
            work = normalize_image(res_norm, keep_gray=False)

    if work.ndim == 2:
        work = cv2.cvtColor(work, cv2.COLOR_GRAY2BGR)

    # Check if image changed compared to downscaled input
    if work.shape[:2] != orig_bgr.shape[:2]:
        changed = True
    else:
        changed = not np.array_equal(orig_bgr, work)

    encode_image(work, out_path, fmt=fmt, quality=quality)
    if thumb_path:
        write_thumbnail(work, thumb_path)

    out_h, out_w = work.shape[:2]
    ms = int(round((time.perf_counter() - t0) * 1000))
    return {
        "out": out_path,
        "thumb": thumb_path,
        "w": int(out_w),
        "h": int(out_h),
        "ms": ms,
        "changed": bool(changed),
    }
