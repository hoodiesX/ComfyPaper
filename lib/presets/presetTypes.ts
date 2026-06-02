export type ReadingPresetId =
  | "safe-default"
  | "academic-paper"
  | "kindle-ereader"
  | "ipad-tablet";

export type ReadingPresetConfig = {
  id: ReadingPresetId;
  label: string;
  shortDescription: string;
  intendedFor: string;
  tag: string;
  badge?: string;
  bullets: string[];
  safetyLevel: "maximum" | "balanced" | "strong";
  paddingRatio: number;
  minGainPercent: number;
  minimalGainPercent: number;
  maxCropPerSide: number;
  edgeGuardRatio: number;
  minCropSizeRatio: number;
  supportsColumnMode: boolean;
  defaultColumnMode: boolean;
  preferColumnSplit: boolean;
  exportSuffix: string;
};
