import type { NormalizedBoundsRect, TextLineRow } from "@/types/pdf";

export type AcademicLayoutTransition = {
  layoutKind:
    | "full-width-title-plus-two-column-body"
    | "single-column-title-plus-two-column-body"
    | "two-column-from-top"
    | "single-column-page"
    | "figure-table-page"
    | "unknown";
  titleRegion?: NormalizedBoundsRect;
  bodyRegionTop?: number;
  bodyRegionBottom?: number;
  confidence: number;
  evidence: {
    rowsAboveClassifiedAsTitleOrFullWidth: number;
    rowsBelowClassifiedAsColumns: number;
    leftRowsBelow: number;
    rightRowsBelow: number;
    gutterClearBelow: boolean;
    selectedWhitespaceGap?: { top: number; bottom: number; height: number };
    alternativeCandidates: number[];
    transitionCandidates?: Array<{
      bodyRegionTop: number;
      score: number;
      rejectedReasons: string[];
      rowsAboveClassifiedAsTitleOrFullWidth: number;
      leftRowsBelow: number;
      rightRowsBelow: number;
      leftRowsBelowImmediate: number;
      rightRowsBelowImmediate: number;
      leftRowsBelowTotal: number;
      rightRowsBelowTotal: number;
      lowerRegionTwoColumnConfidence: number;
      asymmetricColumnStartDetected: boolean;
      shortBodyAccepted: boolean;
    }>;
    titleRegionContainsColumnRows: boolean;
  };
  fallbackUsed: boolean;
  rejectionReason?: string;
};

export type LayoutTransitionConfig = {
  pageTop: number;
  pageBottom: number;
  gutterLeft: number;
  gutterRight: number;
  minRowsPerColumnBelow: number;
  minTitleRowsAbove: number;
  maxSearchBottom: number;
  minWhitespaceGap: number;
};

