# Finance With Phil — Social Media Analytics

PIN-gated analytics dashboard for Phillip Karaya / Finance With Phil's
cross-platform content (Instagram, TikTok, YouTube, Threads).

**Live:** https://phillipkaraya.github.io/fwp-analytics-dashboard/
(PIN-gated; the PIN is not stored in this repo.)

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4 with `@theme` design tokens
- shadcn/ui components on top of Base UI
- Recharts for line / bar / doughnut charts (custom 7×24 heatmap)
- Zustand with `localStorage` persistence for client-side state
- System font stack (sans / mono) with the FWP light-blue palette
- Static export to GitHub Pages (no SSR)
- Python scraper + analyzer in `scrape/` (see `scrape/README.md`)

## Project layout

```
app/                     Next.js App Router routes (one per tab)
components/
  charts/                Reusable primitives — KpiCard, LineChart,
                         BarChart, DoughnutChart, PlatformBadge, Section
  layout/                AppShell, Nav, AuthGate, PinWall, DataStatusBar,
                         ScrapeDialog (Refresh data)
  overview/              Overview tab (KPIs, platform charts, top posts)
  posts/, comments/      Post Analysis and Comments tabs
  insights/              Insights tab (12 sections from analytics.json)
  vault/                 Content Vault tab (posts grouped by topic)
  deals/                 Brand Deals tab (Zustand-only)
  content-analyzer/      Local Video Vision integration (localhost:3001)
  montage/               OpenMontage Studio integration (localhost:8484)
lib/
  data.ts                Typed JSON loaders for /public/data/*
  derive.ts              Pure helpers (totals, byPlatform, cadence, etc.)
  store.ts               Zustand store with localStorage persistence
  auth.ts                SHA-256 PIN check (Web Crypto API)
  format.ts              fmt(), fmtPct(), fmtDate(), platformLabel
  scrape-client.ts       Client for scrape/server.py (Refresh data button)
  types.ts               Shared TypeScript types (mirror the JSON shapes)
scrape/                  Python scraper, analyzer, topic map — scrape/README.md
public/data/             Real scraped JSON data (read-only at runtime)
v1-archive/              Original single-file dashboard preserved as-is
```

## Local development

```bash
pnpm install
pnpm dev               # http://localhost:3000
pnpm build             # static export to out/
pnpm lint
```

The PIN gate falls back to the v1 PIN in development. To override, set
`NEXT_PUBLIC_DASHBOARD_PIN_HASH` (SHA-256 hex) in `.env.local`.

## Refreshing data

The dashboard reads `public/data/*.json` at runtime via fetch. To
update, with the shared Chrome running and logged in:

```bash
python3 scrape/run.py            # incremental: only new posts
python3 scrape/run.py --full     # master sweep: refresh every post
git add public/data && git commit -m "Refresh data" && git push
```

`run.py` scrapes, then regenerates `analytics.json`, `content_vault.json`
and `follower_history.json`. GitHub Pages redeploys in about a minute.
Full details, including how the incremental stop works, are in
`scrape/README.md`.

## Optional local tools

Two tabs integrate with local services and degrade gracefully when they
are offline: Content Analyzer (Video Vision API on `localhost:3001`) and
Montage Studio (OpenMontage on `localhost:8484` or a Cloudflare tunnel).
The Refresh data button talks to `scrape/server.py` on `localhost:5556`.

## Deploy

GitHub Actions workflow at `.github/workflows/deploy.yml` builds and
publishes to GitHub Pages on every push to `main`. Set the
`DASHBOARD_PIN_HASH` repository secret to override the default PIN.
