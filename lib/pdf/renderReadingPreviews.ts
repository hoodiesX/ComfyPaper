import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type {
  AcademicSourcePagePlan,
  ColumnDetectionDebug,
  ColumnSplitStatus,
  NormalizedCropRect,
  PdfRenderResult,
  RenderedPage
} from "@/types/pdf";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import { analyzeSafeCrop } from "./cropDetection";
import { buildReadingTransform } from "./columnDetection";
import { getOutputProfileForPreset } from "./readingProfiles";
import { buildAcademicSourcePagePlan } from "./academicReadingPlan";
import { calculateDrawPlacement, calculateProfileDrawPlacement } from "./readingTiles";
import { extractTextRowsFromContent } from "./textLineModel";

const MAX_PREVIEW_PAGES = 3;
const PREVIEW_SCALE = 1.05;
const ANALYSIS_SCALE = 0.32;
const MAX_DEVICE_PIXEL_RATIO = 2;

export async function renderReadingPreviews(
  document: PDFDocumentProxy,
  options: {
    readingPreset: ReadingPresetConfig;
    columnModeEnabled: boolean;
    pageNumbers?: number[];
  }
): Promise<PdfRenderResult> {
  const pageNumbers = options.pageNumbers?.length
    ? sanitizePageNumbers(options.pageNumbers, document.numPages)
    : Array.from({ length: Math.min(document.numPages, MAX_PREVIEW_PAGES) }, (_, index) => index + 1);
  const pages: RenderedPage[] = [];
  const failedPageNumbers: number[] = [];
  const diagnostics: ColumnDetectionDebug[] = [];
  const academicPlans: AcademicSourcePagePlan[] = [];
  const pixelRatio = getSafePixelRatio();
  const renderScale = PREVIEW_SCALE * pixelRatio;
  const outputProfile = getOutputProfileForPreset(options.readingPreset.id);

  for (const pageNumber of pageNumbers) {
    try {
      const page = await document.getPage(pageNumber);
      const analysisViewport = page.getViewport({ scale: ANALYSIS_SCALE });
      const analysisCanvas = window.document.createElement("canvas");
      const analysisContext = analysisCanvas.getContext("2d", { willReadFrequently: true });

      if (!analysisContext) {
        throw new Error("Canvas analysis is not available in this browser.");
      }

      analysisCanvas.width = Math.floor(analysisViewport.width);
      analysisCanvas.height = Math.floor(analysisViewport.height);
      await page.render({ canvasContext: analysisContext, viewport: analysisViewport }).promise;

      const pixels = {
        data: analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height).data,
        width: analysisCanvas.width,
        height: analysisCanvas.height
      };
      const marginAnalysis = analyzeSafeCrop(pixels, pageNumber, options.readingPreset);
      const textRows = await getPageTextRows(page);
      const transform = buildReadingTransform(
        pixels,
        pageNumber,
        marginAnalysis,
        options.columnModeEnabled,
        options.readingPreset,
        textRows
      );
      const academicPlan = buildAcademicSourcePagePlan(transform, outputProfile);
      academicPlans.push(academicPlan);
      logColumnDiagnostics(transform, {
        presetId: options.readingPreset.id,
        columnModeEnabled: options.columnModeEnabled,
        allowed: options.readingPreset.supportsColumnMode
      });
      diagnostics.push(
        normalizeDiagnostic(transform.debug, {
          pageNumber,
          mode: transform.mode,
          status: transform.status,
          presetId: options.readingPreset.id,
          columnModeEnabled: options.columnModeEnabled,
          allowed: options.readingPreset.supportsColumnMode
        }, academicPlan)
      );

      const viewport = page.getViewport({ scale: renderScale });
      const sourceCanvas = window.document.createElement("canvas");
      const sourceContext = sourceCanvas.getContext("2d");

      if (!sourceContext) {
        throw new Error("Canvas rendering is not available in this browser.");
      }

      sourceCanvas.width = Math.floor(viewport.width);
      sourceCanvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: sourceContext, viewport }).promise;

      if (transform.mode === "column-reading") {
        for (const outputPage of academicPlan.outputPages) {
          pages.push(
            renderCropToPreview(sourceCanvas, outputPage.sourceCropFractions, {
              pageNumber: pages.length + 1,
              previewId: outputPage.outputId,
              sourcePageNumber: outputPage.sourcePageNumber,
              column: outputPage.regionKind === "right-column" ? "right" : "left",
              tileIndex: outputPage.outputPageIndex,
              tileCount: academicPlan.summary.outputPageCountByRegion[outputPage.sourceRegionId] ?? 1,
              outputProfileId: outputPage.outputProfileId,
              columnStatus: "split",
              cropReason: transform.reason,
              normalizedCrop: outputPage.sourceCropFractions
            }, {
              width: outputProfile.pageWidth,
              height: outputProfile.pageHeight,
              pixelRatio,
              outputProfile
            })
          );
        }
      } else {
        const isMarginCrop = transform.mode === "margin-crop";
        pages.push(
          renderCropToPreview(sourceCanvas, transform.crop, {
            pageNumber,
            previewId: getPreviewId(pageNumber, transform.mode),
            sourcePageNumber: pageNumber,
            cropStatus: isMarginCrop ? transform.status : "no-safe-crop",
            columnStatus:
              options.columnModeEnabled && transform.mode === "preserved"
                ? getColumnStatus(transform.status)
                : undefined,
            cropGainPercent: transform.gainPercent,
            cropReason: transform.reason,
            normalizedCrop: transform.crop
          })
        );
      }

      page.cleanup();
    } catch (error) {
      console.error(`Failed to render reading preview for page ${pageNumber}.`, error);
      failedPageNumbers.push(pageNumber);
    }
  }

  return { pages, failedPageNumbers, diagnostics, academicPlans };
}

