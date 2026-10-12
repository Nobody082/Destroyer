import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "tests", "out");
fs.mkdirSync(OUT_DIR, { recursive: true });
const LOG_PATH = path.join(OUT_DIR, "e2e.log");
fs.writeFileSync(LOG_PATH, "", "utf8");

function log(line) {
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${line}\n`, "utf8");
}

const BASE_URL = "http://localhost:3002";

async function isServerUp() {
  try {
    const res = await fetch(`${BASE_URL}/api/catalog`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startDevServerIfNeeded() {
  if (await isServerUp()) {
    log("Existing dev server detected on :3002");
    return null;
  }
  log("Spawning npm run dev on :3002...");
  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/c", "npm", "run", "dev"], {
          cwd: ROOT,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        })
      : spawn("npm", ["run", "dev"], {
          cwd: ROOT,
          stdio: ["ignore", "pipe", "pipe"],
        });

  child.stdout.on("data", (d) => log(`[dev:stdout] ${String(d).trim()}`));
  child.stderr.on("data", (d) => log(`[dev:stderr] ${String(d).trim()}`));

  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isServerUp()) {
      log("Dev server ready on :3002");
      return child;
    }
  }
  throw new Error("Timed out waiting for dev server on :3002");
}

function stopDevServer(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // ignore
  }
}

function makeTestPngBuffer() {
  const pyExe =
    process.platform === "win32"
      ? path.join(ROOT, ".venv", "Scripts", "python.exe")
      : path.join(ROOT, ".venv", "bin", "python");
  const res = spawnSync(
    pyExe,
    [
      "-c",
      "import sys, tempfile; from pathlib import Path; sys.path.insert(0,'python'); from smoke import make_doc_image; p = Path(tempfile.mktemp('.png')); make_doc_image(p, 400, 500); sys.stdout.buffer.write(p.read_bytes()); p.unlink(missing_ok=True)",
    ],
    { cwd: ROOT, maxBuffer: 10 * 1024 * 1024 }
  );
  if (res.status !== 0 || !res.stdout?.length) {
    throw new Error("Failed to create test PNG buffer");
  }
  return res.stdout;
}

async function main() {
  const failures = [];
  const fail = (name, cause) => {
    failures.push({ name, cause });
    log(`[FAIL] ${name}: ${cause}`);
  };
  const pass = (name) => log(`[PASS] ${name}`);

  let devChild = null;
  let browser = null;

  try {
    devChild = await startDevServerIfNeeded();
    const pngBuf = makeTestPngBuffer();
    const pngBase64 = pngBuf.toString("base64");

    browser = await chromium.launch({ headless: true });

    // =========================================================================
    // 1. Desktop 1280x800 E2E Flow
    // =========================================================================
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const failedRequests = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        const text = msg.text();
        log(`[browser:${msg.type()}] ${text}`);
        if (msg.type() === "error") {
          consoleErrors.push(text);
        }
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });
    page.on("requestfailed", (req) => {
      // Aborted requests during Cancel test are expected
      if (req.url().includes("/api/generate")) return;
      failedRequests.push(`${req.method()} ${req.url()}`);
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Aug Lab");
    await page.screenshot({ path: path.join(OUT_DIR, "01-desktop-loaded.png") });

    if (consoleErrors.length > 0 || failedRequests.length > 0) {
      fail("e2e_initial_load_clean", `Console errors: ${consoleErrors.join("; ")} | Failed reqs: ${failedRequests.join("; ")}`);
    } else {
      pass("e2e_initial_load_clean");
    }

    // 2. Reject wrong file type with Vietnamese error
    try {
      await page.evaluate(() => {
        const dt = new DataTransfer();
        dt.items.add(new File(["hello world"], "invalid.txt", { type: "text/plain" }));
        window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
      });
      await page.waitForSelector("text=Định dạng không hỗ trợ", { timeout: 5000 });
      pass("e2e_reject_invalid_file");
    } catch (err) {
      fail("e2e_reject_invalid_file", err.message);
    }

    // 3. Drag-drop valid image via DataTransfer
    try {
      await page.evaluate((b64) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const file = new File([bytes], "dropped_doc.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
      }, pngBase64);
      await page.waitForSelector("text=dropped_doc.png", { timeout: 5000 });
      await page.waitForSelector("text=400 × 500 px", { timeout: 5000 });
      pass("e2e_drag_drop_image");
    } catch (err) {
      fail("e2e_drag_drop_image", err.message);
    }

    // 4. Paste image via ClipboardEvent on window
    try {
      await page.evaluate((b64) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const file = new File([bytes], "pasted_doc.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        const pasteEv = new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(pasteEv);
      }, pngBase64);
      await page.waitForSelector("text=pasted_doc.png", { timeout: 5000 });
      pass("e2e_paste_image");
    } catch (err) {
      fail("e2e_paste_image", err.message);
    }

    // 5. Select all Augraphy -> generate -> incremental results -> Cancel mid-way keeps finished results
    try {
      await page.getByRole("tab", { name: /Augraphy/i }).click();
      const pickerSection = page.locator('section[aria-label="Bộ chọn hiệu ứng"]');
      await pickerSection.getByRole("button", { name: "Chọn tất cả" }).click();

      await page.getByRole("button", { name: "Tạo ảnh", exact: true }).click();
      // Wait until at least 1 result tile appears while generating
      const gallerySection = page.locator('section[aria-label="Thư viện ảnh kết quả"]');
      await gallerySection.locator('button[aria-label^="Xem chi tiết ảnh"]').first().waitFor({ timeout: 45000 });

      // Click Cancel if still generating
      const cancelBtn = page.getByRole("button", { name: "Huỷ" });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
      await page.getByRole("button", { name: "Tạo ảnh", exact: true }).waitFor({ timeout: 10000 });
      const countAfterCancel = await gallerySection.locator('button[aria-label^="Xem chi tiết ảnh"]').count();
      if (countAfterCancel < 1) {
        fail("e2e_cancel_keeps_results", "No results remained after cancelling mid-way");
      } else {
        pass("e2e_cancel_keeps_results");
      }
    } catch (err) {
      fail("e2e_cancel_keeps_results", err.message);
    }

    // 6. Test modes (each, mix, chain) + all 7 presets + ParamEditor
    try {
      // Quick preset buttons
      const presetNames = ["Scan", "Fax", "Photocopy", "Ảnh chụp điện thoại", "Giấy cũ", "Hỏng mực", "Nặng"];
      for (const pName of presetNames) {
        await page.locator(`button[aria-pressed]:has-text("${pName}")`).click();
      }

      // Switch to Albumentations tab, select Blur + GaussNoise, customize Blur param
      const pickerSection = page.locator('section[aria-label="Bộ chọn hiệu ứng"]');
      await pickerSection.getByRole("tab", { name: /Albumentations/i }).click();
      await pickerSection.getByRole("button", { name: "Bỏ chọn" }).click();
      await pickerSection.getByRole("tab", { name: /Augraphy/i }).click();
      await pickerSection.getByRole("button", { name: "Bỏ chọn" }).click();

      await pickerSection.getByRole("tab", { name: /Albumentations/i }).click();
      await pickerSection.getByRole("checkbox", { name: "Chọn hiệu ứng Blur" }).check();
      await pickerSection.getByRole("checkbox", { name: "Chọn hiệu ứng GaussNoise" }).check();

      // Open Blur param editor popover
      await pickerSection.getByRole("button", { name: "Tuỳ chỉnh tham số Blur" }).click();
      const minInput = page.getByLabel("blur_limit tối thiểu");
      await minInput.fill("9");
      await page.keyboard.press("Escape");

      // Run in "each" mode
      await page.locator("#setting-mode").selectOption("each");
      await page.locator("#setting-seed").fill("12345");
      await page.getByRole("button", { name: "Tạo ảnh", exact: true }).click();
      await page.waitForSelector("text=Xong 2 ảnh", { timeout: 30000 });

      // Run in "chain" mode
      await page.locator("#setting-mode").selectOption("chain");
      await page.getByRole("button", { name: "Tạo ảnh", exact: true }).click();
      await page.waitForSelector("text=Xong 1 ảnh", { timeout: 30000 });

      // Run in "mix" mode (count=2)
      await page.locator("#setting-mode").selectOption("mix");
      await page.locator("#setting-mix-count").fill("2");
      await page.getByRole("button", { name: "Tạo ảnh", exact: true }).click();
      await page.waitForSelector("text=Xong 2 ảnh", { timeout: 30000 });

      await page.screenshot({ path: path.join(OUT_DIR, "02-desktop-results.png") });
      pass("e2e_modes_presets_params");
    } catch (err) {
      fail("e2e_modes_presets_params", err.message);
    }

    // 7. Lightbox before/after slider + keyboard navigation
    try {
      const gallerySection = page.locator('section[aria-label="Thư viện ảnh kết quả"]');
      await gallerySection.locator('button[aria-label^="Xem chi tiết ảnh"]').first().click();

      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ timeout: 5000 });
      await page.screenshot({ path: path.join(OUT_DIR, "03-desktop-lightbox.png") });

      const slider = dialog.getByRole("slider");
      await slider.focus();
      const beforeVal = await slider.getAttribute("aria-valuenow");
      await page.keyboard.press("ArrowRight");
      const afterVal = await slider.getAttribute("aria-valuenow");
      if (Number(afterVal) !== Number(beforeVal) + 5) {
        throw new Error(`Expected slider aria-valuenow to increase by 5 (${beforeVal} -> ${afterVal})`);
      }

      // Close with Escape
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden", timeout: 5000 });
      pass("e2e_lightbox_before_after_keyboard");
    } catch (err) {
      fail("e2e_lightbox_before_after_keyboard", err.message);
    }

    // 8. Download ZIP (selected vs all) + Save-to-folder fallback
    try {
      const gallerySection = page.locator('section[aria-label="Thư viện ảnh kết quả"]');
      const beforeDeleteCount = await gallerySection.locator('button[aria-label^="Xem chi tiết ảnh"]').count();
      // Select 1st result only
      const firstCheck = gallerySection.locator('input[type="checkbox"]').first();
      await firstCheck.check();

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20000 }),
        page.getByRole("button", { name: /Tải ZIP \(1\)/ }).click(),
      ]);

      const zipPath = path.join(OUT_DIR, "downloaded_selected.zip");
      await download.saveAs(zipPath);
      const zipBuf = fs.readFileSync(zipPath);
      const zip = await JSZip.loadAsync(zipBuf);
      const fileKeys = Object.keys(zip.files).filter((k) => !zip.files[k].dir);
      const hasManifest = fileKeys.some((k) => k.endsWith("/manifest.json"));
      const hasOriginal = fileKeys.some((k) => k.includes("/original."));
      const resultFiles = fileKeys.filter(
        (k) => !k.endsWith("/manifest.json") && !k.includes("/original.")
      );
      if (!hasManifest || !hasOriginal || resultFiles.length !== 1) {
        throw new Error(`Unexpected ZIP contents: ${fileKeys.join(", ")}`);
      }
      const manifestEntry = zip.file(fileKeys.find((k) => k.endsWith("/manifest.json")));
      const manifestJson = JSON.parse(await manifestEntry.async("string"));
      if (!manifestJson.seed || !Array.isArray(manifestJson.results) || manifestJson.results.length !== 1) {
        throw new Error("Invalid manifest.json in downloaded ZIP");
      }

      // Test Save-to-folder fallback when showDirectoryPicker is unavailable
      await page.evaluate(() => {
        delete window.showDirectoryPicker;
      });
      const [fallbackDownload] = await Promise.all([
        page.waitForEvent("download", { timeout: 20000 }),
        page.getByRole("button", { name: "Lưu vào thư mục" }).click(),
      ]);
      if (!fallbackDownload.suggestedFilename().endsWith(".zip")) {
        throw new Error("Save-to-folder fallback did not download a .zip file");
      }

      // Delete selected result and verify count drops by 1
      await gallerySection.getByRole("button", { name: /Xoá \(1\)/ }).click();
      const remainingCount = await gallerySection.locator('button[aria-label^="Xem chi tiết ảnh"]').count();
      if (remainingCount !== beforeDeleteCount - 1) {
        throw new Error(`Expected ${beforeDeleteCount - 1} remaining results after delete, got ${remainingCount}`);
      }
      pass("e2e_download_zip_and_folder_fallback");
    } catch (err) {
      fail("e2e_download_zip_and_folder_fallback", err.message);
    }

    // 9. Theme toggle & Keyboard-only navigation check
    try {
      const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
      await page.getByRole("button", { name: /Chuyển sang giao diện/ }).click();
      const nextTheme = await page.evaluate(() => document.documentElement.dataset.theme);
      if (initialTheme === nextTheme) {
        throw new Error("Theme toggle did not update html[data-theme]");
      }
      // Toggle back to dark
      await page.getByRole("button", { name: /Chuyển sang giao diện/ }).click();
      pass("e2e_theme_toggle");
    } catch (err) {
      fail("e2e_theme_toggle", err.message);
    }

    // 9b. "Tạo tất cả" one-click runs all ok effects to completion
    try {
      await page.locator("#setting-max-side").fill("512");
      await page.getByRole("button", { name: /Tạo tất cả/ }).first().click();
      await page.waitForSelector('[role="region"][aria-label="Thanh tác vụ chính"] >> text=/Xong \\d+ ảnh/', {
        timeout: 180000,
      });
      const badgeText = await page
        .locator('section[aria-label="Thư viện ảnh kết quả"]')
        .locator("text=/\\d+ ảnh/")
        .first()
        .textContent();
      const match = badgeText?.match(/(\d+)/);
      const totalGenerated = match ? parseInt(match[1], 10) : 0;
      if (totalGenerated < 100) {
        throw new Error(`Expected >= 100 results from Tạo tất cả, got ${totalGenerated}`);
      }
      pass("e2e_generate_all");
    } catch (err) {
      fail("e2e_generate_all", err.message);
    }

    await context.close();

    // =========================================================================
    // 10. Mobile 390x844 Viewport Check
    // =========================================================================
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(BASE_URL, { waitUntil: "networkidle" });
    await mobilePage.waitForSelector("text=Aug Lab");
    await mobilePage.screenshot({ path: path.join(OUT_DIR, "04-mobile-390.png") });
    await mobileCtx.close();
    pass("e2e_mobile_390_viewport");
  } finally {
    await browser?.close().catch(() => {});
    stopDevServer(devChild);
  }

  if (failures.length > 0) {
    for (const f of failures) {
      console.log(`FAIL: ${f.name} — ${f.cause}`);
    }
    process.exit(1);
  }

  console.log("PASS: All E2E browser tests passed (1280 desktop + 390 mobile)");
}

main().catch((err) => {
  console.log(`FAIL: e2e_runner — ${err.message}`);
  process.exit(1);
});
