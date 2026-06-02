"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import { EMPTY_DEMO_ASSET_MANIFEST, OPTIMIZED_DEMO_ASSETS, ORIGINAL_DEMO_ASSETS, type DemoDevice, type ResolvedDemoAsset, type ResolvedDemoAssetManifest } from "@/lib/product/demoAssetConfig";

const DEVICE_COPY: Record<DemoDevice, { label: string; badge: string; fallbackBadge: string; deviceLabel: string }> = {
  academic: {
    label: "Academic reading layout",
    badge: "Balanced reading pages",
    fallbackBadge: "Reading layout preview",
    deviceLabel: "Balanced paper reading"
  },
  kindle: {
    label: "Kindle reading layout",
    badge: "Larger e-reader text",
    fallbackBadge: "E-reader preview frame",
    deviceLabel: "E-reader friendly"
  },
  ipad: {
    label: "iPad reading layout",
    badge: "Comfortable tablet layout",
    fallbackBadge: "Tablet preview frame",
    deviceLabel: "Tablet reading"
  }
};

export { OPTIMIZED_DEMO_ASSETS, ORIGINAL_DEMO_ASSETS };

export function HeroDemoVisual({ assets = EMPTY_DEMO_ASSET_MANIFEST }: { assets?: ResolvedDemoAssetManifest }) {
  const original = assets.original;
  const optimized = assets.optimized.academic;
  const hasRealOptimized = Boolean(optimized.src);

  return (
    <div
      className="relative py-3 md:py-6"
      data-qa="hero-demo-visual"
      data-hero-real-optimized={hasRealOptimized ? "true" : "false"}
    >
      <div className="grid items-center gap-3 rounded-[1.35rem] bg-gradient-to-br from-white/70 to-mist/38 p-3 md:grid-cols-[0.96fr_2rem_1.04fr] md:p-4">
        <HeroAssetPanel label="Original paper" subdued>
          <DemoAssetFrame
            asset={original}
            alt="Original dense academic PDF body page"
            fallback={<AcademicPaperFallback compact />}
            variant="hero-original"
            tone="contrast"
          />
        </HeroAssetPanel>
        <TransformCue />
        <HeroAssetPanel label="Reading layout" featured>
          <DemoAssetFrame
            asset={optimized}
            alt="Optimized academic reading layout preview"
            fallback={<ReadingLayoutFallback compact deviceLabel="Reading layout" />}
            variant="hero-optimized"
            tone="focus"
          />
        </HeroAssetPanel>
      </div>
    </div>
  );
}

