import os from "node:os";
import path from "node:path";

export const PROJECT_ROOT = process.cwd();

export function getPythonExe(): string {
  if (process.platform === "win32") {
    return path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe");
  }
  return path.join(PROJECT_ROOT, ".venv", "bin", "python");
}

export const CATALOG_PATH = path.join(PROJECT_ROOT, "python", "catalog.json");
export const WORKER_SCRIPT = path.join(PROJECT_ROOT, "python", "worker.py");
export const AUG_TMP_ROOT = path.join(os.tmpdir(), "aug-lab");
