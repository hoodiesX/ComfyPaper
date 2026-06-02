import type { CropRect, CropStatus, NormalizedCropRect, PageCropAnalysis } from "@/types/pdf";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import { getReadingPreset } from "@/lib/presets/readingPresets";

export type PixelData = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const BACKGROUND_DISTANCE_THRESHOLD = 34;
const DARK_PIXEL_THRESHOLD = 218;
const DEFAULT_CROP_CONFIG = getReadingPreset("academic-paper");

export function estimateBackgroundColor(pixels: PixelData): [number, number, number] {
  const samples: Array<[number, number, number]> = [];
  const sampleSize = Math.max(2, Math.floor(Math.min(pixels.width, pixels.height) * 0.04));
  const corners = [
    [0, 0],
    [pixels.width - sampleSize, 0],
    [0, pixels.height - sampleSize],
    [pixels.width - sampleSize, pixels.height - sampleSize]
  ];

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sampleSize; y += 1) {
      for (let x = startX; x < startX + sampleSize; x += 1) {
        const index = (y * pixels.width + x) * 4;
        samples.push([pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]]);
      }
    }
  }

  samples.sort((a, b) => luminance(a) - luminance(b));
  const brightSamples = samples.slice(Math.floor(samples.length * 0.45));
  const total = brightSamples.reduce(
    (acc, sample) => [acc[0] + sample[0], acc[1] + sample[1], acc[2] + sample[2]],
    [0, 0, 0]
  );

  return [
    Math.round(total[0] / brightSamples.length),
    Math.round(total[1] / brightSamples.length),
    Math.round(total[2] / brightSamples.length)
  ];
}

export function isBackgroundPixel(
  red: number,
  green: number,
  blue: number,
  alpha: number,
  background: [number, number, number]
): boolean {
  if (alpha < 24) {
    return true;
  }

  const distance = colorDistance([red, green, blue], background);
  const brightness = luminance([red, green, blue]);

  return distance < BACKGROUND_DISTANCE_THRESHOLD && brightness > DARK_PIXEL_THRESHOLD;
}

export function findContentBounds(pixels: PixelData): Bounds | null {
  const background = estimateBackgroundColor(pixels);
  let minX = pixels.width;
  let minY = pixels.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < pixels.height; y += 1) {
    for (let x = 0; x < pixels.width; x += 1) {
      const index = (y * pixels.width + x) * 4;
      const isBackground = isBackgroundPixel(
        pixels.data[index],
        pixels.data[index + 1],
        pixels.data[index + 2],
        pixels.data[index + 3],
        background
      );

      if (!isBackground) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

export function analyzeSafeCrop(
  pixels: PixelData,
  pageNumber: number,
  config: ReadingPresetConfig = DEFAULT_CROP_CONFIG
): PageCropAnalysis {
  const fullRect: CropRect = {
    x: 0,
    y: 0,
    width: pixels.width,
    height: pixels.height
  };
  const bounds = findContentBounds(pixels);

  if (!bounds) {
    return {
      pageNumber,
      status: "no-safe-crop",
      cropRect: fullRect,
      normalizedCrop: getNormalizedCropRect(fullRect, pixels.width, pixels.height),
      gainPercent: 0,
      reason: "No reliable content bounds detected."
    };
  }

  const edgeGuardX = pixels.width * config.edgeGuardRatio;
  const edgeGuardY = pixels.height * config.edgeGuardRatio;
  const paddingX = pixels.width * config.paddingRatio;
  const paddingY = pixels.height * config.paddingRatio;
  const maxSideCropX = pixels.width * config.maxCropPerSide;
  const maxSideCropY = pixels.height * config.maxCropPerSide;

  const leftCrop = bounds.minX <= edgeGuardX ? 0 : Math.min(bounds.minX - paddingX, maxSideCropX);
  const topCrop = bounds.minY <= edgeGuardY ? 0 : Math.min(bounds.minY - paddingY, maxSideCropY);
  const rightCrop =
    pixels.width - bounds.maxX <= edgeGuardX
      ? 0
      : Math.min(pixels.width - bounds.maxX - paddingX, maxSideCropX);
  const bottomCrop =
    pixels.height - bounds.maxY <= edgeGuardY
      ? 0
      : Math.min(pixels.height - bounds.maxY - paddingY, maxSideCropY);

  const cropRect = clampCropRect(
    {
      x: Math.max(0, leftCrop),
      y: Math.max(0, topCrop),
      width: pixels.width - Math.max(0, leftCrop) - Math.max(0, rightCrop),
      height: pixels.height - Math.max(0, topCrop) - Math.max(0, bottomCrop)
    },
    pixels.width,
    pixels.height
  );

  if (
    cropRect.width / pixels.width < config.minCropSizeRatio ||
    cropRect.height / pixels.height < config.minCropSizeRatio
  ) {
    return {
      pageNumber,
      status: "no-safe-crop",
      cropRect: fullRect,
      normalizedCrop: getNormalizedCropRect(fullRect, pixels.width, pixels.height),
      gainPercent: 0,
      reason: "Detected crop was too aggressive to trust."
    };
  }

  const gainPercent = calculateGainPercent(fullRect, cropRect);
  const status = getCropStatusForGain(gainPercent, config);

  if (status === "no-safe-crop") {
    return {
      pageNumber,
      status,
      cropRect: fullRect,
      normalizedCrop: getNormalizedCropRect(fullRect, pixels.width, pixels.height),
      gainPercent: 0,
      reason: "Safe crop would not meaningfully improve readability."
    };
  }

  return {
    pageNumber,
    status,
    cropRect,
    normalizedCrop: getNormalizedCropRect(cropRect, pixels.width, pixels.height),
    gainPercent,
    reason:
      status === "minimal-crop"
        ? "Only a small safe margin was detected."
        : "Safe removable margins were detected."
  };
}

export function getNormalizedCropRect(
  rect: CropRect,
  width: number,
  height: number
): NormalizedCropRect {
  if (width <= 0 || height <= 0) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }

  return {
    left: rect.x / width,
    top: rect.y / height,
    right: Math.max(0, (width - rect.x - rect.width) / width),
    bottom: Math.max(0, (height - rect.y - rect.height) / height)
  };
}

export function clampCropRect(rect: CropRect, width: number, height: number): CropRect {
  const x = Math.min(Math.max(0, rect.x), width - 1);
  const y = Math.min(Math.max(0, rect.y), height - 1);
  const right = Math.min(width, Math.max(x + 1, rect.x + rect.width));
  const bottom = Math.min(height, Math.max(y + 1, rect.y + rect.height));

  return {
    x,
    y,
    width: right - x,
    height: bottom - y
  };
}

export function calculateGainPercent(fullRect: CropRect, cropRect: CropRect): number {
  const fullArea = fullRect.width * fullRect.height;
  const cropArea = cropRect.width * cropRect.height;

  if (fullArea <= 0 || cropArea <= 0) {
    return 0;
  }

  return Math.max(0, Math.round((fullArea / cropArea - 1) * 100));
}

function getCropStatusForGain(gainPercent: number, config: ReadingPresetConfig): CropStatus {
  if (gainPercent >= config.minGainPercent) {
    return "auto-cropped";
  }

  if (gainPercent >= config.minimalGainPercent) {
    return "minimal-crop";
  }

  return "no-safe-crop";
}

function colorDistance(
  first: [number, number, number],
  second: [number, number, number]
): number {
  const red = first[0] - second[0];
  const green = first[1] - second[1];
  const blue = first[2] - second[2];

  return Math.sqrt(red * red + green * green + blue * blue);
}

function luminance(color: [number, number, number]): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}
