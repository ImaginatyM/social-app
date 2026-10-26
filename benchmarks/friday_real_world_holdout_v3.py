#!/usr/bin/env python3
"""Outcome-aware wrapper for the frozen real-world holdout.

Keeps v2's cached resilient live sources. Changes only two generic evaluation/execution
semantics:
- research citations are semantic (PyPI + GitHub names/IDs, not bracket formatting);
- a failed/unavailable or explicitly-negative mutation result is not treated as achieved
  task progress, so PROOF_FOCUS gets a bounded chance to replan.
"""
from __future__ import annotations

import re
from typing import Any

import friday_real_world_holdout_v2 as v2

h = v2.holdout
_base_gaps = h.gaps

_NEGATIVE_KEYS = {
    "passed",
    "valid",
    "success",
    "ok",
    "written",
    "moved",
    "appended",
    "changed",
    "compiled",
}
_MUTATION = re.compile(r"(?:send|write|move|rename|update|create|delete|apply|patch|merge|trigger|set|install|publish|append)", re.I)


def explicit_negative(value: Any) -> bool:
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in _NEGATIVE_KEYS and item is False:
                return True
            if key.lower() in {"failed", "errors", "violations"}:
                if isinstance(item, (int, float)) and item > 0:
                    return True
                if isinstance(item, list) and len(item) > 0:
                    return True
            if explicit_negative(item):
                return True
    elif isinstance(value, list):
        return any(explicit_negative(item) for item in value)
    return False


def acceptable_mutation_result(result: dict[str, Any]) -> bool:
    status = str(result.get("status", ""))
    if status in {"requires_approval", "denied"}:
        return True
    if status != "executed":
        return False
    return not explicit_negative(result)


def outcome_aware_gaps(task: h.HoldoutTask, trace: h.Trace, visible_tools: list[h.base.ToolSpec]) -> list[str]:
    missing = list(_base_gaps(task, trace, visible_tools))
    required = h.obligations(task.user, visible_tools)
    if "core_terminal_state" in required:
        mutations = [call for call in trace.tool_calls if _MUTATION.search(call["name"])]
        if mutations and not any(acceptable_mutation_result(call["result"]) for call in mutations):
            if "core_terminal_state" not in missing:
                missing.append("core_terminal_state")
    return missing


def semantic_research_score(self: h.LiveResearch, trace: h.Trace):
    answer = h.base.normalize(trace.final_answer)
    version_ok = bool(self.version and self.version.lower() in answer)
    source_mentions = ("pypi" in answer) and ("github" in answer)
    distractors = sum(call["name"] in {tool.name for tool in h.DISTRACTORS} for call in trace.tool_calls)
    detail = {
        "searched": self.searched,
        "version": self.version,
        "version_ok": version_ok,
        "two_sources_semantic": source_mentions,
        "distractors": distractors,
    }
    return self.searched and version_ok and source_mentions, detail


h.gaps = outcome_aware_gaps
h.LiveResearch.score = semantic_research_score

if __name__ == "__main__":
    raise SystemExit(h.main())
