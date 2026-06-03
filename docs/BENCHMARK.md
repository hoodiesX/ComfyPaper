# Benchmark

This benchmark is intentionally strict and product-readiness oriented.

It does **not** score code quality, implementation effort, architectural value, or the usefulness of the prototype as an engineering case study. It measures one specific question:

> Is the current automatic PDF layout conversion engine reliable enough to support a paid product claim on mixed real-world academic PDFs?

The latest benchmark result is valuable because it invalidated the original automatic commercial optimizer hypothesis and pointed to a safer engineering direction: conservative safe mode plus manual review.

## Why This Benchmark Matters

Academic PDFs are not simply “two-column documents”. Real papers often contain:

* full-width titles and author blocks;
* abstracts and section headers;
* equations;
* figures and tables;
* footers and headers;
* references;
* mixed single-column and two-column regions;
* asymmetric columns;
* publisher-specific layouts.

A demo can look good on a small number of hand-picked PDFs. A useful product needs to survive a broader set of real documents. This benchmark was added to avoid judging the engine only from successful examples.

## How To Run

Add local PDFs to:

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

Both folders are gitignored because benchmark PDFs and generated reports may be large, private, or copyrighted.

## What The Benchmark Measures

The benchmark checks whether each preset can process sampled pages without severe automated risk signals.

It tracks:

* whether pages are split, preserved, or marked for review;
* possible clipping risks;
* possible full-width content handling risks;
* possible figure, table, formula, or complex-layout risks;
* orphan pages;
* low-fill pages;
* unreadable Kindle output;
* preset-level readiness;
* file-level risk classification.

It does not claim that every flagged page is visually broken. Automated warnings are risk signals that identify pages needing manual inspection.

## What The Benchmark Does

The benchmark:

* loads each PDF from `qa/pdfs-local/`;
* tests Academic Paper, Kindle / E-reader, and iPad / Tablet presets;
* samples distributed pages, up to 10 pages per PDF;
* executes browser-side QA hooks against the real application pipeline;
* records page-level risk signals and preset-level classifications;
* writes JSON summaries, Markdown summaries, and manual review checklists.

## How To Interpret Reports

Classifications:

* **Acceptable**: no major automated risk signals for the sampled pages.
* **Needs review**: output may be usable, but warnings or conservative preservation require manual inspection.
* **Failed**: severe automated risk signals indicate the preset should not be trusted for that file.

The score is a **strict product-readiness score for automatic conversion**. It is not a general judgment of the repository’s technical value.

A low score means:

> The current engine is not reliable enough to sell as an automatic academic PDF optimizer.

It does **not** mean:

> The rendering pipeline, export pipeline, QA system, or architecture have no technical value.

## Latest Result Summary

Source report: `qa/real-paper-reports/pdf-engine-validation-report.md`, generated 2026-06-02.

| Metric                      |                                            Value |
| --------------------------- | -----------------------------------------------: |
| PDFs tested                 |                                               12 |
| Total source pages          |                                              208 |
| Total preset-pages analyzed |                                              342 |
| Presets tested              | Academic Paper, Kindle / E-reader, iPad / Tablet |

| Decision                       | Result                                              |
| ------------------------------ | --------------------------------------------------- |
| Executive verdict              | **PIVOT TO SAFE MODE**                              |
| Strict product-readiness score | **0/100**                                           |
| Monetization readiness         | **not ready to charge**                             |
| Recommended next action        | **conservative safe mode + manual review workflow** |

Preset breakdown:

| Preset            | Acceptable | Needs review | Failed | Pages analyzed | Pages split | Pages preserved |
| ----------------- | ---------: | -----------: | -----: | -------------: | ----------: | --------------: |
| Academic Paper    |          0 |            2 |     10 |            114 |          53 |              79 |
| Kindle / E-reader |          0 |            3 |      9 |            114 |          53 |             102 |
| iPad / Tablet     |          0 |           12 |      0 |            114 |           0 |             114 |

## Useful Verdict

The benchmark invalidated the idea that the current system is ready to be sold as a fully automatic academic PDF optimizer.

Main conclusions:

* The project is **not ready to charge** as an automatic converter.
* The recommended direction is **conservative safe mode** with explicit manual review.
* Kindle / E-reader should not be the main paid promise until fragmentation, low-fill output, and clipping risks are controlled.
* Academic Paper mode needs safer fallback behavior and stronger review UX before it can be presented as reliable.
* iPad / Tablet behavior was safer mainly because it preserved pages conservatively, not because the automatic optimizer solved mixed layouts.

## Engineering Interpretation

The benchmark result shows a **product-scope limitation**, not an absence of technical work.

The implementation built a local-first browser PDF pipeline with:

* PDF loading and rendering;
* margin and layout analysis;
* column-aware transform planning;
* preview generation;
* vector-preserving PDF export;
* batch ZIP export;
* automated browser-based benchmarking.

The benchmark showed that the automatic conversion strategy is not robust enough on mixed academic documents. This is an important engineering result: the correct next step is not more marketing polish, but a narrower and safer product promise.

## Future Direction

A more realistic version of the product would prioritize:

* safe margin cleanup;
* conservative column splitting only when confidence is high;
* preservation of complex pages;
* explicit review warnings;
* manual review controls;
* per-page user decisions before export;
* larger benchmark coverage before any paid launch.

The safer product claim would be:

> A local-first academic PDF reading preparation tool that safely cleans margins, splits simple body pages when confidence is high, preserves complex layouts, and highlights pages that need review.

## Final Takeaway

The benchmark prevented the project from being presented dishonestly as a production-ready commercial optimizer.

That is the main value of this validation step: it turned a visually promising prototype into a measured engineering case study with clear failure modes, product constraints, and a realistic technical roadmap.
