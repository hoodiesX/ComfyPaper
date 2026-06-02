import type {
  ColumnCrop,
  ColumnPaginationMode,
  NormalizedCropRect,
  ReadingTile,
  TileBreakDetail,
  TileBreakKind,
  TileContinuationMode
} from "@/types/pdf";
import type { ReadingOutputProfile } from "./readingProfiles";

export type DrawPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

export type ConsecutiveTileValidation = {
  overlapRatio: number;
  hasGap: boolean;
  duplicateBoundaryLikely: boolean;
  continuityRepairApplied: boolean;
  excessiveOverlap: boolean;
};

type ColumnPaginationPlan = {
  mode: ColumnPaginationMode;
  reason: "no-vertical-break-needed" | "no-safe-break-found" | "valid-breaks" | "last-resort";
  breaks: number[];
  details: TileBreakDetail[];
  breakCoverageComplete: boolean;
  singleColumnScale: number;
};

export function createReadingTilesForColumns(
  columns: ColumnCrop[],
  profile: ReadingOutputProfile
): ReadingTile[] {
  return columns.flatMap((column) => createReadingTilesForColumn(column, profile));
}

export function createReadingTilesForColumn(
  column: ColumnCrop,
  profile: ReadingOutputProfile
): ReadingTile[] {
  const columnWidth = 1 - column.crop.left - column.crop.right;
  const columnHeight = 1 - column.crop.top - column.crop.bottom;
  const baseTileHeight = columnWidth / profile.aspectRatio;
  const profileLimitedTileHeight = columnHeight * profile.maxSourceSliceHeightRatio;
  const idealTileHeight = Math.max(
    columnHeight * profile.minTileHeightRatio,
    Math.min(baseTileHeight, profileLimitedTileHeight)
  );
  const widthFitScale = (1 - profile.outputSideMarginRatio * 2) / Math.max(columnWidth, 0.001);
  const desiredTileCount = column.outputTileCount === 1 && column.breakStrategy === "smart"
    ? 1
    : Math.min(
    profile.maxTilesPerColumn,
    profile.maxOutputPagesPerSourcePage,
    Math.max(1, Math.ceil(columnHeight / idealTileHeight), (column.breakFractions?.length ?? 0) + 1)
    );
  const pagination = getColumnPaginationPlan(column, profile, desiredTileCount);
  const breaks = pagination.breaks;
  const boundaries = [column.crop.top, ...breaks, 1 - column.crop.bottom];
  const tileCount = boundaries.length - 1;
  const breakPolicies = getBreakPolicies(column, breaks, tileCount);
  const continuityPlans = breakPolicies.map((policy) =>
    planContinuation(policy.breakKind, policy.continuationMode, columnHeight, profile)
  );

  return Array.from({ length: tileCount }, (_, index) => {
    const rawTop = boundaries[index];
    const rawBottom = boundaries[index + 1];
    const continuityPlan = index === 0 ? undefined : continuityPlans[index - 1];
    const previousBreakDetail = index === 0 ? undefined : pagination.details[index - 1];
    const nextBreakDetail = pagination.details[index];
    const overlapFromPreviousBreak = continuityPlan?.overlapAfterRepair ?? 0;
    // Only the following tile reaches upward for continuity. The previous tile
    // ends at the selected break, which avoids duplicated boundary blocks.
    const corridorStart = nextBreakDetail?.previousFinalBottom ?? rawBottom;
    const corridorEnd = previousBreakDetail?.nextFinalTop ?? rawTop;
    const top = index === 0
      ? rawTop
      : Math.max(column.crop.top, corridorEnd - overlapFromPreviousBreak);
    const bottomEdge = index === tileCount - 1 ? rawBottom : Math.min(1 - column.crop.bottom, corridorStart);
    const policy = index === 0
      ? { breakKind: "clean-whitespace" as const, continuationMode: "clean-non-overlap" as const }
      : breakPolicies[index - 1] ?? { breakKind: "clean-whitespace" as const, continuationMode: "clean-non-overlap" as const };
    const continuationMode = policy.continuationMode;
    const overlapRatio = index === 0 ? 0 : (continuityPlan?.overlapAfterRepair ?? 0) / columnHeight;
    const rawCrop = clampTileCrop(
      {
        left: Math.max(0, column.crop.left - profile.paddingRatio),
        right: Math.max(0, column.crop.right - profile.paddingRatio),
        top,
        bottom: Math.max(0, 1 - bottomEdge)
      },
      column.crop
    );
    const { crop, applied: glyphSafetyApplied } = applyHorizontalGlyphSafety(rawCrop, column.crop, profile);

    return {
      sourcePageNumber: column.sourcePageNumber,
      column: column.column,
      tileIndex: index + 1,
      tileCount,
      crop,
      outputProfileId: profile.id,
      label: `Page ${column.sourcePageNumber} · ${column.column} column · tile ${index + 1} of ${tileCount}`,
      paginationMode: pagination.mode,
      paginationReason: pagination.reason,
      outputTileCount: tileCount,
      verticalBreakCount: breaks.length,
      breakCoverageComplete: pagination.breakCoverageComplete,
      singleColumnScale: pagination.singleColumnScale,
      widthFitScale: pagination.mode === "single-column-page" ? pagination.singleColumnScale : widthFitScale,
      contentFillRatio: getContentFillRatio(rawCrop, profile),
      breakStrategy: column.breakStrategy ?? (column.breakFractions ? "smart" : "fallback"),
      breakKind: policy.breakKind,
      continuationMode,
      overlapBeforeRepair: continuityPlan?.overlapBeforeRepair ?? 0,
      overlapAfterRepair: continuityPlan?.overlapAfterRepair ?? 0,
      estimatedLineHeight: continuityPlan?.estimatedLineHeight ?? estimateLineHeight(columnHeight),
      duplicateBoundaryLikely: continuityPlan?.duplicateBoundaryLikely ?? false,
      continuityRepairApplied: continuityPlan?.continuityRepairApplied ?? false,
      glyphSafetyApplied,
      boundaryRepaired: previousBreakDetail?.boundaryRepaired,
      repairDirection: previousBreakDetail?.repairDirection,
      topBoundarySafe: index === 0 ? true : previousBreakDetail?.bottomBoundarySafe,
      bottomBoundarySafe: index === tileCount - 1 ? true : nextBreakDetail?.topBoundarySafe,
      overlapRatio
    };
  });
}

