# CODING_GUIDELINES.md

## Project identity

This project is PaperRead, a local-first web product for optimizing academic PDFs, scientific papers and technical documents for Kindle, iPad, e-readers and mobile reading.

It is not a generic PDF editor, not a generic cropper, not an AI PDF chatbot, and not a broad PDF toolkit.

Core product promise:

> Make dense academic papers readable on Kindle, iPad and e-readers.

The product should help users turn two-column academic PDFs and technical documents into cleaner reading-friendly PDFs while preserving risky pages safely.

## Product positioning

Always preserve this positioning:

* local-first PDF processing;
* no unnecessary upload/server dependency;
* optimized for academic papers and technical documents;
* focused on reading comfort, not PDF editing;
* honest about limitations;
* premium Apple-like UX;
* simple enough for non-technical students/researchers;
* useful enough for researchers, PhD students, students and technical readers.

Do not make the product feel like:

* another PDF cropper;
* a generic PDF tools website;
* a developer prototype;
* an overcomplicated research demo.

## Core user value

The user pays for:

1. Full-document export.
2. Batch ZIP export.
3. Multiple PDF processing.
4. Device-specific reading presets.
5. Column splitting for academic body pages.
6. Clean before/after preview.
7. Local-first privacy.
8. Clear reports using non-technical language.
9. Saving time when preparing many papers for reading.

The strongest paid value is:

> Upload multiple papers, choose a reading target, download one ZIP of readable PDFs.

## Technical constraints

Unless explicitly requested, do not change:

* PDF engine behavior;
* column detection;
* crop detection;
* Kindle/iPad pagination;
* first-page/title-page heuristics;
* Batch ZIP behavior;
* Free/Pro gating logic;
* export logic;
* QA hook structure;
* file validation rules.

Do not add:

* backend;
* auth;
* real payments;
* OCR;
* EPUB;
* AI;
* dark mode;
* annotations;
* generic PDF tools;
* cloud storage;
* merge/split/compress tools;
* analytics/tracking;
* unnecessary dependencies.

Prefer small, targeted, maintainable changes.

## UX principles

The product must feel premium, calm and focused.

Design direction:

* Apple-like;
* clean;
* spacious;
* minimal;
* precise;
* soft shadows;
* subtle borders;
* strong typography;
* no cheap gradients;
* no noisy dashboard clutter;
* no developer-looking diagnostics;
* no excessive badges;
* no duplicate CTAs.

The user should always understand:

* what the tool does;
* what preset is selected;
* what will be exported;
* what is free;
* what is Pro;
* what pages were optimized;
* what pages were preserved safely;
* what action to take next.

## Landing page principles

The landing must communicate the value in under 10 seconds.

Primary message:

> Make research papers readable on Kindle, iPad and e-readers.

Landing should show:

* dense academic PDF before;
* readable optimized layout after;
* local-first privacy;
* not just “crop PDF”;
* Free vs Pro value;
* Batch ZIP as the main paid feature;
* honest limitations.

Do not overpromise.

Do not claim:

* every PDF works perfectly;
* every title page is reformatted;
* all figures/tables are reflowed;
* any PDF can be perfectly converted.

Preferred honest copy:

> Title pages, figures and complex layouts may be preserved safely. Body pages are optimized for reading.

## Demo and preview principles

There are two different preview concepts:

### 1. Static landing demo

Purpose:

* explain the product before upload;
* sell the concept;
* show a representative body-page transformation.

Use headings like:

> From dense paper to reading layout.

It should not pretend to be the user’s uploaded file.

### 2. Live uploaded-file preview

Purpose:

* show actual result from the user’s uploaded PDF.

Use headings like:

> Best improvement from your PDF.

These two sections must not feel duplicated.

If real demo assets exist in `public/demo/`, use them. Do not flash or render synthetic fallback first.

Expected demo assets:

* `public/demo/demo-original.png`
* `public/demo/demo-optimized-academic.png`
* `public/demo/demo-optimized-kindle.png`
* `public/demo/demo-optimized-ipad.png`

If real assets are used, do not label them as “Illustration”.

If fallback mockups are used, clearly mark them as:

> Illustration · upload a PDF to generate a live preview.

## Free / Pro rules

Free mode should feel useful but limited.

Free should include:

* single PDF workflow;
* preview;
* limited export;
* clear Pro upsell;
* locked Batch ZIP.

Free export should be limited by both:

* source pages;
* generated reading pages.

Suggested limits:

* max 5 source pages;
* max 12 reading pages.

Pro mode should feel operational, not promotional.

Pro should include:

* full-document export;
* Batch ZIP export;
* multiple PDFs;
* no free-limit messaging;
* no “upgrade to Pro” CTA;
* no fake sales section aimed at Pro users.

In Pro mode, do not show upgrade copy.

In Free mode, do not show ambiguous Pro controls.

## Batch ZIP rules

Batch ZIP is a core paid feature.

Batch must feel like a real Pro workflow, not a placeholder.

Required states:

* empty;
* files selected;
* queued;
* processing;
* completed;
* partial failure;
* failed.

Rules:

* no duplicate “Choose PDFs” buttons;
* queued state must have an obvious next action;
* before processing, CTA should be “Start batch export”;
* after completion, CTA should be “Download ZIP”;
* one failed file should not kill the whole batch;
* process sequentially unless explicitly changed;
* avoid browser memory blowups.

Default ZIP contents:

* optimized PDFs;
* human-readable `PaperRead-batch-summary.txt`.

Do not include technical JSON reports by default.

Technical JSON may exist only behind an explicit debug/internal flag.

## User-facing language

Avoid technical terms in user-facing UI:

Avoid:

* gutter;
* tile diagnostics;
* crop bounds;
* rawDecision;
* qualityGate;
* plan validation;
* row coverage;
* internal taxonomy;
* JSON diagnostics.

Prefer:

* optimized;
* preserved safely;
* review suggested;
* full-document export;
* preview export;
* reading pages;
* local processing;
* batch summary.

## Diagnostics

Developer diagnostics must remain hidden from normal users.

They may exist only in development/test mode.

Never expose raw QA/debug data in normal UI.

## QA and testing requirements

For any meaningful change, run:

```bash
npm run lint
npm test
npm run build
npm run qa:academic -- --report-only
npm run qa:academic -- --plan=free --report-only
npm run qa:academic -- --plan=pro --report-only
```

If the task touches demo assets, also run:

```bash
npm run capture:demo
```

If a QA script fails, do not hide the failure by loosening assertions. Diagnose the cause.

QA failure output should be actionable.

## Regression rules

Every task must preserve:

* upload validation;
* single PDF export;
* Free/Pro distinction;
* Batch ZIP flow;
* local-first behavior;
* user report clarity;
* hidden diagnostics;
* demo fallback behavior;
* build/test stability.

Do not make broad refactors unless explicitly requested.

## Implementation style

Prefer:

* small focused components;
* reusable visual systems;
* explicit state machines;
* predictable fallbacks;
* typed data structures;
* deterministic behavior;
* clear file naming;
* meaningful test coverage.

Avoid:

* ad-hoc UI patches;
* hidden state coupling;
* fragile text selectors;
* visual hacks;
* duplicate CTAs;
* overengineering;
* large unrelated rewrites.

## Prompt-response expectations

When completing a task, report:

* files modified;
* what changed;
* what was intentionally not changed;
* tests added or updated;
* commands run;
* command results;
* manual QA limitations;
* exact retest instructions;
* remaining risks.

If something cannot be done safely, say so clearly and explain the blocker.

Never claim success if the actual requested behavior was not implemented.
