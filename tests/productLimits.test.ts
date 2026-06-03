import { describe, expect, it } from "vitest";
import { getExportLimitStatus, getExportLimitStatusForReadingPages } from "@/lib/product/productLimits";

describe("product plan export limits", () => {
  it("free tier exports only the source-page limit and says so", () => {
    const status = getExportLimitStatusForReadingPages({
      totalSourcePages: 19,
      totalReadingPagesEstimated: 10,
      plan: {
        currentPlanTier: "free",
        freeSourcePageLimit: 5,
        freeReadingPageLimit: 12,
        freeMonthlyPdfLimit: 3,
        maxProFilesPerBatch: 20,
        proFeatureBadges: [],
        upgradeCTA: "Unlock full-document export"
      }
    });

    expect(status.exportScope).toBe("limited-preview");
    expect(status.sourcePagesIncluded).toBe(5);
    expect(status.totalSourcePages).toBe(19);
    expect(status.exportLimitApplied).toBe(true);
    expect(status.exportLimitHitBy).toBe("source-pages");
    expect(status.exportLimitReason).toContain("5 source pages or 12 reading pages");
  });

  it("free tier also limits generated reading pages", () => {
    const status = getExportLimitStatusForReadingPages({
      totalSourcePages: 4,
      totalReadingPagesEstimated: 18,
      plan: {
        currentPlanTier: "free",
        freeSourcePageLimit: 5,
        freeReadingPageLimit: 12,
        freeMonthlyPdfLimit: 3,
        maxProFilesPerBatch: 20,
        proFeatureBadges: [],
        upgradeCTA: "Unlock full-document export"
      }
    });

    expect(status.exportScope).toBe("limited-preview");
    expect(status.sourcePagesIncluded).toBe(4);
    expect(status.readingPagesIncluded).toBe(12);
    expect(status.exportLimitHitBy).toBe("reading-pages");
  });

  it("pro tier enables full-document export", () => {
    const status = getExportLimitStatus(19, {
      currentPlanTier: "pro",
      freeSourcePageLimit: 5,
      freeReadingPageLimit: 12,
      freeMonthlyPdfLimit: 3,
      maxProFilesPerBatch: 20,
      proFeatureBadges: [],
      upgradeCTA: "Unlock full-document export"
    });

    expect(status.exportScope).toBe("full-document");
    expect(status.sourcePagesIncluded).toBe(19);
    expect(status.exportLimitApplied).toBe(false);
    expect(status.exportLimitHitBy).toBe("none");
    expect(status.exportLimitReason).toBe("Full document export enabled.");
  });
});
