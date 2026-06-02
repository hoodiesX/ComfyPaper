import type {
  ColumnCrop,
  ColumnDetectionDebug,
  ColumnDetectionReason,
  ColumnSafetyDiagnostics,
  ColumnSplitStatus,
  NormalizedBoundsRect,
  NormalizedCropRect,
  PageCropAnalysis,
  PageReadingTransform,
  TextLineRow
} from "@/types/pdf";
import type { PixelData } from "./cropDetection";
import { estimateBackgroundColor, isBackgroundPixel } from "./cropDetection";
import { getOutputProfileForPreset } from "./readingProfiles";
import { findSmartTileBreaks } from "./smartTileBreaks";
import { findTextLayerTileBreaks } from "./textLineModel";
import {
  boundsToCropFractions,
  boundsToDiagnostics,
  cropFractionsToDiagnostics,
  getBoundsCutDetails,
  makeBoundsRect
} from "./normalizedRects";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";

type ColumnDetectionResult = {
  status: ColumnSplitStatus;
  confidence: number;
  columns: ColumnCrop[];
  debug: ColumnDetectionDebug;
  reason?: string;
};

type ColumnDetectionConfig = {
  centerScanRatio: number;
  minGutterEmptyRatio: number;
  preferredMinGutterEmptyRatio: number;
  minGutterClearSegmentRatio: number;
  gutterSegmentCount: number;
  segmentEmptyRatioThreshold: number;
  maxGutterInkRatio: number;
  preferredMaxGutterInkRatio: number;
  minColumnContentDensity: number;
  minColumnBalanceRatio: number;
  preferredMinColumnBalanceRatio: number;
  gutterHalfWidthRatio: number;
  gutterSafetyPaddingRatio: number;
  minInnerEdgeLeft: number;
  maxInnerEdgeRight: number;
  outerPaddingRatio: number;
  innerPaddingRatio: number;
  verticalPaddingRatio: number;
  minContentSafetyRatio: number;
  contentProjectionMinDensity: number;
  containmentToleranceRatio: number;
  repairSafetyPaddingRatio: number;
  innerTextSafetyPaddingRatio: number;
  outerTextSafetyPaddingRatio: number;
  verticalTextSafetyPaddingRatio: number;
};

const COLUMN_DETECTION_CONFIG: ColumnDetectionConfig = {
  centerScanRatio: 0.14,
  minGutterEmptyRatio: 0.88,
  preferredMinGutterEmptyRatio: 0.84,
  minGutterClearSegmentRatio: 0.66,
  gutterSegmentCount: 10,
  segmentEmptyRatioThreshold: 0.86,
  maxGutterInkRatio: 0.08,
  preferredMaxGutterInkRatio: 0.11,
  minColumnContentDensity: 0.008,
  minColumnBalanceRatio: 0.36,
  preferredMinColumnBalanceRatio: 0.28,
  gutterHalfWidthRatio: 0.012,
  gutterSafetyPaddingRatio: 0.006,
  minInnerEdgeLeft: 0.33,
  maxInnerEdgeRight: 0.67,
  outerPaddingRatio: 0.025,
  innerPaddingRatio: 0.012,
  verticalPaddingRatio: 0.028,
  minContentSafetyRatio: 0.002,
  contentProjectionMinDensity: 0.006,
  containmentToleranceRatio: 0.002,
  repairSafetyPaddingRatio: 0.004,
  innerTextSafetyPaddingRatio: 0.008,
  outerTextSafetyPaddingRatio: 0.01,
  verticalTextSafetyPaddingRatio: 0.008
};

const BODY_TOP_RATIO = 0.16;
const BODY_BOTTOM_RATIO = 0.1;