function getColumnPaginationPlan(
  column: ColumnCrop,
  profile: ReadingOutputProfile,
  desiredTileCount: number
): ColumnPaginationPlan {
  const columnWidth = 1 - column.crop.left - column.crop.right;
  const columnHeight = 1 - column.crop.top - column.crop.bottom;
  const singleColumnScale = Math.min(
    profile.aspectRatio / Math.max(columnWidth / columnHeight, 0.001),
    1
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

  if (requestedBreaks.length === 0) {
    if (desiredTileCount > 1) {
      const lastResortBreaks = Array.from({ length: desiredTileCount - 1 }, (_, index) =>
        column.crop.top + (columnHeight * (index + 1)) / desiredTileCount
      );
      return {
        mode: "multi-tile-last-resort",
        reason: "last-resort",
        breaks: lastResortBreaks,
        details: lastResortBreaks.map((position) => makeLastResortBreakDetail(position)),
        breakCoverageComplete: true,
        singleColumnScale
      };
    }

    return {
      mode: "single-column-page",
      reason: "no-vertical-break-needed",
      breaks: [],
      details: [],
      breakCoverageComplete,
      singleColumnScale
    };
  }

  if (!validDetails) {
    return {
      mode: "multi-tile-last-resort",
      reason: "last-resort",
      breaks: requestedBreaks,
      details: requestedBreaks.map((position, index) => details[index] ?? makeLastResortBreakDetail(position)),
      breakCoverageComplete: true,
      singleColumnScale
    };
  }

  return {
    mode: "multi-tile-safe",
    reason: "valid-breaks",
    breaks: requestedBreaks,
    details,
    breakCoverageComplete,
    singleColumnScale
  };
}

function makeLastResortBreakDetail(position: number): TileBreakDetail {
  return {
    position,
    originalPosition: position,
    inkDensity: 1,
    breakKind: "fallback-dense",
    originalBreakKind: "fallback-dense",
    continuationMode: "emergency-overlap",
    breakSource: "fallback",
    lastResortFallback: true,
    topBoundarySafe: false,
    bottomBoundarySafe: false,
    previousFinalBottom: position,
    nextFinalTop: position,
    corridorHeight: 0,
    finalBoundaryValid: false,
    rejectionReasonIfInvalid: "no-safe-width-fit-break"
  };
}

export function calculateDrawPlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): DrawPlacement {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
    scale
  };
}

