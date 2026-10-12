import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { AUG_TMP_ROOT, getPythonExe, PROJECT_ROOT, WORKER_SCRIPT } from "./paths";

export interface WorkerStepInput {
  lib: "augraphy" | "albumentations";
  name: string;
  params?: Record<string, unknown>;
  phase?: "ink" | "paper" | "post";
  category?: "pixel" | "spatial";
}

export interface WorkerTaskRequest {
  id: string;
  op: "run" | "chain" | "prepare" | "ping" | "warmup" | "shutdown";
  job?: string;
  input?: string;
  out?: string;
  thumb?: string;
  steps?: WorkerStepInput[];
  lib?: "augraphy" | "albumentations";
  name?: string;
  params?: Record<string, unknown>;
  seed?: number;
  format?: "png" | "jpg" | "webp";
  quality?: number;
  maxSide?: number | null;
}

export interface WorkerTaskResponse {
  id: string;
  ok: boolean;
  out?: string;
  thumb?: string;
  ms?: number;
  w?: number;
  h?: number;
  changed?: boolean;
  error?: string;
  trace?: string;
  versions?: Record<string, string>;
}

interface ActiveTask {
  req: WorkerTaskRequest;
  jobId?: string;
  resolve: (res: WorkerTaskResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class PythonWorker {
  public readonly workerIndex: number;
  private child: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuf = "";
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;
  private isReady = false;
  private isDestroyed = false;
  private activeTask: ActiveTask | null = null;
  public versions: Record<string, string> = {};
  private onCrashCallback?: (worker: PythonWorker) => void;

  constructor(workerIndex: number, onCrash?: (worker: PythonWorker) => void) {
    this.workerIndex = workerIndex;
    this.onCrashCallback = onCrash;
  }

  public get busy(): boolean {
    return this.activeTask !== null;
  }

  public get currentJobId(): string | undefined {
    return this.activeTask?.jobId;
  }

  public get alive(): boolean {
    return !this.isDestroyed && this.child !== null && this.child.exitCode === null;
  }

  public async start(startupTimeoutMs = 60_000): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    const pyExe = getPythonExe();
    if (!fs.existsSync(pyExe)) {
      throw new Error(
        `Không tìm thấy môi trường Python tại ${pyExe}. Chạy lệnh "npm run setup:env" hoặc "npm run dev" để tự động cài đặt.`
      );
    }

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    const startupTimer = setTimeout(() => {
      if (!this.isReady) {
        const err = new Error("Khởi động Python worker quá thời gian (60 giây).");
        this.readyReject?.(err);
        this.forceKill();
      }
    }, startupTimeoutMs);

    try {
      const workerCwd = path.join(AUG_TMP_ROOT, "_workers", `slot_${this.workerIndex}`);
      fs.mkdirSync(workerCwd, { recursive: true });

      const child = spawn(pyExe, ["-u", WORKER_SCRIPT], {
        cwd: workerCwd,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONPATH: PROJECT_ROOT,
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1",
          NO_ALBUMENTATIONS_UPDATE: "1",
          AUG_PARENT_PID: String(process.pid),
        },
      });

      this.child = child;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk: string) => {
        this.stdoutBuf += chunk;
        let idx = this.stdoutBuf.indexOf("\n");
        while (idx !== -1) {
          const line = this.stdoutBuf.slice(0, idx).trim();
          this.stdoutBuf = this.stdoutBuf.slice(idx + 1);
          if (line) {
            this.handleLine(line, startupTimer);
          }
          idx = this.stdoutBuf.indexOf("\n");
        }
      });

      child.stderr.on("data", (chunk: string) => {
        const trimmed = chunk.trim();
        if (trimmed && process.env.NODE_ENV !== "production") {
          // Server log only
          console.warn(`[py-worker-${this.workerIndex}]`, trimmed.slice(0, 400));
        }
      });

      child.on("error", (err) => {
        clearTimeout(startupTimer);
        this.handleExit(err);
      });

      child.on("exit", (code, signal) => {
        clearTimeout(startupTimer);
        this.handleExit(
          new Error(`Python worker đã dừng đột ngột (code=${code ?? "null"}, signal=${signal ?? "null"}).`)
        );
      });
    } catch (err) {
      clearTimeout(startupTimer);
      this.readyReject?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }

    return this.readyPromise;
  }

  private handleLine(line: string, startupTimer: ReturnType<typeof setTimeout>): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }

    if (!this.isReady && parsed.ready === true) {
      this.isReady = true;
      clearTimeout(startupTimer);
      if (parsed.versions && typeof parsed.versions === "object") {
        this.versions = parsed.versions as Record<string, string>;
      }
      this.readyResolve?.();
      return;
    }

    if (this.activeTask && parsed.id === this.activeTask.req.id) {
      const task = this.activeTask;
      this.activeTask = null;
      clearTimeout(task.timer);
      task.resolve(parsed as unknown as WorkerTaskResponse);
    }
  }

  private handleExit(err: Error): void {
    const wasDestroyed = this.isDestroyed;
    this.isDestroyed = true;
    this.child = null;

    if (!this.isReady) {
      this.readyReject?.(err);
    }

    if (this.activeTask) {
      const task = this.activeTask;
      this.activeTask = null;
      clearTimeout(task.timer);
      task.reject(err);
    }

    if (!wasDestroyed) {
      this.onCrashCallback?.(this);
    }
  }

  public execute(req: WorkerTaskRequest, timeoutMs = 90_000): Promise<WorkerTaskResponse> {
    if (this.activeTask) {
      return Promise.reject(new Error("Worker đang bận."));
    }

    return new Promise<WorkerTaskResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.activeTask && this.activeTask.req.id === req.id) {
          this.activeTask = null;
          this.forceKill();
          this.onCrashCallback?.(this);
          reject(new Error("Quá thời gian xử lý (90s)"));
        }
      }, timeoutMs);

      this.activeTask = {
        req,
        jobId: req.job,
        resolve,
        reject,
        timer,
      };

      this.start()
        .then(() => {
          if (!this.child || this.isDestroyed) {
            throw new Error("Worker không sẵn sàng.");
          }
          this.child.stdin.write(JSON.stringify(req) + "\n", "utf8");
        })
        .catch((err) => {
          if (this.activeTask && this.activeTask.req.id === req.id) {
            clearTimeout(timer);
            this.activeTask = null;
          }
          this.forceKill();
          this.onCrashCallback?.(this);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  public forceKill(reason = "Đã huỷ tác vụ."): void {
    const wasDestroyed = this.isDestroyed;
    this.isDestroyed = true;
    const child = this.child;
    this.child = null;

    if (this.activeTask) {
      const task = this.activeTask;
      this.activeTask = null;
      clearTimeout(task.timer);
      task.reject(new Error(reason));
    }

    if (!child) return;
    const pid = child.pid;
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }

    if (process.platform === "win32" && pid && !wasDestroyed) {
      try {
        const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
        killer.unref();
      } catch {
        // ignore
      }
    }
  }
}
