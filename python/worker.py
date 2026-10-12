from __future__ import annotations

import json
import os
import sys
import tempfile
import traceback
from pathlib import Path

# Ensure python/ directory and project root are on sys.path before changing cwd
THIS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = THIS_DIR.parent
for _p in (str(PROJECT_ROOT), str(THIS_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Move worker cwd into os.tmpdir()/aug-lab/_workers/w_<pid> so Augraphy's
# internal ./augraphy_cache writes never pollute the project tree or trigger Next.js HMR.
try:
    _WORKER_CWD = Path(tempfile.gettempdir()) / "aug-lab" / "_workers" / f"w_{os.getpid()}"
    _WORKER_CWD.mkdir(parents=True, exist_ok=True)
    os.chdir(_WORKER_CWD)
except Exception:
    pass

# Preserve real stdout fd exclusively for JSONL protocol responses;
# redirect sys.stdout to sys.stderr so library prints never corrupt protocol lines.
_PROTO_FD = os.dup(sys.stdout.fileno())
_PROTO_OUT = os.fdopen(_PROTO_FD, "w", encoding="utf-8", buffering=1)
sys.stdout = sys.stderr

def _start_parent_watchdog() -> None:
    ppid_str = os.environ.get("AUG_PARENT_PID")
    if not ppid_str:
        return
    try:
        ppid = int(ppid_str)
    except ValueError:
        return

    import threading

    def _watch() -> None:
        if sys.platform == "win32":
            import ctypes

            SYNCHRONIZE = 0x00100000
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.OpenProcess(SYNCHRONIZE, False, ppid)
            if handle:
                kernel32.WaitForSingleObject(handle, 0xFFFFFFFF)
                kernel32.CloseHandle(handle)
                os._exit(0)
        else:
            import time

            while True:
                time.sleep(0.5)
                if os.getppid() != ppid:
                    os._exit(0)

    t = threading.Thread(target=_watch, daemon=True)
    t.start()


_start_parent_watchdog()

import engine  # noqa: E402


def _send(payload: dict) -> None:
    _PROTO_OUT.write(json.dumps(payload, ensure_ascii=False) + "\n")
    _PROTO_OUT.flush()


def main() -> None:
    engine.warmup()
    _send({"ready": True, "versions": engine.get_versions()})

    for raw_line in sys.stdin:
        line = raw_line.lstrip("\ufeff").strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            op = req.get("op", "run")

            if op == "ping":
                _send({"id": req_id, "ok": True, "versions": engine.get_versions()})
                continue

            if op == "warmup":
                engine.warmup()
                _send({"id": req_id, "ok": True})
                continue

            if op == "shutdown":
                _send({"id": req_id, "ok": True})
                break

            if op == "sleep":
                import time
                time.sleep(float(req.get("seconds", 100)))
                _send({"id": req_id, "ok": True})
                continue

            if op == "crash":
                os._exit(1)

            if op == "prepare":
                res = engine.prepare_original(
                    input_path=req["input"],
                    out_path=req["out"],
                    thumb_path=req.get("thumb"),
                    max_side=req.get("maxSide"),
                    fmt=req.get("format", "png"),
                    quality=req.get("quality", 92),
                )
                _send({"id": req_id, "ok": True, **res})
                continue

            if op in ("run", "chain"):
                steps = req.get("steps")
                if not steps:
                    steps = [
                        {
                            "lib": req["lib"],
                            "name": req["name"],
                            "params": req.get("params") or {},
                        }
                    ]
                res = engine.execute_steps(
                    input_path=req["input"],
                    out_path=req["out"],
                    thumb_path=req.get("thumb"),
                    steps=steps,
                    seed=int(req.get("seed", 42)),
                    fmt=req.get("format", "png"),
                    quality=int(req.get("quality", 92)),
                    max_side=req.get("maxSide"),
                )
                _send({"id": req_id, "ok": True, **res})
                continue

            _send({"id": req_id, "ok": False, "error": f"Unknown op: {op}"})
        except Exception as exc:
            _send(
                {
                    "id": req_id,
                    "ok": False,
                    "error": f"{type(exc).__name__}: {exc}",
                    "trace": traceback.format_exc(limit=5),
                }
            )


if __name__ == "__main__":
    main()
