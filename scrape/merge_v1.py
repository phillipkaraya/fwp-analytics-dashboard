#!/usr/bin/env python3
"""
Backfill v1 engagement data (likes, comments, shares, saves, engagementRate,
date) into the current public/data/<platform>_posts.json files.

Why: the v2 scrapers prioritize coverage over depth. They capture every post
but some platforms (TikTok DOM, YouTube shorts via browse, Threads) ship
without per-post engagement counts. v1's data — though older — has those
numbers for every post that existed back then. This script merges:

  - For each post in v2 with the same id as a post in v1:
      copy v1's likes/comments/shares/saves/engagementRate/date if v2's
      values are zero/empty.
  - Posts only in v2 (new since v1) are left as-is.
  - Posts only in v1 (deleted from the platform) are NOT carried over —
      v2's coverage is authoritative.

Usage:
    python3 scrape/merge_v1.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V1_DIR = ROOT / "v1-archive" / "data"
V2_DIR = ROOT / "public" / "data"

PLATFORMS = ["instagram", "tiktok", "youtube", "threads", "linkedin"]

# Fields to backfill if the v2 value is "empty" (0, "", "0.00")
NUMERIC_FIELDS = ["likes", "comments", "shares", "saves", "views"]
STRING_FIELDS = ["date", "time", "duration"]


def is_empty_num(v) -> bool:
    if v is None:
        return True
    try:
        return float(v) == 0
    except (TypeError, ValueError):
        return True


def is_empty_str(v) -> bool:
    return v is None or v == "" or str(v).strip() == ""


def is_empty_eng(v) -> bool:
    if v is None:
        return True
    try:
        return float(v) == 0
    except (TypeError, ValueError):
        return str(v).strip() in ("", "0", "0.00")


def merge_posts(v2_posts: list[dict], v1_posts: list[dict]) -> tuple[list[dict], dict]:
    v1_by_id = {p.get("id"): p for p in v1_posts if p.get("id")}
    stats = {"v2_total": len(v2_posts), "matched": 0, "fields_filled": 0, "no_v1_match": 0}

    out: list[dict] = []
    for p in v2_posts:
        pid = p.get("id")
        v1p = v1_by_id.get(pid)
        if not v1p:
            stats["no_v1_match"] += 1
            out.append(p)
            continue
        stats["matched"] += 1
        merged = dict(p)
        for f in NUMERIC_FIELDS:
            if is_empty_num(merged.get(f)) and not is_empty_num(v1p.get(f)):
                merged[f] = v1p[f]
                stats["fields_filled"] += 1
        for f in STRING_FIELDS:
            if is_empty_str(merged.get(f)) and not is_empty_str(v1p.get(f)):
                merged[f] = v1p[f]
                stats["fields_filled"] += 1
        # engagementRate is a string in our schema; treat specially
        if is_empty_eng(merged.get("engagementRate")) and not is_empty_eng(v1p.get("engagementRate")):
            merged["engagementRate"] = v1p["engagementRate"]
            stats["fields_filled"] += 1
        # If we filled in any numerics but engagementRate is still empty,
        # recompute it from likes+comments / views.
        if is_empty_eng(merged.get("engagementRate")):
            try:
                v = float(merged.get("views") or 0)
                lc = float(merged.get("likes") or 0) + float(merged.get("comments") or 0)
                if v > 0:
                    merged["engagementRate"] = f"{(lc / v * 100):.2f}"
            except (TypeError, ValueError):
                pass
        # Caption — if v2 caption is empty and v1 has one, use v1's
        if is_empty_str(merged.get("caption")) and not is_empty_str(v1p.get("caption")):
            merged["caption"] = v1p["caption"]
            if is_empty_str(merged.get("title")):
                merged["title"] = v1p.get("title") or v1p["caption"].split("\n", 1)[0][:120]
        out.append(merged)
    return out, stats


def main() -> None:
    print(f"Merging v1 ({V1_DIR}) → v2 ({V2_DIR})\n")
    grand_total = {"matched": 0, "fields_filled": 0, "no_v1_match": 0}
    for plat in PLATFORMS:
        v1_path = V1_DIR / f"{plat}_posts.json"
        v2_path = V2_DIR / f"{plat}_posts.json"
        if not v1_path.exists() or not v2_path.exists():
            print(f"  {plat}: skip (missing file)")
            continue
        v1 = json.loads(v1_path.read_text())
        v2 = json.loads(v2_path.read_text())
        merged, stats = merge_posts(v2, v1)
        v2_path.write_text(json.dumps(merged, indent=2))
        print(
            f"  {plat}: {stats['v2_total']} posts · "
            f"matched {stats['matched']} from v1 · "
            f"{stats['no_v1_match']} new since v1 · "
            f"filled {stats['fields_filled']} empty fields"
        )
        for k in grand_total:
            grand_total[k] += stats[k]

    print(
        f"\nTotal: matched {grand_total['matched']} · "
        f"new since v1 {grand_total['no_v1_match']} · "
        f"filled {grand_total['fields_filled']} fields"
    )


if __name__ == "__main__":
    main()
