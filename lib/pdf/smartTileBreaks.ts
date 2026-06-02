import type { NormalizedCropRect, TileBreakDetail, TileBreakKind, TileContinuationMode } from "@/types/pdf";
import type { ReadingOutputProfile } from "./readingProfiles";
import type { PixelData } from "./cropDetection";
import { estimateBackgroundColor, isBackgroundPixel } from "./cropDetection";

export type SmartBreakResult = {
  breaks: number[];
  details: TileBreakDetail[];
  strategy: "smart" | "fallback";
};

export type HorizontalInkProfile = {
  top: number;
  bottom: number;
  rowHeight: number;
  densities: number[];
};

type CorridorMetrics = {
  corridorTop: number;
  corridorBottom: number;
  corridorHeight: number;
  corridorToLineHeightRatio: number;
  corridorInkDensity: number;
  maxCorridorRowInkDensity: number;
  upperGuardInkDensity: number;
  lowerGuardInkDensity: number;
  maxAdjacentGuardInkDensity: number;
  finalBoundaryValid: boolean;
  rejectionReasonIfInvalid?: string;
};

export function findSmartTileBreaks(
  pixels: PixelData,
  crop: NormalizedCropRect,
  profile: ReadingOutputProfile
): SmartBreakResult {
  const columnWidth = 1 - crop.left - crop.right;
  const columnHeight = 1 - crop.top - crop.bottom;
  const idealTileHeight = columnWidth / profile.aspectRatio;
  const tileCount = Math.min(profile.maxTilesPerColumn, Math.max(1, Math.ceil(columnHeight / idealTileHeight)));

  if (tileCount <= 1) {
    return { breaks: [], details: [], strategy: "smart" };
  }

  const inkProfile = computeHorizontalInkProfile(pixels, crop, profile);
  const breaks: number[] = [];
  const details: TileBreakDetail[] = [];
  let usedFallback = false;

  for (let index = 1; index < tileCount; index += 1) {
    const ideal = crop.top + (columnHeight * index) / tileCount;
    const searchWindow = columnHeight * profile.breakSearchWindowRatio;
    const bandHeight = Math.max(3 / pixels.height, columnHeight * profile.breakBandHeightRatio);
    const minY = Math.max(crop.top + bandHeight, ideal - searchWindow);
    const maxY = Math.min(1 - crop.bottom - bandHeight, ideal + searchWindow);
    const boundary = findRepairableBoundary(
      inkProfile,
      ideal,
      minY,
      maxY,
      crop,
      columnHeight,
      profile
    );

    if (!boundary) {
      usedFallback = true;
      continue;
    }

    const bestY = boundary.position;
    const bestDensity = boundary.inkDensity;
    let breakKind: TileBreakKind = "clean-whitespace";
    let continuationMode: TileContinuationMode = "clean-non-overlap";
    if (!boundary.safe || bestDensity > profile.maxBreakInkDensity) {
      usedFallback = true;
      breakKind = "fallback-dense";
      continuationMode = "emergency-overlap";
    } else if (bestDensity <= profile.maxBreakInkDensity * 0.18) {
      breakKind = "paragraph-gap";
      continuationMode = "clean-non-overlap";
    } else if (bestDensity > profile.maxBreakInkDensity * 0.55) {
      breakKind = "line-gap";
      continuationMode = "clean-non-overlap";
    }
    const corridor = boundary.corridor;

    breaks.push(bestY);
    details.push({
      position: bestY,
      originalPosition: ideal,
      inkDensity: bestDensity,
      breakKind,
      originalBreakKind: boundary.expandedSearchUsed ? "fallback-dense" : breakKind,
      continuationMode,
      boundaryRepaired: boundary.repaired,
      repairDirection: boundary.repairDirection,
      expandedSearchUsed: boundary.expandedSearchUsed,
      safeCandidateFound: boundary.safe,
      lastResortFallback: !boundary.safe,
      topBoundarySafe: boundary.safe,
      bottomBoundarySafe: boundary.safe,
      whitespaceBandTop: corridor?.corridorTop,
      whitespaceBandBottom: corridor?.corridorBottom,
      previousFinalBottom: corridor?.corridorTop,
      nextFinalTop: corridor?.corridorBottom,
      corridorHeight: corridor?.corridorHeight,
      corridorToLineHeightRatio: corridor?.corridorToLineHeightRatio,
      gapInkDensity: corridor?.corridorInkDensity ?? bestDensity,
      maxCorridorRowInkDensity: corridor?.maxCorridorRowInkDensity,
      upperGuardInkDensity: corridor?.upperGuardInkDensity,
      lowerGuardInkDensity: corridor?.lowerGuardInkDensity,
      maxAdjacentGuardInkDensity: corridor?.maxAdjacentGuardInkDensity,
      finalBoundaryValid: boundary.safe && breakKind !== "fallback-dense" && corridor?.finalBoundaryValid === true,
      rejectionReasonIfInvalid: corridor?.rejectionReasonIfInvalid
    });
  }

  const orderedBreaks = enforceOrderedBreaks(breaks, crop);
  return {
    breaks: orderedBreaks,
    details: details.map((detail, index) => ({
      ...detail,
      position: orderedBreaks[index] ?? detail.position
    })),
    strategy: usedFallback ? "fallback" : "smart"
  };
}

