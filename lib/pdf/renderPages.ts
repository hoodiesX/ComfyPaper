import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfRenderResult, RenderedPage } from "@/types/pdf";

const MAX_PREVIEW_PAGES = 3;
const PREVIEW_SCALE = 1.15;
const MAX_DEVICE_PIXEL_RATIO = 2;

export async function renderPdfPages(document: PDFDocumentProxy): Promise<PdfRenderResult> {
  const pagesToRender = Math.min(document.numPages, MAX_PREVIEW_PAGES);
  const pages: RenderedPage[] = [];
  const failedPageNumbers: number[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
    try {
      const page = await document.getPage(pageNumber);
      const pixelRatio = getSafePixelRatio();
      const viewport = page.getViewport({ scale: PREVIEW_SCALE * pixelRatio });
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas rendering is not available in this browser.");
      }

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({
        canvasContext: context,
        viewport
      }).promise;

      pages.push({
        pageNumber,
        width: Math.round(canvas.width / pixelRatio),
        height: Math.round(canvas.height / pixelRatio),
        dataUrl: canvas.toDataURL("image/png")
      });

      page.cleanup();
    } catch {
      failedPageNumbers.push(pageNumber);
    }
  }

  return {
    pages,
    failedPageNumbers
  };
}

function getSafePixelRatio() {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
}
