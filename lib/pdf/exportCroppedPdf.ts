import type { PageCropAnalysis } from "@/types/pdf";
import { normalizedCropToPdfCropBox, shouldApplyCrop } from "./pdfCoordinateMapping";

export const EXPORT_PAGE_LIMIT = 10;

export type ExportCroppedPdfResult = {
  bytes: Uint8Array;
  exportedPageCount: number;
  totalPageCount: number;
};

export async function exportCroppedPdf(
  file: File,
  analyses: PageCropAnalysis[],
  options: { maxPages?: number } = {}
): Promise<ExportCroppedPdfResult> {
  // Read a fresh ArrayBuffer for pdf-lib. The PDF.js worker may detach buffers it receives,
  // so export never reuses bytes that were passed to PDF.js for preview rendering.
  const bytes = await file.arrayBuffer();

  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdfDocument = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false
    });
    const totalPageCount = pdfDocument.getPageCount();
    const exportedPageCount = Math.min(totalPageCount, options.maxPages ?? EXPORT_PAGE_LIMIT);

    for (let index = totalPageCount - 1; index >= exportedPageCount; index -= 1) {
      pdfDocument.removePage(index);
    }

    const analysisByPage = new Map(analyses.map((analysis) => [analysis.pageNumber, analysis]));

    for (let pageIndex = 0; pageIndex < exportedPageCount; pageIndex += 1) {
      const page = pdfDocument.getPage(pageIndex);
      const analysis = analysisByPage.get(pageIndex + 1);

      if (!analysis || !shouldApplyCrop(analysis.status, analysis.gainPercent)) {
        continue;
      }

      const { width, height } = page.getSize();
      const cropBox = normalizedCropToPdfCropBox(analysis.normalizedCrop, width, height);
      page.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
    }

    return {
      bytes: await pdfDocument.save(),
      exportedPageCount,
      totalPageCount
    };
  } catch (error) {
    if (error instanceof Error && /encrypt|password|protected/i.test(error.message)) {
      throw new Error("This PDF appears to be protected and cannot be exported by this prototype.");
    }

    throw error;
  }
}
