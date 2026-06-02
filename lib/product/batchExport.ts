import JSZip from "jszip";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import type { PlanTier } from "./productLimits";
import { getProductPlan } from "./productLimits";
import { exportSinglePdf, type ExportProgressState, type SinglePdfExportResult } from "./exportWorkflow";

export type BatchJobStatus = "queued" | "ready" | "processing" | "completed" | "failed" | "skipped";
export type BatchState = "empty" | "files-selected" | "processing" | "completed" | "failed";

export type BatchJob = {
  id: string;
  fileName: string;
  fileSize?: number;
  status: BatchJobStatus;
  progress: number;
  outputFileName?: string;
  report?: Pick<SinglePdfExportResult, "exportScope" | "sourcePagesIncluded" | "readingPagesIncluded" | "totalSourcePages" | "totalReadingPagesEstimated" | "outputReadingPages" | "optimizedPages" | "preservedPages" | "warningCount">;
  error?: string;
};

export type BatchSummary = {
  totalFiles: number;
  completed: number;
  failed: number;
  optimizedPages: number;
  preservedPages: number;
  reviewPages: number;
  zipGenerated: boolean;
  zipSize?: number;
};

export type BatchZipResult = {
  bytes: Uint8Array;
  fileName: string;
  jobs: BatchJob[];
  summary: BatchSummary;
};

export async function exportBatchToZip({
  files,
  preset,
  columnModeEnabled,
  planTier = getProductPlan().currentPlanTier,
  includeTechnicalReports = false,
  onJobUpdate,
  onProgress
}: {
  files: File[];
  preset: ReadingPresetConfig;
  columnModeEnabled: boolean;
  planTier?: PlanTier;
  includeTechnicalReports?: boolean;
  onJobUpdate?: (jobs: BatchJob[]) => void;
  onProgress?: (progress: ExportProgressState) => void;
}): Promise<BatchZipResult> {
  const plan = { ...getProductPlan(), currentPlanTier: planTier };
  if (plan.currentPlanTier !== "pro") {
    throw new Error("Batch export is a Pro feature. Free beta supports one PDF at a time.");
  }
  if (files.length > plan.maxProFilesPerBatch) {
    throw new Error(`Batch export supports up to ${plan.maxProFilesPerBatch} PDFs at a time.`);
  }

  const jobs: BatchJob[] = files.map((file, index) => ({
    id: `${Date.now()}-${index}`,
    fileName: file.name,
    fileSize: file.size,
    status: "queued",
    progress: 0
  }));
  const zip = new JSZip();
  const usedNames = new Set<string>();
  const completedResults: SinglePdfExportResult[] = [];
  onJobUpdate?.([...jobs]);

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    jobs[index] = { ...jobs[index], status: "processing", progress: 1 };
    onJobUpdate?.([...jobs]);

    try {
      const result = await exportSinglePdf({
        file,
        preset,
        columnModeEnabled,
        planTier,
        onProgress: (progress) => {
          jobs[index] = {
            ...jobs[index],
            progress: progress.totalPages ? Math.round(((progress.currentPage ?? 0) / progress.totalPages) * 85) : 5
          };
          onJobUpdate?.([...jobs]);
          onProgress?.({
            ...progress,
            currentFile: index + 1,
            totalFiles: files.length
          });
        }
      });
      const outputFileName = getUniqueName(result.fileName, usedNames);
      zip.file(outputFileName, result.bytes);
      completedResults.push(result);
      jobs[index] = {
        ...jobs[index],
        status: "completed",
        progress: 100,
        outputFileName,
        report: toReport(result)
      };
    } catch (error) {
      jobs[index] = {
        ...jobs[index],
        status: "failed",
        progress: 100,
        error: getFriendlyBatchError(error)
      };
    }
    onJobUpdate?.([...jobs]);
  }

  const summary = buildBatchSummary(jobs, completedResults, true);
  if (includeTechnicalReports || process.env.NEXT_PUBLIC_ENABLE_DIAGNOSTICS === "true") {
    zip.file("batch-summary.json", JSON.stringify({
      preset: preset.label,
      planTier,
      localFirstNote: "Files were processed locally in the browser.",
      jobs,
      summary
    }, null, 2));
  }
  zip.file("PaperRead-batch-summary.txt", buildHumanSummary(preset.label, summary, jobs));

  onProgress?.({
    stage: "zipping",
    currentFile: files.length,
    totalFiles: files.length,
    optimizedPages: summary.optimizedPages,
    preservedPages: summary.preservedPages,
    warningCount: summary.reviewPages,
    message: "Creating ZIP package."
  });

  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const finalSummary = { ...summary, zipGenerated: true, zipSize: bytes.byteLength };

  return {
    bytes,
    fileName: `reading-optimizer-${preset.exportSuffix || "batch"}-batch.zip`,
    jobs,
    summary: finalSummary
  };
}