export function detectAcademicLayoutTransitions(
  rows: TextLineRow[],
  config: LayoutTransitionConfig
): AcademicLayoutTransition {
  const sortedRows = rows
    .filter((row) => row.bottom > config.pageTop && row.top < config.pageBottom)
    .sort((a, b) => a.top - b.top);

  if (sortedRows.length < config.minRowsPerColumnBelow * 2) {
    return unknown("not-enough-text-rows");
  }

  const candidates = findCandidateGaps(sortedRows, config);
  const transitionCandidates = candidates.map((candidate) => {
    const above = sortedRows.filter((row) => row.bottom <= candidate.top);
    const below = sortedRows.filter((row) => row.top >= candidate.bottom);
    const immediateBelow = below.filter((row) => row.top <= candidate.bottom + 0.16);
    const leftRowsBelow = below.filter((row) => isLeftColumnRow(row, config)).length;
    const rightRowsBelow = below.filter((row) => isRightColumnRow(row, config)).length;
    const leftRowsBelowImmediate = immediateBelow.filter((row) => isLeftColumnRow(row, config)).length;
    const rightRowsBelowImmediate = immediateBelow.filter((row) => isRightColumnRow(row, config)).length;
    const fullWidthAbove = above.filter((row) => isFullWidthOrCentered(row, config)).length;
    const columnRowsAbove = above.filter((row) => isLeftColumnRow(row, config) || isRightColumnRow(row, config)).length;
    const lowerRegionTwoColumnConfidence = getLowerRegionTwoColumnConfidence(leftRowsBelow, rightRowsBelow, below.length);
    const asymmetricColumnStartDetected = Math.abs(leftRowsBelowImmediate - rightRowsBelowImmediate) >= 2 &&
      Math.min(leftRowsBelow, rightRowsBelow) > 0;
    const fullStableBody = leftRowsBelow >= config.minRowsPerColumnBelow &&
      rightRowsBelow >= config.minRowsPerColumnBelow &&
      leftRowsBelow + rightRowsBelow >= config.minRowsPerColumnBelow * 2;
    const shortBodyAccepted = !fullStableBody && lowerRegionTwoColumnConfidence >= 0.42 && Math.min(leftRowsBelow, rightRowsBelow) >= 1;
    const rejectedReasons = [
      leftRowsBelow < config.minRowsPerColumnBelow && !shortBodyAccepted ? "not-enough-left-column-rows-below" : "",
      rightRowsBelow < config.minRowsPerColumnBelow && !shortBodyAccepted ? "not-enough-right-column-rows-below" : "",
      fullWidthAbove < config.minTitleRowsAbove ? "not-enough-title-or-full-width-rows-above" : "",
      columnRowsAbove > fullWidthAbove * 1.5 ? "title-region-would-contain-column-rows" : ""
    ].filter(Boolean);

    return {
      bodyRegionTop: candidate.bottom,
      score: candidate.height + Math.min(leftRowsBelow, rightRowsBelow) * 0.01 + fullWidthAbove * 0.006 - rejectedReasons.length * 0.05,
      rejectedReasons,
      rowsAboveClassifiedAsTitleOrFullWidth: fullWidthAbove,
      leftRowsBelow,
      rightRowsBelow,
      leftRowsBelowImmediate,
      rightRowsBelowImmediate,
      leftRowsBelowTotal: leftRowsBelow,
      rightRowsBelowTotal: rightRowsBelow,
      lowerRegionTwoColumnConfidence,
      asymmetricColumnStartDetected,
      shortBodyAccepted
    };
  });
  for (const candidate of candidates) {
    const above = sortedRows.filter((row) => row.bottom <= candidate.top);
    const below = sortedRows.filter((row) => row.top >= candidate.bottom);
    const leftRowsBelow = below.filter((row) => isLeftColumnRow(row, config)).length;
    const rightRowsBelow = below.filter((row) => isRightColumnRow(row, config)).length;
    const fullWidthAbove = above.filter((row) => isFullWidthOrCentered(row, config)).length;
    const columnRowsAbove = above.filter((row) => isLeftColumnRow(row, config) || isRightColumnRow(row, config)).length;
    const rowsBelowClassifiedAsColumns = leftRowsBelow + rightRowsBelow;
    const lowerRegionTwoColumnConfidence = getLowerRegionTwoColumnConfidence(leftRowsBelow, rightRowsBelow, below.length);
    const fullStableBody = (
      leftRowsBelow >= config.minRowsPerColumnBelow &&
      rightRowsBelow >= config.minRowsPerColumnBelow &&
      rowsBelowClassifiedAsColumns >= config.minRowsPerColumnBelow * 2
    );
    const shortBodyAccepted = !fullStableBody && lowerRegionTwoColumnConfidence >= 0.42 && Math.min(leftRowsBelow, rightRowsBelow) >= 1;
    const stableBody = fullStableBody || shortBodyAccepted;

    if (!stableBody || fullWidthAbove < config.minTitleRowsAbove) {
      continue;
    }

    const bodyRegionTop = candidate.bottom;
    const titleRegion = {
      kind: "bounds" as const,
      left: 0,
      top: config.pageTop,
      right: 1,
      bottom: candidate.top
    };
    const titleRegionContainsColumnRows = columnRowsAbove > fullWidthAbove * 1.5;

    return {
      layoutKind: "full-width-title-plus-two-column-body",
      titleRegion,
      bodyRegionTop,
      bodyRegionBottom: config.pageBottom,
      confidence: titleRegionContainsColumnRows ? 0.52 : shortBodyAccepted ? 0.68 : 0.86,
      evidence: {
        rowsAboveClassifiedAsTitleOrFullWidth: fullWidthAbove,
        rowsBelowClassifiedAsColumns,
        leftRowsBelow,
        rightRowsBelow,
        gutterClearBelow: true,
        selectedWhitespaceGap: candidate,
        alternativeCandidates: candidates.map((gap) => gap.bottom),
        transitionCandidates,
        titleRegionContainsColumnRows
      },
      fallbackUsed: false
    };
  }

  const firstColumnRow = sortedRows.find((row) => isLeftColumnRow(row, config) || isRightColumnRow(row, config));
  if (firstColumnRow && firstColumnRow.top <= config.pageTop + 0.08) {
    return {
      layoutKind: "two-column-from-top",
      bodyRegionTop: config.pageTop,
      bodyRegionBottom: config.pageBottom,
      confidence: 0.72,
      evidence: {
        rowsAboveClassifiedAsTitleOrFullWidth: 0,
        rowsBelowClassifiedAsColumns: sortedRows.filter((row) => isLeftColumnRow(row, config) || isRightColumnRow(row, config)).length,
        leftRowsBelow: sortedRows.filter((row) => isLeftColumnRow(row, config)).length,
        rightRowsBelow: sortedRows.filter((row) => isRightColumnRow(row, config)).length,
        gutterClearBelow: true,
        alternativeCandidates: [],
        transitionCandidates: [],
        titleRegionContainsColumnRows: false
      },
      fallbackUsed: false
    };
  }

  return unknown("no-stable-two-column-body-start", transitionCandidates);
}

