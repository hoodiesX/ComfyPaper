import { describe, expect, it } from "vitest";
import { buildAcademicReadingPlan, buildAcademicSourcePagePlan } from "@/lib/pdf/academicReadingPlan";
import { READING_OUTPUT_PROFILES } from "@/lib/pdf/readingProfiles";
import type { ColumnCrop, PageReadingTransform } from "@/types/pdf";

const profile = READING_OUTPUT_PROFILES["academic-reading"];
const kindleProfile = READING_OUTPUT_PROFILES["kindle-reading"];

function columnWithBreak(column: "left" | "right"): ColumnCrop {
  return {
    sourcePageNumber: 2,
    column,
    crop: column === "left"
      ? { left: 0.06, top: 0.08, right: 0.52, bottom: 0.08 }
      : { left: 0.52, top: 0.08, right: 0.06, bottom: 0.08 },
    contentBounds: column === "left"
      ? { kind: "bounds", left: 0.08, top: 0.1, right: 0.46, bottom: 0.9 }
      : { kind: "bounds", left: 0.54, top: 0.1, right: 0.92, bottom: 0.9 },
    gainPercent: 100,
    breakFractions: [0.48],
    breakDetails: [{
      position: 0.48,
      inkDensity: 0,
      breakKind: "paragraph-gap",
      continuationMode: "clean-non-overlap",
      breakSource: "text-layer",
      previousFinalBottom: 0.474,
      nextFinalTop: 0.486,
      corridorHeight: 0.012,
      corridorToLineHeightRatio: 0.6,
      finalBoundaryValid: true
    }],
    breakStrategy: "smart"
  };
}

function columnTransform(columns: ColumnCrop[] = [columnWithBreak("left"), columnWithBreak("right")]): PageReadingTransform {
  return {
    sourcePageNumber: 2,
    mode: "column-reading",
    status: "split",
    columns,
    confidence: 0.94,
    debug: {
      pageNumber: 2,
      decision: "split",
      confidence: 0.94,
      reason: "clear-two-column",
      textLayerAvailable: true,
      textRowsDetected: 44
    }
  };
}

function mixedColumnTransform(): PageReadingTransform {
  const transform = columnTransform();

  return {
    ...transform,
    sourcePageNumber: 1,
    columns: transform.mode === "column-reading"
      ? transform.columns.map((column) => ({ ...column, sourcePageNumber: 1 }))
      : [],
    textRows: [
      { left: 0.18, right: 0.82, top: 0.05, bottom: 0.09, itemCount: 1 },
      { left: 0.25, right: 0.75, top: 0.11, bottom: 0.14, itemCount: 1 },
      { left: 0.08, right: 0.45, top: 0.28, bottom: 0.3, itemCount: 1 },
      { left: 0.55, right: 0.92, top: 0.28, bottom: 0.3, itemCount: 1 },
      { left: 0.08, right: 0.45, top: 0.32, bottom: 0.34, itemCount: 1 },
      { left: 0.55, right: 0.92, top: 0.32, bottom: 0.34, itemCount: 1 },
      { left: 0.08, right: 0.45, top: 0.36, bottom: 0.38, itemCount: 1 },
      { left: 0.55, right: 0.92, top: 0.36, bottom: 0.38, itemCount: 1 }
    ],
    debug: transform.debug
      ? {
          ...transform.debug,
          decision: "mixed-split",
          reason: "mixed-layout-body-split"
        }
      : undefined
  };
}

