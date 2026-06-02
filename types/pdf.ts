import type { PDFDocumentProxy } from "pdfjs-dist";

export type PdfMetadata = {
  fileName: string;
  fileSize: number;
  pageCount: number;
  previewedPages: number;
};

export type RenderedPage = {
  previewId?: string;
  pageNumber: number;
  sourcePageNumber?: number;
  column?: "left" | "right";
  tileIndex?: number;
  tileCount?: number;
  outputProfileId?: ReadingOutputProfileId;
  width: number;
  height: number;
  dataUrl: string;
  cropStatus?: CropStatus;
  columnStatus?: ColumnSplitStatus;
  cropGainPercent?: number;
  cropReason?: string;
  normalizedCrop?: NormalizedCropRect;
};

export type PdfLoadResult = {
  metadata: Omit<PdfMetadata, "previewedPages">;
  document: PDFDocumentProxy;
};

export type PdfRenderResult = {
  pages: RenderedPage[];
  failedPageNumbers: number[];
  diagnostics?: ColumnDetectionDebug[];
  academicPlans?: AcademicSourcePagePlan[];
};

export type CropMode = "safe-auto" | "manual";

export type ManualCropPreset = "conservative" | "balanced" | "aggressive" | "custom";

export type CropStatus =
  | "auto-cropped"
  | "minimal-crop"
  | "no-safe-crop"
  | "manual-crop"
  | "failed";

export type ReadingTransformMode = "margin-crop" | "column-reading" | "preserved";

export type ReadingOutputProfileId = "academic-reading" | "kindle-reading" | "kindle-ereader" | "ipad-tablet";

export type ColumnSplitStatus =
  | "split"
  | "not-two-column"
  | "uncertain"
  | "full-width-content"
  | "low-confidence"
  | "failed";

export type TileBreakKind = "clean-whitespace" | "paragraph-gap" | "line-gap" | "fallback-dense";

export type TileContinuationMode = "clean-non-overlap" | "micro-overlap" | "emergency-overlap";

export type ColumnPaginationMode = "single-column-page" | "multi-tile-safe" | "multi-tile-last-resort";

export type AcademicPageStrategy =
  | "preserve-page"
  | "safe-margin-crop"
  | "single-column-reading"
  | "two-column-width-fit"
  | "mixed-layout"
  | "first-page-title-preserve-body-width-fit"
  | "figure-table-preserve"
  | "unsafe-preserve";

export type AcademicRegionKind =
  | "full-width-title"
  | "full-width-abstract"
  | "full-width-header"
  | "full-width"
  | "left-column"
  | "right-column"
  | "figure"
  | "table"
  | "equation"
  | "caption"
  | "header-footer"
  | "unsafe";

export type AcademicRegionQuality = "text-heavy" | "short-text" | "figure-heavy" | "table-heavy" | "mixed" | "unsafe";

export type AcademicOutputPaginationMode =
  | "width-fit-page"
  | "width-fit-final-page"
  | "full-width-preserve"
  | "single-column-safe"
  | "figure-table-preserve"
  | "last-resort";

export type OutputPageFillQuality =
  | "good"
  | "acceptable"
  | "too-empty"
  | "orphan"
  | "too-small"
  | "natural-short-final"
  | "figure-preserve"
  | "last-resort";

export type AcademicFailureCategory =
  | "full-column-too-empty"
  | "orphan-output-page"
  | "title-author-split"
  | "duplicate-output-page"
  | "final-crop-clipping"
  | "figure-table-unsafe-split";

export type ProductQualityGrade = "excellent" | "good" | "acceptable" | "poor" | "failed";

export type ShortPageKind =
  | "not-short"
  | "natural-short-final"
  | "bad-orphan-final"
  | "bad-orphan-middle"
  | "section-ending-short"
  | "last-resort-short";

