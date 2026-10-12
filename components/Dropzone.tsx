"use client";

import { ClipboardPaste, FileText, ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    return type === "text" || type === "search" || type === "number" || type === "url" || type === "tel";
  }
  return (el as HTMLElement).isContentEditable === true;
}

function extractImageCandidateString(raw: string, allowAnyHttpUrl: boolean): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Check if HTML with <img src="...">
  if (trimmed.includes("<img")) {
    const m = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && m[1]) {
      return m[1].trim();
    }
  }

  // First non-comment line (for text/uri-list or multi-line paths)
  const firstLine = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("#"));
  if (!firstLine) return null;

  const unquoted =
    (firstLine.startsWith('"') && firstLine.endsWith('"')) ||
    (firstLine.startsWith("'") && firstLine.endsWith("'"))
      ? firstLine.slice(1, -1).trim()
      : firstLine;

  if (/^data:image\//i.test(unquoted)) return unquoted;
  if (/^blob:/i.test(unquoted)) return unquoted;
  if (/^file:\/\//i.test(unquoted)) return unquoted;
  if (/\.(png|jpe?g|jfif|webp|bmp|tiff?)(?:[?#].*)?$/i.test(unquoted)) return unquoted;
  if (allowAnyHttpUrl && /^https?:\/\//i.test(unquoted)) return unquoted;

  return null;
}

async function resolveStringSourceToFile(source: string): Promise<File | null> {
  if (/^data:image\//i.test(source)) {
    const res = await fetch(source);
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
    return new File([blob], `clipboard.${ext}`, { type: blob.type || "image/png" });
  }

  if (/^blob:/i.test(source)) {
    const res = await fetch(source);
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
    return new File([blob], `dropped.${ext}`, { type: blob.type || "image/png" });
  }

  const res = await fetch("/api/load-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || "Không thể tải tệp ảnh từ đường dẫn.");
  }

  const blob = await res.blob();
  const rawHeaderName = res.headers.get("X-Image-Name");
  const fileName = rawHeaderName ? decodeURIComponent(rawHeaderName) : "image.png";
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

async function createSampleDocumentFile(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#fcfbf7";
    ctx.fillRect(0, 0, 900, 1200);

    ctx.strokeStyle = "#222222";
    ctx.lineWidth = 3;
    ctx.strokeRect(48, 48, 804, 1104);

    ctx.fillStyle = "#141414";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText("CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", 150, 115);
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("BIÊN BẢN KIỂM ĐỊNH CHẤT LƯỢNG TÀI LIỆU SỐ", 195, 160);

    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(90, 185);
    ctx.lineTo(810, 185);
    ctx.stroke();

    ctx.font = "18px monospace";
    ctx.fillText("Mã hồ sơ: AUG-LAB-2026-00842          Ngày lập: 12/10/2026", 90, 230);
    ctx.fillText("Đơn vị: Phòng Thí Nghiệm Xử Lý Ảnh & Thị Giác Máy Tính", 90, 265);

    ctx.font = "17px sans-serif";
    const lines = [
      "1. Mục đích kiểm thử: Đánh giá độ bền của mô hình nhận dạng ký tự quang học",
      "   (OCR) trước các hiện tượng xuống cấp vật lý của giấy, mực in và quang học.",
      "2. Các nhóm biến đổi chính:",
      "   - Pha Mực (Ink phase): Loang mực, thấm ngược mặt sau, đứt nét, dithering.",
      "   - Pha Giấy (Paper phase): Nhiễu sợi giấy, giấy ngả màu, vết ố, hình mờ.",
      "   - Pha Hậu kỳ (Post phase): Photocopy bẩn, nếp gấp, bóng đổ, biến dạng góc.",
      "3. Bảng số liệu đối chiếu:",
    ];
    lines.forEach((line, idx) => {
      ctx.fillText(line, 90, 320 + idx * 34);
    });

    // Draw table
    const tableTop = 580;
    ctx.strokeRect(90, tableTop, 720, 260);
    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      ctx.moveTo(90, tableTop + r * 52);
      ctx.lineTo(810, tableTop + r * 52);
      ctx.stroke();
    }
    [210, 510, 660].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, tableTop);
      ctx.lineTo(x, tableTop + 260);
      ctx.stroke();
    });

    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Mã mẫu", 110, tableTop + 32);
    ctx.fillText("Hạng mục kiểm định", 230, tableTop + 32);
    ctx.fillText("Độ lệch", 530, tableTop + 32);
    ctx.fillText("Kết quả", 680, tableTop + 32);

    ctx.font = "16px monospace";
    const rows = [
      ["DOC-01", "Bản quét 300 DPI tiêu chuẩn", "0.12%", "ĐẠT"],
      ["DOC-02", "Bản gửi Fax nhiệt nhòe mực", "1.45%", "ĐẠT"],
      ["DOC-03", "Bản Photocopy qua 3 thế hệ", "2.80%", "ĐẠT"],
      ["DOC-04", "Ảnh chụp điện thoại thiếu sáng", "1.92%", "ĐẠT"],
    ];
    rows.forEach((r, idx) => {
      const y = tableTop + (idx + 1) * 52 + 32;
      ctx.fillText(r[0], 110, y);
      ctx.fillText(r[1], 230, y);
      ctx.fillText(r[2], 535, y);
      ctx.fillText(r[3], 690, y);
    });

    ctx.font = "italic 16px sans-serif";
    ctx.fillText("Ghi chú: Tài liệu mẫu sinh tự động phục vụ kiểm thử nhanh.", 90, 910);
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("XÁC NHẬN CỦA PHÒNG THÍ NGHIỆM", 500, 980);
  }

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), "image/png");
  });
  return new File([blob], "tai_lieu_mau.png", { type: "image/png" });
}

