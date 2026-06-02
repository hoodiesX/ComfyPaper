import { spawn } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const pdfDir = path.join(root, "qa", "pdfs");
const reportDir = path.join(root, "qa", "reports");
const screenshotDir = path.join(root, "qa", "screenshots");
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const planArg = rawArgs.find((arg) => arg.startsWith("--plan="))?.split("=")[1];
const qaPlanTier = planArg === "pro" ? "pro" : planArg === "free" ? "free" : undefined;
const defaultPort = qaPlanTier === "pro" ? 3212 : qaPlanTier === "free" ? 3211 : 3213;
const port = Number(process.env.QA_ACADEMIC_PORT ?? defaultPort);
const baseUrl = `http://127.0.0.1:${port}`;
const presets = [
  { id: "academic-paper", buttonTitle: "Academic Paper" },
  { id: "kindle-ereader", buttonTitle: "Kindle / E-reader" }
];
const reportOnly = args.has("--report-only") || process.env.QA_ACADEMIC_NON_BLOCKING === "1";

async function main() {
  const pdfs = await getQaPdfs();
  if (pdfs.length === 0) {
    console.log("No QA PDFs found. Add PDFs to ./qa/pdfs to run visual/layout QA.");
    return;
  }

  const { chromium } = await loadPlaywright();
  await mkdir(reportDir, { recursive: true });
  await mkdir(screenshotDir, { recursive: true });

  const server = await startNextServer();
  let browser;
  const reports = [];

  try {
    browser = await chromium.launch({ headless: true });
    for (const pdf of pdfs) {
      for (const preset of presets) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
        const report = await runPdfQa(page, pdf, preset);
        reports.push(report);
        await page.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }

  applyModeComparisons(reports);

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    totalFiles: pdfs.length,
    totalPages: reports.reduce((sum, report) => sum + report.pages.length, 0),
    pagesAnalyzed: reports.reduce((sum, report) => sum + report.pagesAnalyzed, 0),
    totalSourcePages: reports.reduce((sum, report) => sum + report.totalSourcePages, 0),
    analysisLimitApplied: reports.some((report) => report.analysisLimitApplied),
    reports,
    technicalFailureCount: reports.filter((report) => report.technicalFailure).length,
    productQualityFailureCount: reports.filter((report) => report.productQualityFailure).length,
    productQualityWarningCount: reports.reduce((sum, report) => sum + report.pages.filter((page) => page.productQualityIssues.length > 0 && page.qualityGatePassed).length, 0),
    shortPageCount: reports.reduce((sum, report) => sum + report.shortPageCount, 0),
    badOrphanPageCount: reports.reduce((sum, report) => sum + report.badOrphanPageCount, 0),
    naturalShortFinalCount: reports.reduce((sum, report) => sum + report.naturalShortFinalCount, 0),
    orphanRepairCount: reports.reduce((sum, report) => sum + report.orphanRepairCount, 0),
    bodyPaginationRegressionCount: reports.reduce((sum, report) => sum + report.bodyPaginationRegressionCount, 0),
    firstPagePolicyCounts: getFirstPagePolicyCounts(reports),
    firstPagePreservedShortBodyCount: reports.reduce((sum, report) => sum + report.firstPagePreservedShortBodyCount, 0),
    firstPageHardFailureCount: reports.reduce((sum, report) => sum + report.firstPageHardFailureCount, 0),
    firstPageWarningCount: reports.reduce((sum, report) => sum + report.firstPageWarningCount, 0),
    firstPageSevereFailureCount: reports.reduce((sum, report) => sum + report.firstPageSevereFailureCount, 0),
    kindleTallSliceCount: reports.reduce((sum, report) => sum + report.kindleTallSliceCount, 0),
    kindleReportsAnalyzed: reports.filter((report) => report.selectedPreset === "kindle-ereader").length,
    kindleQualityFailureCount: reports.filter((report) => report.selectedPreset === "kindle-ereader" && report.productQualityFailure).length,
    kindleOverfragmentedPageCount: reports.reduce((sum, report) => sum + report.kindleOverfragmentedPageCount, 0),
    kindleTinySliceCount: reports.reduce((sum, report) => sum + report.kindleTinySliceCount, 0),
    kindleCropBoundaryRiskCount: reports.reduce((sum, report) => sum + report.kindleCropBoundaryRiskCount, 0),
    kindleLowFillPageCount: reports.reduce((sum, report) => sum + report.kindleLowFillPageCount, 0),
    kindleSingleSentencePageCount: reports.reduce((sum, report) => sum + report.kindleSingleSentencePageCount, 0),
    kindleUnreadablePageCount: reports.reduce((sum, report) => sum + report.kindleUnreadablePageCount, 0),
    kindleMedianRowsPerPage: median(reports.flatMap((report) => report.pages.flatMap((page) => page.rowsPerSliceDistribution ?? []))),
    kindleMinRowsPerPage: min(reports.flatMap((report) => report.pages.flatMap((page) => page.rowsPerSliceDistribution ?? []))),
    kindleMedianVerticalFillRatio: median(reports.flatMap((report) => report.pages.flatMap((page) => page.verticalFillRatios ?? []))),
    kindleMinVerticalFillRatio: min(reports.flatMap((report) => report.pages.flatMap((page) => page.verticalFillRatios ?? []))),
    kindleComfortBalancePassed: reports
      .filter((report) => report.selectedPreset === "kindle-ereader")
      .every((report) => report.pages.every((page) => page.kindleComfortBalancePassed !== false)),
    kindleMicroZoomApplied: reports.some((report) =>
      report.selectedPreset === "kindle-ereader" &&
      report.pages.some((page) => page.kindleMicroZoomApplied)
    ),
    kindleZoomPolishApplied: reports.some((report) =>
      report.selectedPreset === "kindle-ereader" &&
      report.pages.some((page) => page.kindleZoomPolishApplied)
    ),
    userReportGenerated: reports.every((report) => report.userReportGenerated),
    devDiagnosticsHiddenForUser: reports.every((report) => report.devDiagnosticsHiddenForUser),
    fullDocumentExportAvailableInPro: reports.some((report) => report.fullDocumentExportAvailableInPro),
    freeExportLimitApplied: reports.some((report) => report.freeExportLimitApplied),
    freeExportLimitVisible: reports.every((report) => report.freeExportLimitVisible),
    batchUploadAvailableInPro: reports.some((report) => report.batchUploadAvailableInPro),
    batchZipGenerated: reports.some((report) => report.batchZipGenerated),
    batchSummaryGenerated: reports.some((report) => report.batchSummaryGenerated),
    failedBatchFileHandled: reports.every((report) => report.failedBatchFileHandled),
    exportReadinessRendered: reports.every((report) => report.exportReadinessRendered),
    exportReadiness: [...new Set(reports.map((report) => report.exportReadiness).filter(Boolean))],
    exportReadinessStatus: [...new Set(reports.map((report) => report.exportReadinessStatus).filter(Boolean))],
    exportLimitVisible: reports.every((report) => report.exportLimitVisible),
    optimizedBodyPagesCount: reports.reduce((sum, report) => sum + (report.optimizedBodyPagesCount ?? 0), 0),
    preservedPagesCount: reports.reduce((sum, report) => sum + (report.preservedPagesCount ?? 0), 0),
    reviewPagesCount: reports.reduce((sum, report) => sum + (report.reviewPagesCount ?? 0), 0),
    bestComparisonPageSelected: reports.filter((report) => report.bestComparisonPageSelected).length,
    bestImprovementPageSelected: reports.filter((report) => report.bestComparisonPageSelected).length,
    bestImprovementReason: [...new Set(reports.map((report) => report.bestImprovementReason).filter(Boolean))],
    userOptimizationReportRendered: reports.every((report) => report.userOptimizationReportRendered),
    exportLimitApplied: reports.some((report) => report.exportLimitApplied),
    exportScope: [...new Set(reports.map((report) => report.exportScope).filter(Boolean))],
    sourcePagesIncluded: [...new Set(reports.map((report) => report.sourcePagesIncluded).filter(Boolean))],
    totalSourcePages: [...new Set(reports.map((report) => report.totalSourcePages).filter(Boolean))],
    batchFileCount: reports.reduce((sum, report) => sum + (report.batchFileCount ?? 0), 0),
    batchCompletedCount: reports.reduce((sum, report) => sum + (report.batchCompletedCount ?? 0), 0),
    batchFailedCount: reports.reduce((sum, report) => sum + (report.batchFailedCount ?? 0), 0),
    zipGenerated: reports.some((report) => report.batchZipGenerated),
    exportProgressRendered: reports.some((report) => report.exportProgressRendered),
    noSilentPartialExport: reports.every((report) => report.noSilentPartialExport),
    duplicatePrimaryCtaCount: Math.max(...reports.map((report) => report.duplicatePrimaryCtaCount ?? 0)),
    singlePdfExportCtaVisible: reports.every((report) => report.singlePdfExportCtaVisible),
    topBarExportCtaVisible: reports.some((report) => report.topBarExportCtaVisible),
    exportReadinessCtaVisible: reports.every((report) => report.exportReadinessCtaVisible),
    planTierVisible: reports.every((report) => report.planTierVisible),
    freeSourcePageLimit: reports.find((report) => report.freeSourcePageLimit)?.freeSourcePageLimit,
    freeReadingPageLimit: reports.find((report) => report.freeReadingPageLimit)?.freeReadingPageLimit,
    exportLimitHitBy: [...new Set(reports.map((report) => report.exportLimitHitBy).filter(Boolean))],
    batchState: [...new Set(reports.map((report) => report.batchState).filter(Boolean))],
    batchJobsCount: reports.reduce((sum, report) => sum + (report.batchJobsCount ?? 0), 0),
    batchQueuedCount: reports.reduce((sum, report) => sum + (report.batchQueuedCount ?? 0), 0),
    batchProcessingCount: reports.reduce((sum, report) => sum + (report.batchProcessingCount ?? 0), 0),
    batchPrimaryActionLabel: [...new Set(reports.map((report) => report.batchPrimaryActionLabel).filter(Boolean))],
    zipDownloadAvailable: reports.some((report) => report.zipDownloadAvailable),
    landingHeroRendered: reports.every((report) => report.landingHeroRendered),
    heroValuePropositionClear: reports.every((report) => report.heroValuePropositionClear),
    landingDemoRealistic: reports.every((report) => report.landingDemoRealistic),
    landingMockupPremiumQuality: reports.every((report) => report.landingMockupPremiumQuality),
    heroUsesRealOptimizedAssetWhenAvailable: reports.every((report) => report.heroUsesRealOptimizedAssetWhenAvailable),
    heroVisualPremiumComposition: reports.every((report) => report.heroVisualPremiumComposition),
    demoFramesCentered: reports.every((report) => report.demoFramesCentered),
    kindlePreviewNotTiny: reports.every((report) => report.kindlePreviewNotTiny),
    devicePreviewSystemUnified: reports.every((report) => report.devicePreviewSystemUnified),
    realAssetCopyNotMarkedIllustration: reports.every((report) => report.realAssetCopyNotMarkedIllustration),
    fallbackCopyMarkedIllustration: reports.every((report) => report.fallbackCopyMarkedIllustration),
    demoImageSharpnessConstraintsPresent: reports.every((report) => report.demoImageSharpnessConstraintsPresent),
    noFallbackFlickerWhenRealAssetsExist: reports.every((report) => report.noFallbackFlickerWhenRealAssetsExist),
    demoScreenshotOverflowContained: reports.every((report) => report.demoScreenshotOverflowContained),
    heroMockupExplainsValue: reports.every((report) => report.heroMockupExplainsValue),
    transformCuePremium: reports.every((report) => report.transformCuePremium),
    beforeAfterMockupConcrete: reports.every((report) => report.beforeAfterMockupConcrete),
    deviceMockupsDistinct: reports.every((report) => report.deviceMockupsDistinct),
    uploadAnchorVisible: reports.every((report) => report.uploadAnchorVisible),
    beforeAfterSectionRendered: reports.every((report) => report.beforeAfterSectionRendered),
    pricingSectionRendered: reports.every((report) => report.pricingSectionRendered),
    faqRendered: reports.every((report) => report.faqRendered),
    seoMetadataPresent: reports.every((report) => report.seoMetadataPresent),
    freeProGatingConsistent: reports.every((report) => report.freeProGatingConsistent),
    freeProPlanAwareRendering: reports.every((report) => report.freeProPlanAwareRendering),
    proUpgradeCtaHidden: reports.every((report) => report.proUpgradeCtaHidden),
    freeUpgradeCtaVisible: reports.every((report) => report.freeUpgradeCtaVisible),
    proOperationalDashboardVisible: reports.every((report) => report.proOperationalDashboardVisible),
    batchQueuedHasNextAction: reports.every((report) => report.batchQueuedHasNextAction),
    batchDuplicateCtaCount: Math.max(...reports.map((report) => report.batchDuplicateCtaCount ?? 0)),
    batchPerFileDashboardRendered: reports.every((report) => report.batchPerFileDashboardRendered),
    batchExpandableSummaryAvailable: reports.every((report) => report.batchExpandableSummaryAvailable),
    zipIncludesHumanSummary: reports.every((report) => report.zipIncludesHumanSummary),
    zipIncludesTechnicalJsonByDefault: reports.some((report) => report.zipIncludesTechnicalJsonByDefault),
    userReportsNonTechnical: reports.every((report) => report.userReportsNonTechnical),
    realDemoAssetSupportExists: reports.every((report) => report.realDemoAssetSupportExists),
    realDemoAssetsDetected: reports.some((report) => report.realDemoAssetsDetected),
    demoAssetFallbackWorks: reports.every((report) => report.demoAssetFallbackWorks),
    demoAssetDocsExist: reports.every((report) => report.demoAssetDocsExist),
    demoRenderScriptExistsOrDocumented: reports.every((report) => report.demoRenderScriptExistsOrDocumented),
    selectedDemoTargetDocumented: reports.every((report) => report.selectedDemoTargetDocumented),
    landingDemoUsesBodyPageFraming: reports.every((report) => report.landingDemoUsesBodyPageFraming),
    landingDemoDoesNotOverpromiseTitleReflow: reports.every((report) => report.landingDemoDoesNotOverpromiseTitleReflow),
    landingAndLivePreviewSeparated: reports.every((report) => report.landingAndLivePreviewSeparated),
    livePreviewPersonalizedAfterUpload: reports.every((report) => report.livePreviewPersonalizedAfterUpload),
    demoFallbackMarkedAsIllustration: reports.every((report) => report.demoFallbackMarkedAsIllustration),
    heroVisualNotOverloaded: reports.every((report) => report.heroVisualNotOverloaded),
    deviceDemoTabsGracefullyFallback: reports.every((report) => report.deviceDemoTabsGracefullyFallback),
    preservedPagesExplained: reports.every((report) => report.preservedPagesExplained),
    noRawDiagnosticsVisible: reports.every((report) => report.noRawDiagnosticsVisible),
    batchDashboardUsable: reports.every((report) => report.batchDashboardUsable),
    exportReadinessClear: reports.every((report) => report.exportReadinessClear),
    productUxReadinessScore: Math.min(...reports.map((report) => report.productUxReadinessScore ?? 0)),
    planTier: [...new Set(reports.map((report) => report.planTier).filter(Boolean))],
    freeExportLimit: reports.find((report) => report.freeExportLimit)?.freeExportLimit,
    presetCopyRendered: reports.every((report) => report.presetCopyRendered),
    proHooksRendered: reports.every((report) => report.proHooksRendered),
    localFirstTrustCopyRendered: reports.every((report) => report.localFirstTrustCopyRendered),
    upgradeCTAVisible: reports.some((report) => report.upgradeCTAVisible),
    academicRegressionCount: reports.reduce((sum, report) => sum + report.bodyPaginationRegressionCount, 0),
    kindlePagesWithTextClippingRisk: reports.flatMap((report) =>
      report.pages
        .filter((page) => page.kindleCropBoundaryRiskCount > 0)
        .map((page) => `${report.fileName}:${report.selectedPreset}:page-${page.pageNumber}`)
    ),
    filesWhereKindleEqualsAcademicOutput: getFilesWhereKindleMatchesAcademic(reports),
    pagesWhereKindleSlicesTooTall: reports.flatMap((report) =>
      report.pages
        .filter((page) => page.kindleTallSliceCount > 0)
        .map((page) => `${report.fileName}:${report.selectedPreset}:page-${page.pageNumber}`)
    ),
    pagesWhereKindleImprovedReadability: reports.flatMap((report) =>
      report.pages
        .filter((page) => page.kindleMoreAggressiveThanAcademic === true)
        .map((page) => `${report.fileName}:page-${page.pageNumber}`)
    ),
    severeFailureCount: reports.filter((report) => report.severeFailure).length,
    warningsCount: reports.reduce((sum, report) => sum + report.pages.filter((page) => page.fullColumnFallbackCount > 0 || page.productQualityIssues.length > 0).length, 0),
    filesWithFailures: reports.filter((report) => report.severeFailure).map((report) => `${report.fileName}:${report.selectedPreset}`),
    filesWithProductQualityIssues: reports.filter((report) => report.productQualityFailure).map((report) => `${report.fileName}:${report.selectedPreset}`),
    pagesWithFailures: reports.flatMap((report) =>
      report.pages
        .filter((page) => page.severeFailure)
        .map((page) => `${report.fileName}:${report.selectedPreset}:page-${page.pageNumber}`)
    ),
    pagesWithProductQualityIssues: reports.flatMap((report) =>
      report.pages
        .filter((page) => page.productQualityFailure)
        .map((page) => `${report.fileName}:${report.selectedPreset}:page-${page.pageNumber}:${page.productQualityIssues.join("|")}`)
    )
  };
  const reportPath = path.join(reportDir, `academic-qa-${Date.now()}.json`);
  await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.table(reports.map((report) => ({
    fileName: report.fileName,
    preset: report.selectedPreset,
    pages: report.pages.length,
    validation: report.planValidationPassed,
    quality: report.qualityGatePassed,
    severe: report.severeFailure,
    failures: report.unrepairedFailures.join(",") || report.productQualityIssues.join(",") || "none"
  })));
  console.log(`Academic QA report written to ${path.relative(root, reportPath)}`);

  if (summary.severeFailureCount > 0 && !reportOnly) {
    process.exitCode = 1;
  }
}

