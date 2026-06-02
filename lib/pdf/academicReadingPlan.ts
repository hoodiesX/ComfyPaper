import type {
  AcademicOutputPagePlan,
  AcademicOutputPaginationMode,
  AcademicFailureCategory,
  AcademicPageClass,
  AcademicPageStrategy,
  AcademicReadingPlan,
  AcademicRegionKind,
  AcademicRegionPlan,
  AcademicSourcePagePlan,
  ColumnCrop,
  NormalizedCropRect,
  OutputPageFillQuality,
  PageReadingTransform,
  PlanValidationResult,
  ProductQualityGrade,
  ProductQualityIssue,
  ReadingTile,
  RowCoverageClass,
  ShortPageKind,
  TextLineRow,
  TileBreakDetail,
  TileBoundaryDiagnostics
} from "@/types/pdf";
import type { ReadingOutputProfile } from "./readingProfiles";
import { cropFractionsToBounds } from "./normalizedRects";
import { calculateProfileDrawPlacement, createReadingTilesForColumns } from "./readingTiles";
import { detectAcademicLayoutTransitions, type AcademicLayoutTransition } from "./academicLayoutTransitions";

export function buildAcademicReadingPlan(
  transforms: PageReadingTransform[],
  outputProfile: ReadingOutputProfile,
  options: { fileName?: string; selectedPreset?: string } = {}
): AcademicReadingPlan {
  const sourcePages = transforms.map((transform) => buildAcademicSourcePagePlan(transform, outputProfile));
  const validation = validateAcademicReadingPlanPages(sourcePages);
  const failureCategories = uniqueFailures(sourcePages.flatMap((page) => page.summary.failureCategories));
  const productQualityIssues = uniqueQualityIssues(sourcePages.flatMap((page) => page.summary.productQualityIssues ?? []));
  const worstQualityGrade = getWorstQualityGrade(sourcePages.map((page) => page.summary.productQualityGrade ?? "acceptable"));

  return {
    fileName: options.fileName,
    selectedPreset: options.selectedPreset,
    outputProfileId: outputProfile.id,
    sourcePages,
    summary: {
      sourcePageCount: sourcePages.length,
      outputPageCount: sourcePages.reduce((sum, page) => sum + page.summary.outputPageCount, 0),
      verticalBreakCount: sourcePages.reduce((sum, page) => sum + page.summary.verticalBreakCount, 0),
      breakCoverageComplete: sourcePages.every((page) => page.summary.breakCoverageComplete),
      failureCategories,
      repairedFailures: uniqueFailures(sourcePages.flatMap((page) => page.summary.repairedFailures)),
      unrepairedFailures: uniqueFailures(sourcePages.flatMap((page) => page.summary.unrepairedFailures)),
      repairActionsApplied: Array.from(new Set(sourcePages.flatMap((page) => page.summary.repairActionsApplied))),
      productQualityGrade: worstQualityGrade,
      productQualityScore: Math.min(...sourcePages.map((page) => page.summary.productQualityScore ?? 75)),
      productQualityIssues,
      qualityGatePassed: sourcePages.every((page) => page.summary.qualityGatePassed !== false)
    },
    diagnostics: { validation }
  };
}

export function buildAcademicSourcePagePlan(
  transform: PageReadingTransform,
  outputProfile: ReadingOutputProfile
): AcademicSourcePagePlan {
  if (transform.mode === "column-reading") {
    const pageClass = classifyAcademicPage(transform);
    const titleRepair = pageClass.titleDetectionApplicable ? getTitleAuthorRepair(transform) : { applied: false, bodyRegionTop: 0 };
    if (pageClass.academicPageClass === "first-page-title-plus-body" && !titleRepair.applied) {
      return buildUncertainMixedPreservePlan(transform, outputProfile, titleRepair);
    }
    const columnsForPlanningBase = titleRepair.applied
      ? transform.columns.map((column) => clampColumnTop(column, titleRepair.bodyRegionTop))
      : transform.columns;
    const columnsForPlanning = applyTextRowWidthFitPagination(
      columnsForPlanningBase,
      transform.textRows ?? [],
      outputProfile
    );
    const tiles = createReadingTilesForColumns(columnsForPlanning, outputProfile);
    const regions = [
      ...(titleRepair.region ? [titleRepair.region] : []),
      ...columnsForPlanning.map((column) => buildColumnRegionPlan(column, transform.debug))
    ];
    const titleOutputPages = titleRepair.region
      ? [buildPreservedRegionOutputPage(transform.sourcePageNumber, titleRepair.region, outputProfile)]
      : [];
    const outputPages = tiles.map((tile, index) =>
      buildOutputPagePlan(tile, index + titleOutputPages.length, outputProfile, getColumnBreakDiagnostics(columnsForPlanning, tile))
    );
    const allOutputPages = annotateShortPages([...titleOutputPages, ...outputPages], transform.textRows ?? [], outputProfile);
    const outputPagesWithValidation = applyOutputPageValidation(allOutputPages, outputProfile);
    const summary = summarizeOutputPages(outputPagesWithValidation, regions.length);
    const validation = validateAcademicSourcePageOutput(outputPagesWithValidation);
    const rowCoverage = validateRowCoverage(transform.textRows ?? [], outputPagesWithValidation, titleRepair.transition);
    const pageFailures = uniqueFailures([
      ...outputPagesWithValidation.flatMap((page) => page.failureCategories),
      ...getSourcePageFailureCategories(transform, regions, titleRepair, pageClass),
      ...rowCoverage.failures
    ]);
    const repairedFailures = titleRepair.applied ? (["title-author-split"] as AcademicFailureCategory[]) : [];
    const unrepairedFailures = pageFailures.filter((failure) => !repairedFailures.includes(failure));
    const baseSummaryWithFailures = {
      ...summary,
      failureCategories: pageFailures,
      repairedFailures,
      unrepairedFailures,
      repairActionsApplied: titleRepair.applied ? ["synthesized-full-width-title-region"] : [],
      titleAuthorRepairApplied: titleRepair.applied,
      fullWidthTitleRegionDetected: Boolean(titleRepair.region),
      bodyRegionTop: titleRepair.applied ? titleRepair.bodyRegionTop : undefined,
      layoutKind: titleRepair.transition?.layoutKind,
      titleRegionContainsColumnRows: titleRepair.transition?.evidence.titleRegionContainsColumnRows,
      rowCoveragePassed: rowCoverage.passed,
      duplicatedTextRowsCount: rowCoverage.duplicatedTextRowsCount,
      missingTextRowsCount: rowCoverage.missingTextRowsCount,
      unaccountedMissingRowsCount: rowCoverage.unaccountedMissingRowsCount,
      ignoredRowsCount: rowCoverage.ignoredRowsCount,
      ignoredRowsByReason: rowCoverage.ignoredRowsByReason,
      rowCoverageFailureReason: rowCoverage.failureReason,
      nearDuplicateOutputPages: rowCoverage.nearDuplicateOutputPages,
      ...getPageClassSummary(pageClass, true),
      ...summarizeShortPages(outputPagesWithValidation, transform, titleRepair),
      ...getProfileDiagnostics(outputProfile, outputPagesWithValidation),
      ...getTransitionSummary(titleRepair.transition)
    };
    const quality = evaluateProductQuality(
      transform,
      outputProfile,
      outputPagesWithValidation,
      baseSummaryWithFailures,
      rowCoverage
    );
    const summaryWithFailures = {
      ...baseSummaryWithFailures,
      productQualityGrade: quality.grade,
      productQualityScore: quality.score,
      productQualityIssues: quality.issues,
      qualityGatePassed: quality.passed
    };

    return {
      sourcePageNumber: transform.sourcePageNumber,
      strategy: getColumnStrategy(transform, outputPagesWithValidation),
      regions,
      outputPages: outputPagesWithValidation,
      validation: addUnrepairedFailureIssues(addRowCoverageIssues(validation, rowCoverage), unrepairedFailures),
      summary: summaryWithFailures
    };
  }

  const kind: AcademicRegionKind = transform.mode === "margin-crop" ? "full-width" : "unsafe";
  const crop = transform.crop;
  const bounds = cropFractionsToBounds(crop);
  const regionId = `${transform.sourcePageNumber}-${kind}`;
  const placement = calculateProfileDrawPlacement(1 - crop.left - crop.right, 1 - crop.top - crop.bottom, outputProfile);
  const outputPage: AcademicOutputPagePlan = {
    outputId: `${transform.sourcePageNumber}-${transform.mode}-full-1`,
    sourcePageNumber: transform.sourcePageNumber,
    sourceRegionId: regionId,
    regionKind: kind,
    outputPageIndex: 1,
    sourceCropBounds: bounds,
    finalExportCropBounds: bounds,
    sourceCropFractions: crop,
    outputProfileId: outputProfile.id,
    placement,
    paginationMode: transform.mode === "margin-crop" ? "full-width-preserve" : "last-resort",
    contentFillRatio: calculateFillRatio(crop, outputProfile),
    widthFitScale: placement.scale,
    estimatedReadableScale: placement.scale,
    outputPageFillQuality: transform.mode === "margin-crop" ? "acceptable" : "figure-preserve",
    failureCategories: [],
    validation: {
      ok: true,
      issues: [],
      duplicateCropBounds: false,
      cropProgressionValid: true,
      breakDiagnosticsPresent: true
    }
  };
  const region: AcademicRegionPlan = {
    regionId,
    kind,
    sourceBounds: bounds,
    contentBounds: bounds,
    safeCropBounds: bounds,
    textLayerAvailable: Boolean(transform.debug?.textLayerAvailable),
    textRowsDetected: transform.debug?.textRowsDetected ?? 0,
    regionQuality: transform.mode === "margin-crop" ? "mixed" : "unsafe"
  };

  const summary = {
    sourceRegionCount: 1,
    outputPageCount: 1,
    verticalBreakCount: 0,
    outputPageCountByRegion: { [regionId]: 1 },
    breakCoverageComplete: true,
    failureCategories: [] as AcademicFailureCategory[],
    repairedFailures: [] as AcademicFailureCategory[],
    unrepairedFailures: [] as AcademicFailureCategory[],
    repairActionsApplied: [] as string[]
  };
  const quality = evaluateProductQuality(transform, outputProfile, [outputPage], summary);

  return {
    sourcePageNumber: transform.sourcePageNumber,
    strategy: transform.mode === "margin-crop" ? "safe-margin-crop" : "unsafe-preserve",
    regions: [region],
    outputPages: [outputPage],
    validation: { ok: true, issues: [] },
    summary: {
      ...summary,
      productQualityGrade: quality.grade,
      productQualityScore: quality.score,
      productQualityIssues: quality.issues,
      qualityGatePassed: quality.passed,
      ...getProfileDiagnostics(outputProfile, [outputPage])
    }
  };
}