export type ProductQualityIssue =
  | "unsafe-preserve-in-reading-mode"
  | "detected-columns-discarded"
  | "title-body-transition-failed"
  | "first-page-preserved-short-body"
  | "first-page-preserved-title-abstract"
  | "first-page-preserved-cover"
  | "first-page-transition-uncertain"
  | "full-column-fallback-in-text-heavy-page"
  | "single-sentence-output-page"
  | "orphan-output-page"
  | "too-much-white-space"
  | "text-too-small-for-profile"
  | "width-fit-required-but-not-used"
  | "kindle-output-not-readable"
  | "kindle-slice-too-tall"
  | "kindle-text-too-small"
  | "kindle-overfragmented"
  | "kindle-tiny-slice"
  | "kindle-middle-orphan"
  | "kindle-final-orphan"
  | "kindle-crop-boundary-risk"
  | "kindle-low-fill"
  | "kindle-excessive-page-count"
  | "kindle-profile-not-distinct"
  | "academic-overfragmented"
  | "profile-output-too-similar"
  | "first-page-not-optimized"
  | "excessive-preserve-ratio"
  | "mixed-layout-downgraded"
  | "unknown-layout-accepted";

export type AcademicPageClass =
  | "body-two-column"
  | "first-page-title-plus-body"
  | "full-width-single-column"
  | "figure-table-heavy"
  | "mixed-uncertain"
  | "unsafe";

export type RowCoverageClass =
  | "title"
  | "author"
  | "affiliation"
  | "abstract"
  | "body-left"
  | "body-right"
  | "caption"
  | "figure-table-label"
  | "header"
  | "footer"
  | "page-number"
  | "running-title"
  | "ignored-noise"
  | "unknown";

export type OutputPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

export type TextLineRow = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  itemCount: number;
};

export type BreakSource = "text-layer" | "visual-ink" | "fallback";

export type TileBreakDetail = {
  position: number;
  originalPosition?: number;
  inkDensity: number;
  breakKind: TileBreakKind;
  originalBreakKind?: TileBreakKind;
  continuationMode: TileContinuationMode;
  breakSource?: BreakSource;
  boundaryRepaired?: boolean;
  repairDirection?: "up" | "down" | "none";
  expandedSearchUsed?: boolean;
  safeCandidateFound?: boolean;
  lastResortFallback?: boolean;
  topBoundarySafe?: boolean;
  bottomBoundarySafe?: boolean;
  whitespaceBandTop?: number;
  whitespaceBandBottom?: number;
  previousFinalBottom?: number;
  nextFinalTop?: number;
  corridorHeight?: number;
  corridorToLineHeightRatio?: number;
  gapInkDensity?: number;
  maxCorridorRowInkDensity?: number;
  upperGuardInkDensity?: number;
  lowerGuardInkDensity?: number;
  maxAdjacentGuardInkDensity?: number;
  finalBoundaryValid?: boolean;
  rejectionReasonIfInvalid?: string;
};

export type TileBoundaryDiagnostics = TileBreakDetail & {
  column: "left" | "right";
  overlapRatio: number;
  overlapBeforeRepair: number;
  overlapAfterRepair: number;
  estimatedLineHeight: number;
  duplicateBoundaryLikely: boolean;
  continuityRepairApplied: boolean;
  excessiveOverlap: boolean;
  boundaryRepaired?: boolean;
  repairDirection?: "up" | "down" | "none";
  topBoundarySafe?: boolean;
  bottomBoundarySafe?: boolean;
};

export type ColumnDetectionReason =
  | "clear-two-column"
  | "split-with-repaired-crop"
  | "mixed-layout-body-split"
  | "full-width-content-preserved"
  | "body-region-too-small"
  | "mixed-layout-uncertain"
  | "mixed-layout"
  | "gutter-too-narrow"
  | "gutter-too-noisy"
  | "full-width-content"
  | "cover-like"
  | "landscape-like"
  | "low-confidence"
  | "unsafe-left-column"
  | "unsafe-right-column"
  | "smart-break-fallback"
  | "one-column"
  | "columns-unbalanced"
  | "analysis-failed";

