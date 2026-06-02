# Deploy PaperRead

PaperRead is a local-first Next.js app. It does not need a backend, database, auth service, OCR service, or payment integration for the current beta.

## Recommended: Vercel

Vercel is the simplest deployment target for this codebase because it supports Next.js production builds directly.

1. Push the project to a Git repository.
2. Create a new Vercel project from that repository.
3. Use the default framework preset: `Next.js`.
4. Build command: `npm run build`.
5. Output settings: leave Vercel defaults.
6. Add environment variables:

| Variable | Recommended production value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_PLAN_TIER` | `free` | Use `pro` only for a private Pro preview deployment. |
| `NEXT_PUBLIC_ENABLE_DIAGNOSTICS` | `false` or unset | Keep unset/false in production so developer diagnostics stay hidden. |

7. Deploy.

## Pre-deploy checklist

Run locally before shipping:

```bash
npm run lint
npm test
npm run build
npm run qa:academic -- --report-only
npm run qa:academic -- --plan=free --report-only
npm run qa:academic -- --plan=pro --report-only
```

Optional, when refreshing landing demo screenshots:

```bash
npm run capture:demo
```

This updates:

- `public/demo/demo-original.png`
- `public/demo/demo-optimized-academic.png`
- `lib/product/demoAssetManifest.generated.json`

Commit those generated files before deploying if the landing demo should use the refreshed screenshots.

## Production behavior

- PDF processing runs in the browser.
- User PDFs are not uploaded to a backend by this app.
- Free mode is the default unless `NEXT_PUBLIC_PLAN_TIER=pro` is set.
- Pro mode is only a local/config preview; payments are not connected.
- Column Reading Diagnostics are hidden in production. Do not set `NEXT_PUBLIC_ENABLE_DIAGNOSTICS=true` on a public deployment.

## Verify after deploy

1. Open the deployed site.
2. Confirm the hero and demo images load from `/demo/...`.
3. Confirm the landing demo does not show `Illustration` when real demo assets are present.
4. Upload a PDF and confirm Export Readiness appears.
5. Confirm Column Reading Diagnostics are not visible.
6. In Free deployments, confirm limited export and locked Batch ZIP are clear.
7. In Pro preview deployments, confirm full-document export and Batch ZIP are visible.

## Cloudflare alternative

Cloudflare Pages can host Next.js apps, but this project is not currently configured with an OpenNext/Cloudflare adapter. Use Vercel for the fastest production path. If Cloudflare is required later, add the adapter deliberately and rerun the full pre-deploy checklist.
