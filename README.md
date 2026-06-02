# PDF Reading Comfort Optimizer

A focused prototype for making uncomfortable PDFs easier to preview for reading comfort workflows.

## Current scope

- Next.js App Router, TypeScript, and Tailwind CSS.
- Client-side PDF validation.
- Browser-only PDF parsing with PDF.js.
- Canvas rendering for the first three pages at preview scale.
- Basic metadata display: file name, file size, total pages, and previewed pages.
- Disabled premium preset cards for planned comfort workflows.
- Minimal before/after layout with original preview and a next-step optimized placeholder.

Files are processed locally in the browser for this prototype. No uploaded file is sent to a server.

## Explicit non-goals

This is not a generic PDF toolkit, PDF editor, PDF reader, dark mode converter, or backend PDF service.

Not implemented in this step:

- Crop
- Dark mode
- Export
- Payment
- Backend processing
- Authentication
- OCR
- Annotations
- Compression
- Merge/split
- AI
- Cloud storage

## Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Landing demo assets

The premium landing demo can use real product PNGs from `public/demo/`. See [DEMO_ASSETS.md](./DEMO_ASSETS.md) for the selected `ASP.pdf` target, asset filenames, and capture guidance.

## Tests

```bash
npm test
```
