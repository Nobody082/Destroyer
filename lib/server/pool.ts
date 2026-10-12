import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPythonExe, PROJECT_ROOT, WORKER_SCRIPT } from "./paths";
import { PythonWorker, type WorkerTaskRequest, type WorkerTaskResponse } from "./worker";

export const TASK_TIMEOUT_MS = 90_000;

function getPythonScriptsStamp(): string {
  try {
    const wStat = fs.statSync(WORKER_SCRIPT);
    const eStat = fs.statSync(path.join(PROJECT_ROOT, "python", "engine.py"));
    return `${Math.floor(wStat.mtimeMs)}:${Math.floor(eStat.mtimeMs)}`;
  } catch {
    return "0:0";
  }
}

interface QueuedTask {
  req: WorkerTaskRequest;
  jobId?: string;
  timeoutMs: number;
  resolve: (res: WorkerTaskResponse) => void;
  reject: (err: Error) => void;
}

export interface ActiveJobState {
  jobId: string;
  cancelled: boolean;
  startedAt: number;
}

export class WorkerPool {
  public readonly size: number;
  private workers: PythonWorker[] = [];
  private queue: QueuedTask[] = [];
  private jobs = new Map<string, ActiveJobState>();
  private nextWorkerId = 1;
  private initPromise: Promise<void> | null = null;
  private lastInitError: string | null = null;
  private scriptsStamp = "";

  constructor() {
    const cpus = os.cpus()?.length ?? 2;
    this.size = Math.max(1, Math.min(4, cpus - 1));
    this.scriptsStamp = getPythonScriptsStamp();
  }

  public checkPythonEnv(): { ok: boolean; pythonExe: string; error?: string; fixCommand?: string } {
    const pyExe = getPythonExe();
    if (!fs.existsSync(pyExe)) {
      return {
        ok: false,
        pythonExe: pyExe,
        error: "Không tìm thấy môi trường Python (.venv).",
        fixCommand: "npm run setup:env",
      };
    }
    if (this.lastInitError) {
      return {
        ok: false,
        pythonExe: pyExe,
        error: this.lastInitError,
        fixCommand: "npm run setup:env",
      };
    }
    return { ok: true, pythonExe: pyExe };
  }

  public async ensureStarted(): Promise<void> {
    const currentStamp = getPythonScriptsStamp();
    if (this.scriptsStamp !== currentStamp && this.workers.every((w) => !w.busy)) {
      this.scriptsStamp = currentStamp;
      for (const w of this.workers) {
        w.forceKill("Tải lại mã nguồn Python worker.");
      }
      this.workers = [];
    }

    if (this.workers.length > 0 && this.workers.some((w) => w.alive)) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.lastInitError = null;
        this.scriptsStamp = getPythonScriptsStamp();
        const needed = this.size - this.workers.length;
        const spawned: PythonWorker[] = [];
        for (let i = 0; i < needed; i++) {
          const w = this.spawnWorker();
          spawned.push(w);
        }
        await Promise.all(spawned.map((w) => w.start()));
      } catch (err) {
        this.lastInitError = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private spawnWorker(): PythonWorker {
    const idx = this.nextWorkerId++;
    const worker = new PythonWorker(idx, (crashed) => {
      this.handleWorkerCrash(crashed);
    });
    this.workers.push(worker);
    return worker;
  }

  private handleWorkerCrash(crashed: PythonWorker): void {
    this.workers = this.workers.filter((w) => w !== crashed);
    if (this.workers.length < this.size) {
      const replacement = this.spawnWorker();
      replacement
        .start()
        .then(() => {
          this.drainQueue();
        })
        .catch((err) => {
          this.lastInitError = err instanceof Error ? err.message : String(err);
        });
    }
  }

  public registerJob(jobId: string): ActiveJobState {
    const state: ActiveJobState = {
      jobId,
      cancelled: false,
      startedAt: Date.now(),
    };
    this.jobs.set(jobId, state);
    return state;
  }

  public isJobCancelled(jobId?: string): boolean {
    if (!jobId) return false;
    return this.jobs.get(jobId)?.cancelled === true;
  }

  public finishJob(jobId: string): void {
    // Keep cancelled flag briefly in case late tasks check it, then remove
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 30_000).unref?.();
  }

