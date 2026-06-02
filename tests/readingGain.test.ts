import { describe, expect, it } from "vitest";
import { calculateReadingGainPercent } from "@/lib/metrics/readingGain";

describe("calculateReadingGainPercent", () => {
  it("returns zero for no crop", () => {
    expect(calculateReadingGainPercent({ left: 0, right: 0, top: 0, bottom: 0 })).toBe(0);
  });

  it("calculates symmetric crop gain", () => {
    expect(calculateReadingGainPercent({ left: 0.1, right: 0.1, top: 0.1, bottom: 0.1 })).toBe(56);
  });

  it("handles invalid crop values safely", () => {
    expect(calculateReadingGainPercent({ left: Number.NaN, right: -1, top: 0, bottom: 0 })).toBe(0);
  });

  it("clamps extreme values", () => {
    expect(calculateReadingGainPercent({ left: 0.9, right: 0.9, top: 0.9, bottom: 0.9 })).toBeGreaterThan(0);
  });
});
