import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getJobDir, touchJobDir } from "@/lib/server/tmp";
import { isValidId } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

async function findResultFile(dir: string, id: string): Promise<{ filePath: string; mime: string } | null> {
  for (const ext of [".png", ".jpg", ".webp"]) {
    const candidate = path.join(dir, `${id}${ext}`);
    try {
      const st = await fs.stat(candidate);
      if (st.isFile()) {
        return { filePath: candidate, mime: EXT_TO_MIME[ext] || "application/octet-stream" };
      }
    } catch {
      // try next extension
    }
  }
  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ job: string; id: string }> }
) {
  const { job, id } = await context.params;
  if (!isValidId(job) || !isValidId(id)) {
    return NextResponse.json({ error: "Tham số đường dẫn không hợp lệ." }, { status: 400 });
  }

  const url = new URL(request.url);
  const wantThumb = url.searchParams.get("thumb") === "1";

  let jobDir: string;
  try {
    jobDir = getJobDir(job);
  } catch {
    return NextResponse.json({ error: "Không tìm thấy phiên xử lý." }, { status: 404 });
  }

  void touchJobDir(job);

  if (wantThumb) {
    const thumbPath = path.join(jobDir, "thumb", `${id}.webp`);
    try {
      const buf = await fs.readFile(thumbPath);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      // Fallback to full result if thumb missing
    }
  }

  const found = await findResultFile(path.join(jobDir, "res"), id);
  if (!found) {
    return NextResponse.json({ error: "Ảnh kết quả không tồn tại hoặc đã hết hạn." }, { status: 404 });
  }

  try {
    const buf = await fs.readFile(found.filePath);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": found.mime,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Không thể đọc tệp kết quả." }, { status: 500 });
  }
}
