import { describe, expect, it } from "vitest";
import { DEFAULT_READING_PRESET_ID, getReadingPreset, READING_PRESETS } from "@/lib/presets/readingPresets";

describe("reading presets", () => {
  it("has unique ids and export suffixes", () => {
    expect(new Set(READING_PRESETS.map((preset) => preset.id)).size).toBe(READING_PRESETS.length);
    expect(READING_PRESETS.every((preset) => preset.exportSuffix.length > 0)).toBe(true);
  });

  it("has sane crop thresholds", () => {
    for (const preset of READING_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.bullets.length).toBeGreaterThanOrEqual(3);
      expect(preset.paddingRatio).toBeGreaterThan(0.03);
      expect(preset.paddingRatio).toBeLessThan(0.09);
      expect(preset.maxCropPerSide).toBeGreaterThan(0.1);
      expect(preset.maxCropPerSide).toBeLessThanOrEqual(0.2);
      expect(preset.minGainPercent).toBeGreaterThanOrEqual(preset.minimalGainPercent);
      expect(preset.minCropSizeRatio).toBeGreaterThanOrEqual(0.7);
    }
  });

  it("defaults to the academic paper niche preset", () => {
    expect(DEFAULT_READING_PRESET_ID).toBe("academic-paper");
    expect(getReadingPreset(DEFAULT_READING_PRESET_ID).label).toBe("Academic Paper");
  });

  it("maps ids to configs", () => {
    expect(getReadingPreset("kindle-ereader").exportSuffix).toBe("kindle");
    expect(getReadingPreset("kindle-ereader").badge).toBe("E-reader");
    expect(getReadingPreset("ipad-tablet").tag).toBe("Tablet");
    expect(getReadingPreset("academic-paper").badge).toBe("Recommended");
  });

  it("only prefers column splitting for academic and e-reader presets", () => {
    expect(getReadingPreset("academic-paper").preferColumnSplit).toBe(true);
    expect(getReadingPreset("kindle-ereader").preferColumnSplit).toBe(true);
    expect(getReadingPreset("safe-default").preferColumnSplit).toBe(false);
    expect(getReadingPreset("ipad-tablet").preferColumnSplit).toBe(false);
  });

  it("enables column mode by default for the academic default workflow", () => {
    const defaultPreset = getReadingPreset(DEFAULT_READING_PRESET_ID);

    expect(defaultPreset.id).toBe("academic-paper");
    expect(defaultPreset.supportsColumnMode).toBe(true);
    expect(defaultPreset.defaultColumnMode).toBe(true);
  });
});