function buildUncertainMixedPreservePlan(
  transform: Extract<PageReadingTransform, { mode: "column-reading" }>,
  outputProfile: ReadingOutputProfile,
  titleRepair: TitleAuthorRepair
): AcademicSourcePagePlan {
  const bounds = {
    kind: "bounds" as const,
    left: 0,
    top: 0,
    right: 1,
    bottom: 1
  };
  const firstPagePolicy = classifyFirstPagePolicy(transform, titleRepair);
  const preserveAsIntentionalFirstPage = firstPagePolicy.firstPagePolicy === "title-plus-short-body-preserve" ||
    firstPagePolicy.firstPagePolicy === "preserve-title-abstract-page" ||
    firstPagePolicy.firstPagePolicy === "preserve-cover-page";
  const regionKind = preserveAsIntentionalFirstPage ? "full-width" : "unsafe";
  const region: AcademicRegionPlan = {
    regionId: `${transform.sourcePageNumber}-unsafe-mixed-layout`,
    kind: regionKind,
    sourceBounds: bounds,
    contentBounds: bounds,
    safeCropBounds: bounds,
    textLayerAvailable: Boolean(transform.debug?.textLayerAvailable),
    textRowsDetected: transform.debug?.textRowsDetected ?? 0,
    regionQuality: "unsafe"
  };
  const outputPage = buildPreservedRegionOutputPage(transform.sourcePageNumber, region, outputProfile);
  const issues = [`title-layout-uncertain: ${titleRepair.transition?.rejectionReason ?? "no evidence-based body transition"}`];

  const baseSummary = {
    sourceRegionCount: 1,
    outputPageCount: 1,
    verticalBreakCount: 0,
    outputPageCountByRegion: { [region.regionId]: 1 },
    breakCoverageComplete: true,
    failureCategories: [] as AcademicFailureCategory[],
    repairedFailures: ["title-author-split"] as AcademicFailureCategory[],
    unrepairedFailures: [] as AcademicFailureCategory[],
    repairActionsApplied: [`downgraded-to-preserve-page:${issues[0]}`],
    titleAuthorRepairApplied: false,
    fullWidthTitleRegionDetected: false,
    bodyRegionTop: undefined,
    layoutKind: titleRepair.transition?.layoutKind ?? "unknown",
    titleRegionContainsColumnRows: titleRepair.transition?.evidence.titleRegionContainsColumnRows ?? false,
    rowCoveragePassed: true,
    duplicatedTextRowsCount: 0,
    missingTextRowsCount: 0,
    unaccountedMissingRowsCount: 0,
    ignoredRowsCount: 0,
    ignoredRowsByReason: {},
    rowCoverageFailureReason: undefined,
    nearDuplicateOutputPages: false,
    shortPageCount: 0,
    badOrphanPageCount: 0,
    naturalShortFinalCount: 0,
    orphanRepairCount: 0,
    ...firstPagePolicy,
    titleStandaloneSuppressed: true,
    titleStandaloneSuppressionReason: firstPagePolicy.firstPagePolicy === "title-plus-short-body-preserve"
      ? "short-asymmetric-body-preserved-with-title"
      : "title-body-transition-uncertain",
    firstPagePreserveReason: titleRepair.transition?.rejectionReason ?? "title-layout-uncertain",
    firstPageQualityWarning: firstPagePolicy.firstPagePolicy === "title-plus-short-body-preserve"
      ? "first-page-preserved-short-body"
      : "first-page-preserved-for-safety",
    firstPagePreserveUserMessage: "Title/cover page preserved for safety. Body pages optimized for reading.",
    firstPagePreserveIsExpectedBehavior: preserveAsIntentionalFirstPage,
    bodyPagesOptimizedAfterFirstPage: preserveAsIntentionalFirstPage,
    continuousFlowEnabled: false,
    ...getProfileDiagnostics(outputProfile, [outputPage]),
    ...getPageClassSummary(classifyAcademicPage(transform), false),
    ...getTransitionSummary(titleRepair.transition)
  };
  const quality = evaluateProductQuality(transform, outputProfile, [outputPage], baseSummary);

  return {
    sourcePageNumber: transform.sourcePageNumber,
    strategy: preserveAsIntentionalFirstPage ? "preserve-page" : "unsafe-preserve",
    regions: [region],
    outputPages: [outputPage],
    validation: { ok: true, issues: [] },
    summary: {
      ...baseSummary,
      productQualityGrade: quality.grade,
      productQualityScore: quality.score,
      productQualityIssues: quality.issues,
      qualityGatePassed: quality.passed
    }
  };
}

function getTransitionSummary(transition?: AcademicLayoutTransition) {
  const candidates = transition?.evidence.transitionCandidates ?? [];
  const bestTransitionCandidate = candidates.length > 0
    ? [...candidates].sort((a, b) => b.score - a.score)[0]
    : undefined;

  return {
    transitionCandidates: candidates,
    bestTransitionCandidate,
    transitionConfidence: transition?.confidence,
    transitionRejectionReason: transition?.rejectionReason
  };
}

type TitleAuthorRepair = {
  applied: boolean;
  bodyRegionTop: number;
  region?: AcademicRegionPlan;
  transition?: AcademicLayoutTransition;
};

type FirstPagePolicyResult = {
  firstPagePolicy: NonNullable<AcademicSourcePagePlan["summary"]["firstPagePolicy"]>;
  firstPagePolicyReason: string;
  titleRowsCount: number;
  authorRowsCount: number;
  abstractRowsCount: number;
  bodyRowsBelowTitle: number;
  leftBodyRowsBelowTitle: number;
  rightBodyRowsBelowTitle: number;
  bodySymmetryRatio: number;
  bodyWorthExtracting: boolean;
  firstPageSplitConfidence: number;
  firstPagePreservedForSafety: boolean;
  firstPagePreservedShortBody: boolean;
  shortAsymmetricBodyDetected: boolean;
};

type AcademicPageClassification = {
  academicPageClass: AcademicPageClass;
  pageClassReason: string;
  mixedSplitReason?: NonNullable<AcademicSourcePagePlan["summary"]["mixedSplitReason"]>;
  titleDetectionApplicable: boolean;
  titleDetectionSkippedReason?: string;
  rawColumnDetectorSuggestedSplit: boolean;
};

function classifyAcademicPage(
  transform: Extract<PageReadingTransform, { mode: "column-reading" }>
): AcademicPageClassification {
  const rawDecision = transform.debug?.decision;
  const rawColumnDetectorSuggestedSplit = rawDecision === "split" || rawDecision === "mixed-split";
  const hasTitleLikeTopRows = hasTopFullWidthRows(transform.textRows ?? []);
  const isEarlyPage = transform.sourcePageNumber <= 1;

  if (rawDecision === "split") {
    return {
      academicPageClass: "body-two-column",
      pageClassReason: "raw-detector-clear-two-column",
      titleDetectionApplicable: false,
      titleDetectionSkippedReason: "clear-body-two-column-page",
      rawColumnDetectorSuggestedSplit
    };
  }

  if (rawDecision === "mixed-split") {
    if (isEarlyPage && hasTitleLikeTopRows) {
      return {
        academicPageClass: "first-page-title-plus-body",
        pageClassReason: "early-page-with-title-like-full-width-rows",
        mixedSplitReason: "title-header-plus-body",
        titleDetectionApplicable: true,
        rawColumnDetectorSuggestedSplit
      };
    }

    return {
      academicPageClass: "body-two-column",
      pageClassReason: "mixed-split-treated-as-body-columns",
      mixedSplitReason: hasTitleLikeTopRows ? "body-columns-with-noisy-header" : "partial-two-column-body",
      titleDetectionApplicable: false,
      titleDetectionSkippedReason: isEarlyPage ? "no-strong-title-like-evidence" : "not-first-page",
      rawColumnDetectorSuggestedSplit
    };
  }

  return {
    academicPageClass: "unsafe",
    pageClassReason: "raw-detector-not-split",
    titleDetectionApplicable: false,
    titleDetectionSkippedReason: "raw-detector-not-split",
    rawColumnDetectorSuggestedSplit
  };
}

function hasTopFullWidthRows(rows: NonNullable<PageReadingTransform["textRows"]>): boolean {
  return rows.filter((row) => {
    const width = row.right - row.left;
    const center = (row.left + row.right) / 2;
    return row.top < 0.22 && width > 0.32 && center > 0.35 && center < 0.65;
  }).length >= 2;
}

function getPageClassSummary(
  pageClass: AcademicPageClassification,
  bodyColumnExtractionSucceeded: boolean
) {
  return {
    academicPageClass: pageClass.academicPageClass,
    pageClassReason: pageClass.pageClassReason,
    mixedSplitReason: pageClass.mixedSplitReason,
    titleDetectionApplicable: pageClass.titleDetectionApplicable,
    titleDetectionSkippedReason: pageClass.titleDetectionSkippedReason,
    bodyColumnExtractionAttempted: pageClass.rawColumnDetectorSuggestedSplit,
    bodyColumnExtractionSucceeded,
    rawColumnDetectorSuggestedSplit: pageClass.rawColumnDetectorSuggestedSplit,
    plannerAcceptedColumnSplit: bodyColumnExtractionSucceeded,
    plannerRejectedColumnSplitReason: bodyColumnExtractionSucceeded ? undefined : "title-layout-uncertain"
  };
}

function getTitleAuthorRepair(
  transform: Extract<PageReadingTransform, { mode: "column-reading" }>
): TitleAuthorRepair {
  if (transform.debug?.decision !== "mixed-split") {
    return { applied: false, bodyRegionTop: 0 };
  }

  const top = Math.min(...transform.columns.map((column) => column.crop.top));
  const bottomLimit = Math.min(...transform.columns.map((column) => 1 - column.crop.bottom));
  const leftColumn = transform.columns.find((column) => column.column === "left") ?? transform.columns[0];
  const rightColumn = transform.columns.find((column) => column.column === "right") ?? transform.columns[1] ?? transform.columns[0];
  const transition = detectAcademicLayoutTransitions(
    transform.textRows ?? [],
    {
      pageTop: 0,
      pageBottom: bottomLimit,
      gutterLeft: 1 - leftColumn.crop.right,
      gutterRight: rightColumn.crop.left,
      minRowsPerColumnBelow: 3,
      minTitleRowsAbove: 1,
      maxSearchBottom: Math.min(0.48, bottomLimit - 0.18),
      minWhitespaceGap: 0.01
    }
  );
  const bodyRegionTop = transition.layoutKind === "full-width-title-plus-two-column-body"
    ? transition.bodyRegionTop ?? 0
    : 0;
  const strongFirstPageSplit = isStrongFirstPageSplit(transition);

  if (
    transition.layoutKind !== "full-width-title-plus-two-column-body" ||
    !strongFirstPageSplit ||
    transition.evidence.titleRegionContainsColumnRows ||
    !Number.isFinite(bodyRegionTop) ||
    bodyRegionTop <= top ||
    bodyRegionTop >= bottomLimit
  ) {
    return { applied: false, bodyRegionTop: 0, transition };
  }

  const bounds = transition.titleRegion ?? cropFractionsToBounds({
    left: Math.min(...transform.columns.map((column) => column.crop.left)),
    top,
    right: Math.min(...transform.columns.map((column) => column.crop.right)),
    bottom: 1 - bodyRegionTop
  });

  return {
    applied: true,
    bodyRegionTop,
    transition,
    region: {
      regionId: `${transform.sourcePageNumber}-full-width-title`,
      kind: "full-width-title",
      sourceBounds: bounds,
      contentBounds: bounds,
      safeCropBounds: bounds,
      textLayerAvailable: Boolean(transform.debug?.textLayerAvailable),
      textRowsDetected: transform.debug?.textRowsDetected ?? 0,
      regionQuality: "mixed"
    }
  };
}

const FIRST_PAGE_POLICY_THRESHOLDS = {
  minBodyRowsBelowForSplit: 6,
  minRowsPerSideForFirstPageSplit: 3,
  minFirstPageBodySymmetryRatio: 0.35,
  minFirstPageTransitionConfidence: 0.78
};

function isStrongFirstPageSplit(transition: AcademicLayoutTransition): boolean {
  if (transition.layoutKind !== "full-width-title-plus-two-column-body") return false;
  const left = transition.evidence.leftRowsBelow;
  const right = transition.evidence.rightRowsBelow;
  const total = left + right;
  const symmetry = Math.min(left, right) / Math.max(left, right, 1);

  return total >= FIRST_PAGE_POLICY_THRESHOLDS.minBodyRowsBelowForSplit &&
    left >= FIRST_PAGE_POLICY_THRESHOLDS.minRowsPerSideForFirstPageSplit &&
    right >= FIRST_PAGE_POLICY_THRESHOLDS.minRowsPerSideForFirstPageSplit &&
    symmetry >= FIRST_PAGE_POLICY_THRESHOLDS.minFirstPageBodySymmetryRatio &&
    transition.confidence >= FIRST_PAGE_POLICY_THRESHOLDS.minFirstPageTransitionConfidence;
}

