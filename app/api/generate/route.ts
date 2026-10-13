import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { del as deleteBlob, head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { indexCatalogEffects } from "@/lib/catalog";
import { buildJobPlan, formatExt } from "@/lib/jobPlan";
import { loadCatalogFromDisk } from "@/lib/server/catalogLoader";
import { getWorkerPool } from "@/lib/server/pool";
import { createJobDir } from "@/lib/server/tmp";
import { validateImageBuffer } from "@/lib/server/validate";
import type {
  GenerationMode,
  JobFailureItem,
  JobManifest,
  JobRequestPayload,
  OutputFormat,
  StreamEvent,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handleVercelGenerate(request: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Project Vercel chưa kết nối Blob riêng tư." }, { status: 503 });
  }

  let body: { imagePath?: unknown; imageName?: unknown; job?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dữ liệu yêu cầu không hợp lệ." }, { status: 400 });
  }

  const imagePath = typeof body.imagePath === "string" ? body.imagePath : "";
  const sourceFileName = typeof body.imageName === "string" ? body.imageName.slice(0, 255) : "image";
  if (!imagePath.startsWith("uploads/") || imagePath.includes("..")) {
    return NextResponse.json({ error: "Ảnh đầu vào không hợp lệ." }, { status: 400 });
  }

  let image;
  try {
    image = await head(imagePath);
  } catch {
    return NextResponse.json({ error: "Không tìm thấy ảnh tải lên. Hãy tải ảnh lên lại." }, { status: 404 });
  }
  if (image.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Ảnh quá lớn (tối đa 25 MB)." }, { status: 413 });
  }
  if (!/^image\/(png|jpeg|webp|bmp|tiff)$/.test(image.contentType)) {
    return NextResponse.json({ error: "Định dạng không hỗ trợ. Dùng PNG, JPG, WEBP, BMP, TIFF." }, { status: 400 });
  }

  const job = normalizeJobPayload(
    body.job && typeof body.job === "object" ? (body.job as Partial<JobRequestPayload>) : {}
  );
  const catalog = await loadCatalogFromDisk();
  const catalogMap = indexCatalogEffects(catalog);
  const resolvedSeed = job.seed !== null && job.seed > 0 ? job.seed : Math.floor(100_000 + Math.random() * 900_000_000);
  const plannedTasks = buildJobPlan(job, catalogMap, resolvedSeed);
  if (plannedTasks.length === 0) {
    return NextResponse.json({ error: "Chưa chọn hiệu ứng hợp lệ nào để tạo ảnh." }, { status: 400 });
  }

  const jobId = `job_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const baseUrl = process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "Không xác định được địa chỉ Python Function của Vercel." }, { status: 503 });
  }
  const workerUrl = `https://${baseUrl.replace(/^https?:\/\//, "")}/api/py-worker`;
  const outExt = formatExt(job.format);
  const encoder = new TextEncoder();
  const workerAbort = new AbortController();
  const onRequestAbort = () => workerAbort.abort();
  request.signal.addEventListener("abort", onRequestAbort, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };
      const startedAt = Date.now();
      let okCount = 0;
      let failedCount = 0;
      let doneCount = 0;
      let originalW = 0;
      let originalH = 0;
      const failures: JobFailureItem[] = [];
      const manifestResults: JobManifest["results"] = [];

      const runPython = async (payload: Record<string, unknown>) => {
        const response = await fetch(workerUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: workerAbort.signal,
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok || data.ok !== true) {
          throw new Error(typeof data.error === "string" ? data.error : `Python Function trả về HTTP ${response.status}.`);
        }
        return data;
      };

      try {
        const prepared = await runPython({
          op: "prepare", jobId, taskId: "original", inputPath: imagePath,
          maxSide: job.maxSide, format: job.format, quality: job.quality,
        });
        originalW = Number(prepared.w) || 0;
        originalH = Number(prepared.h) || 0;
        send({
          type: "start", jobId, seed: resolvedSeed, total: plannedTasks.length,
          original: {
            url: `/api/result/${jobId}/original`, thumbUrl: `/api/result/${jobId}/original?thumb=1`,
            w: originalW, h: originalH, path: `original.${outExt}`,
          },
        });

        let cursor = 0;
        const concurrency = Math.min(2, plannedTasks.length);
        const runLoop = async () => {
          while (cursor < plannedTasks.length && !workerAbort.signal.aborted) {
            const task = plannedTasks[cursor++];
            if (!task) return;
            try {
              const result = await runPython({
                op: "chain", jobId, taskId: task.id, inputPath: imagePath,
                steps: task.steps.map((step) => ({
                  lib: step.lib, name: step.name, params: step.params, phase: step.phase, category: step.category,
                })),
                seed: task.seed, maxSide: job.maxSide, format: job.format, quality: job.quality,
              });
              if (workerAbort.signal.aborted) return;
              doneCount++;
              okCount++;
              const ms = Number(result.ms) || 0;
              const w = Number(result.w) || originalW;
              const h = Number(result.h) || originalH;
              const changed = Boolean(result.changed);
              const params: Record<string, Record<string, unknown>> = {};
              for (const step of task.steps) params[step.id] = step.params;
              manifestResults.push({
                id: task.id, path: task.relativePath, label: task.label, effects: task.effectIds, params,
                seed: task.seed, ms, width: w, height: h, changed,
              });
              send({
                type: "result", id: task.id, effects: task.effectIds, label: task.label,
                url: `/api/result/${jobId}/${task.id}`, thumbUrl: `/api/result/${jobId}/${task.id}?thumb=1`,
                ms, w, h, changed, path: task.relativePath, seed: task.seed,
              });
            } catch (error) {
              if (workerAbort.signal.aborted) return;
              doneCount++;
              failedCount++;
              const message = error instanceof Error ? error.message : String(error);
              failures.push({ id: task.id, effect: task.label, message });
              send({ type: "error", id: task.id, effect: task.label, message });
            }
            const elapsedMs = Date.now() - startedAt;
            const avg = doneCount ? elapsedMs / doneCount : 0;
            send({ type: "progress", done: doneCount, total: plannedTasks.length, etaMs: Math.round(avg * Math.max(0, plannedTasks.length - doneCount)), elapsedMs });
          }
        };
        await Promise.all(Array.from({ length: concurrency }, () => runLoop()));
      } catch (error) {
        if (!workerAbort.signal.aborted) {
          failedCount++;
          const message = error instanceof Error ? error.message : String(error);
          failures.push({ message });
          send({ type: "error", message });
        }
      } finally {
        const elapsedMs = Date.now() - startedAt;
        const cancelled = workerAbort.signal.aborted;
        const manifest: JobManifest = {
          jobId, createdAt: new Date(startedAt).toISOString(), sourceFileName, seed: resolvedSeed,
          mode: job.mode, format: job.format, quality: job.quality, maxSide: job.maxSide,
          original: { path: `original.${outExt}`, width: originalW, height: originalH, url: `/api/result/${jobId}/original` },
          versions: catalog.versions || {}, totalPlanned: plannedTasks.length, okCount, failedCount, cancelled,
          elapsedMs, results: manifestResults, failures,
        };
        send({ type: "done", jobId, ok: okCount, failed: failedCount, ms: elapsedMs, cancelled, seed: resolvedSeed, manifest });
        try {
          await deleteBlob(imagePath);
        } catch {
          // Expiring an uploaded input must not prevent completion events from reaching the browser.
        }
        request.signal.removeEventListener("abort", onRequestAbort);
        if (!closed) {
          try { controller.close(); } catch { /* stream already closed */ }
        }
      }
    },
    cancel() { workerAbort.abort(); },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Content-Type-Options": "nosniff" },
  });
}