function uncertainMixedColumnTransform(): PageReadingTransform {
  const transform = columnTransform();

  return {
    ...transform,
    sourcePageNumber: 1,
    columns: transform.mode === "column-reading"
      ? transform.columns.map((column) => ({ ...column, sourcePageNumber: 1 }))
      : [],
    textRows: [
      { left: 0.18, right: 0.82, top: 0.05, bottom: 0.09, itemCount: 1 },
      { left: 0.25, right: 0.75, top: 0.11, bottom: 0.14, itemCount: 1 },
      { left: 0.08, right: 0.45, top: 0.28, bottom: 0.3, itemCount: 1 },
      { left: 0.08, right: 0.45, top: 0.32, bottom: 0.34, itemCount: 1 },
      { left: 0.08, right: 0.45, top: 0.36, bottom: 0.38, itemCount: 1 },
      { left: 0.08, right: 0.45, top: 0.4, bottom: 0.42, itemCount: 1 },
      { left: 0.08, right: 0.45, top: 0.44, bottom: 0.46, itemCount: 1 },
      { left: 0.08, right: 0.45, top: 0.48, bottom: 0.5, itemCount: 1 }
    ],
    debug: transform.debug
      ? {
          ...transform.debug,
          decision: "mixed-split",
          reason: "mixed-layout-body-split"
        }
      : undefined
  };
}

function rowHeavyColumnTransform(): PageReadingTransform {
  const rows = Array.from({ length: 36 }, (_, index) => ({
    left: 0.08,
    right: 0.45,
    top: 0.08 + index * 0.022,
    bottom: 0.092 + index * 0.022,
    itemCount: 2
  }));

  return {
    ...columnTransform([{
      sourcePageNumber: 2,
      column: "left",
      crop: { left: 0.06, top: 0.06, right: 0.52, bottom: 0.08 },
      contentBounds: { kind: "bounds", left: 0.08, top: 0.08, right: 0.45, bottom: 0.88 },
      gainPercent: 100
    }]),
    textRows: rows,
    debug: {
      pageNumber: 2,
      decision: "split",
      confidence: 0.94,
      reason: "clear-two-column",
      textLayerAvailable: true,
      textRowsDetected: rows.length
    }
  };
}

function shortFinalColumnTransform(): PageReadingTransform {
  const rows = [
    ...Array.from({ length: 10 }, (_, index) => ({
      left: 0.08,
      right: 0.45,
      top: 0.08 + index * 0.025,
      bottom: 0.092 + index * 0.025,
      itemCount: 2
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      left: 0.08,
      right: 0.45,
      top: 0.42 + index * 0.025,
      bottom: 0.432 + index * 0.025,
      itemCount: 2
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
      left: 0.08,
      right: 0.45,
      top: 0.82 + index * 0.025,
      bottom: 0.832 + index * 0.025,
      itemCount: 2
    }))
  ];

  return {
    ...columnTransform([{
      sourcePageNumber: 2,
      column: "left",
      crop: { left: 0.06, top: 0.06, right: 0.52, bottom: 0.08 },
      contentBounds: { kind: "bounds", left: 0.08, top: 0.08, right: 0.45, bottom: 0.88 },
      gainPercent: 100,
      breakFractions: [0.38, 0.78],
      breakDetails: [
        {
          position: 0.38,
          inkDensity: 0,
          breakKind: "paragraph-gap",
          continuationMode: "clean-non-overlap",
          previousFinalBottom: 0.37,
          nextFinalTop: 0.39,
          corridorHeight: 0.02,
          finalBoundaryValid: true
        },
        {
          position: 0.78,
          inkDensity: 0,
          breakKind: "paragraph-gap",
          continuationMode: "clean-non-overlap",
          previousFinalBottom: 0.77,
          nextFinalTop: 0.79,
          corridorHeight: 0.02,
          finalBoundaryValid: true
        }
      ]
    }]),
    textRows: rows,
    debug: {
      pageNumber: 2,
      decision: "split",
      confidence: 0.94,
      reason: "clear-two-column",
      textLayerAvailable: true,
      textRowsDetected: rows.length
    }
  };
}

