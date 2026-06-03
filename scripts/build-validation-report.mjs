import fs from "node:fs";
import path from "node:path";

const reportDir = path.resolve("qa/real-paper-reports");
const outMd = path.join(reportDir, "pdf-engine-validation-report.md");
const outJson = path.join(reportDir, "pdf-engine-validation-report.json");

if (!fs.existsSync(reportDir)) {
  console.error(`Missing report folder: ${reportDir}`);
  process.exit(1);
}

const allJsonFiles = fs.readdirSync(reportDir)
  .filter((file) => file.endsWith(".json"))
  .filter((file) => ![
    "pdf-engine-validation-report.json",
    "summary.json"
  ].includes(file));

const summaryPath = path.join(reportDir, "summary.json");
const summary = fs.existsSync(summaryPath)
  ? JSON.parse(fs.readFileSync(summaryPath, "utf8"))
  : null;

const reports = [];

for (const file of allJsonFiles) {
  const fullPath = path.join(reportDir, file);
  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    if (parsed.fileName && Array.isArray(parsed.presets)) {
      reports.push(parsed);
    }
  } catch {
    // ignore invalid json
  }
}

if (reports.length === 0) {
  console.error("No per-PDF JSON reports found. Run qa:real-papers first.");
  process.exit(1);
}

const presetIds = ["academic-paper", "kindle-ereader", "ipad-tablet"];

const presetLabels = {
  "academic-paper": "Academic Paper",
  "kindle-ereader": "Kindle / E-reader",
  "ipad-tablet": "iPad / Tablet",
};

function presetStats(presetId) {
  const entries = reports
    .map((report) => report.presets.find((p) => p.presetId === presetId))
    .filter(Boolean);

  const acceptable = entries.filter((p) => p.classification === "acceptable").length;
  const needsReview = entries.filter((p) => p.classification === "needs review" || p.classification === "needs-review").length;
  const failed = entries.filter((p) => p.classification === "failed").length;

  const severeIssues = entries.flatMap((p) => p.severeIssues ?? []);
  const warnings = entries.flatMap((p) => p.qualityWarnings ?? []);

  const pagesAnalyzed = entries.reduce((sum, p) => sum + (p.pagesAnalyzed ?? 0), 0);
  const pagesSplit = entries.reduce((sum, p) => sum + (p.pagesSplit ?? 0), 0);
  const pagesPreserved = entries.reduce((sum, p) => sum + (p.pagesPreserved ?? 0), 0);
  const risky = entries.reduce((sum, p) => sum + (p.pagesMarkedRisky ?? 0), 0);

  const severeByType = {};
  for (const issue of severeIssues) {
    severeByType[issue] = (severeByType[issue] ?? 0) + 1;
  }

  const warningByType = {};
  for (const warning of warnings) {
    warningByType[warning] = (warningByType[warning] ?? 0) + 1;
  }

  const total = entries.length;
  const acceptableRate = total ? acceptable / total : 0;
  const failedRate = total ? failed / total : 0;

  let verdict = "NEEDS ENGINE WORK";
  if (acceptableRate >= 0.8 && failed === 0) verdict = "SELLABLE";
  else if (acceptableRate >= 0.6 && failedRate <= 0.15) verdict = "BETA ONLY";
  else if (failedRate >= 0.35) verdict = "PIVOT TO SAFE MODE";

  return {
    presetId,
    label: presetLabels[presetId],
    total,
    acceptable,
    needsReview,
    failed,
    acceptableRate,
    pagesAnalyzed,
    pagesSplit,
    pagesPreserved,
    risky,
    severeIssueCount: severeIssues.length,
    warningCount: warnings.length,
    severeByType,
    warningByType,
    verdict,
  };
}

const stats = presetIds.map(presetStats);

const worst = [];

for (const report of reports) {
  for (const preset of report.presets ?? []) {
    for (const page of preset.pages ?? []) {
      const severeCount = (page.severeIssues ?? []).length;
      const warningCount = (page.qualityWarnings ?? []).length;
      const riskScore =
        severeCount * 5 +
        warningCount * 2 +
        (page.risky ? 3 : 0) +
        (page.possibleClippingRisks ?? 0) * 5 +
        (page.possibleFullWidthContentRisks ?? 0) * 4 +
        (page.possibleFigureTableFormulaRisks ?? 0) * 4;

      if (riskScore > 0) {
        worst.push({
          fileName: report.fileName,
          preset: presetLabels[preset.presetId] ?? preset.presetId,
          pageNumber: page.pageNumber,
          riskScore,
          strategy: page.strategy,
          layoutKind: page.layoutKind,
          warnings: page.qualityWarnings ?? [],
          severeIssues: page.severeIssues ?? [],
        });
      }
    }
  }
}

worst.sort((a, b) => b.riskScore - a.riskScore);

const totalFiles = reports.length;
const totalPages = reports.reduce((sum, r) => sum + (r.pageCount ?? 0), 0);
const totalPagesAnalyzed = stats.reduce((sum, s) => sum + s.pagesAnalyzed, 0);

const academic = stats.find((s) => s.presetId === "academic-paper");
const kindle = stats.find((s) => s.presetId === "kindle-ereader");
const ipad = stats.find((s) => s.presetId === "ipad-tablet");

let executiveVerdict = "NEEDS ENGINE WORK";
let monetizationReadiness = "waitlist only";
let recommendedNextAction = "fix engine first";

