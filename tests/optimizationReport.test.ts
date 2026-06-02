import { describe, expect, it } from "vitest";
import { getReadingPreset } from "@/lib/presets/readingPresets";
import { buildUserOptimizationReport, selectBestComparisonPage, selectBestComparisonPageCandidate } from "@/lib/product/optimizationReport";
import type { AcademicSourcePagePlan, RenderedPage } from "@/types/pdf";

function plan(overrides: Partial<AcademicSourcePagePlan>): AcademicSourcePagePlan {
  return {
    sourcePageNumber: 1,
    strategy: "two-column-width-fit",
    regions: [],
    outputPages: [{
      outputId: "1-left-1",
      sourcePageNumber: 1,
      sourceRegionId: "left",
      regionKind: "left-column",
      outputPageIndex: 0,
      sourceCropBounds: { kind: "bounds", left: 0, top: 0, right: 0.5, bottom: 0.5 },
      finalExportCropBounds: { kind: "bounds", left: 0, top: 0, right: 0.5, bottom: 0.5 },
      sourceCropFractions: { left: 0, top: 0, right: 0.5, bottom: 0.5 },
      outputProfileId: "academic-reading",
      placement: { x: 0, y: 0, width: 100, height: 100, scale: 1 },
      paginationMode: "width-fit-page",
      contentFillRatio: 0.62,
      widthFitScale: 1,
      estimatedReadableScale: 1,
      outputPageFillQuality: "good",
      failureCategories: [],
      validation: { ok: true, issues: [] }
    }],
    validation: { ok: true, issues: [] },
    summary: {
      outputPageCount: 1,
      sourceRegionCount: 1,
      verticalBreakCount: 0,
      outputPageCountByRegion: { "left-column": 1 },
      failureCategories: [],
      repairedFailures: [],
      unrepairedFailures: [],
      productQualityIssues: [],
      productQualityGrade: "good",
      productQualityScore: 88,
      qualityGatePassed: true,
      planValidationPassed: true
    },
    ...overrides
  } as AcademicSourcePagePlan;
}

function rendered(pageNumber: number, overrides: Partial<RenderedPage> = {}): RenderedPage {
  return {
    pageNumber,
    sourcePageNumber: pageNumber,
    width: 100,
    height: 120,
    dataUrl: "data:image/png;base64,",
    ...overrides
  };
}

describe("user optimization report", () => {
  it("counts optimized body and preserved title pages with friendly messages", () => {
    const report = buildUserOptimizationReport({
      preset: getReadingPreset("academic-paper"),
      academicPlans: [
        plan({ sourcePageNumber: 1, strategy: "preserve-page", summary: {
          ...plan({}).summary,
          productQualityIssues: ["first-page-preserved-short-body"],
          qualityGatePassed: true
        } }),
        plan({ sourcePageNumber: 2 })
      ],
      optimizedPages: [rendered(1), rendered(2, { columnStatus: "split", column: "left" })],
      totalSourcePages: 20,
      outputProfileId: "academic-reading"
    });

    expect(report.userReportGenerated).toBe(true);
    expect(report.optimizedBodyPagesCount).toBe(1);
    expect(report.preservedPagesCount).toBe(1);
    expect(report.exportReadiness).toBe("good-with-warnings");
    expect(report.exportLimitApplied).toBe(true);
    expect(report.exportScope).toBe("limited-preview");
    expect(report.sourcePagesIncluded).toBe(5);
    expect(report.freeReadingPageLimit).toBe(12);
    expect(report.exportLimitReason).toContain("5 source pages or 12 reading pages");
    expect(report.recommendedPresetLabel).toBe("Academic Paper");
    expect(report.preservedOutcomes[0].message).toContain("preserved");
    expect(JSON.stringify(report)).not.toContain("rowCoveragePassed");
    expect(JSON.stringify(report)).not.toContain("gutterInkDensity");
  });

  it("marks Kindle crop risk as review recommended", () => {
    const report = buildUserOptimizationReport({
      preset: getReadingPreset("kindle-ereader"),
      academicPlans: [plan({ summary: {
        ...plan({}).summary,
        productQualityIssues: ["kindle-crop-boundary-risk"],
        qualityGatePassed: false
      } })],
      optimizedPages: [rendered(1, { columnStatus: "split", column: "left" })],
      totalSourcePages: 3,
      outputProfileId: "kindle-reading"
    });

    expect(report.exportReadiness).toBe("review-recommended");
    expect(report.reviewPagesCount).toBe(1);
    expect(report.reviewOutcomes[0].suggestedAction).toContain("Academic Paper");
  });

  it("prefers an optimized body page for before/after comparison", () => {
    const best = selectBestComparisonPage([
      rendered(1, { cropStatus: "no-safe-crop" }),
      rendered(2, { columnStatus: "split", column: "left" })
    ]);

    expect(best?.sourcePageNumber).toBe(2);
  });

  it("does not default to preserved page 1 when an optimized body page exists", () => {
    const best = selectBestComparisonPageCandidate(
      [
        rendered(1, { cropStatus: "no-safe-crop" }),
        rendered(2, { columnStatus: "split", column: "left" })
      ],
      [
        plan({
          sourcePageNumber: 1,
          strategy: "preserve-page",
          summary: {
            ...plan({}).summary,
            firstPagePreservedForSafety: true,
            productQualityIssues: ["first-page-preserved-cover"]
          }
        }),
        plan({ sourcePageNumber: 2 })
      ]
    );

    expect(best.page?.sourcePageNumber).toBe(2);
    expect(best.reason).toContain("Page 1 was preserved for safety");
    expect(best.badge).toBe("Two-column -> reading pages");
  });

  it("makes full-document export status explicit when under the free limit", () => {
    const report = buildUserOptimizationReport({
      preset: getReadingPreset("academic-paper"),
      academicPlans: [plan({ sourcePageNumber: 1 })],
      optimizedPages: [rendered(1, { columnStatus: "split", column: "left" })],
      totalSourcePages: 3,
      outputProfileId: "academic-reading"
    });

    expect(report.exportScope).toBe("full-document");
    expect(report.exportLimitApplied).toBe(false);
    expect(report.exportLimitReason).toBe("Full document export enabled.");
  });
});