function kindleTinyFinalTransform(): PageReadingTransform {
  const rows = [
    ...Array.from({ length: 18 }, (_, index) => ({
      left: 0.08,
      right: 0.45,
      top: 0.08 + index * 0.022,
      bottom: 0.092 + index * 0.022,
      itemCount: 2
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      left: 0.08,
      right: 0.45,
      top: 0.74 + index * 0.022,
      bottom: 0.752 + index * 0.022,
      itemCount: 2
    }))
  ];

  return {
    ...columnTransform([{
      sourcePageNumber: 2,
      column: "left",
      crop: { left: 0.06, top: 0.06, right: 0.52, bottom: 0.08 },
      contentBounds: { kind: "bounds", left: 0.08, top: 0.08, right: 0.45, bottom: 0.82 },
      gainPercent: 100,
      breakFractions: [0.7],
      breakDetails: [{
        position: 0.7,
        inkDensity: 0,
        breakKind: "paragraph-gap",
        continuationMode: "clean-non-overlap",
        previousFinalBottom: 0.695,
        nextFinalTop: 0.705,
        corridorHeight: 0.01,
        finalBoundaryValid: true
      }]
    }]),
    textRows: rows,
    debug: {
      pageNumber: 2,
      decision: "split",
      confidence: 0.94,
      reason: "clear-two-column",
      textLayerAvailable: true,
      textRowsDetected: rows.length
    }
  };
}

function kindleBoundaryCutTransform(): PageReadingTransform {
  return {
    ...columnTransform([{
      sourcePageNumber: 2,
      column: "left",
      crop: { left: 0.06, top: 0.06, right: 0.52, bottom: 0.08 },
      contentBounds: { kind: "bounds", left: 0.08, top: 0.08, right: 0.45, bottom: 0.86 },
      gainPercent: 100,
      breakFractions: [0.42, 0.7],
      breakDetails: [{
        position: 0.42,
        inkDensity: 0,
        breakKind: "line-gap",
        continuationMode: "clean-non-overlap",
        previousFinalBottom: 0.42,
        nextFinalTop: 0.42,
        corridorHeight: 0,
        finalBoundaryValid: true
      }, {
        position: 0.7,
        inkDensity: 0,
        breakKind: "paragraph-gap",
        continuationMode: "clean-non-overlap",
        previousFinalBottom: 0.695,
        nextFinalTop: 0.705,
        corridorHeight: 0.01,
        finalBoundaryValid: true
      }]
    }]),
    textRows: [
      ...Array.from({ length: 12 }, (_, index) => ({
        left: 0.08,
        right: 0.45,
        top: 0.1 + index * 0.022,
        bottom: 0.112 + index * 0.022,
        itemCount: 2
      })),
      { left: 0.08, right: 0.45, top: 0.414, bottom: 0.426, itemCount: 2 },
      ...Array.from({ length: 12 }, (_, index) => ({
        left: 0.08,
        right: 0.45,
        top: 0.48 + index * 0.022,
        bottom: 0.492 + index * 0.022,
        itemCount: 2
      }))
    ],
    debug: {
      pageNumber: 2,
      decision: "split",
      confidence: 0.94,
      reason: "clear-two-column",
      textLayerAvailable: true,
      textRowsDetected: 25
    }
  };
}

