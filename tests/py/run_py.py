from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from typing import Any

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PYTHON_DIR = ROOT / "python"
OUT_DIR = ROOT / "tests" / "out"
OUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = OUT_DIR / "py.log"
SUMMARY_FILE = OUT_DIR / "py-summary.json"

if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

import engine  # noqa: E402
from smoke import make_doc_image  # noqa: E402


def log(msg: str) -> None:
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def get_group_key(eff: dict[str, Any]) -> str:
    lib = eff["lib"]
    sub = eff.get("phase") if lib == "augraphy" else eff.get("category")
    return f"{lib}/{sub or 'other'}"


def test_single_effect(eff: dict[str, Any], input_path: str, tmp_dir: Path) -> dict[str, Any]:
    eid = eff["id"]
    lib = eff["lib"]
    name = eff["name"]
    safe = eid.replace(".", "_")
    out_path = str(tmp_dir / f"{safe}.png")
    thumb_path = str(tmp_dir / f"{safe}_thumb.webp")
    try:
        res = engine.execute_steps(
            input_path=input_path,
            out_path=out_path,
            thumb_path=thumb_path,
            steps=[
                {
                    "lib": lib,
                    "name": name,
                    "params": {},
                    "phase": eff.get("phase"),
                    "category": eff.get("category"),
                }
            ],
            seed=42,
            fmt="png",
            quality=92,
            max_side=1600,
        )
        if not os.path.exists(out_path):
            return {"id": eid, "group": get_group_key(eff), "ok": False, "reason": "Output file missing"}
        buf = np.fromfile(out_path, dtype=np.uint8)
        decoded = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
        if decoded is None:
            return {"id": eid, "group": get_group_key(eff), "ok": False, "reason": "cv2.imdecode returned None"}
        if decoded.dtype != np.uint8:
            return {"id": eid, "group": get_group_key(eff), "ok": False, "reason": f"Bad dtype {decoded.dtype}"}
        if decoded.ndim != 3 or decoded.shape[2] != 3:
            return {"id": eid, "group": get_group_key(eff), "ok": False, "reason": f"Not 3-channel: shape={decoded.shape}"}
        h, w = decoded.shape[:2]
        if h < 16 or w < 16 or h > 5000 or w > 5000:
            return {"id": eid, "group": get_group_key(eff), "ok": False, "reason": f"Implausible size {w}x{h}"}
        if not isinstance(res.get("ms"), int) or res["ms"] < 0:
            return {"id": eid, "group": get_group_key(eff), "ok": False, "reason": "Invalid ms timing"}
        return {
            "id": eid,
            "group": get_group_key(eff),
            "ok": True,
            "changed": bool(res.get("changed")),
            "ms": res["ms"],
        }
    except Exception as exc:
        return {
            "id": eid,
            "group": get_group_key(eff),
            "ok": False,
            "reason": f"{type(exc).__name__}: {exc}",
        }


