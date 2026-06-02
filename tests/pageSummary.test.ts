import { describe, expect, it } from "vitest";
import { buildExportSummary, summarizeRenderedPages } from "@/lib/metrics/pageSummary";
import { getReadingPreset } from "@/lib/presets/readingPresets";
import type { RenderedPage } from "@/types/pdf";

function page(pageNumber: number, cropStatus: RenderedPage["cropStatus"], gain = 0): RenderedPage {
  return {
    pageNumber,
    width: 100,
    height: 100,
    dataUrl: "data:image/png;base64,",
    cropStatus,
    cropGainPercent: gain
  };
}

describe("page summary metrics", () => {
  it("counts page states and average gain", () => {
    const summary = summarizeRenderedPages([
      page(1, "auto-cropped", 20),
      page(2, "minimal-crop", 5),
      page(3, "no-safe-crop", 0),
      page(4, "failed", 0)
    ]);

    expect(summary).toEqual({
      analyzedPages: 4,
      croppedPages: 1,
      preservedPages: 2,
      minimalCropPages: 1,
      failedPages: 1,
      averageGainPercent: 6
    });
  });

  it("builds export summary with Free source and reading limits", () => {
    const summary = buildExportSummary(
      [page(1, "auto-cropped", 20), page(2, "no-safe-crop", 0)],
      getReadingPreset("academic-paper"),
      18
    );

    expect(summary.limitText).toBe("First 5 of 18 source pages");
    expect(summary.presetLabel).toBe("Academic Paper");
    expect(summary.croppedPages).toBe(3);
    expect(summary.preservedPages).toBe(2);
    expect(summary.estimatedOutputPages).toBe(5);
    expect(summary.exportLimitApplied).toBe(true);
    expect(summary.exportScope).toBe("limited-preview");
    expect(summary.sourcePagesIncluded).toBe(5);
    expect(summary.readingPagesIncluded).toBe(5);
    expect(summary.totalSourcePages).toBe(18);
    expect(summary.outputReadingPages).toBe(5);
    expect(summary.exportLimitHitBy).toBe("source-pages");
    expect(summary.exportLimitReason).toBe("Free beta exports up to 5 source pages or 12 reading pages. Full-document export is Pro.");
    expect(summary.exportPageCount).toBe(5);
  });

  it("estimates extra output pages when column mode is enabled", () => {
    const summary = buildExportSummary(
      [
        {
          pageNumber: 1,
          sourcePageNumber: 1,
          column: "left",
          width: 100,
          height: 100,
          dataUrl: "data:image/png;base64,",
          columnStatus: "split"
        },
        {
          pageNumber: 2,
          sourcePageNumber: 1,
          column: "right",
          width: 100,
          height: 100,
          dataUrl: "data:image/png;base64,",
          columnStatus: "split"
        }
      ],
      getReadingPreset("kindle-ereader"),
      10,
      10,
      true,
      12
    );

    expect(summary.croppedPages).toBe(10);
    expect(summary.estimatedOutputPages).toBe(20);
    expect(summary.readingPagesIncluded).toBe(12);
    expect(summary.exportLimitHitBy).toBe("reading-pages");
  });
});
