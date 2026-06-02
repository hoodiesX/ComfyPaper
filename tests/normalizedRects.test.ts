import { describe, expect, it } from "vitest";
import {
  boundsContainsBounds,
  boundsToCropFractions,
  cropFractionsToBounds,
  getBoundsCutDetails,
  makeBoundsRect
} from "@/lib/pdf/normalizedRects";

describe("normalized rectangle helpers", () => {
  it("converts absolute bounds to crop fractions and back", () => {
    const bounds = makeBoundsRect(0.062, 0.126, 0.521, 0.874);
    const crop = boundsToCropFractions(bounds);

    expect(crop).toEqual({
      kind: "crop-fractions",
      left: 0.062,
      top: 0.126,
      right: 0.479,
      bottom: 0.126
    });
    expect(cropFractionsToBounds(crop)).toEqual(bounds);
  });

  it("does not confuse absolute right bounds with right crop fractions", () => {
    const outer = makeBoundsRect(0.062, 0.126, 0.521, 0.874);
    const inner = makeBoundsRect(0.087, 0.154, 0.518, 0.846);
    const details = getBoundsCutDetails(outer, inner);

    expect(boundsContainsBounds(outer, inner)).toBe(true);
    expect(details.cutsContentRight).toBe(false);
  });

  it("detects a true right-edge content cut", () => {
    const outer = makeBoundsRect(0.062, 0.126, 0.5, 0.874);
    const inner = makeBoundsRect(0.087, 0.154, 0.518, 0.846);
    const details = getBoundsCutDetails(outer, inner);

    expect(boundsContainsBounds(outer, inner)).toBe(false);
    expect(details.cutsContentRight).toBe(true);
  });
});