export function detectColumnSplit(
  pixels: PixelData,
  pageNumber: number,
  marginAnalysis: PageCropAnalysis,
  readingPreset?: ReadingPresetConfig,
  textRows: TextLineRow[] = []
): ColumnDetectionResult {
  const config = getColumnDetectionConfig(readingPreset);
  if (pixels.width > pixels.height * 1.12) {
    return reject("not-two-column", "landscape-like", "Landscape or slide-like page.", pageNumber);
  }

  const background = estimateBackgroundColor(pixels);
  const top = Math.floor(pixels.height * BODY_TOP_RATIO);
  const bottom = Math.floor(pixels.height * (1 - BODY_BOTTOM_RATIO));
  const centerStart = Math.floor(pixels.width * (0.5 - config.centerScanRatio / 2));
  const centerEnd = Math.ceil(pixels.width * (0.5 + config.centerScanRatio / 2));
  let bestColumn = centerStart;
  let bestEmptyRatio = 0;
  let bestClearSegmentRatio = 0;
  let bestScore = 0;

  for (let x = centerStart; x <= centerEnd; x += 1) {
    const gutterStats = getVerticalGutterStats(pixels, x, top, bottom, background, config);
    const score = gutterStats.emptyRatio * 0.7 + gutterStats.clearSegmentRatio * 0.3;
    if (
      score > bestScore ||
      (score === bestScore &&
        Math.abs(x - pixels.width / 2) < Math.abs(bestColumn - pixels.width / 2))
    ) {
      bestScore = score;
      bestEmptyRatio = gutterStats.emptyRatio;
      bestClearSegmentRatio = gutterStats.clearSegmentRatio;
      bestColumn = x;
    }
  }

  const gutterHalfWidth = Math.max(2, pixels.width * config.gutterHalfWidthRatio);
  const gutterSafetyPadding = Math.max(1, pixels.width * config.gutterSafetyPaddingRatio);
  const gutterLeft = bestColumn - gutterHalfWidth;
  const gutterRight = bestColumn + gutterHalfWidth;
  const gutterInkRatio = getBandInkRatio(
    pixels,
    Math.max(0, Math.floor(gutterLeft)),
    Math.min(pixels.width, Math.ceil(gutterRight)),
    top,
    bottom,
    background
  );
  const gutterDebug = {
    left: gutterLeft / pixels.width,
    right: gutterRight / pixels.width,
    center: bestColumn / pixels.width,
    width: (gutterRight - gutterLeft) / pixels.width,
    inkDensity: gutterInkRatio,
    confidence: bestEmptyRatio,
    clearSegmentRatio: bestClearSegmentRatio
  };
  const layoutConfidence = Math.min(0.99, Math.max(0, bestEmptyRatio - gutterInkRatio));
  const baseMeasurements = {
    minGutterEmptyRatio: config.minGutterEmptyRatio,
    maxGutterInkRatio: config.maxGutterInkRatio,
    minGutterClearSegmentRatio: config.minGutterClearSegmentRatio,
    minColumnContentDensity: config.minColumnContentDensity,
    minColumnBalanceRatio: config.minColumnBalanceRatio
  };
  let mixedLayoutCandidate = false;

  if (
    bestEmptyRatio < config.minGutterEmptyRatio &&
    bestClearSegmentRatio < config.minGutterClearSegmentRatio
  ) {
    return reject("full-width-content", "gutter-too-noisy", "No reliable central gutter detected.", pageNumber, {
      confidence: layoutConfidence,
      gutter: gutterDebug,
      measurements: baseMeasurements
    });
  }

  if (gutterInkRatio > config.maxGutterInkRatio) {
    if (bestClearSegmentRatio >= config.minGutterClearSegmentRatio) {
      mixedLayoutCandidate = true;
    } else {
      return reject("full-width-content", "full-width-content-preserved", "Content appears to cross the gutter.", pageNumber, {
        confidence: layoutConfidence,
        gutter: gutterDebug,
        measurements: baseMeasurements
      });
    }
  }

  const leftContentRatio = getBandInkRatio(pixels, 0, bestColumn, top, bottom, background);
  const rightContentRatio = getBandInkRatio(pixels, bestColumn, pixels.width, top, bottom, background);
  const balanceRatio = Math.min(leftContentRatio, rightContentRatio) / Math.max(leftContentRatio, rightContentRatio);
  const measurements = {
    ...baseMeasurements,
    leftDensity: leftContentRatio,
    rightDensity: rightContentRatio,
    balanceRatio
  };

  if (
    leftContentRatio < config.minColumnContentDensity ||
    rightContentRatio < config.minColumnContentDensity
  ) {
    return reject("low-confidence", "one-column", "Only one reliable content column detected.", pageNumber, {
      confidence: layoutConfidence,
      gutter: gutterDebug,
      measurements
    });
  }

  if (
    balanceRatio < config.minColumnBalanceRatio
  ) {
    return reject("low-confidence", "columns-unbalanced", "Detected columns are too unbalanced.", pageNumber, {
      confidence: layoutConfidence,
      gutter: gutterDebug,
      measurements
    });
  }

  const leftInnerEdge = (gutterLeft - gutterSafetyPadding) / pixels.width;
  const rightInnerEdge = (gutterRight + gutterSafetyPadding) / pixels.width;

  if (
    leftInnerEdge <= config.minInnerEdgeLeft ||
    rightInnerEdge >= config.maxInnerEdgeRight ||
    leftInnerEdge >= rightInnerEdge
  ) {
    return reject("low-confidence", "gutter-too-narrow", "Detected gutter is too narrow to isolate columns safely.", pageNumber, {
      confidence: layoutConfidence,
      gutter: gutterDebug,
      measurements
    });
  }

  const leftBounds = detectContentBounds(
    pixels,
    {
      left: marginAnalysis.normalizedCrop.left,
      top: marginAnalysis.normalizedCrop.top,
      right: 1 - leftInnerEdge,
      bottom: marginAnalysis.normalizedCrop.bottom
    },
    background,
    config
  );
  const rightBounds = detectContentBounds(
    pixels,
    {
      left: rightInnerEdge,
      top: marginAnalysis.normalizedCrop.top,
      right: marginAnalysis.normalizedCrop.right,
      bottom: marginAnalysis.normalizedCrop.bottom
    },
    background,
    config
  );

  if (!leftBounds) {
    return reject("low-confidence", "unsafe-left-column", "Left column content bounds were not reliable.", pageNumber, {
      confidence: layoutConfidence,
      gutter: gutterDebug,
      measurements
    });
  }

  if (!rightBounds) {
    return reject("low-confidence", "unsafe-right-column", "Right column content bounds were not reliable.", pageNumber, {
      confidence: layoutConfidence,
      gutter: gutterDebug,
      measurements
    });
  }

  const gutterBounds = {
    left: gutterDebug.left,
    right: gutterDebug.right,
    center: gutterDebug.center
  };
  const leftCropPlan = buildColumnCropFromBounds("left", leftBounds, {
    outerBoundary: marginAnalysis.normalizedCrop.left,
    innerBoundary: leftInnerEdge,
    topBoundary: marginAnalysis.normalizedCrop.top,
    bottomBoundary: marginAnalysis.normalizedCrop.bottom
  }, gutterBounds, config);
  const rightCropPlan = buildColumnCropFromBounds("right", rightBounds, {
    outerBoundary: 1 - marginAnalysis.normalizedCrop.right,
    innerBoundary: rightInnerEdge,
    topBoundary: marginAnalysis.normalizedCrop.top,
    bottomBoundary: marginAnalysis.normalizedCrop.bottom
  }, gutterBounds, config);
  const leftRepair = repairColumnCropToContainContent("left", leftBounds, leftCropPlan, {
    outerBoundary: marginAnalysis.normalizedCrop.left,
    topBoundary: marginAnalysis.normalizedCrop.top,
    bottomBoundary: marginAnalysis.normalizedCrop.bottom
  }, gutterBounds, config);
  const rightRepair = repairColumnCropToContainContent("right", rightBounds, rightCropPlan, {
    outerBoundary: 1 - marginAnalysis.normalizedCrop.right,
    topBoundary: marginAnalysis.normalizedCrop.top,
    bottomBoundary: marginAnalysis.normalizedCrop.bottom
  }, gutterBounds, config);
  const leftFinalPlan = leftRepair.plan;
  const rightFinalPlan = rightRepair.plan;
  const refinedLeftPlan = refineColumnCropForTextSafety("left", leftBounds, leftFinalPlan, {
    outerBoundary: marginAnalysis.normalizedCrop.left,
    topBoundary: marginAnalysis.normalizedCrop.top,
    bottomBoundary: marginAnalysis.normalizedCrop.bottom
  }, gutterBounds, config);
  const refinedRightPlan = refineColumnCropForTextSafety("right", rightBounds, rightFinalPlan, {
    outerBoundary: 1 - marginAnalysis.normalizedCrop.right,
    topBoundary: marginAnalysis.normalizedCrop.top,
    bottomBoundary: marginAnalysis.normalizedCrop.bottom
  }, gutterBounds, config);
  const leftSafety = evaluateColumnSafety("left", leftBounds, refinedLeftPlan, gutterBounds, config, leftRepair);
  const rightSafety = evaluateColumnSafety("right", rightBounds, refinedRightPlan, gutterBounds, config, rightRepair);
  const leftCrop = refinedLeftPlan.finalCrop;
  const rightCrop = refinedRightPlan.finalCrop;

  if (!leftSafety.contentInsideCrop || leftSafety.crossesGutter) {
    return reject("low-confidence", "unsafe-left-column", "Left column crop would cut content.", pageNumber, {
      confidence: layoutConfidence,
      gutter: gutterDebug,
      measurements,
      leftColumn: {
        crop: leftCrop,
        contentBounds: leftBounds,
        safe: false,
        safety: leftSafety
      }
    });
  }

  if (!rightSafety.contentInsideCrop || rightSafety.crossesGutter) {
    return reject("low-confidence", "unsafe-right-column", "Right column crop would cut content.", pageNumber, {
      confidence: layoutConfidence,
      gutter: gutterDebug,
      measurements,
      rightColumn: {
        crop: rightCrop,
        contentBounds: rightBounds,
        safe: false,
        safety: rightSafety
      }
    });
  }

  const outputProfile = getOutputProfileForPreset(readingPreset?.id ?? "academic-paper");
  const leftTextBreaks = outputProfile.preferTextLayerBreaks
    ? findTextLayerTileBreaks(textRows, leftCrop, outputProfile)
    : { breaks: [], details: [] };
  const rightTextBreaks = outputProfile.preferTextLayerBreaks
    ? findTextLayerTileBreaks(textRows, rightCrop, outputProfile)
    : { breaks: [], details: [] };
  const leftBreaks = leftTextBreaks.breaks.length > 0
    ? { ...leftTextBreaks, strategy: "smart" as const }
    : findSmartTileBreaks(pixels, leftCrop, outputProfile);
  const rightBreaks = rightTextBreaks.breaks.length > 0
    ? { ...rightTextBreaks, strategy: "smart" as const }
    : findSmartTileBreaks(pixels, rightCrop, outputProfile);
  const columns: ColumnCrop[] = [
    {
      sourcePageNumber: pageNumber,
      column: "left",
      crop: leftCrop,
      contentBounds: leftBounds,
      gainPercent: 0,
      breakFractions: leftBreaks.breaks,
      breakDetails: leftBreaks.details,
      breakStrategy: leftBreaks.strategy
    },
    {
      sourcePageNumber: pageNumber,
      column: "right",
      crop: rightCrop,
      contentBounds: rightBounds,
      gainPercent: 0,
      breakFractions: rightBreaks.breaks,
      breakDetails: rightBreaks.details,
      breakStrategy: rightBreaks.strategy
    }
  ];
  const paginationSummaries = columns.map((column) => summarizeColumnPagination(column, outputProfile));
  const outputPageCount = paginationSummaries.reduce((total, summary) => total + summary.outputTileCount, 0);
  const verticalBreakCount = paginationSummaries.reduce((total, summary) => total + summary.verticalBreakCount, 0);
  const breakCoverageComplete = paginationSummaries.every((summary) => summary.breakCoverageComplete);
  const tileBreaks = [
    ...leftBreaks.details.map((detail) => ({
      ...detail,
      column: "left" as const,
      overlapRatio: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile),
      overlapBeforeRepair: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile),
      overlapAfterRepair: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile),
      estimatedLineHeight: 0.022,
      whitespaceBandTop: detail.whitespaceBandTop,
      whitespaceBandBottom: detail.whitespaceBandBottom,
      previousFinalBottom: detail.previousFinalBottom,
      nextFinalTop: detail.nextFinalTop,
      corridorHeight: detail.corridorHeight,
      corridorToLineHeightRatio: detail.corridorToLineHeightRatio,
      gapInkDensity: detail.gapInkDensity,
      maxCorridorRowInkDensity: detail.maxCorridorRowInkDensity,
      upperGuardInkDensity: detail.upperGuardInkDensity,
      lowerGuardInkDensity: detail.lowerGuardInkDensity,
      maxAdjacentGuardInkDensity: detail.maxAdjacentGuardInkDensity,
      finalBoundaryValid: detail.finalBoundaryValid,
      rejectionReasonIfInvalid: detail.rejectionReasonIfInvalid,
      duplicateBoundaryLikely:
        detail.continuationMode === "micro-overlap" ||
        detail.breakKind === "fallback-dense" ||
        detail.topBoundarySafe === false ||
        detail.bottomBoundarySafe === false ||
        getDiagnosticOverlapRatio(detail.continuationMode, outputProfile) >= 0.011,
      continuityRepairApplied: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile) > outputProfile.maxOverlapRatio,
      excessiveOverlap: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile) > outputProfile.maxOverlapRatio
    })),
    ...rightBreaks.details.map((detail) => ({
      ...detail,
      column: "right" as const,
      overlapRatio: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile),
      overlapBeforeRepair: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile),
      overlapAfterRepair: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile),
      estimatedLineHeight: 0.022,
      whitespaceBandTop: detail.whitespaceBandTop,
      whitespaceBandBottom: detail.whitespaceBandBottom,
      previousFinalBottom: detail.previousFinalBottom,
      nextFinalTop: detail.nextFinalTop,
      corridorHeight: detail.corridorHeight,
      corridorToLineHeightRatio: detail.corridorToLineHeightRatio,
      gapInkDensity: detail.gapInkDensity,
      maxCorridorRowInkDensity: detail.maxCorridorRowInkDensity,
      upperGuardInkDensity: detail.upperGuardInkDensity,
      lowerGuardInkDensity: detail.lowerGuardInkDensity,
      maxAdjacentGuardInkDensity: detail.maxAdjacentGuardInkDensity,
      finalBoundaryValid: detail.finalBoundaryValid,
      rejectionReasonIfInvalid: detail.rejectionReasonIfInvalid,
      duplicateBoundaryLikely:
        detail.continuationMode === "micro-overlap" ||
        detail.breakKind === "fallback-dense" ||
        detail.topBoundarySafe === false ||
        detail.bottomBoundarySafe === false ||
        getDiagnosticOverlapRatio(detail.continuationMode, outputProfile) >= 0.011,
      continuityRepairApplied: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile) > outputProfile.maxOverlapRatio,
      excessiveOverlap: getDiagnosticOverlapRatio(detail.continuationMode, outputProfile) > outputProfile.maxOverlapRatio
    }))
  ];
  const confidence = layoutConfidence;
  const splitReason =
    leftRepair.status === "repaired" || rightRepair.status === "repaired"
      ? "split-with-repaired-crop"
      : mixedLayoutCandidate
        ? "mixed-layout-body-split"
      : "clear-two-column";

  return {
    status: "split",
    confidence,
    columns: columns.map((column) => ({
      ...column,
      gainPercent: estimateColumnGain(column.crop)
    })),
    debug: {
      pageNumber,
      decision: mixedLayoutCandidate ? "mixed-split" : "split",
      confidence,
      presetId: readingPreset?.id,
      columnModeEnabled: true,
      allowed: Boolean(readingPreset?.supportsColumnMode ?? true),
      reason: splitReason,
      gutter: gutterDebug,
      measurements,
      leftColumn: {
        crop: leftCrop,
        contentBounds: leftBounds,
        safe: true,
        safety: leftSafety
      },
      rightColumn: {
        crop: rightCrop,
        contentBounds: rightBounds,
        safe: true,
        safety: rightSafety
      },
      tileBreaks,
      tileCount: outputPageCount,
      sourceRegionCount: columns.length,
      outputPageCount,
      verticalBreakCount,
      breakCoverageComplete,
      textLayerAvailable: textRows.length > 0,
      textRowsDetected: textRows.length,
      outputProfileId: outputProfile.id
    },
    reason: "Consistent central gutter detected."
  };
}

