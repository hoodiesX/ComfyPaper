import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { PageReadingTransform } from "@/types/pdf";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import { getReadingPreset } from "@/lib/presets/readingPresets";
import { analyzeSafeCrop } from "./cropDetection";
import { buildReadingTransform } from "./columnDetection";
import { EXPORT_PAGE_LIMIT } from "./exportCroppedPdf";
import { extractTextRowsFromContent } from "./textLineModel";

const ANALYSIS_SCALE = 0.32;

export async function analyzeReadingTransforms(
  document: PDFDocumentProxy,
  options: {
    readingPreset?: ReadingPresetConfig;
    columnModeEnabled: boolean;
    maxPages?: number;
    onProgress?: (progress: { pageNumber: number; totalPages: number }) => void;
  }
): Promise<PageReadingTransform[]> {
  const readingPreset = options.readingPreset ?? getReadingPreset("academic-paper");
  const pagesToAnalyze = Math.min(document.numPages, options.maxPages ?? EXPORT_PAGE_LIMIT);
  const transforms: PageReadingTransform[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToAnalyze; pageNumber += 1) {
    options.onProgress?.({ pageNumber, totalPages: pagesToAnalyze });
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
      await page.render({ canvasContext: context, viewport }).promise;

      const pixels = {
        data: context.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height
      };
      const marginAnalysis = analyzeSafeCrop(pixels, pageNumber, readingPreset);
      const textRows = await getPageTextRows(page);
      transforms.push(
        buildReadingTransform(pixels, pageNumber, marginAnalysis, options.columnModeEnabled, readingPreset, textRows)
      );
      if (process.env.NODE_ENV === "development") {
        const transform = transforms[transforms.length - 1];
        console.table([
          {
            page: transform.sourcePageNumber,
            preset: readingPreset.id,
            columnMode: options.columnModeEnabled,
            allowed: readingPreset.supportsColumnMode,
            decision: transform.debug?.decision ?? transform.mode,
            reason: transform.debug?.reason ?? transform.status,
            confidence: transform.mode === "column-reading" ? transform.confidence.toFixed(2) : "0.00",
            gutterWidth: transform.debug?.gutter?.width?.toFixed(3) ?? "",
            gutterInkDensity: transform.debug?.gutter?.inkDensity?.toFixed(3) ?? "",
            leftDensity: transform.debug?.measurements?.leftDensity?.toFixed(3) ?? "",
            rightDensity: transform.debug?.measurements?.rightDensity?.toFixed(3) ?? "",
            balanceRatio: transform.debug?.measurements?.balanceRatio?.toFixed(3) ?? "",
            minGutter: transform.debug?.measurements?.minGutterEmptyRatio ?? "",
            clearSegments: transform.debug?.gutter?.clearSegmentRatio?.toFixed(3) ?? "",
            minClearSegments: transform.debug?.measurements?.minGutterClearSegmentRatio ?? "",
            maxGutterInk: transform.debug?.measurements?.maxGutterInkRatio ?? "",
            minBalance: transform.debug?.measurements?.minColumnBalanceRatio ?? ""
          }
        ]);
        if (transform.debug) console.debug("[Column export detection details]", transform.debug);
      }
      page.cleanup();
    } catch (error) {
      console.error(`Failed to analyze reading transform for page ${pageNumber}.`, error);
      transforms.push({
        sourcePageNumber: pageNumber,
        mode: "preserved",
        status: "failed",
        crop: { left: 0, top: 0, right: 0, bottom: 0 },
        gainPercent: 0,
        reason: "Reading transform analysis failed."
      });
    }
  }

  return transforms;
}

async function getPageTextRows(page: PDFPageProxy) {
  try {
    const textContent = await page.getTextContent();
    return extractTextRowsFromContent(textContent, page.view);
  } catch {
    return [];
  }
}
