import type { NormalizedCropRect } from "@/types/pdf";

export function calculateReadingGainPercent(crop?: NormalizedCropRect): number {
  if (!crop) {
    return 0;
  }

  const safeCrop = {
    left: clampCropFraction(crop.left),
    right: clampCropFraction(crop.right),
    top: clampCropFraction(crop.top),
    bottom: clampCropFraction(crop.bottom)
  };
  const width = Math.max(0.05, 1 - safeCrop.left - safeCrop.right);
  const height = Math.max(0.05, 1 - safeCrop.top - safeCrop.bottom);
  const remainingArea = width * height;

  if (remainingArea >= 1) {
    return 0;
  }

  return Math.max(0, Math.round((1 / remainingArea - 1) * 100));
}

function clampCropFraction(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.45, Math.max(0, value));
}