export function calculateProfileDrawPlacement(
  sourceWidth: number,
  sourceHeight: number,
  profile: ReadingOutputProfile
): DrawPlacement {
  const targetWidth = profile.pageWidth * (1 - profile.outputSideMarginRatio * 2);
  const targetHeight = profile.pageHeight * (1 - profile.outputTopMarginRatio - profile.outputBottomMarginRatio);
  const placement = calculateDrawPlacement(sourceWidth, sourceHeight, targetWidth, targetHeight);

  return {
    ...placement,
    x: profile.pageWidth * profile.outputSideMarginRatio + placement.x,
    y: profile.pageHeight * profile.outputBottomMarginRatio + placement.y
  };
}

function getContentFillRatio(crop: NormalizedCropRect, profile: ReadingOutputProfile): number {
  const sourceWidth = 1 - crop.left - crop.right;
  const sourceHeight = 1 - crop.top - crop.bottom;
  const targetWidth = 1 - profile.outputSideMarginRatio * 2;
  const targetHeight = 1 - profile.outputTopMarginRatio - profile.outputBottomMarginRatio;
  const placement = calculateDrawPlacement(sourceWidth, sourceHeight, targetWidth, targetHeight);

  return (placement.width * placement.height) / (targetWidth * targetHeight);
}

export function validateConsecutiveTiles(
  previousTile: ReadingTile,
  nextTile: ReadingTile,
  maxOverlapRatio = 0.06
): ConsecutiveTileValidation {
  const previousBottom = 1 - previousTile.crop.bottom;
  const nextTop = nextTile.crop.top;
  const overlap = Math.max(0, previousBottom - nextTop);
  const overlapRatio = nextTile.overlapRatio ?? 0;
  const estimatedLineHeight = nextTile.estimatedLineHeight ?? 0.022;
  const duplicateBoundaryLikely = overlap >= estimatedLineHeight || Boolean(nextTile.duplicateBoundaryLikely);

  return {
    overlapRatio,
    hasGap: nextTop > previousBottom,
    duplicateBoundaryLikely,
    continuityRepairApplied: Boolean(nextTile.continuityRepairApplied),
    excessiveOverlap: overlapRatio > maxOverlapRatio || overlap > maxOverlapRatio
  };
}

export function validateNoDuplicateBoundaryLine(
  previousTile: ReadingTile,
  nextTile: ReadingTile,
  maxOverlapRatio = 0.018
): ConsecutiveTileValidation {
  return validateConsecutiveTiles(previousTile, nextTile, maxOverlapRatio);
}

function planContinuation(
  breakKind: TileBreakKind,
  continuationMode: TileContinuationMode,
  columnHeight: number,
  profile: ReadingOutputProfile
) {
  const estimatedLineHeight = estimateLineHeight(columnHeight);
  const overlapBeforeRepair = columnHeight * getOverlapRatioForMode(continuationMode, profile, columnHeight);
  const maxAllowedOverlap = Math.min(
    columnHeight * profile.maxOverlapRatio,
    estimatedLineHeight * getMaxLineOverlapMultiplier(breakKind)
  );
  const overlapAfterRepair = Math.min(overlapBeforeRepair, maxAllowedOverlap);
  const duplicateBoundaryLikely = overlapBeforeRepair >= estimatedLineHeight;

  return {
    overlapBeforeRepair,
    overlapAfterRepair,
    estimatedLineHeight,
    duplicateBoundaryLikely,
    continuityRepairApplied: overlapAfterRepair < overlapBeforeRepair
  };
}