function sanitizePageNumbers(pageNumbers: number[], totalPages: number) {
  return Array.from(new Set(
    pageNumbers
      .map((pageNumber) => Math.floor(pageNumber))
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
  )).sort((a, b) => a - b);
}

async function getPageTextRows(page: PDFPageProxy) {
  try {
    const textContent = await page.getTextContent();
    return extractTextRowsFromContent(textContent, page.view);
  } catch {
    return [];
  }
}

function getPreviewId(
  sourcePageNumber: number,
  mode: string,
  column?: string,
  tileIndex = 0
): string {
  return `${sourcePageNumber}-${mode}-${column ?? "full"}-${tileIndex}`;
}

function normalizeDiagnostic(
  debug: ColumnDetectionDebug | undefined,
  context: {
    pageNumber: number;
    mode: string;
    status: string;
    presetId: string;
    columnModeEnabled: boolean;
    allowed: boolean;
  },
  academicPlan?: AcademicSourcePagePlan
): ColumnDetectionDebug {
  if (debug) {
    return {
      ...debug,
      presetId: debug.presetId ?? context.presetId,
      columnModeEnabled: debug.columnModeEnabled ?? context.columnModeEnabled,
      allowed: debug.allowed ?? context.allowed,
      academicStrategy: academicPlan?.strategy ?? debug.academicStrategy,
      academicFailureCategories: academicPlan?.summary.failureCategories ?? debug.academicFailureCategories,
      planValidationPassed: academicPlan?.validation.ok ?? debug.planValidationPassed,
      outputPageFillQualities: academicPlan?.outputPages.map((page) => page.outputPageFillQuality) ?? debug.outputPageFillQualities,
      outputPageCountByRegion: academicPlan?.summary.outputPageCountByRegion ?? debug.outputPageCountByRegion,
      repairedFailures: academicPlan?.summary.repairedFailures ?? debug.repairedFailures,
      unrepairedFailures: academicPlan?.summary.unrepairedFailures ?? debug.unrepairedFailures,
      repairActionsApplied: academicPlan?.summary.repairActionsApplied ?? debug.repairActionsApplied,
      titleAuthorRepairApplied: academicPlan?.summary.titleAuthorRepairApplied ?? debug.titleAuthorRepairApplied,
      fullWidthTitleRegionDetected: academicPlan?.summary.fullWidthTitleRegionDetected ?? debug.fullWidthTitleRegionDetected,
      bodyRegionTop: academicPlan?.summary.bodyRegionTop ?? debug.bodyRegionTop,
      titleRegionContainsColumnRows: academicPlan?.summary.titleRegionContainsColumnRows ?? debug.titleRegionContainsColumnRows,
      rowCoveragePassed: academicPlan?.summary.rowCoveragePassed ?? debug.rowCoveragePassed,
      duplicatedTextRowsCount: academicPlan?.summary.duplicatedTextRowsCount ?? debug.duplicatedTextRowsCount,
      missingTextRowsCount: academicPlan?.summary.missingTextRowsCount ?? debug.missingTextRowsCount,
      unaccountedMissingRowsCount: academicPlan?.summary.unaccountedMissingRowsCount ?? debug.unaccountedMissingRowsCount,
      ignoredRowsCount: academicPlan?.summary.ignoredRowsCount ?? debug.ignoredRowsCount,
      ignoredRowsByReason: academicPlan?.summary.ignoredRowsByReason ?? debug.ignoredRowsByReason,
      rowCoverageFailureReason: academicPlan?.summary.rowCoverageFailureReason ?? debug.rowCoverageFailureReason,
      nearDuplicateOutputPages: academicPlan?.summary.nearDuplicateOutputPages ?? debug.nearDuplicateOutputPages,
      productQualityGrade: academicPlan?.summary.productQualityGrade ?? debug.productQualityGrade,
      productQualityScore: academicPlan?.summary.productQualityScore ?? debug.productQualityScore,
      productQualityIssues: academicPlan?.summary.productQualityIssues ?? debug.productQualityIssues,
      qualityGatePassed: academicPlan?.summary.qualityGatePassed ?? debug.qualityGatePassed,
      academicPageClass: academicPlan?.summary.academicPageClass ?? debug.academicPageClass,
      pageClassReason: academicPlan?.summary.pageClassReason ?? debug.pageClassReason,
      mixedSplitReason: academicPlan?.summary.mixedSplitReason ?? debug.mixedSplitReason,
      titleDetectionApplicable: academicPlan?.summary.titleDetectionApplicable ?? debug.titleDetectionApplicable,
      titleDetectionSkippedReason: academicPlan?.summary.titleDetectionSkippedReason ?? debug.titleDetectionSkippedReason,
      bodyColumnExtractionAttempted: academicPlan?.summary.bodyColumnExtractionAttempted ?? debug.bodyColumnExtractionAttempted,
      bodyColumnExtractionSucceeded: academicPlan?.summary.bodyColumnExtractionSucceeded ?? debug.bodyColumnExtractionSucceeded,
      rawColumnDetectorSuggestedSplit: academicPlan?.summary.rawColumnDetectorSuggestedSplit ?? debug.rawColumnDetectorSuggestedSplit,
      plannerAcceptedColumnSplit: academicPlan?.summary.plannerAcceptedColumnSplit ?? debug.plannerAcceptedColumnSplit,
      plannerRejectedColumnSplitReason: academicPlan?.summary.plannerRejectedColumnSplitReason ?? debug.plannerRejectedColumnSplitReason,
      transitionCandidates: academicPlan?.summary.transitionCandidates ?? debug.transitionCandidates,
      bestTransitionCandidate: academicPlan?.summary.bestTransitionCandidate ?? debug.bestTransitionCandidate,
      transitionConfidence: academicPlan?.summary.transitionConfidence ?? debug.transitionConfidence,
      transitionRejectionReason: academicPlan?.summary.transitionRejectionReason ?? debug.transitionRejectionReason,
      sourceRegionCount: academicPlan?.summary.sourceRegionCount ?? debug.sourceRegionCount,
      outputPageCount: academicPlan?.summary.outputPageCount ?? debug.outputPageCount,
      verticalBreakCount: academicPlan?.summary.verticalBreakCount ?? debug.verticalBreakCount,
      breakCoverageComplete: academicPlan?.summary.breakCoverageComplete ?? debug.breakCoverageComplete
    };
  }

  return {
    pageNumber: context.pageNumber,
    decision: context.mode === "margin-crop" ? "margin-crop" : "preserve",
    reason: context.columnModeEnabled ? "analysis-failed" : "one-column",
    confidence: 0,
    presetId: context.presetId,
    columnModeEnabled: context.columnModeEnabled,
    allowed: context.allowed
  };
}

