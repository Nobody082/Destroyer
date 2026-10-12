"""Build python/catalog.json by introspecting the INSTALLED augraphy + albumentations.

No hand-written effect lists: classes are discovered via pkgutil/inspect. Only
exclusion rules (containers / data-dependent transforms) are declared here.

Usage:
    python python/build_catalog.py            # introspect + smoke test (default)
    python python/build_catalog.py --no-smoke # introspect only (status=ok, avg_ms=null)
"""
from __future__ import annotations

import importlib
import inspect
import json
import pkgutil
import sys
import typing
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
CATALOG = HERE / "catalog.json"

SKIP_PARAMS = {"p", "always_apply", "strict", "self"}
EXCLUDED: list[dict] = []  # filled during introspection (both libs)

# --- Augraphy -------------------------------------------------------------
AUG_CONTAINERS = {"Augmentation", "OneOf", "AugmentationSequence", "AugraphyPipeline",
                  "ComposePipelines", "AugmentationResult",
                  "Function", "Interop"}  # wrappers around user callables / other libs

# --- Albumentations -------------------------------------------------------
ALB_CONTAINERS = {"Compose", "OneOf", "SomeOf", "Sequential", "OneOrOther", "RandomOrder",
                  "ReplayCompose", "SelectiveChannelTransform", "ToTensorV2", "ToTensor", "Lambda",
                  "BaseCompose"}
# need reference/external images, metadata, bboxes, masks or keypoints
ALB_DATA_DEPENDENT = {"FDA", "HistogramMatching", "PixelDistributionAdaptation", "MixUp", "Mosaic",
                      "TemplateTransform", "OverlayElements", "TextImage", "BBoxSafeRandomCrop",
                      "RandomSizedBBoxSafeCrop", "RandomCropNearBBox", "CropNonEmptyMaskIfExists",
                      "MaskDropout", "ConstrainedCoarseDropout", "AtLeastOneBBoxRandomCrop", "CopyAndPaste"}
DATA_WORDS = ("bbox", "mask", "keypoint", "metadata", "reference", "read_fn", "template", "foreground", "volume")
# mandatory data access (data.get(...) = optional, so not matched)
DATA_KEYS = ('data["bboxes"]', 'data["masks"]', 'data["mask"]', 'data["keypoints"]', "data[self.metadata_key]",
             "reference_data", "data['bboxes']", "data['mask']", "data['keypoints']")


def first_doc_line(obj) -> str:
    doc = inspect.getdoc(obj) or ""
    for line in doc.splitlines():
        line = line.strip()
        if line:
            return line[:240]
    return ""


def jsonable(v):
    if isinstance(v, (bool, int, float, str)) or v is None:
        if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
            return str(v)
        return v
    if isinstance(v, (tuple, list)):
        return [jsonable(x) for x in v]
    if isinstance(v, dict):
        return {str(k): jsonable(x) for k, x in v.items()}
    if hasattr(v, "item"):  # numpy scalar
        try:
            return v.item()
        except Exception:
            pass
    if hasattr(v, "value") and hasattr(v, "name"):  # Enum
        return jsonable(v.value)
    return repr(v)


def literal_choices(tp):
    """Return choices if annotation is (Optional/Union of) Literal[...]"""
    if tp is None:
        return None
    origin = typing.get_origin(tp)
    if origin is typing.Literal:
        return [jsonable(a) for a in typing.get_args(tp)]
    if origin is typing.Union or str(origin) == "types.UnionType":
        out = []
        for a in typing.get_args(tp):
            c = literal_choices(a)
            if c:
                out += c
        return out or None
    return None