function toReport(result: SinglePdfExportResult): BatchJob["report"] {
  return {
    exportScope: result.exportScope,
    sourcePagesIncluded: result.sourcePagesIncluded,
    readingPagesIncluded: result.readingPagesIncluded,
    totalSourcePages: result.totalSourcePages,
    totalReadingPagesEstimated: result.totalReadingPagesEstimated,
    outputReadingPages: result.outputReadingPages,
    optimizedPages: result.optimizedPages,
    preservedPages: result.preservedPages,
    warningCount: result.warningCount
  };
}

function buildBatchSummary(jobs: BatchJob[], results: SinglePdfExportResult[], zipGenerated: boolean): BatchSummary {
  return {
    totalFiles: jobs.length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    optimizedPages: results.reduce((sum, result) => sum + result.optimizedPages, 0),
    preservedPages: results.reduce((sum, result) => sum + result.preservedPages, 0),
    reviewPages: results.reduce((sum, result) => sum + result.warningCount, 0),
    zipGenerated
  };
}

function buildHumanSummary(presetLabel: string, summary: BatchSummary, jobs: BatchJob[]): string {
  const now = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return [
    "PaperRead Batch Export",
    `Created: ${now}`,
    `Preset: ${presetLabel}`,
    `Files processed: ${summary.totalFiles}`,
    `Successful: ${summary.completed}`,
    `Failed: ${summary.failed}`,
    "",
    "Files",
    ...jobs.map((job, index) => formatHumanJobSummary(job, index)),
    "",
    "Notes:",
    "Files were processed locally in your browser.",
    "Complex title, figure or table pages may be preserved safely.",
    "Review suggested pages are kept visible so you can check them before reading.",
    ""
  ].join("\n");
}

function formatHumanJobSummary(job: BatchJob, index: number): string {
  const report = job.report;
  return [
    "",
    `${index + 1}. ${job.fileName}`,
    `   Output: ${job.outputFileName ?? "Not exported"}`,
    `   Status: ${job.status === "completed" ? "Completed" : job.status === "failed" ? "Failed" : "Pending"}`,
    `   Optimized: ${report?.optimizedPages ?? 0} pages`,
    `   Preserved safely: ${report?.preservedPages ?? 0} pages`,
    `   Review: ${report?.warningCount ?? 0} pages`,
    job.error ? `   Notes: ${job.error}` : "   Notes: Title/figure pages may be preserved safely."
  ].join("\n");
}

function getUniqueName(fileName: string, usedNames: Set<string>): string {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }
  const extension = fileName.match(/\.[^.]+$/)?.[0] ?? "";
  const base = extension ? fileName.slice(0, -extension.length) : fileName;
  let index = 2;
  while (usedNames.has(`${base}-${index}${extension}`)) {
    index += 1;
  }
  const unique = `${base}-${index}${extension}`;
  usedNames.add(unique);
  return unique;
}

function getFriendlyBatchError(error: unknown): string {
  if (error instanceof Error && /protected|encrypt|password/i.test(error.message)) {
    return "This PDF could not be processed because it appears to be protected.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "This PDF could not be processed.";
}
