import { spawn } from "node:child_process";
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, process.env.CAPTURE_DEMO_SOURCE ?? "demo-source/ASP.pdf");
const outputDir = path.join(root, "public", "demo");
const originalOutputPath = path.join(outputDir, "demo-original.png");
const optimizedOutputPath = path.join(outputDir, "demo-optimized-academic.png");
const manifestOutputPath = path.join(root, "lib", "product", "demoAssetManifest.generated.json");
const port = Number(process.env.CAPTURE_DEMO_PORT ?? 3224);
const baseUrl = `http://127.0.0.1:${port}`;
const target = {
  file: "demo-source/ASP.pdf",
  presetId: "academic-paper",
  presetLabel: "Academic Paper",
  sourcePage: 1,
  column: "left",
  tileIndex: 2,
  tileCount: 2,
  label: "Page 1 · left column · tile 2 of 2",
  demoTarget: "asp-ipad-page-1-left-tile-2"
};

async function main() {
  await ensureDemoSource();
  await mkdir(outputDir, { recursive: true });

  const server = await startApp();
  let browser;

  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
      deviceScaleFactor: 2
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await waitForAppReady(page);
    await page.addStyleTag({
      content: "*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }"
    }).catch(() => undefined);
    await uploadDemoPdf(page);
    await waitForSourceReady(page);
    await selectAcademicPreset(page);
    await waitForPreviewReady(page);

    const original = page.getByTestId(`original-preview-page-${target.sourcePage}`).first();
    await ensureVisible(original, "original preview not found", "Expected original source preview for ASP.pdf page 1.");

    const optimized = page.locator(`[data-demo-target="${target.demoTarget}"]`).first();
    const candidates = await getOptimizedCandidates(page);
    await ensureVisible(
      optimized,
      "exact target tile not found",
      [
      `Could not find demo target: ASP.pdf, ${target.presetLabel}, ${target.label}.`,
      "Rendered optimized candidates:",
      candidates.length > 0 ? candidates.map((candidate) => `  - ${candidate}`).join("\n") : "  - none",
      "The Academic Paper preset must produce this exact tile before demo capture can succeed."
      ].join("\n")
    );

    await original.scrollIntoViewIfNeeded();
    await original.screenshot({ path: originalOutputPath, animations: "disabled" });
    await optimized.scrollIntoViewIfNeeded();
    await optimized.screenshot({ path: optimizedOutputPath, animations: "disabled" });

    await verifyGeneratedAsset(originalOutputPath, "public/demo/demo-original.png");
    await verifyGeneratedAsset(optimizedOutputPath, "public/demo/demo-optimized-academic.png");
    await writeDemoAssetManifest();

    console.log([
      "Demo assets generated.",
      `Original: ${path.relative(root, originalOutputPath)}`,
      `Optimized Academic: ${path.relative(root, optimizedOutputPath)}`,
      `Manifest: ${path.relative(root, manifestOutputPath)}`,
      `Target: ASP.pdf, ${target.presetLabel}, ${target.label}`,
      "Screenshot quality: Playwright locator screenshots, viewport 1440x1100, deviceScaleFactor 2."
    ].join("\n"));
  } catch (error) {
    fail("demo capture failed", getErrorMessage(error));
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

async function ensureDemoSource() {
  try {
    await access(sourcePath);
  } catch {
    fail("ASP.pdf missing", [
      "Could not find demo source: demo-source/ASP.pdf.",
      "Place the selected source PDF at demo-source/ASP.pdf, then rerun npm run capture:demo.",
      expectedTargetText()
    ].join("\n"));
  }
}

async function startApp() {
  if (await isServerReady()) {
    return { kill: () => undefined };
  }

  const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_PLAN_TIER: process.env.NEXT_PUBLIC_PLAN_TIER ?? "pro"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  server.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  const ready = await waitForServer(45_000);
  if (!ready) {
    server.kill("SIGTERM");
    fail("app not running", [
      `Could not start the app at ${baseUrl}.`,
      "Start the app with npm run dev, then rerun npm run capture:demo.",
      logs.trim() ? `Recent server output:\n${logs.slice(-1600)}` : ""
    ].filter(Boolean).join("\n"));
  }

  return server;
}

async function uploadDemoPdf(page) {
  const input = page.getByTestId("upload-input");
  await ensureVisible(input, "upload input not found", "Expected data-testid=\"upload-input\" on the PDF file input.");
  await input.setInputFiles(sourcePath);
}

async function waitForAppReady(page) {
  const ready = await page.waitForFunction(
    () => Boolean(window.__PDF_READING_QA__),
    { timeout: 30_000 }
  ).then(() => true).catch(() => false);

  if (!ready) {
    fail("app not ready", [
      "The app loaded, but the browser QA hook did not become available.",
      "Start the app with npm run dev and confirm the page hydrates correctly, then rerun npm run capture:demo.",
      expectedTargetText()
    ].join("\n"));
  }
}

async function selectAcademicPreset(page) {
  const preset = page.getByTestId(`preset-${target.presetId}`);
  await ensureVisible(preset, "Academic Paper preset not found", "Expected data-testid=\"preset-academic-paper\" on the Academic Paper preset.");
  await preset.click();
}

async function waitForSourceReady(page) {
  const settled = await page.waitForFunction(
    () => {
      const hook = window.__PDF_READING_QA__;
      if (!hook) return false;
      const summary = hook.getLatestSummary();
      return summary.status === "ready" && Number(summary.sourcePageCount ?? 0) >= 1;
    },
    { timeout: 45_000 }
  ).then(() => true).catch(() => false);

  if (!settled) {
    fail("processing timed out", [
      "The original PDF preview did not become ready after upload.",
      expectedTargetText(),
      "Confirm demo-source/ASP.pdf is a valid PDF and can be opened in the app."
    ].join("\n"));
  }
}

async function waitForPreviewReady(page) {
  const settled = await page.waitForFunction(
    (expectedPreset) => {
      const hook = window.__PDF_READING_QA__;
      if (!hook) return false;
      const summary = hook.getLatestSummary();
      return summary.status === "ready" &&
        summary.optimizedStatus === "ready" &&
        summary.selectedPreset === expectedPreset;
    },
    target.presetId,
    { timeout: 45_000 }
  ).then(() => true).catch(() => false);

  if (!settled) {
    fail("processing timed out", [
      "PDF processing did not settle before the capture timeout.",
      expectedTargetText(),
      "Try running npm run dev manually and confirm ASP.pdf can be processed with the Academic Paper preset."
    ].join("\n"));
  }
}

async function ensureVisible(locator, reason, detail) {
  const visible = await locator.isVisible({ timeout: 20_000 }).catch(() => false);
  if (!visible) {
    fail(reason, [detail, expectedTargetText()].join("\n"));
  }
}

async function getOptimizedCandidates(page) {
  return page.locator('[data-preview-kind="optimized"]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const sourcePage = node.getAttribute("data-source-page") || "?";
      const column = node.getAttribute("data-column") || "full";
      const tileIndex = node.getAttribute("data-tile-index") || "?";
      const tileCount = node.getAttribute("data-tile-count") || "?";
      const preset = node.getAttribute("data-preset") || "?";
      return `preset=${preset}, page=${sourcePage}, column=${column}, tile=${tileIndex} of ${tileCount}`;
    })
  ).catch(() => []);
}

