"""
Threads scraper.

Strategy: navigate Chrome to threads.com/@<handle>, install an XHR hook
that captures every /graphql/query response body, programmatically scroll
the page to trigger Threads' own infinite scroll, then parse posts out
of the captured responses. This lets Meta's React app handle all the
auth, doc_id rotation, and pagination — we just listen.

Empirically (verified live 2026-04-25 against threads.com):
  - Profile uses XMLHttpRequest, not fetch
  - Endpoint is `/graphql/query` (not /api/graphql)
  - Each scroll fires 1-3 graphql requests
  - The big responses (50KB+) carry the post payloads
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from scrape.cdp import CDP, CDPError
from scrape.handles import HANDLES
from scrape.incremental import STOP_AFTER_KNOWN, load_existing, merge

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "public" / "data" / "threads_posts.json"
HANDLE = HANDLES["threads"]
PAGE_URL = f"https://www.threads.com/@{HANDLE}"


# JS that wraps XMLHttpRequest so every /graphql/query response body lands
# in window.__FWP_GQL (an array of {body, length, at}).
_INSTALL_HOOK = """
(function() {
  if (window.__FWP_GQL_HOOK__) return 'already';
  window.__FWP_GQL_HOOK__ = true;
  window.__FWP_GQL = [];
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__fwp_url = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    this.addEventListener('load', () => {
      try {
        const u = this.__fwp_url || '';
        if (u.indexOf('/graphql/query') >= 0) {
          const t = this.responseText || '';
          if (t.length > 1000) {  // skip tiny ack responses
            window.__FWP_GQL.push({ at: Date.now(), length: t.length, body: t });
            if (window.__FWP_GQL.length > 500) window.__FWP_GQL.shift();
          }
        }
      } catch(e) {}
    });
    return origSend.apply(this, arguments);
  };
  return 'installed';
})()
"""

_DRAIN_BODIES = """
(function() {
  const items = window.__FWP_GQL || [];
  window.__FWP_GQL = [];
  return items;
})()
"""


def _walk(obj: Any, predicate):
    """Yield every dict in obj for which predicate(dict) is True."""
    if isinstance(obj, dict):
        if predicate(obj):
            yield obj
        for v in obj.values():
            yield from _walk(v, predicate)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v, predicate)


def _is_thread_post(o: dict) -> bool:
    """Detect a Threads post object: must have pk + code, plus typical fields."""
    if not isinstance(o, dict):
        return False
    if "pk" not in o or "code" not in o:
        return False
    if not isinstance(o.get("code"), str) or not o["code"]:
        return False
    return any(k in o for k in ("caption", "taken_at", "text_post_app_info", "like_count"))


def _owned_by_handle(raw: dict) -> bool:
    """True only when the post's author is our handle. The profile page can
    surface reposts, quoted posts, and (after a stray redirect) the For You
    feed, all of which carry other people's usernames."""
    user = raw.get("user") or {}
    owner = str(user.get("username") or "").lower()
    return owner == HANDLE.lower()


def _extract_posts_from_body(body: str) -> list[dict]:
    """Parse a captured /graphql/query body and return raw post dicts
    authored by HANDLE."""
    # Threads' graphql can return multi-line newline-delimited JSON sometimes
    # (streamed payloads). Try parsing each line independently and merge.
    posts: list[dict] = []
    seen_pks: set[str] = set()

    candidates = []
    body = body.strip()
    if not body:
        return posts
    # Try whole-body parse first
    try:
        candidates.append(json.loads(body))
    except json.JSONDecodeError:
        # Fall back to per-line
        for line in body.split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                candidates.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    for cand in candidates:
        for post in _walk(cand, _is_thread_post):
            pk = str(post.get("pk") or "")
            if not pk or pk in seen_pks or not _owned_by_handle(post):
                continue
            seen_pks.add(pk)
            posts.append(post)
    return posts


def _to_post(raw: dict) -> dict:
    """Convert a raw extracted post to the dashboard's Post schema."""
    pk = str(raw.get("pk") or "")
    code = raw.get("code") or ""
    caption_obj = raw.get("caption") or {}
    if isinstance(caption_obj, dict):
        caption = caption_obj.get("text") or ""
    elif isinstance(caption_obj, str):
        caption = caption_obj
    else:
        caption = ""
    taken_at = raw.get("taken_at") or 0
    iso_dt = time.strftime("%Y-%m-%d", time.localtime(taken_at)) if taken_at else ""
    iso_t = time.strftime("%H:%M", time.localtime(taken_at)) if taken_at else ""
    text_info = raw.get("text_post_app_info") or {}
    likes = int(raw.get("like_count") or 0)
    views = int(raw.get("view_count") or raw.get("play_count") or 0)
    comments = int(text_info.get("direct_reply_count") or raw.get("comment_count") or 0)
    shares = int(text_info.get("repost_count") or 0) + int(text_info.get("quote_count") or 0)
    media_type = raw.get("media_type") or 0
    type_str = "video" if media_type == 2 else "carousel" if media_type == 8 else "post"
    eng = ((likes + comments + shares) / views * 100) if views else 0
    title = caption.split("\n", 1)[0][:120] if caption else ""
    hashtags = " ".join(t for t in caption.split() if t.startswith("#"))
    thumb = ""
    ivs = raw.get("image_versions2") or {}
    cands = ivs.get("candidates") or []
    if cands and isinstance(cands[0], dict):
        thumb = cands[0].get("url") or ""
    return {
        "id": f"th_{pk}",
        "url": f"https://www.threads.com/@{HANDLE}/post/{code}" if code else "",
        "title": title,
        "caption": caption,
        "platform": "threads",
        "type": type_str,
        "date": iso_dt,
        "time": iso_t,
        "views": views,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "saves": 0,
        "engagementRate": f"{eng:.2f}",
        "hashtags": hashtags,
        "duration": "",
        "thumbnailUrl": thumb,
        "notes": "",
    }


