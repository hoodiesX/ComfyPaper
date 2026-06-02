import { describe, expect, it } from "vitest";
import { summarizeReadingTransforms } from "@/lib/metrics/readingTransformSummary";
import type { PageReadingTransform } from "@/types/pdf";

const split: PageReadingTransform = {
  sourcePageNumber: 1,
  mode: "column-reading",
  status: "split",
  confidence: 0.95,
  columns: [
    { sourcePageNumber: 1, column: "left", crop: { left: 0, top: 0, right: 0.5, bottom: 0 }, gainPercent: 100 },
    { sourcePageNumber: 1, column: "right", crop: { left: 0.5, top: 0, right: 0, bottom: 0 }, gainPercent: 100 }
  ]
};

describe("reading transform summary", () => {
  it("counts split and preserved output pages", () => {
    const summary = summarizeReadingTransforms([
      split,
      {
        sourcePageNumber: 2,
        mode: "preserved",
        status: "uncertain",
        crop: { left: 0, top: 0, right: 0, bottom: 0 },
        gainPercent: 0
      },
      {
        sourcePageNumber: 3,
        mode: "margin-crop",
        status: "auto-cropped",
        crop: { left: 0.1, top: 0, right: 0.1, bottom: 0 },
        gainPercent: 25
      }
    ]);

    expect(summary).toEqual({
      sourcePagesAnalyzed: 3,
      pagesSplit: 1,
      pagesPreserved: 1,
      marginCropPages: 1,
      estimatedOutputPages: 4
    });
  });
});
