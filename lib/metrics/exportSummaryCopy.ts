import type { ExportSummary } from "./pageSummary";

export function getCommandBarChips(
  summary: ExportSummary,
  columnModeEnabled: boolean
): string[] {
  const scope = summary.exportLimitApplied ? `First ${summary.sourcePagesIncluded} pages` : "Full document";
  return columnModeEnabled
    ? [
        "Column reading",
        `${summary.outputReadingPages} pages`,
        scope,
        "Local"
      ]
    : ["Margin crop", scope, "Local"];
}