def _extract_follower_count(body: str) -> int:
    """Pull the profile's follower_count out of a captured graphql body, if
    the body carries the profile user object. Returns 0 when absent."""
    try:
        blob = json.loads(body)
    except json.JSONDecodeError:
        return 0
    for user in _walk(
        blob,
        lambda o: isinstance(o, dict)
        and "follower_count" in o
        and str(o.get("username") or "").lower() == HANDLE.lower(),
    ):
        try:
            return int(user.get("follower_count") or 0)
        except (TypeError, ValueError):
            continue
    return 0


def scrape(max_pages: int = 80, on_progress=None, full: bool = False) -> dict:
    """Capture Threads' own graphql responses while scrolling the profile.

    Incremental (default): stops once STOP_AFTER_KNOWN * 4 consecutive known
    posts have streamed past. full=True scrolls until the page stops growing.
    """
    existing, known_ids = load_existing(DATA_FILE)
    cdp = CDP()
    posts_by_pk: dict[str, dict] = {}
    consecutive_known = 0
    stopped_early = False
    followers = 0

    try:
        cdp.new_tab(PAGE_URL)
        cdp.wait_for_load(timeout=20)
        time.sleep(2.0)  # let Threads finish initial render + first XHRs

        # Register the hook to run before any page script on the next document,
        # then reload so the initial profile query flows through it. (A hook
        # installed after load misses the first batch.)
        cdp.add_init_script(_INSTALL_HOOK)
        cdp.evaluate("window.scrollTo(0, 0)")
        cdp.evaluate("window.location.reload()")
        time.sleep(0.5)
        cdp.wait_for_load(timeout=20, expect_url_substring=f"@{HANDLE}")
        # Threads sometimes lands a logged-in reload on the For You feed. Make
        # sure we are on the profile before capturing anything, otherwise the
        # hook would happily collect other people's posts.
        href = cdp.evaluate("window.location.href") or ""
        if f"@{HANDLE}".lower() not in href.lower():
            cdp.navigate(PAGE_URL)
            cdp.wait_for_load(timeout=20, expect_url_substring=f"@{HANDLE}")
        time.sleep(2.5)
        # Re-install hook (reload wiped it)
        cdp.evaluate(_INSTALL_HOOK)
        time.sleep(1.5)  # capture initial graphql calls

        if on_progress:
            on_progress("hook installed", {"handle": HANDLE})

        stale_rounds = 0
        last_height = 0
        for round_idx in range(max_pages):
            bodies = cdp.evaluate(_DRAIN_BODIES) or []
            new_in_round = 0
            for entry in bodies:
                body = entry.get("body") or ""
                if not followers:
                    followers = _extract_follower_count(body)
                for raw in _extract_posts_from_body(body):
                    pk = str(raw.get("pk") or "")
                    if not pk:
                        continue
                    full_id = f"th_{pk}"
                    if full_id in known_ids:
                        consecutive_known += 1
                    elif pk not in posts_by_pk:
                        posts_by_pk[pk] = raw
                        new_in_round += 1
                        consecutive_known = 0

            if not full and known_ids and consecutive_known >= STOP_AFTER_KNOWN * 4:
                # Threads pages are big; need more known posts to be sure
                stopped_early = True
                break

            height_before = cdp.evaluate("document.body.scrollHeight") or 0
            cdp.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(2.0)
            height_after = cdp.evaluate("document.body.scrollHeight") or 0

            if on_progress:
                on_progress("scrolling", {
                    "round": round_idx + 1,
                    "newPosts": len(posts_by_pk),
                    "newInRound": new_in_round,
                    "consecutiveKnown": consecutive_known,
                    "heightDelta": height_after - height_before,
                })

            if height_after == last_height and new_in_round == 0:
                stale_rounds += 1
                if stale_rounds >= 4:
                    break
            else:
                stale_rounds = 0
            last_height = height_after

        # Final drain — anything left in the buffer
        bodies = cdp.evaluate(_DRAIN_BODIES) or []
        for entry in bodies:
            body = entry.get("body") or ""
            for raw in _extract_posts_from_body(body):
                pk = str(raw.get("pk") or "")
                if pk and pk not in posts_by_pk:
                    posts_by_pk[pk] = raw

    finally:
        cdp.close_owned()
        cdp.detach()

    new_posts = [_to_post(raw) for raw in posts_by_pk.values()]
    merged = merge(existing, new_posts)
    merged.sort(key=lambda p: p.get("date", "") or "0", reverse=True)

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(merged, indent=2))

    return {
        "totalScraped": len(merged),
        "newPosts": len(new_posts),
        "stoppedEarly": stopped_early,
        "lastPostId": merged[0]["id"] if merged else None,
        "followers": followers,
    }
