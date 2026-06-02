import type { CropRect, CropSettings, ManualCropPreset } from "@/types/pdf";

export const MANUAL_CROP_PERCENTAGES: Record<Exclude<ManualCropPreset, "custom">, number> = {
  conservative: 5,
  balanced: 8,
  aggressive: 12
};

export const DEFAULT_CROP_SETTINGS: CropSettings = {
  mode: "safe-auto",
  manualPreset: "conservative",
  percentage: MANUAL_CROP_PERCENTAGES.conservative
};

export const MIN_CROP_PERCENTAGE = 0;
export const MAX_CROP_PERCENTAGE = 18;

export function clampCropPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CROP_SETTINGS.percentage;
  }

  return Math.min(MAX_CROP_PERCENTAGE, Math.max(MIN_CROP_PERCENTAGE, value));
}

export function getManualCropPercentage(
  preset: ManualCropPreset,
  customPercentage: number
): number {
  if (preset === "custom") {
    return clampCropPercentage(customPercentage);
  }

  return MANUAL_CROP_PERCENTAGES[preset];
}

export function getDefaultCropSettings(): CropSettings {
  return { ...DEFAULT_CROP_SETTINGS };
}

export function getResetCropSettings(): CropSettings {
  return getDefaultCropSettings();
}

export function calculateCropRect(width: number, height: number, percentage: number): CropRect {
  const safePercentage = clampCropPercentage(percentage);
  const insetX = width * (safePercentage / 100);
  const insetY = height * (safePercentage / 100);

  return {
    x: insetX,
    y: insetY,
    width: Math.max(1, width - insetX * 2),
    height: Math.max(1, height - insetY * 2)
  };
}