if (academic.acceptableRate >= 0.75 && academic.failed === 0 && kindle.failed > 0) {
  executiveVerdict = "BETA ONLY";
  monetizationReadiness = "free beta only";
  recommendedNextAction = "position Academic Paper as primary; demote Kindle to beta/review mode";
}

if (academic.acceptableRate < 0.6 || academic.failed > 0) {
  executiveVerdict = "PIVOT TO SAFE MODE";
  monetizationReadiness = "not ready to charge";
  recommendedNextAction = "pivot to conservative safe mode + manual review workflow";
}

if (academic.acceptableRate >= 0.85 && kindle.acceptableRate >= 0.7 && academic.failed === 0) {
  executiveVerdict = "SELLABLE";
  monetizationReadiness = "ready to test paid early access";
  recommendedNextAction = "launch limited paid beta";
}

const score = Math.max(0, Math.min(100, Math.round(
  academic.acceptableRate * 55 +
  ipad.acceptableRate * 20 +
  kindle.acceptableRate * 15 -
  (academic.failed * 8) -
  (kindle.failed * 4) -
  Math.min(20, academic.severeIssueCount * 2)
)));

const result = {
  generatedAt: new Date().toISOString(),
  executiveVerdict,
  overallScore: score,
  monetizationReadiness,
  recommendedNextAction,
  dataset: {
    totalFiles,
    totalPages,
    totalPagesAnalyzed,
    sourceSummary: summary,
  },
  presets: stats,
  worstOffenders: worst.slice(0, 10),
};

function formatIssueCounts(obj) {
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length === 0) return "- None";
  return entries.map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

const md = `# PDF Engine Validation Report

Generated: ${result.generatedAt}

## Executive verdict

**${executiveVerdict}**

Overall score: **${score}/100**

Monetization readiness: **${monetizationReadiness}**

Recommended next action: **${recommendedNextAction}**

## Dataset summary

| Metric | Value |
| --- | ---: |
| PDFs tested | ${totalFiles} |
| Total source pages | ${totalPages} |
| Total preset-pages analyzed | ${totalPagesAnalyzed} |
| Presets tested | Academic Paper, Kindle / E-reader, iPad / Tablet |

## Preset verdicts

${stats.map((s) => `### ${s.label}

Verdict: **${s.verdict}**

| Metric | Value |
| --- | ---: |
| Files | ${s.total} |
| Acceptable | ${s.acceptable} |
| Needs review | ${s.needsReview} |
| Failed | ${s.failed} |
| Acceptable rate | ${(s.acceptableRate * 100).toFixed(1)}% |
| Pages analyzed | ${s.pagesAnalyzed} |
| Pages split | ${s.pagesSplit} |
| Pages preserved | ${s.pagesPreserved} |
| Risky pages | ${s.risky} |
| Severe issues | ${s.severeIssueCount} |
| Warnings | ${s.warningCount} |

Main severe issues:

${formatIssueCounts(s.severeByType)}

Main warnings:

${formatIssueCounts(s.warningByType)}
`).join("\n")}

## Worst offenders

| Rank | File | Preset | Page | Risk | Strategy | Issues |
| ---: | --- | --- | ---: | ---: | --- | --- |
${worst.slice(0, 10).map((w, i) => `| ${i + 1} | ${w.fileName} | ${w.preset} | ${w.pageNumber ?? "?"} | ${w.riskScore} | ${w.strategy ?? "-"} | ${[...w.severeIssues, ...w.warnings].join(", ") || "-"} |`).join("\n")}

## Product risk analysis

- Clipping risk: inspect worst offenders manually, especially pages with column split and mixed layout.
- Full-width content risk: risky for pages with titles, figures, formulas, tables or centered blocks mixed with two-column text.
- Figure/table/formula risk: automatic detection is still weak; manual review is required on worst cases.
- Footer/header confusion: likely source of false splits and poor tile boundaries.
- Kindle readability risk: Kindle should not be the main paid promise if it has severe low-fill/orphan/unreadable output.
- Academic Paper should be evaluated separately from Kindle. A PDF can be acceptable in Academic mode and failed in Kindle mode.

## Monetization decision

Current recommendation: **${monetizationReadiness}**

Do not sell this as a fully automatic universal academic PDF optimizer unless Academic Paper reaches a high acceptable rate and severe layout failures are rare.

Safer positioning if continuing:

> Safe academic PDF reading optimizer: cleans margins, splits simple body pages, preserves complex layouts, and highlights pages that need review.

## Manual QA checklist: inspect only these cases first

${worst.slice(0, 5).map((w, i) => `${i + 1}. ${w.fileName} — ${w.preset}, page ${w.pageNumber ?? "?"}
   - Letter clipping: yes/no
   - Broken formula/table/figure: yes/no
   - Bad full-width split: yes/no
   - Excessive blank/short page: yes/no
   - Acceptable output: yes/no
   - Notes:
`).join("\n")}

## Final interpretation

If Academic Paper has many needs-review/failed cases, prioritize engine safety or pivot to conservative/manual review mode.

If Kindle has severe issues, demote it to beta/review mode and do not use it as the main paid feature.

If most value comes from safe crop/preserve rather than split, change the product promise before charging.
`;

fs.writeFileSync(outJson, JSON.stringify(result, null, 2));
fs.writeFileSync(outMd, md);

console.log(`Wrote ${outMd}`);
console.log(`Wrote ${outJson}`);
