import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("academic QA harness", () => {
  it("exits gracefully when no QA PDFs are present", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "academic-qa-"));
    const output = execFileSync("node", [path.join(process.cwd(), "scripts/qa-academic.mjs")], {
      cwd,
      encoding: "utf8"
    });

    expect(output).toContain("No QA PDFs found");
  });

  it("contains Academic vs Kindle mode comparison reporting", () => {
    const script = readFileSync(path.join(process.cwd(), "scripts/qa-academic.mjs"), "utf8");

    expect(script).toContain("applyModeComparisons");
    expect(script).toContain("kindleMoreAggressiveThanAcademic");
    expect(script).toContain("profileSimilarityToAcademic");
    expect(script).toContain("kindleTallSliceCount");
    expect(script).toContain("firstPagePolicyCounts");
    expect(script).toContain("firstPagePreservedShortBodyCount");
    expect(script).toContain("kindleOverfragmentedPageCount");
    expect(script).toContain("kindleCropBoundaryRiskCount");
    expect(script).toContain("kindleTinySliceCount");
    expect(script).toContain("kindleLowFillPageCount");
    expect(script).toContain("kindleMedianVerticalFillRatio");
    expect(script).toContain("kindleMicroZoomApplied");
    expect(script).toContain("expectedTextScaleGainPercent");
    expect(script).toContain("userReportGenerated");
    expect(script).toContain("exportReadiness");
    expect(script).toContain("bestComparisonPageSelected");
    expect(script).toContain("upgradeCTAVisible");
  });
});