function summarizeColumnPagination(
  column: ColumnCrop,
  outputProfile: ReturnType<typeof getOutputProfileForPreset>
): {
  outputTileCount: number;
  verticalBreakCount: number;
  breakCoverageComplete: boolean;
} {
  const columnWidth = 1 - column.crop.left - column.crop.right;
  const columnHeight = 1 - column.crop.top - column.crop.bottom;
  const desiredTileCount = Math.min(
    outputProfile.maxTilesPerColumn,
    Math.max(1, Math.ceil(columnHeight / (columnWidth / outputProfile.aspectRatio)))
  );
  const requestedBreaks = (column.breakFractions ?? [])
    .filter((value) => value > column.crop.top && value < 1 - column.crop.bottom)
    .sort((a, b) => a - b)
    .slice(0, desiredTileCount - 1);
  const details = column.breakDetails ?? [];
  const breakCoverageComplete = requestedBreaks.length === details.length;
  const validDetails = breakCoverageComplete &&
    details.every((detail) =>
      detail.finalBoundaryValid === true &&
      detail.lastResortFallback !== true &&
      detail.previousFinalBottom !== undefined &&
      detail.nextFinalTop !== undefined &&
      detail.previousFinalBottom < detail.nextFinalTop
    );

  if (requestedBreaks.length === 0 || !validDetails) {
    return {
      outputTileCount: 1,
      verticalBreakCount: 0,
      breakCoverageComplete
    };
  }

  return {
    outputTileCount: requestedBreaks.length + 1,
    verticalBreakCount: requestedBreaks.length,
    breakCoverageComplete
  };
}

