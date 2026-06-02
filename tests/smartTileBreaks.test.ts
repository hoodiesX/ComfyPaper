import { describe, expect, it } from "vitest";
import {
  computeHorizontalInkProfile,
  findNearestSafeBoundary,
  findSmartTileBreaks,
  isBoundaryWhitespace,
  smoothInkProfile
} from "@/lib/pdf/smartTileBreaks";
import { READING_OUTPUT_PROFILES } from "@/lib/pdf/readingProfiles";
import type { PixelData } from "@/lib/pdf/cropDetection";

function makePixels(width: number, height: number): PixelData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255;
  }
  return { data, width, height };
}

function fillBand(pixels: PixelData, y: number, height: number) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = 30; column < 120; column += 1) {
      const offset = (row * pixels.width + column) * 4;
      pixels.data[offset] = 20;
      pixels.data[offset + 1] = 20;
      pixels.data[offset + 2] = 20;
      pixels.data[offset + 3] = 255;
    }
  }
}

describe("smart tile breaks", () => {
  it("detects dense text rows and whitespace boundaries", () => {
    const pixels = makePixels(160, 600);
    fillBand(pixels, 250, 24);
    const profile = READING_OUTPUT_PROFILES["academic-reading"];
    const crop = { left: 0.15, top: 0.05, right: 0.2, bottom: 0.05 };
    const inkProfile = computeHorizontalInkProfile(pixels, crop, profile);

    expect(isBoundaryWhitespace(inkProfile, 0.2, profile)).toBe(true);
    expect(isBoundaryWhitespace(inkProfile, 250 / 600, profile)).toBe(false);
  });

  it("smooths single-row noise without erasing real text bands", () => {
    const smoothed = smoothInkProfile([0, 0, 0.9, 0, 0, 0.8, 0.8, 0.8, 0], 1);

    expect(smoothed[2]).toBeLessThan(0.9);
    expect(smoothed[6]).toBeGreaterThan(0.5);
  });

  it("repairs a dense ideal boundary to nearby whitespace", () => {
    const pixels = makePixels(160, 600);
    fillBand(pixels, 290, 30);
    const profile = READING_OUTPUT_PROFILES["academic-reading"];
    const crop = { left: 0.15, top: 0.05, right: 0.2, bottom: 0.05 };
    const inkProfile = computeHorizontalInkProfile(pixels, crop, profile);

    const result = findNearestSafeBoundary(inkProfile, 0.5, 0.42, 0.58, profile);

    expect(result.safe).toBe(true);
    expect(result.repaired).toBe(true);
    expect(result.inkDensity).toBeLessThanOrEqual(profile.maxBoundaryInkDensity);
  });

  it("finds whitespace near an ideal split", () => {
    const pixels = makePixels(160, 600);
    fillBand(pixels, 60, 170);
    fillBand(pixels, 370, 160);
    const profile = {
      ...READING_OUTPUT_PROFILES["kindle-ereader"],
      maxTilesPerColumn: 2
    };

    const result = findSmartTileBreaks(
      pixels,
      { left: 0.15, top: 0.05, right: 0.2, bottom: 0.05 },
      profile
    );

    expect(result.breaks.length).toBeGreaterThan(0);
    expect(result.breaks.every((value) => value > 0.05 && value < 0.95)).toBe(true);
    expect(result.details.every((detail) => detail.breakKind !== "fallback-dense")).toBe(true);
    expect(result.details.every((detail) => detail.continuationMode !== "emergency-overlap")).toBe(true);
    expect(result.details.some((detail) => detail.continuationMode === "clean-non-overlap")).toBe(true);
    expect(result.details.every((detail) => detail.topBoundarySafe && detail.bottomBoundarySafe)).toBe(true);
    expect(result.details.every((detail) => detail.continuationMode === "clean-non-overlap")).toBe(true);
    expect(result.details.every((detail) => (detail.corridorHeight ?? 0) > 0)).toBe(true);
    expect(result.details.every((detail) => (detail.previousFinalBottom ?? 1) < (detail.nextFinalTop ?? 0))).toBe(true);
    expect(result.details.every((detail) => (detail.corridorToLineHeightRatio ?? 0) >= 0.45)).toBe(true);
    expect(result.details.every((detail) => (detail.gapInkDensity ?? 1) <= profile.maxCorridorInkDensity)).toBe(true);
  });

  it("uses zero overlap for line-gap breaks", () => {
    const pixels = makePixels(160, 600);
    fillBand(pixels, 50, 160);
    fillBand(pixels, 330, 180);
    const profile = {
      ...READING_OUTPUT_PROFILES["academic-reading"],
      maxTilesPerColumn: 2,
      maxBreakInkDensity: 0.07
    };

    const result = findSmartTileBreaks(
      pixels,
      { left: 0.15, top: 0.05, right: 0.2, bottom: 0.05 },
      profile
    );

    expect(result.details.every((detail) => detail.continuationMode !== "micro-overlap")).toBe(true);
  });

  it("rejects thin dirty corridors that previously looked valid", () => {
    const pixels = makePixels(160, 600);
    fillBand(pixels, 90, 170);
    fillBand(pixels, 286, 28);
    fillBand(pixels, 360, 150);
    const profile = {
      ...READING_OUTPUT_PROFILES["academic-reading"],
      maxTilesPerColumn: 2,
      breakSearchWindowRatio: 0.025,
      rowSafetySearchWindowRatio: 0.035
    };

    const result = findSmartTileBreaks(
      pixels,
      { left: 0.15, top: 0.05, right: 0.2, bottom: 0.05 },
      profile
    );

    expect(result.details.some((detail) =>
      detail.finalBoundaryValid === true &&
      (detail.gapInkDensity ?? 0) > profile.maxCorridorInkDensity
    )).toBe(false);
  });

  it("falls back when no clean whitespace exists", () => {
    const pixels = makePixels(160, 600);
    fillBand(pixels, 30, 540);

    const result = findSmartTileBreaks(
      pixels,
      { left: 0.15, top: 0.05, right: 0.2, bottom: 0.05 },
      READING_OUTPUT_PROFILES["kindle-ereader"]
    );

    expect(result.strategy).toBe("fallback");
    expect(result.breaks).toHaveLength(0);
    expect(result.details).toHaveLength(0);
  });

  it("uses expanded search instead of accepting unsafe dense boundaries", () => {
    const pixels = makePixels(160, 600);
    fillBand(pixels, 80, 160);
    fillBand(pixels, 260, 120);
    fillBand(pixels, 430, 120);
    const profile = {
      ...READING_OUTPUT_PROFILES["academic-reading"],
      maxTilesPerColumn: 2,
      breakSearchWindowRatio: 0.015,
      rowSafetySearchWindowRatio: 0.14
    };

    const result = findSmartTileBreaks(
      pixels,
      { left: 0.15, top: 0.05, right: 0.2, bottom: 0.05 },
      profile
    );

    expect(result.breaks).toHaveLength(1);
    expect(result.details[0].expandedSearchUsed).toBe(true);
    expect(result.details[0].breakKind).not.toBe("fallback-dense");
    expect(result.details[0].topBoundarySafe).toBe(true);
    expect(result.details[0].bottomBoundarySafe).toBe(true);
  });

  it("does not accept unsafe fallback-dense breaks as final output", () => {
    const pixels = makePixels(160, 600);
    fillBand(pixels, 20, 560);
    const result = findSmartTileBreaks(
      pixels,
      { left: 0.15, top: 0.05, right: 0.2, bottom: 0.05 },
      READING_OUTPUT_PROFILES["kindle-ereader"]
    );

    expect(result.details.some((detail) => detail.breakKind === "fallback-dense" && detail.topBoundarySafe === false)).toBe(false);
  });
});
