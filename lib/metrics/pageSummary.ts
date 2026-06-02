import type { CropStatus, RenderedPage } from "@/types/pdf";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import { calculateReadingGainPercent } from "./readingGain";

export type ReadingSummary = {
  analyzedPages: number;
  croppedPages: number;
  preservedPages: number;
  minimalCropPages: number;
  failedPages: number;
  averageGainPercent: number;
};

export type ExportSummary = {
  pageLimit: number;
  totalPages?: number;
  croppedPages: number;
  preservedPages: number;
  estimatedOutputPages: number;
  exportScope: "limited-preview" | "full-document";
  sourcePagesIncluded: number;
  readingPagesIncluded: number;
  totalSourcePages?: number;
  totalReadingPagesEstimated?: number;
  freeSourcePageLimit: number;
  freeReadingPageLimit: number;
  exportLimitHitBy: "source-pages" | "reading-pages" | "none";
  exportLimitMessage: string;
  outputReadingPages: number;
  presetLabel: string;
  limitText: string;
  exportLimitApplied: boolean;
  exportLimitReason: string;
  exportLimitReasonCode: "free-beta-limit" | "full-document-enabled";
  sourcePageCount?: number;
  exportPageCount: number;
};

export function summarizeRenderedPages(pages: RenderedPage[]): ReadingSummary {
  const analyzedPages = pages.length;
  const croppedPages = pages.filter(
    (page) => page.cropStatus === "auto-cropped" || page.columnStatus === "split"
  ).length;
  const minimalCropPages = pages.filter((page) => page.cropStatus === "minimal-crop").length;
  const failedPages = pages.filter((page) => page.cropStatus === "failed").length;
  const preservedPages = pages.filter((page) => isPreservedStatus(page.cropStatus)).length;
  const gains = pages.map((page) => {
    if (page.columnStatus === "split") {
      return 0;
    }

    return page.cropGainPercent ?? calculateReadingGainPercent(page.normalizedCrop);
  });
  const averageGainPercent =
    gains.length === 0 ? 0 : Math.round(gains.reduce((total, gain) => total + gain, 0) / gains.length);

  return {
    analyzedPages,
    croppedPages,
    preservedPages,
    minimalCropPages,
    failedPages,
    averageGainPercent
  };
}

export function buildExportSummary(
  previewPages: RenderedPage[],
  preset: ReadingPresetConfig,
  totalPages?: number,
  pageLimit = 5,
  columnModeEnabled = false,
  readingPageLimit = 12
): ExportSummary {
  const limitedPageCount = Math.min(totalPages ?? pageLimit, pageLimit);
  const previewSummary = summarizeRenderedPages(previewPages);
  const sourcePages = new Set(previewPages.map((page) => page.sourcePageNumber ?? page.pageNumber));
  const splitSourcePages = new Set(
    previewPages
      .filter((page) => page.columnStatus === "split")
      .map((page) => page.sourcePageNumber ?? page.pageNumber)
  ).size;
  const previewKnownPages = Math.max(1, sourcePages.size || previewSummary.analyzedPages);
  const croppedRatio =
    (previewSummary.croppedPages + previewSummary.minimalCropPages) / previewKnownPages;
  const estimatedOptimizedSourcePages = columnModeEnabled
    ? Math.round(limitedPageCount * (splitSourcePages / previewKnownPages))
    : Math.round(limitedPageCount * croppedRatio);
  const estimatedOutputPages = columnModeEnabled ? limitedPageCount + estimatedOptimizedSourcePages : limitedPageCount;
  const sourceLimitHit = Boolean(totalPages && totalPages > pageLimit);
  const readingLimitHit = estimatedOutputPages > readingPageLimit;
  const readingPagesIncluded = Math.min(estimatedOutputPages, readingPageLimit);
  const exportLimitHitBy = readingLimitHit ? "reading-pages" : sourceLimitHit ? "source-pages" : "none";
  const exportLimitApplied = exportLimitHitBy !== "none";

  return {
    pageLimit,
    totalPages,
    croppedPages: estimatedOptimizedSourcePages,
    preservedPages: Math.max(0, limitedPageCount - estimatedOptimizedSourcePages),
    estimatedOutputPages,
    exportScope: exportLimitApplied ? "limited-preview" : "full-document",
    sourcePagesIncluded: limitedPageCount,
    readingPagesIncluded,
    totalSourcePages: totalPages,
    totalReadingPagesEstimated: estimatedOutputPages,
    freeSourcePageLimit: pageLimit,
    freeReadingPageLimit: readingPageLimit,
    exportLimitHitBy,
    exportLimitMessage: exportLimitApplied
      ? `Free beta exports up to ${pageLimit} source pages or ${readingPageLimit} reading pages. Full-document export is Pro.`
      : "Full document export enabled.",
    outputReadingPages: readingPagesIncluded,
    presetLabel: preset.label,
    exportLimitApplied,
    exportLimitReason: exportLimitApplied
      ? `Free beta exports up to ${pageLimit} source pages or ${readingPageLimit} reading pages. Full-document export is Pro.`
      : "Full document export enabled.",
    exportLimitReasonCode: exportLimitApplied ? "free-beta-limit" : "full-document-enabled",
    sourcePageCount: totalPages,
    exportPageCount: limitedPageCount,
    limitText:
      exportLimitApplied
        ? `First ${pageLimit} of ${totalPages} source pages`
        : "Full document export"
  };
}

function isPreservedStatus(status?: CropStatus): boolean {
  return status === "no-safe-crop" || status === "failed" || !status;
}