async function getQaPdfs() {
  try {
    const entries = await readdir(pdfDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .map((entry) => ({ name: entry.name, path: path.join(pdfDir, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      `Playwright is required for real browser QA. Run "npm install" and "npx playwright install chromium". ${error instanceof Error ? error.message : ""}`
    );
  }
}

async function startNextServer() {
  const alreadyRunning = await canReachApp();
  if (alreadyRunning) {
    return { kill() {} };
  }

  const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "development", ...(qaPlanTier ? { NEXT_PUBLIC_PLAN_TIER: qaPlanTier } : {}) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await canReachApp()) return server;
    await delay(500);
  }

  server.kill("SIGTERM");
  throw new Error(`Next.js dev server did not start at ${baseUrl}.\n${output}`);
}

function canReachApp() {
  return new Promise((resolve) => {
    const request = http.get(baseUrl, (response) => {
      response.resume();
      resolve(response.statusCode ? response.statusCode < 500 : false);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(750, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function runPdfQa(page, pdf, preset) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__PDF_READING_QA__), undefined, { timeout: 15_000 });
  await page.evaluate((presetId) => {
    window.__PDF_READING_QA__.selectPreset(presetId);
    window.__PDF_READING_QA__.setColumnMode(true);
  }, preset.id);
  await page.setInputFiles('input[type="file"]', pdf.path);
  const initialSettled = await waitForQaSettled(page, preset.id);

  const screenshotPath = path.join(
    screenshotDir,
    `${safeName(pdf.name)}-${preset.id}.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const qa = await page.evaluate(() => {
    const hook = window.__PDF_READING_QA__;
    if (!hook) throw new Error("QA hook is not available.");
    const text = document.body.innerText;
    return {
      summary: hook.getLatestSummary(),
      diagnostics: hook.getLatestDiagnostics(),
      plan: hook.getLatestPlan(),
      ui: {
        diagnosticsPanelVisible: text.includes("Column Reading Diagnostics"),
        rawDiagnosticsVisible: [
          "gutter ink density",
          "raw decision",
          "tile breaks",
          "row coverage internals",
          "plan JSON"
        ].some((needle) => text.toLowerCase().includes(needle)),
        exportReadinessRendered: Boolean(document.querySelector("[data-qa='export-readiness-card']")),
        duplicatePrimaryCtaCount: Math.max(0, document.querySelectorAll("[data-qa='single-pdf-export-cta']").length - 1),
        singlePdfExportCtaVisible: Boolean(document.querySelector("[data-qa='single-pdf-export-cta']")),
        topBarExportCtaVisible: Array.from(document.querySelectorAll("button")).some((button) =>
          button.textContent?.trim() === "Export PDF" && !button.matches("[data-qa='single-pdf-export-cta']")
        ),
        exportReadinessCtaVisible: Boolean(document.querySelector("[data-qa='export-readiness-card'] [data-qa='single-pdf-export-cta']")),
        planTierVisible: Boolean(document.querySelector("[data-qa='plan-tier-indicator']")),
        batchPrimaryActionLabel: document.querySelector("[data-qa='batch-primary-action']")?.textContent?.trim() ?? "",
        batchState: document.querySelector("[data-qa='batch-export-panel']")?.getAttribute("data-batch-state") ?? "",
        zipDownloadAvailable: document.querySelector("[data-qa='batch-primary-action']")?.textContent?.trim() === "Download ZIP",
        batchDuplicateCtaCount: Math.max(0, Array.from(document.querySelectorAll("[data-qa='batch-export-panel'] button")).filter((button) =>
          button.textContent?.trim() === "Choose PDFs"
        ).length - 1),
        batchPerFileDashboardRendered: Boolean(document.querySelector("[data-qa='batch-file-dashboard']")) ||
          ["locked", "empty"].includes(document.querySelector("[data-qa='batch-export-panel']")?.getAttribute("data-batch-state") ?? ""),
        batchExpandableSummaryAvailable: Boolean(document.querySelector("[data-qa='batch-summary-toggle']")) ||
          document.querySelector("[data-qa='batch-export-panel']")?.getAttribute("data-batch-state") !== "completed",
        landingHeroRendered: Boolean(document.querySelector("[data-qa='landing-hero']")),
        heroValuePropositionClear: text.includes("Make research papers readable on Kindle, iPad and e-readers"),
        landingDemoRealistic: Boolean(document.querySelector("[data-qa='hero-demo-visual']")) &&
          (Boolean(document.querySelector("[data-demo-asset-variant='landing-original']")) || Boolean(document.querySelector("[data-qa='original-academic-mockup']"))) &&
          (Boolean(document.querySelector("[data-demo-asset-variant^='landing-']")) || Boolean(document.querySelector("[data-qa='reading-layout-mockup']"))),
        landingMockupPremiumQuality: Boolean(document.querySelector("[data-qa='hero-demo-visual']")) &&
          Boolean(document.querySelector("[data-qa='device-preview-frame']")) &&
          (Boolean(document.querySelector("[data-qa='demo-asset-real']")) || Boolean(document.querySelector("[data-qa='demo-asset-fallback']"))),
        heroUsesRealOptimizedAssetWhenAvailable: !document.querySelector("[data-demo-asset-source='/demo/demo-optimized-academic.png']") ||
          Boolean(document.querySelector("[data-demo-asset-variant='hero-optimized'][data-demo-asset-source='/demo/demo-optimized-academic.png']")),
        heroVisualPremiumComposition: Boolean(document.querySelector("[data-qa='hero-demo-visual']")) &&
          Boolean(document.querySelector("[data-qa='premium-transform-cue']")) &&
          !Boolean(document.querySelector("[data-qa='premium-transform-cue']")?.textContent?.includes("->")),
        demoFramesCentered: Array.from(document.querySelectorAll("[data-qa='device-preview-stage'], [data-qa='device-preview-frame']")).every((node) => {
          const className = node.getAttribute("class") ?? "";
          return className.includes("items-center") && className.includes("justify-center");
        }),
        kindlePreviewNotTiny: Boolean(document.querySelector("[data-qa='device-preview-frame'][data-device='kindle']")) ||
          Boolean(document.querySelector("[data-qa='device-tab-kindle']")),
        devicePreviewSystemUnified: Boolean(document.querySelector("[data-qa='device-preview-stage']")) &&
          Boolean(document.querySelector("[data-qa='device-preview-frame']")),
        realAssetCopyNotMarkedIllustration: !document.querySelector("[data-qa='real-demo-copy']") ||
          !document.querySelector("[data-qa='real-demo-copy']")?.textContent?.includes("Illustration"),
        fallbackCopyMarkedIllustration: Boolean(document.querySelector("[data-qa='fallback-demo-copy']"))
          ? Boolean(document.querySelector("[data-qa='fallback-demo-copy']")?.textContent?.includes("Illustration"))
          : true,
        demoImageSharpnessConstraintsPresent: Array.from(document.querySelectorAll("[data-qa='demo-asset-image']")).every((node) => {
          const className = node.getAttribute("class") ?? "";
          return className.includes("object-contain") && !className.includes("pixelated");
        }),
        noFallbackFlickerWhenRealAssetsExist: !document.querySelector("[data-qa='demo-asset-real']") ||
          !document.querySelector("[data-qa='demo-asset-fallback']"),
        demoScreenshotOverflowContained: Array.from(document.querySelectorAll("[data-qa='demo-asset-real'], [data-qa='device-preview-frame'], [data-qa='device-preview-stage']")).every((node) => {
          const className = node.getAttribute("class") ?? "";
          return className.includes("overflow-hidden");
        }),
        heroMockupExplainsValue: text.includes("Original paper") && text.includes("Reading layout"),
        transformCuePremium: Boolean(document.querySelector("[data-qa='premium-transform-cue']")),
        beforeAfterMockupConcrete: (Boolean(document.querySelector("[data-demo-asset-variant='landing-original']")) || Boolean(document.querySelector("[data-qa='original-academic-mockup']"))) &&
          (Boolean(document.querySelector("[data-demo-asset-variant^='landing-']")) || Boolean(document.querySelector("[data-qa='reading-layout-mockup']"))),
        deviceMockupsDistinct: Boolean(document.querySelector("[data-qa='device-preview-frame']")) &&
          Boolean(document.querySelector("[data-qa='device-tab-kindle']")) &&
          Boolean(document.querySelector("[data-qa='device-tab-ipad']")),
        uploadAnchorVisible: Boolean(document.querySelector("#tool-workflow")) && text.includes("Optimize your PDF"),
        beforeAfterSectionRendered: Boolean(document.querySelector("[data-qa='before-after-landing']")),
        pricingSectionRendered: Boolean(document.querySelector("[data-qa='pricing-section']")),
        faqRendered: Boolean(document.querySelector("[data-qa='faq-section']")),
        seoMetadataPresent: document.title.includes("Research Papers") &&
          Boolean(document.querySelector("meta[name='description']")?.getAttribute("content")?.includes("academic PDFs")),
        userOptimizationReportRendered: Boolean(document.querySelector("[data-qa='user-optimization-report']")),
        proHooksRendered: Boolean(document.querySelector("[data-qa='pro-hooks']")),
        localFirstTrustCopyRendered: Boolean(document.querySelector("[data-qa='local-first-trust']")),
        userReportsNonTechnical: ![
          "gutter",
          "row coverage",
          "crop boundary",
          "rawdecision",
          "planvalidation",
          "qualitygate",
          "json diagnostics"
        ].some((needle) => text.toLowerCase().includes(needle)),
        realDemoAssetSupportExists: Boolean(document.querySelector("[data-qa='demo-asset-fallback']")) ||
          Boolean(document.querySelector("[data-qa='demo-asset-real']")),
        realDemoAssetsDetected: Boolean(document.querySelector("[data-qa='demo-asset-real']")),
        demoAssetFallbackWorks: Boolean(document.querySelector("[data-qa='demo-asset-fallback']")) ||
          Boolean(document.querySelector("[data-qa='demo-asset-real']")),
        landingDemoUsesBodyPageFraming: text.includes("Original body page") ||
          text.includes("Original academic PDF"),
        landingDemoDoesNotOverpromiseTitleReflow: text.includes("may be preserved safely") &&
          !/perfectly reformats|works on every pdf|converts all pages|fixes any layout/i.test(text),
        landingAndLivePreviewSeparated: text.includes("From dense paper to reading layout") &&
          text.includes("Best improvement from your PDF"),
        livePreviewPersonalizedAfterUpload: text.includes("from your PDF"),
        demoFallbackMarkedAsIllustration: Boolean(document.querySelector("[data-qa='fallback-demo-copy']"))
          ? text.includes("Illustration · upload a PDF")
          : true,
        heroVisualNotOverloaded: Boolean(document.querySelector("[data-qa='premium-transform-cue']")),
        deviceDemoTabsGracefullyFallback: Boolean(document.querySelector("[data-qa='device-tab-academic']")) &&
          Boolean(document.querySelector("[data-qa='device-tab-kindle']")) &&
          Boolean(document.querySelector("[data-qa='device-tab-ipad']"))
      }
    };
  });

  return buildReport(pdf.name, preset.id, qa, path.relative(root, screenshotPath), initialSettled);
}

async function waitForQaSettled(page, presetId) {
  const deadline = Date.now() + Number(process.env.QA_ACADEMIC_WAIT_MS ?? 25_000);
  while (Date.now() < deadline) {
    const settled = await page.evaluate((expectedPreset) => {
      const hook = window.__PDF_READING_QA__;
      if (!hook) return false;
      const summary = hook.getLatestSummary();
      const presetReady = !expectedPreset || summary.selectedPreset === expectedPreset;
      const sourceSettled = summary.status === "ready" || summary.status === "error";
      const previewSettled = summary.optimizedStatus === "ready" || summary.optimizedStatus === "error";
      return presetReady && sourceSettled && previewSettled;
    }, presetId ?? null).catch(() => false);
    if (settled) return true;
    await delay(500);
  }
  return false;
}

function buildReport(fileName, selectedPreset, qa, screenshotPath, settled) {
  const pages = qa.plan.sourcePages.map((page) => {
    const diagnostics = qa.diagnostics.find((item) => item.pageNumber === page.sourcePageNumber);
    const fullColumnFallbackCount = page.outputPages.filter((output) => output.paginationMode === "single-column-safe").length;
    const fullColumnTooEmptyCount = page.outputPages.filter((output) => output.failureCategories.includes("full-column-too-empty")).length;
    const widthFitRequiredButNotUsedCount = page.outputPages.filter((output) =>
      output.failureCategories.includes("full-column-too-empty") &&
      output.paginationMode === "single-column-safe"
    ).length;

    return {
      fileName,
      selectedPreset,
      pageNumber: page.sourcePageNumber,
      strategy: page.strategy,
      layoutKind: page.summary.layoutKind ?? "unknown",
      rawDecision: diagnostics?.decision,
      rawConfidence: diagnostics?.confidence,
      rawReason: diagnostics?.reason,
      academicPageClass: page.summary.academicPageClass,
      pageClassReason: page.summary.pageClassReason,
      finalStrategy: page.strategy,
      rawSuggestedSplit: Boolean(page.summary.rawColumnDetectorSuggestedSplit),
      plannerUsedSplit: Boolean(page.summary.plannerAcceptedColumnSplit),
      plannerDiscardedSplit: Boolean(page.summary.rawColumnDetectorSuggestedSplit && !page.summary.plannerAcceptedColumnSplit),
      plannerDiscardReason: page.summary.plannerRejectedColumnSplitReason,
      mixedSplitReason: page.summary.mixedSplitReason,
      titleRepairConsidered: Boolean(page.summary.titleDetectionApplicable),
      titleRepairSkippedReason: page.summary.titleDetectionSkippedReason,
      bodyColumnExtractionAttempted: Boolean(page.summary.bodyColumnExtractionAttempted),
      bodyColumnExtractionSucceeded: Boolean(page.summary.bodyColumnExtractionSucceeded),
      outputProfileId: qa.plan.outputProfileId,
      selectedOutputProfileId: page.summary.selectedOutputProfileId,
      outputPageWidth: page.summary.outputPageWidth,
      outputPageHeight: page.summary.outputPageHeight,
      outputMargins: page.summary.outputMargins,
      targetReadableScale: page.summary.targetReadableScale,
      minReadableScale: page.summary.minReadableScale,
      maxSourceSliceHeightRatio: page.summary.maxSourceSliceHeightRatio,
      targetRowsPerSlice: page.summary.targetRowsPerSlice,
      maxRowsPerSlice: page.summary.maxRowsPerSlice,
      minRowsPerSlice: page.summary.minRowsPerSlice,
      preferShorterSlices: page.summary.preferShorterSlices,
      allowMoreOutputPages: page.summary.allowMoreOutputPages,
      profileAggressiveness: page.summary.profileAggressiveness,
      titleRegionBounds: page.regions.find((region) => region.kind === "full-width-title")?.sourceBounds,
      bodyRegionTop: page.summary.bodyRegionTop,
      bodyRegionTopEvidence: {
        titleRegionContainsColumnRows: page.summary.titleRegionContainsColumnRows,
        rowCoveragePassed: page.summary.rowCoveragePassed,
        transitionCandidates: page.summary.transitionCandidates ?? diagnostics?.transitionCandidates ?? [],
        bestTransitionCandidate: page.summary.bestTransitionCandidate ?? diagnostics?.bestTransitionCandidate,
        transitionConfidence: page.summary.transitionConfidence ?? diagnostics?.transitionConfidence,
        transitionRejectionReason: page.summary.transitionRejectionReason ?? diagnostics?.transitionRejectionReason
      },
      transitionCandidates: page.summary.transitionCandidates ?? diagnostics?.transitionCandidates ?? [],
      bestTransitionCandidate: page.summary.bestTransitionCandidate ?? diagnostics?.bestTransitionCandidate,
      transitionConfidence: page.summary.transitionConfidence ?? diagnostics?.transitionConfidence,
      transitionRejectionReason: page.summary.transitionRejectionReason ?? diagnostics?.transitionRejectionReason,
      titleRegionContainsColumnRows: Boolean(page.summary.titleRegionContainsColumnRows),
      titleAuthorRepairApplied: Boolean(page.summary.titleAuthorRepairApplied),
      outputPageCount: page.summary.outputPageCount,
      outputPageCountByRegion: page.summary.outputPageCountByRegion,
      shortPageCount: page.summary.shortPageCount ?? 0,
      badOrphanPageCount: page.summary.badOrphanPageCount ?? 0,
      naturalShortFinalCount: page.summary.naturalShortFinalCount ?? 0,
      orphanRepairCount: page.summary.orphanRepairCount ?? 0,
      averageRowsPerOutputPage: average(page.outputPages.map((output) => output.rowsOnPage).filter(isNumber)),
      averageSliceHeight: average(page.outputPages.map((output) => output.sourceCropHeight).filter(isNumber)),
      kindleTallSliceCount: page.summary.kindleTallSliceCount ?? 0,
      kindleReadablePageCount: page.summary.kindleReadablePageCount ?? 0,
      kindleUnreadablePageCount: page.summary.kindleUnreadablePageCount ?? 0,
      kindleOverFragmentationDetected: Boolean(page.summary.kindleOverFragmentationDetected),
      rowsPerSliceDistribution: page.summary.rowsPerSliceDistribution ?? [],
      medianRowsPerKindlePage: page.summary.medianRowsPerKindlePage,
      minRowsPerKindlePage: page.summary.minRowsPerKindlePage,
      tinySliceCount: page.summary.tinySliceCount ?? 0,
      singleSentenceSliceCount: page.summary.singleSentenceSliceCount ?? 0,
      kindlePageFillMedian: page.summary.kindlePageFillMedian,
      kindlePageFillMin: page.summary.kindlePageFillMin,
      kindleMedianVerticalFillRatio: page.summary.kindleMedianVerticalFillRatio,
      kindleMinVerticalFillRatio: page.summary.kindleMinVerticalFillRatio,
      kindleLowFillPageCount: page.summary.kindleLowFillPageCount ?? 0,
      kindleComfortBalanceApplied: Boolean(page.summary.kindleComfortBalanceApplied),
      kindleComfortBalancePassed: page.summary.kindleComfortBalancePassed !== false,
      kindleMicroZoomApplied: Boolean(page.summary.kindleMicroZoomApplied),
      kindleZoomPolishApplied: Boolean(page.summary.kindleZoomPolishApplied),
      oldKindleMargins: page.summary.oldKindleMargins,
      newKindleMargins: page.summary.newKindleMargins,
      oldTargetReadableScale: page.summary.oldTargetReadableScale,
      newTargetReadableScale: page.summary.newTargetReadableScale,
      availableWidthBefore: page.summary.availableWidthBefore,
      availableWidthAfter: page.summary.availableWidthAfter,
      estimatedTextScaleBefore: page.summary.estimatedTextScaleBefore,
      estimatedTextScaleAfter: page.summary.estimatedTextScaleAfter,
      expectedTextScaleGainPercent: page.summary.expectedTextScaleGainPercent,
      firstPagePreserveUserMessage: page.summary.firstPagePreserveUserMessage,
      firstPagePreserveIsExpectedBehavior: Boolean(page.summary.firstPagePreserveIsExpectedBehavior),
      bodyPagesOptimizedAfterFirstPage: Boolean(page.summary.bodyPagesOptimizedAfterFirstPage),
      verticalFillRatios: page.outputPages.map((output) => output.verticalFillRatio).filter(isNumber),
      lowFillPages: page.outputPages
        .filter((output) =>
          output.shortPageKind !== "natural-short-final" &&
          ((output.contentFillRatio ?? 1) < (page.summary.minFinalPageFillRatio ?? 0.24) || (output.verticalFillRatio ?? 1) < 0.42)
        )
        .map((output) => output.outputId),
      kindleCropBoundaryRiskCount: page.summary.kindleCropBoundaryRiskCount ?? 0,
      kindleOrphanRepairAttemptedCount: page.summary.kindleOrphanRepairAttemptedCount ?? 0,
      kindleOrphanRepairSucceededCount: page.summary.kindleOrphanRepairSucceededCount ?? 0,
      outputPageDiagnostics: page.outputPages.map((output) => ({
        outputId: output.outputId,
        regionKind: output.regionKind,
        paginationMode: output.paginationMode,
        rowsOnPage: output.rowsOnPage,
        sourceSliceHeight: output.sourceSliceHeight,
        effectiveSourceSliceHeight: output.effectiveSourceSliceHeight,
        sourceCropHeight: output.sourceCropHeight,
        targetRowsPerSlice: output.targetRowsPerSlice,
        maxRowsPerSlice: output.maxRowsPerSlice,
        profileLimitedSliceHeight: output.profileLimitedSliceHeight,
        sliceHeightLimitReason: output.sliceHeightLimitReason,
        estimatedTextScale: output.estimatedReadableScale,
        kindleReadable: output.kindleReadable,
        topBoundaryCutsRow: output.topBoundaryCutsRow,
        bottomBoundaryCutsRow: output.bottomBoundaryCutsRow,
        nearestTopRowDistance: output.nearestTopRowDistance,
        nearestBottomRowDistance: output.nearestBottomRowDistance,
        verticalGlyphPaddingApplied: output.verticalGlyphPaddingApplied,
        repairedBoundaryForKindle: output.repairedBoundaryForKindle,
        exportBoundaryValidationPassed: output.exportBoundaryValidationPassed,
        normalizedCropBounds: output.normalizedCropBounds,
        pdfLibCropBounds: output.pdfLibCropBounds,
        pdfLibCropValidationPassed: output.pdfLibCropValidationPassed,
        previewExportCropDelta: output.previewExportCropDelta,
        textClippingRisk: output.textClippingRisk,
        cropBoundaryValidationPassed: output.cropBoundaryValidationPassed,
        kindleOrphanRepairAttempted: output.kindleOrphanRepairAttempted,
        kindleOrphanRepairStatus: output.kindleOrphanRepairStatus,
        horizontalFillRatio: output.horizontalFillRatio,
        verticalFillRatio: output.verticalFillRatio,
        blankAreaRatio: output.blankAreaRatio
      })),
      pagesWithShortFinals: page.outputPages
        .filter((output) => output.shortPageDetected)
        .map((output) => ({
          outputId: output.outputId,
          shortPageKind: output.shortPageKind,
          rowsOnPage: output.rowsOnPage,
          contentFillRatio: output.contentFillRatio,
          orphanRepairStatus: output.orphanRepairStatus
        })),
      firstPagePolicy: page.summary.firstPagePolicy,
      firstPagePolicyReason: page.summary.firstPagePolicyReason,
      titleRowsCount: page.summary.titleRowsCount,
      authorRowsCount: page.summary.authorRowsCount,
      abstractRowsCount: page.summary.abstractRowsCount,
      bodyRowsBelowTitle: page.summary.bodyRowsBelowTitle,
      leftBodyRowsBelowTitle: page.summary.leftBodyRowsBelowTitle,
      rightBodyRowsBelowTitle: page.summary.rightBodyRowsBelowTitle,
      bodySymmetryRatio: page.summary.bodySymmetryRatio,
      bodyWorthExtracting: page.summary.bodyWorthExtracting,
      firstPageSplitConfidence: page.summary.firstPageSplitConfidence,
      firstPagePreservedForSafety: Boolean(page.summary.firstPagePreservedForSafety),
      shortAsymmetricBodyDetected: Boolean(page.summary.shortAsymmetricBodyDetected),
      titleStandaloneSuppressed: Boolean(page.summary.titleStandaloneSuppressed),
      continuousFlowEnabled: page.summary.continuousFlowEnabled === true,
      fullColumnFallbackCount,
      fallbackDiagnostics: page.outputPages
        .filter((output) => output.paginationMode === "single-column-safe" || output.paginationMode === "last-resort")
        .map((output) => ({
          outputId: output.outputId,
          regionKind: output.regionKind,
          paginationMode: output.paginationMode,
          fallbackTrigger: output.paginationMode === "single-column-safe" ? "single-column-page" : "last-resort",
          fallbackTriggerReason: output.paginationMode === "single-column-safe" ? "no-safe-width-fit-break-or-incomplete-break-diagnostics" : "explicit-last-resort-pagination",
          fullColumnScale: output.widthFitScale,
          widthFitScale: output.widthFitScale,
          contentFillRatio: output.contentFillRatio,
          blankAreaRatio: output.blankAreaRatio,
          horizontalFillRatio: output.horizontalFillRatio,
          verticalFillRatio: output.verticalFillRatio,
          fallbackAllowedByProfile: selectedPreset !== "kindle-ereader",
          fallbackAllowedByReason: output.paginationMode === "last-resort" ? "explicit-last-resort" : "none"
        })),
      fullColumnTooEmptyCount,
      widthFitRequiredButNotUsedCount,
      widthFitPaginationAttempted: page.outputPages.some((output) => output.paginationMode.startsWith("width-fit")),
      widthFitPaginationSucceeded: page.outputPages.some((output) => output.paginationMode === "width-fit-page"),
      duplicatedTextRowsCount: page.summary.duplicatedTextRowsCount ?? 0,
      missingTextRowsCount: page.summary.missingTextRowsCount ?? 0,
      unaccountedMissingRowsCount: page.summary.unaccountedMissingRowsCount ?? 0,
      ignoredRowsCount: page.summary.ignoredRowsCount ?? 0,
      ignoredRowsByReason: page.summary.ignoredRowsByReason ?? {},
      rowCoverageFailureReason: page.summary.rowCoverageFailureReason,
      nearDuplicateOutputPages: Boolean(page.summary.nearDuplicateOutputPages),
      unrepairedFailures: page.summary.unrepairedFailures,
      repairedFailures: page.summary.repairedFailures,
      lastResortFailures: page.outputPages.filter((output) => output.paginationMode === "last-resort").flatMap((output) => output.failureCategories),
      productQualityGrade: page.summary.productQualityGrade ?? "acceptable",
      productQualityScore: page.summary.productQualityScore ?? 75,
      productQualityIssues: page.summary.productQualityIssues ?? [],
      qualityGatePassed: page.summary.qualityGatePassed !== false,
      planValidationPassed: page.validation.ok,
      diagnostics
    };
  });
  const unrepairedFailures = Array.from(new Set(pages.flatMap((page) => page.unrepairedFailures)));
  const productQualityIssues = Array.from(new Set(pages.flatMap((page) => page.productQualityIssues)));
  const hookFailed = !settled || qa.summary.status !== "ready" || qa.summary.optimizedStatus !== "ready" || pages.length === 0;
  const technicalFailure = pages.some((page) =>
    page.titleRegionContainsColumnRows ||
    page.widthFitRequiredButNotUsedCount > 0 ||
    page.fullColumnTooEmptyCount > 0 ||
    page.duplicatedTextRowsCount > 0 ||
    page.unaccountedMissingRowsCount > 0 ||
    page.nearDuplicateOutputPages ||
    (page.planValidationPassed && (
      page.unaccountedMissingRowsCount > 0 ||
      page.duplicatedTextRowsCount > 0 ||
      page.nearDuplicateOutputPages ||
      page.widthFitRequiredButNotUsedCount > 0 ||
      page.fullColumnTooEmptyCount > 0 ||
      page.titleRegionContainsColumnRows
    )) ||
    (!page.planValidationPassed && page.unrepairedFailures.length > 0) ||
    (selectedPreset === "kindle-ereader" && page.outputProfileId !== "kindle-reading")
  ) || hookFailed;
  const productQualityFailure = pages.some((page) => !page.qualityGatePassed || page.productQualityGrade === "failed");
  const severeFailure = technicalFailure || productQualityFailure;

  return {
    fileName,
    selectedPreset,
    outputProfileId: qa.plan.outputProfileId,
    screenshotPath,
    appSummary: qa.summary,
    userReportGenerated: Boolean(qa.summary.userReportGenerated),
    devDiagnosticsHiddenForUser: Boolean(qa.summary.devDiagnosticsHiddenForUser) && !qa.ui.diagnosticsPanelVisible && !qa.ui.rawDiagnosticsVisible,
    fullDocumentExportAvailableInPro: Boolean(qa.summary.fullDocumentExportAvailableInPro),
    freeExportLimitApplied: Boolean(qa.summary.freeExportLimitApplied),
    freeExportLimitVisible: Boolean(qa.summary.freeExportLimitVisible),
    batchUploadAvailableInPro: Boolean(qa.summary.batchUploadAvailableInPro),
    batchZipGenerated: Boolean(qa.summary.batchZipGenerated),
    batchSummaryGenerated: Boolean(qa.summary.batchSummaryGenerated),
    failedBatchFileHandled: Boolean(qa.summary.failedBatchFileHandled),
    exportReadinessRendered: Boolean(qa.summary.exportReadinessRendered) && qa.ui.exportReadinessRendered,
    exportReadiness: qa.summary.exportReadiness,
    exportReadinessStatus: qa.summary.exportReadinessStatus,
    exportLimitVisible: Boolean(qa.summary.exportLimitVisible),
    optimizedBodyPagesCount: qa.summary.optimizedBodyPagesCount ?? 0,
    preservedPagesCount: qa.summary.preservedPagesCount ?? 0,
    reviewPagesCount: qa.summary.reviewPagesCount ?? 0,
    bestComparisonPageSelected: qa.summary.bestComparisonPageSelected,
    bestImprovementReason: qa.summary.bestComparisonReason,
    userOptimizationReportRendered: Boolean(qa.summary.userOptimizationReportRendered) && qa.ui.userOptimizationReportRendered,
    exportLimitApplied: Boolean(qa.summary.exportLimitApplied),
    exportScope: qa.summary.exportScope,
    sourcePagesIncluded: qa.summary.sourcePagesIncluded,
    totalSourcePages: qa.summary.totalSourcePages,
    batchFileCount: qa.summary.batchFileCount ?? 0,
    batchJobsCount: qa.summary.batchJobsCount ?? qa.summary.batchFileCount ?? 0,
    batchQueuedCount: qa.summary.batchQueuedCount ?? 0,
    batchProcessingCount: qa.summary.batchProcessingCount ?? 0,
    batchCompletedCount: qa.summary.batchCompletedCount ?? 0,
    batchFailedCount: qa.summary.batchFailedCount ?? 0,
    exportProgressRendered: Boolean(qa.summary.exportProgressRendered),
    noSilentPartialExport: Boolean(qa.summary.noSilentPartialExport),
    duplicatePrimaryCtaCount: qa.ui.duplicatePrimaryCtaCount,
    singlePdfExportCtaVisible: Boolean(qa.summary.singlePdfExportCtaVisible) && qa.ui.singlePdfExportCtaVisible,
    topBarExportCtaVisible: Boolean(qa.summary.topBarExportCtaVisible) || qa.ui.topBarExportCtaVisible,
    exportReadinessCtaVisible: Boolean(qa.summary.exportReadinessCtaVisible) && qa.ui.exportReadinessCtaVisible,
    planTierVisible: Boolean(qa.summary.planTierVisible) && qa.ui.planTierVisible,
    freeSourcePageLimit: qa.summary.freeSourcePageLimit,
    freeReadingPageLimit: qa.summary.freeReadingPageLimit,
    exportLimitHitBy: qa.summary.exportLimitHitBy,
    batchState: qa.summary.batchState || qa.ui.batchState,
    batchPrimaryActionLabel: qa.summary.batchPrimaryActionLabel || qa.ui.batchPrimaryActionLabel,
    zipDownloadAvailable: Boolean(qa.summary.zipDownloadAvailable) || qa.ui.zipDownloadAvailable,
    landingHeroRendered: Boolean(qa.summary.landingHeroRendered) && qa.ui.landingHeroRendered,
    heroValuePropositionClear: Boolean(qa.summary.heroValuePropositionClear) && qa.ui.heroValuePropositionClear,
    landingDemoRealistic: Boolean(qa.summary.landingDemoRealistic) && qa.ui.landingDemoRealistic,
    landingMockupPremiumQuality: Boolean(qa.summary.landingMockupPremiumQuality) && qa.ui.landingMockupPremiumQuality,
    heroUsesRealOptimizedAssetWhenAvailable: Boolean(qa.summary.heroUsesRealOptimizedAssetWhenAvailable) && qa.ui.heroUsesRealOptimizedAssetWhenAvailable,
    heroVisualPremiumComposition: qa.ui.heroVisualPremiumComposition,
    demoFramesCentered: Boolean(qa.summary.demoFramesCentered) && qa.ui.demoFramesCentered,
    kindlePreviewNotTiny: Boolean(qa.summary.kindlePreviewNotTiny) && qa.ui.kindlePreviewNotTiny,
    devicePreviewSystemUnified: Boolean(qa.summary.devicePreviewSystemUnified) && qa.ui.devicePreviewSystemUnified,
    realAssetCopyNotMarkedIllustration: Boolean(qa.summary.realAssetCopyNotMarkedIllustration) && qa.ui.realAssetCopyNotMarkedIllustration,
    fallbackCopyMarkedIllustration: Boolean(qa.summary.fallbackCopyMarkedIllustration) && qa.ui.fallbackCopyMarkedIllustration,
    demoImageSharpnessConstraintsPresent: Boolean(qa.summary.demoImageSharpnessConstraintsPresent) && qa.ui.demoImageSharpnessConstraintsPresent,
    noFallbackFlickerWhenRealAssetsExist: Boolean(qa.summary.noFallbackFlickerWhenRealAssetsExist) && qa.ui.noFallbackFlickerWhenRealAssetsExist,
    demoScreenshotOverflowContained: Boolean(qa.summary.demoScreenshotOverflowContained) && qa.ui.demoScreenshotOverflowContained,
    heroMockupExplainsValue: Boolean(qa.summary.heroMockupExplainsValue) && qa.ui.heroMockupExplainsValue,
    transformCuePremium: Boolean(qa.summary.transformCuePremium) && qa.ui.transformCuePremium,
    beforeAfterMockupConcrete: Boolean(qa.summary.beforeAfterMockupConcrete) && qa.ui.beforeAfterMockupConcrete,
    deviceMockupsDistinct: Boolean(qa.summary.deviceMockupsDistinct) && qa.ui.deviceMockupsDistinct,
    uploadAnchorVisible: Boolean(qa.summary.uploadAnchorVisible) && qa.ui.uploadAnchorVisible,
    beforeAfterSectionRendered: Boolean(qa.summary.beforeAfterSectionRendered) && qa.ui.beforeAfterSectionRendered,
    pricingSectionRendered: Boolean(qa.summary.pricingSectionRendered) && qa.ui.pricingSectionRendered,
    faqRendered: Boolean(qa.summary.faqRendered) && qa.ui.faqRendered,
    seoMetadataPresent: Boolean(qa.summary.seoMetadataPresent) && qa.ui.seoMetadataPresent,
    freeProGatingConsistent: Boolean(qa.summary.freeProGatingConsistent),
    freeProPlanAwareRendering: Boolean(qa.summary.freeProPlanAwareRendering),
    proUpgradeCtaHidden: Boolean(qa.summary.proUpgradeCtaHidden),
    freeUpgradeCtaVisible: Boolean(qa.summary.freeUpgradeCtaVisible),
    proOperationalDashboardVisible: Boolean(qa.summary.proOperationalDashboardVisible),
    batchQueuedHasNextAction: Boolean(qa.summary.batchQueuedHasNextAction),
    batchDuplicateCtaCount: Math.max(qa.summary.batchDuplicateCtaCount ?? 0, qa.ui.batchDuplicateCtaCount ?? 0),
    batchPerFileDashboardRendered: Boolean(qa.summary.batchPerFileDashboardRendered) && qa.ui.batchPerFileDashboardRendered,
    batchExpandableSummaryAvailable: Boolean(qa.summary.batchExpandableSummaryAvailable) && qa.ui.batchExpandableSummaryAvailable,
    zipIncludesHumanSummary: Boolean(qa.summary.zipIncludesHumanSummary),
    zipIncludesTechnicalJsonByDefault: Boolean(qa.summary.zipIncludesTechnicalJsonByDefault),
    userReportsNonTechnical: Boolean(qa.summary.userReportsNonTechnical) && qa.ui.userReportsNonTechnical,
    realDemoAssetSupportExists: Boolean(qa.summary.realDemoAssetSupportExists) && qa.ui.realDemoAssetSupportExists,
    realDemoAssetsDetected: Boolean(qa.summary.realDemoAssetsDetected) || qa.ui.realDemoAssetsDetected,
    demoAssetFallbackWorks: Boolean(qa.summary.demoAssetFallbackWorks) && qa.ui.demoAssetFallbackWorks,
    demoAssetDocsExist: Boolean(qa.summary.demoAssetDocsExist),
    demoRenderScriptExistsOrDocumented: Boolean(qa.summary.demoRenderScriptExistsOrDocumented),
    selectedDemoTargetDocumented: Boolean(qa.summary.selectedDemoTargetDocumented),
    landingDemoUsesBodyPageFraming: Boolean(qa.summary.landingDemoUsesBodyPageFraming) && qa.ui.landingDemoUsesBodyPageFraming,
    landingDemoDoesNotOverpromiseTitleReflow: Boolean(qa.summary.landingDemoDoesNotOverpromiseTitleReflow) && qa.ui.landingDemoDoesNotOverpromiseTitleReflow,
    landingAndLivePreviewSeparated: Boolean(qa.summary.landingAndLivePreviewSeparated) && qa.ui.landingAndLivePreviewSeparated,
    livePreviewPersonalizedAfterUpload: Boolean(qa.summary.livePreviewPersonalizedAfterUpload) && qa.ui.livePreviewPersonalizedAfterUpload,
    demoFallbackMarkedAsIllustration: Boolean(qa.summary.demoFallbackMarkedAsIllustration) && qa.ui.demoFallbackMarkedAsIllustration,
    heroVisualNotOverloaded: Boolean(qa.summary.heroVisualNotOverloaded) && qa.ui.heroVisualNotOverloaded,
    deviceDemoTabsGracefullyFallback: Boolean(qa.summary.deviceDemoTabsGracefullyFallback) && qa.ui.deviceDemoTabsGracefullyFallback,
    preservedPagesExplained: Boolean(qa.summary.preservedPagesExplained),
    noRawDiagnosticsVisible: Boolean(qa.summary.noRawDiagnosticsVisible) && !qa.ui.rawDiagnosticsVisible,
    batchDashboardUsable: Boolean(qa.summary.batchDashboardUsable),
    exportReadinessClear: Boolean(qa.summary.exportReadinessClear),
    productUxReadinessScore: qa.summary.productUxReadinessScore,
    planTier: qa.summary.planTier,
    freeExportLimit: qa.summary.freeExportLimit,
    presetCopyRendered: Boolean(qa.summary.presetCopyRendered),
    proHooksRendered: Boolean(qa.summary.proHooksRendered) && qa.ui.proHooksRendered,
    localFirstTrustCopyRendered: Boolean(qa.summary.localFirstTrustCopyRendered) && qa.ui.localFirstTrustCopyRendered,
    upgradeCTAVisible: Boolean(qa.summary.upgradeCTAVisible),
    browserPipelineSettled: settled,
    pagesAnalyzed: pages.length,
    totalSourcePages: qa.summary.sourcePageCount ?? pages.length,
    analysisLimitApplied: (qa.summary.sourcePageCount ?? pages.length) > pages.length,
    planValidationPassed: pages.every((page) => page.planValidationPassed),
    qualityGatePassed: pages.every((page) => page.qualityGatePassed),
    unrepairedFailures,
    productQualityIssues,
    shortPageCount: pages.reduce((sum, page) => sum + page.shortPageCount, 0),
    badOrphanPageCount: pages.reduce((sum, page) => sum + page.badOrphanPageCount, 0),
    naturalShortFinalCount: pages.reduce((sum, page) => sum + page.naturalShortFinalCount, 0),
    orphanRepairCount: pages.reduce((sum, page) => sum + page.orphanRepairCount, 0),
    bodyPaginationRegressionCount: pages.filter((page) =>
      page.academicPageClass === "body-two-column" &&
      page.fullColumnFallbackCount > 0
    ).length,
    firstPagePreservedShortBodyCount: pages.filter((page) => page.firstPagePolicy === "title-plus-short-body-preserve").length,
    firstPageHardFailureCount: pages.filter((page) =>
      page.pageNumber === 1 &&
      (page.titleRegionContainsColumnRows || page.productQualityIssues.includes("title-body-transition-failed"))
    ).length,
    firstPageWarningCount: pages.filter((page) =>
      page.pageNumber === 1 &&
      page.productQualityIssues.some((issue) =>
        issue === "first-page-preserved-short-body" ||
        issue === "first-page-preserved-title-abstract" ||
        issue === "first-page-preserved-cover" ||
        issue === "first-page-transition-uncertain"
      )
    ).length,
    firstPageSevereFailureCount: pages.filter((page) =>
      page.pageNumber === 1 && page.severeFailure &&
      !page.productQualityIssues.includes("first-page-preserved-short-body") &&
      !page.productQualityIssues.includes("first-page-preserved-title-abstract") &&
      !page.productQualityIssues.includes("first-page-preserved-cover")
    ).length,
    kindleTallSliceCount: pages.reduce((sum, page) => sum + page.kindleTallSliceCount, 0),
    kindleOverfragmentedPageCount: pages.filter((page) => page.kindleOverFragmentationDetected).length,
    kindleTinySliceCount: pages.reduce((sum, page) => sum + page.tinySliceCount, 0),
    kindleCropBoundaryRiskCount: pages.reduce((sum, page) => sum + page.kindleCropBoundaryRiskCount, 0),
    kindleLowFillPageCount: pages.reduce((sum, page) => sum + page.kindleLowFillPageCount, 0),
    kindleSingleSentencePageCount: pages.reduce((sum, page) => sum + page.singleSentenceSliceCount, 0),
    kindleUnreadablePageCount: pages.reduce((sum, page) => sum + page.kindleUnreadablePageCount, 0),
    repairedFailures: Array.from(new Set(pages.flatMap((page) => page.repairedFailures))),
    technicalFailure,
    productQualityFailure,
    severeFailure,
    pages: pages.map((page) => ({
      ...page,
      technicalFailure: page.titleRegionContainsColumnRows ||
        page.widthFitRequiredButNotUsedCount > 0 ||
        page.fullColumnTooEmptyCount > 0 ||
        page.duplicatedTextRowsCount > 0 ||
        page.unaccountedMissingRowsCount > 0 ||
        page.nearDuplicateOutputPages ||
        (page.planValidationPassed && (
          page.unaccountedMissingRowsCount > 0 ||
          page.duplicatedTextRowsCount > 0 ||
          page.nearDuplicateOutputPages ||
          page.widthFitRequiredButNotUsedCount > 0 ||
          page.fullColumnTooEmptyCount > 0 ||
          page.titleRegionContainsColumnRows
        )) ||
        (!page.planValidationPassed && page.unrepairedFailures.length > 0),
      productQualityFailure: !page.qualityGatePassed || page.productQualityGrade === "failed",
      severeFailure: page.titleRegionContainsColumnRows ||
        page.widthFitRequiredButNotUsedCount > 0 ||
        page.fullColumnTooEmptyCount > 0 ||
        page.duplicatedTextRowsCount > 0 ||
        page.unaccountedMissingRowsCount > 0 ||
        page.nearDuplicateOutputPages ||
        (!page.qualityGatePassed || page.productQualityGrade === "failed") ||
        (page.planValidationPassed && (
          page.unaccountedMissingRowsCount > 0 ||
          page.duplicatedTextRowsCount > 0 ||
          page.nearDuplicateOutputPages ||
          page.widthFitRequiredButNotUsedCount > 0 ||
          page.fullColumnTooEmptyCount > 0 ||
          page.titleRegionContainsColumnRows
        )) ||
        (!page.planValidationPassed && page.unrepairedFailures.length > 0)
    }))
  };
}

function applyModeComparisons(reports) {
  const byFile = new Map();
  for (const report of reports) {
    const fileReports = byFile.get(report.fileName) ?? {};
    fileReports[report.selectedPreset] = report;
    byFile.set(report.fileName, fileReports);
  }

  for (const fileReports of byFile.values()) {
    const academic = fileReports["academic-paper"];
    const kindle = fileReports["kindle-ereader"];
    if (!academic || !kindle) continue;

    for (const kindlePage of kindle.pages) {
      const academicPage = academic.pages.find((page) => page.pageNumber === kindlePage.pageNumber);
      if (!academicPage) continue;

      const outputPageCountDeltaVsAcademic = kindlePage.outputPageCount - academicPage.outputPageCount;
      const rowsDelta = (kindlePage.averageRowsPerOutputPage ?? 0) - (academicPage.averageRowsPerOutputPage ?? 0);
      const sliceDelta = (kindlePage.averageSliceHeight ?? 0) - (academicPage.averageSliceHeight ?? 0);
      const similarCounts = Math.abs(outputPageCountDeltaVsAcademic) === 0;
      const similarRows = Math.abs(rowsDelta) <= 1.5;
      const similarSlices = Math.abs(sliceDelta) <= 0.015;
      const profileSimilarityToAcademic = similarCounts && similarRows && similarSlices ? 1 : similarCounts ? 0.7 : 0.25;
      const kindleMoreAggressiveThanAcademic =
        outputPageCountDeltaVsAcademic > 0 ||
        ((kindlePage.averageRowsPerOutputPage ?? Infinity) < (academicPage.averageRowsPerOutputPage ?? 0) &&
          (kindlePage.averageSliceHeight ?? Infinity) < (academicPage.averageSliceHeight ?? 0));
      const bodyPage = kindlePage.academicPageClass === "body-two-column" || kindlePage.strategy === "two-column-width-fit";
      const tooSimilar = bodyPage && profileSimilarityToAcademic >= 0.7 && !kindleMoreAggressiveThanAcademic;

      Object.assign(kindlePage, {
        outputPageCountDeltaVsAcademic,
        kindleToAcademicPageRatio: kindlePage.outputPageCount / Math.max(academicPage.outputPageCount, 1),
        averageRowsPerPageAcademic: academicPage.averageRowsPerOutputPage,
        averageRowsPerPageKindle: kindlePage.averageRowsPerOutputPage,
        averageSliceHeightAcademic: academicPage.averageSliceHeight,
        averageSliceHeightKindle: kindlePage.averageSliceHeight,
        kindleMoreAggressiveThanAcademic,
        profileSimilarityToAcademic
      });

      if (tooSimilar && !kindlePage.productQualityIssues.includes("profile-output-too-similar")) {
        kindlePage.productQualityIssues.push("profile-output-too-similar");
        kindlePage.qualityGatePassed = false;
        kindlePage.productQualityFailure = true;
        kindlePage.severeFailure = true;
      }
    }

    refreshReportFailureFlags(kindle);
  }
}

function refreshReportFailureFlags(report) {
  report.productQualityIssues = Array.from(new Set(report.pages.flatMap((page) => page.productQualityIssues)));
  report.qualityGatePassed = report.pages.every((page) => page.qualityGatePassed);
  report.productQualityFailure = report.pages.some((page) => !page.qualityGatePassed || page.productQualityGrade === "failed");
  report.severeFailure = report.technicalFailure || report.productQualityFailure;
}

function getFilesWhereKindleMatchesAcademic(reports) {
  return reports
    .filter((report) => report.selectedPreset === "kindle-ereader")
    .filter((report) => report.pages.some((page) =>
      (page.academicPageClass === "body-two-column" || page.strategy === "two-column-width-fit") &&
      (page.profileSimilarityToAcademic ?? 0) >= 0.7
    ))
    .map((report) => report.fileName);
}

function getFirstPagePolicyCounts(reports) {
  return reports.reduce((counts, report) => {
    for (const page of report.pages) {
      if (page.pageNumber !== 1 || !page.firstPagePolicy) continue;
      counts[page.firstPagePolicy] = (counts[page.firstPagePolicy] ?? 0) + 1;
    }
    return counts;
  }, {});
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const nums = values.filter(isNumber).sort((a, b) => a - b);
  if (nums.length === 0) return undefined;
  return nums[Math.floor(nums.length / 2)];
}

function min(values) {
  const nums = values.filter(isNumber);
  if (nums.length === 0) return undefined;
  return Math.min(...nums);
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function safeName(name) {
  return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