function logColumnDiagnostics(
  transform: ReturnType<typeof buildReadingTransform>,
  context: {
    presetId: string;
    columnModeEnabled: boolean;
    allowed: boolean;
  }
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const debug = transform.debug;
  console.table([
    {
      page: transform.sourcePageNumber,
      preset: context.presetId,
      columnMode: context.columnModeEnabled,
      allowed: context.allowed,
      decision: debug?.decision ?? transform.mode,
      reason: debug?.reason ?? transform.status,
      confidence: transform.mode === "column-reading" ? transform.confidence.toFixed(2) : "0.00",
      gutterWidth: debug?.gutter?.width?.toFixed(3) ?? "",
      gutterInkDensity: debug?.gutter?.inkDensity?.toFixed(3) ?? "",
      leftDensity: debug?.measurements?.leftDensity?.toFixed(3) ?? "",
      rightDensity: debug?.measurements?.rightDensity?.toFixed(3) ?? "",
      balanceRatio: debug?.measurements?.balanceRatio?.toFixed(3) ?? "",
      minGutter: debug?.measurements?.minGutterEmptyRatio ?? "",
      clearSegments: debug?.gutter?.clearSegmentRatio?.toFixed(3) ?? "",
      minClearSegments: debug?.measurements?.minGutterClearSegmentRatio ?? "",
      maxGutterInk: debug?.measurements?.maxGutterInkRatio ?? "",
      minBalance: debug?.measurements?.minColumnBalanceRatio ?? ""
    }
  ]);
  if (debug) console.debug("[Column detection details]", debug);
}