export type ColumnDetectionDebug = {
  pageNumber: number;
  decision: "split" | "mixed-split" | "preserve" | "margin-crop";
  confidence: number;
  reason: ColumnDetectionReason;
  presetId?: string;
  columnModeEnabled?: boolean;
  allowed?: boolean;
  gutter?: {
    left: number;
    right: number;
    center: number;
    width: number;
    inkDensity: number;
    confidence: number;
    clearSegmentRatio?: number;
  };
  measurements?: {
    leftDensity?: number;
    rightDensity?: number;
    balanceRatio?: number;
    minGutterEmptyRatio?: number;
    maxGutterInkRatio?: number;
    minGutterClearSegmentRatio?: number;
    minColumnContentDensity?: number;
    minColumnBalanceRatio?: number;
  };
  leftColumn?: {
    crop: NormalizedCropRect;
    contentBounds?: NormalizedBoundsRect;
    safe: boolean;
    safety?: ColumnSafetyDiagnostics;
  };
  rightColumn?: {
    crop: NormalizedCropRect;
    contentBounds?: NormalizedBoundsRect;
    safe: boolean;
    safety?: ColumnSafetyDiagnostics;
  };
  tileBreaks?: TileBoundaryDiagnostics[];
  tileCount?: number;
  sourceRegionCount?: number;
  outputPageCount?: number;
  verticalBreakCount?: number;
  breakCoverageComplete?: boolean;
  textLayerAvailable?: boolean;
  textRowsDetected?: number;
  academicStrategy?: AcademicPageStrategy;
  academicFailureCategories?: AcademicFailureCategory[];
  planValidationPassed?: boolean;
  outputPageFillQualities?: OutputPageFillQuality[];
  outputPageCountByRegion?: Record<string, number>;
  repairedFailures?: AcademicFailureCategory[];
  unrepairedFailures?: AcademicFailureCategory[];
  repairActionsApplied?: string[];
  titleAuthorRepairApplied?: boolean;
  fullWidthTitleRegionDetected?: boolean;
  bodyRegionTop?: number;
  titleRegionContainsColumnRows?: boolean;
  rowCoveragePassed?: boolean;
  duplicatedTextRowsCount?: number;
  missingTextRowsCount?: number;
  unaccountedMissingRowsCount?: number;
  ignoredRowsCount?: number;
  ignoredRowsByReason?: Record<string, number>;
  rowCoverageFailureReason?: string;
  nearDuplicateOutputPages?: boolean;
  productQualityGrade?: ProductQualityGrade;
  productQualityScore?: number;
  productQualityIssues?: ProductQualityIssue[];
  qualityGatePassed?: boolean;
  academicPageClass?: AcademicPageClass;
  pageClassReason?: string;
  mixedSplitReason?: "title-header-plus-body" | "figure-table-plus-body" | "body-columns-with-noisy-header" | "partial-two-column-body" | "uncertain";
  titleDetectionApplicable?: boolean;
  titleDetectionSkippedReason?: string;
  bodyColumnExtractionAttempted?: boolean;
  bodyColumnExtractionSucceeded?: boolean;
  rawColumnDetectorSuggestedSplit?: boolean;
  plannerAcceptedColumnSplit?: boolean;
  plannerRejectedColumnSplitReason?: string;
  transitionCandidates?: Array<{
    bodyRegionTop: number;
    score: number;
    rejectedReasons: string[];
    rowsAboveClassifiedAsTitleOrFullWidth: number;
    leftRowsBelow: number;
    rightRowsBelow: number;
  }>;
  bestTransitionCandidate?: {
    bodyRegionTop: number;
    score: number;
    rejectedReasons: string[];
    rowsAboveClassifiedAsTitleOrFullWidth: number;
    leftRowsBelow: number;
    rightRowsBelow: number;
  };
  transitionConfidence?: number;
  transitionRejectionReason?: string;
  outputProfileId?: ReadingOutputProfileId;
};