export function LandingDemoComparison({ assets = EMPTY_DEMO_ASSET_MANIFEST }: { assets?: ResolvedDemoAssetManifest }) {
  const [device, setDevice] = React.useState<DemoDevice>("academic");
  const original = assets.original;
  const optimized = assets.optimized[device];
  const deviceCopy = DEVICE_COPY[device];
  const optimizedBadge = optimized.source === OPTIMIZED_DEMO_ASSETS[device][0] ? deviceCopy.badge : deviceCopy.fallbackBadge;
  const hasRealDemo = Boolean(original.src && optimized.src);

  return (
    <section id="reading-difference" className="mx-auto max-w-6xl scroll-mt-6 px-5 pb-12 md:px-8" data-qa="before-after-landing">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-ink">From dense paper to reading layout.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/62">
            PaperRead keeps risky pages safe and optimizes body pages for comfortable reading on Kindle, iPad and e-readers.
          </p>
        </div>
        <div className="flex w-fit rounded-md border border-sage/20 bg-white/75 p-1 text-xs font-semibold text-ink/60">
          {([
            ["academic", "Academic"],
            ["kindle", "Kindle"],
            ["ipad", "iPad"]
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              className={`rounded px-2.5 py-1 ${device === id ? "bg-mist text-ink" : ""}`}
              data-qa={`device-tab-${id}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
        <DemoComparisonCard title="Original academic PDF" badge="Dense two-column layout">
          <DemoAssetFrame
            asset={original}
            alt="Original dense academic PDF body page"
            fallback={<AcademicPaperFallback />}
            variant="landing-original"
            tone="contrast"
          />
        </DemoComparisonCard>
        <DemoComparisonCard title={deviceCopy.label} badge={optimizedBadge} featured>
          <DevicePreviewFrame device={device} assetBacked={Boolean(optimized.src)}>
            <DemoAssetFrame
              asset={optimized}
              alt={`${deviceCopy.label} demo`}
              fallback={<ReadingLayoutFallback deviceLabel={deviceCopy.deviceLabel} device={device} />}
              variant={`landing-${device}`}
              tone="device"
            />
          </DevicePreviewFrame>
        </DemoComparisonCard>
      </div>
      <p
        className="mt-3 text-sm leading-6 text-ink/55"
        data-qa={hasRealDemo ? "real-demo-copy" : "fallback-demo-copy"}
      >
        {hasRealDemo
          ? "Demo captured from a real optimized paper. Upload your own PDF to generate a live preview."
          : "Illustration · upload a PDF to generate a live preview."}{" "}
        Best with selectable-text academic PDFs. Title pages, figures and complex layouts may be preserved safely.
      </p>
    </section>
  );
}

function DemoComparisonCard({
  title,
  badge,
  featured = false,
  compact = false,
  subdued = false,
  flush = false,
  children
}: {
  title: string;
  badge: string;
  featured?: boolean;
  compact?: boolean;
  subdued?: boolean;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className={`rounded-xl border bg-white/86 shadow-soft ${featured ? "border-sage/35" : "border-sage/20"} ${subdued ? "opacity-[0.94]" : ""} ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="rounded-full border border-sage/15 bg-mist/60 px-2.5 py-1 text-xs font-semibold text-sage">{badge}</span>
      </div>
      <div className={flush ? "flex items-center justify-center" : ""}>{children}</div>
    </article>
  );
}

function HeroAssetPanel({
  label,
  featured = false,
  subdued = false,
  children
}: {
  label: string;
  featured?: boolean;
  subdued?: boolean;
  children: React.ReactNode;
}) {
  return (
    <figure className={`min-w-0 ${featured ? "drop-shadow-[0_18px_38px_rgba(35,45,38,0.13)]" : ""} ${subdued ? "opacity-90" : ""}`}>
      <figcaption className="mb-2 text-center text-xs font-semibold text-ink/58">{label}</figcaption>
      <div className="flex justify-center">{children}</div>
    </figure>
  );
}

function DevicePreviewFrame({ device, assetBacked, children }: { device: DemoDevice; assetBacked: boolean; children: React.ReactNode }) {
  const frameClass = {
    academic: "aspect-[4/5] w-full max-w-[455px] rounded-xl border border-sage/18 bg-white p-3",
    kindle: "aspect-[7/10] w-full max-w-[390px] rounded-[1.7rem] border-[8px] border-ink/12 bg-white p-3",
    ipad: "aspect-[4/5] w-full max-w-[530px] rounded-[1.65rem] border-[8px] border-ink/10 bg-white p-3"
  }[device];

  return (
    <div className="flex min-h-[520px] items-center justify-center overflow-hidden rounded-xl bg-mist/30 px-3 py-5" data-qa="device-preview-stage">
      <div
        className={`${frameClass} flex items-center justify-center overflow-hidden shadow-soft`}
        data-qa="device-preview-frame"
        data-device={device}
        data-asset-backed={assetBacked ? "true" : "false"}
        data-frame-system="unified"
      >
        {children}
      </div>
    </div>
  );
}

function DemoAssetFrame({
  asset,
  alt,
  fallback,
  variant,
  tone = "device"
}: {
  asset: ResolvedDemoAsset;
  alt: string;
  fallback: React.ReactNode;
  variant: string;
  tone?: "contrast" | "focus" | "device";
}) {
  const frameClass = asset.src ? getRealImageFrameClass(variant, tone) : getFallbackFrameClass(variant, tone);
  const imageClass = getImageClass(variant);

  if (!asset.src) {
    return <div className={frameClass} data-qa="demo-asset-fallback">{fallback}</div>;
  }

  return (
    <div
      className={frameClass}
      data-qa="demo-asset-real"
      data-demo-asset-variant={variant}
      data-demo-asset-source={asset.source}
    >
      <img
        src={asset.src}
        width={1400}
        height={1800}
        alt={alt}
        loading="eager"
        className={imageClass}
        data-qa="demo-asset-image"
      />
    </div>
  );
}

function getRealImageFrameClass(variant: string, tone: "contrast" | "focus" | "device") {
  const base = "relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-white";
  const toneClass = {
    contrast: "border border-sage/10",
    focus: "border border-sage/18",
    device: "border border-sage/10"
  }[tone];

  if (variant === "hero-original") return `${base} ${toneClass} aspect-[3/4] w-full max-w-[300px] p-1`;
  if (variant === "hero-optimized") return `${base} ${toneClass} aspect-[4/5] w-full max-w-[320px] rounded-[1.35rem] border-[6px] border-ink/10 p-1.5 shadow-soft`;
  if (variant === "landing-original") return `${base} ${toneClass} aspect-[3/4] w-full max-w-[455px] p-2`;
  return `${base} ${toneClass} h-full w-full p-1.5`;
}

function getFallbackFrameClass(variant: string, tone: "contrast" | "focus" | "device") {
  const base = "relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-white shadow-inner";
  const toneClass = {
    contrast: "border border-sage/10",
    focus: "border border-sage/18",
    device: "border border-sage/10"
  }[tone];

  if (variant === "hero-original") return `${base} ${toneClass} aspect-[3/4] w-full max-w-[300px] p-2`;
  if (variant === "hero-optimized") return `${base} ${toneClass} aspect-[4/5] w-full max-w-[320px] rounded-[1.35rem] border-[6px] border-ink/10 p-2 shadow-soft`;
  if (variant === "landing-original") return `${base} ${toneClass} aspect-[3/4] w-full max-w-[455px] p-3`;
  return `${base} ${toneClass} h-full w-full p-2`;
}

function getImageClass(variant: string) {
  const base = "mx-auto h-full w-full rounded object-contain";
  if (variant === "landing-original") return `${base} object-top`;
  return base;
}

function TransformCue() {
  return (
    <div className="relative mx-auto hidden h-40 w-8 items-center justify-center md:flex" data-qa="premium-transform-cue" aria-hidden="true">
      <span className="absolute h-px w-12 bg-gradient-to-r from-sage/10 via-sage/45 to-sage/10" />
      <span className="relative h-2.5 w-2.5 rounded-full border border-white bg-sage/65 shadow-[0_0_0_6px_rgba(114,134,112,0.12)]" />
    </div>
  );
}

function AcademicPaperFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-inner" data-qa="original-academic-mockup">
      <div className={`rounded bg-paper text-ink/62 ${compact ? "px-2.5 py-3 text-[8px] leading-tight" : "px-3 py-5 text-[10px] leading-snug"}`}>
        <div className="mx-auto max-w-[82%]">
          <p className={`${compact ? "text-[9px]" : "text-sm"} text-center font-semibold text-ink`}>Reading Dense Scientific Papers on Small Screens</p>
          <p className={`mt-1 text-center ${compact ? "text-[7px]" : "text-[9px]"} text-ink/45`}>Alex Researcher · Maya Student · PaperRead Lab</p>
          <p className="mt-3 font-semibold uppercase tracking-[0.08em] text-sage">Abstract</p>
          <p className="mt-1">We study how dense technical documents can be transformed into reading-friendly layouts for tablets and e-readers.</p>
          <div className={`mt-3 grid grid-cols-2 ${compact ? "gap-2" : "gap-4"}`}>
            <div>
              <p className="font-semibold text-ink/75">1 Introduction</p>
              <p className="mt-1">Two-column layouts are efficient for print, but difficult on small screens [1]. Readers frequently zoom and pan.</p>
              <p className="mt-2">Prior work reports that margin waste and narrow columns increase reading friction [2].</p>
            </div>
            <div>
              <div className="mb-2 rounded border border-sage/15 bg-mist/50 p-2 text-center font-semibold text-ink/55">Fig. 1 · Layout density</div>
              <p>Risky figures and tables stay preserved while body text becomes reading pages.</p>
              <p className="mt-2 font-mono">R = text_area / page_area</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadingLayoutFallback({
  compact = false,
  device = "academic",
  deviceLabel
}: {
  compact?: boolean;
  device?: DemoDevice;
  deviceLabel: string;
}) {
  const sizing = {
    academic: "p-7 text-[12px] leading-7",
    kindle: "p-6 text-[13px] leading-8",
    ipad: "p-7 text-[12px] leading-7"
  }[device];

  return (
    <div
      className={`rounded-lg bg-paper text-ink/68 shadow-inner ${compact ? "p-4 text-[9px] leading-relaxed" : sizing}`}
      data-qa="reading-layout-mockup"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-sage">{deviceLabel}</p>
      <h3 className="mt-2 text-base font-semibold text-ink">1 Introduction</h3>
      <p className="mt-3">
        Two-column layouts are efficient for print, but difficult on Kindle, iPad and e-readers. A reading layout keeps the body text in one comfortable column.
      </p>
      <p className="mt-3">
        Margins are cleaned, citations stay with the text, and complex figures or risky pages can be preserved safely instead of being damaged.
      </p>
      <div className="mt-4 rounded border border-sage/15 bg-mist/55 p-3 text-xs font-semibold text-sage">
        Body text optimized · margins cleaned · risky pages preserved safely
      </div>
    </div>
  );
}
