import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";
import { PROJECT_ROOT } from "@/lib/server/paths";
import { MAX_UPLOAD_BYTES, validateImageBuffer } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSourceString(raw: string): string {
  let s = raw.trim();
  // Take first non-empty, non-comment line if multiple lines (e.g. text/uri-list)
  const lines = s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length > 0) {
    s = lines[0];
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export async function POST(request: Request) {
  let body: { source?: string };
  try {
    body = (await request.json()) as { source?: string };
  } catch {
    return NextResponse.json({ error: "Dữ liệu yêu cầu không hợp lệ." }, { status: 400 });
  }

  const rawSource = typeof body.source === "string" ? cleanSourceString(body.source) : "";
  if (!rawSource) {
    return NextResponse.json({ error: "Không tìm thấy đường dẫn ảnh." }, { status: 400 });
  }

  let buffer: Buffer;
  let fileName = "image.png";

  try {
    if (/^https?:\/\//i.test(rawSource)) {
      const res = await fetch(rawSource, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Không thể tải ảnh từ URL (HTTP ${res.status}).` },
          { status: 400 }
        );
      }
      const arr = await res.arrayBuffer();
      if (arr.byteLength > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "Ảnh quá lớn (tối đa 25 MB)." }, { status: 413 });
      }
      buffer = Buffer.from(arr);
      const urlObj = new URL(rawSource);
      const base = path.basename(urlObj.pathname);
      if (base && base.includes(".")) {
        fileName = base;
      }
    } else {
      let filePath = rawSource;
      if (/^file:\/\//i.test(rawSource)) {
        filePath = fileURLToPath(rawSource);
      } else if (!path.isAbsolute(rawSource)) {
        filePath = path.resolve(PROJECT_ROOT, rawSource);
      }
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        return NextResponse.json({ error: "Đường dẫn không phải là một tệp ảnh." }, { status: 400 });
      }
      if (stat.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "Ảnh quá lớn (tối đa 25 MB)." }, { status: 413 });
      }
      buffer = await fs.readFile(filePath);
      fileName = path.basename(filePath) || fileName;
    }
  } catch {
    return NextResponse.json(
      { error: "Không thể đọc tệp ảnh từ đường dẫn đã dán/kéo thả." },
      { status: 400 }
    );
  }

  const validation = validateImageBuffer(buffer);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  if (!/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(fileName)) {
    fileName = `${fileName}.${validation.ext}`;
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": validation.mime,
      "X-Image-Name": encodeURIComponent(fileName),
      "Cache-Control": "no-store",
    },
  });
}