function findRepairableBoundary(
  inkProfile: HorizontalInkProfile,
  ideal: number,
  minY: number,
  maxY: number,
  crop: NormalizedCropRect,
  columnHeight: number,
  profile: ReadingOutputProfile
): ReturnType<typeof findNearestSafeBoundary> & { expandedSearchUsed: boolean } | undefined {
  const firstPass = findNearestSafeBoundary(inkProfile, ideal, minY, maxY, profile);

  if (firstPass.safe) {
    return { ...firstPass, expandedSearchUsed: false };
  }

  const expandedWindow = columnHeight * profile.rowSafetySearchWindowRatio * 2;
  const minTileHeight = columnHeight * profile.minTileHeightRatio;
  const expandedMinY = Math.max(crop.top + minTileHeight, ideal - expandedWindow);
  const expandedMaxY = Math.min(1 - crop.bottom - minTileHeight, ideal + expandedWindow);

  if (expandedMinY >= expandedMaxY) {
    return undefined;
  }

  const secondPass = findNearestSafeBoundary(inkProfile, ideal, expandedMinY, expandedMaxY, profile);

  if (secondPass.safe) {
    return { ...secondPass, expandedSearchUsed: true };
  }

  return undefined;
}

export function computeHorizontalInkProfile(
  pixels: PixelData,
  crop: NormalizedCropRect,
  profile: ReadingOutputProfile
): HorizontalInkProfile {
  const background = estimateBackgroundColor(pixels);
  const startX = Math.max(0, Math.floor(pixels.width * crop.left));
  const endX = Math.min(pixels.width, Math.ceil(pixels.width * (1 - crop.right)));
  const startY = Math.max(0, Math.floor(pixels.height * crop.top));
  const endY = Math.min(pixels.height, Math.ceil(pixels.height * (1 - crop.bottom)));
  const raw: number[] = [];

  for (let y = startY; y < endY; y += 1) {
    let ink = 0;
    let total = 0;

    for (let x = startX; x < endX; x += 1) {
      total += 1;
      const offset = (y * pixels.width + x) * 4;
      if (!isBackgroundPixel(
        pixels.data[offset],
        pixels.data[offset + 1],
        pixels.data[offset + 2],
        pixels.data[offset + 3],
        background
      )) {
        ink += 1;
      }
    }

    raw.push(total === 0 ? 1 : ink / total);
  }

  return {
    top: crop.top,
    bottom: 1 - crop.bottom,
    rowHeight: 1 / pixels.height,
    densities: smoothInkProfile(raw, profile.profileSmoothingRadius)
  };
}

export function smoothInkProfile(densities: number[], radius: number): number[] {
  if (radius <= 0) return densities;

  return densities.map((_, index) => {
    let total = 0;
    let count = 0;

    for (let offset = -radius; offset <= radius; offset += 1) {
      const value = densities[index + offset];
      if (typeof value === "number") {
        total += value;
        count += 1;
      }
    }

    return count === 0 ? 1 : total / count;
  });
}

export function isBoundaryWhitespace(
  inkProfile: HorizontalInkProfile,
  boundary: number,
  profile: ReadingOutputProfile
): boolean {
  return getBoundaryInkDensity(inkProfile, boundary, profile) <= profile.maxBoundaryInkDensity;
}

export function findNearestSafeBoundary(
  inkProfile: HorizontalInkProfile,
  ideal: number,
  minY: number,
  maxY: number,
  profile: ReadingOutputProfile
): {
  position: number;
  inkDensity: number;
  safe: boolean;
  repaired: boolean;
  repairDirection: "up" | "down" | "none";
  corridor?: CorridorMetrics;
} {
  const step = inkProfile.rowHeight;
  let bestSafe: { position: number; inkDensity: number; distance: number; corridor: CorridorMetrics } | undefined;
  let leastDense = {
    position: ideal,
    inkDensity: getBoundaryInkDensity(inkProfile, ideal, profile),
    distance: 0,
    corridor: getCorridorMetrics(inkProfile, ideal, profile)
  };

  for (let candidate = minY; candidate <= maxY; candidate += step) {
    const corridor = getCorridorMetrics(inkProfile, candidate, profile);
    const inkDensity = corridor.corridorInkDensity;
    const distance = Math.abs(candidate - ideal);
    const score = inkDensity + corridor.maxAdjacentGuardInkDensity * 0.5 + distance / Math.max(maxY - minY, step) * 0.015;

    if (corridor.finalBoundaryValid) {
      if (!bestSafe || distance < bestSafe.distance || (distance === bestSafe.distance && inkDensity < bestSafe.inkDensity)) {
        bestSafe = { position: candidate, inkDensity, distance, corridor };
      }
    }

    const leastDenseScore = leastDense.inkDensity +
      leastDense.corridor.maxAdjacentGuardInkDensity * 0.5 +
      leastDense.distance / Math.max(maxY - minY, step) * 0.015;
    if (score < leastDenseScore) {
      leastDense = { position: candidate, inkDensity, distance, corridor };
    }
  }

  const selected = bestSafe ?? leastDense;

  return {
    position: selected.position,
    inkDensity: selected.inkDensity,
    safe: Boolean(bestSafe),
    repaired: Math.abs(selected.position - ideal) > step,
    repairDirection: selected.position < ideal ? "up" : selected.position > ideal ? "down" : "none",
    corridor: selected.corridor
  };
}

