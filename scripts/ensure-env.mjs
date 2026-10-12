#!/usr/bin/env node
// Cross-platform environment guard. Fast path (<1s): only stats files.
// Slow path (self-heal): find Python 3.10-3.12, create .venv, clone vendor repos,
// pip install (editable, PyPI fallback), keep exactly one OpenCV wheel, build catalog.
// Flags: --force (always run setup), --deep (verify imports even if stamp exists),
//        --no-smoke (build catalog without smoke test).
import { existsSync, statSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WIN = process.platform === "win32";
const VENV = join(ROOT, ".venv");
const VPY = IS_WIN ? join(VENV, "Scripts", "python.exe") : join(VENV, "bin", "python");
const STAMP = join(VENV, ".aug-ready");
const CATALOG = join(ROOT, "python", "catalog.json");
const VENDOR = join(ROOT, "vendor");
const REPOS = {
  augraphy: "https://github.com/sparkfish/augraphy",
  albumentations: "https://github.com/albumentations-team/albumentations",
};
const OPENCV_OTHERS = ["opencv-python", "opencv-contrib-python", "opencv-contrib-python-headless"];
const OPENCV_SPEC = "opencv-python-headless>=4.9,<5";
const args = new Set(process.argv.slice(2));

const log = (m) => console.log(`[ensure-env] ${m}`);
const run = (cmd, a, opts = {}) =>
  spawnSync(cmd, a, { cwd: ROOT, encoding: "utf8", stdio: opts.quiet ? "pipe" : "inherit", ...opts });

function fastOk() {
  if (args.has("--force") || args.has("--catalog")) return false;
  if (!existsSync(VPY) || !existsSync(STAMP) || !existsSync(CATALOG)) return false;
  try {
    // catalog must be a real build (not a placeholder)
    if (statSync(CATALOG).size < 1000 || !catalogOk()) return false;
  } catch {
    return false;
  }
  return true;
}

function importsOk(py = VPY) {
  const r = run(py, ["-c", "import cv2, augraphy, albumentations; print('ok')"], { quiet: true });
  return r.status === 0 && r.stdout.includes("ok");
}

function pyVersionOk(cmd, pre = []) {
  const r = run(cmd, [...pre, "-c", "import sys;print('%d.%d'%sys.version_info[:2])"], { quiet: true });
  if (r.status !== 0 || !r.stdout) return false;
  const [maj, min] = r.stdout.trim().split(".").map(Number);
  return maj === 3 && min >= 10 && min <= 12;
}

function findPython() {
  const cands = [];
  if (IS_WIN) {
    for (const v of ["3.12", "3.11", "3.10"]) cands.push(["py", [`-${v}`]]);
    const base = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Programs", "Python") : "";
    for (const v of ["312", "311", "310"]) {
      if (base) cands.push([join(base, `Python${v}`, "python.exe"), []]);
      cands.push([`C:\\Python${v}\\python.exe`, []]);
      if (process.env.ProgramFiles) cands.push([join(process.env.ProgramFiles, `Python${v}`, "python.exe"), []]);
    }
  }
  for (const v of ["3.12", "3.11", "3.10"]) cands.push([`python${v}`, []]);
  cands.push(["python3", []], ["python", []]);
  for (const [cmd, pre] of cands) {
    if (cmd.includes(IS_WIN ? "\\" : "/") && !existsSync(cmd)) continue;
    if (pyVersionOk(cmd, pre)) return [cmd, pre];
  }
  return null;
}

function pip(a, quiet = false) {
  return run(VPY, ["-m", "pip", ...a, "--disable-pip-version-check"], { quiet }).status === 0;
}

function fixOpenCV() {
  const r = run(VPY, ["-m", "pip", "list", "--format=json", "--disable-pip-version-check"], { quiet: true });
  let names = [];
  try {
    names = JSON.parse(r.stdout).map((p) => p.name.toLowerCase());
  } catch {}
  const extra = OPENCV_OTHERS.filter((n) => names.includes(n));
  if (extra.length) {
    log(`removing extra OpenCV wheels: ${extra.join(", ")}`);
    pip(["uninstall", "-y", ...extra]);
    // uninstalling a sibling wheel deletes shared cv2 files -> reinstall headless
    pip(["install", "--force-reinstall", "--no-deps", OPENCV_SPEC]);
  } else if (!names.includes("opencv-python-headless")) {
    pip(["install", OPENCV_SPEC]);
  }
}

function setup() {
  log("setting up Python environment (one-time, may take several minutes)...");
  if (!existsSync(VPY)) {
    const py = findPython();
    if (!py) {
      console.error("[ensure-env] Python 3.10-3.12 not found. Install it (https://www.python.org/downloads/) and retry.");
      process.exit(1);
    }
    log(`creating .venv with ${py[0]} ${py[1].join(" ")}`);
    if (run(py[0], [...py[1], "-m", "venv", VENV]).status !== 0) process.exit(1);
  }
  // setuptools<81 still ships pkg_resources (albumentations' setup.py imports it)
  pip(["install", "-q", "-U", "pip", "wheel", "setuptools<81"]);
  // headless first so albumentations' setup.py picks it and nothing pulls opencv-python.
  // OpenCV pinned to 4.x: augraphy is tested against 4.x APIs.
  pip(["install", "-q", OPENCV_SPEC, "numba", "numpy", "pillow"]);

  mkdirSync(VENDOR, { recursive: true });
  for (const [name, url] of Object.entries(REPOS)) {
    const dir = join(VENDOR, name);
    if (!existsSync(join(dir, ".git")) && !existsSync(join(dir, "setup.py"))) {
      log(`cloning ${name}`);
      run("git", ["clone", "--depth", "1", url, dir]);
    }
  }
  const albDir = join(VENDOR, "albumentations");
  const augDir = join(VENDOR, "augraphy");
  // augraphy deps from its own requirements.txt, minus opencv-python (we keep headless only)
  let augReq = ["matplotlib", "numba", "numpy", "Pillow", "requests", "scikit-image", "scikit-learn", "scipy"];
  try {
    augReq = readFileSync(join(augDir, "requirements.txt"), "utf8")
      .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !/^opencv/i.test(l));
  } catch {}
  pip(["install", "-q", ...augReq]);
  // albumentations: editable, fallback PyPI
  if (!(existsSync(albDir) && pip(["install", "-q", "--no-build-isolation", "-e", albDir]))) {
    log("editable albumentations failed -> PyPI");
    pip(["install", "-q", "albumentations"]);
  }
  // augraphy pins opencv-python; install without deps (deps already present)
  if (!(existsSync(augDir) && pip(["install", "-q", "--no-build-isolation", "--no-deps", "-e", augDir]))) {
    log("editable augraphy failed -> PyPI");
    pip(["install", "-q", "--no-deps", "augraphy"]);
  }
  fixOpenCV();
  if (!importsOk()) {
    console.error("[ensure-env] `import cv2, augraphy, albumentations` failed after setup.");
    process.exit(1);
  }
  writeFileSync(STAMP, new Date().toISOString());
  writeVersions();
}

