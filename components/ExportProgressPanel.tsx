"use client";

import type { ExportProgressState } from "@/lib/product/exportWorkflow";

export function ExportProgressPanel({ progress }: { progress: ExportProgressState }) {
  if (progress.stage === "idle") return null;

  const percent = progress.totalPages
    ? Math.min(100, Math.round(((progress.currentPage ?? 0) / progress.totalPages) * 100))
    : progress.stage === "completed"
      ? 100
      : 12;
  const elapsed = progress.startedAt ? Math.max(0, Math.round((Date.now() - progress.startedAt) / 1000)) : 0;

  return (
    <section className="rounded-lg border border-sage/20 bg-white/80 p-4 shadow-soft" data-qa="export-progress">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-sage">Export progress</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{getStageLabel(progress.stage)}</h3>
          <p className="mt-1 text-sm leading-6 text-ink/62">
            {progress.message ?? "Preparing export."}
          </p>
          {progress.fileName ? (
            <p className="text-sm leading-6 text-ink/55">{progress.fileName}</p>
          ) : null}
        </div>
        <div className="grid gap-1 text-sm text-ink/62 md:text-right">
          {progress.totalFiles ? <span>File {progress.currentFile ?? 1} / {progress.totalFiles}</span> : null}
          {progress.totalPages ? <span>Page {progress.currentPage ?? 0} / {progress.totalPages}</span> : null}
          {elapsed > 0 ? <span>{elapsed}s elapsed</span> : null}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist">
        <div className="h-full bg-sage transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink/62">
        <span className="rounded-full border border-sage/15 bg-mist/55 px-2.5 py-1">{progress.optimizedPages} optimized</span>
        <span className="rounded-full border border-sage/15 bg-mist/55 px-2.5 py-1">{progress.preservedPages} preserved</span>
        <span className="rounded-full border border-sage/15 bg-mist/55 px-2.5 py-1">{progress.warningCount} warnings</span>
      </div>
    </section>
  );
}

function getStageLabel(stage: ExportProgressState["stage"]): string {
  if (stage === "preparing") return "Preparing";
  if (stage === "analyzing") return "Analyzing pages";
  if (stage === "exporting") return "Exporting PDF";
  if (stage === "zipping") return "Creating ZIP";
  if (stage === "completed") return "Completed";
  if (stage === "failed") return "Failed";
  if (stage === "cancelled") return "Cancelled";
  return "Idle";
}
