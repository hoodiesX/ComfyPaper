# PaperRead Demo Assets

The landing demo should show the real product value: dense academic body pages becoming readable layouts. It should not imply that title pages, cover pages, figures, or complex layouts are always reformatted.

## Source

Place the selected source PDF here:

```text
demo-source/ASP.pdf
```

## Selected Target

Use this exact target for the real landing demo asset:

```text
Preset: Academic Paper
Source page: 1
Output target: Page 1 · left column · tile 2 of 2
```

This target is captured from Academic Paper because the current iPad / Tablet preset preserves full pages and does not create left-column reading tiles. Do not silently substitute a title page, a preserved page, or a different tile. If this target cannot be captured cleanly, document the reason before changing it.

## Expected Assets

Required for the primary real demo:

```text
public/demo/demo-original.png
public/demo/demo-optimized-academic.png
```

Optional device-specific assets:

```text
public/demo/demo-optimized-ipad.png
public/demo/demo-optimized-academic.png
public/demo/demo-optimized-kindle.png
```

The Academic tab uses `demo-optimized-academic.png`. If `demo-optimized-ipad.png` is missing, the iPad tab may reuse the Academic asset inside a tablet preview frame with neutral copy. Do not claim that iPad generated a column split unless the iPad preset actually supports that behavior. The app falls back gracefully when optional assets are missing. If no assets are present, it shows an illustration marked as an illustration.

## Command

Run:

```bash
npm run capture:demo
```

If `demo-source/ASP.pdf` is missing, the command fails with setup instructions. Automated capture is intentionally conservative and must not pick a different page or tile silently.

## Quality Bar

Use a body page, not a title page. Pick a page or tile where the original is dense and the optimized output is clean. Avoid pages with cut title text, heavy figures, awkward preserved layout, or misleading title-page reflow.

Render at high resolution, ideally high-DPR or 220+ DPI equivalent. Do not screenshot the whole browser. Use a clean crop with no browser chrome. Prefer 100% browser zoom and crop/area screenshots only when needed.

## Honesty Rules

The landing may show a representative good output, but it must not imply perfect conversion for every PDF. Keep this product truth visible:

```text
Best with selectable-text academic PDFs. Title pages, figures and complex layouts may be preserved safely.
```
