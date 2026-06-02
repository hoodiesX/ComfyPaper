import type { ReadingPresetConfig, ReadingPresetId } from "./presetTypes";

export const READING_PRESETS: ReadingPresetConfig[] = [
  {
    id: "safe-default",
    label: "Safe Default",
    shortDescription: "Conservative cleanup for complex PDFs.",
    intendedFor: "Unknown PDFs, covers, slides and mixed documents",
    tag: "Safest",
    bullets: [
      "Safest choice for complex or visual PDFs",
      "Keeps uncertain pages close to the original",
      "Smaller readability gain than reading modes"
    ],
    safetyLevel: "maximum",
    paddingRatio: 0.07,
    minGainPercent: 12,
    minimalGainPercent: 5,
    maxCropPerSide: 0.12,
    edgeGuardRatio: 0.024,
    minCropSizeRatio: 0.8,
    supportsColumnMode: false,
    defaultColumnMode: false,
    preferColumnSplit: false,
    exportSuffix: "safe"
  },
  {
    id: "academic-paper",
    label: "Academic Paper",
    shortDescription: "Balanced reading layout for papers and technical PDFs.",
    intendedFor: "arXiv papers, conference PDFs, lecture notes",
    tag: "Recommended",
    badge: "Recommended",
    bullets: [
      "Best first choice",
      "Preserves complex title and figure pages safely",
      "Optimizes two-column body pages for comfortable reading"
    ],
    safetyLevel: "balanced",
    paddingRatio: 0.055,
    minGainPercent: 10,
    minimalGainPercent: 4,
    maxCropPerSide: 0.16,
    edgeGuardRatio: 0.018,
    minCropSizeRatio: 0.74,
    supportsColumnMode: true,
    defaultColumnMode: true,
    preferColumnSplit: true,
    exportSuffix: "academic"
  },
  {
    id: "kindle-ereader",
    label: "Kindle / E-reader",
    shortDescription: "Larger text and shorter reading pages for e-ink screens.",
    intendedFor: "Kindle Scribe, Kobo, reMarkable, Boox",
    tag: "E-reader",
    badge: "E-reader",
    bullets: [
      "Produces more pages with larger text",
      "Best for body-heavy papers",
      "Some complex pages may be preserved"
    ],
    safetyLevel: "strong",
    paddingRatio: 0.045,
    minGainPercent: 8,
    minimalGainPercent: 4,
    maxCropPerSide: 0.2,
    edgeGuardRatio: 0.018,
    minCropSizeRatio: 0.7,
    supportsColumnMode: true,
    defaultColumnMode: true,
    preferColumnSplit: true,
    exportSuffix: "kindle"
  },
  {
    id: "ipad-tablet",
    label: "iPad / Tablet",
    shortDescription: "Comfortable reading with fewer splits and larger page chunks.",
    intendedFor: "iPad, tablets, textbooks and reports",
    tag: "Tablet",
    bullets: [
      "Larger chunks than Kindle",
      "Good for iPad and larger screens",
      "Keeps more of the paper structure"
    ],
    safetyLevel: "balanced",
    paddingRatio: 0.06,
    minGainPercent: 10,
    minimalGainPercent: 4,
    maxCropPerSide: 0.14,
    edgeGuardRatio: 0.02,
    minCropSizeRatio: 0.76,
    supportsColumnMode: false,
    defaultColumnMode: false,
    preferColumnSplit: false,
    exportSuffix: "ipad"
  }
];

export const DEFAULT_READING_PRESET_ID: ReadingPresetId = "academic-paper";

export function getReadingPreset(id: ReadingPresetId): ReadingPresetConfig {
  return READING_PRESETS.find((preset) => preset.id === id) ?? READING_PRESETS[0];
}