  public cancelJob(jobId: string): boolean {
    const state = this.jobs.get(jobId);
    if (state) {
      state.cancelled = true;
    } else {
      this.jobs.set(jobId, { jobId, cancelled: true, startedAt: Date.now() });
    }

    // 1. Drop queued tasks for this jobId
    const remaining: QueuedTask[] = [];
    for (const item of this.queue) {
      if (item.jobId === jobId) {
        item.reject(new Error("Đã huỷ theo yêu cầu người dùng."));
      } else {
        remaining.push(item);
      }
    }
    this.queue = remaining;

    // 2. Kill + respawn any workers currently executing a task for this jobId
    const busyForJob = this.workers.filter((w) => w.currentJobId === jobId);
    for (const w of busyForJob) {
      this.workers = this.workers.filter((item) => item !== w);
      w.forceKill("Đã huỷ theo yêu cầu người dùng.");
      const replacement = this.spawnWorker();
      void replacement.start().then(() => this.drainQueue()).catch(() => {});
    }

    this.drainQueue();
    return true;
  }

  public async runTask(req: WorkerTaskRequest, timeoutMs = TASK_TIMEOUT_MS): Promise<WorkerTaskResponse> {
    if (req.job && this.isJobCancelled(req.job)) {
      throw new Error("Đã huỷ theo yêu cầu người dùng.");
    }

    await this.ensureStarted();

    if (req.job && this.isJobCancelled(req.job)) {
      throw new Error("Đã huỷ theo yêu cầu người dùng.");
    }

    return new Promise<WorkerTaskResponse>((resolve, reject) => {
      this.queue.push({
        req,
        jobId: req.job,
        timeoutMs,
        resolve,
        reject,
      });
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    while (this.queue.length > 0) {
      const idleWorker = this.workers.find((w) => w.alive && !w.busy);
      if (!idleWorker) {
        break;
      }

      const nextTask = this.queue.shift()!;
      if (nextTask.jobId && this.isJobCancelled(nextTask.jobId)) {
        nextTask.reject(new Error("Đã huỷ theo yêu cầu người dùng."));
        continue;
      }

      idleWorker
        .execute(nextTask.req, nextTask.timeoutMs)
        .then((res) => {
          nextTask.resolve(res);
        })
        .catch((err) => {
          nextTask.reject(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          this.drainQueue();
        });
    }
  }

  public shutdownAll(): void {
    for (const item of this.queue) {
      item.reject(new Error("Máy chủ đang tắt."));
    }
    this.queue = [];
    for (const w of this.workers) {
      w.forceKill("Máy chủ đang tắt.");
    }
    this.workers = [];
  }
}

const POOL_SCHEMA_VERSION = 2;

declare global {
  var __augPool: WorkerPool | undefined;
  var __augPoolSchemaVersion: number | undefined;
  var __augPoolExitHooked: boolean | undefined;
}

export function getWorkerPool(): WorkerPool {
  if (!globalThis.__augPool || globalThis.__augPoolSchemaVersion !== POOL_SCHEMA_VERSION) {
    globalThis.__augPool?.shutdownAll();
    globalThis.__augPool = new WorkerPool();
    globalThis.__augPoolSchemaVersion = POOL_SCHEMA_VERSION;
  }
  if (!globalThis.__augPoolExitHooked) {
    globalThis.__augPoolExitHooked = true;
    process.once("exit", () => {
      globalThis.__augPool?.shutdownAll();
    });
  }
  return globalThis.__augPool;
}