async function verifyGeneratedAsset(filePath, label) {
  try {
    const info = await stat(filePath);
    if (info.size < 8_000) {
      fail("screenshot write failed", `${label} was created but is unexpectedly small (${info.size} bytes).`);
    }
  } catch {
    fail("screenshot write failed", `${label} was not written.`);
  }
}

async function writeDemoAssetManifest() {
  const original = await versionedDemoAsset("demo-original.png");
  const academic = await versionedDemoAsset("demo-optimized-academic.png");
  const ipad = await versionedDemoAsset("demo-optimized-ipad.png").catch(() => academic);
  const kindle = await versionedDemoAsset("demo-optimized-kindle.png").catch(() => ipad);
  const manifest = {
    original,
    optimized: {
      academic,
      kindle,
      ipad
    }
  };

  await writeFile(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function versionedDemoAsset(fileName) {
  const filePath = path.join(outputDir, fileName);
  const info = await stat(filePath);
  const source = `/demo/${fileName}`;
  return {
    source,
    src: `${source}?v=${Math.round(info.mtimeMs)}`
  };
}

async function isServerReady() {
  return new Promise((resolve) => {
    const request = http.get(baseUrl, (response) => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode < 500));
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerReady()) return true;
    await delay(500);
  }
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expectedTargetText() {
  return [
    "Expected demo target:",
    `  Source: ${target.file}`,
    `  Preset: ${target.presetLabel}`,
    `  Source page: ${target.sourcePage}`,
    `  Output target: ${target.label}`,
    "Expected outputs:",
    "  public/demo/demo-original.png",
    "  public/demo/demo-optimized-academic.png"
  ].join("\n");
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function fail(reason, message) {
  console.error([
    `Demo capture failed: ${reason}.`,
    "",
    message
  ].join("\n"));
  process.exit(1);
}

void main();
