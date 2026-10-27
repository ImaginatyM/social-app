#!/usr/bin/env python3
"""Network-resilient wrapper for the frozen real-world holdout.

Only the live-source transport is changed: the current mlx-lm release snapshot is fetched
once and reused for RAW/PROOF_FOCUS, with non-API GitHub release-feed/HTML fallbacks.
Task prompts, tool semantics and scorers remain those from friday_real_world_holdout.py.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any

import friday_real_world_holdout as holdout

_CACHE: dict[str, Any] | None = None


def _open(url: str, timeout: int = 20):
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json,text/html,application/atom+xml;q=0.9,*/*;q=0.8",
            "User-Agent": "friday-public-benchmark/1.0",
        },
    )
    return urllib.request.urlopen(request, timeout=timeout)


def _github_release_tag() -> tuple[str, str]:
    errors: list[str] = []
    try:
        with _open("https://github.com/ml-explore/mlx-lm/releases.atom") as response:
            payload = response.read()
        root = ET.fromstring(payload)
        namespace = {"a": "http://www.w3.org/2005/Atom"}
        entry = root.find("a:entry", namespace)
        title = entry.findtext("a:title", default="", namespaces=namespace) if entry is not None else ""
        match = re.search(r"v?(\d+\.\d+\.\d+)", title)
        if match:
            return match.group(1), "GitHub mlx-lm releases Atom feed"
        errors.append(f"atom:no-version:{title[:80]}")
    except Exception as exc:
        errors.append(f"atom:{type(exc).__name__}:{exc}")

    try:
        with _open("https://github.com/ml-explore/mlx-lm/releases/latest") as response:
            final_url = response.geturl()
            html = response.read(200_000).decode("utf-8", errors="ignore")
        match = re.search(r"/releases/tag/v?(\d+\.\d+\.\d+)", final_url)
        if not match:
            match = re.search(r"/releases/tag/v?(\d+\.\d+\.\d+)", html)
        if match:
            return match.group(1), "GitHub mlx-lm releases page"
        errors.append("html:no-version")
    except Exception as exc:
        errors.append(f"html:{type(exc).__name__}:{exc}")

    raise RuntimeError("GitHub release source unavailable: " + " | ".join(errors))


def live_snapshot() -> dict[str, Any]:
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    with _open("https://pypi.org/pypi/mlx-lm/json") as response:
        pypi = json.loads(response.read().decode("utf-8"))
    pypi_version = str(pypi["info"]["version"])
    github_version, github_label = _github_release_tag()
    _CACHE = {
        "version": pypi_version,
        "github_version": github_version,
        "sources": [
            {"id": "PYPI", "title": "PyPI mlx-lm", "version": pypi_version},
            {"id": "GITHUB", "title": github_label, "tag": f"v{github_version}"},
        ],
        "agree": pypi_version == github_version,
    }
    print("LIVE_SOURCE_SNAPSHOT=" + json.dumps(_CACHE, ensure_ascii=False, separators=(",", ":")), flush=True)
    return _CACHE


def research_handle(self: holdout.LiveResearch, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name != "research.web.search":
        return holdout.HoldoutTask.handle(self, name, arguments)
    self.searched = True
    try:
        snapshot = live_snapshot()
    except Exception as exc:
        return {"status": "failed", "error": f"LIVE_SOURCES_UNAVAILABLE:{type(exc).__name__}:{exc}"}
    self.version = str(snapshot["version"])
    return {
        "status": "executed",
        "query": arguments.get("query", ""),
        "sources": snapshot["sources"],
        "sources_agree": snapshot["agree"],
    }


def composite_handle(
    self: holdout.CompositeResearchReport, name: str, arguments: dict[str, Any]
) -> dict[str, Any]:
    if name == "research.web.search":
        self.searched = True
        try:
            snapshot = live_snapshot()
        except Exception as exc:
            return {"status": "failed", "error": f"LIVE_SOURCES_UNAVAILABLE:{type(exc).__name__}:{exc}"}
        self.version = str(snapshot["version"])
        return {
            "status": "executed",
            "sources": snapshot["sources"],
            "sources_agree": snapshot["agree"],
        }
    if name == "workspace.write":
        path = str(arguments.get("path", ""))
        content = str(arguments.get("content", ""))
        if path != "reports/mlx.txt":
            return {"status": "failed", "error": "WRONG_PATH"}
        destination = self.root / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content, encoding="utf-8")
        self.written = bool(
            self.version
            and self.version in content
            and "PYPI" in content.upper()
            and "GITHUB" in content.upper()
        )
        return {"status": "executed", "written": self.written, "path": path}
    if name == "workspace.read":
        path = self.root / str(arguments.get("path", ""))
        if path.exists():
            if self.written:
                self.read_after_write = True
            return {"status": "executed", "content": path.read_text(encoding="utf-8")}
        return {"status": "failed", "error": "FILE_NOT_FOUND"}
    return holdout.HoldoutTask.handle(self, name, arguments)


holdout.LiveResearch.handle = research_handle
holdout.CompositeResearchReport.handle = composite_handle

if __name__ == "__main__":
    raise SystemExit(holdout.main())
