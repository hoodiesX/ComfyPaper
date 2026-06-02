import type { ReadingOutputProfileId } from "@/types/pdf";
import type { ReadingPresetId } from "@/lib/presets/presetTypes";

export type ReadingOutputProfile = {
  id: ReadingOutputProfileId;
  label: string;
  pageWidth: number;
  pageHeight: number;
  aspectRatio: number;
  paddingRatio: number;
  overlapRatio: number;
  cleanBreakOverlapRatio: number;
  microOverlapRatio: number;
  emergencyOverlapRatio: number;
  breakSearchWindowRatio: number;
  breakBandHeightRatio: number;
  rowSafetyBandRatio: number;
  rowSafetySearchWindowRatio: number;
  maxBoundaryInkDensity: number;
  profileSmoothingRadius: number;
  minWhitespaceBandHeightRatio: number;
  minTileHeightRatio: number;
  finalBoundaryGuardBandRatio: number;
  finalBoundaryAdjacentBandRatio: number;
  maxFinalBoundaryInkDensity: number;
  minWhitespaceCorridorHeightRatio: number;
  minWhitespaceCorridorToLineHeightRatio: number;
  maxCorridorInkDensity: number;
  maxAdjacentGuardInkDensity: number;
  corridorGuardBandToLineHeightRatio: number;
  minAbsoluteCorridorHeightRatio: number;
  maxBreakInkDensity: number;
  maxOverlapRatio: number;
  horizontalGlyphSafetyRatio: number;
  exportClipSafetyRatio: number;
  minFinalTileRatio: number;
  maxTilesPerColumn: number;
  minSingleColumnScale: number;
  preferSingleColumnWhenUncertain: boolean;
  minReadableScale: number;
  targetReadableScale: number;
  minContentFillRatio: number;
  maxMiddlePageEmptyRatio: number;
  minRowsPerOutputPage: number;
  minRowsPerMiddlePage: number;
  minRowsPerFinalPage: number;
  targetRowsPerSlice: number;
  maxRowsPerSlice: number;
  minRowsPerSlice: number;
  maxAllowedShortFinalPageRatio: number;
  allowNaturalShortFinalPage: boolean;
  preferWidthFitForTextHeavyColumns: boolean;
  maxSourceSliceHeightRatio: number;
  maxOutputPagesPerSourcePage: number;
  preferShorterSlices: boolean;
  allowMoreOutputPages: boolean;
  fullColumnFallbackAllowed: boolean;
  firstPagePreservePolicy: "balanced" | "preserve-when-uncertain" | "strict-preserve";
  profileAggressiveness: "balanced" | "aggressive" | "tablet" | "conservative";
  minFinalPageFillRatio: number;
  preferTextLayerBreaks: boolean;
  outputTopMarginRatio: number;
  outputBottomMarginRatio: number;
  outputSideMarginRatio: number;
};