export type NormalizedBoundsRect = {
  kind: "bounds";
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type NormalizedCropFractions = NormalizedCropRect & {
  kind?: "crop-fractions";
};

export type NormalizedRectDiagnostics = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type ColumnSafetyDiagnostics = {
  proposedCropBounds: NormalizedRectDiagnostics;
  contentBounds?: NormalizedRectDiagnostics;
  finalCropBounds: NormalizedRectDiagnostics;
  exportCropFractions: NormalizedRectDiagnostics;
  originalFinalCropBounds?: NormalizedRectDiagnostics;
  gutter: {
    left: number;
    right: number;
    center: number;
  };
  gutterSafetyPadding: number;
  outerPadding: number;
  innerPadding: number;
  contentInsideCrop: boolean;
  crossesGutter: boolean;
  cutsContentLeft: boolean;
  cutsContentRight: boolean;
  cutsContentTop: boolean;
  cutsContentBottom: boolean;
  paddingClamped: boolean;
  repairAttempted: boolean;
  repairStatus?: "not-needed" | "repaired" | "failed";
  repairFailureReason?:
    | "would-cross-gutter"
    | "would-include-neighbor-column"
    | "invalid-crop-after-repair"
    | "content-too-close-to-gutter"
    | "content-outside-page";
  overflowLeft: number;
  overflowRight: number;
  overflowTop: number;
  overflowBottom: number;
  expandedLeft?: number;
  expandedRight?: number;
  expandedTop?: number;
  expandedBottom?: number;
  failedCheck?: string;
};

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NormalizedCropRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type CropSettings = {
  mode: CropMode;
  manualPreset: ManualCropPreset;
  percentage: number;
};

export type PageCropAnalysis = {
  pageNumber: number;
  status: CropStatus;
  cropRect: CropRect;
  normalizedCrop: NormalizedCropRect;
  gainPercent: number;
  reason?: string;
};

export type ColumnCrop = {
  sourcePageNumber: number;
  column: "left" | "right";
  crop: NormalizedCropRect;
  contentBounds?: NormalizedBoundsRect;
  gainPercent: number;
  breakFractions?: number[];
  breakDetails?: TileBreakDetail[];
  breakStrategy?: "smart" | "fallback";
  paginationMode?: ColumnPaginationMode;
  paginationReason?: "no-vertical-break-needed" | "no-safe-break-found" | "valid-breaks" | "last-resort";
  outputTileCount?: number;
  verticalBreakCount?: number;
  breakCoverageComplete?: boolean;
};

export type ReadingTile = {
  sourcePageNumber: number;
  column?: "left" | "right";
  tileIndex: number;
  tileCount: number;
  crop: NormalizedCropRect;
  outputProfileId: ReadingOutputProfileId;
  label: string;
  paginationMode?: ColumnPaginationMode;
  paginationReason?: string;
  outputTileCount?: number;
  verticalBreakCount?: number;
  breakCoverageComplete?: boolean;
  contentFillRatio?: number;
  widthFitScale?: number;
  singleColumnScale?: number;
  breakStrategy?: "smart" | "fallback";
  breakKind?: TileBreakKind;
  continuationMode?: TileContinuationMode;
  overlapBeforeRepair?: number;
  overlapAfterRepair?: number;
  estimatedLineHeight?: number;
  duplicateBoundaryLikely?: boolean;
  continuityRepairApplied?: boolean;
  glyphSafetyApplied?: boolean;
  boundaryRepaired?: boolean;
  repairDirection?: "up" | "down" | "none";
  topBoundarySafe?: boolean;
  bottomBoundarySafe?: boolean;
  overlapRatio?: number;
};

export type PlanValidationResult = {
  ok: boolean;
  issues: string[];
};

export type OutputPageValidationResult = PlanValidationResult & {
  duplicateCropBounds: boolean;
  cropProgressionValid: boolean;
  breakDiagnosticsPresent: boolean;
};

export type AcademicRegionPlan = {
  regionId: string;
  kind: AcademicRegionKind;
  sourceBounds: NormalizedBoundsRect;
  contentBounds: NormalizedBoundsRect;
  safeCropBounds: NormalizedBoundsRect;
  textLayerAvailable: boolean;
  textRowsDetected: number;
  regionQuality: AcademicRegionQuality;
};

export type AcademicOutputPagePlan = {
  outputId: string;
  sourcePageNumber: number;
  sourceRegionId: string;
  regionKind: AcademicRegionKind;
  outputPageIndex: number;
  sourceCropBounds: NormalizedBoundsRect;
  finalExportCropBounds: NormalizedBoundsRect;
  sourceCropFractions: NormalizedCropRect;
  outputProfileId: ReadingOutputProfileId;
  placement: OutputPlacement;
  paginationMode: AcademicOutputPaginationMode;
  contentFillRatio: number;
  widthFitScale: number;
  outputPageFillQuality: OutputPageFillQuality;
  estimatedReadableScale: number;
  availableOutputWidth?: number;
  availableOutputHeight?: number;
  sourceCropWidth?: number;
  sourceCropHeight?: number;
  drawnContentWidth?: number;
  drawnContentHeight?: number;
  horizontalFillRatio?: number;
  verticalFillRatio?: number;
  blankAreaRatio?: number;
  sourceSliceHeight?: number;
  effectiveSourceSliceHeight?: number;
  targetRowsPerSlice?: number;
  maxRowsPerSlice?: number;
  profileLimitedSliceHeight?: boolean;
  sliceHeightLimitReason?: string;
  kindleReadable?: boolean;
  kindleOverFragmentationDetected?: boolean;
  kindleOrphanRepairAttempted?: boolean;
  kindleOrphanRepairStatus?: string;
  topBoundaryCutsRow?: boolean;
  bottomBoundaryCutsRow?: boolean;
  nearestTopRowDistance?: number;
  nearestBottomRowDistance?: number;
  verticalGlyphPaddingApplied?: number;
  repairedBoundaryForKindle?: boolean;
  exportBoundaryValidationPassed?: boolean;
  normalizedCropBounds?: NormalizedBoundsRect;
  pdfLibCropBounds?: NormalizedBoundsRect;
  pdfLibCropValidationPassed?: boolean;
  previewExportCropDelta?: number;
  textClippingRisk?: boolean;
  cropBoundaryValidationPassed?: boolean;
  rowsOnPage?: number;
  bodyTextCharsOnPage?: number;
  isFinalSliceInRegion?: boolean;
  previousPageCanAbsorb?: boolean;
  nextPageCanAbsorb?: boolean;
  naturalEndingEvidence?: string;
  shortPageDetected?: boolean;
  shortPageKind?: ShortPageKind;
  minRowsPerUsefulPage?: number;
  orphanRepairAttempted?: boolean;
  orphanRepairStatus?: "not-needed" | "merged-with-previous" | "rebalanced" | "kept-natural-final" | "unsafe-to-repair";
  mergedWithPrevious?: boolean;
  redistributedRows?: boolean;
  failureCategories: AcademicFailureCategory[];
  breakBefore?: TileBoundaryDiagnostics;
  breakAfter?: TileBoundaryDiagnostics;
  validation: OutputPageValidationResult;
};

export type AcademicSourcePagePlan = {
  sourcePageNumber: number;
  strategy: AcademicPageStrategy;
  regions: AcademicRegionPlan[];
  outputPages: AcademicOutputPagePlan[];
  validation: PlanValidationResult;
  summary: {
    sourceRegionCount: number;
    outputPageCount: number;
    verticalBreakCount: number;
    outputPageCountByRegion: Record<string, number>;
    breakCoverageComplete: boolean;
    failureCategories: AcademicFailureCategory[];
    repairedFailures: AcademicFailureCategory[];
    unrepairedFailures: AcademicFailureCategory[];
    repairActionsApplied: string[];
    titleAuthorRepairApplied?: boolean;
    fullWidthTitleRegionDetected?: boolean;
    bodyRegionTop?: number;
    layoutKind?: string;
    titleRegionContainsColumnRows?: boolean;
    rowCoveragePassed?: boolean;
    duplicatedTextRowsCount?: number;
    missingTextRowsCount?: number;
    unaccountedMissingRowsCount?: number;
    ignoredRowsCount?: number;
    ignoredRowsByReason?: Record<string, number>;
    rowCoverageFailureReason?: string;
    nearDuplicateOutputPages?: boolean;
    productQualityGrade?: ProductQualityGrade;
    productQualityScore?: number;
    productQualityIssues?: ProductQualityIssue[];
    qualityGatePassed?: boolean;
    academicPageClass?: AcademicPageClass;
    pageClassReason?: string;
    mixedSplitReason?: "title-header-plus-body" | "figure-table-plus-body" | "body-columns-with-noisy-header" | "partial-two-column-body" | "uncertain";
    titleDetectionApplicable?: boolean;
    titleDetectionSkippedReason?: string;
    bodyColumnExtractionAttempted?: boolean;
    bodyColumnExtractionSucceeded?: boolean;
    rawColumnDetectorSuggestedSplit?: boolean;
    plannerAcceptedColumnSplit?: boolean;
    plannerRejectedColumnSplitReason?: string;
    shortPageCount?: number;
    badOrphanPageCount?: number;
    naturalShortFinalCount?: number;
    orphanRepairCount?: number;
    firstPagePolicy?: "preserve-cover-page" | "preserve-title-abstract-page" | "title-body-split" | "title-plus-short-body-preserve" | "partial-body-extraction" | "unsafe-preserve";
    firstPagePolicyReason?: string;
    titleRowsCount?: number;
    authorRowsCount?: number;
    abstractRowsCount?: number;
    bodyRowsBelowTitle?: number;
    leftBodyRowsBelowTitle?: number;
    rightBodyRowsBelowTitle?: number;
    bodySymmetryRatio?: number;
    bodyWorthExtracting?: boolean;
    firstPageSplitConfidence?: number;
    firstPagePreservedForSafety?: boolean;
    firstPagePreservedShortBody?: boolean;
    shortAsymmetricBodyDetected?: boolean;
    titleStandaloneSuppressed?: boolean;
    titleStandaloneSuppressionReason?: string;
    firstPagePreserveReason?: string;
    firstPageQualityWarning?: string;
    continuousFlowEnabled?: boolean;
    selectedOutputProfileId?: ReadingOutputProfileId;
    outputPageWidth?: number;
    outputPageHeight?: number;
    outputMargins?: {
      top: number;
      bottom: number;
      side: number;
    };
    targetReadableScale?: number;
    minReadableScale?: number;
    maxSourceSliceHeightRatio?: number;
    targetRowsPerSlice?: number;
    maxRowsPerSlice?: number;
    minRowsPerSlice?: number;
    preferShorterSlices?: boolean;
    allowMoreOutputPages?: boolean;
    profileAggressiveness?: string;
    kindleTallSliceCount?: number;
    kindleReadablePageCount?: number;
    kindleUnreadablePageCount?: number;
    kindleOverFragmentationDetected?: boolean;
    rowsPerSliceDistribution?: number[];
    medianRowsPerKindlePage?: number;
    minRowsPerKindlePage?: number;
    tinySliceCount?: number;
    singleSentenceSliceCount?: number;
    kindlePageFillMedian?: number;
    kindlePageFillMin?: number;
    kindleMedianVerticalFillRatio?: number;
    kindleMinVerticalFillRatio?: number;
    kindleLowFillPageCount?: number;
    kindleComfortBalanceApplied?: boolean;
    kindleComfortBalancePassed?: boolean;
    kindleMicroZoomApplied?: boolean;
    kindleZoomPolishApplied?: boolean;
    oldKindleMargins?: { top: number; bottom: number; side: number };
    newKindleMargins?: { top: number; bottom: number; side: number };
    oldTargetReadableScale?: number;
    newTargetReadableScale?: number;
    availableWidthBefore?: number;
    availableWidthAfter?: number;
    estimatedTextScaleBefore?: number;
    estimatedTextScaleAfter?: number;
    expectedTextScaleGainPercent?: number;
    firstPagePreserveUserMessage?: string;
    firstPagePreserveIsExpectedBehavior?: boolean;
    bodyPagesOptimizedAfterFirstPage?: boolean;
    kindleCropBoundaryRiskCount?: number;
    kindleOrphanRepairAttemptedCount?: number;
    kindleOrphanRepairSucceededCount?: number;
    transitionCandidates?: Array<{
      bodyRegionTop: number;
      score: number;
      rejectedReasons: string[];
      rowsAboveClassifiedAsTitleOrFullWidth: number;
      leftRowsBelow: number;
      rightRowsBelow: number;
    }>;
    bestTransitionCandidate?: {
      bodyRegionTop: number;
      score: number;
      rejectedReasons: string[];
      rowsAboveClassifiedAsTitleOrFullWidth: number;
      leftRowsBelow: number;
      rightRowsBelow: number;
    };
    transitionConfidence?: number;
    transitionRejectionReason?: string;
  };
};

export type AcademicPlanSummary = {
  sourcePageCount: number;
  outputPageCount: number;
  verticalBreakCount: number;
  breakCoverageComplete: boolean;
  failureCategories: AcademicFailureCategory[];
  repairedFailures: AcademicFailureCategory[];
  unrepairedFailures: AcademicFailureCategory[];
  repairActionsApplied: string[];
  productQualityGrade?: ProductQualityGrade;
  productQualityScore?: number;
  productQualityIssues?: ProductQualityIssue[];
  qualityGatePassed?: boolean;
};

export type AcademicPlanDiagnostics = {
  validation: PlanValidationResult;
};

export type AcademicReadingPlan = {
  fileName?: string;
  selectedPreset?: string;
  outputProfileId: ReadingOutputProfileId;
  sourcePages: AcademicSourcePagePlan[];
  summary: AcademicPlanSummary;
  diagnostics: AcademicPlanDiagnostics;
};

export type PageReadingTransform =
  | {
      sourcePageNumber: number;
      mode: "column-reading";
      status: "split";
      columns: ColumnCrop[];
      confidence: number;
      textRows?: TextLineRow[];
      debug?: ColumnDetectionDebug;
      reason?: string;
    }
  | {
      sourcePageNumber: number;
      mode: "margin-crop";
      status: CropStatus;
      crop: NormalizedCropRect;
      gainPercent: number;
      textRows?: TextLineRow[];
      debug?: ColumnDetectionDebug;
      reason?: string;
    }
  | {
      sourcePageNumber: number;
      mode: "preserved";
      status: ColumnSplitStatus | CropStatus;
      crop: NormalizedCropRect;
      gainPercent: number;
      textRows?: TextLineRow[];
      debug?: ColumnDetectionDebug;
      reason?: string;
    };

export type PdfProcessStatus =
  | "idle"
  | "validating"
  | "parsing"
  | "rendering"
  | "ready"
  | "error";

export type ValidationSuccess = {
  ok: true;
};

export type ValidationFailure = {
  ok: false;
  code: "empty" | "too-large" | "not-pdf";
  message: string;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;
