import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BatchExportPanel } from "@/components/BatchExportPanel";
import type { BatchJob } from "@/lib/product/batchExport";

const noop = () => undefined;

describe("BatchExportPanel product UX", () => {
  it("explains the locked Free batch value without ambiguous queued controls", () => {
    const html = renderToStaticMarkup(
      <BatchExportPanel
        planTier="free"
        jobs={[]}
        selectedPresetLabel="Academic Paper"
        isProcessing={false}
        zipReady={false}
        onFilesSelected={noop}
        onStart={noop}
        onDownload={noop}
        onRemoveJob={noop}
      />
    );

    expect(html).toContain("Batch ZIP Export");
    expect(html).toContain("Built for literature reviews and reading lists");
    expect(html).toContain("Multiple PDFs");
    expect(html).toContain("Full-document export");
    expect(html).toContain("ZIP download");
    expect(html).toContain("Batch summary");
    expect(html).toContain("Join early access");
  });

  it("shows Start batch export when Pro jobs are queued", () => {
    const jobs: BatchJob[] = [
      {
        id: "paper-1",
        fileName: "paper.pdf",
        fileSize: 1200,
        status: "queued",
        progress: 0
      }
    ];

    const html = renderToStaticMarkup(
      <BatchExportPanel
        planTier="pro"
        jobs={jobs}
        selectedPresetLabel="Academic Paper"
        isProcessing={false}
        zipReady={false}
        onFilesSelected={noop}
        onStart={noop}
        onDownload={noop}
        onRemoveJob={noop}
      />
    );

    expect(html).toContain("Pro enabled");
    expect(html).toContain("paper.pdf");
    expect(html).toContain("queued");
    expect(html).toContain("Start batch export");
    expect(countOccurrences(html, "Choose PDFs")).toBe(0);
    expect(html).toContain("Pending");
  });

  it("shows Download ZIP only when Pro batch output is ready", () => {
    const jobs: BatchJob[] = [
      {
        id: "paper-1",
        fileName: "paper.pdf",
        status: "completed",
        progress: 100,
        outputFileName: "paper-academic-reading.pdf",
        report: {
          exportScope: "full-document",
          sourcePagesIncluded: 4,
          readingPagesIncluded: 6,
          totalSourcePages: 4,
          totalReadingPagesEstimated: 6,
          outputReadingPages: 6,
          optimizedPages: 5,
          preservedPages: 1,
          warningCount: 0
        }
      }
    ];

    const html = renderToStaticMarkup(
      <BatchExportPanel
        planTier="pro"
        jobs={jobs}
        summary={{
          totalFiles: 1,
          completed: 1,
          failed: 0,
          optimizedPages: 5,
          preservedPages: 1,
          reviewPages: 0,
          zipGenerated: true
        }}
        selectedPresetLabel="Academic Paper"
        isProcessing={false}
        zipReady
        onFilesSelected={noop}
        onStart={noop}
        onDownload={noop}
        onRemoveJob={noop}
      />
    );

    expect(html).toContain("Download ZIP");
    expect(html).toContain("ZIP ready");
    expect(html).toContain("1 completed");
    expect(html).toContain("View summary");
    expect(html).toContain("5 optimized");
    expect(countOccurrences(html, "Choose PDFs")).toBe(0);
  });

  it("shows exactly one Choose PDFs action in empty Pro state", () => {
    const html = renderToStaticMarkup(
      <BatchExportPanel
        planTier="pro"
        jobs={[]}
        selectedPresetLabel="Academic Paper"
        isProcessing={false}
        zipReady={false}
        onFilesSelected={noop}
        onStart={noop}
        onDownload={noop}
        onRemoveJob={noop}
      />
    );

    expect(countOccurrences(html, "Choose PDFs")).toBe(1);
    expect(html).not.toContain("Start batch export");
  });
});

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
