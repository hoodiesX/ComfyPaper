import { describe, expect, it } from "vitest";
import {
  calculateCropRect,
  clampCropPercentage,
  getManualCropPercentage,
  getDefaultCropSettings,
  getResetCropSettings
} from "@/lib/pdf/cropPreview";

describe("crop preview helpers", () => {
  it("clamps crop percentages to the supported range", () => {
    expect(clampCropPercentage(-1)).toBe(0);
    expect(clampCropPercentage(4)).toBe(4);
    expect(clampCropPercentage(22)).toBe(18);
  });

  it("resets invalid crop values to the safe manual fallback", () => {
    expect(clampCropPercentage(Number.NaN)).toBe(5);
    expect(clampCropPercentage(Number.POSITIVE_INFINITY)).toBe(5);
  });

  it("maps manual presets to expected percentages", () => {
    expect(getManualCropPercentage("conservative", 9)).toBe(5);
    expect(getManualCropPercentage("balanced", 9)).toBe(8);
    expect(getManualCropPercentage("aggressive", 9)).toBe(12);
    expect(getManualCropPercentage("custom", 9)).toBe(9);
  });

  it("uses safe auto as default and reset behavior", () => {
    expect(getDefaultCropSettings()).toEqual({
      mode: "safe-auto",
      manualPreset: "conservative",
      percentage: 5
    });
    expect(getResetCropSettings()).toEqual({
      mode: "safe-auto",
      manualPreset: "conservative",
      percentage: 5
    });
  });

  it("calculates a uniform crop rectangle", () => {
    expect(calculateCropRect(1000, 2000, 8)).toEqual({
      x: 80,
      y: 160,
      width: 840,
      height: 1680
    });
  });

  it("keeps crop rectangles valid even at maximum crop", () => {
    expect(calculateCropRect(100, 100, 18)).toEqual({
      x: 18,
      y: 18,
      width: 64,
      height: 64
    });
  });
});
