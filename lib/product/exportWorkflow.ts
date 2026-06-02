import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import { analyzeSafeCropPages } from "@/lib/pdf/analyzePageMargins";
import { analyzeReadingTransforms } from "@/lib/pdf/analyzeReadingTransforms";
import { createColumnReadingPdfFileName, createCroppedPdfFileName } from "@/lib/pdf/downloadPdf";
import { exportColumnReadingPdf } from "@/lib/pdf/exportColumnReadingPdf";
import { exportCroppedPdf } from "@/lib/pdf/exportCroppedPdf";
import { loadPdf } from "@/lib/pdf/loadPdf";
import { getOutputProfileForPreset } from "@/lib/pdf/readingProfiles";
import { getExportLimitStatusForReadingPages, getProductPlan, type ExportLimitHitBy, type PlanTier } from "./productLimits";

export type ExportWorkflowStage =
  | "idle"
  | "preparing"
  | "analyzing"
  | "exporting"
  | "zipping"
  | "completed"
  | "failed"
  | "cancelled";

export type ExportProgressState = {
  stage: ExportWorkflowStage;
  fileName?: string;
  currentPage?: number;
  totalPages?: number;
  currentFile?: number;
  totalFiles?: number;
  optimizedPages: number;
  preservedPages: number;
  warningCount: number;
  startedAt?: number;
  message?: string;
};

export type SinglePdfExportResult = {
  bytes: Uint8Array;
  fileName: string;
  exportScope: "limited-preview" | "full-document";
  sourcePagesIncluded: number;
  totalSourcePages: number;
  outputReadingPages: number;
  readingPagesIncluded: number;
  totalReadingPagesEstimated: number;
  freeSourcePageLimit: number;
  freeReadingPageLimit: number;
  exportLimitHitBy: ExportLimitHitBy;
  exportLimitMessage: string;
  exportLimitApplied: boolean;
  exportLimitReason: string;
  optimizedPages: number;
  preservedPages: number;
  warningCount: number;
};

export type SinglePdfExportOptions = {
  file: File;
  preset: ReadingPresetConfig;
  columnModeEnabled: boolean;
  planTier?: PlanTier;
  document?: PDFDocumentProxy;
  onProgress?: (progress: ExportProgressState) => void;
};