function getBreakPolicies(
  column: ColumnCrop,
  breaks: number[],
  tileCount: number
): Array<{ breakKind: TileBreakKind; continuationMode: TileContinuationMode }> {
  return Array.from({ length: Math.max(0, tileCount - 1) }, (_, index) => {
    const detail = column.breakDetails?.[index];
    if (detail?.continuationMode) {
      return {
        breakKind: detail.breakKind,
        continuationMode: detail.continuationMode
      };
    }
    if (column.breakStrategy === "fallback" || !column.breakFractions) {
      return { breakKind: "fallback-dense", continuationMode: "emergency-overlap" };
    }
    return breaks.length > 0
      ? { breakKind: "clean-whitespace", continuationMode: "clean-non-overlap" }
      : { breakKind: "fallback-dense", continuationMode: "emergency-overlap" };
  });
}

function getOverlapRatioForMode(
  mode: TileContinuationMode,
  profile: ReadingOutputProfile,
  columnHeight: number
): number {
  const maxVisibleOverlapRatio = estimateLineHeight(columnHeight) / columnHeight;
  if (mode === "clean-non-overlap") return 0;
  if (mode === "micro-overlap") return 0;
  return Math.min(profile.emergencyOverlapRatio, profile.maxOverlapRatio, maxVisibleOverlapRatio * 0.75);
}

function getMaxLineOverlapMultiplier(breakKind: TileBreakKind): number {
  if (breakKind === "clean-whitespace" || breakKind === "paragraph-gap") return 0;
  if (breakKind === "line-gap") return 0.35;
  return 0.75;
}

function estimateLineHeight(columnHeight: number): number {
  return columnHeight * 0.022;
}

function applyHorizontalGlyphSafety(
  crop: NormalizedCropRect,
  columnCrop: NormalizedCropRect,
  profile: ReadingOutputProfile
): { crop: NormalizedCropRect; applied: boolean } {
  const isLeftColumn = columnCrop.left < columnCrop.right;
  const safety = profile.horizontalGlyphSafetyRatio + profile.exportClipSafetyRatio;
  const pageCenterGuard = 0.5;

  if (isLeftColumn) {
    const currentRightEdge = 1 - crop.right;
    const expandedRightEdge = Math.min(pageCenterGuard, currentRightEdge + safety);
    const right = Math.max(0, 1 - expandedRightEdge);
    return {
      crop: { ...crop, right },
      applied: right !== crop.right
    };
  }

  const left = Math.max(pageCenterGuard, crop.left - safety);
  return {
    crop: { ...crop, left },
    applied: left !== crop.left
  };
}

function clampTileCrop(crop: NormalizedCropRect, columnCrop: NormalizedCropRect): NormalizedCropRect {
  const isLeftColumn = columnCrop.left < columnCrop.right;
  const rawLeft = Math.min(Math.max(0, crop.left), 0.95);
  const rawRight = Math.min(Math.max(0, crop.right), 0.95 - rawLeft);
  const top = Math.min(Math.max(0, crop.top), 0.95);
  const bottom = Math.min(Math.max(0, crop.bottom), 0.95 - top);

  // Allow padding toward the outer page margin, but never across the gutter-facing
  // boundary established by column detection. This prevents neighboring-column bleed.
  const left = isLeftColumn ? Math.min(rawLeft, columnCrop.left) : Math.max(rawLeft, columnCrop.left);
  const right = isLeftColumn ? Math.max(rawRight, columnCrop.right) : Math.min(rawRight, columnCrop.right);

  return {
    left,
    right,
    top,
    bottom
  };
}
