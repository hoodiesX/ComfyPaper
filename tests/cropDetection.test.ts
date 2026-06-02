import { describe, expect, it } from "vitest";
import {
  analyzeSafeCrop,
  calculateGainPercent,
  clampCropRect,
  findContentBounds,
  isBackgroundPixel
} from "@/lib/pdf/cropDetection";
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

function fillRect(
  pixels: PixelData,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number] = [20, 20, 20]
) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      const index = (row * pixels.width + column) * 4;
      pixels.data[index] = color[0];
      pixels.data[index + 1] = color[1];
      pixels.data[index + 2] = color[2];
      pixels.data[index + 3] = 255;
    }
  }
}

describe("crop detection helpers", () => {
  it("classifies near-white background and dark content", () => {
    expect(isBackgroundPixel(250, 250, 248, 255, [255, 255, 255])).toBe(true);
    expect(isBackgroundPixel(80, 80, 80, 255, [255, 255, 255])).toBe(false);
  });

  it("finds content bounds", () => {
    const pixels = makePixels(100, 100);
    fillRect(pixels, 20, 30, 40, 20);

    expect(findContentBounds(pixels)).toEqual({
      minX: 20,
      minY: 30,
      maxX: 59,
      maxY: 49
    });
  });

  it("applies conservative padding when safe margins exist", () => {
    const pixels = makePixels(200, 200);
    fillRect(pixels, 35, 35, 130, 130);
    const analysis = analyzeSafeCrop(pixels, 1);

    expect(analysis.status).toBe("auto-cropped");
    expect(analysis.cropRect.x).toBeGreaterThan(20);
    expect(analysis.cropRect.y).toBeGreaterThan(20);
    expect(analysis.gainPercent).toBeGreaterThanOrEqual(10);
  });

  it("does not crop a side where content reaches the page edge", () => {
    const pixels = makePixels(200, 200);
    fillRect(pixels, 0, 20, 180, 150);
    const analysis = analyzeSafeCrop(pixels, 1);

    expect(analysis.cropRect.x).toBe(0);
    expect(analysis.cropRect.width).toBeGreaterThan(180);
  });

  it("falls back when gain is too small", () => {
    const pixels = makePixels(200, 200);
    fillRect(pixels, 12, 12, 176, 176);
    const analysis = analyzeSafeCrop(pixels, 1);

    expect(analysis.status).toBe("no-safe-crop");
    expect(analysis.gainPercent).toBe(0);
  });

  it("clamps crop rectangles within page bounds", () => {
    expect(clampCropRect({ x: -10, y: 5, width: 500, height: 20 }, 100, 100)).toEqual({
      x: 0,
      y: 5,
      width: 100,
      height: 20
    });
  });

  it("calculates reading area gain", () => {
    expect(
      calculateGainPercent(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 10, y: 10, width: 80, height: 80 }
      )
    ).toBe(56);
  });
});