def param_schema(cls) -> list[dict]:
    try:
        sig = inspect.signature(cls.__init__)
    except (TypeError, ValueError):
        return []
    hints = {}
    for pn, pp in sig.parameters.items():
        ann = pp.annotation
        if isinstance(ann, str):
            mod = sys.modules.get(getattr(cls.__init__, "__module__", ""), None)
            ns = dict(vars(typing))
            ns.update(vars(mod) if mod else {})
            try:
                ann = eval(ann, ns)  # noqa: S307 - annotation strings from installed lib
            except Exception:
                ann = None
        if ann is not inspect.Parameter.empty:
            hints[pn] = ann
    params = []
    for name, p in sig.parameters.items():
        if name in SKIP_PARAMS or p.kind in (p.VAR_POSITIONAL, p.VAR_KEYWORD):
            continue
        required = p.default is inspect.Parameter.empty
        d = None if required else p.default
        choices = literal_choices(hints.get(name))
        if choices and all(not isinstance(c, (list, dict)) for c in choices) and not isinstance(d, (tuple, list)):
            kind = "choice"
        elif isinstance(d, bool):
            kind = "bool"
        elif isinstance(d, int):
            kind = "int"
        elif isinstance(d, float):
            kind = "float"
        elif isinstance(d, str):
            kind = "str"
        elif isinstance(d, (tuple, list)) and len(d) == 2 and all(
                isinstance(x, (int, float)) and not isinstance(x, bool) for x in d):
            kind = "range"
        else:
            kind = "json"
        item = {"name": name, "kind": kind, "default": jsonable(d)}
        if kind == "choice":
            item["choices"] = choices
        if kind == "range":
            item["numeric"] = "int" if all(isinstance(x, int) for x in d) else "float"
        if required:
            item["required"] = True
        params.append(item)
    return params


def walk_phase(obj, out: set):
    if obj is None:
        return
    if isinstance(obj, (list, tuple)):
        for o in obj:
            walk_phase(o, out)
        return
    inner = getattr(obj, "augmentations", None)
    if isinstance(inner, (list, tuple)):
        walk_phase(inner, out)
        return
    out.add(type(obj).__name__)


def augraphy_phase_map() -> dict[str, str]:
    """Phase grouping taken from the library's own default pipeline."""
    mapping: dict[str, str] = {}
    try:
        from augraphy import default_augraphy_pipeline  # type: ignore
        pipe = default_augraphy_pipeline()
        for phase in ("ink", "paper", "post"):
            names: set = set()
            walk_phase(getattr(pipe, f"{phase}_phase", None), names)
            for n in names:
                mapping.setdefault(n, phase)
    except Exception as e:  # pragma: no cover
        print(f"[catalog] default pipeline introspection failed: {e}", file=sys.stderr)
    return mapping


def iter_module_classes(pkg_name: str):
    pkg = importlib.import_module(pkg_name)
    seen = {}
    mods = [pkg]
    if hasattr(pkg, "__path__"):
        for info in pkgutil.walk_packages(pkg.__path__, pkg_name + "."):
            if any(s in info.name for s in (".tests", ".test_", "pytorch", "benchmark")):
                continue
            try:
                mods.append(importlib.import_module(info.name))
            except Exception:
                continue
    for m in mods:
        for _, obj in inspect.getmembers(m, inspect.isclass):
            if obj.__module__.startswith(pkg_name.split(".")[0]):
                seen[obj.__name__] = obj
    return seen


def augraphy_effects() -> list[dict]:
    import augraphy  # type: ignore
    from augraphy.base.augmentation import Augmentation  # type: ignore
    phases = augraphy_phase_map()
    out = []
    excluded = EXCLUDED
    for name, cls in sorted(iter_module_classes("augraphy.augmentations").items()):
        if not issubclass(cls, Augmentation) or name in AUG_CONTAINERS or inspect.isabstract(cls):
            continue
        if name.startswith("Base") or not hasattr(augraphy, name):  # public API only
            continue
        why = alb_data_dependent(cls)  # same rule: needs external images/data -> exclude
        if why:
            excluded.append({"name": name, "lib": "augraphy", "reason": why})
            continue
        out.append({
            "id": f"augraphy.{name}", "lib": "augraphy", "name": name,
            "phase": phases.get(name, "post"), "phase_source": "default_pipeline" if name in phases else "fallback",
            "module": cls.__module__, "doc": first_doc_line(cls), "params": param_schema(cls),
            "status": "ok", "reason": "", "avg_ms": None, "changed": None,
        })
    return out


