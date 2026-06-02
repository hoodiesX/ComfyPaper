import type { ReadingSummary } from "@/lib/metrics/pageSummary";
import type { ExportSummary } from "@/lib/metrics/pageSummary";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";

type ReadingMetricsSummaryProps = {
  summary: ReadingSummary;
  preset: ReadingPresetConfig;
  columnModeEnabled?: boolean;
  exportSummary?: ExportSummary;
};

export function ReadingMetricsSummary({
  summary,
  preset,
  columnModeEnabled = false,
  exportSummary
}: ReadingMetricsSummaryProps) {
  return (
    <section className="rounded-lg border border-sage/25 bg-white/75 p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">
        Estimated improvement
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Metric label="Preset" value={preset.label} />
        <Metric label={columnModeEnabled ? "Source pages split" : "Pages cropped"} value={`${summary.croppedPages}`} />
        <Metric label="Preserved" value={`${summary.preservedPages}`} />
        <Metric
          label={columnModeEnabled ? "Reading pages est." : "Avg. gain"}
          value={columnModeEnabled ? `${exportSummary?.estimatedOutputPages ?? summary.analyzedPages}` : `+${summary.averageGainPercent}%`}
        />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-mist/65 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink/45">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
