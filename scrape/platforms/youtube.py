"""
YouTube scraper.

Navigates Chrome to youtube.com/<handle>/videos, reads ytInitialData +
INNERTUBE_API_KEY from the page, then pages through the videos and
shorts tabs via /youtubei/v1/browse.

Endpoints used:
    Initial:   https://www.youtube.com/<handle>/videos      (ytInitialData)
    Continue:  POST /youtubei/v1/browse?key=<INNERTUBE_API_KEY>
               body: { context, continuation }

We capture both Videos and Shorts tabs.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from scrape.cdp import CDP, CDPError
from scrape.handles import YOUTUBE_CHANNEL_ID
from scrape.incremental import STOP_AFTER_KNOWN, load_existing, merge

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "public" / "data" / "youtube_posts.json"
# Channel-ID URL: the @handle 404'd after Phil renamed it (2026-09-04).
PAGE_URL = f"https://www.youtube.com/channel/{YOUTUBE_CHANNEL_ID}/videos"


def _extract_initial_state(cdp: CDP) -> dict:
    """Read ytInitialData and ytcfg from the page."""
    expr = """
        (function() {
          var data = window.ytInitialData || null;
          var cfg = (window.ytcfg && window.ytcfg.data_) || {};
          return {
            ytInitialData: data,
            apiKey: cfg.INNERTUBE_API_KEY || null,
            clientName: cfg.INNERTUBE_CLIENT_NAME || cfg.INNERTUBE_CONTEXT_CLIENT_NAME || null,
            clientVersion: cfg.INNERTUBE_CLIENT_VERSION || null,
            context: cfg.INNERTUBE_CONTEXT || null,
            visitorData: (cfg.INNERTUBE_CONTEXT && cfg.INNERTUBE_CONTEXT.client && cfg.INNERTUBE_CONTEXT.client.visitorData) || null
          };
        })()
    """
    return cdp.evaluate(expr)


def _walk(obj, key: str):
    """Recursively yield every dict in obj that contains `key`."""
    if isinstance(obj, dict):
        if key in obj:
            yield obj
        for v in obj.values():
            yield from _walk(v, key)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v, key)


def _safe(obj, *path, default=None):
    """Walk a nested dict/list path safely. obj.get(p1).get(p2)... but
    tolerates strings, lists, missing keys, and None at any step."""
    cur = obj
    for p in path:
        if cur is None:
            return default
        if isinstance(p, int):
            if not isinstance(cur, list) or p >= len(cur) or p < -len(cur):
                return default
            cur = cur[p]
        else:
            if not isinstance(cur, dict):
                return default
            cur = cur.get(p)
    return cur if cur is not None else default


def _parse_video_renderer(r) -> dict | None:
    """Parse a richItemRenderer.content.videoRenderer or shortsLockupViewModel.
    Tolerates whatever weird shapes YouTube throws at us."""
    if not isinstance(r, dict):
        return None
    # Standard videos tab
    if "videoRenderer" in r and isinstance(r["videoRenderer"], dict):
        v = r["videoRenderer"]
        vid = _safe(v, "videoId", default="")
        if not vid:
            return None
        title = _safe(v, "title", "runs", 0, "text") or _safe(v, "title", "simpleText") or ""
        published = _safe(v, "publishedTimeText", "simpleText") or ""
        view_text = _safe(v, "viewCountText", "simpleText") or _safe(v, "viewCountText", "runs", 0, "text") or "0"
        views = _parse_int(str(view_text))
        thumbnails = _safe(v, "thumbnail", "thumbnails") or []
        thumb = thumbnails[-1].get("url", "") if thumbnails and isinstance(thumbnails[-1], dict) else ""
        duration = _safe(v, "lengthText", "simpleText") or ""
        return {
            "id": f"yt_{vid}",
            "url": f"https://www.youtube.com/watch?v={vid}",
            "title": str(title),
            "caption": str(title),
            "platform": "youtube",
            "type": "video",
            "date": "",
            "_publishedRelative": str(published),
            "time": "",
            "views": views,
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "saves": 0,
            "engagementRate": "0.00",
            "hashtags": "",
            "duration": str(duration),
            "thumbnailUrl": str(thumb),
            "notes": "",
        }
    # Shorts tab uses shortsLockupViewModel
    if "shortsLockupViewModel" in r and isinstance(r["shortsLockupViewModel"], dict):
        s = r["shortsLockupViewModel"]
        vid = _safe(s, "onTap", "innertubeCommand", "reelWatchEndpoint", "videoId") or ""
        # accessibilityText can be a string OR { simpleText: "..." } — handle both
        access_raw = _safe(s, "accessibilityText")
        if isinstance(access_raw, dict):
            accessibility = access_raw.get("simpleText") or ""
        elif isinstance(access_raw, str):
            accessibility = access_raw
        else:
            accessibility = ""
        title = accessibility.split(" - ")[0] if accessibility else ""
        view_text = _safe(s, "overlayMetadata", "secondaryText", "content") or ""
        views = _parse_int(str(view_text))
        sources = _safe(s, "thumbnail", "sources") or []
        thumb = sources[-1].get("url", "") if sources and isinstance(sources[-1], dict) else ""
        if not vid:
            return None
        return {
            "id": f"yt_{vid}",
            "url": f"https://www.youtube.com/shorts/{vid}",
            "title": str(title),
            "caption": str(title),
            "platform": "youtube",
            "type": "short",
            "date": "",
            "_publishedRelative": "",
            "time": "",
            "views": views,
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "saves": 0,
            "engagementRate": "0.00",
            "hashtags": "",
            "duration": "",
            "thumbnailUrl": str(thumb),
            "notes": "",
        }
    return None


def _parse_int(s: str) -> int:
    """Turn '12K views', '1.2M', '345' into an int."""
    if not s:
        return 0
    s = s.replace(",", "").lower().strip()
    # Strip ' views' or similar
    for suffix in (" views", " view", " watching"):
        if s.endswith(suffix):
            s = s[: -len(suffix)]
    # Handle K / M / B
    mult = 1
    if s.endswith("k"):
        mult, s = 1_000, s[:-1]
    elif s.endswith("m"):
        mult, s = 1_000_000, s[:-1]
    elif s.endswith("b"):
        mult, s = 1_000_000_000, s[:-1]
    try:
        return int(float(s.strip()) * mult)
    except (ValueError, TypeError):
        return 0


def _resolve_relative_date(rel: str) -> str:
    """Convert '3 weeks ago' / '5 months ago' to YYYY-MM-DD (best effort)."""
    if not rel:
        return ""
    parts = rel.lower().replace("ago", "").strip().split()
    if len(parts) < 2:
        return ""
    try:
        n = int(parts[0])
    except ValueError:
        return ""
    unit = parts[1].rstrip("s")
    seconds = {
        "second": 1, "minute": 60, "hour": 3600, "day": 86_400,
        "week": 604_800, "month": 2_629_800, "year": 31_557_600,
    }.get(unit, 0)
    if not seconds:
        return ""
    epoch = time.time() - n * seconds
    return time.strftime("%Y-%m-%d", time.localtime(epoch))


def _continuation_request(cdp: CDP, api_key: str, context: dict, token: str) -> dict:
    body = {"context": context, "continuation": token}
    expr = (
        "fetch('/youtubei/v1/browse?key=" + api_key + "&prettyPrint=false', {"
        "method: 'POST',"
        "headers: { 'Content-Type': 'application/json' },"
        "body: " + json.dumps(json.dumps(body)) + ","
        "credentials: 'include'"
        "}).then(r => r.text()).then(t => { try { return JSON.parse(t); } catch(e) { return { __error: 'parse', body: t.slice(0,500) }; } })"
    )
    return cdp.evaluate(expr, await_promise=True) or {}


def _find_subscribers(blob) -> int:
    """Best-effort subscriber count from ytInitialData. Handles both the
    legacy `subscriberCountText.simpleText` and the newer view-model
    `{"content": "5.13K subscribers"}` shapes."""
    for d in _walk(blob, "subscriberCountText"):
        text = _safe(d, "subscriberCountText", "simpleText") or ""
        if text:
            return _parse_int(str(text).lower().replace("subscribers", "").replace("subscriber", ""))
    for d in _walk(blob, "content"):
        text = d.get("content")
        if isinstance(text, str) and text.lower().endswith("subscribers"):
            return _parse_int(text.lower().replace("subscribers", ""))
    return 0


def _scrape_tab(
    cdp: CDP,
    tab_url: str,
    max_pages: int,
    on_progress,
    label: str,
    known_ids: set[str] | frozenset[str] = frozenset(),
    full: bool = False,
) -> tuple[list[dict], bool, int]:
    """Load a YT channel tab (videos or shorts) in OUR tab and page through it.

    Returns (posts, stopped_early, subscribers). The first call opens the
    tab; later calls navigate the same owned tab so we never touch anyone
    else's YouTube tab.
    """
    expect = tab_url.rstrip("/").rsplit("/", 1)[-1]  # "videos" | "shorts"
    if cdp.owned_tabs:
        cdp.navigate(tab_url)
    else:
        cdp.new_tab(tab_url)
    cdp.wait_for_load(timeout=20, expect_url_substring=expect)
    # Give ytInitialData a moment to attach (it's set very early)
    time.sleep(1.5)

    state = _extract_initial_state(cdp)
    if not state or not state.get("ytInitialData"):
        raise CDPError(f"ytInitialData missing on {tab_url}")
    api_key = state.get("apiKey")
    context = state.get("context")
    if not api_key or not context:
        raise CDPError(f"INNERTUBE_API_KEY/context missing on {tab_url}")
    subscribers = _find_subscribers(state["ytInitialData"])

    posts: list[dict] = []
    seen_ids: set[str] = set()
    consecutive_known = 0
    stopped_early = False

    def known_run(new_slice: list[dict]) -> bool:
        """Update the consecutive-known counter; True when we should stop."""
        nonlocal consecutive_known
        if full or not known_ids:
            return False
        for p in new_slice:
            if p["id"] in known_ids:
                consecutive_known += 1
            else:
                consecutive_known = 0
        return consecutive_known >= STOP_AFTER_KNOWN

    def add_items(blob) -> None:
        for it in _walk(blob, "richItemRenderer"):
            content = _safe(it, "richItemRenderer", "content")
            try:
                parsed = _parse_video_renderer(content)
            except Exception:  # noqa: BLE001
                continue
            if parsed and parsed["id"] not in seen_ids:
                seen_ids.add(parsed["id"])
                posts.append(parsed)

    def collect_tokens(blob) -> list[str]:
        tokens = []
        for c in _walk(blob, "continuationItemRenderer"):
            tok = _safe(c, "continuationItemRenderer", "continuationEndpoint",
                        "continuationCommand", "token")
            if tok:
                tokens.append(tok)
        return tokens

    add_items(state["ytInitialData"])
    cont_tokens = collect_tokens(state["ytInitialData"])

    page = 1
    if on_progress:
        on_progress(f"{label} page", {"page": page, "totalPosts": len(posts)})
    if known_run(posts):
        return posts, True, subscribers

    while cont_tokens and page < max_pages:
        token = cont_tokens.pop(0)
        page += 1
        resp = _continuation_request(cdp, api_key, context, token)
        if not resp or "__error" in resp:
            break
        before = len(posts)
        add_items(resp)
        new_tokens = collect_tokens(resp)
        # Replace the queue rather than extend — old tokens are stale once we
        # advance, and we get a fresh continuation each call.
        cont_tokens = new_tokens
        if on_progress:
            on_progress(f"{label} page", {"page": page, "totalPosts": len(posts)})
        if len(posts) == before:
            # No new items — don't infinite-loop on a stuck token
            break
        if known_run(posts[before:]):
            stopped_early = True
            break
        time.sleep(0.4)
    return posts, stopped_early, subscribers


def scrape(max_pages: int = 50, on_progress=None, full: bool = False) -> dict:
    """Scrape the Videos and Shorts tabs of the channel.

    Incremental (default): each tab stops after STOP_AFTER_KNOWN consecutive
    already-known videos. full=True pages every tab to the end.
    """
    existing, known_ids = load_existing(DATA_FILE)
    cdp = CDP()
    posts: list[dict] = []
    stopped_early = False
    followers = 0
    try:
        vids, stopped, subs = _scrape_tab(
            cdp, PAGE_URL, max_pages, on_progress, "videos", known_ids, full
        )
        posts.extend(vids)
        stopped_early = stopped_early or stopped
        followers = subs or followers
        shorts_url = PAGE_URL.replace("/videos", "/shorts")
        try:
            shorts, stopped, subs = _scrape_tab(
                cdp, shorts_url, max_pages, on_progress, "shorts", known_ids, full
            )
            posts.extend(shorts)
            stopped_early = stopped_early or stopped
            followers = followers or subs
        except CDPError as e:
            if on_progress:
                on_progress("shorts skipped", {"reason": str(e)})
    finally:
        cdp.close_owned()
        cdp.detach()

    for p in posts:
        rel = p.pop("_publishedRelative", "")
        if rel and not p.get("date"):
            p["date"] = _resolve_relative_date(rel)

    merged = merge(existing, posts)
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(merged, indent=2))

    new_count = sum(1 for p in posts if p["id"] not in known_ids)
    return {
        "totalScraped": len(merged),
        "newPosts": new_count,
        "stoppedEarly": stopped_early,
        "lastPostId": merged[0]["id"] if merged else None,
        "followers": followers,
    }
