import React from "react";
import { LandingDemoComparison } from "./DemoVisual";
import { READING_PRESETS } from "@/lib/presets/readingPresets";
import type { PlanTier } from "@/lib/product/productLimits";
import { getDemoAssetManifest } from "@/lib/product/demoAssetManifest";

export function ProblemSection() {
  const cards = [
    ["Two-column papers are painful on Kindle.", "Small screens force constant zooming and panning."],
    ["Huge margins waste screen space.", "Academic PDFs are often designed for print, not handheld reading."],
    ["Tablet reading becomes repetitive.", "Dense pages make every paper feel like manual layout work."],
    ["Batch reading many papers is slow.", "Literature reviews need repeatable export workflows, not one-off chores."]
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 pb-12 md:px-8" data-qa="problem-section">
      <h2 className="text-3xl font-semibold text-ink">Academic PDFs were not designed for small screens.</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {cards.map(([title, copy]) => (
          <article key={title} className="rounded-lg border border-sage/20 bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/62">{copy}</p>
          </article>
        ))}
      </div>
      <p className="mt-5 max-w-3xl text-base leading-7 text-ink/70">
        PaperRead turns dense paper layouts into reading-friendly PDFs while preserving risky pages safely.
      </p>
    </section>
  );
}

export function StaticBeforeAfterSection() {
  return <LandingDemoComparison assets={getDemoAssetManifest()} />;
}

export function BuiltForPapersSection() {
  const copyById: Record<string, string> = {
    "academic-paper": "Balanced layout for research papers and technical PDFs.",
    "kindle-ereader": "Larger text and shorter reading pages for e-ink screens.",
    "ipad-tablet": "Fewer splits and comfortable tablet reading.",
    "safe-default": "Conservative cleanup for complex documents."
  };

  return (
    <section className="mx-auto max-w-6xl px-5 pb-12 md:px-8" data-qa="built-for-papers">
      <h2 className="text-3xl font-semibold text-ink">Built for papers, not generic PDF chores.</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {READING_PRESETS.map((preset) => (
          <article key={preset.id} className="rounded-lg border border-sage/20 bg-white/70 p-4">
            <span className="rounded-full border border-sage/15 bg-mist/55 px-2.5 py-1 text-xs font-semibold text-sage">{preset.badge ?? preset.tag}</span>
            <h3 className="mt-3 text-sm font-semibold text-ink">{preset.label}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/62">{copyById[preset.id]}</p>
          </article>
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-ink/62">
        Complex title pages, figures and tables are preserved when restructuring would be risky.
      </p>
    </section>
  );
}

export function LocalFirstSection() {
  const bullets = [
    "No upload required",
    "Good for drafts and private research PDFs",
    "Works best with selectable-text PDFs",
    "Large/complex PDFs may take longer"
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 pb-12 md:px-8" data-qa="privacy-section">
      <div className="rounded-xl border border-sage/20 bg-white/75 p-5 shadow-soft">
        <h2 className="text-3xl font-semibold text-ink">Your PDFs stay in your browser.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
          Processing runs locally in your browser. Your papers are not uploaded to a server.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {bullets.map((bullet) => (
            <span key={bullet} className="rounded-md border border-sage/15 bg-mist/45 px-3 py-2 text-sm font-semibold text-ink/62">
              {bullet}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingSection({ planTier = "free" }: { planTier?: PlanTier }) {
  if (planTier === "pro") {
    return (
      <section className="mx-auto max-w-6xl px-5 pb-12 md:px-8" data-qa="pricing-section" data-plan-section="pro-tools">
        <h2 className="text-3xl font-semibold text-ink">Your Pro reading tools are enabled.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
          Full-document export, Batch ZIP export and local-first processing are active for this session. No preview export limit is applied.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {["Full document export enabled", "Batch ZIP export enabled", "Local-first processing", "No preview export limit"].map((item) => (
            <article key={item} className="rounded-xl border border-sage/20 bg-white/75 p-4">
              <h3 className="text-sm font-semibold text-ink">{item}</h3>
            </article>
          ))}
        </div>
        <a href="#batch-export" className="mt-5 inline-flex rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper">
          Go to batch export
        </a>
      </section>
    );
  }

  return (
    <section id="early-access" className="mx-auto max-w-6xl scroll-mt-6 px-5 pb-12 md:px-8" data-qa="pricing-section" data-plan-section="free-pricing">
      <h2 className="text-3xl font-semibold text-ink">Start free. Unlock full reading workflows when you need them.</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
        Free beta is enough to try the workflow. Early Access Pro is for full papers, reading lists and batch ZIP export.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <PlanCard
          title="Free Beta"
          badge="Try now"
          cta="Try free"
          href="#tool-workflow"
          items={["3 PDFs/month local beta limit", "Preview optimization", "Limited export: up to 5 source pages or 12 reading pages", "Basic presets", "Single PDF workflow"]}
        />
        <PlanCard
          title="Early Access Pro"
          badge="Coming soon"
          cta="Get Pro early access"
          href="#early-access"
          emphasized
          items={["Full-document export", "Batch ZIP export", "Multiple PDFs", "Higher limits", "Device-specific presets", "Planned 19-29 EUR lifetime early access", "Payments are not connected yet"]}
        />
      </div>
    </section>
  );
}

export function FaqSection() {
  const faqs = [
    ["Is this just a PDF cropper?", "No. It is optimized for academic reading workflows: column splitting, device presets, reading-page export and batch processing."],
    ["Do you upload my PDFs?", "No. Processing runs locally in your browser."],
    ["Will it work on every paper?", "It works best on selectable-text academic PDFs. Complex title pages, figures and tables may be preserved safely."],
    ["Why are some pages preserved?", "To avoid damaging layouts that are risky to restructure."],
    ["What is Pro for?", "Full-document export and batch ZIP processing."]
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 pb-12 md:px-8" data-qa="faq-section">
      <h2 className="text-3xl font-semibold text-ink">Questions before you upload a paper.</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {faqs.map(([question, answer]) => (
          <article key={question} className="rounded-lg border border-sage/20 bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-ink">{question}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/62">{answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlanCard({ title, badge, cta, href, items, emphasized = false }: { title: string; badge: string; cta: string; href: string; items: string[]; emphasized?: boolean }) {
  return (
    <article className={`rounded-xl border p-5 ${emphasized ? "border-sage/35 bg-white shadow-soft" : "border-sage/20 bg-white/70"}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <span className="rounded-full border border-sage/15 bg-mist/60 px-2.5 py-1 text-xs font-semibold text-sage">{badge}</span>
      </div>
      <ul className="mt-4 grid gap-2 text-sm leading-6 text-ink/65">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <a href={href} className={`mt-5 inline-flex rounded-md px-3 py-2 text-sm font-semibold ${emphasized ? "bg-ink text-paper" : "border border-sage/25 bg-white text-ink"}`}>
        {cta}
      </a>
    </article>
  );
}