function classifyFirstPagePolicy(
  transform: Extract<PageReadingTransform, { mode: "column-reading" }>,
  titleRepair: TitleAuthorRepair
): FirstPagePolicyResult {
  const transition = titleRepair.transition;
  const bestCandidate = getTransitionSummary(transition).bestTransitionCandidate;
  const transitionEvidence = transition?.layoutKind === "full-width-title-plus-two-column-body" ? transition.evidence : undefined;
  const titleRowsCount = transitionEvidence?.rowsAboveClassifiedAsTitleOrFullWidth ?? bestCandidate?.rowsAboveClassifiedAsTitleOrFullWidth ?? 0;
  const fallbackBodyRows = getApproximateFirstPageBodyRows(transform.textRows ?? []);
  const leftBodyRowsBelowTitle = transitionEvidence?.leftRowsBelow ?? bestCandidate?.leftRowsBelow ?? fallbackBodyRows.left;
  const rightBodyRowsBelowTitle = transitionEvidence?.rightRowsBelow ?? bestCandidate?.rightRowsBelow ?? fallbackBodyRows.right;
  const bodyRowsBelowTitle = leftBodyRowsBelowTitle + rightBodyRowsBelowTitle;
  const bodySymmetryRatio = Math.min(leftBodyRowsBelowTitle, rightBodyRowsBelowTitle) /
    Math.max(leftBodyRowsBelowTitle, rightBodyRowsBelowTitle, 1);
  const firstPageSplitConfidence = transition?.confidence ?? bestCandidate?.score ?? 0;
  const shortBody = bodyRowsBelowTitle > 0 && bodyRowsBelowTitle < FIRST_PAGE_POLICY_THRESHOLDS.minBodyRowsBelowForSplit;
  const asymmetricBody = bodyRowsBelowTitle > 0 &&
    (Math.min(leftBodyRowsBelowTitle, rightBodyRowsBelowTitle) < FIRST_PAGE_POLICY_THRESHOLDS.minRowsPerSideForFirstPageSplit ||
      bodySymmetryRatio < FIRST_PAGE_POLICY_THRESHOLDS.minFirstPageBodySymmetryRatio);
  const bodyWorthExtracting = bodyRowsBelowTitle >= FIRST_PAGE_POLICY_THRESHOLDS.minBodyRowsBelowForSplit &&
    !asymmetricBody &&
    firstPageSplitConfidence >= FIRST_PAGE_POLICY_THRESHOLDS.minFirstPageTransitionConfidence;

  if (titleRepair.applied) {
    return {
      firstPagePolicy: "title-body-split",
      firstPagePolicyReason: "high-confidence-title-body-transition",
      titleRowsCount,
      authorRowsCount: 0,
      abstractRowsCount: 0,
      bodyRowsBelowTitle,
      leftBodyRowsBelowTitle,
      rightBodyRowsBelowTitle,
      bodySymmetryRatio,
      bodyWorthExtracting: true,
      firstPageSplitConfidence,
      firstPagePreservedForSafety: false,
      firstPagePreservedShortBody: false,
      shortAsymmetricBodyDetected: false
    };
  }

  if (shortBody || asymmetricBody) {
    return {
      firstPagePolicy: "title-plus-short-body-preserve",
      firstPagePolicyReason: shortBody ? "body-below-title-too-short-for-premium-extraction" : "body-below-title-too-asymmetric-for-safe-extraction",
      titleRowsCount,
      authorRowsCount: 0,
      abstractRowsCount: 0,
      bodyRowsBelowTitle,
      leftBodyRowsBelowTitle,
      rightBodyRowsBelowTitle,
      bodySymmetryRatio,
      bodyWorthExtracting: false,
      firstPageSplitConfidence,
      firstPagePreservedForSafety: true,
      firstPagePreservedShortBody: true,
      shortAsymmetricBodyDetected: true
    };
  }

  if (titleRowsCount > 0 && bodyRowsBelowTitle === 0) {
    return {
      firstPagePolicy: "preserve-title-abstract-page",
      firstPagePolicyReason: "title-or-abstract-page-without-reliable-body-columns",
      titleRowsCount,
      authorRowsCount: 0,
      abstractRowsCount: 0,
      bodyRowsBelowTitle,
      leftBodyRowsBelowTitle,
      rightBodyRowsBelowTitle,
      bodySymmetryRatio,
      bodyWorthExtracting: false,
      firstPageSplitConfidence,
      firstPagePreservedForSafety: true,
      firstPagePreservedShortBody: false,
      shortAsymmetricBodyDetected: false
    };
  }

  return {
    firstPagePolicy: "unsafe-preserve",
    firstPagePolicyReason: transition?.rejectionReason ?? transform.reason ?? "first-page-layout-uncertain",
    titleRowsCount,
    authorRowsCount: 0,
    abstractRowsCount: 0,
    bodyRowsBelowTitle,
    leftBodyRowsBelowTitle,
    rightBodyRowsBelowTitle,
    bodySymmetryRatio,
    bodyWorthExtracting,
    firstPageSplitConfidence,
    firstPagePreservedForSafety: true,
    firstPagePreservedShortBody: false,
    shortAsymmetricBodyDetected: false
  };
}

function getApproximateFirstPageBodyRows(rows: NonNullable<PageReadingTransform["textRows"]>): { left: number; right: number } {
  const lowerRows = rows.filter((row) => row.top >= 0.22);
  return {
    left: lowerRows.filter((row) => row.right <= 0.5 && row.left < 0.48).length,
    right: lowerRows.filter((row) => row.left >= 0.5 && row.right > 0.52).length
  };
}

function clampColumnTop(column: ColumnCrop, bodyRegionTop: number): ColumnCrop {
  const bottom = 1 - column.crop.bottom;
  const top = Math.min(Math.max(column.crop.top, bodyRegionTop), bottom - 0.08);

  return {
    ...column,
    crop: { ...column.crop, top },
    contentBounds: column.contentBounds
      ? { ...column.contentBounds, top: Math.max(column.contentBounds.top, top) }
      : undefined,
    breakFractions: column.breakFractions?.filter((value) => value > top && value < bottom),
    breakDetails: column.breakDetails?.filter((detail) => detail.position > top && detail.position < bottom)
  };
}

function applyTextRowWidthFitPagination(
  columns: ColumnCrop[],
  rows: TextLineRow[],
  outputProfile: ReadingOutputProfile
): ColumnCrop[] {
  if (rows.length === 0) return columns;

  return columns.map((column) => {
    if (hasUsableBreakDetails(column)) {
      const rowPagination = paginateColumnByTextRows(column, rows, outputProfile);
      const pagination = rebalanceShortFinalSlices(
        outputProfile.preferShorterSlices && rowPagination.breaks.length > (column.breakFractions?.length ?? 0)
          ? rowPagination
          : { breaks: column.breakFractions ?? [], details: column.breakDetails ?? [] },
        column,
        rows,
        outputProfile
      );
      if (pagination.breaks.length === 0) {
        return {
          ...column,
          breakFractions: [],
          breakDetails: [],
          breakStrategy: "smart",
          paginationMode: "single-column-page",
          paginationReason: "no-vertical-break-needed",
          outputTileCount: 1,
          verticalBreakCount: 0,
          breakCoverageComplete: true
        };
      }
      return {
        ...column,
        breakFractions: pagination.breaks,
        breakDetails: pagination.details
      };
    }

    const pagination = rebalanceShortFinalSlices(
      paginateColumnByTextRows(column, rows, outputProfile),
      column,
      rows,
      outputProfile
    );
    if (pagination.breaks.length === 0) {
      const attemptedBreaks = paginateColumnByTextRows(column, rows, outputProfile).breaks.length;
      if (attemptedBreaks > 0) {
        return {
          ...column,
          breakFractions: [],
          breakDetails: [],
          breakStrategy: "smart",
          paginationMode: "single-column-page",
          paginationReason: "no-vertical-break-needed",
          outputTileCount: 1,
          verticalBreakCount: 0,
          breakCoverageComplete: true
        };
      }
      return column;
    }

    return {
      ...column,
      breakFractions: pagination.breaks,
      breakDetails: pagination.details,
      breakStrategy: "smart"
    };
  });
}

function rebalanceShortFinalSlices(
  pagination: { breaks: number[]; details: TileBreakDetail[] },
  column: ColumnCrop,
  rows: TextLineRow[],
  outputProfile: ReadingOutputProfile
): { breaks: number[]; details: TileBreakDetail[] } {
  if (pagination.breaks.length === 0) return pagination;
  if (outputProfile.id === "kindle-reading") {
    return rebalanceKindleSlices(pagination, column, rows, outputProfile);
  }

  const columnBounds = cropFractionsToBounds(column.crop);
  const columnRows = rows
    .filter((row) => rowIntersectsBounds(row, columnBounds))
    .sort((a, b) => a.top - b.top);
  const finalBreak = pagination.breaks[pagination.breaks.length - 1];
  const finalRows = columnRows.filter((row) => (row.top + row.bottom) / 2 >= finalBreak);

  if (finalRows.length >= outputProfile.minRowsPerFinalPage) {
    return pagination;
  }

  const previousTop = pagination.breaks[pagination.breaks.length - 2] ?? columnBounds.top;
  const combinedHeight = columnBounds.bottom - previousTop;
  const sourceSliceHeight = Math.max(0.001, (columnBounds.right - columnBounds.left) / outputProfile.aspectRatio);

  if (combinedHeight <= sourceSliceHeight * 1.35) {
    return {
      breaks: pagination.breaks.slice(0, -1),
      details: pagination.details.slice(0, -1)
    };
  }

  return pagination;
}

function rebalanceKindleSlices(
  pagination: { breaks: number[]; details: TileBreakDetail[] },
  column: ColumnCrop,
  rows: TextLineRow[],
  outputProfile: ReadingOutputProfile
): { breaks: number[]; details: TileBreakDetail[] } {
  let breaks = [...pagination.breaks];
  let details = [...pagination.details];
  const columnBounds = cropFractionsToBounds(column.crop);
  const columnRows = rows
    .filter((row) => rowIntersectsBounds(row, columnBounds))
    .sort((a, b) => a.top - b.top);

  if (columnRows.length === 0) return pagination;

  let changed = true;
  while (changed && breaks.length > 0) {
    changed = false;
    const slices = getSliceRowCounts(columnBounds.top, columnBounds.bottom, breaks, columnRows);
    const tinyIndex = slices.findIndex((slice, index) =>
      slice.rows > 0 &&
      slice.rows < outputProfile.minRowsPerOutputPage &&
      (index < slices.length - 1 || slice.rows < outputProfile.minRowsPerFinalPage)
    );

    if (tinyIndex === -1) break;

    const mergeBeforeRows = tinyIndex > 0 ? slices[tinyIndex - 1].rows + slices[tinyIndex].rows : Number.POSITIVE_INFINITY;
    const mergeAfterRows = tinyIndex < slices.length - 1 ? slices[tinyIndex].rows + slices[tinyIndex + 1].rows : Number.POSITIVE_INFINITY;
    const canMergeBefore = mergeBeforeRows <= outputProfile.maxRowsPerSlice + 2;
    const canMergeAfter = mergeAfterRows <= outputProfile.maxRowsPerSlice + 2;

    if (canMergeBefore && (!canMergeAfter || mergeBeforeRows <= mergeAfterRows)) {
      const breakToRemove = tinyIndex - 1;
      breaks = breaks.filter((_, index) => index !== breakToRemove);
      details = details.filter((_, index) => index !== breakToRemove);
      changed = true;
    } else if (canMergeAfter) {
      const breakToRemove = tinyIndex;
      breaks = breaks.filter((_, index) => index !== breakToRemove);
      details = details.filter((_, index) => index !== breakToRemove);
      changed = true;
    } else {
      break;
    }
  }

  if (breaks.length > 0) {
    const slices = getSliceRowCounts(columnBounds.top, columnBounds.bottom, breaks, columnRows);
    const finalSlice = slices[slices.length - 1];
    const previousSlice = slices[slices.length - 2];
    const maxMergedRows = outputProfile.maxRowsPerSlice + 2;
    const lowUsefulFinalRows = outputProfile.minRowsPerSlice + 3;

    if (
      finalSlice &&
      previousSlice &&
      finalSlice.rows > 0 &&
      finalSlice.rows < lowUsefulFinalRows &&
      previousSlice.rows + finalSlice.rows <= maxMergedRows
    ) {
      breaks = breaks.slice(0, -1);
      details = details.slice(0, -1);
    }
  }

  return { breaks, details };
}

function getSliceRowCounts(
  top: number,
  bottom: number,
  breaks: number[],
  rows: TextLineRow[]
): Array<{ top: number; bottom: number; rows: number }> {
  const boundaries = [top, ...breaks, bottom];
  return Array.from({ length: boundaries.length - 1 }, (_, index) => {
    const sliceTop = boundaries[index];
    const sliceBottom = boundaries[index + 1];
    return {
      top: sliceTop,
      bottom: sliceBottom,
      rows: rows.filter((row) => {
        const center = (row.top + row.bottom) / 2;
        return center >= sliceTop && center < sliceBottom;
      }).length
    };
  });
}