function getCorridorMetrics(
  inkProfile: HorizontalInkProfile,
  boundary: number,
  profile: ReadingOutputProfile
): CorridorMetrics {
  const lineHeight = 0.022 * (inkProfile.bottom - inkProfile.top);
  const corridorHeight = Math.max(
    profile.minAbsoluteCorridorHeightRatio,
    profile.minWhitespaceCorridorHeightRatio,
    lineHeight * profile.minWhitespaceCorridorToLineHeightRatio
  );
  const guardHeight = Math.max(
    profile.finalBoundaryGuardBandRatio,
    lineHeight * profile.corridorGuardBandToLineHeightRatio
  );
  const corridorTop = boundary - corridorHeight / 2;
  const corridorBottom = boundary + corridorHeight / 2;
  const corridor = getRangeStats(inkProfile, corridorTop, corridorBottom);
  const upperGuard = getRangeStats(inkProfile, corridorTop - guardHeight, corridorTop);
  const lowerGuard = getRangeStats(inkProfile, corridorBottom, corridorBottom + guardHeight);
  const maxAdjacentGuardInkDensity = Math.max(upperGuard.average, lowerGuard.average, upperGuard.max, lowerGuard.max);
  let rejectionReasonIfInvalid: string | undefined;

  if (corridorHeight / lineHeight < profile.minWhitespaceCorridorToLineHeightRatio) {
    rejectionReasonIfInvalid = "corridor-too-thin";
  } else if (corridor.average > profile.maxCorridorInkDensity || corridor.average > profile.maxFinalBoundaryInkDensity) {
    rejectionReasonIfInvalid = "corridor-too-inky";
  } else if (corridor.max > profile.maxFinalBoundaryInkDensity) {
    rejectionReasonIfInvalid = "dense-row-inside-corridor";
  } else if (maxAdjacentGuardInkDensity > profile.maxAdjacentGuardInkDensity) {
    rejectionReasonIfInvalid = "dense-adjacent-guard";
  }

  return {
    corridorTop,
    corridorBottom,
    corridorHeight,
    corridorToLineHeightRatio: corridorHeight / lineHeight,
    corridorInkDensity: corridor.average,
    maxCorridorRowInkDensity: corridor.max,
    upperGuardInkDensity: Math.max(upperGuard.average, upperGuard.max),
    lowerGuardInkDensity: Math.max(lowerGuard.average, lowerGuard.max),
    maxAdjacentGuardInkDensity,
    finalBoundaryValid: !rejectionReasonIfInvalid,
    rejectionReasonIfInvalid
  };
}

function getRangeStats(
  inkProfile: HorizontalInkProfile,
  top: number,
  bottom: number
): { average: number; max: number } {
  const start = Math.max(0, Math.floor((top - inkProfile.top) / inkProfile.rowHeight));
  const end = Math.min(inkProfile.densities.length - 1, Math.ceil((bottom - inkProfile.top) / inkProfile.rowHeight));
  let total = 0;
  let count = 0;
  let max = 0;

  for (let index = start; index <= end; index += 1) {
    const value = inkProfile.densities[index];
    if (typeof value === "number") {
      total += value;
      max = Math.max(max, value);
      count += 1;
    }
  }

  return { average: count === 0 ? 1 : total / count, max: count === 0 ? 1 : max };
}

function getBoundaryInkDensity(
  inkProfile: HorizontalInkProfile,
  boundary: number,
  profile: ReadingOutputProfile
): number {
  const center = Math.round((boundary - inkProfile.top) / inkProfile.rowHeight);
  const radius = Math.max(1, Math.round(profile.rowSafetyBandRatio / inkProfile.rowHeight / 2));
  let total = 0;
  let count = 0;

  for (let index = center - radius; index <= center + radius; index += 1) {
    const value = inkProfile.densities[index];
    if (typeof value === "number") {
      total += value;
      count += 1;
    }
  }

  return count === 0 ? 1 : total / count;
}

function enforceOrderedBreaks(breaks: number[], crop: NormalizedCropRect): number[] {
  const minGap = (1 - crop.top - crop.bottom) * 0.12;
  let previous = crop.top;

  return breaks.map((breakPosition) => {
    const next = Math.min(1 - crop.bottom - minGap, Math.max(previous + minGap, breakPosition));
    previous = next;
    return next;
  });
}