function getDiagnosticOverlapRatio(
  mode: "clean-non-overlap" | "micro-overlap" | "emergency-overlap",
  outputProfile: ReturnType<typeof getOutputProfileForPreset>
): number {
  if (mode === "clean-non-overlap") return outputProfile.cleanBreakOverlapRatio;
  if (mode === "micro-overlap") return outputProfile.microOverlapRatio;
  return outputProfile.emergencyOverlapRatio;
}

export function buildReadingTransform(
  pixels: PixelData,
  pageNumber: number,
  marginAnalysis: PageCropAnalysis,
  columnModeEnabled: boolean,
  readingPreset?: ReadingPresetConfig,
  textRows: TextLineRow[] = []
): PageReadingTransform {
  if (!columnModeEnabled) {
    if (marginAnalysis.status === "no-safe-crop" || marginAnalysis.status === "failed") {
      return {
        sourcePageNumber: pageNumber,
        mode: "preserved",
        status: marginAnalysis.status,
        crop: marginAnalysis.normalizedCrop,
        gainPercent: marginAnalysis.gainPercent,
        textRows,
        reason: marginAnalysis.reason
      };
    }

    return {
      sourcePageNumber: pageNumber,
      mode: "margin-crop",
      status: marginAnalysis.status,
      crop: marginAnalysis.normalizedCrop,
      gainPercent: marginAnalysis.gainPercent,
      textRows,
      reason: marginAnalysis.reason
    };
  }

  const columnResult = detectColumnSplit(pixels, pageNumber, marginAnalysis, readingPreset, textRows);

  if (columnResult.status === "split") {
    return {
      sourcePageNumber: pageNumber,
      mode: "column-reading",
      status: "split",
      columns: columnResult.columns,
      confidence: columnResult.confidence,
      textRows,
      debug: columnResult.debug,
      reason: columnResult.reason
    };
  }

  if (marginAnalysis.status === "no-safe-crop" || marginAnalysis.status === "failed") {
    return {
      sourcePageNumber: pageNumber,
      mode: "preserved",
      status: columnResult.status,
      crop: marginAnalysis.normalizedCrop,
      gainPercent: marginAnalysis.gainPercent,
      textRows,
      debug: columnResult.debug,
      reason: columnResult.reason
    };
  }

  return {
    sourcePageNumber: pageNumber,
    mode: "margin-crop",
    status: marginAnalysis.status,
    crop: marginAnalysis.normalizedCrop,
    gainPercent: marginAnalysis.gainPercent,
    textRows,
    debug: columnResult.debug,
    reason: columnResult.reason
  };
}