function getColumnStatus(status: string): ColumnSplitStatus {
  if (status === "full-width-content") return "full-width-content";
  if (status === "low-confidence") return "low-confidence";
  if (status === "not-two-column") return "not-two-column";
  if (status === "failed") return "failed";
  return "uncertain";
}

function renderCropToPreview(
  sourceCanvas: HTMLCanvasElement,
  crop: NormalizedCropRect,
  page: Omit<RenderedPage, "width" | "height" | "dataUrl">,
  outputSize?: { width: number; height: number; pixelRatio: number; outputProfile?: ReturnType<typeof getOutputProfileForPreset> }
): RenderedPage {
  const cropRect = normalizedToCanvasRect(crop, sourceCanvas.width, sourceCanvas.height);
  const outputCanvas = window.document.createElement("canvas");
  const outputContext = outputCanvas.getContext("2d");

  if (!outputContext) {
    throw new Error("Canvas rendering is not available in this browser.");
  }

  outputCanvas.width = outputSize ? Math.round(outputSize.width * outputSize.pixelRatio) : sourceCanvas.width;
  outputCanvas.height = outputSize ? Math.round(outputSize.height * outputSize.pixelRatio) : sourceCanvas.height;
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  const placement = outputSize?.outputProfile
    ? scalePlacement(
      calculateProfileDrawPlacement(cropRect.width, cropRect.height, outputSize.outputProfile),
      outputSize.pixelRatio
    )
    : calculateDrawPlacement(cropRect.width, cropRect.height, outputCanvas.width, outputCanvas.height);
  outputContext.drawImage(
    sourceCanvas,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    placement.x,
    placement.y,
    placement.width,
    placement.height
  );

  const pixelRatio = outputSize?.pixelRatio ?? getSafePixelRatio();

  return {
    ...page,
    width: Math.round(outputCanvas.width / pixelRatio),
    height: Math.round(outputCanvas.height / pixelRatio),
    dataUrl: outputCanvas.toDataURL("image/png")
  };
}

function scalePlacement(placement: ReturnType<typeof calculateDrawPlacement>, pixelRatio: number) {
  return {
    x: placement.x * pixelRatio,
    y: placement.y * pixelRatio,
    width: placement.width * pixelRatio,
    height: placement.height * pixelRatio,
    scale: placement.scale * pixelRatio
  };
}

function normalizedToCanvasRect(crop: NormalizedCropRect, width: number, height: number) {
  const x = width * crop.left;
  const y = height * crop.top;

  return {
    x,
    y,
    width: Math.max(1, width * (1 - crop.left - crop.right)),
    height: Math.max(1, height * (1 - crop.top - crop.bottom))
  };
}

function getSafePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
}
