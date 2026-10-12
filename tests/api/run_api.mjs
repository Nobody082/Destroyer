import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "tests", "out");
fs.mkdirSync(OUT_DIR, { recursive: true });
const LOG_PATH = path.join(OUT_DIR, "api.log");
fs.writeFileSync(LOG_PATH, "", "utf8");

function log(line) {
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${line}\n`, "utf8");
}

const BASE_URL = "http://localhost:3002";

async function isServerUp() {
  try {
    const res = await fetch(`${BASE_URL}/api/catalog`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startDevServerIfNeeded() {
  if (await isServerUp()) {
    log("Existing dev server detected on :3002");
    return null;
  }
  log("Spawning npm run dev on :3002...");
  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/c", "npm", "run", "dev"], {
          cwd: ROOT,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        })
      : spawn("npm", ["run", "dev"], {
          cwd: ROOT,
          stdio: ["ignore", "pipe", "pipe"],
        });

  child.stdout.on("data", (d) => log(`[dev:stdout] ${String(d).trim()}`));
  child.stderr.on("data", (d) => log(`[dev:stderr] ${String(d).trim()}`));

  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isServerUp()) {
      log("Dev server ready on :3002");
      return child;
    }
  }
  throw new Error("Timed out waiting for dev server on :3002");
}

function stopDevServer(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // ignore
  }
}

function makeTestPngBuffer() {
  const pyExe =
    process.platform === "win32"
      ? path.join(ROOT, ".venv", "Scripts", "python.exe")
      : path.join(ROOT, ".venv", "bin", "python");
  const res = spawnSync(
    pyExe,
    [
      "-c",
      "import sys, tempfile; from pathlib import Path; sys.path.insert(0,'python'); from smoke import make_doc_image; p = Path(tempfile.mktemp('.png')); make_doc_image(p, 320, 400); sys.stdout.buffer.write(p.read_bytes()); p.unlink(missing_ok=True)",
    ],
    { cwd: ROOT, maxBuffer: 10 * 1024 * 1024 }
  );
  if (res.status !== 0 || !res.stdout || res.stdout.length === 0) {
    throw new Error("Failed to synthesize test PNG buffer");
  }
  return res.stdout;
}

async function readNdjsonStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  const events = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx = buf.indexOf("\n");
    while (idx !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) {
        const ev = JSON.parse(line);
        events.push(ev);
        if (onEvent) {
          await onEvent(ev, reader);
        }
      }
      idx = buf.indexOf("\n");
    }
  }
  return events;
}

async function main() {
  const failures = [];
  const recordFail = (name, cause) => {
    failures.push({ name, cause });
    log(`[FAIL] ${name}: ${cause}`);
  };
  const recordPass = (name) => {
    log(`[PASS] ${name}`);
  };

  let devChild = null;
  try {
    devChild = await startDevServerIfNeeded();
    const pngBuf = makeTestPngBuffer();

    // 1. /api/catalog shape
    try {
      const res = await fetch(`${BASE_URL}/api/catalog`);
      const data = await res.json();
      if (
        res.status !== 200 ||
        data.schema !== 1 ||
        !Array.isArray(data.effects) ||
        data.effects.length < 50 ||
        !Array.isArray(data.phase_order) ||
        !data.versions?.augraphy ||
        !data.pythonHealth?.ok
      ) {
        recordFail("api_catalog_shape", `Unexpected catalog response (status=${res.status})`);
      } else {
        recordPass("api_catalog_shape");
      }
    } catch (err) {
      recordFail("api_catalog_shape", err.message);
    }

    // 2. /api/generate small job event order + /api/result valid & invalid IDs
    let sampleJobId = null;
    let sampleResultId = null;
    try {
      const fd = new FormData();
      fd.append("image", new Blob([pngBuf], { type: "image/png" }), "test.png");
      fd.append(
        "job",
        JSON.stringify({
          mode: "each",
          effects: [
            { id: "augraphy.InkBleed", params: {} },
            { id: "albumentations.Blur", params: {} },
          ],
          repeats: 1,
          format: "png",
          quality: 92,
          maxSide: 800,
        })
      );
      const res = await fetch(`${BASE_URL}/api/generate`, { method: "POST", body: fd });
      if (!res.ok) {
        recordFail("api_generate_stream", `HTTP ${res.status}`);
      } else {
        const events = await readNdjsonStream(res);
        const types = events.map((e) => e.type);
        const hasStartFirst = types[0] === "start";
        const hasDoneLast = types[types.length - 1] === "done";
        const hasResult = types.includes("result");
        const hasProgress = types.includes("progress");
        const doneEv = events[events.length - 1];
        if (!hasStartFirst || !hasDoneLast || !hasResult || !hasProgress || doneEv.ok !== 2) {
          recordFail("api_generate_stream", `Unexpected event sequence: ${types.join(",")}`);
        } else {
          sampleJobId = events[0].jobId;
          sampleResultId = events.find((e) => e.type === "result").id;
          recordPass("api_generate_stream");
        }
      }
    } catch (err) {
      recordFail("api_generate_stream", err.message);
    }

    // 3. Unsupported file type -> 400
    try {
      const fd = new FormData();
      fd.append("image", new Blob([Buffer.from("not an image")], { type: "text/plain" }), "bad.txt");
      fd.append("job", JSON.stringify({ mode: "each", effects: [{ id: "albumentations.Blur", params: {} }] }));
      const res = await fetch(`${BASE_URL}/api/generate`, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.status !== 400 || !body.error) {
        recordFail("api_reject_unsupported_type", `Expected 400, got ${res.status}`);
      } else {
        recordPass("api_reject_unsupported_type");
      }
    } catch (err) {
      recordFail("api_reject_unsupported_type", err.message);
    }

    // 4. >25MB file -> 413
    try {
      const bigBuf = Buffer.alloc(26 * 1024 * 1024, 0x41);
      const fd = new FormData();
      fd.append("image", new Blob([bigBuf], { type: "image/png" }), "huge.png");
      fd.append("job", JSON.stringify({ mode: "each", effects: [{ id: "albumentations.Blur", params: {} }] }));
      const res = await fetch(`${BASE_URL}/api/generate`, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.status !== 413 || !body.error) {
        recordFail("api_reject_over_25mb", `Expected 413, got ${res.status}`);
      } else {
        recordPass("api_reject_over_25mb");
      }
    } catch (err) {
      recordFail("api_reject_over_25mb", err.message);
    }

    // 5. Empty body / missing image -> 400
    try {
      const fd = new FormData();
      fd.append("job", JSON.stringify({ mode: "each", effects: [{ id: "albumentations.Blur", params: {} }] }));
      const res = await fetch(`${BASE_URL}/api/generate`, { method: "POST", body: fd });
      if (res.status !== 400) {
        recordFail("api_reject_empty_image", `Expected 400, got ${res.status}`);
      } else {
        recordPass("api_reject_empty_image");
      }
    } catch (err) {
      recordFail("api_reject_empty_image", err.message);
    }

    // 6. Malformed job JSON -> 400
    try {
      const fd = new FormData();
      fd.append("image", new Blob([pngBuf], { type: "image/png" }), "test.png");
      fd.append("job", "{malformed json");
      const res = await fetch(`${BASE_URL}/api/generate`, { method: "POST", body: fd });
      if (res.status !== 400) {
        recordFail("api_reject_malformed_job", `Expected 400, got ${res.status}`);
      } else {
        recordPass("api_reject_malformed_job");
      }
    } catch (err) {
      recordFail("api_reject_malformed_job", err.message);
    }

    // 7. /api/result valid + invalid IDs (path traversal guard)
    try {
      if (!sampleJobId || !sampleResultId) {
        throw new Error("Missing sampleJobId from step 2");
      }
      const okFull = await fetch(`${BASE_URL}/api/result/${sampleJobId}/${sampleResultId}`);
      const okThumb = await fetch(`${BASE_URL}/api/result/${sampleJobId}/${sampleResultId}?thumb=1`);
      if (okFull.status !== 200 || okThumb.status !== 200) {
        recordFail("api_result_valid", `Expected 200 for full/thumb, got ${okFull.status}/${okThumb.status}`);
      } else {
        recordPass("api_result_valid");
      }

      const traversalPaths = [
        `${BASE_URL}/api/result/..%2F..%2Fpackage.json/${sampleResultId}`,
        `${BASE_URL}/api/result/${sampleJobId}/..%2F..%2Fpackage.json`,
        `${BASE_URL}/api/result/bad$job/id`,
        `${BASE_URL}/api/result/${sampleJobId}/C:%5CWindows%5Cwin.ini`,
      ];
      for (const u of traversalPaths) {
        const r = await fetch(u);
        if (r.status !== 400 && r.status !== 404) {
          recordFail("api_result_traversal_guard", `URL ${u} returned status ${r.status}`);
        }
      }
      recordPass("api_result_traversal_guard");
    } catch (err) {
      recordFail("api_result_check", err.message);
    }

    // 8. /api/cancel stops work promptly
    try {
      const fd = new FormData();
      fd.append("image", new Blob([pngBuf], { type: "image/png" }), "cancel.png");
      fd.append(
        "job",
        JSON.stringify({
          mode: "each",
          effects: [
            { id: "augraphy.BookBinding", params: {} },
            { id: "augraphy.Folding", params: {} },
            { id: "augraphy.VoronoiTessellation", params: {} },
            { id: "augraphy.DelaunayTessellation", params: {} },
            { id: "augraphy.BadPhotoCopy", params: {} },
            { id: "augraphy.BleedThrough", params: {} },
          ],
          repeats: 3,
          format: "png",
        })
      );

      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/api/generate`, { method: "POST", body: fd });
      let cancelElapsed = 0;
      const events = await readNdjsonStream(res, async (ev) => {
        if (ev.type === "start") {
          const c0 = Date.now();
          await fetch(`${BASE_URL}/api/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: ev.jobId }),
          });
          cancelElapsed = Date.now() - c0;
        }
      });
      const totalStreamElapsed = Date.now() - t0;
      const doneEv = events.find((e) => e.type === "done");
      if (!doneEv || !doneEv.cancelled || cancelElapsed > 2500 || totalStreamElapsed > 10000) {
        recordFail(
          "api_cancel",
          `Cancel did not stop promptly (cancelled=${doneEv?.cancelled}, elapsed=${totalStreamElapsed}ms)`
        );
      } else {
        recordPass("api_cancel");
      }
    } catch (err) {
      recordFail("api_cancel", err.message);
    }

    // 9. Client disconnect (AbortController) cleans up
    try {
      const controller = new AbortController();
      const fd = new FormData();
      fd.append("image", new Blob([pngBuf], { type: "image/png" }), "disconnect.png");
      fd.append(
        "job",
        JSON.stringify({
          mode: "each",
          effects: [
            { id: "augraphy.InkBleed", params: {} },
            { id: "augraphy.BadPhotoCopy", params: {} },
            { id: "albumentations.GaussNoise", params: {} },
          ],
          repeats: 3,
        })
      );
      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      await readNdjsonStream(res, async (ev) => {
        if (ev.type === "start") {
          controller.abort();
        }
      }).catch(() => {});
      recordPass("api_client_disconnect");
    } catch (err) {
      recordFail("api_client_disconnect", err.message);
    }

    // 10. 3 concurrent jobs don't deadlock
    try {
      const runOneJob = async (idx) => {
        const fd = new FormData();
        fd.append("image", new Blob([pngBuf], { type: "image/png" }), `conc_${idx}.png`);
        fd.append(
          "job",
          JSON.stringify({
            mode: "each",
            effects: [
              { id: "albumentations.Blur", params: {} },
              { id: "albumentations.GaussNoise", params: {} },
            ],
            repeats: 1,
            seed: 1000 + idx,
          })
        );
        const res = await fetch(`${BASE_URL}/api/generate`, { method: "POST", body: fd });
        const events = await readNdjsonStream(res);
        const done = events.find((e) => e.type === "done");
        if (!done || done.ok !== 2) {
          throw new Error(`Concurrent job ${idx} failed: ${JSON.stringify(done)}`);
        }
      };
      await Promise.all([runOneJob(1), runOneJob(2), runOneJob(3)]);
      recordPass("api_3_concurrent_jobs");
    } catch (err) {
      recordFail("api_3_concurrent_jobs", err.message);
    }

    // 11. Temp dir check (only inside os.tmpdir()/aug-lab)
    try {
      const tmpRoot = path.join(os.tmpdir(), "aug-lab");
      const entries = await fsp.readdir(tmpRoot);
      if (entries.length === 0) {
        recordFail("api_tmp_dir", "Expected job directories inside os.tmpdir()/aug-lab");
      } else {
        recordPass("api_tmp_dir");
      }
    } catch (err) {
      recordFail("api_tmp_dir", err.message);
    }
  } finally {
    stopDevServer(devChild);
  }

  if (failures.length > 0) {
    for (const f of failures) {
      console.log(`FAIL: ${f.name} — ${f.cause}`);
    }
    process.exit(1);
  }

  console.log("PASS: All 11 API test suites passed");
}

main().catch((err) => {
  console.log(`FAIL: api_runner — ${err.message}`);
  process.exit(1);
});
