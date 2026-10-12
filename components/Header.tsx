"use client";

import { FlaskConical, HelpCircle, Moon, Sun, Terminal } from "lucide-react";
import React, { useEffect, useSyncExternalStore } from "react";
import { useAppStore } from "@/lib/store";
import { Badge } from "./ui/Badge";
import { IconButton } from "./ui/IconButton";
import { Modal } from "./ui/Modal";

const THEME_EVENT = "aug-theme-change";

function subscribeTheme(onStoreChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getThemeSnapshot(): "dark" | "light" {
  try {
    const stored = localStorage.getItem("aug-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return "dark";
}

function getThemeServerSnapshot(): "dark" | "light" {
  return "dark";
}

export function Header() {
  const { state, dispatch } = useAppStore();
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("aug-theme", next);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const versions = state.catalog?.versions;
  const pyHealth = state.catalog?.pythonHealth;

  return (
    <>
      <header className="h-[52px] px-4 bg-surface-1 border-b border-border flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent-soft border border-accent-line flex items-center justify-center text-accent shrink-0">
              <FlaskConical className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="text-md font-semibold tracking-tight text-text whitespace-nowrap">
              Aug Lab
            </span>
          </div>

          <span className="hidden sm:inline-block text-xs text-muted truncate">
            Phòng thí nghiệm giả lập tài liệu xuống cấp
          </span>

          {versions && (
            <div className="hidden md:flex items-center gap-1.5">
              <Badge variant="neutral" className="font-mono num">
                Augraphy {versions.augraphy}
              </Badge>
              <Badge variant="neutral" className="font-mono num">
                Albumentations {versions.albumentations}
              </Badge>
              <Badge variant="neutral" className="font-mono num">
                Py {versions.python}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {pyHealth && !pyHealth.ok && (
            <Badge variant="danger" title={pyHealth.error}>
              Python chưa sẵn sàng
            </Badge>
          )}

          <IconButton
            label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </IconButton>

          <IconButton
            label="Hướng dẫn sử dụng"
            onClick={() => dispatch({ type: "SET_HELP_OPEN", payload: true })}
          >
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      {pyHealth && !pyHealth.ok && (
        <div
          role="alert"
          className="px-4 py-2.5 bg-danger-soft border-b border-danger text-xs text-text flex items-center justify-between gap-3 flex-wrap"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-danger shrink-0" aria-hidden="true" />
            <span>
              <strong>Môi trường Python chưa sẵn sàng:</strong> {pyHealth.error}
            </span>
          </div>
          <code className="font-mono px-2 py-0.5 rounded-sm bg-surface-1 border border-border text-text">
            {pyHealth.fixCommand || "npm run setup:env"}
          </code>
        </div>
      )}

      <Modal
        open={state.helpOpen}
        onClose={() => dispatch({ type: "SET_HELP_OPEN", payload: false })}
        title="Hướng dẫn sử dụng Aug Lab"
        maxWidthClass="max-w-xl"
      >
        <div className="flex flex-col gap-3 text-xs text-muted leading-relaxed">
          <div>
            <h3 className="text-sm font-medium text-text mb-1">1. Tải ảnh tài liệu đầu vào</h3>
            <p>
              Kéo thả tệp ảnh vào khung bên trái, bấm để chọn tệp từ máy, hoặc nhấn{" "}
              <kbd className="px-1.5 py-0.5 rounded-xs bg-surface-2 border border-border font-mono text-text">
                Ctrl+V
              </kbd>{" "}
              bất kỳ đâu trên trang để dán ảnh từ bộ nhớ tạm (tối đa 25 MB, hỗ trợ PNG, JPG, WEBP, BMP, TIFF).
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-text mb-1">2. Ba chế độ tạo biến thể</h3>
            <ul className="list-disc pl-4 flex flex-col gap-1">
              <li>
                <strong className="text-text">Mỗi hiệu ứng một ảnh:</strong> chạy riêng từng hiệu ứng đã chọn × số lần lặp R.
              </li>
              <li>
                <strong className="text-text">Trộn ngẫu nhiên (Mix):</strong> tạo N ảnh, mỗi ảnh chọn ngẫu nhiên k hiệu ứng theo thứ tự chuẩn{" "}
                <span className="font-mono text-text">Mực → Giấy → Hậu kỳ → Albumentations</span>.
              </li>
              <li>
                <strong className="text-text">Chuỗi cố định (Chain):</strong> chạy tuần tự danh sách hiệu ứng theo thứ tự bạn sắp xếp.
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-text mb-1">3. Tái lập kết quả và tải xuống</h3>
            <p>
              Nhập một số <strong className="text-text">Seed</strong> cố định để tái tạo chính xác bộ biến thể. Khi hoàn tất, bạn có thể tải tệp{" "}
              <strong className="text-text">ZIP</strong> (đóng gói toàn bộ ảnh kết quả trong 1 thư mục duy nhất, đặt tên file theo tên hiệu ứng) hoặc lưu trực tiếp vào thư mục trên máy.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
