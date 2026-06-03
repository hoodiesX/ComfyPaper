# ComfyPaper Technical Case Study

## 1. Problem Statement

Academic PDFs are usually designed for print or large desktop screens. Many papers use dense two-column layouts, small type, narrow gutters, equation blocks, figures, tables, footnotes, headers, and page numbers. On small screens, especially e-readers, the reader often has to zoom, pan, rotate, or manually crop pages.

The hard part is that a PDF does not reliably expose article structure. A browser can render the page, but the document may not say which text belongs to the title, abstract, body columns, captions, formulas, or references. Any automatic optimizer has to infer layout from pixels, text positions, and imperfect heuristics.

## 2. Initial Product Hypothesis

The initial hypothesis was that a local-first web tool could convert dense academic PDFs into reading-friendly layouts for Kindle, iPad, and other reading devices. If it worked reliably, it might become a small paid product around full-document export, batch ZIP export, and device-specific presets.

The benchmark invalidated the monetization assumption for the current engine. The better conclusion is that this is a serious engineering prototype, not a product ready to charge for.

## 3. System Design

ComfyPaper is a client-side Next.js application. The PDF workflow is intentionally local-first:

```text
File selection
  -> file validation
  -> PDF.js document loading
  -> canvas rendering for preview and analysis
  -> margin, text-row, and column analysis
  -> academic reading plan generation
  -> preview rendering
  -> pdf-lib export
  -> optional JSZip batch packaging
```

Important modules include:

- `lib/validation/pdfValidation.ts` for file checks.
- `lib/pdf/loadPdf.ts` for PDF.js loading and worker setup.
- `lib/pdf/renderPages.ts` for original previews.
- `lib/pdf/renderReadingPreviews.ts` for analysis and transformed previews.
- `lib/pdf/cropDetection.ts` and `lib/pdf/analyzePageMargins.ts` for margin and ink analysis.
- `lib/pdf/columnDetection.ts` and `lib/pdf/textLineModel.ts` for column and text-row signals.
- `lib/pdf/academicReadingPlan.ts` for reading-region planning and quality signals.
- `lib/pdf/pdfCoordinateMapping.ts` and `lib/pdf/normalizedRects.ts` for coordinate conversion.
- `lib/pdf/exportColumnReadingPdf.ts` and `lib/pdf/exportCroppedPdf.ts` for pdf-lib export.
- `lib/product/batchExport.ts` for ZIP export.
- `scripts/qa-real-papers.mjs` and `scripts/build-validation-report.mjs` for benchmark reporting.

## 4. Core Engineering Challenges

### PDF Coordinate Systems

The app has to move between several coordinate spaces: PDF page points, PDF CropBox coordinates, PDF.js viewport coordinates, canvas pixels, normalized crop fractions, and output device page dimensions. Small mistakes can flip the vertical axis, crop the wrong edge, or produce output that looks correct in preview but clips in export.

### Canvas Rendering vs Vector Export

Canvas previews are raster images. A quick implementation could export those images, but that would degrade text quality and increase output size. ComfyPaper instead uses canvas for analysis and preview, then uses pdf-lib to embed source page regions into a new PDF or apply CropBox changes. That keeps text and vector content where possible, but it requires more precise coordinate mapping.

### Two-Column Detection

Academic body pages often have two clean columns, but real papers also include titles, abstracts, author lists, figures, tables, equations, captions, and references. The engine combines ink analysis and extracted text rows to decide when a page can be split and when it should be preserved.

### Mixed-Layout Pages

The most difficult pages are not purely one-column or two-column. A first page might contain a full-width title and abstract followed by two-column body text. A later page might contain a full-width figure, table, or equation between two-column regions. These cases break simple assumptions about column boundaries and reading order.

### Formulas, Figures, and Tables

Formulas and tables may look like text but should not be split like body paragraphs. Figures and captions may span columns. The current detector has risk signals for complex-layout pages, but the benchmark shows those signals are not strong enough for reliable automatic conversion.

### Header and Footer Noise

Headers, footers, page numbers, conference labels, and copyright lines create extra ink and text rows. They can distort margin detection, text-line grouping, and tile boundaries.

### Avoiding Text Clipping

The most important safety failure is clipping text. The engine tracks crop-boundary validation, missing rows, duplicate pages, low-fill pages, and Kindle-specific readability risks, but the latest benchmark still found severe failure modes.

### Client-Side Performance

All processing runs in the browser. The implementation limits preview pages, caps device pixel ratio, renders lower-resolution analysis canvases, and avoids server processing. This keeps the prototype local-first but constrains how much analysis can run interactively.

## 5. Implementation Details

### File Validation

The validation layer rejects unsupported or unsafe inputs before PDF.js parsing. PDF.js loading maps common errors such as invalid, missing, encrypted, or corrupted PDFs into user-safe messages.

### PDF Loading

`loadPdf` imports `pdfjs-dist`, configures the worker, copies the uploaded file buffer to avoid detached ArrayBuffer reuse, and returns a `PDFDocumentProxy` plus metadata.

