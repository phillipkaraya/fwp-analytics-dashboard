"""
LinkedIn scraper: Phil's own posts from his activity feed, read from the
rendered page in the shared Chrome (CDP on :9222, Phil's own login).

Why the DOM and not an XHR hook like threads.py: LinkedIn renders the
activity feed server-side and pages it through its Ember app, so nothing
usable crosses the network layer after load (a probe on 2026-09-05 caught only
messaging GraphQL, which this scraper must never touch). Each feed card carries
`data-urn="urn:li:activity:<id>"`, the commentary, and the social counts, which
is everything the Post schema needs.

Facts that make it work:
  - The activity id is Snowflake-like: `id >> 22` is the Unix time in ms.
  - Own posts show "• You" next to the actor; plain reposts carry a header
    "Phillip Karaya reposted this" and are skipped (a repost with Phil's own
    commentary is kept, typed "repost").
  - LinkedIn exposes no view count on the feed (impressions live on per-post
    analytics pages, not collected). Views stay 0, likes are the reach number
    and engagement is measured against followers, the same rule as Threads.

Hygiene: this drives Phil's logged-in session. One tab, sequential, human-like
pauses, a hard page cap. Keep runs to about once a day.
"""

from __future__ import annotations

import json
import random
import re
import sys
import time
from pathlib import Path

from scrape.cdp import CDP, CDPError
from scrape.handles import HANDLES
from scrape.incremental import STOP_AFTER_KNOWN, load_existing, merge

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "public" / "data" / "linkedin_posts.json"
HANDLE = HANDLES["linkedin"]
PAGE_URL = f"https://www.linkedin.com/in/{HANDLE}/recent-activity/all/"
PROFILE_URL = f"https://www.linkedin.com/in/{HANDLE}/"
_WALL_MARKERS = ("/login", "/checkpoint/", "/authwall", "/uas/", "/signup")

# One pass over every rendered card. Returns plain data only; no DOM handles
# cross the wire. Selectors are LinkedIn's stable "update-components-*" and
# "social-details-social-counts*" classes (verified 2026-09-05).
_READ_CARDS = r"""
JSON.stringify([...document.querySelectorAll('[data-urn^="urn:li:activity:"]')].map(c => {
  const txt = el => el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '';
  const q = sel => c.querySelector(sel);
  const header = txt(q('[class*="update-components-header"]'));
  const commentary = txt(q('.update-components-update-v2__commentary, [class*="update-components-text"]'));
  const counts = [...c.querySelectorAll('[class*="social-details-social-counts"] button, [class*="social-details-social-counts"] a, [class*="social-details-social-counts"] li')]
    .map(b => txt(b)).filter(Boolean);
  const reactions = txt(q('[class*="social-details-social-counts__reactions-count"]'));
  const img = q('img[class*="ivm-view-attr__img"], img[class*="update-components-image"]');
  return {
    urn: c.getAttribute('data-urn'),
    you: /•\s*You\b/.test(c.innerText || ''),
    actorHref: (q('a[class*="update-components-actor__meta-link"], a[class*="update-components-actor__image"]') || {}).getAttribute?.('href') || '',
    header,
    commentary,
    reactions,
    counts,
    hasVideo: !!q('video, [class*="update-components-linkedin-video"], [class*="update-components-video"]'),
    hasImage: !!q('[class*="update-components-image"]'),
    hasDocument: !!q('[class*="update-components-document"]'),
    hasArticle: !!q('[class*="update-components-article"]'),
    hasReshare: !!q('[class*="update-components-mini-update"], [class*="feed-shared-update-v2__reshare"], [class*="update-components-update-v2__reshare"]'),
    thumb: img ? (img.getAttribute('src') || '') : ''
  };
}))
"""

_COUNT_RE = re.compile(r"([\d.,]+)\s*([KkMm])?")


def _parse_count(text: str) -> int:
    """'1,234' -> 1234, '1.2K' -> 1200, '' -> 0."""
    m = _COUNT_RE.search(text or "")
    if not m:
        return 0
    n = float(m.group(1).replace(",", ""))
    unit = (m.group(2) or "").upper()
    return int(n * (1000 if unit == "K" else 1_000_000 if unit == "M" else 1))


def _count_for(counts: list[str], word: str) -> int:
    """The number immediately before `word`. LinkedIn wraps the comment and
    repost items in a class-less <li> whose text is "1 comment 2 reposts", so
    taking the first number of the first matching element gave both counters
    the comment count (verified 2026-09-05)."""
    pat = re.compile(rf"([\d.,]+\s*[KkMm]?)\s+{word}s?\b", re.IGNORECASE)
    for t in counts:
        m = pat.search(t)
        if m:
            return _parse_count(m.group(1))
    return 0


def _engagement(likes: int, comments: int, shares: int, views: int, followers: int) -> float:
    """Interactions over views when views exist, over followers otherwise."""
    interactions = likes + comments + shares
    if views:
        return interactions / views * 100
    if followers:
        return interactions / followers * 100
    return 0.0


def _stored_followers() -> int:
    try:
        state = json.loads((DATA_FILE.parent / "scrape_state.json").read_text())
        return int((state.get("followers") or {}).get("linkedin") or 0)
    except (OSError, ValueError):
        return 0


def _activity_id(urn: str) -> str:
    m = re.search(r"urn:li:activity:(\d+)", urn or "")
    return m.group(1) if m else ""


def _is_own(card: dict) -> bool:
    """Phil's own content: actor is Phil and it is not a plain repost."""
    actor_ok = bool(card.get("you")) or f"/in/{HANDLE}" in (card.get("actorHref") or "")
    plain_repost = "reposted this" in (card.get("header") or "").lower() and not (card.get("commentary") or "").strip()
    return actor_ok and not plain_repost


