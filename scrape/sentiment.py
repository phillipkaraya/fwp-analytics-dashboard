"""
Comment sentiment: a model first, an emoji-aware lexicon as the fallback.

Every comment gets three fields written back into comments.json, which is the
cache (no second file):

    sentiment        "positive" | "neutral" | "negative"
    isQuestion       True when the commenter asks the creator something
    sentimentSource  "llm" | "lexicon"
    sentimentV       SENTIMENT_VERSION, so a prompt or lexicon change relabels

Model path: Groq's OpenAI-compatible chat endpoint, key from the GROQ_API_KEY
environment variable (never a file). Run through the Keychain resolver:

    secret-sync run GROQ_API_KEY -- python3 scrape/run.py --analyze-only

Without a key the lexicon labels everything and the run stays sub-second; the
next run with a key upgrades those rows (source "lexicon" is retried).

History: the labels in the March 2026 snapshot came from a lost v1 script that
checked "question" first as a bare substring ("what" inside "whatever"), knew
no emoji (a quarter of the corpus is emoji only) and none of the audience's
words (congrats, fire, salute, dope, facts). Phil, 2026-09-05: "some that were
clearly nice were miscategorized." Stdlib only.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from typing import Iterable

SENTIMENT_VERSION = 2
LABELS = ("positive", "neutral", "negative")

# --------------------------------------------------------------------------
# lexicon
# --------------------------------------------------------------------------
_POS_WORDS = r"""
love loved loving lovely great amazing awesome dope fire lit goat legend legendary
king queen boss salute facts fax congrats congratulations congratulation proud
blessed blessings respect bravo thank thanks thankyou ty appreciate appreciated
perfect excellent fantastic incredible beautiful gorgeous nice good best brilliant
genius hilarious funny lol lmao lmfao haha hahaha rofl inspiring inspiration
inspirational motivating motivation helpful helped learned gem gems valuable agree
agreed true real preach yes yessir yesss yess sheesh wow woah gg w dub winning
winner slay banger goated valid beast savage
smooth solid clutch masterclass grinding hustle
congratz happy hbd bday birthday welcome deserved deserve earned
"""
_POS_PHRASES = (
    "killing it", "killed it", "crushing it", "crushed it", "well done", "good job",
    "great job", "keep going", "keep grinding", "keep it up", "lets go", "let's go",
    "let s go", "lfg", "my guy", "my brother", "big bro", "on point", "so true",
    "too funny", "made my day", "much love", "big w", "no cap", "not bad", "not wrong",
)
_NEG_WORDS = r"""
hate hated hating scam scammer scammers scamming scammed trash garbage mid fake
fraud fraudulent stupid dumb idiot idiots worst terrible awful sucks suck boring
cringe cringey clickbait waste lame wack ugly disgusting annoying wrong lie liar
liars lying ripoff rip-off bs smh disagree pathetic nonsense clown clowns loser
cap horrible gross unsubscribe unfollow misleading
"""
_NEGATORS = {"not", "no", "never", "dont", "don't", "aint", "ain't", "isnt", "isn't",
             "wasnt", "wasn't", "cant", "can't", "wont", "won't", "nothing", "hardly"}

_POS_RE = re.compile(r"\b(" + "|".join(sorted(set(_POS_WORDS.split()), key=len, reverse=True)) + r")\b")
_NEG_RE = re.compile(r"\b(" + "|".join(sorted(set(_NEG_WORDS.split()), key=len, reverse=True)) + r")\b")
_TOKEN_RE = re.compile(r"[a-z']+")

# Emoji are matched on their base code point, so skin tones and ZWJ sequences
# still count. 😭 alone is ambiguous in this audience; it turns positive only
# next to a laugh or another positive emoji, which _emoji_score handles.
_POS_EMOJI = set("😂🤣😆😁😄😃😊🥰😍🤩🔥❤🧡💛💚💙💜🖤🤎💯🙌👏🎉🎊💪🙏🐐🫡✅👌🤝🥳😎✨⭐🌟💎🏆🫶💕💖💗💓😘🤗👑🚀📈👍😌🤌🫰💐🌹🎂🍾🥂")
_LAUGH_EMOJI = set("😂🤣😆💀")
_NEG_EMOJI = set("😡🤬👎🙄💩🤮🤢😒😤🖕😠🤡😑😐🙃")
_AMBIG_EMOJI = set("😭💀")

# Without a "?" only a leading interrogative counts, and conservatively: the
# model decides the ambiguous ones.
_QUESTION_START = re.compile(
    r"^\W*(how|what|when|where|why|who|which|whose|can|could|do|does|did|should|would|will)\b",
)
_EXCLAMATION_START = re.compile(r"^\W*(what|how)\s+(a|an|the)?\s*\w+[!.]*\s*$", re.IGNORECASE)


def _emoji_score(text: str) -> tuple[int, int]:
    pos = neg = 0
    laugh = any(ch in _LAUGH_EMOJI for ch in text)
    other_pos = any(ch in _POS_EMOJI and ch not in _AMBIG_EMOJI for ch in text)
    for ch in text:
        if ch in _NEG_EMOJI:
            neg += 1
        elif ch in _AMBIG_EMOJI:
            if laugh or other_pos:
                pos += 1
        elif ch in _POS_EMOJI:
            pos += 1
    return min(pos, 3), min(neg, 3)


def is_question(text: str) -> bool:
    t = (text or "").strip().lower()
    if not t:
        return False
    if "?" in t:
        return True
    if _EXCLAMATION_START.match(t):  # "What a legend!" is not a question
        return False
    return bool(_QUESTION_START.match(t)) and len(t.split()) >= 3


def lexicon_label(text: str) -> tuple[str, bool, str]:
    """Return (sentiment, is_question, confidence). Confidence is "high",
    "low" (a single weak signal) or "none" (nothing fired, neutral by default)."""
    raw = text or ""
    t = raw.lower()
    for phrase in _POS_PHRASES:
        if phrase in t:
            t = t.replace(phrase, " posphrase ")
    tokens = _TOKEN_RE.findall(t)
    score = 0
    hits = 0
    for i, tok in enumerate(tokens):
        window = tokens[max(0, i - 2):i]
        negated = any(w in _NEGATORS for w in window)
        if tok == "posphrase" or _POS_RE.fullmatch(tok):
            score += -1 if negated else 1
            hits += 1
        elif _NEG_RE.fullmatch(tok):
            score += 1 if negated else -1
            hits += 1
    e_pos, e_neg = _emoji_score(raw)
    score += e_pos - e_neg
    hits += e_pos + e_neg
    if score > 0:
        label = "positive"
    elif score < 0:
        label = "negative"
    else:
        label = "neutral"
    confidence = "none" if hits == 0 else ("high" if abs(score) >= 2 or (e_pos + e_neg) > 0 else "low")
    return label, is_question(raw), confidence


# --------------------------------------------------------------------------
# model
# --------------------------------------------------------------------------
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# Round-robin spreads the per-model tokens-per-minute ceiling. Verified
# available on 2026-09-05; llama models were retired from the free tier.
GROQ_MODELS = ("openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b")
BATCH_SIZE = 25
MAX_CALLS_PER_RUN = 400
MIN_SECONDS_BETWEEN_CALLS_PER_MODEL = 9.0
# Groq's edge returns 403 "error code: 1010" to non-browser user agents.
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

_SYSTEM_PROMPT = """You label social media comments left on a finance and lifestyle creator's posts (Instagram, TikTok, YouTube, Threads, LinkedIn). The creator is Phil.