function reject(
  status: ColumnSplitStatus,
  debugReason: ColumnDetectionReason,
  reason: string,
  pageNumber: number,
  debug?: Partial<ColumnDetectionDebug>
): ColumnDetectionResult {
  return {
    status,
    confidence: 0,
    columns: [],
    debug: {
      pageNumber,
      decision: "preserve",
      confidence: 0,
      reason: debugReason,
      ...debug
    },
    reason: `Page ${pageNumber}: ${reason}`
  };
}

function getColumnDetectionConfig(readingPreset?: ReadingPresetConfig): ColumnDetectionConfig {
  if (!readingPreset?.preferColumnSplit) {
    return COLUMN_DETECTION_CONFIG;
  }

  return {
    ...COLUMN_DETECTION_CONFIG,
    minGutterEmptyRatio: COLUMN_DETECTION_CONFIG.preferredMinGutterEmptyRatio,
    maxGutterInkRatio: COLUMN_DETECTION_CONFIG.preferredMaxGutterInkRatio,
    minColumnBalanceRatio: COLUMN_DETECTION_CONFIG.preferredMinColumnBalanceRatio
  };
}

export function getColumnDetectionDebugConfig(readingPreset?: ReadingPresetConfig) {
  const config = getColumnDetectionConfig(readingPreset);

  return {
    minGutterEmptyRatio: config.minGutterEmptyRatio,
    minGutterClearSegmentRatio: config.minGutterClearSegmentRatio,
    maxGutterInkRatio: config.maxGutterInkRatio,
    minColumnContentDensity: config.minColumnContentDensity,
    minColumnBalanceRatio: config.minColumnBalanceRatio,
    gutterHalfWidthRatio: config.gutterHalfWidthRatio,
    gutterSafetyPaddingRatio: config.gutterSafetyPaddingRatio
  };
}

