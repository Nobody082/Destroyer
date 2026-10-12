import { NextResponse } from "next/server";
import { getWorkerPool } from "@/lib/server/pool";
import { isValidId } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { jobId?: unknown };
    const jobId = body.jobId;
    if (!isValidId(jobId)) {
      return NextResponse.json({ error: "Mã tác vụ (jobId) không hợp lệ." }, { status: 400 });
    }
    const pool = getWorkerPool();
    pool.cancelJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Không thể huỷ tác vụ: ${msg}` }, { status: 500 });
  }
}