function getLowerRegionTwoColumnConfidence(leftRows: number, rightRows: number, totalRows: number): number {
  if (totalRows === 0) return 0;
  const columnRows = leftRows + rightRows;
  const balance = Math.min(leftRows, rightRows) / Math.max(leftRows, rightRows, 1);
  const columnDensity = columnRows / totalRows;
  return Math.min(1, columnDensity * 0.65 + balance * 0.35);
}

function findCandidateGaps(rows: TextLineRow[], config: LayoutTransitionConfig) {
  const gaps: Array<{ top: number; bottom: number; height: number }> = [];
  const maxBottom = Math.min(config.pageBottom, config.maxSearchBottom);

  for (let index = 0; index < rows.length - 1; index += 1) {
    const current = rows[index];
    const next = rows[index + 1];
    const top = current.bottom;
    const bottom = next.top;
    const height = bottom - top;

    if (top <= config.pageTop || bottom >= maxBottom || height < config.minWhitespaceGap) {
      continue;
    }

    gaps.push({ top, bottom, height });
  }

  return gaps.sort((a, b) => {
    const aScore = a.height - Math.abs(a.bottom - 0.24) * 0.25;
    const bScore = b.height - Math.abs(b.bottom - 0.24) * 0.25;
    return bScore - aScore;
  });
}

function isFullWidthOrCentered(row: TextLineRow, config: LayoutTransitionConfig): boolean {
  const width = row.right - row.left;
  const center = (row.left + row.right) / 2;
  return row.left < config.gutterLeft && row.right > config.gutterRight || (width >= 0.22 && center > 0.38 && center < 0.62);
}

function isLeftColumnRow(row: TextLineRow, config: LayoutTransitionConfig): boolean {
  return row.right <= config.gutterLeft + 0.025 && row.left < config.gutterLeft;
}

function isRightColumnRow(row: TextLineRow, config: LayoutTransitionConfig): boolean {
  return row.left >= config.gutterRight - 0.025 && row.right > config.gutterRight;
}

function unknown(
  rejectionReason: string,
  transitionCandidates: AcademicLayoutTransition["evidence"]["transitionCandidates"] = []
): AcademicLayoutTransition {
  return {
    layoutKind: "unknown",
    confidence: 0,
    evidence: {
      rowsAboveClassifiedAsTitleOrFullWidth: 0,
      rowsBelowClassifiedAsColumns: 0,
      leftRowsBelow: 0,
      rightRowsBelow: 0,
      gutterClearBelow: false,
      alternativeCandidates: transitionCandidates.map((candidate) => candidate.bodyRegionTop),
      transitionCandidates,
      titleRegionContainsColumnRows: false
    },
    fallbackUsed: false,
    rejectionReason
  };
}