function normalizeJobPayload(raw: Partial<JobRequestPayload>): JobRequestPayload {
  const mode: GenerationMode =
    raw.mode === "mix" || raw.mode === "chain" || raw.mode === "each" ? raw.mode : "each";
  const format: OutputFormat =
    raw.format === "jpg" || raw.format === "webp" || raw.format === "png" ? raw.format : "png";
  const quality = Math.max(1, Math.min(100, Math.round(Number(raw.quality) || 92)));
  const repeats = Math.max(1, Math.min(50, Math.round(Number(raw.repeats) || 1)));
  const count = Math.max(1, Math.min(200, Math.round(Number(raw.count) || 8)));

  let kMin = 2;
  let kMax = 3;
  if (Array.isArray(raw.kRange) && raw.kRange.length === 2) {
    kMin = Math.max(1, Math.min(20, Math.round(Number(raw.kRange[0]) || 1)));
    kMax = Math.max(kMin, Math.min(20, Math.round(Number(raw.kRange[1]) || kMin)));
  }

  let maxSide: number | null = 1600;
  if (raw.maxSide === null || raw.maxSide === 0) {
    maxSide = null;
  } else if (typeof raw.maxSide === "number" && Number.isFinite(raw.maxSide) && raw.maxSide > 0) {
    maxSide = Math.max(64, Math.min(8192, Math.round(raw.maxSide)));
  }

  let seed: number | null = null;
  if (typeof raw.seed === "number" && Number.isFinite(raw.seed)) {
    seed = Math.abs(Math.floor(raw.seed)) & 0x7fffffff;
  }

  const effects = Array.isArray(raw.effects)
    ? raw.effects
        .filter((e) => e && typeof e.id === "string")
        .map((e) => ({
          id: e.id,
          params: e.params && typeof e.params === "object" ? e.params : {},
        }))
    : [];

  return {
    mode,
    effects,
    repeats,
    count,
    kRange: [kMin, kMax],
    seed,
    maxSide,
    format,
    quality,
    sourceName: typeof raw.sourceName === "string" ? raw.sourceName : undefined,
  };
}

