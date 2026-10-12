import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
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