describe("academic reading plan", () => {
  it("creates stable unique output pages from split columns", () => {
    const plan = buildAcademicSourcePagePlan(columnTransform(), profile);
    const ids = plan.outputPages.map((page) => page.outputId);

    expect(plan.strategy).toBe("two-column-width-fit");
    expect(plan.summary.sourceRegionCount).toBe(2);
    expect(plan.summary.outputPageCount).toBe(4);
    expect(plan.summary.verticalBreakCount).toBe(2);
    expect(plan.summary.breakCoverageComplete).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.validation.ok).toBe(true);
  });

  it("keeps output crops progressing top-to-bottom within each column region", () => {
    const plan = buildAcademicSourcePagePlan(columnTransform([columnWithBreak("left")]), profile);
    const [first, second] = plan.outputPages;

    expect(first.sourceRegionId).toBe(second.sourceRegionId);
    expect(second.sourceCropBounds.top).toBeGreaterThan(first.sourceCropBounds.top);
    expect(first.breakAfter?.breakSource).toBe("text-layer");
    expect(second.breakBefore?.breakKind).toBe("paragraph-gap");
  });

  it("uses explicit last-resort output when break diagnostics are incomplete", () => {
    const plan = buildAcademicSourcePagePlan(columnTransform([{
      ...columnWithBreak("left"),
      breakDetails: undefined
    }]), profile);

    expect(plan.outputPages.length).toBeGreaterThan(1);
    expect(plan.outputPages[0].paginationMode).toBe("last-resort");
    expect(plan.summary.verticalBreakCount).toBeGreaterThan(0);
    expect(plan.summary.breakCoverageComplete).toBe(true);
  });

  it("tags tall single-column fallback as full-column-too-empty when readability is poor", () => {
    const plan = buildAcademicSourcePagePlan(columnTransform([{
      sourcePageNumber: 2,
      column: "left",
      crop: { left: 0.08, top: 0.02, right: 0.62, bottom: 0.02 },
      gainPercent: 100,
      breakFractions: [0.42],
      breakDetails: undefined
    }]), {
      ...profile,
      minContentFillRatio: 0.9,
      targetReadableScale: 3
    });

    expect(plan.outputPages.length).toBeGreaterThan(1);
    expect(plan.outputPages[0].paginationMode).toBe("last-resort");
    expect(plan.summary.failureCategories).not.toContain("full-column-too-empty");
    expect(plan.summary.productQualityIssues).not.toContain("full-column-fallback-in-text-heavy-page");
  });

  it("rejects duplicate source crop bounds from the same source region", () => {
    const duplicated = {
      ...columnWithBreak("left"),
      breakFractions: undefined,
      breakDetails: undefined
    };
    const plan = buildAcademicSourcePagePlan(columnTransform([duplicated, duplicated]), profile);

    expect(plan.validation.ok).toBe(false);
    expect(plan.summary.failureCategories).toContain("duplicate-output-page");
  });

  it("builds a file-level plan summary from source-page plans", () => {
    const readingPlan = buildAcademicReadingPlan([
      columnTransform([columnWithBreak("left")]),
      {
        sourcePageNumber: 3,
        mode: "margin-crop",
        status: "auto-cropped",
        crop: { left: 0.05, top: 0.05, right: 0.05, bottom: 0.05 },
        gainPercent: 12
      }
    ], profile, { fileName: "paper.pdf", selectedPreset: "academic-paper" });

    expect(readingPlan.fileName).toBe("paper.pdf");
    expect(readingPlan.outputProfileId).toBe("academic-reading");
    expect(readingPlan.summary.sourcePageCount).toBe(2);
    expect(readingPlan.summary.outputPageCount).toBe(3);
    expect(readingPlan.diagnostics.validation.ok).toBe(true);
  });

  it("repairs mixed pages by synthesizing a full-width title region before columns", () => {
    const plan = buildAcademicSourcePagePlan(mixedColumnTransform(), profile);
    const titleRegion = plan.regions.find((region) => region.kind === "full-width-title");
    const leftRegion = plan.regions.find((region) => region.kind === "left-column");

    expect(plan.strategy).toBe("first-page-title-preserve-body-width-fit");
    expect(titleRegion).toBeDefined();
    expect(plan.outputPages[0].regionKind).toBe("full-width-title");
    expect(leftRegion?.sourceBounds.top).toBeGreaterThan(titleRegion?.sourceBounds.top ?? 0);
    expect(plan.summary.repairedFailures).toContain("title-author-split");
    expect(plan.summary.failureCategories).not.toContain("title-author-split");
    expect(plan.summary.titleAuthorRepairApplied).toBe(true);
    expect(plan.validation.ok).toBe(true);
  });

  it("fails validation when body text rows are missing from the output plan", () => {
    const plan = buildAcademicSourcePagePlan({
      ...columnTransform(),
      textRows: [
        { left: 0.485, right: 0.515, top: 0.5, bottom: 0.52, itemCount: 1 }
      ]
    }, profile);

    expect(plan.summary.rowCoveragePassed).toBe(false);
    expect(plan.summary.missingTextRowsCount).toBe(1);
    expect(plan.summary.unaccountedMissingRowsCount).toBe(1);
    expect(plan.validation.ok).toBe(false);
    expect(plan.validation.issues.join(" ")).toContain("Unaccounted missing text rows");
  });

  it("allows explicitly ignorable header rows to be outside optimized column output", () => {
    const plan = buildAcademicSourcePagePlan({
      ...columnTransform(),
      textRows: [
        { left: 0.01, right: 0.04, top: 0.01, bottom: 0.025, itemCount: 1 }
      ]
    }, profile);

    expect(plan.summary.rowCoveragePassed).toBe(true);
    expect(plan.summary.missingTextRowsCount).toBe(1);
    expect(plan.summary.ignoredRowsByReason).toEqual({ header: 1 });
    expect(plan.summary.unaccountedMissingRowsCount).toBe(0);
    expect(plan.validation.ok).toBe(true);
  });

  it("covers wide PDF.js rows that span both columns without treating left/right output as duplicates", () => {
    const plan = buildAcademicSourcePagePlan({
      ...columnTransform(),
      textRows: [
        { left: 0.08, right: 0.92, top: 0.2, bottom: 0.22, itemCount: 12 }
      ]
    }, profile);

    expect(plan.summary.rowCoveragePassed).toBe(true);
    expect(plan.summary.missingTextRowsCount).toBe(0);
    expect(plan.summary.duplicatedTextRowsCount).toBe(0);
    expect(plan.validation.ok).toBe(true);
  });

  it("preserves a short or asymmetric first-page body as a warning instead of a hard failure", () => {
    const plan = buildAcademicSourcePagePlan(uncertainMixedColumnTransform(), kindleProfile);

    expect(plan.strategy).toBe("preserve-page");
    expect(plan.validation.ok).toBe(true);
    expect(plan.summary.firstPagePolicy).toBe("title-plus-short-body-preserve");
    expect(plan.summary.shortAsymmetricBodyDetected).toBe(true);
    expect(plan.summary.qualityGatePassed).toBe(true);
    expect(plan.summary.productQualityIssues).toContain("first-page-preserved-short-body");
    expect(plan.summary.productQualityIssues).not.toContain("first-page-not-optimized");
    expect(plan.summary.productQualityIssues).not.toContain("mixed-layout-downgraded");
    expect(plan.summary.transitionCandidates?.length).toBeGreaterThan(0);
  });

  it("does not run title repair on non-first-page mixed body columns", () => {
    const transform = {
      ...uncertainMixedColumnTransform(),
      sourcePageNumber: 2,
      columns: uncertainMixedColumnTransform().mode === "column-reading"
        ? uncertainMixedColumnTransform().columns.map((column) => ({ ...column, sourcePageNumber: 2 }))
        : []
    };
    const plan = buildAcademicSourcePagePlan(transform, profile);

    expect(plan.strategy).not.toBe("unsafe-preserve");
    expect(plan.summary.academicPageClass).toBe("body-two-column");
    expect(plan.summary.titleDetectionApplicable).toBe(false);
    expect(plan.summary.titleDetectionSkippedReason).toBe("not-first-page");
    expect(plan.summary.bodyColumnExtractionSucceeded).toBe(true);
    expect(plan.summary.productQualityIssues).not.toContain("detected-columns-discarded");
  });

  it("marks full-column fallback in Kindle text-heavy output as product-quality failure", () => {
    const plan = buildAcademicSourcePagePlan(columnTransform([{
      ...columnWithBreak("left"),
      breakDetails: undefined
    }]), kindleProfile);

    expect(plan.outputPages[0].paginationMode).toBe("last-resort");
    expect(plan.summary.productQualityIssues).not.toContain("full-column-fallback-in-text-heavy-page");
  });

  it("paginates text-heavy columns from text rows instead of full-column fallback", () => {
    const plan = buildAcademicSourcePagePlan(rowHeavyColumnTransform(), profile);

    expect(plan.outputPages.length).toBeGreaterThan(1);
    expect(plan.outputPages.every((page) => page.paginationMode !== "single-column-safe")).toBe(true);
    expect(plan.summary.productQualityIssues).not.toContain("full-column-fallback-in-text-heavy-page");
    expect(plan.summary.breakCoverageComplete).toBe(true);
    expect(plan.validation.ok).toBe(true);
  });

  it("uses shorter Kindle slices than Academic for the same text-heavy body column", () => {
    const academicPlan = buildAcademicSourcePagePlan(rowHeavyColumnTransform(), profile);
    const kindlePlan = buildAcademicSourcePagePlan(rowHeavyColumnTransform(), kindleProfile);
    const averageRows = (pages: typeof academicPlan.outputPages) =>
      pages.reduce((sum, page) => sum + (page.rowsOnPage ?? 0), 0) / pages.length;

    expect(kindleProfile.targetReadableScale).toBeGreaterThan(profile.targetReadableScale);
    expect(kindlePlan.outputPages.length).toBeGreaterThanOrEqual(academicPlan.outputPages.length);
    expect(averageRows(kindlePlan.outputPages)).toBeLessThanOrEqual(averageRows(academicPlan.outputPages));
    expect(kindlePlan.outputPages.every((page) => page.paginationMode !== "single-column-safe")).toBe(true);
    expect(kindlePlan.outputPages.every((page) => (page.rowsOnPage ?? 0) <= kindleProfile.maxRowsPerSlice)).toBe(true);
    expect(kindlePlan.summary.selectedOutputProfileId).toBe("kindle-reading");
    expect(kindlePlan.summary.preferShorterSlices).toBe(true);
  });

  it("flags Kindle slices that exceed the e-reader row cap", () => {
    const plan = buildAcademicSourcePagePlan(rowHeavyColumnTransform(), {
      ...kindleProfile,
      maxRowsPerSlice: 3
    });

    expect(plan.summary.productQualityIssues).toContain("kindle-slice-too-tall");
    expect(plan.summary.qualityGatePassed).toBe(false);
  });

  it("merges a tiny final slice with the previous same-region page when safe", () => {
    const plan = buildAcademicSourcePagePlan(shortFinalColumnTransform(), profile);
    const shortPages = plan.outputPages.filter((page) => page.shortPageDetected);

    expect(plan.outputPages).toHaveLength(2);
    expect(shortPages).toHaveLength(0);
    expect(plan.outputPages[1].rowsOnPage).toBeGreaterThan(profile.minRowsPerFinalPage);
    expect(plan.summary.shortPageCount).toBe(0);
  });

  it("merges Kindle tiny final slices instead of leaving 3-row fragments", () => {
    const plan = buildAcademicSourcePagePlan(kindleTinyFinalTransform(), kindleProfile);

    expect(plan.summary.tinySliceCount).toBe(0);
    expect(plan.summary.productQualityIssues).not.toContain("kindle-tiny-slice");
    expect(plan.outputPages.every((page) => (page.rowsOnPage ?? 0) >= kindleProfile.minRowsPerOutputPage)).toBe(true);
  });

  it("repairs Kindle crop boundaries that would cut through a text row", () => {
    const plan = buildAcademicSourcePagePlan(kindleBoundaryCutTransform(), kindleProfile);

    expect(plan.outputPages.every((page) => page.textClippingRisk !== true)).toBe(true);
    expect(plan.validation.ok).toBe(true);
  });
});