For each comment return its sentiment toward Phil or the post, and whether it is a question for Phil.

Sentiment rules:
- positive: praise, thanks, congratulations, encouragement, laughter at a joke, agreement, hype. Emoji-only comments made of laughing faces, fire, hearts, clapping, 100, goat, salute or thumbs up are positive. Friendly roasting or banter with laughing emoji is positive.
- negative: hostility, insults, accusations of scamming or lying, disgust, complaints about Phil or the content, dismissive or mocking without warmth.
- neutral: factual remarks, tags of other users, off-topic chatter, ambiguous emoji, empty text.

q is true only when the commenter asks Phil something that wants an answer (a real question, not "what a legend" or rhetorical hype).

Answer with JSON only: {"labels":[{"i":<index>,"s":"positive|neutral|negative","q":true|false}, ...]} covering every index given."""


class GroqBudget:
    def __init__(self) -> None:
        self.calls = 0
        self.last_call: dict[str, float] = {}
        self.cursor = 0
        self.disabled: set[str] = set()
        # Why each call failed, so a slow run can be read from its log
        # instead of guessed at (2026-09-05: a rerun sat silent for ten
        # minutes and nothing said whether it was 429s, timeouts or bad JSON).
        self.errors: dict[str, int] = {}
        self.slow_seconds = 0.0
        # A model that answered 429 sits out until this monotonic time while
        # the others keep working. Sleeping on the 429 instead stalled whole
        # runs: gpt-oss has an 8K tokens-per-minute window that one 25-comment
        # batch nearly fills, so every other hit on it was a 30s wait.
        self.cooldown_until: dict[str, float] = {}

    def fail(self, kind: str) -> None:
        self.errors[kind] = self.errors.get(kind, 0) + 1

    def next_model(self) -> str | None:
        live = [m for m in GROQ_MODELS if m not in self.disabled]
        if not live:
            return None
        now = time.monotonic()
        ready = [m for m in live if self.cooldown_until.get(m, 0.0) <= now]
        if not ready:
            # Everything is cooling; wait for the first one to come back.
            soonest = min(live, key=lambda m: self.cooldown_until.get(m, 0.0))
            time.sleep(max(0.0, self.cooldown_until[soonest] - now))
            ready = [soonest]
        m = ready[self.cursor % len(ready)]
        self.cursor += 1
        return m

    def cool(self, model: str, seconds: float) -> None:
        self.cooldown_until[model] = time.monotonic() + max(1.0, min(seconds, 90.0))

    def pace(self, model: str) -> None:
        last = self.last_call.get(model)
        if last is not None:
            wait = MIN_SECONDS_BETWEEN_CALLS_PER_MODEL - (time.monotonic() - last)
            if wait > 0:
                time.sleep(wait)
        self.last_call[model] = time.monotonic()


def _groq_call(key: str, model: str, batch: list[str]) -> list[dict]:
    numbered = "\n".join(f"{i}: {json.dumps(t[:400], ensure_ascii=False)}" for i, t in enumerate(batch))
    payload = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"Comments:\n{numbered}"},
        ],
    }
    req = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": _UA,
        },
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        body = json.load(r)
    content = body["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    labels = parsed.get("labels") if isinstance(parsed, dict) else parsed
    return labels if isinstance(labels, list) else []


_RETRY_IN_RE = re.compile(r"try again in ([\d.]+)\s*(ms|s)", re.IGNORECASE)


def _retry_seconds(e: urllib.error.HTTPError) -> float:
    """Groq puts the wait in a Retry-After header (seconds, sometimes with a
    trailing 's') and in the body ("Please try again in 7.456s")."""
    raw = (e.headers.get("Retry-After") or "").strip().rstrip("s")
    try:
        if raw:
            return float(raw)
    except ValueError:
        pass
    try:
        m = _RETRY_IN_RE.search(e.read().decode("utf-8", "replace"))
        if m:
            v = float(m.group(1))
            return v / 1000.0 if m.group(2).lower() == "ms" else v
    except (OSError, ValueError):
        pass
    return 12.0


def llm_label(key: str, batch: list[str], budget: GroqBudget) -> dict[int, tuple[str, bool]]:
    """Label one batch. Returns {index: (sentiment, is_question)} for the items
    the model answered validly; anything missing falls back to the lexicon.
    A 429 does not count as an attempt or a call: the model is cooled and the
    batch goes to the next one."""
    out: dict[int, tuple[str, bool]] = {}
    attempts = 0
    spins = 0
    while attempts < 3 and spins < 12 and budget.calls < MAX_CALLS_PER_RUN:
        spins += 1
        model = budget.next_model()
        if model is None:
            break
        budget.pace(model)
        started = time.monotonic()
        try:
            labels = _groq_call(key, model, batch)
        except urllib.error.HTTPError as e:
            budget.fail(f"http{e.code}:{model.split('/')[-1]}")
            if e.code == 429:
                budget.cool(model, _retry_seconds(e))
                continue
            attempts += 1
            budget.calls += 1
            if e.code in (400, 404):
                budget.disabled.add(model)  # model gone or refuses the schema
                continue
            if e.code >= 500:
                time.sleep(3.0 * attempts)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError) as e:
            budget.fail(f"{type(e).__name__}:{model.split('/')[-1]}")
            attempts += 1
            budget.calls += 1
            time.sleep(2.0 * attempts)
            continue
        finally:
            budget.slow_seconds += time.monotonic() - started
        attempts += 1
        budget.calls += 1
        for item in labels:
            if not isinstance(item, dict):
                continue
            try:
                i = int(item.get("i"))
            except (TypeError, ValueError):
                continue
            s = str(item.get("s") or "").strip().lower()
            q = item.get("q")
            if 0 <= i < len(batch) and s in LABELS and isinstance(q, bool):
                out[i] = (s, q)
        if len(out) >= max(1, int(len(batch) * 0.8)):
            break
    return out


# --------------------------------------------------------------------------
# driver
# --------------------------------------------------------------------------
def _needs_label(c: dict, have_key: bool) -> bool:
    if c.get("sentimentV") != SENTIMENT_VERSION or c.get("sentiment") not in LABELS:
        return True
    return have_key and c.get("sentimentSource") != "llm"


def classify_comments(comments: list[dict], key: str | None = None, log=print) -> dict:
    """Label every comment that is missing a current label. Mutates the
    records in place and returns counts. Lexicon first for all of them, then
    the model overwrites what it can when a key is present."""
    key = key or os.environ.get("GROQ_API_KEY") or None
    todo = [c for c in comments if _needs_label(c, bool(key))]
    stats = {"total": len(comments), "queued": len(todo), "lexicon": 0, "llm": 0, "calls": 0, "skipped": len(comments) - len(todo)}
    if not todo:
        return stats

    for c in todo:
        label, q, _conf = lexicon_label(c.get("text") or "")
        if c.get("sentimentSource") != "llm" or c.get("sentimentV") != SENTIMENT_VERSION:
            c["sentiment"], c["isQuestion"] = label, q
            c["sentimentSource"] = "lexicon"
            c["sentimentV"] = SENTIMENT_VERSION
            stats["lexicon"] += 1

    if not key:
        log(f"sentiment: no GROQ_API_KEY in the environment, {stats['lexicon']} comments labeled by lexicon only "
            f"(run through secret-sync run GROQ_API_KEY -- ... to use the model)")
        return stats

    pending = [c for c in todo if c.get("sentimentSource") != "llm"]
    budget = GroqBudget()
    for start in range(0, len(pending), BATCH_SIZE):
        batch_records = pending[start:start + BATCH_SIZE]
        got = llm_label(key, [c.get("text") or "" for c in batch_records], budget)
        for i, (s, q) in got.items():
            rec = batch_records[i]
            rec["sentiment"], rec["isQuestion"] = s, q
            rec["sentimentSource"] = "llm"
            rec["sentimentV"] = SENTIMENT_VERSION
            stats["llm"] += 1
        if budget.calls and budget.calls % 10 == 0:
            log(f"sentiment: {stats['llm']} labeled by model so far, {budget.calls} calls, "
                f"{budget.slow_seconds / budget.calls:.1f}s per call, errors {budget.errors or 'none'}")
        if budget.calls >= MAX_CALLS_PER_RUN or budget.next_model() is None:
            log("sentiment: model budget for this run is spent; the rest keep lexicon labels until the next run")
            break
    stats["lexicon"] = sum(1 for c in comments if c.get("sentimentSource") == "lexicon")
    stats["calls"] = budget.calls
    log(f"sentiment: {stats['llm']} by model, {stats['lexicon']} by lexicon, {stats['skipped']} already current, "
        f"{budget.calls} calls, errors {budget.errors or 'none'}")
    return stats


def distribution(comments: Iterable[dict]) -> dict:
    from collections import Counter
    cs = list(comments)
    return {
        "sentiment": dict(Counter(c.get("sentiment") or "neutral" for c in cs)),
        "questions": sum(1 for c in cs if c.get("isQuestion")),
        "sources": dict(Counter(c.get("sentimentSource") or "none" for c in cs)),
    }
