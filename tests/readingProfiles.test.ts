import { describe, expect, it } from "vitest";
import { getOutputProfileForPreset, READING_OUTPUT_PROFILES } from "@/lib/pdf/readingProfiles";

describe("reading output profiles", () => {
  it("has valid profile dimensions and aspect ratios", () => {
    for (const profile of Object.values(READING_OUTPUT_PROFILES)) {
      expect(profile.pageWidth).toBeGreaterThan(500);
      expect(profile.pageHeight).toBeGreaterThan(profile.pageWidth);
      expect(profile.aspectRatio).toBeCloseTo(profile.pageWidth / profile.pageHeight, 5);
      expect(profile.overlapRatio).toBeGreaterThan(0);
      expect(profile.overlapRatio).toBeLessThan(0.08);
      expect(profile.cleanBreakOverlapRatio).toBe(0);
      expect(profile.microOverlapRatio).toBe(0);
      expect(profile.emergencyOverlapRatio).toBeGreaterThanOrEqual(0);
      expect(profile.emergencyOverlapRatio).toBeLessThanOrEqual(profile.maxOverlapRatio);
      expect(profile.maxOverlapRatio).toBeLessThanOrEqual(0.002);
      expect(profile.maxFinalBoundaryInkDensity).toBeLessThan(profile.maxBoundaryInkDensity);
      expect(profile.minWhitespaceCorridorHeightRatio).toBeGreaterThan(0);
      expect(profile.minWhitespaceCorridorToLineHeightRatio).toBeGreaterThanOrEqual(0.45);
      expect(profile.maxCorridorInkDensity).toBeLessThan(0.03);
      expect(profile.maxAdjacentGuardInkDensity).toBeLessThanOrEqual(0.035);
      expect(profile.corridorGuardBandToLineHeightRatio).toBeGreaterThan(0.2);
      expect(profile.minSingleColumnScale).toBeGreaterThan(0.5);
      if (profile.id === "kindle-reading") {
        expect(profile.preferSingleColumnWhenUncertain).toBe(false);
      } else {
        expect(profile.preferSingleColumnWhenUncertain).toBe(true);
      }
      expect(profile.targetReadableScale).toBeGreaterThan(profile.minReadableScale);
      expect(profile.minContentFillRatio).toBeGreaterThan(0);
      expect(profile.preferWidthFitForTextHeavyColumns).toBe(true);
      expect(profile.maxBoundaryInkDensity).toBeLessThan(profile.maxBreakInkDensity);
      expect(profile.rowSafetyBandRatio).toBeGreaterThan(0);
      expect(profile.rowSafetySearchWindowRatio).toBeGreaterThan(0);
      expect(profile.minTileHeightRatio).toBeGreaterThan(0.2);
      expect(profile.horizontalGlyphSafetyRatio).toBeGreaterThan(0);
      expect(profile.exportClipSafetyRatio).toBeGreaterThan(0);
      expect(profile.outputTopMarginRatio).toBeGreaterThanOrEqual(profile.id === "kindle-reading" ? 0.03 : 0.031);
      expect(profile.outputBottomMarginRatio).toBeGreaterThanOrEqual(profile.id === "kindle-reading" ? 0.03 : 0.031);
      expect(profile.maxTilesPerColumn).toBeGreaterThanOrEqual(4);
      expect(profile.targetRowsPerSlice).toBeGreaterThan(profile.minRowsPerSlice);
      expect(profile.maxRowsPerSlice).toBeGreaterThanOrEqual(profile.targetRowsPerSlice);
      expect(profile.maxSourceSliceHeightRatio).toBeGreaterThan(0.35);
      expect(profile.maxSourceSliceHeightRatio).toBeLessThanOrEqual(0.75);
      expect(profile.maxOutputPagesPerSourcePage).toBeGreaterThanOrEqual(profile.maxTilesPerColumn);
    }
  });

  it("maps presets to output profiles", () => {
    expect(getOutputProfileForPreset("kindle-ereader").id).toBe("kindle-reading");
    expect(getOutputProfileForPreset("academic-paper").id).toBe("academic-reading");
    expect(getOutputProfileForPreset("ipad-tablet").id).toBe("ipad-tablet");
  });

  it("uses a distinct e-reader profile for Kindle mode", () => {
    const kindle = getOutputProfileForPreset("kindle-ereader");
    const academic = getOutputProfileForPreset("academic-paper");

    expect(kindle.id).toBe("kindle-reading");
    expect(kindle.pageWidth).not.toBe(academic.pageWidth);
    expect(kindle.outputSideMarginRatio).toBeLessThan(academic.outputSideMarginRatio);
    expect(kindle.outputSideMarginRatio).toBeGreaterThanOrEqual(0.022);
    expect(kindle.outputTopMarginRatio).toBeLessThan(0.04);
    expect(kindle.outputBottomMarginRatio).toBeLessThan(0.04);
    expect(kindle.targetReadableScale).toBeGreaterThan(academic.targetReadableScale);
    expect(kindle.targetReadableScale).toBeGreaterThanOrEqual(1.12);
    expect(kindle.maxTilesPerColumn).toBeGreaterThan(academic.maxTilesPerColumn);
    expect(kindle.maxSourceSliceHeightRatio).toBeGreaterThan(academic.maxSourceSliceHeightRatio);
    expect(kindle.targetRowsPerSlice).toBeGreaterThanOrEqual(academic.targetRowsPerSlice);
    expect(kindle.maxRowsPerSlice).toBeGreaterThan(academic.maxRowsPerSlice);
    expect(kindle.minRowsPerSlice).toBeGreaterThan(academic.minRowsPerSlice);
    expect(kindle.preferShorterSlices).toBe(true);
    expect(kindle.allowMoreOutputPages).toBe(true);
    expect(kindle.fullColumnFallbackAllowed).toBe(false);
    expect(kindle.profileAggressiveness).toBe("aggressive");
  });
});
