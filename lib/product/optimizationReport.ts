import type { AcademicSourcePagePlan, ProductQualityIssue, RenderedPage } from "@/types/pdf";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import { getExportLimitStatusForReadingPages, getProductPlan, type ExportLimitHitBy } from "./productLimits";

export type UserQualityBadge = "Ready" | "Good" | "Review suggested" | "Not recommended";
export type ExportReadiness = "ready" | "good-with-warnings" | "review-recommended" | "not-recommended";
export type ExportScope = "limited-preview" | "full-document";
export type ComparisonBadge = "Two-column -> reading pages" | "Margins cleaned" | "Preserved safely";

export type UserPageOutcome = {
  pageNumber: number;
  category: "optimized" | "preserved" | "review";
  title: string;
  message: string;
  suggestedAction?: string;
};

export type UserOptimizationReport = {
  userReportGenerated: boolean;
  presetLabel: string;
  outputProfileId?: string;
  qualityBadge: UserQualityBadge;
  exportReadiness: ExportReadiness;
  exportReadinessReason: string;
  blockingIssues: string[];
  warningIssues: string[];
  optimizedBodyPagesCount: number;
  preservedPagesCount: number;
  reviewPagesCount: number;
  figureTablePagesCount: number;
  estimatedReadabilityGain: "comfortable" | "acceptable" | "needs review";
  averagePageFill: "good" | "acceptable" | "needs review";
  textScaleStatus: "comfortable" | "acceptable" | "needs review";
  summaryItems: string[];
  readingImprovementItems: string[];
  preservedOutcomes: UserPageOutcome[];
  reviewOutcomes: UserPageOutcome[];
  bestComparisonPageNumber?: number;
  bestComparisonReason: string;
  bestComparisonBadge: ComparisonBadge;
  exportLimitApplied: boolean;
  exportLimitReason: string;
  exportLimitMessage: string;
  exportScope: ExportScope;
  sourcePagesIncluded?: number;
  readingPagesIncluded?: number;
  totalSourcePages?: number;
  totalReadingPagesEstimated?: number;
  exportLimitHitBy: ExportLimitHitBy;
  outputReadingPages: number;
  exportLimitReasonCode: "free-beta-limit" | "full-document-enabled";
  planTier: "free" | "pro";
  freeExportLimit: number;
  freeSourcePageLimit: number;
  freeReadingPageLimit: number;
  proFeatureBadges: string[];
  upgradeCTA: string;
  recommendedPresetLabel: string;
  recommendedPresetReason: string;
};

type BuildReportInput = {
  preset: ReadingPresetConfig;
  academicPlans: AcademicSourcePagePlan[];
  optimizedPages: RenderedPage[];
  totalSourcePages?: number;
  outputProfileId?: string;
};

const BLOCKING_ISSUES = new Set<string>([
  "duplicate-output-page",
  "unknown-layout-accepted"
]);

const REVIEW_ISSUES = new Set<string>([
  "kindle-crop-boundary-risk",
  "kindle-output-not-readable",
  "kindle-low-fill",
  "kindle-tiny-slice",
  "kindle-middle-orphan",
  "kindle-final-orphan",
  "single-sentence-output-page",
  "orphan-output-page",
  "final-crop-clipping"
]);

