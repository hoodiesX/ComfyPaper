import type { ReadingSummary } from "@/lib/metrics/pageSummary";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import type { RenderedPage } from "@/types/pdf";

type PageSafetyReportProps = {
  pages: RenderedPage[];
  summary: ReadingSummary;
  preset: ReadingPresetConfig;
};

export function PageSafetyReport({ pages, summary, preset }: PageSafetyReportProps) {
  if (pages.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-sage/25 bg-white/75 p-4 shadow-soft">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Reading optimization summary</h2>
          <p className="mt-1 text-sm text-ink/60">
            {preset.label} preset · {summary.analyzedPages} previewed page{summary.analyzedPages === 1 ? "" : "s"}
          </p>
        </div>
        <p className="text-sm font-semibold text-sage">
          Approx. +{summary.averageGainPercent}% average reading area gain
        </p>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {pages.map((page) => (
          <div key={page.previewId ?? getPageKey(page)} className="rounded-md border border-sage/15 bg-mist/50 px-3 py-2 text-sm text-ink/70">
            {page.column ? `Page ${page.sourcePageNumber} ${page.column}` : `Page ${page.sourcePageNumber ?? page.pageNumber}`} - {getStatusLabel(page)}{page.cropGainPercent ? ` · +${page.cropGainPercent}%` : ""}
          </div>
        ))}
      </div>
    </section>
  );
}

function getPageKey(page: RenderedPage): string {
  return `${page.sourcePageNumber ?? page.pageNumber}-${page.column ?? "full"}-${page.tileIndex ?? 0}-${page.pageNumber}`;
}

function getStatusLabel(page: RenderedPage): string {
  if (page.columnStatus === "split") return "Split";
  if (page.columnStatus === "full-width-content") return "Preserved";
  if (page.columnStatus === "uncertain" || page.columnStatus === "low-confidence") return "Uncertain";
  if (page.cropStatus === "auto-cropped") return "Cropped";
  if (page.cropStatus === "minimal-crop") return "Minimal crop";
  if (page.cropStatus === "failed") return "Failed";
  return "Preserved";
}