function getVerticalGutterStats(
  pixels: PixelData,
  x: number,
  startY: number,
  endY: number,
  background: [number, number, number],
  config: ColumnDetectionConfig
) {
  let empty = 0;
  let total = 0;
  let clearSegments = 0;
  const segmentHeight = Math.max(1, Math.floor((endY - startY) / config.gutterSegmentCount));

  for (let segment = 0; segment < config.gutterSegmentCount; segment += 1) {
    const segmentStart = startY + segment * segmentHeight;
    const segmentEnd = segment === config.gutterSegmentCount - 1 ? endY : Math.min(endY, segmentStart + segmentHeight);
    let segmentEmpty = 0;
    let segmentTotal = 0;

    for (let y = segmentStart; y < segmentEnd; y += 1) {
      total += 1;
      segmentTotal += 1;
      if (isPixelBackground(pixels, x, y, background)) {
        empty += 1;
        segmentEmpty += 1;
      }
    }

    if (segmentTotal > 0 && segmentEmpty / segmentTotal >= config.segmentEmptyRatioThreshold) {
      clearSegments += 1;
    }
  }

  return {
    emptyRatio: total === 0 ? 0 : empty / total,
    clearSegmentRatio: clearSegments / config.gutterSegmentCount
  };
}

function detectContentBounds(
  pixels: PixelData,
  region: NormalizedCropRect,
  background: [number, number, number],
  config: ColumnDetectionConfig
): NormalizedBoundsRect | null {
  const startX = Math.max(0, Math.floor(pixels.width * region.left));
  const endX = Math.min(pixels.width, Math.ceil(pixels.width * (1 - region.right)));
  const startY = Math.max(0, Math.floor(pixels.height * region.top));
  const endY = Math.min(pixels.height, Math.ceil(pixels.height * (1 - region.bottom)));
  const columnInk = new Array(Math.max(0, endX - startX)).fill(0) as number[];
  const rowInk = new Array(Math.max(0, endY - startY)).fill(0) as number[];

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (!isPixelBackground(pixels, x, y, background)) {
        columnInk[x - startX] += 1;
        rowInk[y - startY] += 1;
      }
    }
  }

  const minColumnInk = Math.max(2, Math.ceil((endY - startY) * config.contentProjectionMinDensity));
  const minRowInk = Math.max(2, Math.ceil((endX - startX) * config.contentProjectionMinDensity));
  const minColumnIndex = columnInk.findIndex((count) => count >= minColumnInk);
  const maxColumnIndex = findLastIndex(columnInk, (count) => count >= minColumnInk);
  const minRowIndex = rowInk.findIndex((count) => count >= minRowInk);
  const maxRowIndex = findLastIndex(rowInk, (count) => count >= minRowInk);

  if (minColumnIndex < 0 || maxColumnIndex < 0 || minRowIndex < 0 || maxRowIndex < 0) {
    return null;
  }

  return makeBoundsRect(
    (startX + minColumnIndex) / pixels.width,
    (startY + minRowIndex) / pixels.height,
    (startX + maxColumnIndex + 1) / pixels.width,
    (startY + maxRowIndex + 1) / pixels.height
  );
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index;
    }
  }

  return -1;
}

type ColumnCropPlan = {
  proposedBounds: NormalizedBoundsRect;
  finalBounds: NormalizedBoundsRect;
  finalCrop: NormalizedCropRect;
  paddingClamped: boolean;
  originalFinalBounds?: NormalizedBoundsRect;
};

type ColumnCropRepairResult = {
  status: "not-needed" | "repaired" | "failed";
  plan: ColumnCropPlan;
  failureReason?: ColumnSafetyDiagnostics["repairFailureReason"];
  expandedLeft: number;
  expandedRight: number;
  expandedTop: number;
  expandedBottom: number;
};

function buildColumnCropFromBounds(
  column: "left" | "right",
  bounds: NormalizedBoundsRect,
  boundaries: {
    outerBoundary: number;
    innerBoundary: number;
    topBoundary: number;
    bottomBoundary: number;
  },
  gutter: { left: number; right: number; center: number },
  config: ColumnDetectionConfig
): ColumnCropPlan {
  const contentLeft = bounds.left;
  const contentRight = bounds.right;
  const contentTop = bounds.top;
  const contentBottom = bounds.bottom;
  const proposedTop = contentTop - config.verticalPaddingRatio;
  const proposedBottomEdge = contentBottom + config.verticalPaddingRatio;
  const top = Math.max(0, Math.max(boundaries.topBoundary, proposedTop));
  const bottomEdge = Math.min(1, Math.min(1 - boundaries.bottomBoundary, proposedBottomEdge));

  if (column === "left") {
    const proposedLeft = contentLeft - config.outerPaddingRatio;
    const proposedRightEdge = contentRight + config.innerPaddingRatio;
    const left = Math.max(0, Math.max(boundaries.outerBoundary, proposedLeft));
    const rightEdge = Math.min(boundaries.innerBoundary, proposedRightEdge);
    const proposedBounds = makeBoundsRect(proposedLeft, proposedTop, proposedRightEdge, proposedBottomEdge);
    const finalBounds = makeBoundsRect(left, top, rightEdge, bottomEdge);
    const finalCrop = clampColumnCrop(boundsToCropFractions(finalBounds));

    return {
      proposedBounds,
      finalBounds,
      finalCrop,
      paddingClamped:
        finalBounds.left !== proposedBounds.left ||
        finalBounds.top !== proposedBounds.top ||
        finalBounds.right !== proposedBounds.right ||
        finalBounds.bottom !== proposedBounds.bottom ||
        finalBounds.right > gutter.left
    };
  }

  const proposedLeft = contentLeft - config.innerPaddingRatio;
  const proposedRightEdge = contentRight + config.outerPaddingRatio;
  const left = Math.max(boundaries.innerBoundary, proposedLeft);
  const rightEdge = Math.min(1, Math.min(boundaries.outerBoundary, proposedRightEdge));
  const proposedBounds = makeBoundsRect(proposedLeft, proposedTop, proposedRightEdge, proposedBottomEdge);
  const finalBounds = makeBoundsRect(left, top, rightEdge, bottomEdge);
  const finalCrop = clampColumnCrop(boundsToCropFractions(finalBounds));

  return {
    proposedBounds,
    finalBounds,
    finalCrop,
    paddingClamped:
      finalBounds.left !== proposedBounds.left ||
      finalBounds.top !== proposedBounds.top ||
      finalBounds.right !== proposedBounds.right ||
      finalBounds.bottom !== proposedBounds.bottom ||
      finalBounds.left < gutter.right
  };
}

