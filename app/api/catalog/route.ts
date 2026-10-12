import { NextResponse } from "next/server";
import { loadCatalogFromDisk } from "@/lib/server/catalogLoader";
import { getWorkerPool } from "@/lib/server/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = await loadCatalogFromDisk();
    const pythonHealth = getWorkerPool().checkPythonEnv();
    return NextResponse.json(
      {
        ...catalog,
        pythonHealth,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Không thể đọc danh mục hiệu ứng (python/catalog.json): ${message}. Hãy chạy "npm run catalog".`,
      },
      { status: 500 }
    );
  }
}
