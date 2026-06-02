import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type {
  CropMode,
  CropRect,
  ManualCropPreset,
  NormalizedCropRect,
  PdfRenderResult,
  RenderedPage
} from "@/types/pdf";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import { getReadingPreset } from "@/lib/presets/readingPresets";
import { analyzeSafeCrop, getNormalizedCropRect } from "./cropDetection";
import { calculateCropRect, clampCropPercentage } from "./cropPreview";

const MAX_PREVIEW_PAGES = 3;
const PREVIEW_SCALE = 0.9;
const MAX_DEVICE_PIXEL_RATIO = 2;
const ANALYSIS_SCALE = 0.32;

type RenderCroppedPagesOptions = {
  cropMode: CropMode;
  manualPercentage: number;
  manualPreset: ManualCropPreset;
  readingPreset?: ReadingPresetConfig;
};

export async function renderCroppedPages(
  document: PDFDocumentProxy,
  options: RenderCroppedPagesOptions
): Promise<PdfRenderResult> {
  const pagesToRender = Math.min(document.numPages, MAX_PREVIEW_PAGES);
  const pages: RenderedPage[] = [];
  const failedPageNumbers: number[] = [];
  const safeCropPercentage = clampCropPercentage(options.manualPercentage);
  const readingPreset = options.readingPreset ?? getReadingPreset("academic-paper");
  const pixelRatio = getSafePixelRatio();
  const renderScale = PREVIEW_SCALE * pixelRatio;

  for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
    try {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: renderScale });
      const sourceCanvas = window.document.createElement("canvas");
      const sourceContext = sourceCanvas.getContext("2d");

      if (!sourceContext) {
        throw new Error("Canvas rendering is not available in this browser.");
      }

      sourceCanvas.width = Math.floor(viewport.width);
      sourceCanvas.height = Math.floor(viewport.height);

      await page.render({
        canvasContext: sourceContext,
        viewport
      }).promise;

      const cropResult =
        options.cropMode === "safe-auto"
          ? await getSafeAutoCropRect(
              page,
              pageNumber,
              sourceCanvas.width,
              sourceCanvas.height,
              readingPreset
            )
          : getManualCropResult(
              sourceCanvas.width,
              sourceCanvas.height,
              safeCropPercentage,
              options.manualPreset
            );
      const outputCanvas = window.document.createElement("canvas");
      const outputContext = outputCanvas.getContext("2d");

      if (!outputContext) {
        throw new Error("Canvas rendering is not available in this browser.");
      }

      outputCanvas.width = sourceCanvas.width;
      outputCanvas.height = sourceCanvas.height;
      outputContext.imageSmoothingEnabled = true;
      outputContext.imageSmoothingQuality = "high";
      outputContext.drawImage(
        sourceCanvas,
        cropResult.cropRect.x,
        cropResult.cropRect.y,
        cropResult.cropRect.width,
        cropResult.cropRect.height,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height
      );

      pages.push({
        pageNumber,
        width: Math.round(outputCanvas.width / pixelRatio),
        height: Math.round(outputCanvas.height / pixelRatio),
        dataUrl: outputCanvas.toDataURL("image/png"),
        cropStatus: cropResult.status,
        cropGainPercent: cropResult.gainPercent,
        cropReason: cropResult.reason,
        normalizedCrop: cropResult.normalizedCrop
      });

      page.cleanup();
    } catch (error) {
      console.error(`Failed to render cropped preview for page ${pageNumber}.`, error);
      failedPageNumbers.push(pageNumber);
    }
  }

  return {
    pages,
    failedPageNumbers
  };
}

function getManualCropResult(
  width: number,
  height: number,
  cropPercentage: number,
  manualPreset: ManualCropPreset
): {
  cropRect: CropRect;
  status: "manual-crop";
  gainPercent: number;
  normalizedCrop: NormalizedCropRect;
  reason: string;
} {
  const cropRect = calculateCropRect(width, height, cropPercentage);

  return {
    cropRect,
    status: "manual-crop",
    gainPercent: Math.round(
      (1 /
        ((1 - cropPercentage / 100 * 2) *
          (1 - cropPercentage / 100 * 2)) -
        1) *
        100
    ),
    normalizedCrop: getNormalizedCropRect(cropRect, width, height),
    reason: `Manual ${manualPreset} crop.`
  };
}

async function getSafeAutoCropRect(
  page: PDFPageProxy,
  pageNumber: number,
  renderWidth: number,
  renderHeight: number,
  readingPreset: ReadingPresetConfig
): Promise<{
  cropRect: CropRect;
  status: "auto-cropped" | "minimal-crop" | "no-safe-crop";
  gainPercent: number;
  normalizedCrop: NormalizedCropRect;
  reason?: string;
}> {
  const analysisViewport = page.getViewport({ scale: ANALYSIS_SCALE });
  const analysisCanvas = window.document.createElement("canvas");
  const analysisContext = analysisCanvas.getContext("2d", { willReadFrequently: true });

  if (!analysisContext) {
    throw new Error("Canvas analysis is not available in this browser.");
  }

  analysisCanvas.width = Math.floor(analysisViewport.width);
  analysisCanvas.height = Math.floor(analysisViewport.height);

  await page.render({
    canvasContext: analysisContext,
    viewport: analysisViewport
  }).promise;

  const analysis = analyzeSafeCrop(
    {
      data: analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height).data,
      width: analysisCanvas.width,
      height: analysisCanvas.height
    },
    pageNumber,
    readingPreset
  );
  const scaleX = renderWidth / analysisCanvas.width;
  const scaleY = renderHeight / analysisCanvas.height;

  return {
    cropRect: {
      x: analysis.cropRect.x * scaleX,
      y: analysis.cropRect.y * scaleY,
      width: analysis.cropRect.width * scaleX,
      height: analysis.cropRect.height * scaleY
    },
    status: analysis.status === "failed" || analysis.status === "manual-crop" ? "no-safe-crop" : analysis.status,
    gainPercent: analysis.gainPercent,
    normalizedCrop: analysis.normalizedCrop,
    reason: analysis.reason
  };
}

function getSafePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
}
