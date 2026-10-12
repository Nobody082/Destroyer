import { execSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "tests", "out");
fs.mkdirSync(OUT_DIR, { recursive: true });
const LOG_PATH = path.join(OUT_DIR, "fresh-start.log");
fs.writeFileSync(LOG_PATH, "", "utf8");

function log(msg) {
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`, "utf8");
}

function killWorkerProcesses() {
  if (process.platform === "win32") {
    spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'python*' -and $_.CommandLine -like '*worker.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ],
      { windowsHide: true }
    );
  }
}

function countWorkerProcesses() {
  if (process.platform === "win32") {
    const r = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "@(Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'python*' -and $_.CommandLine -like '*worker.py*' }).Count",
      ],
      { encoding: "utf8", windowsHide: true }
    );
    return parseInt((r.stdout || "0").trim(), 10) || 0;
  }
  return 0;
}

async function main() {
  // 1. Layer 1 static checks
  log("Running tsc --noEmit...");
  execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
  log("Running npm run lint...");
  execSync("npm run lint", { cwd: ROOT, stdio: "pipe" });
  log("Running npx next build...");
  execSync("npx next build", { cwd: ROOT, stdio: "pipe" });

  // 2. Delete .next and python/__pycache__ and kill any leftover workers
  fs.rmSync(path.join(ROOT, ".next"), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, "python", "__pycache__"), { recursive: true, force: true });
  killWorkerProcesses();

  // 3. Start ONLY npm run dev
  log("Starting npm run dev from clean state...");
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

  child.stdout.on("data", (d) => log(`[dev] ${String(d).trim()}`));
  child.stderr.on("data", (d) => log(`[dev:err] ${String(d).trim()}`));

  try {
    let up = false;
    for (let i = 0; i < 45; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch("http://localhost:3002/", { signal: AbortSignal.timeout(2000) });
        if (res.status === 200) {
          up = true;
          break;
        }
      } catch {
        // wait
      }
    }
    if (!up) throw new Error("Port 3002 did not serve 200 after fresh start");

    // 4. First generation (cold Numba warm-up)
    const pyExe =
      process.platform === "win32"
        ? path.join(ROOT, ".venv", "Scripts", "python.exe")
        : path.join(ROOT, ".venv", "bin", "python");
    const pngRes = spawnSync(
      pyExe,
      [
        "-c",
        "import sys, tempfile; from pathlib import Path; sys.path.insert(0,'python'); from smoke import make_doc_image; p = Path(tempfile.mktemp('.png')); make_doc_image(p, 300, 400); sys.stdout.buffer.write(p.read_bytes()); p.unlink(missing_ok=True)",
      ],
      { cwd: ROOT, maxBuffer: 10 * 1024 * 1024 }
    );

    const fd = new FormData();
    fd.append("image", new Blob([pngRes.stdout], { type: "image/png" }), "fresh.png");
    fd.append(
      "job",
      JSON.stringify({
        mode: "each",
        effects: [{ id: "augraphy.InkBleed", params: {} }],
        repeats: 1,
        format: "png",
      })
    );

    const genRes = await fetch("http://localhost:3002/api/generate", { method: "POST", body: fd });
    const raw = await genRes.text();
    const events = raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
    const done = events.find((e) => e.type === "done");
    if (!done || done.ok !== 1) {
      throw new Error(`First generation after fresh start failed: ${JSON.stringify(done)}`);
    }
    log("First generation succeeded on cold start.");
  } finally {
    if (child.pid) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      } else {
        child.kill("SIGKILL");
      }
    }
  }

  await new Promise((r) => setTimeout(r, 1500));
  const leftovers = countWorkerProcesses();
  if (leftovers > 0) {
    killWorkerProcesses();
    throw new Error(`Found ${leftovers} leftover python worker processes after stopping dev server`);
  }

  // Remove .next so dev starts clean next time
  fs.rmSync(path.join(ROOT, ".next"), { recursive: true, force: true });
  console.log("PASS: Layer 1 (tsc/lint/build) + Layer 5 (Fresh-start simulation, 0 leftover workers)");
}

main().catch((err) => {
  console.log(`FAIL: fresh_start — ${err.message}`);
  process.exit(1);
});
