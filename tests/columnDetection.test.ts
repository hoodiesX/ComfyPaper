import { describe, expect, it } from "vitest";
import { buildReadingTransform, detectColumnSplit } from "@/lib/pdf/columnDetection";
import type { PageCropAnalysis } from "@/types/pdf";
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

function fillRect(pixels: PixelData, x: number, y: number, width: number, height: number) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      const index = (row * pixels.width + column) * 4;
      pixels.data[index] = 20;
      pixels.data[index + 1] = 20;
      pixels.data[index + 2] = 20;
      pixels.data[index + 3] = 255;
    }
  }
}

const marginAnalysis: PageCropAnalysis = {
  pageNumber: 1,
  status: "auto-cropped",
  cropRect: { x: 0, y: 0, width: 100, height: 100 },
  normalizedCrop: { left: 0.03, top: 0.04, right: 0.03, bottom: 0.04 },
  gainPercent: 10
};

describe("column detection", () => {
  it("detects a strong central gutter", () => {
    const pixels = makePixels(300, 500);
    fillRect(pixels, 35, 90, 95, 320);
    fillRect(pixels, 170, 90, 95, 320);

    const result = detectColumnSplit(pixels, 1, marginAnalysis);

    expect(result.status).toBe("split");
    expect(result.debug.reason).toBe("clear-two-column");
    expect(result.debug.gutter?.confidence).toBeGreaterThan(0.88);
    expect(result.columns).toHaveLength(2);
    expect(result.columns[0].crop.right).toBeGreaterThan(0.4);
    expect(result.columns[1].crop.left).toBeGreaterThan(0.4);
    expect(1 - result.columns[0].crop.right).toBeLessThan(result.columns[1].crop.left);
    expect(result.debug.leftColumn?.contentBounds?.left).toBeGreaterThanOrEqual(result.columns[0].crop.left);
    expect(result.debug.rightColumn?.contentBounds?.right).toBeLessThanOrEqual(1 - result.columns[1].crop.right);
  });

  it("keeps splitting when the gutter has slight noise below the threshold", () => {
    const pixels = makePixels(300, 500);
    fillRect(pixels, 35, 90, 95, 320);
    fillRect(pixels, 170, 90, 95, 320);
    fillRect(pixels, 148, 160, 3, 18);

    const result = detectColumnSplit(pixels, 1, marginAnalysis);

    expect(result.status).toBe("split");
    expect(result.debug.reason).toBe("clear-two-column");
  });

  it("keeps splitting when a localized band crosses an otherwise clear gutter", () => {
    const pixels = makePixels(300, 500);
    fillRect(pixels, 35, 90, 95, 320);
    fillRect(pixels, 170, 90, 95, 320);
    fillRect(pixels, 40, 130, 220, 24);

    const result = detectColumnSplit(pixels, 1, marginAnalysis);

    expect(result.status).toBe("split");
    expect(result.debug.gutter?.clearSegmentRatio).toBeGreaterThanOrEqual(0.66);
  });

  it("splits when gutter-side padding is clamped but content remains safe", () => {
    const pixels = makePixels(300, 500);
    fillRect(pixels, 35, 90, 111, 320);
    fillRect(pixels, 170, 90, 95, 320);

    const result = detectColumnSplit(pixels, 1, marginAnalysis);

    expect(result.status).toBe("split");
    expect(result.debug.reason).toBe("clear-two-column");
    expect(result.debug.leftColumn?.safety?.contentInsideCrop).toBe(true);
    expect(result.debug.leftColumn?.safety?.crossesGutter).toBe(false);
    expect(result.debug.leftColumn?.safety?.paddingClamped).toBe(true);
  });

  it("does not reject a split when smart breaks fall back", () => {
    const pixels = makePixels(300, 500);
    fillRect(pixels, 35, 90, 95, 320);
    fillRect(pixels, 170, 90, 95, 320);
    fillRect(pixels, 35, 90, 95, 320);
    fillRect(pixels, 170, 90, 95, 320);

    const result = detectColumnSplit(pixels, 1, marginAnalysis);

    expect(result.status).toBe("split");
    expect(result.columns.some((column) => column.breakStrategy === "fallback")).toBe(true);
  });

  it("rejects full-width content crossing the gutter", () => {
    const pixels = makePixels(300, 500);
    fillRect(pixels, 40, 90, 220, 320);

    const result = detectColumnSplit(pixels, 1, marginAnalysis);

    expect(result.status).toBe("full-width-content");
    expect(result.debug.reason).toBe("gutter-too-noisy");
  });

  it("treats localized full-width content as a mixed-layout split candidate", () => {
    const pixels = makePixels(300, 500);
    fillRect(pixels, 35, 90, 95, 320);
    fillRect(pixels, 170, 90, 95, 320);
    fillRect(pixels, 40, 120, 220, 55);

    const result = detectColumnSplit(pixels, 1, marginAnalysis);

    expect(result.status).toBe("split");
    expect(result.debug.decision).toBe("mixed-split");
    expect(result.debug.reason).toBe("mixed-layout-body-split");
    expect(result.debug.tileCount).toBeGreaterThan(0);
  });

  it("rejects landscape pages", () => {
    const pixels = makePixels(600, 300);
    fillRect(pixels, 80, 60, 180, 180);
    fillRect(pixels, 340, 60, 180, 180);

    const result = detectColumnSplit(pixels, 1, marginAnalysis);

    expect(result.status).toBe("not-two-column");
    expect(result.debug.reason).toBe("landscape-like");
  });

  it("falls back to margin crop when column confidence is low", () => {
    const pixels = makePixels(300, 500);
    fillRect(pixels, 35, 90, 95, 320);
    const transform = buildReadingTransform(pixels, 1, marginAnalysis, true);

    expect(transform.mode).toBe("margin-crop");
  });

  it("returns margin transform when column mode is off", () => {
    const pixels = makePixels(300, 500);
    const transform = buildReadingTransform(pixels, 1, marginAnalysis, false);

    expect(transform.mode).toBe("margin-crop");
  });
});