export const READING_OUTPUT_PROFILES: Record<ReadingOutputProfileId, ReadingOutputProfile> = {
  "academic-reading": {
    id: "academic-reading",
    label: "Academic Reading",
    pageWidth: 612,
    pageHeight: 792,
    aspectRatio: 612 / 792,
    paddingRatio: 0.035,
    overlapRatio: 0.014,
    cleanBreakOverlapRatio: 0,
    microOverlapRatio: 0,
    emergencyOverlapRatio: 0.002,
    breakSearchWindowRatio: 0.08,
    breakBandHeightRatio: 0.024,
    rowSafetyBandRatio: 0.012,
    rowSafetySearchWindowRatio: 0.1,
    maxBoundaryInkDensity: 0.045,
    profileSmoothingRadius: 2,
    minWhitespaceBandHeightRatio: 0.008,
    minTileHeightRatio: 0.24,
    maxBreakInkDensity: 0.055,
    maxOverlapRatio: 0.002,
    finalBoundaryGuardBandRatio: 0.016,
    finalBoundaryAdjacentBandRatio: 0.01,
    maxFinalBoundaryInkDensity: 0.024,
    minWhitespaceCorridorHeightRatio: 0.012,
    minWhitespaceCorridorToLineHeightRatio: 0.55,
    maxCorridorInkDensity: 0.024,
    maxAdjacentGuardInkDensity: 0.032,
    corridorGuardBandToLineHeightRatio: 0.32,
    minAbsoluteCorridorHeightRatio: 0.012,
    horizontalGlyphSafetyRatio: 0.006,
    exportClipSafetyRatio: 0.004,
    minFinalTileRatio: 0.42,
    maxTilesPerColumn: 4,
    minSingleColumnScale: 0.62,
    preferSingleColumnWhenUncertain: true,
    minReadableScale: 0.7,
    targetReadableScale: 0.86,
    minContentFillRatio: 0.52,
    maxMiddlePageEmptyRatio: 0.48,
    minRowsPerOutputPage: 8,
    minRowsPerMiddlePage: 10,
    minRowsPerFinalPage: 5,
    targetRowsPerSlice: 18,
    maxRowsPerSlice: 24,
    minRowsPerSlice: 7,
    maxAllowedShortFinalPageRatio: 0.32,
    allowNaturalShortFinalPage: true,
    preferWidthFitForTextHeavyColumns: true,
    maxSourceSliceHeightRatio: 0.62,
    maxOutputPagesPerSourcePage: 10,
    preferShorterSlices: false,
    allowMoreOutputPages: false,
    fullColumnFallbackAllowed: true,
    firstPagePreservePolicy: "preserve-when-uncertain",
    profileAggressiveness: "balanced",
    minFinalPageFillRatio: 0.28,
    preferTextLayerBreaks: true,
    outputTopMarginRatio: 0.045,
    outputBottomMarginRatio: 0.045,
    outputSideMarginRatio: 0.04
  },
  "kindle-reading": {
    id: "kindle-reading",
    label: "Kindle / E-reader",
    pageWidth: 560,
    pageHeight: 748,
    aspectRatio: 560 / 748,
    paddingRatio: 0.026,
    overlapRatio: 0.016,
    cleanBreakOverlapRatio: 0,
    microOverlapRatio: 0,
    emergencyOverlapRatio: 0.002,
    breakSearchWindowRatio: 0.09,
    breakBandHeightRatio: 0.026,
    rowSafetyBandRatio: 0.012,
    rowSafetySearchWindowRatio: 0.11,
    maxBoundaryInkDensity: 0.045,
    profileSmoothingRadius: 2,
    minWhitespaceBandHeightRatio: 0.008,
    minTileHeightRatio: 0.22,
    maxBreakInkDensity: 0.055,
    maxOverlapRatio: 0.002,
    finalBoundaryGuardBandRatio: 0.016,
    finalBoundaryAdjacentBandRatio: 0.01,
    maxFinalBoundaryInkDensity: 0.024,
    minWhitespaceCorridorHeightRatio: 0.012,
    minWhitespaceCorridorToLineHeightRatio: 0.55,
    maxCorridorInkDensity: 0.024,
    maxAdjacentGuardInkDensity: 0.032,
    corridorGuardBandToLineHeightRatio: 0.32,
    minAbsoluteCorridorHeightRatio: 0.012,
    horizontalGlyphSafetyRatio: 0.006,
    exportClipSafetyRatio: 0.004,
    minFinalTileRatio: 0.38,
    maxTilesPerColumn: 8,
    minSingleColumnScale: 0.72,
    preferSingleColumnWhenUncertain: false,
    minReadableScale: 0.8,
    targetReadableScale: 1.12,
    minContentFillRatio: 0.54,
    maxMiddlePageEmptyRatio: 0.52,
    minRowsPerOutputPage: 8,
    minRowsPerMiddlePage: 10,
    minRowsPerFinalPage: 6,
    targetRowsPerSlice: 20,
    maxRowsPerSlice: 28,
    minRowsPerSlice: 10,
    maxAllowedShortFinalPageRatio: 0.34,
    allowNaturalShortFinalPage: true,
    preferWidthFitForTextHeavyColumns: true,
    maxSourceSliceHeightRatio: 0.66,
    maxOutputPagesPerSourcePage: 12,
    preferShorterSlices: true,
    allowMoreOutputPages: true,
    fullColumnFallbackAllowed: false,
    firstPagePreservePolicy: "strict-preserve",
    profileAggressiveness: "aggressive",
    minFinalPageFillRatio: 0.24,
    preferTextLayerBreaks: true,
    outputTopMarginRatio: 0.032,
    outputBottomMarginRatio: 0.032,
    outputSideMarginRatio: 0.024
  },
  "kindle-ereader": undefined as unknown as ReadingOutputProfile,
  "ipad-tablet": {
    id: "ipad-tablet",
    label: "iPad / Tablet",
    pageWidth: 768,
    pageHeight: 1024,
    aspectRatio: 768 / 1024,
    paddingRatio: 0.04,
    overlapRatio: 0.014,
    cleanBreakOverlapRatio: 0,
    microOverlapRatio: 0,
    emergencyOverlapRatio: 0.002,
    breakSearchWindowRatio: 0.07,
    breakBandHeightRatio: 0.024,
    rowSafetyBandRatio: 0.012,
    rowSafetySearchWindowRatio: 0.09,
    maxBoundaryInkDensity: 0.045,
    profileSmoothingRadius: 2,
    minWhitespaceBandHeightRatio: 0.008,
    minTileHeightRatio: 0.24,
    maxBreakInkDensity: 0.055,
    maxOverlapRatio: 0.002,
    finalBoundaryGuardBandRatio: 0.016,
    finalBoundaryAdjacentBandRatio: 0.01,
    maxFinalBoundaryInkDensity: 0.024,
    minWhitespaceCorridorHeightRatio: 0.012,
    minWhitespaceCorridorToLineHeightRatio: 0.55,
    maxCorridorInkDensity: 0.024,
    maxAdjacentGuardInkDensity: 0.032,
    corridorGuardBandToLineHeightRatio: 0.32,
    minAbsoluteCorridorHeightRatio: 0.012,
    horizontalGlyphSafetyRatio: 0.006,
    exportClipSafetyRatio: 0.004,
    minFinalTileRatio: 0.42,
    maxTilesPerColumn: 4,
    minSingleColumnScale: 0.62,
    preferSingleColumnWhenUncertain: true,
    minReadableScale: 0.72,
    targetReadableScale: 0.84,
    minContentFillRatio: 0.54,
    maxMiddlePageEmptyRatio: 0.46,
    minRowsPerOutputPage: 9,
    minRowsPerMiddlePage: 11,
    minRowsPerFinalPage: 5,
    targetRowsPerSlice: 22,
    maxRowsPerSlice: 28,
    minRowsPerSlice: 8,
    maxAllowedShortFinalPageRatio: 0.3,
    allowNaturalShortFinalPage: true,
    preferWidthFitForTextHeavyColumns: true,
    maxSourceSliceHeightRatio: 0.7,
    maxOutputPagesPerSourcePage: 8,
    preferShorterSlices: false,
    allowMoreOutputPages: false,
    fullColumnFallbackAllowed: true,
    firstPagePreservePolicy: "preserve-when-uncertain",
    profileAggressiveness: "tablet",
    minFinalPageFillRatio: 0.3,
    preferTextLayerBreaks: true,
    outputTopMarginRatio: 0.045,
    outputBottomMarginRatio: 0.045,
    outputSideMarginRatio: 0.04
  }
};

READING_OUTPUT_PROFILES["kindle-ereader"] = READING_OUTPUT_PROFILES["kindle-reading"];

export function getOutputProfileForPreset(presetId: ReadingPresetId): ReadingOutputProfile {
  if (presetId === "kindle-ereader") {
    return READING_OUTPUT_PROFILES["kindle-reading"];
  }

  if (presetId === "ipad-tablet") {
    return READING_OUTPUT_PROFILES["ipad-tablet"];
  }

  return READING_OUTPUT_PROFILES["academic-reading"];
}
