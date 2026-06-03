# ComfyPaper Technical Case Study

## Problem

Academic PDFs are designed for print and desktop reading, not small e-reader screens. Dense two-column papers often require zooming, panning, or manual cropping on Kindle-style devices. The apparent task sounds simple: crop margins, split columns, and export a more readable PDF.

The real engineering problem is harder. PDFs are fixed-layout documents. They usually do not expose a reliable article model for titles, abstracts, body text, captions, formulas, figures, tables, footers, or reading order. A browser can render the page, but an optimizer has to infer structure from pixels, text positions, and layout heuristics.

## Initial Hypothesis

The initial product hypothesis was that a local-first web tool could automatically convert dense academic PDFs into reading-friendly layouts for Kindle, iPad, and other reading devices. If the engine proved reliable, full-document export, batch ZIP export, and device-specific presets could become a small paid product.

The benchmark did not support that commercial hypothesis. It showed that the current automatic conversion strategy is not robust enough for mixed real-world academic PDFs. That result redirected the project toward a safer engineering direction: conservative safe mode plus manual review.

## System Design

ComfyPaper is a client-side Next.js application. PDF processing stays local to the browser and is split into three concerns:

- Rendering and analysis with PDF.js and canvas.
- Layout planning with normalized crop rectangles, text-row analysis, and page-level risk signals.
- Vector-preserving export with pdf-lib and optional batch packaging with JSZip.

Core modules:

| Area | Modules |
| --- | --- |
| Validation | `lib/validation/pdfValidation.ts` |
| PDF loading | `lib/pdf/loadPdf.ts` |
| Source preview | `lib/pdf/renderPages.ts` |
| Reading preview | `lib/pdf/renderReadingPreviews.ts` |
| Crop and margin analysis | `lib/pdf/cropDetection.ts`, `lib/pdf/analyzePageMargins.ts` |
| Column and text analysis | `lib/pdf/columnDetection.ts`, `lib/pdf/textLineModel.ts` |
| Reading plans | `lib/pdf/academicReadingPlan.ts`, `lib/pdf/readingTiles.ts`, `lib/pdf/readingProfiles.ts` |
| Coordinate mapping | `lib/pdf/normalizedRects.ts`, `lib/pdf/pdfCoordinateMapping.ts` |
| Export | `lib/pdf/exportColumnReadingPdf.ts`, `lib/pdf/exportCroppedPdf.ts`, `lib/product/exportWorkflow.ts` |
| Batch export | `lib/product/batchExport.ts` |
| Benchmark | `scripts/qa-real-papers.mjs`, `scripts/build-validation-report.mjs` |

## PDF Pipeline

```text
File selection
  -> validate file
  -> load PDF with PDF.js
  -> render source preview canvases
  -> render low-resolution analysis canvas
  -> extract text rows
  -> analyze margins, ink, columns, and page class
  -> build academic reading plan
  -> render transformed preview
  -> export with pdf-lib
  -> optional batch ZIP
```

PDF.js is used for browser loading, preview rendering, canvas-based analysis, and text extraction. The preview path is rasterized because canvases are practical for fast browser feedback. The export path uses pdf-lib so the output can preserve vector text and PDF page content where possible instead of saving preview images.

The most important infrastructure is coordinate mapping. The implementation has to translate between PDF page points, PDF CropBox coordinates, PDF.js viewport coordinates, canvas pixels, normalized crop fractions, and output device page dimensions. This is where many document-processing bugs appear: flipped axes, off-by-one crop margins, preview/export mismatch, and accidental text clipping.

## Benchmark Methodology

The real-paper benchmark uses local PDFs in `qa/pdfs-local/`. These files are gitignored because they may be private, copyrighted, or large.

Methodology:

- Input folder: `qa/pdfs-local/`.
- Report folder: `qa/real-paper-reports/`.
- Dataset: 12 PDFs, 208 source pages.
- Sampling: distributed sampling with up to 10 pages per PDF.
- Presets tested: Academic Paper, Kindle / E-reader, iPad / Tablet.
- Total preset-pages analyzed: 342.
- Classification: acceptable, needs review, or failed.
- Risk signals: clipping, broken/full-width split, complex layout, orphan output pages, single-sentence output pages, low-fill pages, and unreadable Kindle output.
- Manual review: generated `*-review.md` checklists identify worst pages to inspect manually.

The benchmark is intentionally strict and product-readiness oriented. It measures whether the automatic conversion could be trusted as a product promise, not whether the codebase contains meaningful engineering work.

## What Failed

Under the stricter validation rubric, the engine scored **0/100 for product readiness**, which invalidated the monetization hypothesis.

Latest report: `qa/real-paper-reports/pdf-engine-validation-report.md`, generated 2026-06-02.

| Metric | Value |
| --- | ---: |
| PDFs tested | 12 |
| Total source pages | 208 |
| Total preset-pages analyzed | 342 |

| Preset | Acceptable | Needs review | Failed | Pages analyzed | Pages split | Pages preserved |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Academic Paper | 0 | 2 | 10 | 114 | 53 | 79 |
| Kindle / E-reader | 0 | 3 | 9 | 114 | 53 | 102 |
| iPad / Tablet | 0 | 12 | 0 | 114 | 0 | 114 |

Executive verdict: **PIVOT TO SAFE MODE**  
Monetization readiness: **not ready to charge**  
Recommended action: **conservative safe mode + manual review workflow**

The failure is about product readiness. The implementation built a functioning browser PDF pipeline, but the measured output quality was not reliable enough for a commercial automatic optimizer.

## Why It Failed Technically

Mixed-layout pages broke the core assumption that a page can be safely classified as one-column, two-column, or simple margin-crop. Real academic PDFs often mix full-width titles, abstracts, formulas, figures, tables, captions, references, and two-column body text on the same page.

Kindle mode was especially fragile. Narrow output dimensions amplified pagination errors: over-fragmented slices, low-fill pages, orphan output pages, duplicate-looking regions, and crop-boundary risks. Even plausible source-column detection did not guarantee readable Kindle output.

Full-width regions need better preservation. Figures, formulas, and tables often span both columns, and splitting them as body text can produce broken reading pages. Headers and footers also add noise that can distort margin detection and text-row grouping.

The existing risk signals were useful but not sufficient. They surfaced clipping and layout risks, but the engine still accepted too many pages that should have been preserved or sent to manual review.

## Product Decision

ComfyPaper should not be monetized as an automatic academic PDF optimizer in its current form.

The better product direction is narrower and safer:

- Clean margins only when confidence is high.
- Preserve pages with mixed or complex layout.
- Flag high-risk pages for manual review.
- Treat Kindle output as experimental until fragmentation and clipping are controlled.

This decision follows from benchmark evidence rather than positioning preference.

## Lessons Learned

- PDF rendering is easy to demo and hard to make reliable across real documents.
- Visual layout is not semantic reading order.
- Coordinate normalization is core infrastructure in document tooling.
- Device presets change the algorithmic problem; Kindle is not simply a smaller iPad target.
- Safe preservation can be the correct output when the alternative risks clipping or broken layout.
- Benchmarks are product decision tools, not just QA artifacts.
- A negative validation result can be a strong engineering outcome when it leads to a better scope.

## Future Work

- Conservative safe mode as the default export strategy.
- Manual review UI for flagged pages before export.
- Stronger mixed-layout classification for title/body transitions and section changes.
- Better detection of full-width figures, formulas, and tables.
- Larger benchmark suite with explicit acceptance thresholds.
- Kindle / E-reader mode demoted to experimental until output fragmentation is solved.
- Possible integration with established PDF reading workflows instead of replacing the entire reading experience.