export function buildUserOptimizationReport({
  preset,
  academicPlans,
  optimizedPages,
  totalSourcePages,
  outputProfileId
}: BuildReportInput): UserOptimizationReport {
  const optimizedBodyPagesCount = countOptimizedBodyPages(academicPlans, optimizedPages);
  const preservedOutcomes = buildPreservedOutcomes(academicPlans);
  const reviewOutcomes = buildReviewOutcomes(academicPlans, preset);
  const preservedPagesCount = preservedOutcomes.length;
  const reviewPagesCount = reviewOutcomes.length;
  const figureTablePagesCount = academicPlans.filter((page) =>
    page.strategy === "figure-table-preserve" ||
    page.regions.some((region) => region.kind === "figure" || region.kind === "table")
  ).length;
  const blockingIssues = getBlockingIssues(academicPlans);
  const warningIssues = getWarningIssues(academicPlans, preset);
  const exportReadiness = getExportReadiness(preset, blockingIssues, reviewOutcomes, warningIssues);
  const qualityBadge = toQualityBadge(exportReadiness);
  const averageFill = average(
    academicPlans.flatMap((plan) => plan.outputPages.map((page) => page.contentFillRatio))
  );
  const averageScale = average(
    academicPlans.flatMap((plan) => plan.outputPages.map((page) => page.estimatedReadableScale))
  );
  const bestComparison = selectBestComparisonPageCandidate(optimizedPages, academicPlans);
  const outputReadingPages = academicPlans.length > 0
    ? academicPlans.reduce((sum, plan) => sum + plan.outputPages.length, 0)
    : optimizedPages.length;
  const exportLimit = getExportLimitStatusForReadingPages({
    totalSourcePages,
    totalReadingPagesEstimated: outputReadingPages || totalSourcePages,
    plan: getProductPlan()
  });
  const recommendedPreset = getRecommendedPreset(preset, optimizedBodyPagesCount, preservedPagesCount, reviewPagesCount);

  return {
    userReportGenerated: true,
    presetLabel: preset.label,
    outputProfileId,
    qualityBadge,
    exportReadiness,
    exportReadinessReason: getExportReadinessReason(exportReadiness, preset),
    blockingIssues,
    warningIssues,
    optimizedBodyPagesCount,
    preservedPagesCount,
    reviewPagesCount,
    figureTablePagesCount,
    estimatedReadabilityGain: optimizedBodyPagesCount > 0 ? "comfortable" : preservedPagesCount > 0 ? "acceptable" : "needs review",
    averagePageFill: averageFill >= 0.52 ? "good" : averageFill >= 0.36 ? "acceptable" : "needs review",
    textScaleStatus: averageScale >= 1 ? "comfortable" : averageScale >= 0.8 ? "acceptable" : "needs review",
    summaryItems: [
      `${preservedPagesCount} page${preservedPagesCount === 1 ? "" : "s"} preserved for safety`,
      `${optimizedBodyPagesCount} body page${optimizedBodyPagesCount === 1 ? "" : "s"} optimized for reading`,
      `${figureTablePagesCount} figure/table page${figureTablePagesCount === 1 ? "" : "s"} preserved`,
      `${reviewPagesCount} page${reviewPagesCount === 1 ? "" : "s"} need review`,
      `Output profile: ${preset.label}`
    ],
    readingImprovementItems: [
      `${optimizedBodyPagesCount} page${optimizedBodyPagesCount === 1 ? "" : "s"} split into reading columns`,
      `Average page fill: ${averageFill >= 0.52 ? "good" : averageFill >= 0.36 ? "acceptable" : "needs review"}`,
      `Text scale: ${averageScale >= 1 ? "comfortable" : averageScale >= 0.8 ? "acceptable" : "needs review"}`
    ],
    preservedOutcomes,
    reviewOutcomes,
    bestComparisonPageNumber: bestComparison.page?.sourcePageNumber ?? bestComparison.page?.pageNumber,
    bestComparisonReason: bestComparison.reason,
    bestComparisonBadge: bestComparison.badge,
    outputReadingPages,
    exportLimitReasonCode: exportLimit.exportLimitApplied ? "free-beta-limit" : "full-document-enabled",
    recommendedPresetLabel: recommendedPreset.label,
    recommendedPresetReason: recommendedPreset.reason,
    ...exportLimit
  };
}

export function selectBestComparisonPage(optimizedPages: RenderedPage[]): RenderedPage | undefined {
  return selectBestComparisonPageCandidate(optimizedPages).page;
}