function hasUsableBreakDetails(column: ColumnCrop): boolean {
  const breaks = column.breakFractions ?? [];
  const details = column.breakDetails ?? [];
  return breaks.length > 0 &&
    breaks.length === details.length &&
    details.every((detail) =>
      detail.finalBoundaryValid === true &&
      detail.lastResortFallback !== true &&
      detail.previousFinalBottom !== undefined &&
      detail.nextFinalTop !== undefined
    );
}

function paginateColumnByTextRows(
  column: ColumnCrop,
  rows: TextLineRow[],
  outputProfile: ReadingOutputProfile
): { breaks: number[]; details: TileBreakDetail[] } {
  const columnBounds = cropFractionsToBounds(column.crop);
  const columnRows = rows
    .filter((row) => rowIntersectsBounds(row, columnBounds))
    .sort((a, b) => a.top - b.top);

  const minimumRowsForPagination = Math.max(6, outputProfile.minRowsPerFinalPage + 2);
  if (columnRows.length < minimumRowsForPagination) {
    return { breaks: [], details: [] };
  }

  const columnWidth = Math.max(0.001, columnBounds.right - columnBounds.left);
  const columnHeight = Math.max(0.001, columnBounds.bottom - columnBounds.top);
  const medianLineHeight = getMedianLineHeight(columnRows);
  const baseSourceSliceHeight = columnWidth / outputProfile.aspectRatio;
  const rowLimitedSliceHeight = medianLineHeight * outputProfile.targetRowsPerSlice;
  const profileLimitedSliceHeight = columnHeight * outputProfile.maxSourceSliceHeightRatio;
  const sourceSliceHeight = Math.max(
    medianLineHeight * outputProfile.minRowsPerSlice,
    Math.min(
      baseSourceSliceHeight,
      profileLimitedSliceHeight,
      outputProfile.preferShorterSlices ? rowLimitedSliceHeight : baseSourceSliceHeight
    )
  );
  const maxOutputPages = Math.min(outputProfile.maxTilesPerColumn, outputProfile.maxOutputPagesPerSourcePage);
  const desiredByHeight = Math.ceil(columnHeight / sourceSliceHeight);
  const desiredByRows = outputProfile.preferShorterSlices
    ? Math.ceil(columnRows.length / outputProfile.targetRowsPerSlice)
    : Math.ceil(columnRows.length / outputProfile.maxRowsPerSlice);
  const desiredTileCount = Math.min(
    maxOutputPages,
    Math.max(1, desiredByHeight, desiredByRows)
  );
  const targetBreakCount = desiredTileCount - 1;
  const minRowsPerSlice = Math.max(2, Math.min(outputProfile.minRowsPerSlice, Math.floor(columnRows.length / desiredTileCount) - 1));
  const minFinalRows = Math.max(2, Math.min(outputProfile.minRowsPerFinalPage, minRowsPerSlice));
  const breaks: number[] = [];
  const details: TileBreakDetail[] = [];
  let startRowIndex = 0;
  let sliceTop = columnBounds.top;

  for (let breakIndex = 0; breakIndex < targetBreakCount; breakIndex += 1) {
    const remainingBreaks = targetBreakCount - breakIndex;
    const ideal = sliceTop + sourceSliceHeight;
    const latestAllowedIndex = columnRows.length - minFinalRows * remainingBreaks - 1;
    const earliestAllowedIndex = startRowIndex + minRowsPerSlice - 1;

    if (latestAllowedIndex < earliestAllowedIndex) break;

    const candidate = findBestTextRowBreak(columnRows, ideal, earliestAllowedIndex, latestAllowedIndex);
    if (!candidate) break;

    breaks.push(candidate.position);
    details.push(candidate.detail);
    startRowIndex = candidate.rowIndex + 1;
    sliceTop = candidate.detail.nextFinalTop ?? candidate.position;
  }

  return { breaks, details };
}

function findBestTextRowBreak(
  rows: TextLineRow[],
  ideal: number,
  earliestAllowedIndex: number,
  latestAllowedIndex: number
): { rowIndex: number; position: number; detail: TileBreakDetail } | undefined {
  let best: { rowIndex: number; distance: number; gapHeight: number; position: number; detail: TileBreakDetail } | undefined;
  const medianLineHeight = getMedianLineHeight(rows);

  for (let rowIndex = earliestAllowedIndex; rowIndex <= latestAllowedIndex; rowIndex += 1) {
    const current = rows[rowIndex];
    const next = rows[rowIndex + 1];
    if (!current || !next) continue;

    const gapTop = current.bottom;
    const gapBottom = Math.max(gapTop, next.top);
    const gapHeight = Math.max(0, gapBottom - gapTop);
    const position = gapHeight > 0 ? (gapTop + gapBottom) / 2 : gapTop;
    const distance = Math.abs(position - ideal);
    const kind = gapHeight >= medianLineHeight * 0.65 ? "paragraph-gap" : "line-gap";
    const detail: TileBreakDetail = {
      position,
      originalPosition: ideal,
      inkDensity: 0,
      breakKind: kind,
      originalBreakKind: kind,
      continuationMode: "clean-non-overlap",
      breakSource: "text-layer",
      boundaryRepaired: Math.abs(position - ideal) > 0.002,
      repairDirection: position < ideal ? "up" : position > ideal ? "down" : "none",
      expandedSearchUsed: distance > medianLineHeight * 2,
      safeCandidateFound: true,
      lastResortFallback: false,
      topBoundarySafe: true,
      bottomBoundarySafe: true,
      whitespaceBandTop: gapTop,
      whitespaceBandBottom: gapBottom,
      previousFinalBottom: gapTop,
      nextFinalTop: gapBottom,
      corridorHeight: gapHeight,
      corridorToLineHeightRatio: gapHeight / Math.max(medianLineHeight, 0.001),
      gapInkDensity: 0,
      maxCorridorRowInkDensity: 0,
      upperGuardInkDensity: 0,
      lowerGuardInkDensity: 0,
      maxAdjacentGuardInkDensity: 0,
      finalBoundaryValid: true
    };

    if (!best || distance < best.distance || (distance === best.distance && gapHeight > best.gapHeight)) {
      best = { rowIndex, distance, gapHeight, position, detail };
    }
  }

  return best ? { rowIndex: best.rowIndex, position: best.position, detail: best.detail } : undefined;
}

function rowIntersectsBounds(row: TextLineRow, bounds: ReturnType<typeof cropFractionsToBounds>): boolean {
  const verticalOverlap = Math.min(row.bottom, bounds.bottom) - Math.max(row.top, bounds.top);
  if (verticalOverlap <= 0) return false;
  const horizontalOverlap = Math.min(row.right, bounds.right) - Math.max(row.left, bounds.left);
  if (horizontalOverlap <= 0) return false;
  const rowWidth = Math.max(0.001, row.right - row.left);
  const boundsWidth = Math.max(0.001, bounds.right - bounds.left);
  return horizontalOverlap >= Math.min(rowWidth * 0.12, boundsWidth * 0.08, 0.035);
}

function getMedianLineHeight(rows: TextLineRow[]): number {
  const sorted = rows
    .map((row) => row.bottom - row.top)
    .filter((height) => Number.isFinite(height) && height > 0)
    .sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0.018;
}

function buildPreservedRegionOutputPage(
  sourcePageNumber: number,
  region: AcademicRegionPlan,
  outputProfile: ReadingOutputProfile
): AcademicOutputPagePlan {
  const crop = {
    left: region.safeCropBounds.left,
    top: region.safeCropBounds.top,
    right: 1 - region.safeCropBounds.right,
    bottom: 1 - region.safeCropBounds.bottom
  };
  const cropWidth = Math.max(0.001, 1 - crop.left - crop.right);
  const cropHeight = Math.max(0.001, 1 - crop.top - crop.bottom);
  const placement = calculateProfileDrawPlacement(cropWidth, cropHeight, outputProfile);
  const contentFillRatio = calculateFillRatio(crop, outputProfile);

  return {
    outputId: `${sourcePageNumber}-${region.regionId}-preserve`,
    sourcePageNumber,
    sourceRegionId: region.regionId,
    regionKind: region.kind,
    outputPageIndex: 1,
    sourceCropBounds: region.safeCropBounds,
    finalExportCropBounds: region.safeCropBounds,
    sourceCropFractions: crop,
    outputProfileId: outputProfile.id,
    placement,
    paginationMode: "full-width-preserve",
    contentFillRatio,
    widthFitScale: placement.scale,
    estimatedReadableScale: placement.scale,
    outputPageFillQuality: contentFillRatio < outputProfile.minFinalPageFillRatio ? "natural-short-final" : "acceptable",
    failureCategories: [],
    validation: {
      ok: true,
      issues: [],
      duplicateCropBounds: false,
      cropProgressionValid: true,
      breakDiagnosticsPresent: true
    }
  };
}

function getSourcePageFailureCategories(
  transform: Extract<PageReadingTransform, { mode: "column-reading" }>,
  regions: AcademicRegionPlan[],
  titleRepair: TitleAuthorRepair,
  pageClass: AcademicPageClassification
): AcademicFailureCategory[] {
  const failures: AcademicFailureCategory[] = [];
  const hasPreservedTitleRegion = regions.some((region) =>
    region.kind === "full-width-title" || region.kind === "full-width-abstract" || region.kind === "full-width"
  );

  if (transform.debug?.decision === "mixed-split" && pageClass.titleDetectionApplicable && !hasPreservedTitleRegion) {
    failures.push("title-author-split");
  }
  if (titleRepair.transition?.evidence.titleRegionContainsColumnRows) {
    failures.push("title-author-split");
  }

  return failures;
}

export function validateAcademicSourcePagePlan(plan: AcademicSourcePagePlan): PlanValidationResult {
  return validateAcademicSourcePageOutput(plan.outputPages);
}

function buildColumnRegionPlan(column: ColumnCrop, debug: PageReadingTransform["debug"]): AcademicRegionPlan {
  const sourceBounds = cropFractionsToBounds(column.crop);
  const regionId = `${column.sourcePageNumber}-${column.column}-column`;

  return {
    regionId,
    kind: column.column === "left" ? "left-column" : "right-column",
    sourceBounds,
    contentBounds: column.contentBounds ?? sourceBounds,
    safeCropBounds: sourceBounds,
    textLayerAvailable: Boolean(debug?.textLayerAvailable),
    textRowsDetected: debug?.textRowsDetected ?? 0,
    regionQuality: "text-heavy"
  };
}

function buildOutputPagePlan(
  tile: ReadingTile,
  index: number,
  outputProfile: ReadingOutputProfile,
  breakDiagnostics: { before?: TileBoundaryDiagnostics; after?: TileBoundaryDiagnostics }
): AcademicOutputPagePlan {
  const bounds = cropFractionsToBounds(tile.crop);
  const cropWidth = Math.max(0.001, 1 - tile.crop.left - tile.crop.right);
  const cropHeight = Math.max(0.001, 1 - tile.crop.top - tile.crop.bottom);
  const placement = calculateProfileDrawPlacement(cropWidth, cropHeight, outputProfile);
  const contentFillRatio = tile.contentFillRatio ?? calculateFillRatio(tile.crop, outputProfile);
  const outputPageFillQuality = getFillQuality(contentFillRatio, tile, outputProfile);
  const availableOutputWidth = outputProfile.pageWidth * (1 - outputProfile.outputSideMarginRatio * 2);
  const availableOutputHeight = outputProfile.pageHeight * (1 - outputProfile.outputTopMarginRatio - outputProfile.outputBottomMarginRatio);

  return {
    outputId: getOutputId(tile, index),
    sourcePageNumber: tile.sourcePageNumber,
    sourceRegionId: `${tile.sourcePageNumber}-${tile.column ?? "full"}-column`,
    regionKind: tile.column === "right" ? "right-column" : "left-column",
    outputPageIndex: tile.tileIndex,
    sourceCropBounds: bounds,
    finalExportCropBounds: bounds,
    sourceCropFractions: tile.crop,
    outputProfileId: tile.outputProfileId,
    placement,
    paginationMode: getOutputPaginationMode(tile),
    contentFillRatio,
    widthFitScale: tile.widthFitScale ?? placement.scale,
    estimatedReadableScale: tile.widthFitScale ?? placement.scale,
    availableOutputWidth,
    availableOutputHeight,
    sourceCropWidth: cropWidth,
    sourceCropHeight: cropHeight,
    drawnContentWidth: placement.width,
    drawnContentHeight: placement.height,
    horizontalFillRatio: placement.width / Math.max(1, availableOutputWidth),
    verticalFillRatio: placement.height / Math.max(1, availableOutputHeight),
    blankAreaRatio: 1 - contentFillRatio,
    sourceSliceHeight: cropHeight,
    effectiveSourceSliceHeight: cropHeight,
    targetRowsPerSlice: outputProfile.targetRowsPerSlice,
    maxRowsPerSlice: outputProfile.maxRowsPerSlice,
    profileLimitedSliceHeight: outputProfile.preferShorterSlices && cropHeight <= outputProfile.maxSourceSliceHeightRatio + 0.002,
    sliceHeightLimitReason: outputProfile.preferShorterSlices ? "profile-row-and-height-cap" : undefined,
    kindleReadable: outputProfile.id !== "kindle-reading" ||
      ((tile.widthFitScale ?? placement.scale) >= outputProfile.minReadableScale &&
        contentFillRatio >= outputProfile.minFinalPageFillRatio),
    outputPageFillQuality,
    failureCategories: [],
    breakBefore: breakDiagnostics.before,
    breakAfter: breakDiagnostics.after,
    validation: {
      ok: true,
      issues: [],
      duplicateCropBounds: false,
      cropProgressionValid: true,
      breakDiagnosticsPresent: true
    }
  };
}

