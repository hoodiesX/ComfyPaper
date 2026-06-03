# ComfyPaper

Experimental local-first academic PDF optimizer and PDF layout-analysis prototype.

**Status: Experimental engineering prototype — not production-ready.**

ComfyPaper explores whether dense academic PDFs can be made easier to read on e-readers and tablets using only browser-local processing. The project combines PDF.js rendering, layout analysis, vector-preserving pdf-lib export, device-oriented presets, batch ZIP export, and real-world benchmark validation.

Benchmark outcome: **initial automatic-reflow hypothesis invalidated.** The current engine is technically interesting, but the validation results show it is not robust enough to sell as a fully automatic PDF optimizer.

## Why This Project Is Technically Interesting

- Client-side PDF rendering and preview generation.
- PDF.js loading, worker setup, canvas rendering, and text extraction.
- pdf-lib export that preserves vector PDF content where possible.
- Normalized coordinate mapping across canvas pixels, PDF page points, crop fractions, and output page dimensions.
- Column and layout analysis for academic paper pages.
- Local-first processing with no required upload server.
- Batch ZIP export for multiple PDFs.
- Benchmark automation against real academic PDFs.
- Failure-mode analysis for clipping, mixed layouts, low-fill pages, and fragile Kindle output.

## What It Does

ComfyPaper validates an uploaded PDF, renders source previews in the browser, attempts margin cleanup and column-aware reading layouts, shows a before/after preview, exports transformed PDFs with pdf-lib, and can package multiple outputs into a ZIP. When a page appears risky, the planner can preserve it or flag it for review instead of silently treating every conversion as safe.

This is not a production PDF optimizer, not a generic PDF editor, and not a reliable universal Kindle/iPad converter.

## Key Features

- Local-first PDF processing.
- Academic Paper mode for dense research papers and technical documents.
- Kindle / E-reader and iPad / Tablet presets.
- Safe crop and column reading preview.
- Vector-preserving PDF export using CropBox or derived source-region layouts.
- Batch ZIP export workflow.
- User-facing optimization report with optimized, preserved, and review pages.
- Real-paper benchmark workflow with generated reports and manual review checklists.

## Validation Outcome

The benchmark showed that real academic PDFs are harder than the initial product hypothesis assumed. Papers often mix two-column body text with full-width titles, formulas, figures, tables, references, headers, footers, and irregular spacing. Those cases make automatic reflow fragile.

The result is an engineering decision: ComfyPaper should not be positioned as an automatic commercial PDF optimizer in its current form. The more credible direction is conservative safe mode plus manual review, where the tool makes simple safe improvements, preserves complex pages, and surfaces pages that need inspection.

Detailed results are documented in [docs/BENCHMARK.md](docs/BENCHMARK.md).

## What This Demonstrates

- Ability to build non-trivial browser-based document tooling.
- Ability to design a PDF analysis and export pipeline across multiple coordinate systems.
- Ability to benchmark against real inputs instead of relying on polished demos.
- Ability to identify product and engineering limitations honestly.
- Ability to make technical tradeoff decisions from measured evidence.

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

## Benchmark Details

The benchmark invalidated the initial product hypothesis: fully automatic reflow of arbitrary academic PDFs is not reliable enough for a paid product in the current version.

This is not presented as a production-ready SaaS. ComfyPaper is an engineering prototype and case study focused on browser-based PDF rendering, layout analysis, vector-preserving export, batch processing, and benchmark-driven validation.

The main technical conclusion is that a safer future direction would be:

- conservative layout optimization;
- preserving complex pages by default;
- manual review before export;
- demoting Kindle output to experimental until the engine is more robust.

Detailed benchmark results and failure analysis are documented in `docs/CASE_STUDY.md` / `docs/BENCHMARK.md`.
## Important Limitations

- Automatic academic PDF reflow is hard because PDFs are fixed-layout documents, not semantic article data.
- Mixed layouts with formulas, figures, tables, full-width sections, headers, and footers can break margin and column assumptions.
- Kindle / E-reader mode is especially fragile because narrow output pages amplify fragmentation, low-fill pages, and clipping risk.
- The current engine should be evaluated as a technical prototype and case study, not as a finished product.

## Case Study

The full technical case study covers the product hypothesis, browser PDF pipeline, coordinate mapping problems, benchmark methodology, failure analysis, and resulting product decision.

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

## Future Direction

- Conservative safe mode as the default behavior.
- Manual review mode for pages with high layout risk.
- Stronger mixed-layout detection for title/body transitions, formulas, figures, tables, and full-width regions.
- Demote Kindle / E-reader mode to experimental until fragmentation and clipping risks are controlled.
- Larger benchmark dataset with clearer acceptance thresholds.
