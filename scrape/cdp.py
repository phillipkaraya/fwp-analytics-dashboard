"""
Minimal Chrome DevTools Protocol client.

Connects to an already-running Chrome on a debugging port (CHROME_CDP_PORT,
default 9222), opens ITS OWN tab, and runs JavaScript via Runtime.evaluate
to capture API responses. Cookies and auth flow naturally because the tab
lives in Chrome's default (logged-in) context.

Tab ownership rule: this client never navigates or closes a tab it did not
create. Other Claude Code sessions and Phil's own browsing share this Chrome
(see ~/.claude/rules/browser-concurrency.md). Every tab opened through
new_tab() is recorded in `owned_tabs` and closed by close_owned().

Usage:
    cdp = CDP()
    try:
        cdp.new_tab("https://www.instagram.com/phillip.karaya/")   # opens + attaches
        cdp.wait_for_load(timeout=15)
        data = cdp.evaluate("fetch('/api/v1/...').then(r=>r.json())", await_promise=True)
    finally:
        cdp.close_owned()
        cdp.detach()
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Optional

import websocket  # pip install websocket-client

DEFAULT_PORT = 9222


def default_port() -> int:
    try:
        return int(os.environ.get("CHROME_CDP_PORT") or DEFAULT_PORT)
    except ValueError:
        return DEFAULT_PORT


class CDPError(RuntimeError):
    pass


@dataclass
class Tab:
    id: str
    url: str
    ws_url: str


class CDP:
    def __init__(self, port: Optional[int] = None):
        self.port = port or default_port()
        self.ws: Optional[websocket.WebSocket] = None
        self._msg_id = 0
        self.owned_tabs: list[str] = []
        self._current: Optional[Tab] = None

    # --- HTTP layer (tab management) -------------------------------------
    def _http(self, path: str, method: str = "GET") -> Any:
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}", method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=3) as r:
                raw = r.read()
                return json.loads(raw) if raw.strip().startswith(b"{") or raw.strip().startswith(b"[") else raw.decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            raise CDPError(
                f"Cannot reach Chrome on :{self.port} ({e}). "
                f"Is Chrome running with --remote-debugging-port={self.port}?"
            ) from e

    def list_tabs(self) -> list[Tab]:
        items = self._http("/json")
        return [
            Tab(id=t["id"], url=t["url"], ws_url=t["webSocketDebuggerUrl"])
            for t in items
            if t.get("type") == "page"
        ]

    def new_tab(self, url: str) -> Tab:
        """Create a brand-new tab at `url`, record it as ours, and attach.

        Chrome requires PUT for /json/new since v111. Never falls back to
        reusing an existing tab: that tab could belong to another session
        or to Phil.
        """
        data = self._http(f"/json/new?{urllib.parse.quote(url, safe=':/?&=@%')}", method="PUT")
        if not isinstance(data, dict) or "id" not in data:
            raise CDPError(f"/json/new did not return a tab: {str(data)[:200]}")
        tab = Tab(id=data["id"], url=data.get("url", url), ws_url=data["webSocketDebuggerUrl"])
        self.owned_tabs.append(tab.id)
        self.attach(tab)
        # A brand-new target sits on about:blank (readyState "complete") for
        # a few hundred ms before the real navigation commits. Wait for an
        # http(s) URL so callers' wait_for_load() reads the right document.
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                href = self.evaluate("window.location.href") or ""
            except CDPError:
                href = ""
            if href.startswith("http"):
                break
            time.sleep(0.2)
        return tab

    def add_init_script(self, source: str) -> None:
        """Run `source` in the attached tab before any page script on every
        future navigation/reload. This is how request hooks catch the very
        first fetch a SPA fires during load, which a post-load install misses."""
        if not self._current or self._current.id not in self.owned_tabs:
            raise CDPError("add_init_script() only works on a tab this client opened")
        self._send("Page.addScriptToEvaluateOnNewDocument", {"source": source})

    def navigate(self, url: str) -> None:
        """Navigate the currently attached tab. Refuses if the tab is not ours."""
        if not self._current or self._current.id not in self.owned_tabs:
            raise CDPError("navigate() only works on a tab this client opened")
        self._send("Page.navigate", {"url": url})

    def close_owned(self) -> None:
        """Close every tab this client created. Safe to call repeatedly."""
        for tab_id in list(self.owned_tabs):
            try:
                self._http(f"/json/close/{tab_id}")
            except CDPError:
                pass
            self.owned_tabs.remove(tab_id)

    # --- WebSocket layer (per-tab debugger) ------------------------------
    def attach(self, tab: Tab) -> None:
        self.detach()
        # Chrome 111+ requires --remote-allow-origins or for the client to
        # omit the Origin header entirely. We're not a browser, so we drop it.
        self.ws = websocket.create_connection(
            tab.ws_url, timeout=30, suppress_origin=True
        )
        self._current = tab
        self._send("Page.enable")
        self._send("Runtime.enable")

    def detach(self) -> None:
        if self.ws:
            try:
                self.ws.close()
            except Exception:  # noqa: BLE001
                pass
        self.ws = None
        self._current = None

    def _send(self, method: str, params: Optional[dict] = None) -> dict:
        if not self.ws:
            raise CDPError("Not attached to a tab")
        self._msg_id += 1
        msg = {"id": self._msg_id, "method": method, "params": params or {}}
        self.ws.send(json.dumps(msg))
        # Drain messages until we see the matching id (skip events).
        deadline = time.time() + 30
        while time.time() < deadline:
            raw = self.ws.recv()
            data = json.loads(raw)
            if data.get("id") == self._msg_id:
                if "error" in data:
                    raise CDPError(f"{method} failed: {data['error']}")
                return data.get("result", {})
        raise CDPError(f"Timed out waiting for response to {method}")

    def wait_for_load(self, timeout: int = 15, expect_url_substring: Optional[str] = None) -> None:
        """Wait until document.readyState is complete (and optionally that the
        URL contains an expected substring — useful when we've just kicked off
        a Page.navigate and don't want to read the OLD page state)."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                ready = self.evaluate("document.readyState")
                url = self.evaluate("window.location.href") or ""
                url_ok = expect_url_substring is None or expect_url_substring in url
                if ready in ("complete", "interactive") and url_ok:
                    return
            except CDPError:
                pass
            time.sleep(0.25)

    def evaluate(self, expression: str, await_promise: bool = False) -> Any:
        result = self._send(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": await_promise,
                "timeout": 30000,
            },
        )
        if result.get("exceptionDetails"):
            details = result["exceptionDetails"]
            raise CDPError(f"JS exception: {details.get('text')} {details.get('exception', {}).get('description', '')}")
        return result.get("result", {}).get("value")