function getColumnBreakDiagnostics(
  columns: ColumnCrop[],
  tile: ReadingTile
): { before?: TileBoundaryDiagnostics; after?: TileBoundaryDiagnostics } {
  const column = columns.find((item) => item.sourcePageNumber === tile.sourcePageNumber && item.column === tile.column);
  const beforeDetail = tile.tileIndex > 1 ? column?.breakDetails?.[tile.tileIndex - 2] : undefined;
  const afterDetail = tile.tileIndex < tile.tileCount ? column?.breakDetails?.[tile.tileIndex - 1] : undefined;

  return {
    before: beforeDetail
      ? toBoundaryDiagnostics(beforeDetail, tile.column ?? "left")
      : tile.tileIndex > 1 && tile.paginationMode === "multi-tile-last-resort"
        ? toLastResortBoundaryDiagnostics(tile, "before")
        : undefined,
    after: afterDetail
      ? toBoundaryDiagnostics(afterDetail, tile.column ?? "left")
      : tile.tileIndex < tile.tileCount && tile.paginationMode === "multi-tile-last-resort"
        ? toLastResortBoundaryDiagnostics(tile, "after")
        : undefined
  };
}

function annotateShortPages(
  outputPages: AcademicOutputPagePlan[],
  rows: TextLineRow[],
  outputProfile: ReadingOutputProfile
): AcademicOutputPagePlan[] {
  const safetyAdjustedPages = outputProfile.id === "kindle-reading"
    ? outputPages.map((page) => applyVerticalBoundarySafety(page, rows))
    : outputPages;
  const byRegion = groupByRegion(safetyAdjustedPages);
  return safetyAdjustedPages.map((page) => {
    const regionPages = byRegion.get(page.sourceRegionId) ?? [page];
    const sorted = [...regionPages].sort((a, b) => a.outputPageIndex - b.outputPageIndex);
    const regionIndex = sorted.findIndex((item) => item.outputId === page.outputId);
    const isFinalSliceInRegion = regionIndex === sorted.length - 1;
    const rowsOnPage = rows.filter((row) => rowIntersectsOutputPage(row, page, 0.0015)).length;
    const bodyTextCharsOnPage = rowsOnPage * 42;
    const isKindle = outputProfile.id === "kindle-reading";
    const kindleReadable = !isKindle ||
      (rowsOnPage <= outputProfile.maxRowsPerSlice &&
        page.estimatedReadableScale >= outputProfile.minReadableScale &&
        page.contentFillRatio >= outputProfile.minFinalPageFillRatio);
    const minRowsPerUsefulPage = isKindle
      ? isFinalSliceInRegion ? outputProfile.minRowsPerFinalPage : outputProfile.minRowsPerOutputPage
      : isFinalSliceInRegion ? outputProfile.minRowsPerFinalPage : outputProfile.minRowsPerMiddlePage;
    const shortPageDetected = page.regionKind !== "full-width-title" &&
      page.regionKind !== "unsafe" &&
      rowsOnPage > 0 &&
      rowsOnPage < minRowsPerUsefulPage;
    const shortPageKind = getShortPageKind(page, shortPageDetected, isFinalSliceInRegion, outputProfile);

    return {
      ...page,
      rowsOnPage,
      bodyTextCharsOnPage,
      isFinalSliceInRegion,
      previousPageCanAbsorb: regionIndex > 0 && shortPageDetected,
      nextPageCanAbsorb: regionIndex < sorted.length - 1 && shortPageDetected,
      naturalEndingEvidence: shortPageKind === "natural-short-final" ? "final-slice-at-end-of-source-region" : undefined,
      shortPageDetected,
      shortPageKind,
      minRowsPerUsefulPage,
      targetRowsPerSlice: outputProfile.targetRowsPerSlice,
      maxRowsPerSlice: outputProfile.maxRowsPerSlice,
      profileLimitedSliceHeight: outputProfile.preferShorterSlices && rowsOnPage > 0 && rowsOnPage <= outputProfile.targetRowsPerSlice + 2,
      sliceHeightLimitReason: outputProfile.preferShorterSlices ? "profile-target-rows-per-slice" : page.sliceHeightLimitReason,
      kindleReadable,
      kindleOverFragmentationDetected: isKindle && shortPageDetected,
      kindleOrphanRepairAttempted: isKindle && shortPageDetected,
      kindleOrphanRepairStatus: isKindle && shortPageDetected
        ? shortPageKind === "natural-short-final" ? "kept-natural-final" : "remaining-tiny-slice"
        : "not-needed",
      orphanRepairAttempted: shortPageDetected,
      orphanRepairStatus: shortPageDetected
        ? shortPageKind === "natural-short-final" ? "kept-natural-final" : "unsafe-to-repair"
        : "not-needed",
      mergedWithPrevious: false,
      redistributedRows: false
    };
  });
}

function applyVerticalBoundarySafety(
  page: AcademicOutputPagePlan,
  rows: TextLineRow[]
): AcademicOutputPagePlan {
  if (page.regionKind !== "left-column" && page.regionKind !== "right-column") {
    return page;
  }

  const bounds = page.sourceCropBounds;
  const relevantRows = rows.filter((row) => {
    const horizontalOverlap = Math.min(row.right, bounds.right) - Math.max(row.left, bounds.left);
    return horizontalOverlap > 0;
  });
  const padding = 0.0025;
  const sortedRows = [...relevantRows].sort((a, b) => a.top - b.top);
  const repairedTop = repairKindleBoundary(
    bounds.top,
    sortedRows,
    page.outputPageIndex <= 1 ? "before-row" : "after-row",
    padding
  );
  const repairedBottom = repairKindleBoundary(bounds.bottom, sortedRows, "after-row", padding);
  const repairedBounds = {
    ...bounds,
    top: Math.max(0, Math.min(repairedTop, repairedBottom - 0.002)),
    bottom: Math.min(1, Math.max(repairedBottom, repairedTop + 0.002))
  };
  const verticalGlyphPaddingApplied = Math.abs(repairedBounds.top - bounds.top) + Math.abs(repairedBounds.bottom - bounds.bottom);
  const topBoundaryCutsRow = relevantRows.some((row) => row.top < repairedBounds.top && row.bottom > repairedBounds.top);
  const bottomBoundaryCutsRow = relevantRows.some((row) => row.top < repairedBounds.bottom && row.bottom > repairedBounds.bottom);
  const nearestTopRowDistance = getNearestRowBoundaryDistance(repairedBounds.top, relevantRows);
  const nearestBottomRowDistance = getNearestRowBoundaryDistance(repairedBounds.bottom, relevantRows);
  const textClippingRisk = topBoundaryCutsRow || bottomBoundaryCutsRow;

  return {
    ...page,
    sourceCropBounds: repairedBounds,
    finalExportCropBounds: repairedBounds,
    sourceCropFractions: {
      ...page.sourceCropFractions,
      top: repairedBounds.top,
      bottom: 1 - repairedBounds.bottom
    },
    topBoundaryCutsRow,
    bottomBoundaryCutsRow,
    nearestTopRowDistance,
    nearestBottomRowDistance,
    verticalGlyphPaddingApplied,
    repairedBoundaryForKindle: verticalGlyphPaddingApplied > 0,
    exportBoundaryValidationPassed: !textClippingRisk,
    normalizedCropBounds: repairedBounds,
    pdfLibCropBounds: repairedBounds,
    pdfLibCropValidationPassed: !textClippingRisk,
    previewExportCropDelta: 0,
    textClippingRisk,
    cropBoundaryValidationPassed: !textClippingRisk
  };
}

function repairKindleBoundary(
  boundary: number,
  rows: TextLineRow[],
  direction: "before-row" | "after-row",
  padding: number
): number {
  let repaired = Math.max(0, Math.min(1, boundary));

  for (let attempt = 0; attempt < rows.length + 2; attempt += 1) {
    const cutIndex = rows.findIndex((row) => row.top < repaired && row.bottom > repaired);
    if (cutIndex === -1) return repaired;

    const cutRow = rows[cutIndex];
    if (direction === "before-row") {
      const previous = rows[cutIndex - 1];
      if (previous && cutRow.top - previous.bottom > padding * 2) {
        repaired = (previous.bottom + cutRow.top) / 2;
      } else {
        repaired = Math.max(0, cutRow.top - padding);
      }
    } else {
      const next = rows[cutIndex + 1];
      if (next && next.top - cutRow.bottom > padding * 2) {
        repaired = (cutRow.bottom + next.top) / 2;
      } else {
        repaired = Math.min(1, cutRow.bottom + padding);
      }
    }
  }

  return repaired;
}

function getNearestRowBoundaryDistance(boundary: number, rows: TextLineRow[]): number {
  if (rows.length === 0) return 1;
  return Math.min(...rows.flatMap((row) => [
    Math.abs(boundary - row.top),
    Math.abs(boundary - row.bottom)
  ]));
}

function getShortPageKind(
  page: AcademicOutputPagePlan,
  shortPageDetected: boolean,
  isFinalSliceInRegion: boolean,
  outputProfile: ReadingOutputProfile
): ShortPageKind {
  if (!shortPageDetected) return "not-short";
  if (page.paginationMode === "last-resort") return "last-resort-short";
  if (!isFinalSliceInRegion) return "bad-orphan-middle";
  if (outputProfile.allowNaturalShortFinalPage && page.contentFillRatio >= outputProfile.minFinalPageFillRatio * 0.6) {
    return "natural-short-final";
  }
  return "bad-orphan-final";
}

function summarizeShortPages(
  outputPages: AcademicOutputPagePlan[],
  transform: Extract<PageReadingTransform, { mode: "column-reading" }>,
  titleRepair: TitleAuthorRepair
) {
  const shortPages = outputPages.filter((page) => page.shortPageDetected);
  const badOrphans = shortPages.filter((page) =>
    page.shortPageKind === "bad-orphan-final" || page.shortPageKind === "bad-orphan-middle"
  );
  return {
    shortPageCount: shortPages.length,
    badOrphanPageCount: badOrphans.length,
    naturalShortFinalCount: shortPages.filter((page) => page.shortPageKind === "natural-short-final").length,
    orphanRepairCount: outputPages.filter((page) => page.mergedWithPrevious || page.redistributedRows).length,
    ...(transform.sourcePageNumber === 1
      ? classifyFirstPagePolicy(transform, titleRepair)
      : { firstPagePolicy: undefined }),
    titleStandaloneSuppressed: false,
    titleStandaloneSuppressionReason: undefined,
    firstPagePreserveReason: undefined,
    firstPageQualityWarning: transform.sourcePageNumber === 1 && !titleRepair.applied && transform.debug?.decision === "mixed-split"
      ? "first-page-preserved-for-safety"
      : undefined,
    firstPagePreserveUserMessage: transform.sourcePageNumber === 1 && !titleRepair.applied && transform.debug?.decision === "mixed-split"
      ? "Title/cover page preserved for safety. Body pages optimized for reading."
      : undefined,
    firstPagePreserveIsExpectedBehavior: transform.sourcePageNumber === 1 && !titleRepair.applied && transform.debug?.decision === "mixed-split",
    bodyPagesOptimizedAfterFirstPage: transform.sourcePageNumber === 1 && !titleRepair.applied && transform.debug?.decision === "mixed-split",
    continuousFlowEnabled: false
  };
}

