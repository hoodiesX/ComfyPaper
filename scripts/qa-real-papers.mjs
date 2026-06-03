import { spawn } from "node:child_process";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const pdfDir = path.join(root, "qa", "pdfs-local");
const reportDir = path.join(root, "qa", "real-paper-reports");
const port = Number(process.env.QA_REAL_PAPERS_PORT ?? 3225);
const baseUrl = `http://127.0.0.1:${port}`;
const waitMs = Number(process.env.QA_REAL_PAPERS_WAIT_MS ?? 90_000);
const rawArgs = process.argv.slice(2);
const presetCatalog = new Map([
  ["academic-paper", { id: "academic-paper", label: "Academic Paper" }],
  ["kindle-ereader", { id: "kindle-ereader", label: "Kindle / E-reader" }],
  ["ipad-tablet", { id: "ipad-tablet", label: "iPad / Tablet" }]
]);
const options = parseOptions(rawArgs);
const presets = getSelectedPresets(options.preset);

async function main() {
  await mkdir(pdfDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const pdfs = await getLocalPdfs();
  if (pdfs.length === 0) {
    await writeEmptyReports();
    console.log("No local benchmark PDFs found. Add PDFs to qa/pdfs-local/ and rerun npm run qa:real-papers.");
    return;
  }

  const { chromium } = await loadPlaywright();
  const server = await startNextServer();
  let browser;
  const fileReports = [];

  try {
    browser = await chromium.launch({ headless: true });
    for (const pdf of pdfs) {
      const fileReport = await runFileBenchmark(browser, pdf);
      fileReports.push(fileReport);
      await writeFileReport(fileReport);
      await writeManualReviewChecklists(fileReport);
    }
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }

  const summary = buildSummary(fileReports);
  await writeFile(path.join(reportDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(path.join(reportDir, "summary.md"), buildSummaryMarkdown(summary), "utf8");

  console.table(fileReports.flatMap((report) => report.presets.map((preset) => ({
    file: report.fileName,
    preset: preset.presetId,
    pages: `${preset.pagesAnalyzed}/${preset.pageCount}`,
    classification: preset.classification,
    severe: preset.severeIssues.length,
    warnings: preset.qualityWarnings.length
  }))));
  console.log(`Real paper benchmark reports written to ${path.relative(root, reportDir)}`);
}

function parseOptions(args) {
  const preset = getArgValue(args, "--preset") ?? getArgValue(args, "--presets") ?? "all";
  const pages = getArgValue(args, "--pages");
  const maxPagesArg = getArgValue(args, "--max-pages");
  const sample = getArgValue(args, "--sample") ?? "distributed";
  const maxPages = pages === "all" ? Number.POSITIVE_INFINITY : Number(maxPagesArg ?? 10);

  if (!["academic-paper", "kindle-ereader", "ipad-tablet", "all"].includes(preset)) {
    throw new Error("Invalid --preset value. Use academic-paper, kindle-ereader, ipad-tablet, or all.");
  }
  if (pages !== undefined && pages !== "all") {
    throw new Error("Invalid --pages value. The only supported explicit value is --pages=all.");
  }
  if (!Number.isFinite(maxPages) && pages !== "all") {
    throw new Error("Invalid --max-pages value. Use a positive number or --pages=all.");
  }
  if (Number.isFinite(maxPages) && maxPages < 1) {
    throw new Error("Invalid --max-pages value. Use a positive number.");
  }
  if (!["first", "distributed"].includes(sample)) {
    throw new Error("Invalid --sample value. Use first or distributed.");
  }

  return {
    preset,
    pagesMode: pages === "all" ? "all" : "sample",
    maxPages: pages === "all" ? Number.POSITIVE_INFINITY : Math.floor(maxPages),
    sample
  };
}

function getArgValue(args, name) {
  const exactIndex = args.indexOf(name);
  if (exactIndex >= 0) return args[exactIndex + 1];
  return args.find((arg) => arg.startsWith(`${name}=`))?.split("=")[1];
}

function getSelectedPresets(presetOption) {
  if (presetOption === "all") {
    return Array.from(presetCatalog.values());
  }
  return [presetCatalog.get(presetOption)];
}

async function getLocalPdfs() {
  const entries = await readdir(pdfDir, { withFileTypes: true });
  const pdfs = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => ({
      name: entry.name,
      path: path.join(pdfDir, entry.name)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return Promise.all(pdfs.map(async (pdf) => ({
    ...pdf,
    sizeBytes: (await stat(pdf.path)).size
  })));
}

async function runFileBenchmark(browser, pdf) {
  const presetReports = [];

  for (const preset of presets) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
    try {
      presetReports.push(await runPresetBenchmark(page, pdf, preset));
    } catch (error) {
      presetReports.push(buildFailedPresetReport(pdf, preset, error));
    } finally {
      await page.close();
    }
  }

  const primary = presetReports.find((report) => report.presetId === "academic-paper") ?? presetReports[0];
  const warnings = unique(presetReports.flatMap((report) => report.qualityWarnings));
  const severeIssues = unique(presetReports.flatMap((report) => report.severeIssues));

  return {
    generatedAt: new Date().toISOString(),
    fileName: pdf.name,
    fileSizeBytes: pdf.sizeBytes,
    pageCount: Math.max(...presetReports.map((report) => report.pageCount), 0),
    pagesAnalyzed: primary?.pagesAnalyzed ?? 0,
    pagesSplit: primary?.pagesSplit ?? 0,
    pagesPreserved: primary?.pagesPreserved ?? 0,
    pagesMarkedRisky: primary?.pagesMarkedRisky ?? 0,
    possibleClippingRisks: primary?.possibleClippingRisks ?? 0,
    possibleFullWidthContentRisks: primary?.possibleFullWidthContentRisks ?? 0,
    possibleFigureTableFormulaRisks: primary?.possibleFigureTableFormulaRisks ?? 0,
    outputReadingPagesCount: primary?.outputReadingPagesCount ?? 0,
    exportReadiness: primary?.exportReadiness ?? "unknown",
    qualityWarnings: warnings,
    severeIssues,
    classification: classifyFileReport(presetReports),
    manualReviewChecklist: createManualReviewChecklist(),
    presets: presetReports
  };
}

async function runPresetBenchmark(page, pdf, preset) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__PDF_READING_QA__), undefined, { timeout: 15_000 });
  await page.setInputFiles('input[type="file"]', pdf.path);
  await waitForSourceReady(page);

  const totalPages = await page.evaluate(() => window.__PDF_READING_QA__.getLatestSummary().sourcePageCount);
  const pageNumbers = selectPageNumbers(Number(totalPages ?? 0), options);
  const qa = await page.evaluate(async ({ presetId, pages }) => {
    const hook = window.__PDF_READING_QA__;
    return hook.runBenchmark({ presetId, pageNumbers: pages });
  }, { presetId: preset.id, pages: pageNumbers });

  return summarizePresetReport(pdf, preset, qa, pageNumbers);
}

function selectPageNumbers(totalPages, benchmarkOptions) {
  if (!Number.isFinite(totalPages) || totalPages < 1) return [];
  if (benchmarkOptions.pagesMode === "all") {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const limit = Math.min(totalPages, benchmarkOptions.maxPages);
  if (benchmarkOptions.sample === "first") {
    return Array.from({ length: limit }, (_, index) => index + 1);
  }

  if (limit === 1) return [1];
  const selected = new Set([1, totalPages]);
  const step = (totalPages - 1) / (limit - 1);
  for (let index = 0; index < limit; index += 1) {
    selected.add(Math.max(1, Math.min(totalPages, Math.round(1 + step * index))));
  }

  for (let pageNumber = 1; selected.size < limit && pageNumber <= totalPages; pageNumber += 1) {
    selected.add(pageNumber);
  }

  return Array.from(selected).sort((a, b) => a - b);
}

function summarizePresetReport(pdf, preset, qa, pageNumbers) {
  const sourcePages = Array.isArray(qa.plan?.sourcePages) ? qa.plan.sourcePages : [];
  const pageReports = sourcePages.map((sourcePage) => summarizeSourcePage(sourcePage, preset.id));
  const pageCount = Number(qa.summary?.sourcePageCount ?? sourcePages.length);
  const failedPageNumbers = Array.isArray(qa.summary?.failedPageNumbers) ? qa.summary.failedPageNumbers : [];
  const hookFailed = qa.summary?.status !== "ready" || qa.summary?.optimizedStatus !== "ready" || sourcePages.length === 0;
  const qualityWarnings = unique([
    ...pageReports.flatMap((page) => page.qualityWarnings),
    ...(failedPageNumbers.length > 0 ? [`Rendering failed for pages: ${failedPageNumbers.join(", ")}.`] : []),
    ...(hookFailed ? ["Processing did not complete cleanly for this preset."] : [])
  ]);
  const severeIssues = unique([
    ...pageReports.flatMap((page) => page.severeIssues),
    ...(failedPageNumbers.length > 0 ? ["One or more selected pages failed to render."] : []),
    ...(hookFailed ? ["Preset benchmark failed or timed out."] : [])
  ]);
  const riskScore = pageReports.reduce((sum, pageReport) => sum + pageReport.riskScore, 0) + severeIssues.length * 8 + qualityWarnings.length;

  return {
    presetId: preset.id,
    presetLabel: preset.label,
    fileName: pdf.name,
    pageCount,
    requestedPages: pageNumbers,
    pagesAnalyzed: sourcePages.length,
    analysisCoverage: pageCount > 0 ? Number((sourcePages.length / pageCount).toFixed(3)) : 0,
    pagesSplit: pageReports.filter((pageReport) => pageReport.split).length,
    pagesPreserved: pageReports.filter((pageReport) => pageReport.preserved).length,
    pagesMarkedRisky: pageReports.filter((pageReport) => pageReport.risky).length,
    possibleClippingRisks: pageReports.reduce((sum, pageReport) => sum + pageReport.possibleClippingRisks, 0),
    possibleFullWidthContentRisks: pageReports.reduce((sum, pageReport) => sum + pageReport.possibleFullWidthContentRisks, 0),
    possibleFigureTableFormulaRisks: pageReports.reduce((sum, pageReport) => sum + pageReport.possibleFigureTableFormulaRisks, 0),
    orphanOutputPages: pageReports.reduce((sum, pageReport) => sum + pageReport.orphanOutputPages, 0),
    singleSentenceOutputPages: pageReports.reduce((sum, pageReport) => sum + pageReport.singleSentenceOutputPages, 0),
    lowFillExcessivePages: pageReports.reduce((sum, pageReport) => sum + pageReport.lowFillExcessivePages, 0),
    unreadableKindleOutputPages: pageReports.reduce((sum, pageReport) => sum + pageReport.unreadableKindleOutputPages, 0),
    outputReadingPagesCount: pageReports.reduce((sum, pageReport) => sum + pageReport.outputReadingPagesCount, 0),
    exportReadiness: qa.summary?.exportReadiness ?? "benchmark-only",
    exportScope: qa.summary?.exportScope ?? "benchmark-only",
    qualityWarnings,
    severeIssues,
    riskScore,
    classification: classifyPreset({ hookFailed, pageReports, severeIssues }),
    appSummary: {
      status: qa.summary?.status,
      optimizedStatus: qa.summary?.optimizedStatus,
      outputProfileId: qa.plan?.outputProfileId,
      selectedPreset: qa.plan?.selectedPreset,
      sourcePageCount: qa.summary?.sourcePageCount,
      outputReadingPages: qa.summary?.outputReadingPages,
      failedPageNumbers
    },
    pages: pageReports
  };
}

function summarizeSourcePage(sourcePage, presetId) {
  const outputPages = Array.isArray(sourcePage.outputPages) ? sourcePage.outputPages : [];
  const summary = sourcePage.summary ?? {};
  const split = Boolean(summary.plannerAcceptedColumnSplit) || outputPages.some((output) =>
    output.regionKind === "left-column" ||
    output.regionKind === "right-column" ||
    output.paginationMode === "width-fit-page" ||
    output.paginationMode === "width-fit-final-page"
  );
  const preserved = !split || sourcePage.strategy === "preserve" || outputPages.some((output) =>
    output.regionKind === "unsafe" ||
    output.paginationMode === "single-column-safe" ||
    output.paginationMode === "last-resort"
  );
  const clippingRisks = outputPages.filter((output) =>
    output.textClippingRisk ||
    output.topBoundaryCutsRow ||
    output.bottomBoundaryCutsRow ||
    output.cropBoundaryValidationPassed === false ||
    output.exportBoundaryValidationPassed === false ||
    output.pdfLibCropValidationPassed === false
  ).length;
  const fullWidthRisks = Number(Boolean(summary.titleRegionContainsColumnRows)) +
    outputPages.filter((output) =>
      output.regionKind === "full-width-title" ||
      output.failureCategories?.some((category) => /full-width|title|column-too-empty/i.test(category))
    ).length;
  const figureTableFormulaRisks = [
    summary.academicPageClass,
    summary.pageClassReason,
    ...(summary.productQualityIssues ?? []),
    ...(summary.failureCategories ?? []),
    ...outputPages.flatMap((output) => output.failureCategories ?? [])
  ].filter((value) => /figure|table|formula|equation|complex|unsafe/i.test(String(value))).length;
  const orphanOutputPages = outputPages.filter((output) =>
    output.outputPageFillQuality === "orphan" ||
    /orphan/i.test(String(output.shortPageKind ?? "")) ||
    output.failureCategories?.some((category) => /orphan/i.test(category))
  ).length;
  const singleSentenceOutputPages = Number(summary.singleSentenceSliceCount ?? 0) +
    outputPages.filter((output) => output.rowsOnPage !== undefined && output.rowsOnPage <= 1).length;
  const lowFillExcessivePages = Number(summary.kindleLowFillPageCount ?? 0) +
    outputPages.filter((output) =>
      output.shortPageKind !== "natural-short-final" &&
      ((output.contentFillRatio ?? 1) < 0.24 || (output.verticalFillRatio ?? 1) < 0.42)
    ).length;
  const unreadableKindleOutputPages = presetId === "kindle-ereader"
    ? Number(summary.kindleUnreadablePageCount ?? 0) + outputPages.filter((output) => output.kindleReadable === false).length
    : 0;
  const failureCategories = unique([
    ...(summary.unrepairedFailures ?? []),
    ...(summary.failureCategories ?? []),
    ...outputPages.flatMap((output) => output.failureCategories ?? [])
  ]);
  const productIssues = summary.productQualityIssues ?? [];
  const severeIssues = unique([
    ...(clippingRisks > 0 ? ["Possible clipping risk."] : []),
    ...(fullWidthRisks > 0 ? ["Possible broken/full-width split risk."] : []),
    ...(figureTableFormulaRisks > 0 ? ["Possible figure, table, formula or complex-layout risk."] : []),
    ...(orphanOutputPages > 0 ? ["Orphan output page risk."] : []),
    ...(singleSentenceOutputPages > 0 ? ["Single-sentence output page risk."] : []),
    ...(lowFillExcessivePages > 0 ? ["Excessive low-fill output page risk."] : []),
    ...(unreadableKindleOutputPages > 0 ? ["Unreadable Kindle output risk."] : []),
    ...failureCategories.filter((category) =>
      /clipping|duplicate|missing|near-duplicate|last-resort|validation|unaccounted|unsafe|orphan|unreadable|too-tall|too-empty/i.test(category)
    ),
    ...(summary.qualityGatePassed === false ? productIssues : [])
  ]);
  const qualityWarnings = unique([
    ...productIssues,
    ...failureCategories,
    ...(preserved ? ["Page was preserved or handled conservatively."] : [])
  ]);
  const risky = severeIssues.length > 0 ||
    summary.qualityGatePassed === false ||
    summary.productQualityGrade === "failed";
  const riskScore = clippingRisks * 8 +
    fullWidthRisks * 7 +
    figureTableFormulaRisks * 6 +
    orphanOutputPages * 6 +
    singleSentenceOutputPages * 4 +
    lowFillExcessivePages * 4 +
    unreadableKindleOutputPages * 8 +
    severeIssues.length * 5 +
    qualityWarnings.length;

  return {
    pageNumber: sourcePage.sourcePageNumber,
    strategy: sourcePage.strategy,
    layoutKind: summary.layoutKind ?? "unknown",
    academicPageClass: summary.academicPageClass ?? "unknown",
    split,
    preserved,
    risky,
    riskScore,
    outputReadingPagesCount: Number(summary.outputPageCount ?? outputPages.length),
    possibleClippingRisks: clippingRisks,
    possibleFullWidthContentRisks: fullWidthRisks,
    possibleFigureTableFormulaRisks: figureTableFormulaRisks,
    orphanOutputPages,
    singleSentenceOutputPages,
    lowFillExcessivePages,
    unreadableKindleOutputPages,
    qualityWarnings,
    severeIssues
  };
}

function buildFailedPresetReport(pdf, preset, error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    presetId: preset.id,
    presetLabel: preset.label,
    fileName: pdf.name,
    pageCount: 0,
    requestedPages: [],
    pagesAnalyzed: 0,
    analysisCoverage: 0,
    pagesSplit: 0,
    pagesPreserved: 0,
    pagesMarkedRisky: 0,
    possibleClippingRisks: 0,
    possibleFullWidthContentRisks: 0,
    possibleFigureTableFormulaRisks: 0,
    orphanOutputPages: 0,
    singleSentenceOutputPages: 0,
    lowFillExcessivePages: 0,
    unreadableKindleOutputPages: 0,
    outputReadingPagesCount: 0,
    exportReadiness: "failed",
    exportScope: "benchmark-only",
    qualityWarnings: ["This preset could not be benchmarked."],
    severeIssues: [message],
    riskScore: 100,
    classification: "failed",
    appSummary: {},
    pages: []
  };
}

function classifyPreset({ hookFailed, pageReports, severeIssues }) {
  if (hookFailed || severeIssues.length > 0 || pageReports.some((pageReport) => pageReport.severeIssues.length > 0)) {
    return "failed";
  }
  if (pageReports.length === 0) return "failed";
  if (pageReports.some((pageReport) => pageReport.qualityWarnings.length > 0 || pageReport.preserved)) return "needs-review";
  return "acceptable";
}

function classifyFileReport(presetReports) {
  if (presetReports.some((report) => report.classification === "failed")) return "failed";
  if (presetReports.some((report) => report.classification === "needs-review")) return "needs-review";
  return "acceptable";
}

function createManualReviewChecklist() {
  return {
    letterClipping: { yes: false, no: false },
    brokenFormula: { yes: false, no: false },
    brokenFigureTable: { yes: false, no: false },
    badFullWidthSplit: { yes: false, no: false },
    excessiveBlankShortPages: { yes: false, no: false },
    acceptableOutput: { yes: false, no: false },
    notes: ""
  };
}

async function writeFileReport(report) {
  await writeFile(
    path.join(reportDir, `${safeReportName(report.fileName)}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
}

async function writeManualReviewChecklists(report) {
  await writeFile(
    path.join(reportDir, `${safeReportName(report.fileName)}-review.md`),
    buildManualReviewMarkdown(report),
    "utf8"
  );

  for (const preset of report.presets) {
    await writeFile(
      path.join(reportDir, `${safeReportName(report.fileName)}-${preset.presetId}-review.md`),
      buildPresetManualReviewMarkdown(report, preset),
      "utf8"
    );
  }
}

function buildSummary(fileReports) {
  const presetSummaries = Object.fromEntries(Array.from(presetCatalog.values()).map((preset) => {
    const reports = fileReports.flatMap((report) => report.presets).filter((report) => report.presetId === preset.id);
    return [preset.id, {
      presetId: preset.id,
      presetLabel: preset.label,
      total: reports.length,
      acceptable: reports.filter((report) => report.classification === "acceptable").length,
      needsReview: reports.filter((report) => report.classification === "needs-review").length,
      failed: reports.filter((report) => report.classification === "failed").length,
      pagesAnalyzed: reports.reduce((sum, report) => sum + report.pagesAnalyzed, 0),
      pagesSplit: reports.reduce((sum, report) => sum + report.pagesSplit, 0),
      pagesPreserved: reports.reduce((sum, report) => sum + report.pagesPreserved, 0),
      outputReadingPages: reports.reduce((sum, report) => sum + report.outputReadingPagesCount, 0)
    }];
  }));
  const worstOffenders = getWorstOffenders(fileReports);

  return {
    generatedAt: new Date().toISOString(),
    pdfInputFolder: "qa/pdfs-local/",
    reportFolder: "qa/real-paper-reports/",
    options,
    presets: presets.map((preset) => preset.id),
    totalFiles: fileReports.length,
    acceptable: fileReports.filter((report) => report.classification === "acceptable").length,
    needsReview: fileReports.filter((report) => report.classification === "needs-review").length,
    failed: fileReports.filter((report) => report.classification === "failed").length,
    presetSummaries,
    recommendedProductAction: getRecommendedProductAction(presetSummaries),
    worstOffenders,
    files: fileReports.map((report) => ({
      fileName: report.fileName,
      classification: report.classification,
      pageCount: report.pageCount,
      presets: report.presets.map((preset) => ({
        presetId: preset.presetId,
        classification: preset.classification,
        pagesAnalyzed: preset.pagesAnalyzed,
        pagesSplit: preset.pagesSplit,
        pagesPreserved: preset.pagesPreserved,
        pagesMarkedRisky: preset.pagesMarkedRisky,
        outputReadingPagesCount: preset.outputReadingPagesCount,
        riskScore: preset.riskScore,
        reviewChecklistPath: `${safeReportName(report.fileName)}-${preset.presetId}-review.md`
      })),
      reportPath: `${safeReportName(report.fileName)}.json`,
      reviewChecklistPath: `${safeReportName(report.fileName)}-review.md`
    }))
  };
}

function getWorstOffenders(fileReports) {
  return fileReports
    .flatMap((fileReport) => fileReport.presets.flatMap((preset) =>
      preset.pages.map((pageReport) => ({
        fileName: fileReport.fileName,
        presetId: preset.presetId,
        pageNumber: pageReport.pageNumber,
        riskScore: pageReport.riskScore,
        classification: pageReport.severeIssues.length > 0 ? "failed" : "needs-review",
        issues: [...pageReport.severeIssues, ...pageReport.qualityWarnings].slice(0, 5)
      }))
    ))
    .filter((item) => item.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 15);
}

function getRecommendedProductAction(presetSummaries) {
  const active = Object.values(presetSummaries).filter((summary) => summary.total > 0);
  const total = active.reduce((sum, summary) => sum + summary.total, 0);
  const failed = active.reduce((sum, summary) => sum + summary.failed, 0);
  const needsReview = active.reduce((sum, summary) => sum + summary.needsReview, 0);
  const preserved = active.reduce((sum, summary) => sum + summary.pagesPreserved, 0);
  const analyzed = active.reduce((sum, summary) => sum + summary.pagesAnalyzed, 0);

  if (total === 0) return "needs engine work";
  if (failed === 0 && needsReview <= Math.max(1, total * 0.2)) return "sellable";
  if (failed <= Math.max(1, total * 0.25)) return "beta only";
  if (analyzed > 0 && preserved / analyzed > 0.65) return "preserve-only recommended";
  return "needs engine work";
}

function buildSummaryMarkdown(summary) {
  const presetRows = Object.values(summary.presetSummaries).map((preset) =>
    `| ${preset.presetLabel} | ${preset.acceptable} | ${preset.needsReview} | ${preset.failed} | ${preset.pagesAnalyzed} | ${preset.pagesSplit} | ${preset.pagesPreserved} | ${preset.outputReadingPages} |`
  ).join("\n");
  const fileRows = summary.files.map((file) =>
    `| ${escapeMarkdown(file.fileName)} | ${file.classification} | ${file.presets.map((preset) => `${preset.presetId}: ${preset.classification}`).join("<br>")} | ${file.reportPath} |`
  ).join("\n");
  const offenderRows = summary.worstOffenders.length > 0
    ? summary.worstOffenders.map((item) =>
      `| ${escapeMarkdown(item.fileName)} | ${item.presetId} | ${item.pageNumber} | ${item.riskScore} | ${escapeMarkdown(item.issues.join("; "))} |`
    ).join("\n")
    : "| None | - | - | - | - |";

  return `# Real Paper Benchmark Summary

Generated: ${summary.generatedAt}

Input folder: \`${summary.pdfInputFolder}\`  
Report folder: \`${summary.reportFolder}\`  
Preset option: \`${summary.options.preset}\`  
Sampling: \`${summary.options.pagesMode === "all" ? "all pages" : `${summary.options.sample}, max ${summary.options.maxPages} pages`}\`

Recommended product action: **${summary.recommendedProductAction}**

## File Classification

| Classification | Count |
| --- | ---: |
| Acceptable | ${summary.acceptable} |
| Needs review | ${summary.needsReview} |
| Failed | ${summary.failed} |

## Preset Pass/Fail

| Preset | Acceptable | Needs review | Failed | Pages analyzed | Pages split | Pages preserved | Reading pages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${presetRows}

## Worst Offenders

| File | Preset | Page | Risk score | Signals |
| --- | --- | ---: | ---: | --- |
${offenderRows}

## Files

| File | Global status | Preset statuses | Report |
| --- | --- | --- | --- |
${fileRows}

## Manual Review Guidance

Use each preset-specific \`*-review.md\` checklist to inspect exported output manually. Automated warnings are risk signals, not proof that the page is broken.
`;
}

function buildManualReviewMarkdown(report) {
  return `# Manual Review Checklist: ${report.fileName}

Global automated classification: **${report.classification}**

${report.presets.map((preset) => `- ${preset.presetLabel}: ${preset.classification} (${preset.pagesAnalyzed}/${preset.pageCount} pages analyzed)`).join("\n")}

Review the preset-specific checklist files for page-level notes.
`;
}

function buildPresetManualReviewMarkdown(report, preset) {
  const worstPages = preset.pages
    .filter((pageReport) => pageReport.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);

  return `# Manual Review Checklist: ${report.fileName} / ${preset.presetLabel}

Automated classification: **${preset.classification}**  
Pages analyzed: ${preset.pagesAnalyzed}/${preset.pageCount}  
Requested pages: ${preset.requestedPages.join(", ") || "none"}

## Automated Signals

- Pages split: ${preset.pagesSplit}
- Pages preserved: ${preset.pagesPreserved}
- Pages marked risky: ${preset.pagesMarkedRisky}
- Possible clipping risks: ${preset.possibleClippingRisks}
- Possible full-width content risks: ${preset.possibleFullWidthContentRisks}
- Possible figure/table/formula risks: ${preset.possibleFigureTableFormulaRisks}
- Orphan output pages: ${preset.orphanOutputPages}
- Single-sentence output pages: ${preset.singleSentenceOutputPages}
- Low-fill excessive pages: ${preset.lowFillExcessivePages}
- Unreadable Kindle output pages: ${preset.unreadableKindleOutputPages}
- Output reading pages: ${preset.outputReadingPagesCount}

## Highest-Risk Pages

${worstPages.length > 0 ? worstPages.map((pageReport) =>
  `- Page ${pageReport.pageNumber}: ${[...pageReport.severeIssues, ...pageReport.qualityWarnings].slice(0, 4).join("; ")}`
).join("\n") : "- None flagged by automated benchmark."}

## Checklist

- Letter clipping: [ ] yes [ ] no
- Broken formula: [ ] yes [ ] no
- Broken figure/table: [ ] yes [ ] no
- Bad full-width split: [ ] yes [ ] no
- Excessive blank/short pages: [ ] yes [ ] no
- Acceptable output: [ ] yes [ ] no

## Notes


`;
}

async function writeEmptyReports() {
  const summary = buildSummary([]);
  await writeFile(path.join(reportDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(path.join(reportDir, "summary.md"), buildSummaryMarkdown(summary), "utf8");
}

async function waitForSourceReady(page) {
  await page.waitForFunction(() => {
    const hook = window.__PDF_READING_QA__;
    if (!hook) return false;
    const summary = hook.getLatestSummary();
    return summary.status === "ready" || summary.status === "error";
  }, undefined, { timeout: waitMs });
}

async function startNextServer() {
  const reachable = await canReachApp();
  if (reachable) {
    return { kill: () => {} };
  }

  const child = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_PLAN_TIER: process.env.NEXT_PUBLIC_PLAN_TIER ?? "pro"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (data) => {
    const text = data.toString();
    if (process.env.QA_REAL_PAPERS_VERBOSE === "1") process.stdout.write(text);
  });
  child.stderr.on("data", (data) => {
    const text = data.toString();
    if (process.env.QA_REAL_PAPERS_VERBOSE === "1") process.stderr.write(text);
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Could not start the app for real-paper QA. Run npm run dev manually, then rerun npm run qa:real-papers.");
    }
    if (await canReachApp()) {
      return child;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  child.kill("SIGTERM");
  throw new Error("Timed out starting the app for real-paper QA. Run npm run dev manually, then rerun npm run qa:real-papers.");
}

function canReachApp() {
  return new Promise((resolve) => {
    const request = http.get(baseUrl, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(`Playwright is required for real-paper QA. Run npm install first. ${error.message}`);
  }
}

function safeReportName(fileName) {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "paper";
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && String(value).trim() !== "").map(String)));
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