def alb_data_dependent(cls) -> str:
    name = cls.__name__
    if name in ALB_DATA_DEPENDENT:
        return "needs bboxes/masks/keypoints/metadata or reference images"
    try:
        sig = inspect.signature(cls.__init__)
        for pn, p in sig.parameters.items():
            if p.default is inspect.Parameter.empty and pn not in SKIP_PARAMS and \
                    p.kind not in (p.VAR_POSITIONAL, p.VAR_KEYWORD) and any(w in pn for w in DATA_WORDS):
                return f"requires '{pn}'"
    except (TypeError, ValueError):
        pass
    for attr in ("get_params_dependent_on_data", "get_params_dependent_on_targets"):
        fn = cls.__dict__.get(attr)
        if fn is None:
            continue
        try:
            src = inspect.getsource(fn)
        except Exception:
            continue
        if any(k in src for k in DATA_KEYS):
            return f"{attr} reads bbox/mask/keypoint/metadata data"
    return ""


def albumentations_effects() -> tuple[list[dict], list[dict]]:
    import albumentations as A  # type: ignore
    from albumentations.core.transforms_interface import DualTransform, ImageOnlyTransform  # type: ignore
    from albumentations.core import transforms_interface as ti  # type: ignore
    T3D = getattr(ti, "Transform3D", None)
    out, excluded = [], EXCLUDED
    classes = iter_module_classes("albumentations")
    for name, cls in sorted(classes.items()):
        if not (issubclass(cls, ImageOnlyTransform) or issubclass(cls, DualTransform)):
            continue
        if cls in (ImageOnlyTransform, DualTransform) or inspect.isabstract(cls) or name.startswith("Base") \
                or cls.__module__.endswith("transforms_interface"):
            continue
        if name in ALB_CONTAINERS:
            excluded.append({"name": name, "reason": "container/utility"})
            continue
        if not hasattr(A, name):  # not public API
            continue
        if T3D is not None and issubclass(cls, T3D):
            excluded.append({"name": name, "reason": "3D volume transform"})
            continue
        why = alb_data_dependent(cls)
        if why:
            excluded.append({"name": name, "reason": why})
            continue
        out.append({
            "id": f"albumentations.{name}", "lib": "albumentations", "name": name,
            "category": "pixel" if issubclass(cls, ImageOnlyTransform) else "spatial",
            "module": cls.__module__, "doc": first_doc_line(cls), "params": param_schema(cls),
            "status": "ok", "reason": "", "avg_ms": None, "changed": None,
        })
    for x in excluded:
        x.setdefault("lib", "albumentations")
    return out, excluded


def versions() -> dict:
    import platform
    import cv2, numpy, augraphy, albumentations  # type: ignore
    try:
        import numba
        nb = numba.__version__
    except Exception:
        nb = None
    return {"python": platform.python_version(), "numpy": numpy.__version__, "opencv": cv2.__version__,
            "numba": nb, "augraphy": getattr(augraphy, "__version__", "?"),
            "albumentations": albumentations.__version__}


def build() -> dict:
    aug = augraphy_effects()
    alb, excluded = albumentations_effects()
    return {
        "schema": 1,
        "versions": versions(),
        "phase_order": ["ink", "paper", "post"],
        "effects": aug + alb,
        "excluded": excluded,
    }


def main():
    cat = build()
    # keep previous quick-fix args if any
    CATALOG.write_text(json.dumps(cat, indent=1, ensure_ascii=False), encoding="utf-8")
    n_aug = sum(e["lib"] == "augraphy" for e in cat["effects"])
    print(f"[catalog] augraphy={n_aug} albumentations={len(cat['effects']) - n_aug} excluded={len(cat['excluded'])}")
    if "--no-smoke" not in sys.argv:
        import smoke  # type: ignore  (same folder)
        smoke.run_all(CATALOG)


if __name__ == "__main__":
    sys.path.insert(0, str(HERE))
    main()
