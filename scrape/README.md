# FWP Scraper

Python (stdlib + `websocket-client`) that re-scrapes Instagram / TikTok /
YouTube / Threads through the Chrome that is **already running** on this Mac,
then rebuilds every derived JSON the dashboard reads.

```bash
pip install websocket-client     # one-time
```

## Run it

```bash
cd ~/projects/fwp-analytics-dashboard

python3 scrape/run.py                          # incremental, all four platforms
python3 scrape/run.py --platforms instagram    # one platform
python3 scrape/run.py --full                   # master sweep (see below)
python3 scrape/run.py --analyze-only           # just rebuild analytics/vault JSON
```

Then commit `public/data/` and push. GitHub Pages redeploys in about a minute.

The dashboard's **Refresh data** button does the same thing through
`scrape/server.py` (port 5556). Start it with `python3 scrape/server.py`;
send `{"mode": "full"}` in the POST body for a sweep.

## Incremental vs. master sweep

**Incremental** is the default and what you want day to day. Each platform
pages newest-first and stops after it has seen 8 posts in a row that are
already in `public/data/<platform>_posts.json` (Threads uses 32 because its
pages are large). Only new posts are added; older posts keep the metrics
from whichever scrape saw them last. A typical run touches a few dozen
posts and finishes in a couple of minutes.

**Master sweep** (`--full`) ignores that early stop and pages every profile
to the end, refreshing views, likes, and comments on every post. Budget
15 to 30 minutes and expect TikTok to be the slow one (it scrolls the DOM).
Run it deliberately, not on a schedule.

## Chrome: use the shared one, never relaunch it

The scraper connects to the Chrome on `CHROME_CDP_PORT` (default 9222),
which carries Phil's logins for all four platforms. It opens **its own tabs**
and closes them on every exit path. It never navigates or closes a tab it
did not create, so it is safe to run while other sessions use the browser.

Do **not** quit Chrome or relaunch it with a different port to scrape. If
another Claude Code session is driving Chrome, `run.py` coordinates through
`ccbrowser` (claims a `tab` lease for the duration and releases it after)
and refuses to start when `ccbrowser mem` reports memory critical.

If a platform is logged out, that platform fails with a clear error and the
others still complete. Sign in to it in the shared Chrome and rerun for
that platform only.

## What gets written

| File | Written by | Purpose |
|---|---|---|
| `public/data/<platform>_posts.json` | `platforms/*.py` | raw posts, merged incrementally |
| `public/data/scrape_state.json` | `server.py` / `run.py` | per-platform status, last run, follower counts |
| `public/data/analytics.json` | `analyze.py` | every Insights section (heatmap, viral, hooks, hashtags, superfans, ...) |
| `public/data/content_vault.json` | `analyze.py` | Content Vault: posts grouped by topic |
| `public/data/follower_history.json` | `analyze.py` | one follower snapshot per scrape day (appended, never rewritten) |

`comments.json` and `follow_data.json` are **not** re-scraped yet. They are
the March 2026 snapshot; the Insights sections built on them say so.

## Topics (Content Vault)

`scrape/categories.json` maps a topic slug to a label and a keyword list.
Matching is whole-word and case-insensitive against title + caption +
hashtags. A post can land in several topics; anything matching nothing goes
to `other`. Add or move keywords, then:

```bash
python3 scrape/run.py --analyze-only
```

No code change is needed to add a topic.

## Layout

```
scrape/
├── run.py            CLI runner (what cron will call)
├── server.py         HTTP service for the dashboard's Refresh button (:5556)
├── analyze.py        rebuilds analytics.json, content_vault.json, follower_history.json
├── categories.json   editable topic keyword map
├── cdp.py            Chrome DevTools Protocol client (own-tab discipline)
├── incremental.py    load/merge helpers + STOP_AFTER_KNOWN
├── handles.py        Phil's handle per platform
└── platforms/
    ├── instagram.py  web_profile_info + feed API via fetch() in page context
    ├── tiktok.py     DOM tile extraction while scrolling
    ├── youtube.py    ytInitialData + innertube continuations (videos + shorts)
    └── threads.py    XHR hook capturing /graphql/query while scrolling
```
