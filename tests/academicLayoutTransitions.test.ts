import { describe, expect, it } from "vitest";
import { detectAcademicLayoutTransitions } from "@/lib/pdf/academicLayoutTransitions";
import type { TextLineRow } from "@/types/pdf";

const rows: TextLineRow[] = [
  { left: 0.2, right: 0.8, top: 0.05, bottom: 0.08, itemCount: 1 },
  { left: 0.28, right: 0.72, top: 0.1, bottom: 0.13, itemCount: 1 },
  { left: 0.08, right: 0.45, top: 0.24, bottom: 0.26, itemCount: 1 },
  { left: 0.55, right: 0.92, top: 0.24, bottom: 0.26, itemCount: 1 },
  { left: 0.08, right: 0.45, top: 0.29, bottom: 0.31, itemCount: 1 },
  { left: 0.55, right: 0.92, top: 0.29, bottom: 0.31, itemCount: 1 },
  { left: 0.08, right: 0.45, top: 0.34, bottom: 0.36, itemCount: 1 },
  { left: 0.55, right: 0.92, top: 0.34, bottom: 0.36, itemCount: 1 }
];

describe("academic layout transitions", () => {
  it("detects a full-width title followed by a two-column body", () => {
    const transition = detectAcademicLayoutTransitions(rows, {
      pageTop: 0.04,
      pageBottom: 0.94,
      gutterLeft: 0.48,
      gutterRight: 0.52,
      minRowsPerColumnBelow: 3,
      minTitleRowsAbove: 1,
      maxSearchBottom: 0.48,
      minWhitespaceGap: 0.01
    });

    expect(transition.layoutKind).toBe("full-width-title-plus-two-column-body");
    expect(transition.bodyRegionTop).toBeGreaterThan(0.13);
    expect(transition.bodyRegionTop).toBeLessThan(0.3);
    expect(transition.bodyRegionTop).not.toBe(0.45);
    expect(transition.evidence.titleRegionContainsColumnRows).toBe(false);
    expect(transition.evidence.transitionCandidates?.length).toBeGreaterThan(0);
    expect(transition.evidence.transitionCandidates?.[0].bodyRegionTop).not.toBe(0.45);
  });

  it("does not invent a title boundary when no stable two-column body is present", () => {
    const transition = detectAcademicLayoutTransitions(rows.slice(0, 3), {
      pageTop: 0.04,
      pageBottom: 0.94,
      gutterLeft: 0.48,
      gutterRight: 0.52,
      minRowsPerColumnBelow: 3,
      minTitleRowsAbove: 1,
      maxSearchBottom: 0.48,
      minWhitespaceGap: 0.01
    });

    expect(transition.layoutKind).toBe("unknown");
    expect(transition.rejectionReason).toBeTruthy();
    expect(transition.evidence.transitionCandidates).toBeDefined();
  });
});
