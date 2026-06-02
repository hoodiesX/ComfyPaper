import type { PageReadingTransform } from "@/types/pdf";

export type ReadingTransformSummary = {
  sourcePagesAnalyzed: number;
  pagesSplit: number;
  pagesPreserved: number;
  marginCropPages: number;
  estimatedOutputPages: number;
};

export function summarizeReadingTransforms(
  transforms: PageReadingTransform[]
): ReadingTransformSummary {
  const pagesSplit = transforms.filter((transform) => transform.mode === "column-reading").length;
  const marginCropPages = transforms.filter((transform) => transform.mode === "margin-crop").length;
  const pagesPreserved = transforms.filter((transform) => transform.mode === "preserved").length;

  return {
    sourcePagesAnalyzed: transforms.length,
    pagesSplit,
    pagesPreserved,
    marginCropPages,
    estimatedOutputPages: pagesSplit * 2 + marginCropPages + pagesPreserved
  };
}
