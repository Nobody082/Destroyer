export const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && SAFE_ID_RE.test(value);
}

export type ImageValidationResult =
  | { ok: true; ext: "png" | "jpg" | "webp" | "bmp" | "tiff"; mime: string }
  | { ok: false; status: 400 | 413; error: string };

const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "application/octet-stream",
  "",
]);

export function validateImageBuffer(buf: Buffer, declaredMime = ""): ImageValidationResult {
  if (!buf || buf.byteLength === 0) {
    return { ok: false, status: 400, error: "Tệp ảnh rỗng hoặc không hợp lệ." };
  }
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: "Ảnh quá lớn (tối đa 25 MB)." };
  }

  const normalizedMime = declaredMime.toLowerCase().trim();
  if (normalizedMime && !ALLOWED_MIMES.has(normalizedMime)) {
    return {
      ok: false,
      status: 400,
      error: "Định dạng không hỗ trợ. Dùng PNG, JPG, WEBP, BMP, TIFF.",
    };
  }

  // Magic byte inspection
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.byteLength >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ok: true, ext: "png", mime: "image/png" };
  }

  // JPEG: FF D8 FF
  if (buf.byteLength >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ok: true, ext: "jpg", mime: "image/jpeg" };
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buf.byteLength >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ok: true, ext: "webp", mime: "image/webp" };
  }

  // BMP: "BM" (42 4D)
  if (buf.byteLength >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return { ok: true, ext: "bmp", mime: "image/bmp" };
  }

  // TIFF: II*\0 (49 49 2A 00) or MM\0* (4D 4D 00 2A)
  if (
    buf.byteLength >= 4 &&
    ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a))
  ) {
    return { ok: true, ext: "tiff", mime: "image/tiff" };
  }

  return {
    ok: false,
    status: 400,
    error: "Định dạng không hỗ trợ. Dùng PNG, JPG, WEBP, BMP, TIFF.",
  };
}
