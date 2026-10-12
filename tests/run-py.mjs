import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "tests", "out");
fs.mkdirSync(outDir, { recursive: true });

const pyExe =
  process.platform === "win32"
    ? path.join(root, ".venv", "Scripts", "python.exe")
    : path.join(root, ".venv", "bin", "python");

const args = ["tests/py/run_py.py", ...process.argv.slice(2)];
const res = spawnSync(pyExe, args, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUNBUFFERED: "1",
    NO_ALBUMENTATIONS_UPDATE: "1",
  },
});

process.exit(res.status ?? 1);