function getProfileDiagnostics(
  outputProfile: ReadingOutputProfile,
  outputPages: AcademicOutputPagePlan[]
) {
  const kindlePages = outputProfile.id === "kindle-reading"
    ? outputPages.filter((page) => page.regionKind === "left-column" || page.regionKind === "right-column")
    : [];
  const kindleTallPages = kindlePages.filter((page) =>
    (page.rowsOnPage ?? 0) > outputProfile.maxRowsPerSlice ||
    (page.sourceCropHeight ?? 0) > outputProfile.maxSourceSliceHeightRatio + 0.002
  );
    const kindleUnreadablePages = kindlePages.filter((page) => page.kindleReadable === false);
  const kindleRows = kindlePages.map((page) => page.rowsOnPage ?? 0).filter((rows) => rows > 0);
  const kindleFills = kindlePages.map((page) => page.contentFillRatio).filter((value) => Number.isFinite(value));
  const kindleVerticalFills = kindlePages.map((page) => page.verticalFillRatio ?? 0).filter((value) => Number.isFinite(value) && value > 0);
  const tinySliceCount = kindleRows.filter((rows) => rows > 0 && rows <= 4).length;
  const singleSentenceSliceCount = kindleRows.filter((rows) => rows > 0 && rows <= 4).length;
  const kindleCropBoundaryRiskCount = kindlePages.filter((page) => page.textClippingRisk).length;
  const kindleLowFillPageCount = kindlePages.filter((page) =>
    page.shortPageKind !== "natural-short-final" &&
    (page.contentFillRatio < outputProfile.minFinalPageFillRatio || (page.verticalFillRatio ?? 1) < 0.42)
  ).length;
  const kindleOverFragmentationDetected = outputProfile.id === "kindle-reading" &&
    tinySliceCount > 0 &&
    tinySliceCount / Math.max(kindleRows.length, 1) > 0.2;
  const kindleComfortBalancePassed = outputProfile.id !== "kindle-reading" ||
    (!kindleOverFragmentationDetected && tinySliceCount === 0 && kindleLowFillPageCount === 0);

  return {
    selectedOutputProfileId: outputProfile.id,
    outputPageWidth: outputProfile.pageWidth,
    outputPageHeight: outputProfile.pageHeight,
    outputMargins: {
      top: outputProfile.outputTopMarginRatio,
      bottom: outputProfile.outputBottomMarginRatio,
      side: outputProfile.outputSideMarginRatio
    },
    targetReadableScale: outputProfile.targetReadableScale,
    minReadableScale: outputProfile.minReadableScale,
    maxSourceSliceHeightRatio: outputProfile.maxSourceSliceHeightRatio,
    targetRowsPerSlice: outputProfile.targetRowsPerSlice,
    maxRowsPerSlice: outputProfile.maxRowsPerSlice,
    minRowsPerSlice: outputProfile.minRowsPerSlice,
    preferShorterSlices: outputProfile.preferShorterSlices,
    allowMoreOutputPages: outputProfile.allowMoreOutputPages,
    profileAggressiveness: outputProfile.profileAggressiveness,
    kindleTallSliceCount: kindleTallPages.length,
    kindleReadablePageCount: kindlePages.length - kindleUnreadablePages.length,
    kindleUnreadablePageCount: kindleUnreadablePages.length,
    kindleOverFragmentationDetected,
    rowsPerSliceDistribution: kindleRows,
    medianRowsPerKindlePage: median(kindleRows),
    minRowsPerKindlePage: kindleRows.length > 0 ? Math.min(...kindleRows) : undefined,
    tinySliceCount,
    singleSentenceSliceCount,
    kindlePageFillMedian: median(kindleFills),
    kindlePageFillMin: kindleFills.length > 0 ? Math.min(...kindleFills) : undefined,
    kindleMedianVerticalFillRatio: median(kindleVerticalFills),
    kindleMinVerticalFillRatio: kindleVerticalFills.length > 0 ? Math.min(...kindleVerticalFills) : undefined,
    kindleLowFillPageCount,
    kindleComfortBalanceApplied: outputProfile.id === "kindle-reading",
    kindleComfortBalancePassed,
    kindleMicroZoomApplied: outputProfile.id === "kindle-reading",
    kindleZoomPolishApplied: outputProfile.id === "kindle-reading",
    oldKindleMargins: outputProfile.id === "kindle-reading" ? { top: 0.034, bottom: 0.034, side: 0.026 } : undefined,
    newKindleMargins: outputProfile.id === "kindle-reading"
      ? {
          top: outputProfile.outputTopMarginRatio,
          bottom: outputProfile.outputBottomMarginRatio,
          side: outputProfile.outputSideMarginRatio
        }
      : undefined,
    oldTargetReadableScale: outputProfile.id === "kindle-reading" ? 1.08 : undefined,
    newTargetReadableScale: outputProfile.id === "kindle-reading" ? outputProfile.targetReadableScale : undefined,
    availableWidthBefore: outputProfile.id === "kindle-reading" ? outputProfile.pageWidth * (1 - 0.026 * 2) : undefined,
    availableWidthAfter: outputProfile.id === "kindle-reading"
      ? outputProfile.pageWidth * (1 - outputProfile.outputSideMarginRatio * 2)
      : undefined,
    estimatedTextScaleBefore: outputProfile.id === "kindle-reading" && kindlePages[0]?.sourceCropWidth
      ? (1 - 0.026 * 2) / Math.max(kindlePages[0].sourceCropWidth, 0.001)
      : undefined,
    estimatedTextScaleAfter: outputProfile.id === "kindle-reading" && kindlePages[0]?.sourceCropWidth
      ? (1 - outputProfile.outputSideMarginRatio * 2) / Math.max(kindlePages[0].sourceCropWidth, 0.001)
      : undefined,
    expectedTextScaleGainPercent: outputProfile.id === "kindle-reading"
      ? ((1 - outputProfile.outputSideMarginRatio * 2) / (1 - 0.026 * 2) - 1) * 100
      : undefined,
    kindleCropBoundaryRiskCount,
    kindleOrphanRepairAttemptedCount: kindlePages.filter((page) => page.kindleOrphanRepairAttempted || page.orphanRepairAttempted).length,
    kindleOrphanRepairSucceededCount: kindlePages.filter((page) =>
      page.kindleOrphanRepairStatus === "merged-with-neighbor" ||
      page.orphanRepairStatus === "merged-with-previous" ||
      page.orphanRepairStatus === "rebalanced"
    ).length
  };
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function toBoundaryDiagnostics(
  detail: NonNullable<ColumnCrop["breakDetails"]>[number],
  column: "left" | "right"
): TileBoundaryDiagnostics {
  return {
    ...detail,
    column,
    overlapRatio: detail.continuationMode === "emergency-overlap" ? 0.002 : 0,
    overlapBeforeRepair: 0,
    overlapAfterRepair: 0,
    estimatedLineHeight: detail.corridorHeight && detail.corridorToLineHeightRatio
      ? detail.corridorHeight / Math.max(detail.corridorToLineHeightRatio, 0.001)
      : 0.022,
    duplicateBoundaryLikely: detail.finalBoundaryValid !== true || detail.lastResortFallback === true,
    continuityRepairApplied: Boolean(detail.boundaryRepaired),
    excessiveOverlap: false
  };
}

function toLastResortBoundaryDiagnostics(
  tile: ReadingTile,
  edge: "before" | "after"
): TileBoundaryDiagnostics {
  const position = edge === "before" ? tile.crop.top : 1 - tile.crop.bottom;

  return {
    position,
    originalPosition: position,
    inkDensity: 1,
    breakKind: tile.breakKind ?? "fallback-dense",
    originalBreakKind: "fallback-dense",
    continuationMode: tile.continuationMode ?? "emergency-overlap",
    breakSource: "fallback",
    column: tile.column ?? "left",
    overlapRatio: tile.overlapRatio ?? 0,
    overlapBeforeRepair: tile.overlapBeforeRepair ?? 0,
    overlapAfterRepair: tile.overlapAfterRepair ?? 0,
    estimatedLineHeight: tile.estimatedLineHeight ?? 0.022,
    duplicateBoundaryLikely: true,
    continuityRepairApplied: false,
    excessiveOverlap: false,
    lastResortFallback: true,
    topBoundarySafe: false,
    bottomBoundarySafe: false,
    previousFinalBottom: position,
    nextFinalTop: position,
    corridorHeight: 0,
    finalBoundaryValid: false,
    rejectionReasonIfInvalid: "explicit-last-resort-width-fit"
  };
}

function getColumnStrategy(
  transform: Extract<PageReadingTransform, { mode: "column-reading" }>,
  outputPages: AcademicOutputPagePlan[]
): AcademicPageStrategy {
  if (outputPages.some((page) => page.regionKind === "full-width-title")) {
    return "first-page-title-preserve-body-width-fit";
  }
  if (transform.debug?.decision === "mixed-split") return "mixed-layout";
  if (outputPages.some((page) => page.paginationMode === "width-fit-page" || page.paginationMode === "width-fit-final-page")) {
    return "two-column-width-fit";
  }
  return "single-column-reading";
}

function getOutputPaginationMode(tile: ReadingTile): AcademicOutputPaginationMode {
  if (tile.paginationMode === "multi-tile-last-resort") return "last-resort";
  if (tile.paginationMode === "single-column-page") return "single-column-safe";
  return tile.tileIndex === tile.tileCount ? "width-fit-final-page" : "width-fit-page";
}

function summarizeOutputPages(outputPages: AcademicOutputPagePlan[], sourceRegionCount: number) {
  const outputPageCountByRegion = outputPages.reduce<Record<string, number>>((counts, page) => {
    counts[page.sourceRegionId] = (counts[page.sourceRegionId] ?? 0) + 1;
    return counts;
  }, {});
  const verticalBreakCount = Object.values(outputPageCountByRegion)
    .reduce((sum, count) => sum + Math.max(0, count - 1), 0);

  return {
    sourceRegionCount,
    outputPageCount: outputPages.length,
    verticalBreakCount,
    outputPageCountByRegion,
    breakCoverageComplete: outputPages.every((page) => {
      const count = outputPageCountByRegion[page.sourceRegionId] ?? 0;
      if (count <= 1) return true;
      return page.outputPageIndex === 1 ? Boolean(page.breakAfter) :
        page.outputPageIndex === count ? Boolean(page.breakBefore) :
          Boolean(page.breakBefore && page.breakAfter);
    }),
    failureCategories: uniqueFailures(outputPages.flatMap((page) => page.failureCategories))
  };
}

function applyOutputPageValidation(
  outputPages: AcademicOutputPagePlan[],
  outputProfile: ReadingOutputProfile
): AcademicOutputPagePlan[] {
  const duplicateCropKeys = getDuplicateCropKeys(outputPages);
  const byRegion = groupByRegion(outputPages);

  return outputPages.map((page) => {
    const regionPages = byRegion.get(page.sourceRegionId) ?? [page];
    const duplicateCropBounds = duplicateCropKeys.has(`${page.sourceRegionId}:${cropKey(page.sourceCropFractions)}`);
    const cropProgressionValid = isCropProgressionValid(page, regionPages);
    const breakDiagnosticsPresent = hasRequiredBreakDiagnostics(page, regionPages);
    const failureCategories = classifyOutputPageFailures(
      page,
      regionPages,
      outputProfile,
      duplicateCropBounds,
      cropProgressionValid,
      breakDiagnosticsPresent
    );
    const issues = [
      duplicateCropBounds ? "duplicate source crop bounds" : "",
      cropProgressionValid ? "" : "non-monotonic source crop progression",
      breakDiagnosticsPresent ? "" : "hidden vertical break diagnostics",
      failureCategories.includes("full-column-too-empty") ? "full-column-too-empty unrepaired" : "",
      failureCategories.includes("orphan-output-page") ? "orphan-output-page unrepaired" : "",
      failureCategories.includes("final-crop-clipping") ? "final crop clipping risk" : ""
    ].filter(Boolean);

    return {
      ...page,
      failureCategories,
      validation: {
        ok: issues.length === 0,
        issues,
        duplicateCropBounds,
        cropProgressionValid,
        breakDiagnosticsPresent
      }
    };
  });
}

type RowCoverageResult = {
  passed: boolean;
  duplicatedTextRowsCount: number;
  missingTextRowsCount: number;
  unaccountedMissingRowsCount: number;
  ignoredRowsCount: number;
  ignoredRowsByReason: Record<string, number>;
  failureReason?: string;
  nearDuplicateOutputPages: boolean;
  failures: AcademicFailureCategory[];
};

function validateRowCoverage(
  rows: NonNullable<PageReadingTransform["textRows"]>,
  outputPages: AcademicOutputPagePlan[],
  transition?: AcademicLayoutTransition
): RowCoverageResult {
  if (rows.length === 0 || outputPages.length === 0) {
    return {
      passed: true,
      duplicatedTextRowsCount: 0,
      missingTextRowsCount: 0,
      unaccountedMissingRowsCount: 0,
      ignoredRowsCount: 0,
      ignoredRowsByReason: {},
      nearDuplicateOutputPages: false,
      failures: []
    };
  }

  const edgeTolerance = 0.0015;
  const rowCoverage = rows.map((row) =>
    outputPages.filter((page) => rowIntersectsOutputPage(row, page, edgeTolerance))
  );
  const duplicatedTextRowsCount = rowCoverage.filter((pages) => hasDuplicateCoverageWithinSourceRegion(pages)).length;
  const missingRows = rowCoverage
    .map((pages, index) => ({ pages, row: rows[index] }))
    .filter(({ pages }) => pages.length === 0)
    .map(({ row }) => ({ row, rowClass: classifyRowForCoverage(row) }));
  const ignoredRowsByReason = missingRows.reduce<Record<string, number>>((counts, item) => {
    if (isIgnorableRowClass(item.rowClass)) {
      counts[item.rowClass] = (counts[item.rowClass] ?? 0) + 1;
    }
    return counts;
  }, {});
  const ignoredRowsCount = Object.values(ignoredRowsByReason).reduce((sum, count) => sum + count, 0);
  const missingTextRowsCount = missingRows.length;
  const unaccountedMissingRowsCount = missingRows.length - ignoredRowsCount;
  const rowSets = outputPages.map((page) =>
    rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => rowIntersectsOutputPage(row, page, edgeTolerance))
      .map(({ index }) => index)
  );
  const nearDuplicateOutputPages = outputPages.some((page, index) =>
    outputPages.slice(index + 1).some((nextPage, nextOffset) =>
      page.sourceRegionId === nextPage.sourceRegionId &&
      getSetSimilarity(rowSets[index], rowSets[index + 1 + nextOffset]) >= 0.86 &&
      Math.min(rowSets[index].length, rowSets[index + 1 + nextOffset].length) > 2
    )
  );
  const failures: AcademicFailureCategory[] = [];

  if (duplicatedTextRowsCount > 0 || nearDuplicateOutputPages) {
    failures.push("duplicate-output-page");
  }
  if (unaccountedMissingRowsCount > 0) {
    failures.push("final-crop-clipping");
  }
  if (transition?.evidence.titleRegionContainsColumnRows) {
    failures.push("title-author-split");
  }

  return {
    passed: failures.length === 0 && unaccountedMissingRowsCount === 0,
    duplicatedTextRowsCount,
    missingTextRowsCount,
    unaccountedMissingRowsCount,
    ignoredRowsCount,
    ignoredRowsByReason,
    failureReason: unaccountedMissingRowsCount > 0
      ? "unaccounted-text-rows-missing-from-output"
      : duplicatedTextRowsCount > 0
        ? "text-rows-duplicated-across-output-pages"
        : nearDuplicateOutputPages
          ? "near-duplicate-output-page-row-sets"
          : undefined,
    nearDuplicateOutputPages,
    failures
  };
}

