import Image from "next/image";
import React from "react";
import type { RenderedPage } from "@/types/pdf";
import { CropResultBadge } from "./CropResultBadge";

type PdfPreviewProps = {
  pages: RenderedPage[];
  failedPageNumbers?: number[];
  previewKind?: "original" | "optimized";
  presetId?: string;
};

export function PdfPreview({ pages, failedPageNumbers = [], previewKind = "original", presetId }: PdfPreviewProps) {
  if (pages.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border border-sage/25 bg-white/70 p-6 text-center text-sm text-ink/60">
        No preview rendered yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {pages.map((page) => (
        <figure
          key={page.previewId ?? getPageKey(page)}
          data-testid={getPreviewTestId(page, previewKind)}
          data-demo-target={getDemoTarget(page, previewKind, presetId)}
          data-preview-kind={previewKind}
          data-source-page={page.sourcePageNumber ?? page.pageNumber}
          data-column={page.column ?? ""}
          data-tile-index={page.tileIndex ?? ""}
          data-tile-count={page.tileCount ?? ""}
          data-preset={presetId ?? ""}
          className="overflow-hidden rounded-lg border border-sage/25 bg-white shadow-soft"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sage/15 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-sage">
              {getPageLabel(page)}
            </span>
            <CropResultBadge
              status={page.cropStatus}
              columnStatus={page.columnStatus}
              gainPercent={page.cropGainPercent}
            />
          </div>
          <Image
            src={page.dataUrl}
            width={page.width}
            height={page.height}
            alt={`Original PDF page ${page.pageNumber}`}
            unoptimized
            className="mx-auto h-auto max-h-[620px] w-auto max-w-full bg-white"
          />
        </figure>
      ))}
      {failedPageNumbers.length > 0 ? (
        <div className="rounded-lg border border-clay/35 bg-clay/10 px-4 py-3 text-sm text-ink/75">
          We could not render a preview for page {failedPageNumbers.join(", ")}.
        </div>
      ) : null}
    </div>
  );
}

function getPreviewTestId(page: RenderedPage, previewKind: "original" | "optimized"): string {
  const sourcePage = page.sourcePageNumber ?? page.pageNumber;
  if (previewKind === "original") return `original-preview-page-${sourcePage}`;
  const column = page.column ? `-${page.column}` : "";
  const tile = page.tileIndex ? `-tile-${page.tileIndex}` : "";
  return `optimized-preview-page-${sourcePage}${column}${tile}`;
}

function getDemoTarget(page: RenderedPage, previewKind: "original" | "optimized", presetId?: string): string | undefined {
  if (
    previewKind === "optimized" &&
    presetId === "academic-paper" &&
    (page.sourcePageNumber ?? page.pageNumber) === 1 &&
    page.column === "left" &&
    page.tileIndex === 2 &&
    page.tileCount === 2
  ) {
    return "asp-ipad-page-1-left-tile-2";
  }
  return undefined;
}

function getPageKey(page: RenderedPage): string {
  return `${page.sourcePageNumber ?? page.pageNumber}-${page.column ?? "full"}-${page.tileIndex ?? 0}-${page.pageNumber}`;
}

function getPageLabel(page: RenderedPage): string {
  if (page.column && page.tileIndex && page.tileCount) {
    return `Page ${page.sourcePageNumber ?? page.pageNumber} · ${page.column} column · tile ${page.tileIndex} of ${page.tileCount}`;
  }

  if (page.column) {
    return `Page ${page.sourcePageNumber ?? page.pageNumber} · ${page.column} column`;
  }

  if (page.sourcePageNumber && page.sourcePageNumber !== page.pageNumber) {
    return `Page ${page.sourcePageNumber}`;
  }

  return `Page ${page.pageNumber}`;
}