def _to_post(card: dict, followers: int) -> dict | None:
    aid = _activity_id(card.get("urn") or "")
    if not aid:
        return None
    ts = (int(aid) >> 22) / 1000.0
    caption = card.get("commentary") or ""
    likes = _parse_count(card.get("reactions") or "") or _count_for(card.get("counts") or [], "reaction")
    comments = _count_for(card.get("counts") or [], "comment")
    shares = _count_for(card.get("counts") or [], "repost")
    # Media first: a post with its own images or video is Phil's post even
    # when a reshare or comment preview sits inside the card.
    if card.get("hasVideo"):
        type_str = "video"
    elif card.get("hasDocument"):
        type_str = "document"
    elif card.get("hasImage"):
        type_str = "image"
    elif card.get("hasArticle"):
        type_str = "article"
    elif card.get("hasReshare"):
        type_str = "repost"
    else:
        type_str = "post"
    return {
        "id": f"li_{aid}",
        "url": f"https://www.linkedin.com/feed/update/urn:li:activity:{aid}/",
        "title": caption.split("\n", 1)[0][:120] if caption else "",
        "caption": caption,
        "platform": "linkedin",
        "type": type_str,
        "date": time.strftime("%Y-%m-%d", time.localtime(ts)),
        "time": time.strftime("%H:%M", time.localtime(ts)),
        "views": 0,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "saves": 0,
        "engagementRate": f"{_engagement(likes, comments, shares, 0, followers):.2f}",
        "hashtags": " ".join(t for t in caption.split() if t.startswith("#")),
        "duration": "",
        "thumbnailUrl": card.get("thumb") or "",
        "notes": "",
    }


def _followers_from_profile(cdp: CDP) -> int:
    cdp.navigate(PROFILE_URL)
    cdp.wait_for_load(timeout=25)
    time.sleep(random.uniform(2.5, 3.5))
    txt = cdp.evaluate("(document.body.innerText || '').slice(0, 30000)") or ""
    m = re.search(r"([\d.,]+\s*[KkMm]?)\s+followers", txt)
    return _parse_count(m.group(1)) if m else 0


def _check_wall(cdp: CDP) -> None:
    href = (cdp.evaluate("window.location.href") or "").lower()
    if any(k in href for k in _WALL_MARKERS) or cdp.evaluate("!!document.querySelector('form.login__form, input[name=\"session_key\"]')"):
        raise CDPError("LinkedIn shows a login or checkpoint wall; sign in to linkedin.com in the shared Chrome and rerun.")


def scrape(max_pages: int = 40, on_progress=None, full: bool = False) -> dict:
    """Read Phil's activity feed. Incremental (default) stops once
    STOP_AFTER_KNOWN consecutive already-known posts have scrolled past;
    full=True scrolls until the page stops growing."""
    existing, known_ids = load_existing(DATA_FILE)
    cdp = CDP()
    cards_by_urn: dict[str, dict] = {}
    stopped_early = False
    followers = 0
    print("  [linkedin] driving Phil's logged-in session; keep runs to about once a day", file=sys.stderr)

    try:
        cdp.new_tab(PAGE_URL)
        cdp.wait_for_load(timeout=25)
        time.sleep(random.uniform(2.5, 3.5))
        _check_wall(cdp)
        if on_progress:
            on_progress("feed open", {"handle": HANDLE})

        stale_rounds = 0
        last_count = -1
        for round_idx in range(max_pages):
            raw = cdp.evaluate(_READ_CARDS) or "[]"
            try:
                cards = json.loads(raw)
            except json.JSONDecodeError:
                cards = []
            consecutive_known = 0
            for card in cards:
                urn = card.get("urn") or ""
                if urn and urn not in cards_by_urn:
                    cards_by_urn[urn] = card
                if f"li_{_activity_id(urn)}" in known_ids:
                    consecutive_known += 1
                else:
                    consecutive_known = 0
            if on_progress:
                on_progress("scrolling", {"round": round_idx, "totalPosts": len(cards_by_urn), "consecutiveKnown": consecutive_known})
            if not full and known_ids and consecutive_known >= STOP_AFTER_KNOWN:
                stopped_early = True
                break
            if len(cards) == last_count:
                stale_rounds += 1
                if stale_rounds >= 4:
                    break
            else:
                stale_rounds = 0
            last_count = len(cards)
            cdp.evaluate("window.scrollBy(0, Math.round(window.innerHeight * 0.8))")
            time.sleep(random.uniform(2.0, 3.5))

        followers = _followers_from_profile(cdp)
    finally:
        cdp.close_owned()
        cdp.detach()

    followers = followers or _stored_followers()
    new_posts = [p for p in (_to_post(c, followers) for c in cards_by_urn.values() if _is_own(c)) if p]
    merged = merge(existing, new_posts)
    merged.sort(key=lambda p: p.get("date", "") or "0", reverse=True)
    if followers:
        for p in merged:
            if not int(p.get("views") or 0):
                p["engagementRate"] = f"{_engagement(int(p.get('likes') or 0), int(p.get('comments') or 0), int(p.get('shares') or 0), 0, followers):.2f}"

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(merged, indent=2, ensure_ascii=False))

    return {
        "totalScraped": len(merged),
        "newPosts": len([p for p in new_posts if p["id"] not in known_ids]),
        "stoppedEarly": stopped_early,
        "lastPostId": merged[0]["id"] if merged else None,
        "followers": followers,
    }