function rowIntersectsOutputPage(
  row: NonNullable<PageReadingTransform["textRows"]>[number],
  page: AcademicOutputPagePlan,
  edgeTolerance: number
): boolean {
  const rowCenterY = (row.top + row.bottom) / 2;
  if (
    rowCenterY < page.finalExportCropBounds.top + edgeTolerance ||
    rowCenterY > page.finalExportCropBounds.bottom - edgeTolerance
  ) {
    return false;
  }

  const horizontalOverlap = Math.min(row.right, page.finalExportCropBounds.right - edgeTolerance) -
    Math.max(row.left, page.finalExportCropBounds.left + edgeTolerance);
  if (horizontalOverlap <= 0) return false;

  const rowWidth = Math.max(0.001, row.right - row.left);
  const pageWidth = Math.max(0.001, page.finalExportCropBounds.right - page.finalExportCropBounds.left);
  const requiredOverlap = Math.min(rowWidth * 0.12, pageWidth * 0.08, 0.035);

  return horizontalOverlap >= requiredOverlap;
}

function hasDuplicateCoverageWithinSourceRegion(pages: AcademicOutputPagePlan[]): boolean {
  const seen = new Set<string>();
  for (const page of pages) {
    if (seen.has(page.sourceRegionId)) return true;
    seen.add(page.sourceRegionId);
  }
  return false;
}

function classifyRowForCoverage(row: NonNullable<PageReadingTransform["textRows"]>[number]): RowCoverageClass {
  const width = row.right - row.left;
  const center = (row.left + row.right) / 2;
  if (row.top < 0.035) return width > 0.25 ? "running-title" : "header";
  if (row.bottom > 0.965) return width < 0.12 && center > 0.4 && center < 0.6 ? "page-number" : "footer";
  if (width < 0.02 || row.bottom - row.top < 0.003) return "ignored-noise";
  if (row.right < 0.5) return "body-left";
  if (row.left > 0.5) return "body-right";
  if (width > 0.45) return "title";
  return "unknown";
}

function isIgnorableRowClass(rowClass: RowCoverageClass): boolean {
  return rowClass === "header" ||
    rowClass === "footer" ||
    rowClass === "page-number" ||
    rowClass === "running-title" ||
    rowClass === "ignored-noise";
}

function getSetSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const overlap = right.filter((value) => leftSet.has(value)).length;
  return overlap / Math.min(left.length, right.length);
}

function validateAcademicReadingPlanPages(sourcePages: AcademicSourcePagePlan[]): PlanValidationResult {
  const issues = sourcePages.flatMap((page) =>
    page.validation.issues.map((issue) => `Page ${page.sourcePageNumber}: ${issue}`)
  );

  return { ok: issues.length === 0, issues };
}

type ProductQualityResult = {
  grade: ProductQualityGrade;
  score: number;
  issues: ProductQualityIssue[];
  passed: boolean;
};

function evaluateProductQuality(
  transform: PageReadingTransform,
  outputProfile: ReadingOutputProfile,
  outputPages: AcademicOutputPagePlan[],
  summary: {
    failureCategories: AcademicFailureCategory[];
    rowCoveragePassed?: boolean;
    layoutKind?: string;
    transitionRejectionReason?: string;
    repairedFailures?: AcademicFailureCategory[];
    outputPageCount?: number;
    badOrphanPageCount?: number;
    firstPagePolicy?: NonNullable<AcademicSourcePagePlan["summary"]["firstPagePolicy"]>;
    firstPagePreservedShortBody?: boolean;
    firstPagePreservedForSafety?: boolean;
  },
  rowCoverage?: RowCoverageResult
): ProductQualityResult {
  const issues: ProductQualityIssue[] = [];
  const isReadingProfile = outputProfile.id === "academic-reading" || outputProfile.id === "kindle-reading";
  const isKindle = outputProfile.id === "kindle-reading";
  const isColumnReading = transform.mode === "column-reading";
  const textRowsDetected = transform.debug?.textRowsDetected ?? transform.textRows?.length ?? 0;

  if (isReadingProfile && transform.mode === "preserved") {
    issues.push("unsafe-preserve-in-reading-mode");
  }

  const acceptableFirstPagePreserve = transform.sourcePageNumber === 1 && (
    summary.firstPagePolicy === "title-plus-short-body-preserve" ||
    summary.firstPagePolicy === "preserve-title-abstract-page" ||
    summary.firstPagePolicy === "preserve-cover-page"
  );

  if (acceptableFirstPagePreserve) {
    if (summary.firstPagePolicy === "title-plus-short-body-preserve") {
      issues.push("first-page-preserved-short-body");
    } else if (summary.firstPagePolicy === "preserve-title-abstract-page") {
      issues.push("first-page-preserved-title-abstract");
    } else {
      issues.push("first-page-preserved-cover");
    }
  }

  if (isReadingProfile && isColumnReading && transform.debug?.decision === "mixed-split" && summary.layoutKind === "unknown" && !acceptableFirstPagePreserve) {
    issues.push("title-body-transition-failed", "mixed-layout-downgraded", "first-page-not-optimized", "first-page-transition-uncertain");
  }

  if (isReadingProfile && isColumnReading && outputPages.some((page) => page.regionKind === "unsafe") && !acceptableFirstPagePreserve) {
    issues.push("unsafe-preserve-in-reading-mode");
    if (transform.debug?.decision === "split" || transform.debug?.decision === "mixed-split") {
      issues.push("detected-columns-discarded");
    }
    if (transform.debug?.decision === "mixed-split") {
      issues.push("mixed-layout-downgraded", "first-page-not-optimized", "first-page-transition-uncertain");
    }
  }

  const singleColumnFallbacks = outputPages.filter((page) =>
    (page.regionKind === "left-column" || page.regionKind === "right-column") &&
    page.paginationMode === "single-column-safe"
  );
  if (singleColumnFallbacks.length > 0) {
    const textHeavy = textRowsDetected >= outputProfile.minRowsPerOutputPage * 2;
    if (textHeavy || isKindle) {
      issues.push("full-column-fallback-in-text-heavy-page");
      if (isKindle) issues.push("kindle-output-not-readable");
    }
  }

  if (summary.failureCategories.includes("full-column-too-empty")) {
    issues.push("full-column-fallback-in-text-heavy-page", "too-much-white-space", "width-fit-required-but-not-used");
  }
  if (summary.failureCategories.includes("orphan-output-page")) {
    issues.push("orphan-output-page", "single-sentence-output-page");
  }
  if ("badOrphanPageCount" in summary && (summary.badOrphanPageCount ?? 0) > 0) {
    issues.push("orphan-output-page", "single-sentence-output-page");
  }
  if (outputPages.some((page) => page.outputPageFillQuality === "orphan")) {
    issues.push("orphan-output-page", "single-sentence-output-page");
  }
  if (outputPages.some((page) => page.outputPageFillQuality === "too-empty")) {
    issues.push("too-much-white-space");
  }
  if (outputPages.some((page) => page.outputPageFillQuality === "too-small" || page.estimatedReadableScale < outputProfile.minReadableScale)) {
    issues.push("text-too-small-for-profile");
    if (isKindle) issues.push("kindle-text-too-small", "kindle-output-not-readable");
  }
  if (isKindle && singleColumnFallbacks.length > 0) {
    issues.push("width-fit-required-but-not-used");
  }
  if (isKindle && outputPages.some((page) =>
    (page.regionKind === "left-column" || page.regionKind === "right-column") &&
    ((page.rowsOnPage ?? 0) > outputProfile.maxRowsPerSlice ||
      (page.sourceCropHeight ?? 0) > outputProfile.maxSourceSliceHeightRatio + 0.002)
  )) {
    issues.push("kindle-slice-too-tall", "kindle-output-not-readable");
  }
  if (isKindle && outputPages.some((page) => page.kindleReadable === false)) {
    issues.push("kindle-output-not-readable");
  }
  if (isKindle && outputPages.some((page) => page.textClippingRisk || page.topBoundaryCutsRow || page.bottomBoundaryCutsRow)) {
    issues.push("kindle-crop-boundary-risk", "kindle-output-not-readable");
  }
  if (isKindle && outputPages.some((page) =>
    (page.shortPageKind === "bad-orphan-middle" || page.shortPageKind === "bad-orphan-final") &&
    page.rowsOnPage !== undefined &&
    page.rowsOnPage <= 4
  )) {
    issues.push("kindle-tiny-slice", "kindle-output-not-readable");
  }
  if (isKindle && outputPages.some((page) => page.shortPageKind === "bad-orphan-middle")) {
    issues.push("kindle-middle-orphan");
  }
  if (isKindle && outputPages.some((page) => page.shortPageKind === "bad-orphan-final")) {
    issues.push("kindle-final-orphan");
  }
  if (isKindle && outputPages.filter((page) =>
    page.rowsOnPage !== undefined &&
    page.rowsOnPage > 0 &&
    page.rowsOnPage <= 4
  ).length >= 2) {
    issues.push("kindle-overfragmented", "kindle-output-not-readable");
  }
  if (isKindle && outputPages.some((page) =>
    (page.blankAreaRatio ?? 0) > outputProfile.maxMiddlePageEmptyRatio &&
    (page.rowsOnPage ?? outputProfile.minRowsPerOutputPage) < outputProfile.minRowsPerOutputPage &&
    page.shortPageKind !== "natural-short-final"
  )) {
    issues.push("kindle-low-fill");
  }
  if (rowCoverage && !rowCoverage.passed) {
    issues.push("unknown-layout-accepted");
  }

  const uniqueIssues = uniqueQualityIssues(issues);
  const score = getProductQualityScore(uniqueIssues);
  const grade = getProductQualityGrade(score, uniqueIssues);
  const hardFailures: ProductQualityIssue[] = [
    "full-column-fallback-in-text-heavy-page",
    "single-sentence-output-page",
    "orphan-output-page",
    "too-much-white-space",
    "text-too-small-for-profile",
    "width-fit-required-but-not-used",
    "kindle-output-not-readable",
    "kindle-slice-too-tall",
    "kindle-text-too-small",
    "kindle-overfragmented",
    "kindle-tiny-slice",
    "kindle-middle-orphan",
    "kindle-final-orphan",
    "kindle-crop-boundary-risk",
    "kindle-low-fill",
    "kindle-excessive-page-count"
  ];
  const academicFailures: ProductQualityIssue[] = [
    "unsafe-preserve-in-reading-mode",
    "title-body-transition-failed",
    "first-page-not-optimized",
    "mixed-layout-downgraded"
  ];
  const failed = uniqueIssues.some((issue) =>
    hardFailures.includes(issue) || (isKindle && academicFailures.includes(issue))
  );

  return {
    grade,
    score,
    issues: uniqueIssues,
    passed: !failed && grade !== "failed"
  };
}

