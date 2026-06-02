import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const exportSinglePdfMock = vi.fn();

vi.mock("@/lib/product/exportWorkflow", () => ({
  exportSinglePdf: exportSinglePdfMock
}));

describe("batch ZIP export", () => {
  beforeEach(() => {
    exportSinglePdfMock.mockReset();
  });

  it("blocks batch export in Free tier", async () => {
    const { exportBatchToZip } = await import("@/lib/product/batchExport");
    await expect(exportBatchToZip({
      files: [pdfFile("a.pdf")],
      preset: preset(),
      columnModeEnabled: true,
      planTier: "free"
    })).rejects.toThrow("Batch export is a Pro feature");
  });

  it("processes files sequentially and writes PDFs plus a human summary into ZIP", async () => {
    const { exportBatchToZip } = await import("@/lib/product/batchExport");
    const calls: string[] = [];
    exportSinglePdfMock.mockImplementation(async ({ file }) => {
      calls.push(file.name);
      return result(file.name);
    });

    const zipResult = await exportBatchToZip({
      files: [pdfFile("Paper A.pdf"), pdfFile("Paper A.pdf")],
      preset: preset(),
      columnModeEnabled: true,
      planTier: "pro"
    });
    const zip = await JSZip.loadAsync(zipResult.bytes);
    const names = Object.keys(zip.files);

    expect(calls).toEqual(["Paper A.pdf", "Paper A.pdf"]);
    expect(zipResult.summary.completed).toBe(2);
    expect(zipResult.summary.failed).toBe(0);
    expect(names).toContain("paper-a-academic-reading.pdf");
    expect(names).toContain("paper-a-academic-reading-2.pdf");
    expect(names).toContain("PaperRead-batch-summary.txt");
    expect(names).not.toContain("batch-summary.json");
    expect(names.some((name) => name.endsWith("-report.json"))).toBe(false);

    const summary = await zip.file("PaperRead-batch-summary.txt")?.async("string");
    expect(summary).toContain("PaperRead Batch Export");
    expect(summary).toContain("Preset: Academic Paper");
    expect(summary).toContain("Files processed: 2");
    expect(summary).toContain("Preserved safely");
    expect(summary).not.toContain("rawDecision");
    expect(summary).not.toContain("gutter");
  });

  it("includes technical JSON only when explicitly requested", async () => {
    const { exportBatchToZip } = await import("@/lib/product/batchExport");
    exportSinglePdfMock.mockResolvedValue(result("debug.pdf"));

    const zipResult = await exportBatchToZip({
      files: [pdfFile("debug.pdf")],
      preset: preset(),
      columnModeEnabled: true,
      planTier: "pro",
      includeTechnicalReports: true
    });
    const zip = await JSZip.loadAsync(zipResult.bytes);
    const names = Object.keys(zip.files);

    expect(names).toContain("batch-summary.json");
    expect(names).toContain("PaperRead-batch-summary.txt");
  });

  it("keeps successful files when one batch file fails", async () => {
    const { exportBatchToZip } = await import("@/lib/product/batchExport");
    exportSinglePdfMock
      .mockResolvedValueOnce(result("ok.pdf"))
      .mockRejectedValueOnce(new Error("This PDF could not be processed."));

    const zipResult = await exportBatchToZip({
      files: [pdfFile("ok.pdf"), pdfFile("bad.pdf")],
      preset: preset(),
      columnModeEnabled: true,
      planTier: "pro"
    });

    expect(zipResult.summary.completed).toBe(1);
    expect(zipResult.summary.failed).toBe(1);
    expect(zipResult.jobs[1].status).toBe("failed");
    expect(zipResult.jobs[1].error).toBe("This PDF could not be processed.");
  });
});

function pdfFile(name: string): File {
  return new File(["%PDF-1.7"], name, { type: "application/pdf" });
}

function preset() {
  return {
    id: "academic-paper",
    label: "Academic Paper",
    exportSuffix: "academic",
    supportsColumnMode: true
  } as never;
}

function result(name: string) {
  const base = name.replace(/\.pdf$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    bytes: new Uint8Array([1, 2, 3]),
    fileName: base + "-academic-reading.pdf",
    exportScope: "full-document",
    sourcePagesIncluded: 12,
    totalSourcePages: 12,
    outputReadingPages: 20,
    readingPagesIncluded: 20,
    totalReadingPagesEstimated: 20,
    freeSourcePageLimit: 5,
    freeReadingPageLimit: 12,
    exportLimitHitBy: "none",
    exportLimitMessage: "Full document export enabled.",
    exportLimitApplied: false,
    exportLimitReason: "Full document export enabled.",
    optimizedPages: 8,
    preservedPages: 4,
    warningCount: 1
  };
}
