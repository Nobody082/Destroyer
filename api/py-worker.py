"""Single-task Python Function for Vercel; inputs and outputs live in private Blob."""
from __future__ import annotations

import json
import hmac
import os
import re
import tempfile
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

from vercel.blob import AsyncBlobClient

import python.engine as engine


SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,128}$")
MAX_BODY = 2 * 1024 * 1024
_WARMED = False


async def _read_blob(client: AsyncBlobClient, pathname: str, destination: Path) -> None:
    blob = await client.get(pathname, access="private")
    if blob is None or blob.status_code != 200 or blob.stream is None:
        raise FileNotFoundError("Ảnh tải lên không tồn tại hoặc đã hết hạn.")
    with destination.open("wb") as output:
        async for chunk in blob.stream:
            output.write(chunk)


class handler(BaseHTTPRequestHandler):
    def _json(self, status: int, value: dict[str, Any]) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        token = os.environ.get("BLOB_READ_WRITE_TOKEN")
        authorization = self.headers.get("Authorization", "")
        if not token or not hmac.compare_digest(authorization, f"Bearer {token}"):
            self._json(401, {"error": "Không được phép gọi Python Function."})
            return

        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > MAX_BODY:
                self._json(413, {"error": "Yêu cầu xử lý không hợp lệ."})
                return
            data = json.loads(self.rfile.read(size))
            job_id = str(data.get("jobId", ""))
            task_id = str(data.get("taskId", ""))
            source = str(data.get("inputPath", ""))
            operation = data.get("op")
            if not SAFE_ID.fullmatch(job_id) or not SAFE_ID.fullmatch(task_id):
                self._json(400, {"error": "Mã tác vụ không hợp lệ."})
                return
            if not source.startswith("uploads/") or ".." in source:
                self._json(400, {"error": "Đường dẫn ảnh không hợp lệ."})
                return
            if operation not in ("prepare", "chain"):
                self._json(400, {"error": "Thao tác Python không hợp lệ."})
                return

            self._run_task(data)
        except Exception as error:
            self._json(500, {"error": str(error) or "Python Function xử lý ảnh thất bại."})

    def _run_task(self, data: dict[str, Any]) -> None:
        import asyncio

        global _WARMED

        async def process() -> dict[str, Any]:
            nonlocal_warmed = _WARMED
            async with AsyncBlobClient() as client:
                return await process_with_client(client, data, nonlocal_warmed)

        async def process_with_client(client: AsyncBlobClient, payload: dict[str, Any], warmed: bool) -> dict[str, Any]:
            global _WARMED
            if not warmed:
                engine.warmup()
                _WARMED = True
            job_id = str(payload["jobId"])
            task_id = str(payload["taskId"])
            fmt = str(payload.get("format", "png"))
            if fmt not in ("png", "jpg", "webp"):
                raise ValueError("Định dạng đầu ra không hợp lệ.")
            ext = "jpg" if fmt == "jpg" else fmt
            with tempfile.TemporaryDirectory(prefix="destroyer-") as tmp:
                root = Path(tmp)
                source_path = root / "input"
                out_path = root / f"{task_id}.{ext}"
                thumb_path = root / f"{task_id}.webp"
                await _read_blob(client, str(payload["inputPath"]), source_path)
                if payload["op"] == "prepare":
                    result = engine.prepare_original(
                        str(source_path), str(out_path), str(thumb_path), payload.get("maxSide"), fmt, int(payload.get("quality", 92))
                    )
                else:
                    steps = payload.get("steps")
                    if not isinstance(steps, list) or not steps:
                        raise ValueError("Danh sách hiệu ứng trống.")
                    result = engine.execute_steps(
                        str(source_path), str(out_path), str(thumb_path), steps,
                        int(payload.get("seed", 42)), fmt, int(payload.get("quality", 92)), payload.get("maxSide")
                    )

                pathname = f"jobs/{job_id}/res/{task_id}.{ext}"
                thumbname = f"jobs/{job_id}/thumb/{task_id}.webp"
                mime = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}[ext]
                await client.put(pathname, out_path.read_bytes(), access="private", add_random_suffix=False, content_type=mime)
                await client.put(thumbname, thumb_path.read_bytes(), access="private", add_random_suffix=False, content_type="image/webp")
                return {"ok": True, "w": result["w"], "h": result["h"], "ms": result["ms"], "changed": result["changed"]}

        result = asyncio.run(process())
        self._json(200, result)

    def log_message(self, _format: str, *_args: Any) -> None:
        return

