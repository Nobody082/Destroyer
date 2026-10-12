# Aug Lab — Báo Cáo Kiểm Thử (TEST REPORT)

## 1. Kết quả theo từng tầng kiểm thử (Pass / Fail per Layer)

| Tầng | Phạm vi kiểm thử | Lệnh thực thi | Kết quả | Thời gian / Ghi chú |
|---|---|---|---|---|
| **Layer 1: Static** | TypeScript, ESLint, Production Build | `npx tsc --noEmit && npm run lint && npx next build` | **PASS** | 0 lỗi, 0 cảnh báo; xoá `.next` sau build |
| **Layer 2: Python Engine** | 146 hiệu ứng, 3 chế độ, Seed, Edge inputs, Timeout/Crash | `npm run test:py` (`tests/out/py.log`) | **PASS** | 146/146 hiệu ứng chạy thành công (132.76s) |
| **Layer 3: API Routes** | Catalog, Stream, Validate, Traversal, Cancel, 3x Concurrent | `npm run test:api` (`tests/out/api.log`) | **PASS** | 11/11 kịch bản API vượt qua |
| **Layer 4: UI E2E** | Desktop 1280 + Mobile 390, Drag/Paste, Lightbox, ZIP/Folder | `npm run test:e2e` (`tests/out/e2e.log`) | **PASS** | 10/10 kịch bản giao diện + chụp ảnh màn hình |
| **Layer 5: Fresh Start** | Xoá `.next` + `__pycache__`, `npm run dev`, Cold warmup, Dọn tiến trình | Quy trình khởi động sạch (`:3002`) | **PASS** | Tự kiểm tra môi trường, tạo ảnh đầu tiên, 0 tiến trình Python dư thừa |

## 2. Bảng độ phủ hiệu ứng (Catalog Coverage Table)

Tổng số hiệu ứng trong `python/catalog.json`: **146** hiệu ứng `ok`, **0** `unsupported`, **21** `excluded` (containers / transforms cần bbox, mask, keypoints hoặc ảnh tham chiếu).

| Thư viện / Nhóm (Phân loại) | Tổng `ok` | Thành công (`ok`) | Lỗi (`failed`) | Không đổi điểm ảnh (`no-op` ở mặc định) |
|---|---:|---:|---:|---:|
| `augraphy / ink` (Pha Mực) | 10 | 10 | 0 | 0 |
| `augraphy / paper` (Pha Giấy) | 7 | 7 | 0 | 0 |
| `augraphy / post` (Pha Hậu kỳ) | 34 | 34 | 0 | 0 |
| `albumentations / pixel` (Điểm ảnh) | 55 | 55 | 0 | 3 |
| `albumentations / spatial` (Hình học) | 40 | 40 | 0 | 7 |
| **Tổng cộng** | **146** | **146** | **0** | **10** |

**Các hiệu ứng `no-op` khi chạy với tham số mặc định trên ảnh RGB 3 kênh (giữ lại vì phụ thuộc xác suất đối xứng hoặc tham số người dùng):**
`albumentations.Affine`, `albumentations.D4`, `albumentations.Pad`, `albumentations.PlasmaBrightnessContrast`, `albumentations.RandomRotate90`, `albumentations.SquareSymmetry`, `albumentations.TimeMasking`, `albumentations.ToFloat`, `albumentations.ToRGB`, `albumentations.XYMasking`.

## 3. Các lỗi đã phát hiện và khắc phục (Fixed Defects)

- **Worker Race Condition (`lib/server/worker.ts`)**: Gán `this.activeTask` đồng bộ trước khi `await this.start()` để ngăn `drainQueue()` giao 2 tác vụ cho cùng một worker trong cùng microtask tick.
- **Đầu ra ảnh xám 1 kênh (`python/engine.py`)**: Chuẩn hoá mọi ảnh đầu ra 2D grayscale sang 3 kênh BGR `uint8` trước khi mã hoá để bảo đảm đồng nhất 3 kênh `uint8`.
- **Lỗi cấu hình Route Segment (`next.config.ts`)**: Tắt `cacheComponents` và `devIndicators` để các route handler tương thích với `export const runtime = "nodejs"` và `dynamic = "force-dynamic"`, đồng thời không che khuất thanh tác vụ dưới cùng.
- **Hydration Mismatch & Script Warning (`app/layout.tsx`, `components/Header.tsx`)**: Thay thẻ `<script>` nội tuyến và `useState` phụ thuộc `window` bằng `useSyncExternalStore` đồng bộ trạng thái giao diện Sáng/Tối an toàn khi SSR/hydrate.
- **UTF-8 BOM trên Windows Pipe (`python/worker.py`)**: Loại bỏ ký tự `\ufeff` ở đầu dòng `stdin` để tránh lỗi `JSONDecodeError` khi gọi qua ống dẫn PowerShell.
- **Dọn tiến trình con trên Windows (`lib/server/worker.ts`, `python/worker.py`)**: Truyền `AUG_PARENT_PID` và theo dõi handle tiến trình Node cha qua `WaitForSingleObject` để tự thoát 100% khi dừng máy chủ.

## 4. Vấn đề tồn đọng & Giải pháp thay thế (Remaining Known Issues & Workarounds)

- **Trình duyệt không hỗ trợ `showDirectoryPicker` (Firefox/Safari/Headless)**: Tự động phát hiện tính năng và chuyển sang tải tệp nén `.zip` kèm thông báo tiếng Việt.
- **Thời gian khởi động lần đầu của Numba (`Augraphy`)**: Lần biên dịch JIT đầu tiên mất ~5–8 giây; worker tự động chạy `warmup()` khi khởi tạo và giao diện hiển thị trạng thái chờ rõ ràng.