function getProductQualityScore(issues: ProductQualityIssue[]): number {
  const weights: Record<ProductQualityIssue, number> = {
    "unsafe-preserve-in-reading-mode": 28,
    "detected-columns-discarded": 36,
    "title-body-transition-failed": 24,
    "first-page-preserved-short-body": 8,
    "first-page-preserved-title-abstract": 6,
    "first-page-preserved-cover": 4,
    "first-page-transition-uncertain": 12,
    "full-column-fallback-in-text-heavy-page": 32,
    "single-sentence-output-page": 28,
    "orphan-output-page": 28,
    "too-much-white-space": 24,
    "text-too-small-for-profile": 30,
    "width-fit-required-but-not-used": 34,
    "kindle-output-not-readable": 38,
    "kindle-slice-too-tall": 26,
    "kindle-text-too-small": 34,
    "kindle-overfragmented": 32,
    "kindle-tiny-slice": 30,
    "kindle-middle-orphan": 34,
    "kindle-final-orphan": 26,
    "kindle-crop-boundary-risk": 38,
    "kindle-low-fill": 22,
    "kindle-excessive-page-count": 20,
    "kindle-profile-not-distinct": 26,
    "academic-overfragmented": 16,
    "profile-output-too-similar": 24,
    "first-page-not-optimized": 20,
    "excessive-preserve-ratio": 20,
    "mixed-layout-downgraded": 20,
    "unknown-layout-accepted": 18
  };
  return Math.max(0, 100 - issues.reduce((sum, issue) => sum + weights[issue], 0));
}

function getProductQualityGrade(score: number, issues: ProductQualityIssue[]): ProductQualityGrade {
  if (score < 45 || issues.includes("kindle-output-not-readable")) return "failed";
  if (score < 65) return "poor";
  if (score < 78) return "acceptable";
  if (score < 90) return "good";
  return "excellent";
}

function validateAcademicSourcePageOutput(outputPages: AcademicOutputPagePlan[]): PlanValidationResult {
  const issues = outputPages.flatMap((page) =>
    page.validation.issues.map((issue) => `${page.outputId}: ${issue}`)
  );
  const ids = new Set<string>();

  for (const page of outputPages) {
    if (ids.has(page.outputId)) {
      issues.push(`Duplicate output id ${page.outputId}`);
    }
    ids.add(page.outputId);
  }

  const byRegion = groupByRegion(outputPages);
  for (const [regionId, pages] of byRegion.entries()) {
    const sorted = [...pages].sort((a, b) => a.outputPageIndex - b.outputPageIndex);
    const crops = new Set<string>();

    for (const page of sorted) {
      const key = cropKey(page.sourceCropFractions);
      if (crops.has(key)) {
        issues.push(`Duplicate crop bounds in ${regionId}`);
      }
      crops.add(key);
    }

    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].sourceCropBounds.top < sorted[index - 1].sourceCropBounds.top) {
        issues.push(`Output pages do not progress top-to-bottom in ${regionId}`);
      }
      if (!sorted[index - 1].breakAfter || !sorted[index].breakBefore) {
        issues.push(`Missing vertical break diagnostics in ${regionId}`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

function addUnrepairedFailureIssues(
  validation: PlanValidationResult,
  unrepairedFailures: AcademicFailureCategory[]
): PlanValidationResult {
  const seriousFailures = unrepairedFailures.filter((failure) =>
    failure === "title-author-split" ||
    failure === "full-column-too-empty" ||
    failure === "orphan-output-page" ||
    failure === "duplicate-output-page" ||
    failure === "final-crop-clipping"
  );
  const issues = [
    ...validation.issues,
    ...seriousFailures.map((failure) => `Unrepaired ${failure}`)
  ];

  return {
    ok: issues.length === 0,
    issues
  };
}

function addRowCoverageIssues(
  validation: PlanValidationResult,
  rowCoverage: RowCoverageResult
): PlanValidationResult {
  const issues = [
    ...validation.issues,
    rowCoverage.unaccountedMissingRowsCount > 0
      ? `Unaccounted missing text rows: ${rowCoverage.unaccountedMissingRowsCount}`
      : "",
    rowCoverage.duplicatedTextRowsCount > 0
      ? `Duplicated text rows: ${rowCoverage.duplicatedTextRowsCount}`
      : "",
    rowCoverage.nearDuplicateOutputPages ? "Near-duplicate output page row sets" : ""
  ].filter(Boolean);

  return {
    ok: issues.length === 0,
    issues
  };
}

export function validateAcademicReadingPlan(plan: AcademicReadingPlan): PlanValidationResult {
  return validateAcademicReadingPlanPages(plan.sourcePages);
}

function groupByRegion(outputPages: AcademicOutputPagePlan[]) {
  const byRegion = new Map<string, AcademicOutputPagePlan[]>();
  for (const page of outputPages) {
    byRegion.set(page.sourceRegionId, [...(byRegion.get(page.sourceRegionId) ?? []), page]);
  }
  return byRegion;
}

function getOutputId(tile: ReadingTile, index: number): string {
  const crop = cropKey(tile.crop);
  return `${tile.sourcePageNumber}-${tile.column ?? "full"}-${tile.tileIndex}-${index}-${crop}`;
}

function getDuplicateCropKeys(outputPages: AcademicOutputPagePlan[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const page of outputPages) {
    const key = `${page.sourceRegionId}:${cropKey(page.sourceCropFractions)}`;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }

  return duplicates;
}

function isCropProgressionValid(page: AcademicOutputPagePlan, regionPages: AcademicOutputPagePlan[]) {
  const sorted = [...regionPages].sort((a, b) => a.outputPageIndex - b.outputPageIndex);
  const index = sorted.findIndex((item) => item.outputId === page.outputId);
  if (index <= 0) return true;
  return page.sourceCropBounds.top >= sorted[index - 1].sourceCropBounds.top;
}

function hasRequiredBreakDiagnostics(page: AcademicOutputPagePlan, regionPages: AcademicOutputPagePlan[]) {
  if (regionPages.length <= 1) return true;
  if (page.outputPageIndex === 1) return Boolean(page.breakAfter);
  if (page.outputPageIndex === regionPages.length) return Boolean(page.breakBefore);
  return Boolean(page.breakBefore && page.breakAfter);
}

function classifyOutputPageFailures(
  page: AcademicOutputPagePlan,
  regionPages: AcademicOutputPagePlan[],
  outputProfile: ReadingOutputProfile,
  duplicateCropBounds: boolean,
  cropProgressionValid: boolean,
  breakDiagnosticsPresent: boolean
): AcademicFailureCategory[] {
  const failures: AcademicFailureCategory[] = [];
  const isColumn = page.regionKind === "left-column" || page.regionKind === "right-column";
  const singleTextColumn = isColumn && page.paginationMode === "single-column-safe";
  const tooEmptySingleColumn = singleTextColumn &&
    page.contentFillRatio < outputProfile.minContentFillRatio &&
    page.estimatedReadableScale < outputProfile.targetReadableScale;

  if (tooEmptySingleColumn) failures.push("full-column-too-empty");
  if (page.outputPageFillQuality === "orphan") failures.push("orphan-output-page");
  if (duplicateCropBounds || !cropProgressionValid) failures.push("duplicate-output-page");
  if (!breakDiagnosticsPresent) failures.push("duplicate-output-page");
  if (!cropContainsBounds(page.finalExportCropBounds, page.sourceCropBounds, outputProfile.exportClipSafetyRatio)) {
    failures.push("final-crop-clipping");
  }
  if (page.textClippingRisk || page.topBoundaryCutsRow || page.bottomBoundaryCutsRow) {
    failures.push("final-crop-clipping");
  }

  const middlePage = page.outputPageIndex > 1 && page.outputPageIndex < regionPages.length;
  if (middlePage && page.contentFillRatio < outputProfile.minContentFillRatio) {
    failures.push("orphan-output-page");
  }

  return uniqueFailures(failures);
}

function cropKey(crop: NormalizedCropRect): string {
  return [crop.left, crop.top, crop.right, crop.bottom].map((value) => value.toFixed(5)).join("-");
}

function calculateFillRatio(crop: NormalizedCropRect, outputProfile: ReadingOutputProfile): number {
  const sourceWidth = Math.max(0.001, 1 - crop.left - crop.right);
  const sourceHeight = Math.max(0.001, 1 - crop.top - crop.bottom);
  const availableWidth = 1 - outputProfile.outputSideMarginRatio * 2;
  const availableHeight = 1 - outputProfile.outputTopMarginRatio - outputProfile.outputBottomMarginRatio;
  const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);

  return Math.min(1, (sourceWidth * scale * sourceHeight * scale) / (availableWidth * availableHeight));
}

function getFillQuality(
  fillRatio: number,
  tile: ReadingTile,
  outputProfile: ReadingOutputProfile
): OutputPageFillQuality {
  if (tile.paginationMode === "single-column-page" && fillRatio < outputProfile.minContentFillRatio) {
    return "too-empty";
  }
  if (tile.tileCount > 1 && tile.tileIndex === tile.tileCount && fillRatio < outputProfile.minFinalPageFillRatio) {
    return outputProfile.allowNaturalShortFinalPage ? "natural-short-final" : "orphan";
  }
  if ((tile.widthFitScale ?? 0) < outputProfile.minReadableScale) {
    return "too-small";
  }
  if (fillRatio >= outputProfile.minContentFillRatio) {
    return "good";
  }
  return "acceptable";
}

function cropContainsBounds(outer: AcademicOutputPagePlan["finalExportCropBounds"], inner: AcademicOutputPagePlan["sourceCropBounds"], tolerance: number) {
  return (
    outer.left <= inner.left + tolerance &&
    outer.top <= inner.top + tolerance &&
    outer.right >= inner.right - tolerance &&
    outer.bottom >= inner.bottom - tolerance
  );
}

function uniqueFailures(failures: AcademicFailureCategory[]): AcademicFailureCategory[] {
  return Array.from(new Set(failures));
}

function uniqueQualityIssues(issues: ProductQualityIssue[]): ProductQualityIssue[] {
  return Array.from(new Set(issues));
}

function getWorstQualityGrade(grades: ProductQualityGrade[]): ProductQualityGrade {
  const rank: Record<ProductQualityGrade, number> = {
    excellent: 5,
    good: 4,
    acceptable: 3,
    poor: 2,
    failed: 1
  };
  return grades.reduce<ProductQualityGrade>((worst, grade) => rank[grade] < rank[worst] ? grade : worst, "excellent");
}
