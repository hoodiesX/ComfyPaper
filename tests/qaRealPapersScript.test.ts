import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("real paper QA benchmark harness", () => {
  it("is exposed through npm scripts", () => {
    const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

    expect(packageJson.scripts["qa:real-papers"]).toBe("node scripts/qa-real-papers.mjs");
  });

  it("uses local-only input and report folders", () => {
    const gitignore = readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");
    const script = readFileSync(path.join(process.cwd(), "scripts/qa-real-papers.mjs"), "utf8");

    expect(gitignore).toContain("qa/pdfs-local/");
    expect(gitignore).toContain("qa/real-paper-reports/");
    expect(script).toContain('"qa", "pdfs-local"');
    expect(script).toContain('"qa", "real-paper-reports"');
    expect(script).toContain('"summary.md"');
  });

  it("exits gracefully and writes an empty summary when no local PDFs are present", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "real-paper-qa-"));
    const output = execFileSync("node", [path.join(process.cwd(), "scripts/qa-real-papers.mjs")], {
      cwd,
      encoding: "utf8"
    });

    expect(output).toContain("No local benchmark PDFs found");
  });

  it("contains required benchmark report fields and manual review checklist fields", () => {
    const script = readFileSync(path.join(process.cwd(), "scripts/qa-real-papers.mjs"), "utf8");

    expect(script).toContain("--preset");
    expect(script).toContain("--pages");
    expect(script).toContain("--max-pages");
    expect(script).toContain("--sample");
    expect(script).toContain("distributed");
    expect(script).toContain("pagesSplit");
    expect(script).toContain("pagesPreserved");
    expect(script).toContain("pagesMarkedRisky");
    expect(script).toContain("possibleClippingRisks");
    expect(script).toContain("possibleFullWidthContentRisks");
    expect(script).toContain("possibleFigureTableFormulaRisks");
    expect(script).toContain("outputReadingPagesCount");
    expect(script).toContain("exportReadiness");
    expect(script).toContain("qualityWarnings");
    expect(script).toContain("severeIssues");
    expect(script).toContain("letterClipping");
    expect(script).toContain("brokenFormula");
    expect(script).toContain("brokenFigureTable");
    expect(script).toContain("badFullWidthSplit");
    expect(script).toContain("excessiveBlankShortPages");
    expect(script).toContain("acceptableOutput");
  });

  it("uses strict per-preset classification and summary sections", () => {
    const script = readFileSync(path.join(process.cwd(), "scripts/qa-real-papers.mjs"), "utf8");

    expect(script).toContain("presetSummaries");
    expect(script).toContain("Worst Offenders");
    expect(script).toContain("Recommended product action");
    expect(script).toContain("needs-review");
    expect(script).toContain("orphanOutputPages");
    expect(script).toContain("singleSentenceOutputPages");
    expect(script).toContain("lowFillExcessivePages");
    expect(script).toContain("unreadableKindleOutputPages");
  });
});
