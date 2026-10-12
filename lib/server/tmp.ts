import fs from "node:fs/promises";
import path from "node:path";
import { AUG_TMP_ROOT } from "./paths";
import { isValidId } from "./validate";

export const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour
export const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

declare global {
  var __augTmpInitialized: boolean | undefined;
  var __augTmpSweeper: ReturnType<typeof setInterval> | undefined;
}

export async function sweepOldJobDirs(maxAgeMs: number = JOB_TTL_MS): Promise<void> {
  try {
    await fs.mkdir(AUG_TMP_ROOT, { recursive: true });
    const entries = await fs.readdir(AUG_TMP_ROOT, { withFileTypes: true });
    const now = Date.now();
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory() || entry.name.startsWith("_")) return;
        const dirPath = path.join(AUG_TMP_ROOT, entry.name);
        try {
          const stat = await fs.stat(dirPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            await fs.rm(dirPath, { recursive: true, force: true });
          }
        } catch {
          // ignore concurrent removal
        }
      })
    );
  } catch {
    // ignore sweep errors
  }
}

export async function ensureTmpRoot(): Promise<string> {
  await fs.mkdir(AUG_TMP_ROOT, { recursive: true });
  if (!globalThis.__augTmpInitialized) {
    globalThis.__augTmpInitialized = true;
    void sweepOldJobDirs(JOB_TTL_MS);
    if (!globalThis.__augTmpSweeper) {
      const timer = setInterval(() => {
        void sweepOldJobDirs(JOB_TTL_MS);
      }, SWEEP_INTERVAL_MS);
      if (typeof timer.unref === "function") {
        timer.unref();
      }
      globalThis.__augTmpSweeper = timer;
    }
  }
  return AUG_TMP_ROOT;
}

export function getJobDir(jobId: string): string {
  if (!isValidId(jobId)) {
    throw new Error("Mã phiên xử lý không hợp lệ.");
  }
  return path.join(AUG_TMP_ROOT, jobId);
}

export async function createJobDir(jobId: string): Promise<{
  jobDir: string;
  resDir: string;
  thumbDir: string;
}> {
  await ensureTmpRoot();
  const jobDir = getJobDir(jobId);
  const resDir = path.join(jobDir, "res");
  const thumbDir = path.join(jobDir, "thumb");
  await fs.mkdir(resDir, { recursive: true });
  await fs.mkdir(thumbDir, { recursive: true });
  return { jobDir, resDir, thumbDir };
}

export async function touchJobDir(jobId: string): Promise<void> {
  try {
    const jobDir = getJobDir(jobId);
    const now = new Date();
    await fs.utimes(jobDir, now, now);
  } catch {
    // ignore
  }
}
