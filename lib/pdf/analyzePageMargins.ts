import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PageCropAnalysis } from "@/types/pdf";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import { getReadingPreset } from "@/lib/presets/readingPresets";
import { analyzeSafeCrop } from "./cropDetection";
import { EXPORT_PAGE_LIMIT } from "./exportCroppedPdf";

const ANALYSIS_SCALE = 0.32;

export async function analyzeSafeCropPages(
  document: PDFDocumentProxy,
  maxPages = EXPORT_PAGE_LIMIT,
  readingPreset: ReadingPresetConfig = getReadingPreset("academic-paper"),
  onProgress?: (progress: { pageNumber: number; totalPages: number }) => void
): Promise<PageCropAnalysis[]> {
  const pagesToAnalyze = Math.min(document.numPages, maxPages);
  const analyses: PageCropAnalysis[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToAnalyze; pageNumber += 1) {
    onProgress?.({ pageNumber, totalPages: pagesToAnalyze });
    try {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: ANALYSIS_SCALE });
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        throw new Error("Canvas analysis is not available in this browser.");
      }

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({
        canvasContext: context,
        viewport
      }).promise;

      analyses.push(
        analyzeSafeCrop(
          {
            data: context.getImageData(0, 0, canvas.width, canvas.height).data,
            width: canvas.width,
            height: canvas.height
          },
          pageNumber,
          readingPreset
        )
      );

      page.cleanup();
    } catch (error) {
      console.error(`Failed to analyze safe crop for export page ${pageNumber}.`, error);
      analyses.push({
        pageNumber,
        status: "failed",
        cropRect: { x: 0, y: 0, width: 1, height: 1 },
        normalizedCrop: { left: 0, top: 0, right: 0, bottom: 0 },
        gainPercent: 0,
        reason: "Safe crop analysis failed."
      });
    }
  }

  return analyses;
}