export function selectBestComparisonPageCandidate(
  optimizedPages: RenderedPage[],
  academicPlans: AcademicSourcePagePlan[] = []
): { page?: RenderedPage; reason: string; badge: ComparisonBadge } {
  const pageOnePreserved = academicPlans.some((plan) =>
    plan.sourcePageNumber === 1 &&
    (plan.strategy === "preserve-page" ||
      plan.strategy === "unsafe-preserve" ||
      plan.strategy === "figure-table-preserve" ||
      Boolean(plan.summary.firstPagePreservedForSafety))
  );
  const optimizedSourcePages = new Set(
    academicPlans
      .filter((plan) => isOptimizedReadingPlan(plan))
      .map((plan) => plan.sourcePageNumber)
  );
  const highGainTwoColumn = optimizedPages.find((page) =>
    page.columnStatus === "split" &&
    page.column &&
    optimizedSourcePages.has(page.sourcePageNumber ?? page.pageNumber)
  );
  if (highGainTwoColumn) {
    return {
      page: highGainTwoColumn,
      reason: pageOnePreserved && (highGainTwoColumn.sourcePageNumber ?? highGainTwoColumn.pageNumber) !== 1
        ? "Page 1 was preserved for safety, so we're previewing the first optimized body page."
        : "Showing a body page with the strongest reading improvement.",
      badge: "Two-column -> reading pages"
    };
  }

  const firstOptimizedBody = optimizedPages.find((page) =>
    page.columnStatus === "split" &&
    page.column
  );
  if (firstOptimizedBody) {
    return {
      page: firstOptimizedBody,
      reason: pageOnePreserved && (firstOptimizedBody.sourcePageNumber ?? firstOptimizedBody.pageNumber) !== 1
        ? "Page 1 was preserved for safety, so we're previewing the first optimized body page."
        : "Showing a body page with the strongest reading improvement.",
      badge: "Two-column -> reading pages"
    };
  }

  const highestGain = [...optimizedPages]
    .filter((page) => page.cropStatus === "auto-cropped" || (page.cropGainPercent ?? 0) > 0)
    .sort((a, b) => (b.cropGainPercent ?? 0) - (a.cropGainPercent ?? 0))[0];
  if (highestGain) {
    return {
      page: highestGain,
      reason: "Showing the page with the clearest margin cleanup in the preview.",
      badge: "Margins cleaned"
    };
  }

  const fallback = optimizedPages[0];
  return {
    page: fallback,
    reason: fallback
      ? "No body page could be safely reflowed, so the preview starts with the preserved layout."
      : "Upload a PDF to see the strongest reading improvement.",
    badge: "Preserved safely"
  };
}

function countOptimizedBodyPages(academicPlans: AcademicSourcePagePlan[], optimizedPages: RenderedPage[]): number {
  const sourcePages = new Set(
    academicPlans
      .filter((plan) =>
        (plan.strategy === "two-column-width-fit" ||
          plan.strategy === "mixed-layout" ||
          plan.strategy === "single-column-reading" ||
          plan.strategy === "first-page-title-preserve-body-width-fit") &&
        plan.outputPages.some((page) => page.paginationMode === "width-fit-page" || page.paginationMode === "width-fit-final-page")
      )
      .map((plan) => plan.sourcePageNumber)
  );

  if (sourcePages.size > 0) return sourcePages.size;

  return new Set(
    optimizedPages
      .filter((page) => page.columnStatus === "split")
      .map((page) => page.sourcePageNumber ?? page.pageNumber)
  ).size;
}

function isOptimizedReadingPlan(plan: AcademicSourcePagePlan): boolean {
  return (plan.strategy === "two-column-width-fit" ||
    plan.strategy === "mixed-layout" ||
    plan.strategy === "single-column-reading" ||
    plan.strategy === "first-page-title-preserve-body-width-fit") &&
    plan.outputPages.some((page) => page.paginationMode === "width-fit-page" || page.paginationMode === "width-fit-final-page");
}

function buildPreservedOutcomes(academicPlans: AcademicSourcePagePlan[]): UserPageOutcome[] {
  return academicPlans
    .filter((page) =>
      page.strategy === "preserve-page" ||
      page.strategy === "unsafe-preserve" ||
      page.strategy === "figure-table-preserve" ||
      getIssues(page).includes("first-page-preserved-short-body") ||
      getIssues(page).includes("first-page-preserved-title-abstract") ||
      getIssues(page).includes("first-page-preserved-cover")
    )
    .map((page) => ({
      pageNumber: page.sourcePageNumber,
      category: "preserved" as const,
      title: "Preserved for safety",
      message: getPreserveReason(page),
      suggestedAction: "Review preview if this page is important for reading."
    }));
}

function buildReviewOutcomes(academicPlans: AcademicSourcePagePlan[], preset: ReadingPresetConfig): UserPageOutcome[] {
  return academicPlans
    .filter((page) =>
      !page.validation.ok ||
      page.summary.qualityGatePassed === false ||
      getIssues(page).some((issue) => REVIEW_ISSUES.has(issue)) ||
      page.summary.failureCategories.some((issue) => REVIEW_ISSUES.has(issue))
    )
    .map((page) => ({
      pageNumber: page.sourcePageNumber,
      category: "review" as const,
      title: "Review suggested",
      message: getReviewMessage([...getIssues(page), ...page.summary.failureCategories], preset),
      suggestedAction: preset.id === "kindle-ereader"
        ? "Review preview or switch to Academic Paper for this PDF."
        : "Review preview before export."
    }));
}

