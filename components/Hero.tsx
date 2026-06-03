import React from "react";
import { HeroDemoVisual } from "./DemoVisual";
import { getDemoAssetManifest } from "@/lib/product/demoAssetManifest";

export function Hero() {
  const demoAssets = getDemoAssetManifest();

  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-12 pt-12 md:grid-cols-[1.08fr_0.92fr] md:items-center md:px-8 md:pb-16 md:pt-20" data-qa="landing-hero">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">
          PaperRead · Local-first academic reading optimizer
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight text-ink md:text-6xl">
          Make research papers readable on Kindle, iPad and e-readers.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-ink/72 md:text-lg">
          Split two-column academic PDFs into comfortable reading pages. Optimize margins, preserve complex pages safely, and export a cleaner reading version locally in your browser.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#tool-workflow" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-ink/90">
            Optimize a PDF
          </a>
          <a href="#early-access" className="rounded-md border border-sage/25 bg-white/75 px-4 py-2 text-sm font-semibold text-ink transition hover:border-sage">
            Join early access
          </a>
          <a href="#reading-difference" className="rounded-md border border-sage/25 bg-white/75 px-4 py-2 text-sm font-semibold text-ink transition hover:border-sage">
            See how it works
          </a>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-ink/62">
          {["Local-first", "No upload required", "Built for academic papers", "Batch ZIP export"].map((badge) => (
            <span key={badge} className="rounded-full border border-sage/15 bg-white/70 px-3 py-1">
              {badge}
            </span>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/55">
          Title pages, figures and complex layouts may be preserved safely to avoid damaging the PDF.
        </p>
      </div>
      <HeroDemoVisual assets={demoAssets} />
    </section>
  );
}
