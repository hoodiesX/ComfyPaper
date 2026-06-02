import { describe, expect, it } from "vitest";
import { getCommandBarChips } from "@/lib/metrics/exportSummaryCopy";
import type { ExportSummary } from "@/lib/metrics/pageSummary";

const baseSummary: ExportSummary = {
  pageLimit: 5,
  totalPages: 21,
  croppedPages: 7,
  preservedPages: 3,
  estimatedOutputPages: 17,
  exportScope: "limited-preview",
  sourcePagesIncluded: 5,
  readingPagesIncluded: 12,
  totalSourcePages: 21,
  totalReadingPagesEstimated: 17,
  freeSourcePageLimit: 5,
  freeReadingPageLimit: 12,
  exportLimitHitBy: "reading-pages",
  exportLimitMessage: "Free beta exports up to 5 source pages or 12 reading pages. Full-document export is Pro.",
  outputReadingPages: 12,
  presetLabel: "Academic Paper",
  limitText: "First 5 of 21 source pages",
  exportLimitApplied: true,
  exportLimitReason: "Free beta exports up to 5 source pages or 12 reading pages. Full-document export is Pro.",
  exportLimitReasonCode: "free-beta-limit",
  sourcePageCount: 21,
  exportPageCount: 5
};

describe("command bar export summary copy", () => {
  it("formats column mode as compact chips without raw long summary text", () => {
    const chips = getCommandBarChips(baseSummary, true);

    expect(chips).toEqual(["Column reading", "12 pages", "First 5 pages", "Local"]);
    expect(chips.join(" ")).not.toContain("source pages");
    expect(chips.join(" ")).not.toContain("Academic Paper");
  });

  it("formats margin crop mode without column-reading claims", () => {
    const chips = getCommandBarChips(baseSummary, false);

    expect(chips).toEqual(["Margin crop", "First 5 pages", "Local"]);
    expect(chips).not.toContain("17 pages");
  });
});