export function Dropzone() {
  const { state, dispatch, setSourceFile, addToast } = useAppStore();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOverZone, setIsDragOverZone] = useState(false);
  const [isFullPageDrag, setIsFullPageDrag] = useState(false);
  const dragIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPasteHandledAtRef = useRef<number>(0);

  const handleFiles = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (!files || files.length === 0) return;
      const arr = Array.from(files);
      const preferred =
        arr.find(
          (f) =>
            f.type.startsWith("image/") ||
            /\.(png|jpe?g|jfif|webp|bmp|tiff?)$/i.test(f.name || "")
        ) || arr[0];
      if (preferred) {
        void setSourceFile(preferred);
      }
    },
    [setSourceFile]
  );

  const processDataTransfer = useCallback(
    async (dt: DataTransfer | null | undefined, isFromDrop: boolean): Promise<boolean> => {
      if (!dt) return false;

      // 1. Direct FileList (OS file drag/drop or clipboard files)
      if (dt.files && dt.files.length > 0) {
        handleFiles(dt.files);
        return true;
      }

      // 2. DataTransferItemList file items
      if (dt.items && dt.items.length > 0) {
        const extractedFiles: File[] = [];
        for (let i = 0; i < dt.items.length; i++) {
          const item = dt.items[i];
          if (item && item.kind === "file") {
            const f = item.getAsFile();
            if (f) extractedFiles.push(f);
          }
        }
        if (extractedFiles.length > 0) {
          handleFiles(extractedFiles);
          return true;
        }
      }

      // 3. String payloads (IDE file tree drag, webpage image drag, file:// URI, local path, data URL)
      const candidateTypes = ["text/uri-list", "text/html", "codefiles", "text/plain"];
      for (const mime of candidateTypes) {
        let raw = "";
        try {
          raw = dt.getData(mime);
        } catch {
          continue;
        }
        if (!raw) continue;

        let parsedCandidate = extractImageCandidateString(raw, isFromDrop);
        if (!parsedCandidate && mime === "codefiles") {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && typeof arr[0] === "string") {
              parsedCandidate = extractImageCandidateString(arr[0], true);
            }
          } catch {
            // ignore
          }
        }

        if (parsedCandidate) {
          try {
            const resolvedFile = await resolveStringSourceToFile(parsedCandidate);
            if (resolvedFile) {
              await setSourceFile(resolvedFile);
              return true;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            dispatch({ type: "SET_IMAGE_ERROR", payload: msg });
            addToast(msg, "error");
            return true;
          }
        }
      }

      return false;
    },
    [handleFiles, setSourceFile, dispatch, addToast]
  );

  const pasteFromClipboardApi = useCallback(
    async (silentIfEmpty = false) => {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.read === "function") {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const imgType = item.types.find((t) => t.startsWith("image/"));
            if (imgType) {
              const blob = await item.getType(imgType);
              const ext = (imgType.split("/")[1] || "png").replace("jpeg", "jpg");
              const file = new File([blob], `clipboard.${ext}`, { type: imgType });
              await setSourceFile(file);
              return;
            }
          }
          for (const item of items) {
            if (item.types.includes("text/html")) {
              const blob = await item.getType("text/html");
              const html = await blob.text();
              const src = extractImageCandidateString(html, true);
              if (src) {
                const file = await resolveStringSourceToFile(src);
                if (file) {
                  await setSourceFile(file);
                  return;
                }
              }
            }
            if (item.types.includes("text/plain")) {
              const blob = await item.getType("text/plain");
              const text = await blob.text();
              const src = extractImageCandidateString(text, false);
              if (src) {
                const file = await resolveStringSourceToFile(src);
                if (file) {
                  await setSourceFile(file);
                  return;
                }
              }
            }
          }
        }

        if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
          const text = await navigator.clipboard.readText();
          const src = extractImageCandidateString(text, false);
          if (src) {
            const file = await resolveStringSourceToFile(src);
            if (file) {
              await setSourceFile(file);
              return;
            }
          }
        }

        if (!silentIfEmpty) {
          addToast(
            "Không tìm thấy ảnh trong bộ nhớ tạm. Hãy sao chép (Ctrl+C) một ảnh hoặc tệp ảnh trước.",
            "error"
          );
        }
      } catch (err) {
        if (!silentIfEmpty) {
          const msg =
            err instanceof DOMException && err.name === "NotAllowedError"
              ? "Trình duyệt cần quyền truy cập bộ nhớ tạm, hoặc hãy nhấn trực tiếp tổ hợp phím Ctrl+V."
              : err instanceof Error
                ? err.message
                : "Không thể đọc ảnh từ bộ nhớ tạm.";
          addToast(msg, "error");
        }
      }
    },
    [setSourceFile, addToast]
  );

  // Global paste listener (Ctrl+V anywhere on page) + keydown fallback
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData;
      if (!dt) return;

      const hasFileItem =
        (dt.files && dt.files.length > 0) ||
        Array.from(dt.items || []).some((item) => item.kind === "file");

      if (hasFileItem) {
        lastPasteHandledAtRef.current = Date.now();
        e.preventDefault();
        void processDataTransfer(dt, false);
        return;
      }

      // If user is typing inside an input/textarea, only intercept if clipboard text is an explicit image URI/path
      const inEditable = isEditableElement(document.activeElement);
      const rawHtml = dt.getData("text/html") || "";
      const rawText = dt.getData("text/uri-list") || dt.getData("text/plain") || "";
      const candidate =
        extractImageCandidateString(rawHtml, !inEditable) ||
        extractImageCandidateString(rawText, false);

      if (candidate) {
        lastPasteHandledAtRef.current = Date.now();
        e.preventDefault();
        void processDataTransfer(dt, false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "v") {
        if (isEditableElement(document.activeElement)) return;
        const pressedAt = Date.now();
        setTimeout(() => {
          // If the native paste event did not fire within 80ms, read from Clipboard API directly
          if (lastPasteHandledAtRef.current < pressedAt - 10) {
            void pasteFromClipboardApi(true);
          }
        }, 80);
      }
    };

    window.addEventListener("paste", onPaste, { capture: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("paste", onPaste, { capture: true });
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [processDataTransfer, pasteFromClipboardApi]);

  // Full-page capture-phase drag & drop listeners
  useEffect(() => {
    const clearDragState = () => {
      if (dragIdleTimerRef.current) {
        clearTimeout(dragIdleTimerRef.current);
        dragIdleTimerRef.current = null;
      }
      setIsFullPageDrag(false);
      setIsDragOverZone(false);
    };

    const scheduleDragIdleReset = () => {
      if (dragIdleTimerRef.current) {
        clearTimeout(dragIdleTimerRef.current);
      }
      dragIdleTimerRef.current = setTimeout(() => {
        setIsFullPageDrag(false);
        setIsDragOverZone(false);
      }, 1500);
    };

    const isExternalDrag = (e: DragEvent): boolean => {
      const dt = e.dataTransfer;
      if (!dt) return false;
      if (dt.files && dt.files.length > 0) return true;
      if (dt.items && dt.items.length > 0) return true;
      const types = Array.from(dt.types || []);
      return types.length > 0;
    };

    const onDragEnter = (e: DragEvent) => {
      if (!isExternalDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
      setIsFullPageDrag(true);
      scheduleDragIdleReset();
    };

    const onDragOver = (e: DragEvent) => {
      if (!isExternalDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
      setIsFullPageDrag(true);
      scheduleDragIdleReset();
    };

    const onDragLeave = (e: DragEvent) => {
      const rel = e.relatedTarget as Node | null;
      if (!rel || !document.documentElement.contains(rel)) {
        clearDragState();
      }
    };

    const onDrop = (e: DragEvent) => {
      if (!isExternalDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      clearDragState();
      void processDataTransfer(e.dataTransfer, true);
    };

    window.addEventListener("dragenter", onDragEnter, { capture: true });
    window.addEventListener("dragover", onDragOver, { capture: true });
    window.addEventListener("dragleave", onDragLeave, { capture: true });
    window.addEventListener("drop", onDrop, { capture: true });
    window.addEventListener("dragend", clearDragState, { capture: true });
    return () => {
      if (dragIdleTimerRef.current) {
        clearTimeout(dragIdleTimerRef.current);
      }
      window.removeEventListener("dragenter", onDragEnter, { capture: true });
      window.removeEventListener("dragover", onDragOver, { capture: true });
      window.removeEventListener("dragleave", onDragLeave, { capture: true });
      window.removeEventListener("drop", onDrop, { capture: true });
      window.removeEventListener("dragend", clearDragState, { capture: true });
    };
  }, [processDataTransfer]);

  const src = state.sourceImage;

  return (
    <>
      {isFullPageDrag && (
        <div
          aria-hidden="true"
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsFullPageDrag(false);
            setIsDragOverZone(false);
            void processDataTransfer(e.dataTransfer, true);
          }}
          className="fixed inset-0 z-overlay bg-scrim flex items-center justify-center p-6 pointer-events-auto"
        >
          <div className="w-full max-w-md p-8 rounded-xl border-2 border-dashed border-accent bg-surface-1 flex flex-col items-center gap-3 text-center shadow-overlay pointer-events-none">
            <Upload className="w-8 h-8 text-accent" />
            <p className="text-md font-semibold text-text">Thả ảnh vào bất kỳ đâu để tải lên</p>
            <p className="text-xs text-muted">Hỗ trợ PNG, JPG, WEBP, BMP, TIFF (tối đa 25 MB)</p>
          </div>
        </div>
      )}

      <section
        aria-label="Ảnh tài liệu gốc"
        className="bg-surface-1 border border-border rounded-lg p-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-md font-semibold text-text">Ảnh gốc</h2>
          {src && (
            <Badge variant="neutral" className="font-mono num">
              {src.type}
            </Badge>
          )}
        </div>

        <input
          id="aug-source-file-input"
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff,.png,.jpg,.jpeg,.jfif,.webp,.bmp,.tif,.tiff"
          className="sr-only"
          aria-label="Chọn tệp ảnh từ máy"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {!src ? (
          <div className="flex flex-col gap-2">
            <div
              role="button"
              tabIndex={0}
              aria-label="Kéo thả ảnh, bấm để chọn hoặc dán (Ctrl+V)"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
                setIsDragOverZone(true);
              }}
              onDragLeave={() => setIsDragOverZone(false)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOverZone(false);
                setIsFullPageDrag(false);
                void processDataTransfer(e.dataTransfer, true);
              }}
              className={`relative min-h-[180px] w-full rounded-lg border-2 border-dashed p-5 flex flex-col items-center justify-center text-center gap-2 transition-ui cursor-pointer select-none ${
                state.imageError
                  ? "border-danger bg-danger-soft/30"
                  : isDragOverZone
                    ? "border-accent bg-accent-soft"
                    : "border-border-strong bg-surface-2/40 hover:bg-surface-3/60 hover:border-accent"
              }`}
            >
              <ImagePlus className="w-7 h-7 text-accent pointer-events-none" aria-hidden="true" />
              <span className="text-sm font-medium text-text pointer-events-none">
                Kéo thả ảnh, bấm để chọn hoặc dán (Ctrl+V)
              </span>
              <span className="text-xs text-subtle pointer-events-none">
                PNG, JPG, WEBP, BMP, TIFF · tối đa <span className="num">25 MB</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-0.5 flex-wrap">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void pasteFromClipboardApi(false)}
                title="Dán ảnh trực tiếp từ bộ nhớ tạm (Ctrl+V)"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Dán ảnh (Ctrl+V)</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const sample = await createSampleDocumentFile();
                  await setSourceFile(sample);
                }}
              >
                <FileText className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>Dùng tài liệu mẫu</span>
              </Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsFullPageDrag(false);
              setIsDragOverZone(false);
              void processDataTransfer(e.dataTransfer, true);
            }}
            className="flex flex-col gap-2.5"
          >
            <div className="relative w-full h-48 rounded-md border border-border checker overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src.previewUrl}
                alt={`Xem trước ${src.name}`}
                draggable={false}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-1 text-xs bg-surface-2 px-2.5 py-2 rounded-md border border-border">
              <div className="font-medium text-text truncate" title={src.name}>
                {src.name}
              </div>
              <div className="flex items-center justify-between text-subtle num">
                <span>{formatBytes(src.size)}</span>
                <span>
                  {src.width > 0 && src.height > 0 ? `${src.width} × ${src.height} px` : "Ảnh gốc"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={state.isGenerating}
                onClick={() => inputRef.current?.click()}
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Đổi ảnh</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={state.isGenerating}
                onClick={() => void pasteFromClipboardApi(false)}
                title="Dán ảnh mới từ bộ nhớ tạm (Ctrl+V)"
              >
                <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Dán</span>
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={state.isGenerating}
                onClick={() => void setSourceFile(null)}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Xoá</span>
              </Button>
            </div>
          </div>
        )}

        {state.imageError && (
          <p role="alert" className="text-xs text-danger">
            {state.imageError}
          </p>
        )}
      </section>
    </>
  );
}
