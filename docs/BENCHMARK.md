# Benchmark

This benchmark is intentionally strict and product-readiness oriented. It does not score code quality, implementation effort, or architectural value. It measures whether the current automatic PDF layout conversion engine is reliable enough to be trusted on mixed real-world academic PDFs.

The latest result is useful because it invalidated the automatic commercial optimizer hypothesis and pointed to a safer direction: conservative safe mode plus manual review.

## How To Run

Add local PDFs:

```text
qa/pdfs-local/
```

Run:

```bash
npm run qa:real-papers
```

The script writes reports to:

```text
qa/real-paper-reports/
```

Both folders are gitignored.

## What The Benchmark Measures

- Whether presets can process sampled pages without severe automated risk signals.
- Whether pages are split, preserved, or marked for review.
- Whether output risks include clipping, broken full-width splits, orphan pages, low-fill pages, or unreadable Kindle output.
- Whether the engine is ready to support a product claim around automatic academic PDF optimization.

It does not claim that every flagged page is visually broken. Automated warnings are risk signals that identify pages needing manual inspection.

## What The Benchmark Does

- Loads each PDF from `qa/pdfs-local/`.
- Tests Academic Paper, Kindle / E-reader, and iPad / Tablet presets.
- Samples distributed pages, up to 10 pages per PDF.
- Executes browser-side QA hooks against the real application pipeline.
- Records page-level risk signals and preset-level classifications.
- Writes JSON summaries, Markdown summaries, and manual review checklists.

## How To Interpret Reports

Classifications:

- **Acceptable**: no major automated risk signals for the sampled pages.
- **Needs review**: output may be usable, but warnings or preservation behavior require manual inspection.
- **Failed**: severe automated risk signals indicate the preset should not be trusted for that file.

The score is a product-readiness score for automatic conversion. It is not a judgment that the browser PDF pipeline, coordinate mapping, export path, or benchmark tooling are absent or low quality.

## Latest Result Summary

Source report: `qa/real-paper-reports/pdf-engine-validation-report.md`, generated 2026-06-02.

| Metric | Value |
| --- | ---: |
| PDFs tested | 12 |
| Total source pages | 208 |
| Total preset-pages analyzed | 342 |
| Presets tested | Academic Paper, Kindle / E-reader, iPad / Tablet |

| Decision | Result |
| --- | --- |
| Executive verdict | **PIVOT TO SAFE MODE** |
| Product-readiness score under strict rubric | **0/100** |
| Monetization readiness | **not ready to charge** |
| Recommended next action | **conservative safe mode + manual review workflow** |

Preset breakdown:

| Preset | Acceptable | Needs review | Failed | Pages analyzed | Pages split | Pages preserved |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Academic Paper | 0 | 2 | 10 | 114 | 53 | 79 |
| Kindle / E-reader | 0 | 3 | 9 | 114 | 53 | 102 |
| iPad / Tablet | 0 | 12 | 0 | 114 | 0 | 114 |

## Useful Verdict

- The project is **not ready to charge** as an automatic academic PDF optimizer.
- The recommended direction is **conservative safe mode** with explicit manual review.
- Kindle / E-reader should not be the main paid promise until fragmentation, low-fill output, and clipping risks are controlled.
- Academic Paper mode needs safer fallback behavior and stronger review UX before it can be presented as reliable.
- iPad / Tablet behavior was safer mainly because it preserved pages conservatively, not because the automatic optimizer solved mixed layouts.

## Engineering Interpretation

The benchmark result shows a product-scope problem, not an absence of technical work. The implementation built a local-first browser PDF pipeline, but the strict readiness rubric showed that automatic conversion is unreliable on mixed academic documents.

The appropriate next step is to narrow the promise: make safe improvements when confidence is high, preserve complex pages, and ask users to review high-risk output.
