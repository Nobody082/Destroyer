import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function GET() {
  return NextResponse.json({
    required: Boolean(process.env.VERCEL),
    enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Vercel Blob chưa được cấu hình cho project này." }, { status: 503 });
  }
  const origin = request.headers.get("origin");
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).host : "";
  } catch {
    originHost = "";
  }
  if (!originHost || originHost !== new URL(request.url).host) {
    return NextResponse.json({ error: "Nguồn tải lên không hợp lệ." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("uploads/") || pathname.includes("..")) {
          throw new Error("Đường dẫn tải lên không hợp lệ.");
        }
        return {
          access: "private",
          addRandomSuffix: true,
          allowedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