### Rendering Previews

Original previews are rendered with PDF.js into canvas at a bounded scale. Optimized previews are rendered from detected crop regions so the user can compare source pages with proposed reading pages before export.

### Margin Analysis

The crop detector renders a low-resolution analysis canvas, reads pixel data, and estimates safe margin cleanup. Margins are stored as normalized fractions so they can be reused across preview and export.

### Column Detection

Column mode combines visual ink patterns, text-row extraction from PDF.js text content, preset constraints, and page classification. The planner can create column-reading output pages or preserve a page when the split looks risky.

### Reading Transform Planning

The academic planner builds source-page plans and output-page plans. It classifies regions, computes crop fractions, creates per-region output pages, validates crop progression, assigns quality issues, and records whether pages were optimized, preserved, or marked for review.

### Export

The export path uses pdf-lib. Margin-only pages can use PDF CropBox changes. Column-reading pages are exported by embedding source page regions into new output pages sized for the selected reading profile. This avoids raster-only export and preserves vector text where possible.

### Batch ZIP

Batch export processes files sequentially, tracks per-file status, writes successful PDFs into a JSZip archive, and includes a human-readable batch summary. Failed files are recorded without aborting the entire batch.

### Benchmark Automation

The real-paper QA script starts or connects to the app, loads PDFs from `qa/pdfs-local/`, runs preset checks through browser-side QA hooks, samples up to 10 distributed pages per PDF, writes JSON and Markdown reports, and generates manual review checklists.

## 6. Benchmark Methodology

The latest benchmark used local academic PDFs in `qa/pdfs-local/`. These files are intentionally gitignored because benchmark PDFs may be private, copyrighted, or large.

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

Automated warnings are treated as risk signals, not proof that every flagged page is visually broken.

## 7. Benchmark Results

Latest report: `qa/real-paper-reports/pdf-engine-validation-report.md`, generated 2026-06-02.

Executive verdict: **PIVOT TO SAFE MODE**  
Overall score: **0/100**  
Monetization readiness: **not ready to charge**  
Recommended action: **pivot to conservative safe mode + manual review workflow**

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

The iPad preset avoided severe failures in the automated report largely by preserving pages conservatively, not by producing a high-quality automatic transformation. Academic and Kindle modes produced too many severe risks to be considered product-ready.

## 8. Failure Analysis

Mixed layouts broke the simple model of "detect two columns, split columns, export readable pages." Many real pages contain full-width regions, formulas, figures, or tables interleaved with column text.

Kindle mode was the weakest preset. Narrow output dimensions caused over-fragmentation, low-fill output pages, orphan pages, and unreadable slices. Even when the source column detection was plausible, the derived Kindle pages were often too fragile.

Full-width sections and figures need either stronger preservation logic or direct manual control. A fully automatic converter cannot safely assume that every detected vertical gap is a reading break.

The strict automatic conversion approach is not reliable enough. The benchmark supports a pivot toward conservative safe mode: clean margins when safe, preserve complex pages, and ask the user to review high-risk pages.

## 9. Product Decision

The project should not be monetized as an automatic PDF optimizer in its current form.

The better path is conservative safe mode plus manual review. That product would make a narrower promise: detect simple safe improvements, preserve risky pages, and give users enough visibility to decide whether an exported PDF is acceptable.

## 10. Why The Project Is Still Technically Valuable

This is not a toy CRUD app. It tackles a difficult document-layout problem inside browser constraints:

- It builds a non-trivial PDF.js rendering and analysis pipeline.
- It keeps processing local-first.
- It separates raster preview from vector-preserving export.
- It handles normalized coordinate mapping across preview, analysis, and PDF export.
- It implements column and crop heuristics with risk classification.
- It includes batch ZIP export and user-facing reports.
- It validates the engine against real academic PDFs.
- It documents a negative benchmark result and turns that result into an engineering decision.

For a portfolio, the value is the quality of the engineering exploration: building, measuring, finding limits, and deciding what should change next.

## 11. Lessons Learned

- PDF rendering is easy to demo and hard to make reliable.
- Visual layout is not the same as semantic reading order.
- Coordinate normalization must be treated as core infrastructure, not a helper detail.
- Device presets change the problem. Kindle output is not just "smaller iPad output."
- A safe preserve decision can be better than an impressive but risky transform.
- Benchmarks are product tools, not just QA tools.
- Honest failure analysis can prevent a bad product decision.

## 12. Next Steps If Continued

- Make conservative safe mode the default.
- Add a manual review UI for risky pages before export.
- Improve mixed-layout classification, especially title/body transitions.
- Detect full-width figures, formulas, and tables more explicitly.
- Expand the benchmark suite and define acceptance thresholds before product claims.
- Keep Kindle / E-reader mode experimental until fragmentation and clipping risks are controlled.
- Consider integration with established PDF reading or annotation tools instead of trying to replace a full reading workflow.