function getPreserveReason(page: AcademicSourcePagePlan): string {
  const issues = getIssues(page);
  if (issues.includes("first-page-preserved-short-body")) return "Title or cover content was preserved because the body text is short or asymmetric.";
  if (issues.includes("first-page-preserved-title-abstract")) return "Title or abstract page was preserved to avoid a risky split.";
  if (issues.includes("first-page-preserved-cover")) return "Cover-style page was preserved.";
  if (page.strategy === "figure-table-preserve") return "Figure or table-heavy content was kept intact.";
  if (page.strategy === "unsafe-preserve") return "Complex layout was preserved instead of forcing a risky conversion.";
  return "Complex page structure was kept intact.";
}

function getReviewMessage(issues: string[], preset: ReadingPresetConfig): string {
  if (issues.includes("kindle-crop-boundary-risk") || issues.includes("final-crop-clipping")) {
    return "Possible clipped text in the e-reader output.";
  }
  if (issues.includes("kindle-low-fill") || issues.includes("orphan-output-page") || issues.includes("single-sentence-output-page")) {
    return "Some reading pages may feel sparse or contain a small text block.";
  }
  if (issues.includes("kindle-output-not-readable")) {
    return "Kindle output may not be ideal for this PDF.";
  }
  return preset.id === "kindle-ereader"
    ? "This page may be better in Academic Paper mode."
    : "This page should be checked in preview.";
}

function getBlockingIssues(academicPlans: AcademicSourcePagePlan[]): string[] {
  const issues = academicPlans.flatMap((page) => getIssues(page));
  return [...new Set(issues.filter((issue) => BLOCKING_ISSUES.has(issue)))];
}

function getWarningIssues(academicPlans: AcademicSourcePagePlan[], preset: ReadingPresetConfig): string[] {
  const issues = academicPlans.flatMap((page) => getIssues(page));
  const warnings = issues.filter((issue) => !BLOCKING_ISSUES.has(issue));
  if (preset.id === "kindle-ereader" && warnings.length === 0) return ["Kindle output should still be previewed on complex PDFs."];
  return [...new Set(warnings)];
}

function getExportReadiness(
  preset: ReadingPresetConfig,
  blockingIssues: string[],
  reviewOutcomes: UserPageOutcome[],
  warningIssues: string[]
): ExportReadiness {
  if (blockingIssues.length > 0) return "not-recommended";
  if (preset.id === "kindle-ereader" && reviewOutcomes.length > 0) return "review-recommended";
  if (reviewOutcomes.length > 2) return "review-recommended";
  if (warningIssues.length > 0 || reviewOutcomes.length > 0) return "good-with-warnings";
  return "ready";
}

function getExportReadinessReason(readiness: ExportReadiness, preset: ReadingPresetConfig): string {
  if (readiness === "ready") return "Your paper is ready. Body pages were optimized for reading while complex pages were preserved safely.";
  if (readiness === "good-with-warnings") return preset.id === "kindle-ereader"
    ? "This Kindle version is usable, but a few pages may need review."
    : "This PDF is ready with a few pages preserved safely for layout fidelity.";
  if (readiness === "review-recommended") return "This PDF has complex layouts. Review the flagged pages before exporting.";
  return "This PDF has complex layouts. Safe Default may be better.";
}

function toQualityBadge(readiness: ExportReadiness): UserQualityBadge {
  if (readiness === "ready") return "Ready";
  if (readiness === "good-with-warnings") return "Good";
  if (readiness === "review-recommended") return "Review suggested";
  return "Not recommended";
}

function average(values: Array<number | undefined>): number {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (finite.length === 0) return 0;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function getIssues(page: AcademicSourcePagePlan): ProductQualityIssue[] {
  return page.summary.productQualityIssues ?? [];
}

function getRecommendedPreset(
  preset: ReadingPresetConfig,
  optimizedBodyPagesCount: number,
  preservedPagesCount: number,
  reviewPagesCount: number
): { label: string; reason: string } {
  if (reviewPagesCount > 2 || preservedPagesCount > optimizedBodyPagesCount + 2) {
    return {
      label: "Safe Default",
      reason: "Many pages need review, so the conservative preset may be safer."
    };
  }
  if (preset.id === "kindle-ereader" && optimizedBodyPagesCount > 0 && reviewPagesCount === 0) {
    return {
      label: "Kindle / E-reader",
      reason: "The e-reader profile looks good for this body-heavy paper."
    };
  }
  return {
    label: "Academic Paper",
    reason: "Best first choice for papers and technical PDFs."
  };
}
