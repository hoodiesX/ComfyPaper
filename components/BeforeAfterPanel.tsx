"use client";

import Image from "next/image";
import React from "react";
import { useState } from "react";
import type { RenderedPage } from "@/types/pdf";
import type { ReadingPresetConfig } from "@/lib/presets/presetTypes";
import type { UserOptimizationReport } from "@/lib/product/optimizationReport";
import { selectBestComparisonPageCandidate } from "@/lib/product/optimizationReport";
import { PdfPreview } from "./PdfPreview";

type BeforeAfterPanelProps = {
  pages: RenderedPage[];
  optimizedPages: RenderedPage[];
  failedPageNumbers?: number[];
  optimizedFailedPageNumbers?: number[];
  optimizedStatus: "idle" | "loading" | "ready" | "error";
  optimizedError?: string | null;
  selectedPreset: ReadingPresetConfig;
  optimizationReport?: UserOptimizationReport;
};

export function BeforeAfterPanel({
  pages,
  optimizedPages,
  failedPageNumbers,
  optimizedFailedPageNumbers,
  optimizedStatus,
  optimizedError,
  selectedPreset,
  optimizationReport
}: BeforeAfterPanelProps) {
  const [deviceFrame, setDeviceFrame] = useState<"paper" | "ipad" | "kindle">("paper");
  const bestComparison = selectBestComparisonPageCandidate(optimizedPages);
  const bestOptimizedPage = bestComparison.page;
  const bestOriginalPage = bestOptimizedPage
    ? pages.find((page) => page.pageNumber === (bestOptimizedPage.sourcePageNumber ?? bestOptimizedPage.pageNumber)) ?? pages[0]
    : pages[0];
  const previewSourcePage = bestOptimizedPage?.sourcePageNumber ?? bestOptimizedPage?.pageNumber;
  const bestReason = optimizationReport?.bestComparisonReason ?? bestComparison.reason;
  const bestBadge = optimizationReport?.bestComparisonBadge ?? bestComparison.badge;

  return (
    <section className="grid gap-5">
      {optimizedStatus === "ready" && bestOptimizedPage && bestOriginalPage ? (
        <div className="rounded-lg border border-sage/20 bg-white/75 p-4 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-ink">Best improvement from your PDF</h2>
                <span className="rounded-full border border-sage/20 bg-sage/10 px-2.5 py-1 text-xs font-semibold text-sage">
                  {bestBadge}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-ink/62">
                We show the first body page where the layout was improved. Preserved title or figure pages are kept safe.
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-ink/70">{bestReason}</p>
              {previewSourcePage && previewSourcePage !== 1 ? (
                <p className="text-sm leading-6 text-ink/55">
                  Previewing page {previewSourcePage} because page 1 was preserved.
                </p>
              ) : null}
            </div>
            <div className="flex w-fit rounded-md border border-sage/20 bg-mist/55 p-1">
              {[
                ["paper", "Desktop/Paper"],
                ["ipad", "iPad"],
                ["kindle", "Kindle"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeviceFrame(value as typeof deviceFrame)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    deviceFrame === value ? "bg-white text-ink shadow-sm" : "text-ink/55"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[0.92fr_1.08fr]">
            <ComparisonImage title="Original" page={bestOriginalPage} frame={deviceFrame} />
            <ComparisonImage title="Optimized reading layout" page={bestOptimizedPage} frame={deviceFrame} featured />
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <h2 className="mb-3 text-xl font-semibold text-ink">Original preview</h2>
        <PdfPreview pages={pages} failedPageNumbers={failedPageNumbers} previewKind="original" />
      </div>
      <div className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">{selectedPreset.label} preview</h2>
          <p className="mt-1 text-sm leading-6 text-ink/62">
            {selectedPreset.shortDescription}
          </p>
        </div>
        {optimizedStatus === "idle" ? (
          <div className="flex min-h-96 items-center justify-center rounded-lg border border-sage/25 bg-white/65 p-8 text-center shadow-soft">
            <p className="max-w-sm text-sm leading-6 text-ink/62">
              Upload a PDF to preview reading optimizations.
            </p>
          </div>
        ) : null}
        {optimizedStatus === "loading" ? <OptimizedPreviewSkeleton count={Math.max(1, pages.length)} /> : null}
        {optimizedStatus === "error" ? (
          <div className="flex min-h-96 items-center justify-center rounded-lg border border-clay/35 bg-clay/10 p-8 text-center shadow-soft">
            <p className="max-w-sm text-sm font-semibold leading-6 text-ink">
              {optimizedError ?? "We could not generate the cropped preview for this PDF."}
            </p>
          </div>
        ) : null}
        {optimizedStatus === "ready" ? (
          <PdfPreview
            pages={optimizedPages}
            failedPageNumbers={optimizedFailedPageNumbers}
            previewKind="optimized"
            presetId={selectedPreset.id}
          />
        ) : null}
      </div>
      </div>
    </section>
  );
}

function ComparisonImage({
  title,
  page,
  frame,
  featured = false
}: {
  title: string;
  page: RenderedPage;
  frame: "paper" | "ipad" | "kindle";
  featured?: boolean;
}) {
  const frameClass = frame === "kindle"
    ? `mx-auto max-w-[260px] rounded-[18px] border-[10px] bg-white p-2 ${featured ? "border-sage shadow-soft" : "border-ink/85"}`
    : frame === "ipad"
      ? `mx-auto max-w-[360px] rounded-[20px] border-[8px] bg-white p-2 ${featured ? "border-sage shadow-soft" : "border-ink/35"}`
      : `mx-auto max-w-[420px] rounded-md border bg-white ${featured ? "border-sage shadow-soft" : "border-sage/15"}`;

  return (
    <figure>
      <figcaption className="mb-2 text-sm font-semibold text-ink/70">{title}</figcaption>
      <div className={frameClass}>
        <Image
          src={page.dataUrl}
          width={page.width}
          height={page.height}
          alt={`${title} PDF preview page ${page.sourcePageNumber ?? page.pageNumber}`}
          unoptimized
          className="mx-auto h-auto max-h-[520px] w-auto max-w-full bg-white"
        />
      </div>
    </figure>
  );
}

function OptimizedPreviewSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }, (_, index) => index + 1).map((pageNumber) => (
        <div
          key={pageNumber}
          className="overflow-hidden rounded-lg border border-sage/25 bg-white shadow-soft"
        >
          <div className="border-b border-sage/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sage">
            Page {pageNumber}
          </div>
          <div className="h-96 animate-pulse bg-mist" />
        </div>
      ))}
    </div>
  );
}
