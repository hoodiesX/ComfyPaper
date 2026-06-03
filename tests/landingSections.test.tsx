import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Hero } from "@/components/Hero";
import { BeforeAfterPanel } from "@/components/BeforeAfterPanel";
import { HeroDemoVisual, LandingDemoComparison, OPTIMIZED_DEMO_ASSETS, ORIGINAL_DEMO_ASSETS } from "@/components/DemoVisual";
import { EMPTY_DEMO_ASSET_MANIFEST } from "@/lib/product/demoAssetConfig";
import { getDemoAssetManifest } from "@/lib/product/demoAssetManifest";
import {
  BuiltForPapersSection,
  FaqSection,
  LocalFirstSection,
  PricingSection,
  ProblemSection,
  StaticBeforeAfterSection
} from "@/components/LandingSections";
import { metadata } from "@/app/layout";
import { getReadingPreset } from "@/lib/presets/readingPresets";

describe("premium landing page sections", () => {
  it("renders the hero with research paper and device value", () => {
    const html = renderToStaticMarkup(<Hero />);

    expect(html).toContain("Make research papers readable on Kindle, iPad and e-readers");
    expect(html).toContain("Split two-column academic PDFs");
    expect(html).toContain("Optimize a PDF");
    expect(html).toContain("Local-first");
    expect(html).toContain("Original paper");
    expect(html).toContain("Reading layout");
    expect(html).toContain("hero-demo-visual");
    expect(html).toContain("premium-transform-cue");
    expect(html).toContain("data-hero-real-optimized=\"true\"");
    expect(html).toContain("data-demo-asset-variant=\"hero-optimized\"");
    expect(html).not.toContain("Two columns into reading pages");
    expect(html).not.toContain("Academic Paper");
    expect(html).not.toContain("Dense paper");
    expect(html).not.toContain("Reading layout preview");
    expect(html).not.toContain("demo-asset-fallback");
    expect(html).not.toContain("-&gt;");
    expect(html).not.toContain("->");
    expect(html).not.toContain("Optimized locally");
  });

  it("renders problem, before/after, mode, privacy, pricing and FAQ sections", () => {
    const html = renderToStaticMarkup(
      <>
        <ProblemSection />
        <StaticBeforeAfterSection />
        <BuiltForPapersSection />
        <LocalFirstSection />
        <PricingSection />
        <FaqSection />
      </>
    );

    expect(html).toContain("Academic PDFs were not designed for small screens.");
    expect(html).toContain("From dense paper to reading layout.");
    expect(html).toContain("Built for papers, not generic PDF chores.");
    expect(html).toContain("Your PDFs stay in your browser.");
    expect(html).toContain("Start free. Unlock full reading workflows");
    expect(html).toContain("Is this just a PDF cropper?");
  });

  it("uses concrete academic before/after mockups instead of abstract line placeholders", () => {
    const html = renderToStaticMarkup(<StaticBeforeAfterSection />);

    expect(html).toContain("Original academic PDF");
    expect(html).toContain("Dense two-column layout");
    expect(html).toContain("demo-asset-real");
    expect(html).not.toContain("demo-asset-fallback");
    expect(html).toContain("Academic reading layout");
    expect(html).toContain("Kindle");
    expect(html).toContain("iPad");
    expect(html).toContain("device-preview-stage");
    expect(html).toContain("device-preview-frame");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("Demo captured from a real optimized paper");
    expect(html).toContain("Title pages, figures and complex layouts may be preserved safely");
  });

  it("renders fallback illustrations only when no demo assets are resolved", () => {
    const heroHtml = renderToStaticMarkup(<HeroDemoVisual assets={EMPTY_DEMO_ASSET_MANIFEST} />);
    const landingHtml = renderToStaticMarkup(<LandingDemoComparison assets={EMPTY_DEMO_ASSET_MANIFEST} />);

    expect(heroHtml).toContain("demo-asset-fallback");
    expect(heroHtml).toContain("Reading Dense Scientific Papers on Small Screens");
    expect(heroHtml).toContain("Abstract");
    expect(heroHtml).toContain("1 Introduction");
    expect(landingHtml).toContain("Illustration · upload a PDF to generate a live preview");
    expect(landingHtml).toContain("Body text optimized");
  });

  it("prefers real optimized Academic assets and falls device frames back gracefully", () => {
    expect(ORIGINAL_DEMO_ASSETS).toEqual(["/demo/demo-original.png"]);
    expect(OPTIMIZED_DEMO_ASSETS.academic[0]).toBe("/demo/demo-optimized-academic.png");
    expect(OPTIMIZED_DEMO_ASSETS.ipad).toEqual(["/demo/demo-optimized-ipad.png", "/demo/demo-optimized-academic.png"]);
    expect(OPTIMIZED_DEMO_ASSETS.kindle).toEqual([
      "/demo/demo-optimized-kindle.png",
      "/demo/demo-optimized-ipad.png",
      "/demo/demo-optimized-academic.png"
    ]);
  });

  it("resolves existing demo assets before rendering to avoid fallback flicker", () => {
    const manifest = getDemoAssetManifest();

    expect(manifest.original.source).toBe("/demo/demo-original.png");
    expect(manifest.optimized.academic.source).toBe("/demo/demo-optimized-academic.png");
    expect(manifest.original.src).toContain("?v=");
    expect(manifest.optimized.academic.src).toContain("?v=");
  });

  it("keeps landing CTAs honest and anchored to the right product sections", () => {
    const heroHtml = renderToStaticMarkup(<Hero />);
    const pricingHtml = renderToStaticMarkup(<PricingSection />);

    expect(heroHtml).toContain('href="#tool-workflow"');
    expect(heroHtml).toContain("Join early access");
    expect(heroHtml).toContain('href="#early-access"');
    expect(heroHtml).toContain('href="#reading-difference"');
    expect(pricingHtml).toContain("Try free");
    expect(pricingHtml).toContain('href="#tool-workflow"');
    expect(pricingHtml).toContain("Early Access Pro");
    expect(pricingHtml).toContain("Get Pro early access");
    expect(pricingHtml).toContain("Full-document export");
    expect(pricingHtml).toContain("Batch ZIP export");
    expect(pricingHtml).toContain("Planned 19-29 EUR lifetime early access");
    expect(pricingHtml).toContain("Payments are not connected yet");
    expect(pricingHtml).not.toContain("Payments coming soon");
  });

  it("renders a Pro operational tools section without upgrade sales copy", () => {
    const html = renderToStaticMarkup(<PricingSection planTier="pro" />);

    expect(html).toContain("Your Pro reading tools are enabled.");
    expect(html).toContain("Full document export enabled");
    expect(html).toContain("Batch ZIP export enabled");
    expect(html).toContain("Go to batch export");
    expect(html).not.toContain("Join early access");
    expect(html).not.toContain("Unlock Pro");
    expect(html).not.toContain("Start free. Unlock full reading workflows");
  });

  it("has SEO-ready metadata for research paper reading workflows", () => {
    expect(String(metadata.title)).toContain("Research Papers");
    expect(String(metadata.title)).toContain("Kindle");
    expect(metadata.description).toContain("academic PDFs");
    expect(metadata.description).toContain("Kindle, iPad and e-readers");
  });

  it("separates static landing demo from uploaded-file live preview", () => {
    const landingHtml = renderToStaticMarkup(<StaticBeforeAfterSection />);
    const liveHtml = renderToStaticMarkup(
      <BeforeAfterPanel
        pages={[page(1)]}
        optimizedPages={[{ ...page(2), sourcePageNumber: 1, label: "Page 1 · left column · tile 2 of 2" } as never]}
        optimizedStatus="ready"
        selectedPreset={getReadingPreset("ipad-tablet")}
      />
    );

    expect(landingHtml).toContain("From dense paper to reading layout.");
    expect(liveHtml).toContain("Best improvement from your PDF");
    expect(liveHtml).toContain("Preserved title or figure pages are kept safe");
    expect(liveHtml).not.toContain("From dense paper to reading layout.");
  });
});

function page(pageNumber: number) {
  return {
    pageNumber,
    sourcePageNumber: pageNumber,
    label: `Page ${pageNumber}`,
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    width: 300,
    height: 400
  } as never;
}
