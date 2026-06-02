import type { CropStatus, NormalizedCropRect } from "@/types/pdf";

export type PdfCropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MINIMAL_EXPORT_GAIN_PERCENT = 4;

export function clampNormalizedCrop(crop: NormalizedCropRect): NormalizedCropRect {
  const left = clampUnit(crop.left);
  const top = clampUnit(crop.top);
  const right = Math.min(clampUnit(crop.right), 0.95 - left);
  const bottom = Math.min(clampUnit(crop.bottom), 0.95 - top);

  return {
    left,
    top,
    right: Math.max(0, right),
    bottom: Math.max(0, bottom)
  };
}

export function normalizedCropToPdfCropBox(
  crop: NormalizedCropRect,
  pageWidth: number,
  pageHeight: number
): PdfCropBox {
  const safeCrop = clampNormalizedCrop(crop);
  const x = pageWidth * safeCrop.left;
  const y = pageHeight * safeCrop.bottom;
  const width = pageWidth * (1 - safeCrop.left - safeCrop.right);
  const height = pageHeight * (1 - safeCrop.top - safeCrop.bottom);

  return {
    x: roundPdfNumber(x),
    y: roundPdfNumber(y),
    width: roundPdfNumber(Math.max(1, width)),
    height: roundPdfNumber(Math.max(1, height))
  };
}

export function shouldApplyCrop(status: CropStatus | undefined, gainPercent = 0): boolean {
  if (status === "auto-cropped") {
    return true;
  }

  if (status === "minimal-crop") {
    return gainPercent >= MINIMAL_EXPORT_GAIN_PERCENT;
  }

  return false;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.95, Math.max(0, value));
}

function roundPdfNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}
