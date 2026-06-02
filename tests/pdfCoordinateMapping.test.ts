import { describe, expect, it } from "vitest";
import {
  clampNormalizedCrop,
  normalizedCropToPdfCropBox,
  shouldApplyCrop
} from "@/lib/pdf/pdfCoordinateMapping";

describe("pdf coordinate mapping", () => {
  it("maps no crop to the full page", () => {
    expect(
      normalizedCropToPdfCropBox({ left: 0, top: 0, right: 0, bottom: 0 }, 600, 800)
    ).toEqual({
      x: 0,
      y: 0,
      width: 600,
      height: 800
    });
  });

  it("maps 10 percent crop with bottom-left PDF origin", () => {
    expect(
      normalizedCropToPdfCropBox({ left: 0.1, top: 0.1, right: 0.1, bottom: 0.1 }, 600, 800)
    ).toEqual({
      x: 60,
      y: 80,
      width: 480,
      height: 640
    });
  });

  it("keeps top and bottom conversion distinct", () => {
    expect(
      normalizedCropToPdfCropBox({ left: 0, top: 0.2, right: 0, bottom: 0.1 }, 500, 1000)
    ).toEqual({
      x: 0,
      y: 100,
      width: 500,
      height: 700
    });
  });

  it("clamps invalid normalized crop values", () => {
    expect(
      clampNormalizedCrop({ left: -1, top: Number.NaN, right: 2, bottom: 0.2 })
    ).toEqual({
      left: 0,
      top: 0,
      right: 0.95,
      bottom: 0.2
    });
  });

  it("decides which crop statuses export", () => {
    expect(shouldApplyCrop("auto-cropped", 10)).toBe(true);
    expect(shouldApplyCrop("minimal-crop", 4)).toBe(true);
    expect(shouldApplyCrop("minimal-crop", 3)).toBe(false);
    expect(shouldApplyCrop("no-safe-crop", 0)).toBe(false);
    expect(shouldApplyCrop("failed", 0)).toBe(false);
  });
});
