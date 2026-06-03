# Benchmark

ComfyPaper includes a real-paper benchmark workflow so the PDF engine can be evaluated against academic PDFs instead of only polished demos.

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

Important: automated warnings are risk signals, not visual proof. The generated review checklists identify the first pages worth inspecting manually.

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
| Overall score | **0/100** |
| Monetization readiness | **not ready to charge** |
| Recommended next action | **conservative safe mode + manual review workflow** |

Preset breakdown:

| Preset | Acceptable | Needs review | Failed | Pages analyzed | Pages split | Pages preserved |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Academic Paper | 0 | 2 | 10 | 114 | 53 | 79 |
| Kindle / E-reader | 0 | 3 | 9 | 114 | 53 | 102 |
| iPad / Tablet | 0 | 12 | 0 | 114 | 0 | 114 |

## Engineering Interpretation

The current engine should not be sold as a fully automatic academic PDF optimizer. Academic and Kindle presets produced too many severe risk signals, and Kindle output was especially fragile. The iPad preset avoided severe failures by preserving pages conservatively, which is safer but not the same as successful automatic optimization.

The benchmark supports a narrower future direction: conservative safe mode, explicit manual review, and stronger layout classification before any product claim.