function evaluateColumnSafety(
  column: "left" | "right",
  bounds: NormalizedBoundsRect,
  cropPlan: ColumnCropPlan,
  gutter: { left: number; right: number; center: number },
  config: ColumnDetectionConfig,
  repair: ColumnCropRepairResult
): ColumnSafetyDiagnostics {
  const cropBounds = cropPlan.finalBounds;
  const tolerance = config.containmentToleranceRatio;
  const cutDetails = getBoundsCutDetails(cropBounds, bounds, tolerance);
  const crossesGutter = column === "left"
    ? cropBounds.right > gutter.left + tolerance
    : cropBounds.left < gutter.right - tolerance;
  const failedCheck = getFailedSafetyCheck({
    cutsContentLeft: cutDetails.cutsContentLeft,
    cutsContentRight: cutDetails.cutsContentRight,
    cutsContentTop: cutDetails.cutsContentTop,
    cutsContentBottom: cutDetails.cutsContentBottom,
    crossesGutter
  });

  return {
    proposedCropBounds: boundsToDiagnostics(cropPlan.proposedBounds),
    contentBounds: boundsToDiagnostics(bounds),
    finalCropBounds: boundsToDiagnostics(cropBounds),
    exportCropFractions: cropFractionsToDiagnostics(cropPlan.finalCrop),
    originalFinalCropBounds: cropPlan.originalFinalBounds
      ? boundsToDiagnostics(cropPlan.originalFinalBounds)
      : undefined,
    gutter,
    gutterSafetyPadding: config.gutterSafetyPaddingRatio,
    outerPadding: config.outerPaddingRatio,
    innerPadding: config.innerPaddingRatio,
    contentInsideCrop: cutDetails.contains,
    crossesGutter,
    cutsContentLeft: cutDetails.cutsContentLeft,
    cutsContentRight: cutDetails.cutsContentRight,
    cutsContentTop: cutDetails.cutsContentTop,
    cutsContentBottom: cutDetails.cutsContentBottom,
    paddingClamped: cropPlan.paddingClamped,
    repairAttempted: repair.status !== "not-needed",
    repairStatus: repair.status,
    repairFailureReason: repair.failureReason,
    overflowLeft: Math.max(0, cropBounds.left - bounds.left),
    overflowRight: Math.max(0, bounds.right - cropBounds.right),
    overflowTop: Math.max(0, cropBounds.top - bounds.top),
    overflowBottom: Math.max(0, bounds.bottom - cropBounds.bottom),
    expandedLeft: repair.expandedLeft,
    expandedRight: repair.expandedRight,
    expandedTop: repair.expandedTop,
    expandedBottom: repair.expandedBottom,
    failedCheck
  };
}

function repairColumnCropToContainContent(
  column: "left" | "right",
  bounds: NormalizedBoundsRect,
  cropPlan: ColumnCropPlan,
  boundaries: {
    outerBoundary: number;
    topBoundary: number;
    bottomBoundary: number;
  },
  gutter: { left: number; right: number; center: number },
  config: ColumnDetectionConfig
): ColumnCropRepairResult {
  const tolerance = config.containmentToleranceRatio;
  const initialCuts = getBoundsCutDetails(cropPlan.finalBounds, bounds, tolerance);
  const initialCrossesGutter = column === "left"
    ? cropPlan.finalBounds.right > gutter.left + tolerance
    : cropPlan.finalBounds.left < gutter.right - tolerance;

  if (initialCuts.contains && !initialCrossesGutter) {
    return {
      status: "not-needed",
      plan: cropPlan,
      expandedLeft: 0,
      expandedRight: 0,
      expandedTop: 0,
      expandedBottom: 0
    };
  }

  const pad = config.repairSafetyPaddingRatio;
  const original = cropPlan.finalBounds;
  const proposedLeft = Math.min(original.left, bounds.left - pad);
  const proposedTop = Math.min(original.top, bounds.top - pad);
  const proposedRight = Math.max(original.right, bounds.right + pad);
  const proposedBottom = Math.max(original.bottom, bounds.bottom + pad);
  const repairedBounds = makeBoundsRect(
    Math.max(boundaries.outerBoundary, proposedLeft),
    Math.max(boundaries.topBoundary, proposedTop),
    column === "left"
      ? Math.min(gutter.left, proposedRight)
      : Math.min(boundaries.outerBoundary, proposedRight),
    Math.min(1 - boundaries.bottomBoundary, proposedBottom)
  );
  const finalBounds = column === "right"
    ? makeBoundsRect(
      Math.max(gutter.right, proposedLeft),
      repairedBounds.top,
      repairedBounds.right,
      repairedBounds.bottom
    )
    : repairedBounds;
  const finalCrop = clampColumnCrop(boundsToCropFractions(finalBounds));
  const repairedPlan: ColumnCropPlan = {
    ...cropPlan,
    finalBounds,
    finalCrop,
    originalFinalBounds: cropPlan.originalFinalBounds ?? cropPlan.finalBounds,
    paddingClamped: true
  };
  const repairedCuts = getBoundsCutDetails(finalBounds, bounds, tolerance);
  const crossesGutter = column === "left"
    ? finalBounds.right > gutter.left + tolerance
    : finalBounds.left < gutter.right - tolerance;
  const invalidCrop = finalBounds.right - finalBounds.left <= 0.05 || finalBounds.bottom - finalBounds.top <= 0.05;
  const expandedLeft = Math.max(0, original.left - finalBounds.left);
  const expandedRight = Math.max(0, finalBounds.right - original.right);
  const expandedTop = Math.max(0, original.top - finalBounds.top);
  const expandedBottom = Math.max(0, finalBounds.bottom - original.bottom);

  if (invalidCrop) {
    return {
      status: "failed",
      plan: repairedPlan,
      failureReason: "invalid-crop-after-repair",
      expandedLeft,
      expandedRight,
      expandedTop,
      expandedBottom
    };
  }

  if (crossesGutter) {
    return {
      status: "failed",
      plan: repairedPlan,
      failureReason: "would-cross-gutter",
      expandedLeft,
      expandedRight,
      expandedTop,
      expandedBottom
    };
  }

  if (!repairedCuts.contains) {
    return {
      status: "failed",
      plan: repairedPlan,
      failureReason:
        column === "left" && repairedCuts.cutsContentRight
          ? "content-too-close-to-gutter"
          : column === "right" && repairedCuts.cutsContentLeft
            ? "content-too-close-to-gutter"
            : "content-outside-page",
      expandedLeft,
      expandedRight,
      expandedTop,
      expandedBottom
    };
  }

  return {
    status: "repaired",
    plan: repairedPlan,
    expandedLeft,
    expandedRight,
    expandedTop,
    expandedBottom
  };
}

