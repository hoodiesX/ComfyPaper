import type {
  NormalizedBoundsRect,
  NormalizedCropFractions,
  NormalizedCropRect,
  NormalizedRectDiagnostics
} from "@/types/pdf";

export type BoundsCutDetails = {
  contains: boolean;
  cutsContentLeft: boolean;
  cutsContentRight: boolean;
  cutsContentTop: boolean;
  cutsContentBottom: boolean;
};

export function makeBoundsRect(
  left: number,
  top: number,
  right: number,
  bottom: number
): NormalizedBoundsRect {
  return normalizeBoundsRect({ kind: "bounds", left, top, right, bottom });
}

export function normalizeBoundsRect(bounds: NormalizedBoundsRect): NormalizedBoundsRect {
  const left = clampUnit(bounds.left);
  const top = clampUnit(bounds.top);
  const right = Math.max(left, clampUnit(bounds.right));
  const bottom = Math.max(top, clampUnit(bounds.bottom));

  return { kind: "bounds", left, top, right, bottom };
}

export function validateBoundsRect(bounds: NormalizedBoundsRect): boolean {
  return (
    bounds.kind === "bounds" &&
    isUnit(bounds.left) &&
    isUnit(bounds.top) &&
    isUnit(bounds.right) &&
    isUnit(bounds.bottom) &&
    bounds.right >= bounds.left &&
    bounds.bottom >= bounds.top
  );
}

export function validateCropFractions(crop: NormalizedCropRect): boolean {
  return (
    isUnit(crop.left) &&
    isUnit(crop.top) &&
    isUnit(crop.right) &&
    isUnit(crop.bottom) &&
    crop.left + crop.right <= 1 &&
    crop.top + crop.bottom <= 1
  );
}

export function boundsToCropFractions(bounds: NormalizedBoundsRect): NormalizedCropFractions {
  const normalized = normalizeBoundsRect(bounds);

  return {
    kind: "crop-fractions",
    left: normalized.left,
    top: normalized.top,
    right: 1 - normalized.right,
    bottom: 1 - normalized.bottom
  };
}

export function cropFractionsToBounds(crop: NormalizedCropRect): NormalizedBoundsRect {
  return normalizeBoundsRect({
    kind: "bounds",
    left: crop.left,
    top: crop.top,
    right: 1 - crop.right,
    bottom: 1 - crop.bottom
  });
}

export function boundsContainsBounds(
  outer: NormalizedBoundsRect,
  inner: NormalizedBoundsRect,
  tolerance = 0
): boolean {
  return getBoundsCutDetails(outer, inner, tolerance).contains;
}

export function getBoundsCutDetails(
  outer: NormalizedBoundsRect,
  inner: NormalizedBoundsRect,
  tolerance = 0
): BoundsCutDetails {
  const cutsContentLeft = outer.left > inner.left + tolerance;
  const cutsContentTop = outer.top > inner.top + tolerance;
  const cutsContentRight = outer.right < inner.right - tolerance;
  const cutsContentBottom = outer.bottom < inner.bottom - tolerance;

  return {
    contains: !cutsContentLeft && !cutsContentRight && !cutsContentTop && !cutsContentBottom,
    cutsContentLeft,
    cutsContentRight,
    cutsContentTop,
    cutsContentBottom
  };
}

export function boundsToDiagnostics(bounds: NormalizedBoundsRect): NormalizedRectDiagnostics {
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom,
    width: Math.max(0, bounds.right - bounds.left),
    height: Math.max(0, bounds.bottom - bounds.top)
  };
}

export function cropFractionsToDiagnostics(crop: NormalizedCropRect): NormalizedRectDiagnostics {
  return {
    left: crop.left,
    top: crop.top,
    right: crop.right,
    bottom: crop.bottom,
    width: Math.max(0, 1 - crop.left - crop.right),
    height: Math.max(0, 1 - crop.top - crop.bottom)
  };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function isUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
