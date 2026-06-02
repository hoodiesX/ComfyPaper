import type { PageReadingTransform } from "@/types/pdf";
import { normalizedCropToPdfCropBox, shouldApplyCrop } from "./pdfCoordinateMapping";
import { EXPORT_PAGE_LIMIT } from "./exportCroppedPdf";
import type { ReadingOutputProfile } from "./readingProfiles";
import { getOutputProfileForPreset } from "./readingProfiles";
import { buildAcademicSourcePagePlan } from "./academicReadingPlan";
import { calculateProfileDrawPlacement } from "./readingTiles";

export type ExportColumnReadingPdfResult = {
  bytes: Uint8Array;
  exportedSourcePageCount: number;
  outputPageCount: number;
  totalPageCount: number;
  splitSourcePages: number;
  preservedSourcePages: number;
};

export async function exportColumnReadingPdf(
  file: File,
  transforms: PageReadingTransform[],
  outputProfile: ReadingOutputProfile = getOutputProfileForPreset("kindle-ereader"),
  options: { maxPages?: number; maxOutputPages?: number } = {}
): Promise<ExportColumnReadingPdfResult> {
  const bytes = await file.arrayBuffer();

  try {
    const { PDFDocument } = await import("pdf-lib");
    const sourceDocument = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false
    });
    const outputDocument = await PDFDocument.create();
    const totalPageCount = sourceDocument.getPageCount();
    const maxSourcePageCount = Math.min(totalPageCount, options.maxPages ?? EXPORT_PAGE_LIMIT);
    const maxOutputPages = options.maxOutputPages ?? Number.POSITIVE_INFINITY;
    const transformByPage = new Map(
      transforms.map((transform) => [transform.sourcePageNumber, transform])
    );
    let splitSourcePages = 0;
    let preservedSourcePages = 0;
    let exportedSourcePageCount = 0;

    for (let pageIndex = 0; pageIndex < maxSourcePageCount; pageIndex += 1) {
      if (outputDocument.getPageCount() >= maxOutputPages) {
        break;
      }
      const sourcePageNumber = pageIndex + 1;
      const transform = transformByPage.get(sourcePageNumber);
      exportedSourcePageCount = sourcePageNumber;

      if (transform?.mode === "column-reading") {
        splitSourcePages += 1;
        const sourcePage = sourceDocument.getPage(pageIndex);
        const { width: sourceWidth, height: sourceHeight } = sourcePage.getSize();
        const academicPlan = buildAcademicSourcePagePlan(transform, outputProfile);

        for (const output of academicPlan.outputPages) {
          if (outputDocument.getPageCount() >= maxOutputPages) {
            break;
          }
          const cropBox = normalizedCropToPdfCropBox(output.sourceCropFractions, sourceWidth, sourceHeight);
          const embeddedPage = await outputDocument.embedPage(sourcePage, {
            left: cropBox.x,
            bottom: cropBox.y,
            right: cropBox.x + cropBox.width,
            top: cropBox.y + cropBox.height
          });
          const outputPage = outputDocument.addPage([
            outputProfile.pageWidth,
            outputProfile.pageHeight
          ]);
          const placement = calculateProfileDrawPlacement(
            cropBox.width,
            cropBox.height,
            outputProfile
          );

          outputPage.drawPage(embeddedPage, {
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height
          });
        }

        continue;
      }

      const [copiedPage] = await outputDocument.copyPages(sourceDocument, [pageIndex]);

      if (
        transform?.mode === "margin-crop" &&
        shouldApplyCrop(transform.status, transform.gainPercent)
      ) {
        const { width, height } = copiedPage.getSize();
        const cropBox = normalizedCropToPdfCropBox(transform.crop, width, height);
        copiedPage.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
      } else {
        preservedSourcePages += 1;
      }

      outputDocument.addPage(copiedPage);
    }

    return {
      bytes: await outputDocument.save(),
      exportedSourcePageCount,
      outputPageCount: outputDocument.getPageCount(),
      totalPageCount,
      splitSourcePages,
      preservedSourcePages
    };
  } catch (error) {
    if (error instanceof Error && /encrypt|password|protected/i.test(error.message)) {
      throw new Error("This PDF appears to be protected and cannot be exported by this prototype.");
    }

    throw error;
  }
}
