@AGENTS.md

# FWP Analytics Dashboard — project brain

## What this is
The Finance With Phil social media analytics dashboard. Originally a
single 5,109-line `index.html` rebuilt as Next.js 16 + Tailwind v4 +
shadcn/ui in April 2026 (see `v1-archive/` for the original).

## Stack
- Next.js 16 App Router · TypeScript · Tailwind v4 · shadcn/ui
- Recharts (line/bar/doughnut). Custom 7×24 heatmap is hand-rolled.
- Zustand + localStorage persistence (key: `fwp_dashboard_v2`)
- Static export → GitHub Pages
- System font stack (the self-hosted Newsreader/Geist load was reverted
  in April 2026; `font-display` maps to the sans stack)
- Python `scrape/` pipeline: scrapers → `analyze.py` → derived JSON

## Tabs (and where they live)
| Tab | Route | Component | Reads from |
|---|---|---|---|
| Overview | `/` | `components/overview/overview.tsx` | posts × 4, comments, scrape_state |
| Post Analysis | `/posts` | `components/posts/posts.tsx` | posts × 4 |
| Comments | `/comments` | `components/comments/comments.tsx` | comments |
| Insights | `/insights` | `components/insights/insights.tsx` | analytics, follow_data |
| Content Vault | `/vault` | `components/vault/vault.tsx` | content_vault + posts × 4 |
| Brand Deals | `/deals` | `components/deals/deals.tsx` | Zustand only |
| Content Analyzer | `/content-analyzer` | `components/content-analyzer/content-analyzer.tsx` | local Video Vision API (:3001) |
| Montage Studio | `/montage` | `components/montage/montage.tsx` | local OpenMontage (:8484) or tunnel |

`/creators` still builds but is not in the nav (removed 2026-04-26).

## Design system (don't drift)
- Background: `#eaf3fb` (light brand blue) — non-negotiable, this is THE brand move
- Brand: `#1e6fd9` blue, used as the single dominant accent
- Surfaces: white (`#ffffff`) cards on the blue background
- Text: `#0a1628` ink, `#334155` soft, `#64748b` muted
- Positive `#16a34a`, Negative `#dc2626`, Warn `#d97706` — sparse use only
- Per-platform colors: IG `#c13584`, TT `#111111`, YT `#cc0000`, TH `#0a1628`
- Display font: **Newsreader** (italic for emphasis on "Analytics" word)
- Body: **Geist Sans**
- Mono: **JetBrains Mono** for eyebrows, KPI labels, data, hashtags
- Card borders: 8px radius. Data tables: **0px radius** — sharp.
- KPI numbers use `tabular` class for tabular figures.

When extending: don't add new accent colors without checking the
palette first. The whole point of this rebuild was escaping the v1 AI
slop palette (`#6c5ce7` purple).

## Data
- All JSON in `public/data/` is real. Posts come from `scrape/`, the
  comments and follow data are the 2026-03-28 snapshot (not re-scraped yet).
- Schema is documented in `lib/types.ts`.
- The dashboard reads via `fetch()` at runtime — no build-time data
  embedding. Push new JSON files and the live site picks them up.
- **Refresh:** `python3 scrape/run.py` (incremental) or `--full` (master
  sweep). It uses the already-running shared Chrome on :9222 and opens its
  own tabs; never relaunch Chrome for it. Then commit `public/data/` and
  push. Details in `scrape/README.md`.
- **Derived files are generated, never hand-edited:** `analytics.json`
  (all Insights sections), `content_vault.json` (Vault topics) and
  `follower_history.json` come from `scrape/analyze.py`. Change the
  computation there; change topics in `scrape/categories.json`.
- The original v1 analytics generator was lost; `analyze.py` is its
  replacement and reproduces the v1 numbers where the inputs are the same.

## PIN gate
- SHA-256 client-side check (Web Crypto API), sessionStorage flag.
- Hash configured via `NEXT_PUBLIC_DASHBOARD_PIN_HASH`. Falls back to
  the hashed v1 PIN so dev works without env config. This repo is
  public: never write the PIN itself into any tracked file.
- Set the GH repo secret `DASHBOARD_PIN_HASH` for production.

## Local tools (optional)
Content Analyzer calls the Video Vision API on `localhost:3001`; Montage
Studio calls OpenMontage on `localhost:8484` (or a Cloudflare tunnel);
the Refresh data button calls `scrape/server.py` on `localhost:5556`.
All three detect when the service is offline and degrade gracefully —
do not break this contract when extending.

## Deploy
- GH Actions: `.github/workflows/deploy.yml` builds with
  `NEXT_PUBLIC_BASE_PATH=/fwp-analytics-dashboard` and publishes
  `out/` to GitHub Pages on every push to `main`.
- Add `.nojekyll` to the artifact (already in the workflow).

## Persisted client state (Zustand)
Single store under `fwp_dashboard_v2`:
- `deals` (Brand Deals tab)
- `flows` (ManyChat)
- `calendar` (Content Calendar)
- `creators` (Creator Research)
- `contentQueue` (Content Studio)
- `studioFolder` (Studio source path)

PIN auth uses `sessionStorage["fwp_auth"]`, separate from the store.
