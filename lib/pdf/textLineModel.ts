import type { NormalizedCropRect, TextLineRow, TileBreakDetail } from "@/types/pdf";
import type { ReadingOutputProfile } from "./readingProfiles";

type PdfTextContent = {
  items: Array<PdfTextItem | Record<string, unknown>>;
};

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export function extractTextRowsFromContent(
  textContent: PdfTextContent,
  pageView: [number, number, number, number] | number[]
): TextLineRow[] {
  const [, yMin, xMax, yMax] = pageView;
  const pageWidth = Math.max(1, xMax - pageView[0]);
  const pageHeight = Math.max(1, yMax - yMin);
  const rows: TextLineRow[] = [];

  for (const item of textContent.items) {
    if (!isTextItem(item) || item.str.trim().length === 0) continue;

    const x = item.transform[4];
    const y = item.transform[5];
    const width = Math.max(item.width, item.str.length * 2);
    const height = Math.max(item.height, Math.abs(item.transform[3]), 6);
    const left = clamp01((x - pageView[0]) / pageWidth);
    const right = clamp01((x + width - pageView[0]) / pageWidth);
    const bottom = clamp01(1 - (y - yMin) / pageHeight);
    const top = clamp01(1 - (y + height - yMin) / pageHeight);

    if (right <= left || bottom <= top) continue;

    mergeRow(rows, {
      left,
      right,
      top,
      bottom,
      itemCount: 1
    });
  }

  return rows.sort((a, b) => a.top - b.top);
}

export function findTextLayerTileBreaks(
  rows: TextLineRow[],
  crop: NormalizedCropRect,
  profile: ReadingOutputProfile
): { breaks: number[]; details: TileBreakDetail[] } {
  const columnRows = rows
    .filter((row) =>
      row.right > crop.left &&
      row.left < 1 - crop.right &&
      row.bottom > crop.top &&
      row.top < 1 - crop.bottom
    )
    .sort((a, b) => a.top - b.top);

  if (columnRows.length < 4) {
    return { breaks: [], details: [] };
  }

  const columnWidth = 1 - crop.left - crop.right;
  const columnHeight = 1 - crop.top - crop.bottom;
  const idealSliceHeight = columnWidth / profile.aspectRatio;
  const desiredBreakCount = Math.min(
    profile.maxTilesPerColumn - 1,
    Math.max(0, Math.ceil(columnHeight / idealSliceHeight) - 1)
  );
  const breaks: number[] = [];
  const details: TileBreakDetail[] = [];
  let previousTop = crop.top;

  for (let index = 1; index <= desiredBreakCount; index += 1) {
    const ideal = previousTop + idealSliceHeight;
    const remainingHeight = 1 - crop.bottom - previousTop;

    if (remainingHeight <= idealSliceHeight * 1.18) break;

    const candidate = findBestRowGap(columnRows, ideal, previousTop, 1 - crop.bottom, profile);
    if (!candidate) break;

    breaks.push(candidate.position);
    details.push({
      position: candidate.position,
      originalPosition: ideal,
      inkDensity: 0,
      breakKind: candidate.kind,
      originalBreakKind: candidate.kind,
      continuationMode: "clean-non-overlap",
      breakSource: "text-layer",
      boundaryRepaired: Math.abs(candidate.position - ideal) > 0.002,
      repairDirection: candidate.position < ideal ? "up" : candidate.position > ideal ? "down" : "none",
      expandedSearchUsed: candidate.expanded,
      safeCandidateFound: true,
      lastResortFallback: false,
      topBoundarySafe: true,
      bottomBoundarySafe: true,
      whitespaceBandTop: candidate.gapTop,
      whitespaceBandBottom: candidate.gapBottom,
      previousFinalBottom: candidate.gapTop,
      nextFinalTop: candidate.gapBottom,
      corridorHeight: candidate.gapBottom - candidate.gapTop,
      corridorToLineHeightRatio: candidate.gapHeight / candidate.estimatedLineHeight,
      gapInkDensity: 0,
      maxCorridorRowInkDensity: 0,
      upperGuardInkDensity: 0,
      lowerGuardInkDensity: 0,
      maxAdjacentGuardInkDensity: 0,
      finalBoundaryValid: true
    });
    previousTop = candidate.gapBottom;
  }

  return { breaks, details };
}

function findBestRowGap(
  rows: TextLineRow[],
  ideal: number,
  minTop: number,
  maxBottom: number,
  profile: ReadingOutputProfile
) {
  const medianLineHeight = getMedian(rows.map((row) => row.bottom - row.top)) || 0.018;
  const minGap = Math.max(
    profile.minAbsoluteCorridorHeightRatio,
    medianLineHeight * profile.minWhitespaceCorridorToLineHeightRatio
  );
  const searchWindow = (maxBottom - minTop) * profile.breakSearchWindowRatio;
  const expandedWindow = (maxBottom - minTop) * profile.rowSafetySearchWindowRatio * 1.75;
  const normal = findGap(rows, ideal, minTop, maxBottom, minGap, searchWindow);
  if (normal) return { ...normal, estimatedLineHeight: medianLineHeight, expanded: false };
  const expanded = findGap(rows, ideal, minTop, maxBottom, minGap, expandedWindow);
  return expanded ? { ...expanded, estimatedLineHeight: medianLineHeight, expanded: true } : undefined;
}

function findGap(
  rows: TextLineRow[],
  ideal: number,
  minTop: number,
  maxBottom: number,
  minGap: number,
  searchWindow: number
) {
  let best: { position: number; gapTop: number; gapBottom: number; gapHeight: number; kind: "paragraph-gap" | "line-gap"; distance: number } | undefined;

  for (let index = 0; index < rows.length - 1; index += 1) {
    const current = rows[index];
    const next = rows[index + 1];
    const gapTop = Math.max(current.bottom, minTop);
    const gapBottom = Math.min(next.top, maxBottom);
    const gapHeight = gapBottom - gapTop;
    const position = (gapTop + gapBottom) / 2;
    const distance = Math.abs(position - ideal);

    if (gapHeight < minGap || position <= minTop || position >= maxBottom || distance > searchWindow) {
      continue;
    }

    const kind = gapHeight >= minGap * 1.8 ? "paragraph-gap" : "line-gap";
    if (!best || distance < best.distance || (distance === best.distance && gapHeight > best.gapHeight)) {
      best = { position, gapTop, gapBottom, gapHeight, kind, distance };
    }
  }

  return best;
}

function mergeRow(rows: TextLineRow[], next: TextLineRow) {
  const center = (next.top + next.bottom) / 2;
  const existing = rows.find((row) => center >= row.top - 0.004 && center <= row.bottom + 0.004);

  if (!existing) {
    rows.push(next);
    return;
  }

  existing.left = Math.min(existing.left, next.left);
  existing.right = Math.max(existing.right, next.right);
  existing.top = Math.min(existing.top, next.top);
  existing.bottom = Math.max(existing.bottom, next.bottom);
  existing.itemCount += next.itemCount;
}

function getMedian(values: number[]): number {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  return sorted[Math.floor(sorted.length / 2)];
}

function isTextItem(item: PdfTextContent["items"][number]): item is PdfTextItem {
  return "str" in item && "transform" in item;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
