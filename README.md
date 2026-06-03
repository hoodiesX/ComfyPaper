# ComfyPaper

Experimental local-first academic PDF reading optimizer for making dense research papers easier to read on e-readers and tablets.

## Status

**Experimental prototype / engineering case study. Not production-ready.**

ComfyPaper is not a successful SaaS, not a production PDF optimizer, and not a reliable universal Kindle or iPad converter. It is best understood as an experimental local-first academic PDF reading optimizer and PDF layout analysis prototype.

The project value is technical: it explores browser-based PDF rendering, PDF.js analysis, pdf-lib export, coordinate mapping, crop and column layout heuristics, batch ZIP export, and benchmark-driven validation on real academic PDFs.

## What It Does

ComfyPaper processes PDFs locally in the browser. It validates an uploaded PDF, renders preview pages with PDF.js, attempts margin cleanup and column-aware reading layouts, shows a before/after preview, exports a vector-preserving PDF with pdf-lib, and can package multiple outputs into a ZIP. When a page appears risky, the engine attempts to preserve it or flag it for review instead of silently pretending the conversion is safe.

## Key Features

- Local-first PDF processing with no required upload server.
- Academic Paper mode for dense research papers and technical documents.
- Kindle / E-reader and iPad / Tablet reading presets.
- Safe crop and column reading preview.
- Vector-preserving PDF export using CropBox or derived page layouts.
- Batch ZIP export workflow.
- User-facing optimization report with optimized, preserved, and review pages.
- Real-paper benchmark workflow for measuring failures instead of relying on demos.

## Technical Highlights

- PDF.js rendering pipeline for browser previews and canvas-based page analysis.
- pdf-lib export pipeline for preserving vector text where possible.
- Normalized coordinate mapping between canvas pixels, PDF coordinates, crop fractions, and output pages.
- Text and ink-based layout analysis for margins, columns, and reading regions.
- Column detection, page classification, risk scoring, and conservative preserve behavior.
- Client-side performance constraints around PDF workers, canvas memory, and preview limits.
- Playwright/QA automation hooks for running real-paper benchmark checks.
- Benchmark-driven validation with generated reports and manual review checklists.

## Architecture Overview

```text
Upload PDF
  -> validate file
  -> load and render pages with PDF.js
  -> analyze margins, ink, text rows, columns, and page risk
  -> plan crop or reading transforms
  -> preview transformed pages in the browser
  -> export vector-preserving PDF with pdf-lib
  -> optionally package batch outputs with JSZip
  -> run QA benchmark and generate reports
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Benchmark Summary

Latest validation report: `qa/real-paper-reports/pdf-engine-validation-report.md` generated on 2026-06-02.

| Metric | Result |
| --- | --- |
| Executive verdict | **PIVOT TO SAFE MODE** |
| Overall score | **0/100** |
| Monetization readiness | **not ready to charge** |
| Recommended action | **conservative safe mode + manual review workflow** |
| PDFs tested | 12 |
| Source pages | 208 |
| Preset-pages analyzed | 342 |

Preset results:

| Preset | Acceptable | Needs review | Failed |
| --- | ---: | ---: | ---: |
| Academic Paper | 0 | 2 | 10 |
| Kindle / E-reader | 0 | 3 | 9 |
| iPad / Tablet | 0 | 12 | 0 |

This is a negative product result but a useful engineering result. The project includes measurement and failure analysis instead of hiding weak cases behind a polished demo. The benchmark shows that the current engine is not ready to be sold as an automatic universal optimizer.

Benchmark details: [docs/BENCHMARK.md](docs/BENCHMARK.md)

## Important Limitations

- Automatic academic PDF reflow is hard. PDFs are fixed-layout documents, not semantic article data.
- Mixed layouts with formulas, figures, tables, full-width sections, headers, and footers can break the assumptions behind margin and column detection.
- Kindle / E-reader mode is especially fragile because narrow output pages amplify fragmentation, low-fill pages, and clipping risk.
- The current benchmark result shows the engine is not reliable enough to monetize as a fully automatic optimizer.
- The project should be evaluated as a technical prototype and engineering case study, not as a finished product.

## Case Study

The full technical case study covers the product hypothesis, browser PDF pipeline, coordinate mapping problems, benchmark methodology, failure analysis, and product decision.

Read it here: [docs/CASE_STUDY.md](docs/CASE_STUDY.md)

## How To Run Locally

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

Then open `http://localhost:3000`.

To run the real-paper benchmark, add local PDFs to `qa/pdfs-local/` and run:

```bash
npm run qa:real-papers
```

Local benchmark PDFs and generated real-paper reports are gitignored because they may contain private or large documents.

## Repository Hygiene

- Local PDFs: `qa/pdfs-local/` is gitignored.
- Generated benchmark reports: `qa/real-paper-reports/` is gitignored.
- Generated screenshots, ZIPs, and exported PDFs are gitignored.
- Source code and tests remain the portable part of the repository.

## What I Learned

- PDF layout is much harder than it looks because visual structure and reading order are not reliably encoded.
- Product quality requires benchmarks on real documents, not just a few successful demos.
- Safe fallback and page preservation matter more than aggressive transformation when clipping risk is high.
- Honest validation can invalidate a monetization idea, and that is a useful engineering outcome.
- A future version should prioritize conservative safe mode and manual review before promising automatic conversion.

## Future Work

- Conservative safe mode as the default behavior.
- Manual review UI for pages with high layout risk.
- Better mixed-layout detection for title/body transitions and section changes.
- Stronger formula, figure, table, and full-width region detection.
- Larger benchmark suite with clearer acceptance criteria.
- Demote Kindle / E-reader mode to experimental until it is robust.