export async function exportSinglePdf({
  file,
  preset,
  columnModeEnabled,
  planTier = getProductPlan().currentPlanTier,
  document,
  onProgress
}: SinglePdfExportOptions): Promise<SinglePdfExportResult> {
  const startedAt = Date.now();
  const loaded = document ? null : await loadPdf(file);
  const pdfDocument = document ?? loaded?.document;

  if (!pdfDocument) {
    throw new Error("This PDF could not be processed.");
  }

  try {
    const totalSourcePages = pdfDocument.numPages;
    const plan = { ...getProductPlan(), currentPlanTier: planTier };
    const provisionalLimit = getExportLimitStatusForReadingPages({
      totalSourcePages,
      totalReadingPagesEstimated: totalSourcePages,
      plan
    });
    const maxPages = provisionalLimit.sourcePagesIncluded ?? totalSourcePages;

    onProgress?.({
      stage: "preparing",
      fileName: file.name,
      currentPage: 0,
      totalPages: maxPages,
      optimizedPages: 0,
      preservedPages: 0,
      warningCount: 0,
      startedAt,
      message: provisionalLimit.exportLimitReason
    });

    if (preset.supportsColumnMode && columnModeEnabled) {
      const transforms = await analyzeReadingTransforms(pdfDocument, {
        readingPreset: preset,
        columnModeEnabled: true,
        maxPages,
        onProgress: ({ pageNumber, totalPages }) => onProgress?.({
          stage: "analyzing",
          fileName: file.name,
          currentPage: pageNumber,
          totalPages,
          optimizedPages: 0,
          preservedPages: 0,
          warningCount: 0,
          startedAt,
          message: `Analyzing page ${pageNumber} / ${totalPages}`
        })
      });
      const totalReadingPagesEstimated = transforms.reduce((sum, transform) => {
        if (transform.mode !== "column-reading") return sum + 1;
        return sum + 2;
      }, 0);
      const exportLimit = getExportLimitStatusForReadingPages({
        totalSourcePages,
        totalReadingPagesEstimated,
        plan
      });
      const maxOutputPages = exportLimit.readingPagesIncluded ?? totalReadingPagesEstimated;

      const result = await exportColumnReadingPdf(file, transforms, getOutputProfileForPreset(preset.id), {
        maxPages,
        maxOutputPages
      });
      const optimizedPages = result.splitSourcePages;
      const preservedPages = result.preservedSourcePages;

      onProgress?.({
        stage: "completed",
        fileName: file.name,
        currentPage: maxPages,
        totalPages: maxPages,
        optimizedPages,
        preservedPages,
        warningCount: preservedPages,
        startedAt,
        message: "PDF export completed."
      });

      return {
        bytes: result.bytes,
        fileName: createColumnReadingPdfFileName(file.name, preset.exportSuffix),
        exportScope: exportLimit.exportScope,
        sourcePagesIncluded: result.exportedSourcePageCount,
        totalSourcePages: result.totalPageCount,
        outputReadingPages: result.outputPageCount,
        readingPagesIncluded: result.outputPageCount,
        totalReadingPagesEstimated,
        freeSourcePageLimit: exportLimit.freeSourcePageLimit,
        freeReadingPageLimit: exportLimit.freeReadingPageLimit,
        exportLimitHitBy: exportLimit.exportLimitHitBy,
        exportLimitMessage: exportLimit.exportLimitMessage,
        exportLimitApplied: exportLimit.exportLimitApplied,
        exportLimitReason: exportLimit.exportLimitReason,
        optimizedPages,
        preservedPages,
        warningCount: preservedPages
      };
    }

    const analyses = await analyzeSafeCropPages(
      pdfDocument,
      maxPages,
      preset,
      ({ pageNumber, totalPages }) => onProgress?.({
        stage: "analyzing",
        fileName: file.name,
        currentPage: pageNumber,
        totalPages,
        optimizedPages: 0,
        preservedPages: 0,
        warningCount: 0,
        startedAt,
        message: `Analyzing page ${pageNumber} / ${totalPages}`
      })
    );
    const totalReadingPagesEstimated = maxPages;
    const exportLimit = getExportLimitStatusForReadingPages({
      totalSourcePages,
      totalReadingPagesEstimated,
      plan
    });
    const result = await exportCroppedPdf(file, analyses, { maxPages });
    const optimizedPages = analyses.filter((analysis) => analysis.status === "auto-cropped").length;
    const preservedPages = result.exportedPageCount - optimizedPages;

    onProgress?.({
      stage: "completed",
      fileName: file.name,
      currentPage: maxPages,
      totalPages: maxPages,
      optimizedPages,
      preservedPages,
      warningCount: preservedPages,
      startedAt,
      message: "PDF export completed."
    });

    return {
      bytes: result.bytes,
      fileName: createCroppedPdfFileName(file.name, preset.exportSuffix),
      exportScope: exportLimit.exportScope,
      sourcePagesIncluded: result.exportedPageCount,
      totalSourcePages: result.totalPageCount,
      outputReadingPages: result.exportedPageCount,
      readingPagesIncluded: result.exportedPageCount,
      totalReadingPagesEstimated,
      freeSourcePageLimit: exportLimit.freeSourcePageLimit,
      freeReadingPageLimit: exportLimit.freeReadingPageLimit,
      exportLimitHitBy: exportLimit.exportLimitHitBy,
      exportLimitMessage: exportLimit.exportLimitMessage,
      exportLimitApplied: exportLimit.exportLimitApplied,
      exportLimitReason: exportLimit.exportLimitReason,
      optimizedPages,
      preservedPages,
      warningCount: preservedPages
    };
  } finally {
    if (loaded) {
      await loaded.document.destroy();
    }
  }
}
