"use client";

import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import type { ExportSummary } from "@/lib/metrics/pageSummary";
import type { UserOptimizationReport } from "@/lib/product/optimizationReport";

type ExportPanelProps = {
  canExport: boolean;
  isLoaded: boolean;
  isSafeAutoReady: boolean;
  isExporting: boolean;
  exportMessage?: string | null;
  exportError?: string | null;
  pageCount?: number;
  preset: ReadingPresetConfig;
  exportSummary: ExportSummary;
  columnModeEnabled?: boolean;
  outputProfileLabel?: string;
  optimizationReport: UserOptimizationReport;
  onExport: () => void;
};

export function ExportPanel({
  canExport,
  isLoaded,
  isSafeAutoReady,
  isExporting,
  exportMessage,
  exportError,
  pageCount,
  preset,
  exportSummary,
  columnModeEnabled = false,
  outputProfileLabel,
  optimizationReport,
  onExport
}: ExportPanelProps) {
  const statusText = getStatusText(isLoaded, isSafeAutoReady, optimizationReport.exportReadiness);
  const scopeText = optimizationReport.exportLimitApplied
    ? "Preview export"
    : exportSummary.exportScope === "full-document"
      ? "Full document export"
      : "Preview export";
  const ctaLabel = getCtaLabel(optimizationReport.exportReadiness, optimizationReport.exportLimitApplied);
  const sourcePagesIncluded = optimizationReport.sourcePagesIncluded ?? exportSummary.sourcePagesIncluded;
  const totalSourcePages = optimizationReport.totalSourcePages ?? pageCount;

  return (
    <section className="rounded-lg border border-sage/25 bg-white/85 p-4 shadow-soft" data-qa="export-readiness-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={getBadgeClass(optimizationReport.exportReadiness)}>{statusText}</span>
            <span className="text-sm font-semibold text-ink">
              {preset.label} · {scopeText}
            </span>
            <span className="rounded-full border border-sage/20 bg-white/80 px-2.5 py-1 text-xs font-semibold text-ink/62" data-qa="plan-tier-indicator">
              {optimizationReport.planTier === "pro" ? "Pro enabled" : "Free Beta"}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold text-ink">
            {optimizationReport.exportLimitApplied
              ? "Preview export"
              : optimizationReport.exportReadiness === "ready"
                ? "Ready to export"
                : statusText}
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink/68">
            {optimizationReport.exportReadinessReason}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <StatChip label={`${optimizationReport.optimizedBodyPagesCount} optimized`} />
            <StatChip label={`${optimizationReport.preservedPagesCount} preserved`} />
            <StatChip label={`${optimizationReport.reviewPagesCount} review`} />
            <StatChip label={`${optimizationReport.readingPagesIncluded ?? exportSummary.readingPagesIncluded} reading pages`} />
            <StatChip
              label={optimizationReport.exportLimitApplied
                ? `${sourcePagesIncluded ?? exportSummary.pageLimit} source pages`
                : "Full document"}
            />
          </div>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-ink/62 md:grid-cols-2">
            <p>{optimizationReport.exportLimitReason}</p>
            <p>Files stay in your browser.</p>
          </div>
          {optimizationReport.exportLimitApplied ? (
            <p className="mt-1 text-sm leading-6 text-ink/55">
              Export includes up to {optimizationReport.freeSourcePageLimit} source pages or {optimizationReport.freeReadingPageLimit} reading pages.
              {totalSourcePages ? ` This file has ${totalSourcePages} source pages.` : ""}
            </p>
          ) : null}
          <p className="mt-1 text-sm leading-6 text-ink/55">
            {columnModeEnabled
              ? `${outputProfileLabel ?? "Reading"} profile. Body pages are converted into normal portrait reading pages.`
              : "Conservative margin cleanup keeps complex pages close to the original."}
          </p>
          {optimizationReport.planTier === "free" ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold" data-qa="pro-hooks">
              <span className="rounded-full border border-sage/20 bg-mist/65 px-2.5 py-1 text-ink/65">Free beta</span>
              <span className="rounded-full border border-sage/20 bg-white/80 px-2.5 py-1 text-ink/65">Full export is Pro</span>
              <span className="rounded-full border border-sage/20 bg-white/80 px-2.5 py-1 text-ink/65">Batch export coming for Pro</span>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold" data-qa="pro-hooks">
              <span className="rounded-full border border-sage/20 bg-sage/10 px-2.5 py-1 text-sage">Full-document export</span>
              <span className="rounded-full border border-sage/20 bg-white/80 px-2.5 py-1 text-ink/65">Batch ZIP export</span>
              <span className="rounded-full border border-sage/20 bg-white/80 px-2.5 py-1 text-ink/65">No free page limit</span>
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={!canExport || isExporting}
          onClick={onExport}
          data-qa="single-pdf-export-cta"
          className="w-fit shrink-0 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/35"
        >
          {isExporting ? "Preparing PDF..." : exportMessage ? "Download started" : ctaLabel}
        </button>
      </div>
      {optimizationReport.exportReadiness === "review-recommended" ? (
        <p className="mt-3 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          Review the flagged preview pages before exporting. Academic Paper may be safer for this PDF.
        </p>
      ) : null}
      {optimizationReport.exportReadiness === "not-recommended" ? (
        <p className="mt-3 rounded-md border border-clay/35 bg-clay/10 px-3 py-2 text-sm font-semibold text-ink">
          Export is not recommended because the preview has blocking quality issues.
        </p>
      ) : null}
      {exportMessage ? (
        <p className="mt-3 rounded-md border border-sage/25 bg-mist/60 px-3 py-2 text-sm font-semibold text-ink/72">
          {exportMessage}
        </p>
      ) : null}
      {exportError ? (
        <p className="mt-3 rounded-md border border-clay/35 bg-clay/10 px-3 py-2 text-sm font-semibold text-ink">
          {exportError}
        </p>
      ) : null}
    </section>
  );
}

function StatChip({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-sage/15 bg-mist/55 px-3 py-2 text-sm font-semibold text-ink/70">
      {label}
    </span>
  );
}

function getStatusText(
  isLoaded: boolean,
  isSafeAutoReady: boolean,
  readiness: UserOptimizationReport["exportReadiness"]
): string {
  if (!isLoaded) return "Generate preview before export";
  if (!isSafeAutoReady) return "Preview required";
  if (readiness === "ready") return "Ready";
  if (readiness === "good-with-warnings") return "Good with warnings";
  if (readiness === "review-recommended") return "Review suggested";
  return "Not recommended";
}

function getCtaLabel(readiness: UserOptimizationReport["exportReadiness"], limited: boolean): string {
  if (limited) return "Export preview PDF";
  if (readiness === "review-recommended") return "Export with warnings";
  if (readiness === "not-recommended") return "Unlock full export";
  return "Export PDF";
}

function getBadgeClass(readiness: UserOptimizationReport["exportReadiness"]): string {
  const base = "rounded-full border px-3 py-1 text-xs font-semibold";
  if (readiness === "ready") return `${base} border-sage/25 bg-sage/10 text-sage`;
  if (readiness === "good-with-warnings") return `${base} border-sage/20 bg-mist/80 text-sage`;
  if (readiness === "review-recommended") return `${base} border-amber-300/50 bg-amber-50 text-amber-700`;
  return `${base} border-clay/30 bg-clay/10 text-clay`;
}
