"use client";

import type { ColumnDetectionDebug, PdfMetadata } from "@/types/pdf";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";

type ColumnDiagnosticsPanelProps = {
  diagnostics: ColumnDetectionDebug[];
  fileName?: string;
  metadata?: PdfMetadata | null;
  selectedPreset: ReadingPresetConfig;
  columnModeEnabled: boolean;
  config: Record<string, number>;
};

export function ColumnDiagnosticsPanel({
  diagnostics,
  fileName,
  metadata,
  selectedPreset,
  columnModeEnabled,
  config
}: ColumnDiagnosticsPanelProps) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const payload = {
    fileName: fileName ?? "missing",
    pageCount: metadata?.pageCount ?? "missing",
    selectedPreset: selectedPreset.id,
    columnModeEnabled,
    thresholds: config,
    summary: {
      pagesAnalyzed: diagnostics.length,
      splitPages: diagnostics.filter((item) => item.decision === "split").length,
      fallbackPages: diagnostics.filter((item) => item.decision !== "split").length
    },
    diagnostics
  };

  async function copyDiagnostics() {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  }

  return (
    <details className="rounded-lg border border-sage/25 bg-white/75 p-3 text-sm shadow-soft">
      <summary className="cursor-pointer font-semibold text-ink">Column Reading Diagnostics</summary>
      <div className="mt-3 grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink/55">
            Development only. Use this to inspect why a page split or fell back.
          </p>
          <button
            type="button"
            onClick={copyDiagnostics}
            className="rounded-md border border-sage/25 bg-paper px-2.5 py-1 text-xs font-semibold text-ink"
          >
            Copy diagnostics JSON
          </button>
        </div>
        <div className="grid gap-2">
          {diagnostics.length === 0 ? (
            <p className="rounded-md bg-mist/55 px-3 py-2 text-ink/60">No column diagnostics collected yet.</p>
          ) : (
            diagnostics.map((item) => (
              <div key={item.pageNumber} className="rounded-md border border-sage/15 bg-paper/70 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink">
                  <span>Page {item.pageNumber}</span>
                  <span>{item.presetId ?? "missing"}</span>
                  <span>Column Mode {item.columnModeEnabled ? "ON" : "OFF"}</span>
                  <span>Allowed {item.allowed ? "YES" : "NO"}</span>
                </div>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-ink/62 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Decision" value={item.decision} />
                  <Metric label="Reason" value={item.reason} />
                  <Metric label="Confidence" value={formatNumber(item.confidence)} />
                  <Metric label="Tile count" value={formatMaybe(item.tileCount)} />
                  <Metric label="Output pages" value={formatMaybe(item.outputPageCount)} />
                  <Metric label="Vertical breaks" value={formatMaybe(item.verticalBreakCount)} />
                  <Metric label="Break coverage" value={String(item.breakCoverageComplete ?? "missing")} />
                  <Metric label="Source regions" value={formatMaybe(item.sourceRegionCount)} />
                  <Metric label="Academic strategy" value={item.academicStrategy ?? "missing"} />
                  <Metric label="Plan valid" value={String(item.planValidationPassed ?? "missing")} />
                  <Metric label="Failure taxonomy" value={item.academicFailureCategories?.join(", ") || "none"} />
                  <Metric label="Repaired failures" value={item.repairedFailures?.join(", ") || "none"} />
                  <Metric label="Unrepaired failures" value={item.unrepairedFailures?.join(", ") || "none"} />
                  <Metric label="Repair actions" value={item.repairActionsApplied?.join(", ") || "none"} />
                  <Metric label="Title repair" value={String(item.titleAuthorRepairApplied ?? false)} />
                  <Metric label="Body starts at" value={formatMaybe(item.bodyRegionTop)} />
                  <Metric label="Title contains columns" value={String(item.titleRegionContainsColumnRows ?? false)} />
                  <Metric label="Row coverage" value={String(item.rowCoveragePassed ?? "missing")} />
                  <Metric label="Duplicated/missing rows" value={`${formatMaybe(item.duplicatedTextRowsCount)} / ${formatMaybe(item.missingTextRowsCount)}`} />
                  <Metric label="Near duplicate pages" value={String(item.nearDuplicateOutputPages ?? false)} />
                  <Metric label="Fill quality" value={item.outputPageFillQualities?.join(", ") || "missing"} />
                  <Metric label="Gutter width" value={formatMaybe(item.gutter?.width)} />
                  <Metric label="Gutter ink" value={`${formatMaybe(item.gutter?.inkDensity)} / max ${formatMaybe(item.measurements?.maxGutterInkRatio)}`} />
                  <Metric label="Clear segments" value={`${formatMaybe(item.gutter?.clearSegmentRatio)} / min ${formatMaybe(item.measurements?.minGutterClearSegmentRatio)}`} />
                  <Metric label="Left density" value={formatMaybe(item.measurements?.leftDensity)} />
                  <Metric label="Right density" value={formatMaybe(item.measurements?.rightDensity)} />
                  <Metric label="Balance" value={`${formatMaybe(item.measurements?.balanceRatio)} / min ${formatMaybe(item.measurements?.minColumnBalanceRatio)}`} />
                  <Metric label="Min gutter confidence" value={formatMaybe(item.measurements?.minGutterEmptyRatio)} />
                  <Metric label="Min content" value={formatMaybe(item.measurements?.minColumnContentDensity)} />
                </dl>
                {item.leftColumn?.safety || item.rightColumn?.safety ? (
                  <details className="mt-3 rounded-md border border-sage/15 bg-white/65 p-2">
                    <summary className="cursor-pointer text-xs font-semibold text-ink/70">
                      Column safety details
                    </summary>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {item.leftColumn?.safety ? (
                        <SafetyDetails title="Left column" safety={item.leftColumn.safety} />
                      ) : null}
                      {item.rightColumn?.safety ? (
                        <SafetyDetails title="Right column" safety={item.rightColumn.safety} />
                      ) : null}
                    </div>
                  </details>
                ) : null}
                {item.tileBreaks && item.tileBreaks.length > 0 ? (
                  <details className="mt-3 rounded-md border border-sage/15 bg-white/65 p-2">
                    <summary className="cursor-pointer text-xs font-semibold text-ink/70">
                      Tile boundary details
                    </summary>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {item.tileBreaks.map((detail, index) => (
                        <div
                          key={`${detail.column}-${index}-${detail.position}`}
                          className="rounded-md bg-paper/70 p-2 text-xs"
                        >
                          <p className="font-semibold text-ink">
                            {detail.column} column break {index + 1}
                          </p>
                          <dl className="mt-1 grid gap-1 text-ink/62">
                            <Metric label="Break kind" value={detail.breakKind} />
                            <Metric label="Original break" value={detail.originalBreakKind ?? detail.breakKind} />
                            <Metric label="Mode" value={detail.continuationMode} />
                            <Metric label="Position" value={formatNumber(detail.position)} />
                            <Metric label="Original position" value={formatMaybe(detail.originalPosition)} />
                            <Metric label="Whitespace band" value={`${formatMaybe(detail.whitespaceBandTop)} / ${formatMaybe(detail.whitespaceBandBottom)}`} />
                            <Metric label="Final bottom/top" value={`${formatMaybe(detail.previousFinalBottom)} / ${formatMaybe(detail.nextFinalTop)}`} />
                            <Metric label="Corridor height" value={formatMaybe(detail.corridorHeight)} />
                            <Metric label="Corridor/line" value={formatMaybe(detail.corridorToLineHeightRatio)} />
                            <Metric label="Gap ink" value={formatMaybe(detail.gapInkDensity)} />
                            <Metric label="Max corridor row" value={formatMaybe(detail.maxCorridorRowInkDensity)} />
                            <Metric label="Upper/lower guard" value={`${formatMaybe(detail.upperGuardInkDensity)} / ${formatMaybe(detail.lowerGuardInkDensity)}`} />
                            <Metric label="Max guard ink" value={formatMaybe(detail.maxAdjacentGuardInkDensity)} />
                            <Metric label="Final boundary valid" value={String(detail.finalBoundaryValid ?? false)} />
                            <Metric label="Invalid reason" value={detail.rejectionReasonIfInvalid ?? "none"} />
                            <Metric label="Boundary ink" value={formatNumber(detail.inkDensity)} />
                            <Metric label="Overlap" value={formatNumber(detail.overlapRatio)} />
                            <Metric label="Overlap before/after" value={`${formatNumber(detail.overlapBeforeRepair)} / ${formatNumber(detail.overlapAfterRepair)}`} />
                            <Metric label="Estimated line height" value={formatNumber(detail.estimatedLineHeight)} />
                            <Metric label="Top/bottom safe" value={`${String(detail.topBoundarySafe)} / ${String(detail.bottomBoundarySafe)}`} />
                            <Metric label="Boundary repaired" value={String(detail.boundaryRepaired ?? false)} />
                            <Metric label="Repair direction" value={detail.repairDirection ?? "none"} />
                            <Metric label="Expanded search" value={String(detail.expandedSearchUsed ?? false)} />
                            <Metric label="Safe candidate" value={String(detail.safeCandidateFound ?? true)} />
                            <Metric label="Last resort" value={String(detail.lastResortFallback ?? false)} />
                            <Metric label="Duplicate likely" value={String(detail.duplicateBoundaryLikely)} />
                            <Metric label="Continuity repair" value={String(detail.continuityRepairApplied)} />
                            <Metric label="Excessive overlap" value={String(detail.excessiveOverlap)} />
                          </dl>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </details>
  );
}

function SafetyDetails({
  title,
  safety
}: {
  title: string;
  safety: NonNullable<ColumnDetectionDebug["leftColumn"]>["safety"];
}) {
  if (!safety) return null;

  return (
    <div className="rounded-md bg-paper/70 p-2 text-xs">
      <p className="font-semibold text-ink">{title}</p>
      <dl className="mt-1 grid gap-1 text-ink/62">
        <Metric label="Content inside crop" value={String(safety.contentInsideCrop)} />
        <Metric label="Crosses gutter" value={String(safety.crossesGutter)} />
        <Metric label="Padding clamped" value={String(safety.paddingClamped)} />
        <Metric label="Repair status" value={safety.repairStatus ?? "missing"} />
        <Metric label="Repair failure" value={safety.repairFailureReason ?? "none"} />
        <Metric label="Failed check" value={safety.failedCheck ?? "none"} />
        <Metric label="Overflow L/R" value={`${formatNumber(safety.overflowLeft)} / ${formatNumber(safety.overflowRight)}`} />
        <Metric label="Overflow T/B" value={`${formatNumber(safety.overflowTop)} / ${formatNumber(safety.overflowBottom)}`} />
        <Metric label="Expanded L/R" value={`${formatMaybe(safety.expandedLeft)} / ${formatMaybe(safety.expandedRight)}`} />
        <Metric label="Expanded T/B" value={`${formatMaybe(safety.expandedTop)} / ${formatMaybe(safety.expandedBottom)}`} />
        <Metric label="Cuts left/right" value={`${safety.cutsContentLeft} / ${safety.cutsContentRight}`} />
        <Metric label="Cuts top/bottom" value={`${safety.cutsContentTop} / ${safety.cutsContentBottom}`} />
        <Metric label="Final crop bounds" value={formatRect(safety.finalCropBounds)} />
        <Metric label="Original final bounds" value={safety.originalFinalCropBounds ? formatRect(safety.originalFinalCropBounds) : "missing"} />
        <Metric label="Content bounds" value={safety.contentBounds ? formatRect(safety.contentBounds) : "missing"} />
        <Metric label="Proposed crop bounds" value={formatRect(safety.proposedCropBounds)} />
        <Metric label="Export crop fractions" value={formatRect(safety.exportCropFractions)} />
      </dl>
    </div>
  );
}

function formatRect(rect: { left: number; top: number; right: number; bottom: number; width: number; height: number }) {
  return `L ${formatNumber(rect.left)} T ${formatNumber(rect.top)} R ${formatNumber(rect.right)} B ${formatNumber(rect.bottom)} W ${formatNumber(rect.width)} H ${formatNumber(rect.height)}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-ink/45">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function formatMaybe(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? formatNumber(value) : "missing";
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "missing";
}