export async function POST(request: Request) {
  if (process.env.VERCEL) return handleVercelGenerate(request);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Yêu cầu không đúng định dạng multipart/form-data." },
      { status: 400 }
    );
  }

  const imageEntry = formData.get("image");
  if (!imageEntry || !(imageEntry instanceof Blob)) {
    return NextResponse.json(
      { error: "Chưa chọn ảnh đầu vào. Vui lòng tải lên một tệp ảnh." },
      { status: 400 }
    );
  }

  if (imageEntry.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Ảnh quá lớn (tối đa 25 MB)." }, { status: 413 });
  }

  const arrayBuffer = await imageEntry.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const validation = validateImageBuffer(buffer, imageEntry.type);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const rawJobStr = formData.get("job");
  let rawJob: Partial<JobRequestPayload> = {};
  if (typeof rawJobStr === "string" && rawJobStr.trim()) {
    try {
      rawJob = JSON.parse(rawJobStr) as Partial<JobRequestPayload>;
    } catch {
      return NextResponse.json({ error: "Cấu hình tác vụ (JSON) không hợp lệ." }, { status: 400 });
    }
  }

  const job = normalizeJobPayload(rawJob);
  const catalog = await loadCatalogFromDisk();
  const catalogMap = indexCatalogEffects(catalog);

  const resolvedSeed =
    job.seed !== null && job.seed > 0
      ? job.seed
      : Math.floor(100_000 + Math.random() * 900_000_000);

  const plannedTasks = buildJobPlan(job, catalogMap, resolvedSeed);
  if (plannedTasks.length === 0) {
    return NextResponse.json(
      { error: "Chưa chọn hiệu ứng hợp lệ nào để tạo ảnh." },
      { status: 400 }
    );
  }

  const pool = getWorkerPool();
  const pyCheck = pool.checkPythonEnv();
  if (!pyCheck.ok) {
    return NextResponse.json(
      {
        error: `${pyCheck.error} Chạy lệnh "${pyCheck.fixCommand ?? "npm run setup:env"}" để khắc phục.`,
      },
      { status: 503 }
    );
  }

  const jobId = `job_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const { jobDir, resDir, thumbDir } = await createJobDir(jobId);
  const inputPath = path.join(jobDir, `input.${validation.ext}`);
  await fs.writeFile(inputPath, buffer);

  const outExt = formatExt(job.format);
  const origOutPath = path.join(resDir, `original.${outExt}`);
  const origThumbPath = path.join(thumbDir, "original.webp");

  pool.registerJob(jobId);

  const onAbort = () => {
    pool.cancelJob(jobId);
  };
  request.signal.addEventListener("abort", onAbort, { once: true });

  const encoder = new TextEncoder();
  const sourceFileName =
    job.sourceName ||
    ("name" in imageEntry && typeof imageEntry.name === "string" ? imageEntry.name : `image.${validation.ext}`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (ev: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        } catch {
          closed = true;
        }
      };

      const startedAt = Date.now();
      let okCount = 0;
      let failedCount = 0;
      let doneCount = 0;
      const total = plannedTasks.length;
      const manifestResults: JobManifest["results"] = [];
      const failures: JobFailureItem[] = [];
      let origW = 0;
      let origH = 0;

      try {
        // 1. Prepare normalized / downscaled original image
        const prepRes = await pool.runTask({
          id: `${jobId}_orig`,
          op: "prepare",
          job: jobId,
          input: inputPath,
          out: origOutPath,
          thumb: origThumbPath,
          maxSide: job.maxSide,
          format: job.format,
          quality: job.quality,
        });

        if (!prepRes.ok) {
          throw new Error(prepRes.error || "Không thể đọc ảnh gốc.");
        }

        origW = prepRes.w ?? 0;
        origH = prepRes.h ?? 0;

        send({
          type: "start",
          jobId,
          seed: resolvedSeed,
          total,
          original: {
            url: `/api/result/${jobId}/original`,
            thumbUrl: `/api/result/${jobId}/original?thumb=1`,
            w: origW,
            h: origH,
            path: `original.${outExt}`,
          },
        });

        // 2. Dispatch planned tasks with bounded concurrency = pool.size
        let cursor = 0;
        const concurrency = Math.min(pool.size, total);

        const workerLoop = async () => {
          while (cursor < total) {
            if (pool.isJobCancelled(jobId) || request.signal.aborted) {
              break;
            }
            const task = plannedTasks[cursor++];
            if (!task) break;

            const outPath = path.join(resDir, `${task.id}.${outExt}`);
            const thumbPath = path.join(thumbDir, `${task.id}.webp`);

            try {
              const res = await pool.runTask({
                id: `${jobId}_${task.id}`,
                op: "chain",
                job: jobId,
                input: inputPath,
                out: outPath,
                thumb: thumbPath,
                steps: task.steps.map((s) => ({
                  lib: s.lib,
                  name: s.name,
                  params: s.params,
                  phase: s.phase,
                  category: s.category,
                })),
                seed: task.seed,
                format: job.format,
                quality: job.quality,
                maxSide: job.maxSide,
              });

              if (pool.isJobCancelled(jobId) || request.signal.aborted) {
                break;
              }

              doneCount++;
              if (res.ok) {
                okCount++;
                const resultUrl = `/api/result/${jobId}/${task.id}`;
                const thumbUrl = `/api/result/${jobId}/${task.id}?thumb=1`;
                const ms = res.ms ?? 0;
                const w = res.w ?? origW;
                const h = res.h ?? origH;
                const changed = Boolean(res.changed);

                const paramsRecord: Record<string, Record<string, unknown>> = {};
                for (const s of task.steps) {
                  paramsRecord[s.id] = s.params;
                }

                manifestResults.push({
                  id: task.id,
                  path: task.relativePath,
                  label: task.label,
                  effects: task.effectIds,
                  params: paramsRecord,
                  seed: task.seed,
                  ms,
                  width: w,
                  height: h,
                  changed,
                });

                send({
                  type: "result",
                  id: task.id,
                  effects: task.effectIds,
                  label: task.label,
                  url: resultUrl,
                  thumbUrl,
                  ms,
                  w,
                  h,
                  changed,
                  path: task.relativePath,
                  seed: task.seed,
                });
              } else {
                failedCount++;
                const errMsg = res.error || "Lỗi khi áp dụng hiệu ứng.";
                failures.push({ id: task.id, effect: task.label, message: errMsg });
                send({
                  type: "error",
                  id: task.id,
                  effect: task.label,
                  message: errMsg,
                });
              }
            } catch (err) {
              if (pool.isJobCancelled(jobId) || request.signal.aborted) {
                break;
              }
              doneCount++;
              failedCount++;
              const errMsg = err instanceof Error ? err.message : String(err);
              failures.push({ id: task.id, effect: task.label, message: errMsg });
              send({
                type: "error",
                id: task.id,
                effect: task.label,
                message: errMsg,
              });
            }

            const elapsedMs = Date.now() - startedAt;
            const avgMs = doneCount > 0 ? elapsedMs / doneCount : 0;
            const remaining = Math.max(0, total - doneCount);
            const etaMs = Math.max(0, Math.round(avgMs * remaining));

            send({
              type: "progress",
              done: doneCount,
              total,
              etaMs,
              elapsedMs,
            });
          }
        };

        await Promise.all(Array.from({ length: concurrency }, () => workerLoop()));
      } catch (err) {
        if (!pool.isJobCancelled(jobId) && !request.signal.aborted) {
          const msg = err instanceof Error ? err.message : String(err);
          failedCount++;
          failures.push({ message: msg });
          send({ type: "error", message: msg });
        }
      } finally {
        request.signal.removeEventListener("abort", onAbort);
        const totalElapsed = Date.now() - startedAt;
        const cancelled = pool.isJobCancelled(jobId) || request.signal.aborted;

        const manifest: JobManifest = {
          jobId,
          createdAt: new Date(startedAt).toISOString(),
          sourceFileName,
          seed: resolvedSeed,
          mode: job.mode,
          format: job.format,
          quality: job.quality,
          maxSide: job.maxSide,
          original: {
            path: `original.${outExt}`,
            width: origW,
            height: origH,
            url: `/api/result/${jobId}/original`,
          },
          versions: catalog.versions || {},
          totalPlanned: total,
          okCount,
          failedCount,
          cancelled,
          elapsedMs: totalElapsed,
          results: manifestResults,
          failures,
        };

        try {
          await fs.writeFile(
            path.join(jobDir, "manifest.json"),
            JSON.stringify(manifest, null, 2),
            "utf8"
          );
        } catch {
          // ignore
        }

        send({
          type: "done",
          jobId,
          ok: okCount,
          failed: failedCount,
          ms: totalElapsed,
          cancelled,
          seed: resolvedSeed,
          manifest,
        });

        pool.finishJob(jobId);
        if (!closed) {
          try {
            controller.close();
          } catch {
            // ignore
          }
        }
      }
    },
    cancel() {
      pool.cancelJob(jobId);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

