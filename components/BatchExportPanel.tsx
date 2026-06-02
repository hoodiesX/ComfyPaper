"use client";

import React from "react";
import { useRef, useState } from "react";
import type { BatchJob, BatchState, BatchSummary } from "@/lib/product/batchExport";
import type { PlanTier } from "@/lib/product/productLimits";
import { formatFileSize } from "@/lib/formatting";

type BatchExportPanelProps = {
  planTier: PlanTier;
  jobs: BatchJob[];
  summary?: BatchSummary | null;
  selectedPresetLabel: string;
  isProcessing: boolean;
  zipReady: boolean;
  error?: string | null;
  onFilesSelected: (files: File[]) => void;
  onStart: () => void;
  onDownload: () => void;
  onRemoveJob: (jobId: string) => void;
};

export function BatchExportPanel({
  planTier,
  jobs,
  summary,
  selectedPresetLabel,
  isProcessing,
  zipReady,
  error,
  onFilesSelected,
  onStart,
  onDownload,
  onRemoveJob
}: BatchExportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const isPro = planTier === "pro";
  const state = getBatchState(jobs, isProcessing, zipReady);
  const primaryAction = getPrimaryActionLabel(state, isPro);
  const hasJobs = jobs.length > 0;

  if (!isPro) {
    return (
      <section className="rounded-lg border border-sage/20 bg-white/70 p-4 shadow-soft" data-qa="batch-export-panel" data-batch-state="locked">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-sage">Batch ZIP Export</p>
              <span className="rounded-full border border-sage/20 bg-mist/65 px-2.5 py-1 text-xs font-semibold text-ink/65">Pro</span>
            </div>
            <h2 className="mt-1 text-xl font-semibold text-ink">Convert multiple papers into one ZIP</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/62">
              Convert multiple papers with the same reading preset and download one ZIP. Built for literature reviews and reading lists.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink/65">
              {["Multiple PDFs", "Full-document export", "ZIP download", "Batch summary"].map((feature) => (
                <span key={feature} className="rounded-full border border-sage/15 bg-mist/55 px-2.5 py-1">
                  {feature}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="w-fit rounded-md border border-sage/25 bg-white px-3 py-2 text-sm font-semibold text-ink"
            data-qa="batch-primary-action"
          >
            Join early access
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-sage/20 bg-white/70 p-4 shadow-soft" data-qa="batch-export-panel" data-batch-state={state}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-sage">Batch ZIP Export</p>
            <span className="rounded-full border border-sage/20 bg-sage/10 px-2.5 py-1 text-xs font-semibold text-sage">Pro enabled</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-ink">Process multiple papers with one preset</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/62">
            {state === "empty"
              ? "Upload multiple PDFs, apply the selected preset, download one ZIP."
              : `${selectedPresetLabel} will be used for every file. Jobs process sequentially to protect browser memory.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={isProcessing}
            onChange={(event) => onFilesSelected(Array.from(event.target.files ?? []))}
          />
          {state !== "empty" ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-sage/25 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-sage disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add more PDFs
            </button>
          ) : null}
          <button
            type="button"
            disabled={primaryAction.disabled}
            onClick={state === "empty" ? () => inputRef.current?.click() : state === "completed" && zipReady ? onDownload : onStart}
            data-qa="batch-primary-action"
            className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/35"
          >
            {primaryAction.label}
          </button>
        </div>
      </div>

      {state === "files-selected" ? (
        <p className="mt-3 rounded-md border border-sage/15 bg-mist/45 px-3 py-2 text-sm font-semibold text-ink/70">
          {jobs.length} file{jobs.length === 1 ? "" : "s"} queued. Review the list, then start batch export.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-semibold text-ink">
          {error}
        </p>
      ) : null}

      {hasJobs ? (
        <div className="mt-4 overflow-hidden rounded-md border border-sage/15" data-qa="batch-file-dashboard">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-mist/45 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink/50 md:grid-cols-[1.3fr_110px_120px_120px_110px]">
            <span>File</span>
            <span>Status</span>
            <span className="hidden md:block">Preset</span>
            <span className="hidden md:block">Pages</span>
            <span>Action</span>
          </div>
          {jobs.map((job) => (
            <div key={job.id} className="border-t border-sage/10" data-qa="batch-file-row">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 md:grid-cols-[1.3fr_110px_120px_120px_110px]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{job.fileName}</p>
                  {job.fileSize ? <p className="text-xs text-ink/45">{formatFileSize(job.fileSize)}</p> : null}
                  {job.error ? <p className="mt-1 text-sm text-clay">{job.error}</p> : null}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist md:hidden">
                    <div className="h-full bg-sage transition-all" style={{ width: `${job.progress}%` }} />
                  </div>
                </div>
                <span className={getStatusClass(job.status)}>
                  {formatStatus(job.status)}
                </span>
                <span className="hidden text-sm text-ink/55 md:block">{selectedPresetLabel}</span>
                <span className="hidden text-sm text-ink/55 md:block">
                  {formatPageCounts(job)}
                </span>
                {job.status === "completed" || job.status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(job.id)}
                    className="text-sm font-semibold text-ink/65 transition hover:text-ink"
                    data-qa="batch-summary-toggle"
                  >
                    {expandedJobIds.has(job.id) ? "Hide summary" : "View summary"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isProcessing || job.status === "processing"}
                    onClick={() => onRemoveJob(job.id)}
                    className="text-sm font-semibold text-ink/55 transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remove
                  </button>
                )}
              </div>
              {expandedJobIds.has(job.id) ? (
                <BatchFileSummary job={job} selectedPresetLabel={selectedPresetLabel} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {summary ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-ink/65">
          <span className="rounded-full border border-sage/15 bg-white/80 px-2.5 py-1">{summary.completed} completed</span>
          <span className="rounded-full border border-sage/15 bg-white/80 px-2.5 py-1">{summary.failed} failed</span>
          <span className="rounded-full border border-sage/15 bg-white/80 px-2.5 py-1">{summary.optimizedPages} optimized pages</span>
          <span className="rounded-full border border-sage/15 bg-white/80 px-2.5 py-1">{summary.preservedPages} preserved pages</span>
          {zipReady ? <span className="rounded-full border border-sage/20 bg-sage/10 px-2.5 py-1 text-sage">ZIP ready</span> : null}
        </div>
      ) : null}
    </section>
  );

  function toggleExpanded(jobId: string) {
    setExpandedJobIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }
}

function getBatchState(jobs: BatchJob[], isProcessing: boolean, zipReady: boolean): BatchState {
  if (isProcessing) return "processing";
  if (zipReady) return "completed";
  if (jobs.some((job) => job.status === "failed")) return "failed";
  if (jobs.length > 0) return "files-selected";
  return "empty";
}

function getPrimaryActionLabel(state: BatchState, isPro: boolean): { label: string; disabled: boolean } {
  if (!isPro) return { label: "Unlock Pro", disabled: false };
  if (state === "empty") return { label: "Choose PDFs", disabled: false };
  if (state === "files-selected" || state === "failed") return { label: "Start batch export", disabled: false };
  if (state === "processing") return { label: "Processing...", disabled: true };
  return { label: "Download ZIP", disabled: false };
}

function BatchFileSummary({ job, selectedPresetLabel }: { job: BatchJob; selectedPresetLabel: string }) {
  const report = job.report;
  return (
    <div className="border-t border-sage/10 bg-mist/25 px-3 py-3" data-qa="batch-file-summary">
      <div className="grid gap-2 text-sm text-ink/65 md:grid-cols-5">
        <SummaryChip label="Readiness" value={job.status === "completed" ? "Ready" : "Needs retry"} />
        <SummaryChip label="Preset" value={selectedPresetLabel} />
        <SummaryChip label="Optimized" value={`${report?.optimizedPages ?? 0} pages`} />
        <SummaryChip label="Preserved safely" value={`${report?.preservedPages ?? 0} pages`} />
        <SummaryChip label="Review" value={`${report?.warningCount ?? 0} pages`} />
      </div>
      <p className="mt-2 text-sm leading-6 text-ink/58">
        {job.status === "completed"
          ? `Export scope: ${report?.exportScope === "full-document" ? "Full document" : "Preview export"}. Title/figure pages may be preserved safely.`
          : job.error ?? "This file could not be processed. Other completed files remain available."}
      </p>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-sage/15 bg-white/75 px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/42">{label}</span>
      <span className="font-semibold text-ink/72">{value}</span>
    </span>
  );
}

function formatPageCounts(job: BatchJob): string {
  if (!job.report) return "Pending";
  return `${job.report.optimizedPages} optimized · ${job.report.preservedPages} preserved · ${job.report.warningCount} review`;
}

function formatStatus(status: BatchJob["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "processing") return "Processing";
  if (status === "ready") return "Ready";
  if (status === "skipped") return "Skipped";
  return "Queued";
}

function getStatusClass(status: BatchJob["status"]): string {
  const base = "rounded-full border px-2.5 py-1 text-xs font-semibold";
  if (status === "completed") return `${base} border-sage/20 bg-sage/10 text-sage`;
  if (status === "failed") return `${base} border-clay/30 bg-clay/10 text-clay`;
  if (status === "processing") return `${base} border-sage/20 bg-mist/70 text-sage`;
  return `${base} border-sage/15 bg-white/80 text-ink/60`;
}