function refineColumnCropForTextSafety(
  column: "left" | "right",
  bounds: NormalizedBoundsRect,
  cropPlan: ColumnCropPlan,
  boundaries: {
    outerBoundary: number;
    topBoundary: number;
    bottomBoundary: number;
  },
  gutter: { left: number; right: number; center: number },
  config: ColumnDetectionConfig
): ColumnCropPlan {
  const innerPadding = config.innerTextSafetyPaddingRatio;
  const outerPadding = config.outerTextSafetyPaddingRatio;
  const verticalPadding = config.verticalTextSafetyPaddingRatio;
  const current = cropPlan.finalBounds;
  const left = column === "left"
    ? Math.max(boundaries.outerBoundary, Math.min(current.left, bounds.left - outerPadding))
    : Math.max(gutter.right, Math.min(current.left, bounds.left - innerPadding));
  const right = column === "left"
    ? Math.min(gutter.left, Math.max(current.right, bounds.right + innerPadding))
    : Math.min(boundaries.outerBoundary, Math.max(current.right, bounds.right + outerPadding));
  const top = Math.max(boundaries.topBoundary, Math.min(current.top, bounds.top - verticalPadding));
  const bottom = Math.min(1 - boundaries.bottomBoundary, Math.max(current.bottom, bounds.bottom + verticalPadding));
  const finalBounds = makeBoundsRect(left, top, right, bottom);

  return {
    ...cropPlan,
    finalBounds,
    finalCrop: clampColumnCrop(boundsToCropFractions(finalBounds)),
    originalFinalBounds: cropPlan.originalFinalBounds ?? cropPlan.finalBounds,
    paddingClamped: cropPlan.paddingClamped || left !== bounds.left - outerPadding || right !== bounds.right + outerPadding
  };
}

function getFailedSafetyCheck(checks: {
  cutsContentLeft: boolean;
  cutsContentRight: boolean;
  cutsContentTop: boolean;
  cutsContentBottom: boolean;
  crossesGutter: boolean;
}): string | undefined {
  if (checks.crossesGutter) return "crosses-gutter";
  if (checks.cutsContentLeft) return "cuts-content-left";
  if (checks.cutsContentRight) return "cuts-content-right";
  if (checks.cutsContentTop) return "cuts-content-top";
  if (checks.cutsContentBottom) return "cuts-content-bottom";
  return undefined;
}

function getBandInkRatio(
  pixels: PixelData,
  startX: number,
  endX: number,
  startY: number,
  endY: number,
  background: [number, number, number]
): number {
  let ink = 0;
  let total = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      total += 1;
      if (!isPixelBackground(pixels, x, y, background)) {
        ink += 1;
      }
    }
  }

  return total === 0 ? 0 : ink / total;
}

function isPixelBackground(
  pixels: PixelData,
  x: number,
  y: number,
  background: [number, number, number]
): boolean {
  const index = (y * pixels.width + x) * 4;
  return isBackgroundPixel(
    pixels.data[index],
    pixels.data[index + 1],
    pixels.data[index + 2],
    pixels.data[index + 3],
    background
  );
}

function clampColumnCrop(crop: NormalizedCropRect): NormalizedCropRect {
  return {
    left: Math.min(0.9, Math.max(0, crop.left)),
    top: Math.min(0.35, Math.max(0, crop.top)),
    right: Math.min(0.9, Math.max(0, crop.right)),
    bottom: Math.min(0.35, Math.max(0, crop.bottom))
  };
}

function estimateColumnGain(crop: NormalizedCropRect): number {
  const remainingArea = Math.max(0.05, (1 - crop.left - crop.right) * (1 - crop.top - crop.bottom));
  return Math.round((1 / remainingArea - 1) * 100);
}