def run_worker_resilience_tests(input_path: str, tmp_dir: Path) -> list[tuple[str, str]]:
    failures: list[tuple[str, str]] = []
    worker_py = str(PYTHON_DIR / "worker.py")
    py_exe = sys.executable

    def spawn_worker() -> subprocess.Popen[str]:
        proc = subprocess.Popen(
            [py_exe, "-u", worker_py],
            cwd=str(ROOT),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1", "NO_ALBUMENTATIONS_UPDATE": "1"},
        )
        ready_line = proc.stdout.readline().strip() if proc.stdout else ""
        data = json.loads(ready_line)
        if not data.get("ready"):
            raise RuntimeError(f"Worker did not send ready handshake: {ready_line}")
        return proc

    # 1. Timeout kill + respawn
    try:
        w1 = spawn_worker()
        assert w1.stdin and w1.stdout
        w1.stdin.write(json.dumps({"id": "hang1", "op": "sleep", "seconds": 30}) + "\n")
        w1.stdin.flush()

        # Simulate pool timeout after 1.5s -> kill + respawn
        time.sleep(1.5)
        if w1.poll() is None:
            w1.kill()
            w1.wait(timeout=5)
        else:
            failures.append(("worker_timeout_kill", "Worker exited prematurely before timeout"))

        w2 = spawn_worker()
        assert w2.stdin and w2.stdout
        out_p = str(tmp_dir / "respawn_after_timeout.png")
        w2.stdin.write(
            json.dumps(
                {
                    "id": "after_timeout",
                    "op": "run",
                    "input": input_path,
                    "out": out_p,
                    "lib": "albumentations",
                    "name": "Blur",
                    "params": {},
                    "seed": 42,
                }
            )
            + "\n"
        )
        w2.stdin.flush()
        resp = json.loads(w2.stdout.readline().strip())
        if not resp.get("ok"):
            failures.append(("worker_timeout_respawn", f"Respawned worker failed: {resp}"))
        w2.stdin.write(json.dumps({"id": "bye", "op": "shutdown"}) + "\n")
        w2.stdin.flush()
        w2.wait(timeout=5)
    except Exception as exc:
        failures.append(("worker_timeout_recovery", f"{type(exc).__name__}: {exc}"))

    # 2. Crash recovery
    try:
        w3 = spawn_worker()
        assert w3.stdin and w3.stdout
        w3.stdin.write(json.dumps({"id": "crash1", "op": "crash"}) + "\n")
        w3.stdin.flush()
        eof_line = w3.stdout.readline()
        w3.wait(timeout=5)
        if eof_line != "" or w3.returncode == 0:
            failures.append(("worker_crash_detect", f"Expected non-zero exit on crash, got {w3.returncode}"))

        w4 = spawn_worker()
        assert w4.stdin and w4.stdout
        out_p2 = str(tmp_dir / "respawn_after_crash.png")
        w4.stdin.write(
            json.dumps(
                {
                    "id": "after_crash",
                    "op": "run",
                    "input": input_path,
                    "out": out_p2,
                    "lib": "augraphy",
                    "name": "InkBleed",
                    "params": {},
                    "seed": 42,
                }
            )
            + "\n"
        )
        w4.stdin.flush()
        resp2 = json.loads(w4.stdout.readline().strip())
        if not resp2.get("ok"):
            failures.append(("worker_crash_respawn", f"Respawned worker failed: {resp2}"))
        w4.stdin.write(json.dumps({"id": "bye2", "op": "shutdown"}) + "\n")
        w4.stdin.flush()
        w4.wait(timeout=5)
    except Exception as exc:
        failures.append(("worker_crash_recovery", f"{type(exc).__name__}: {exc}"))

    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", type=str, default="", help="Comma-separated effect IDs or names")
    args = parser.parse_args()

    LOG_FILE.write_text("", encoding="utf-8")
    t_start = time.perf_counter()

    with open(PYTHON_DIR / "catalog.json", "r", encoding="utf-8") as f:
        catalog = json.load(f)

    ok_effects = [e for e in catalog["effects"] if e.get("status") == "ok"]
    if args.only:
        filters = {x.strip() for x in args.only.split(",") if x.strip()}
        ok_effects = [e for e in ok_effects if e["id"] in filters or e["name"] in filters]

    tmp_dir = Path(tempfile.mkdtemp(prefix="aug_lab_test_py_"))
    failures: list[tuple[str, str]] = []

    try:
        input_path = str(make_doc_image(tmp_dir / "synthetic_doc.png", 800, 1000))
        doc_img = cv2.imread(input_path, cv2.IMREAD_COLOR)

        engine.warmup()

        coverage: dict[str, dict[str, int]] = {}
        no_op_effects: list[str] = []

        for eff in ok_effects:
            res = test_single_effect(eff, input_path, tmp_dir)
            grp = res["group"]
            if grp not in coverage:
                coverage[grp] = {"ok": 0, "failed": 0, "no_op": 0}
            if res["ok"]:
                coverage[grp]["ok"] += 1
                if not res.get("changed"):
                    coverage[grp]["no_op"] += 1
                    no_op_effects.append(res["id"])
                log(f"[OK] {res['id']} ({res['ms']} ms, changed={res.get('changed')})")
            else:
                coverage[grp]["failed"] += 1
                failures.append((res["id"], res["reason"]))
                log(f"[FAIL] {res['id']}: {res['reason']}")

        if not args.only:
            # Mode & Seed reproducibility tests
            try:
                s1 = str(tmp_dir / "seed_a1.png")
                s2 = str(tmp_dir / "seed_a2.png")
                s3 = str(tmp_dir / "seed_b.png")
                steps_seed = [
                    {"lib": "augraphy", "name": "InkBleed", "params": {}, "phase": "ink"},
                    {"lib": "albumentations", "name": "GaussNoise", "params": {}, "category": "pixel"},
                ]
                engine.execute_steps(input_path, s1, None, steps_seed, seed=77777)
                engine.execute_steps(input_path, s2, None, steps_seed, seed=77777)
                engine.execute_steps(input_path, s3, None, steps_seed, seed=88888)
                arr1 = cv2.imread(s1)
                arr2 = cv2.imread(s2)
                arr3 = cv2.imread(s3)
                if not np.array_equal(arr1, arr2):
                    failures.append(("seed_reproducibility_same", "Same seed produced different outputs"))
                if np.array_equal(arr1, arr3):
                    failures.append(("seed_reproducibility_diff", "Different seeds produced identical outputs"))
            except Exception as exc:
                failures.append(("seed_reproducibility", f"{type(exc).__name__}: {exc}"))

            # Mixed Augraphy + Albumentations ordering & fixed chain
            try:
                chain_out = str(tmp_dir / "chain_mixed.png")
                mixed_steps = [
                    {"lib": "albumentations", "name": "Blur", "params": {"blur_limit": [5, 5]}, "category": "pixel"},
                    {"lib": "augraphy", "name": "ColorPaper", "params": {}, "phase": "paper"},
                    {"lib": "augraphy", "name": "InkBleed", "params": {}, "phase": "ink"},
                ]
                res_chain = engine.execute_steps(input_path, chain_out, None, mixed_steps, seed=101)
                if not res_chain.get("changed"):
                    failures.append(("mixed_chain_order", "Mixed chain did not modify image"))
            except Exception as exc:
                failures.append(("mixed_chain_order", f"{type(exc).__name__}: {exc}"))

            # Params override test
            try:
                p_small = str(tmp_dir / "param_small.png")
                p_large = str(tmp_dir / "param_large.png")
                engine.execute_steps(
                    input_path,
                    p_small,
                    None,
                    [{"lib": "albumentations", "name": "Blur", "params": {"blur_limit": [3, 3]}}],
                    seed=55,
                )
                engine.execute_steps(
                    input_path,
                    p_large,
                    None,
                    [{"lib": "albumentations", "name": "Blur", "params": {"blur_limit": [25, 25]}}],
                    seed=55,
                )
                if np.array_equal(cv2.imread(p_small), cv2.imread(p_large)):
                    failures.append(("params_override", "Overriding blur_limit [3,3] vs [25,25] had no effect"))
            except Exception as exc:
                failures.append(("params_override", f"{type(exc).__name__}: {exc}"))

            # Input edge cases: Grayscale, RGBA, Tiny (64x64), Large (4000x3000 downscale on/off)
            try:
                gray_in = str(tmp_dir / "in_gray.png")
                cv2.imwrite(gray_in, cv2.cvtColor(doc_img, cv2.COLOR_BGR2GRAY))
                rgba_in = str(tmp_dir / "in_rgba.png")
                rgba = cv2.cvtColor(doc_img, cv2.COLOR_BGR2BGRA)
                rgba[:, :, 3] = 200
                cv2.imwrite(rgba_in, rgba)
                tiny_in = str(tmp_dir / "in_tiny.png")
                cv2.imwrite(tiny_in, cv2.resize(doc_img, (64, 64)))
                large_in = str(tmp_dir / "in_large.png")
                large_img = np.full((3000, 4000, 3), 245, dtype=np.uint8)
                cv2.rectangle(large_img, (200, 200), (3800, 2800), (30, 30, 30), 8)
                cv2.imwrite(large_in, large_img)

                step_edge = [
                    {"lib": "augraphy", "name": "InkBleed", "params": {}, "phase": "ink"},
                    {"lib": "albumentations", "name": "GaussNoise", "params": {}, "category": "pixel"},
                ]
                for label, p_in in [("grayscale_input", gray_in), ("rgba_input", rgba_in), ("tiny_64x64_input", tiny_in)]:
                    p_out = str(tmp_dir / f"out_{label}.png")
                    r = engine.execute_steps(p_in, p_out, None, step_edge, seed=42)
                    dec = cv2.imread(p_out, cv2.IMREAD_UNCHANGED)
                    if dec is None or dec.ndim != 3 or dec.shape[2] != 3 or dec.dtype != np.uint8:
                        failures.append((label, f"Output not 3ch uint8: {None if dec is None else dec.shape}"))

                # Large downscale ON (max_side=1600)
                p_large_ds = str(tmp_dir / "out_large_ds.png")
                r_ds = engine.execute_steps(
                    large_in,
                    p_large_ds,
                    None,
                    [{"lib": "albumentations", "name": "Blur", "params": {}}],
                    seed=42,
                    max_side=1600,
                )
                if max(r_ds["w"], r_ds["h"]) != 1600:
                    failures.append(("large_downscale_on", f"Expected max side 1600, got {r_ds['w']}x{r_ds['h']}"))

                # Large downscale OFF (max_side=None)
                p_large_full = str(tmp_dir / "out_large_full.png")
                r_full = engine.execute_steps(
                    large_in,
                    p_large_full,
                    None,
                    [{"lib": "albumentations", "name": "Blur", "params": {}}],
                    seed=42,
                    max_side=None,
                )
                if (r_full["w"], r_full["h"]) != (4000, 3000):
                    failures.append(("large_downscale_off", f"Expected 4000x3000, got {r_full['w']}x{r_full['h']}"))
            except Exception as exc:
                failures.append(("input_edge_cases", f"{type(exc).__name__}: {exc}"))

            # Worker timeout kill + respawn & crash recovery
            worker_failures = run_worker_resilience_tests(input_path, tmp_dir)
            failures.extend(worker_failures)

        elapsed = round(time.perf_counter() - t_start, 2)
        summary = {
            "elapsed_sec": elapsed,
            "total_ok_effects_tested": len(ok_effects),
            "coverage": coverage,
            "no_op_effects": no_op_effects,
            "failures": [{"name": name, "cause": cause} for name, cause in failures],
        }
        SUMMARY_FILE.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

        if failures:
            for name, cause in failures:
                print(f"FAIL: {name} — {cause}")
            return 1

        print(f"PASS: {len(ok_effects)} effects + modes/seeds/inputs/worker-recovery in {elapsed}s")
        return 0
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