function writeVersions() {
  const code = [
    "import sys, platform, cv2, numpy, numba, PIL, augraphy, albumentations",
    "print(f'| Python | {platform.python_version()} |')",
    "print(f'| numpy | {numpy.__version__} |')",
    "print(f'| numba | {numba.__version__} |')",
    "print(f'| OpenCV (cv2) | {cv2.__version__} |')",
    "print(f'| Pillow | {PIL.__version__} |')",
    "print(f'| augraphy | {getattr(augraphy, \"__version__\", \"?\")} |')",
    "print(f'| albumentations | {albumentations.__version__} |')",
  ].join("\n");
  const r = run(VPY, ["-c", code], { quiet: true });
  const node = `| Node | ${process.version} |`;
  const pipList = run(VPY, ["-m", "pip", "list", "--format=freeze", "--disable-pip-version-check"], { quiet: true });
  const cvWheels = (pipList.stdout || "").split(/\r?\n/).filter((l) => /^opencv/i.test(l));
  let next = "?";
  try {
    next = JSON.parse(readFileSync(join(ROOT, "node_modules", "next", "package.json"), "utf8")).version;
  } catch {}
  mkdirSync(join(ROOT, "docs"), { recursive: true });
  writeFileSync(
    join(ROOT, "docs", "VERSIONS.md"),
    `# Installed versions\n\nGenerated by \`scripts/ensure-env.mjs\` on ${new Date().toISOString()} (${os.platform()} ${os.arch()}).\n\n| Package | Version |\n|---|---|\n${(r.stdout || "").trim()}\n${node}\n| Next.js | ${next} |\n\nOpenCV wheels installed: ${cvWheels.join(", ") || "?"}\n\nVendor repos: \`vendor/augraphy\`, \`vendor/albumentations\` (git clone --depth 1, pip install -e).\n`
  );
}

function buildCatalog() {
  log("building python/catalog.json (introspection + smoke test)...");
  const a = [join(ROOT, "python", "build_catalog.py")];
  if (args.has("--no-smoke")) a.push("--no-smoke");
  if (run(VPY, a).status !== 0 || !existsSync(CATALOG)) {
    console.error("[ensure-env] catalog build failed");
    process.exit(1);
  }
}

if (fastOk()) {
  if (args.has("--deep") && !importsOk()) setup();
  if (args.has("--versions")) writeVersions();
  process.exit(0);
}
if (!existsSync(VPY) || !existsSync(STAMP) || args.has("--force") || !importsOk()) setup();
if (!catalogOk() || args.has("--force") || args.has("--catalog")) buildCatalog();
if (args.has("--versions")) writeVersions();

function catalogOk() {
  try {
    return readFileSync(CATALOG, "utf8").includes('"effects"');
  } catch {
    return false;
  }
}
log("environment ready");
