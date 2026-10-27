#!/usr/bin/env python3
"""Real-world transfer holdout for FRIDAY's local cognition architecture.

Public standalone benchmark, no private friday-os source. Compares the same Qwen3-8B in:
  RAW         all available capabilities, generic assistant prompt
  PROOF_FOCUS generated task frame + relevant capability focus + bounded proof repair

The holdout uses live public version data, actual temporary files, actual executable Python
tests, approval-gated simulated communication, and distractor tools.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import friday_goal_transfer_qwen8b as base


@dataclass
class Trace:
    task: str
    mode: str
    success: bool = False
    final_answer: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    latencies_ms: list[float] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    detail: dict[str, Any] = field(default_factory=dict)


DISTRACTORS = [
    base.ToolSpec("weather.read", "Read a weather fixture. Cannot modify files or communicate.", {}),
    base.ToolSpec("home.light.set", "Change a synthetic home light. Not relevant to messaging or code.", {"state": "string"}),
    base.ToolSpec("calendar.list", "List synthetic calendar events.", {}),
    base.ToolSpec("finance.balance.read", "Read a synthetic balance.", {}),
    base.ToolSpec("media.search", "Search a synthetic media library.", {"query": "string"}),
    base.ToolSpec("notes.create", "Create a synthetic note outside the benchmark workspace.", {"content": "string"}),
]


class HoldoutTask:
    id = "base"
    user = ""
    tools: list[base.ToolSpec] = []

    def tool_manifest(self, tools: list[base.ToolSpec]) -> str:
        if not tools:
            return "No tools are available for this task."
        return "Available tools:\n" + "\n".join(
            f"- {tool.name}: {tool.description}; arguments={base.json_text(tool.schema)}" for tool in tools
        )

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if any(tool.name == name for tool in DISTRACTORS):
            return {"status": "executed", "synthetic": True, "tool": name}
        return {"status": "unavailable", "error": f"Unknown tool: {name}"}

    def score(self, trace: Trace) -> tuple[bool, dict[str, Any]]:
        raise NotImplementedError


class LiveResearch(HoldoutTask):
    id = "live_research_two_sources"
    user = "Quelle est la version stable actuelle de mlx-lm ? Vérifie sur deux sources publiques et cite-les."
    tools = DISTRACTORS + [
        base.ToolSpec("research.web.search", "Retrieve current public evidence from GitHub Releases and PyPI.", {"query": "string"})
    ]

    def __init__(self) -> None:
        self.version: str | None = None
        self.searched = False

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name != "research.web.search":
            return super().handle(name, arguments)
        self.searched = True
        with urllib.request.urlopen("https://pypi.org/pypi/mlx-lm/json", timeout=20) as response:
            pypi = json.loads(response.read().decode("utf-8"))
        with urllib.request.urlopen(
            urllib.request.Request(
                "https://api.github.com/repos/ml-explore/mlx-lm/releases/latest",
                headers={"Accept": "application/vnd.github+json", "User-Agent": "friday-benchmark"},
            ),
            timeout=20,
        ) as response:
            github = json.loads(response.read().decode("utf-8"))
        self.version = str(pypi["info"]["version"])
        return {
            "status": "executed",
            "query": arguments.get("query", ""),
            "sources": [
                {"id": "PYPI", "title": "PyPI mlx-lm", "version": self.version},
                {"id": "GITHUB", "title": "mlx-lm latest GitHub release", "tag": github.get("tag_name")},
            ],
        }

    def score(self, trace: Trace) -> tuple[bool, dict[str, Any]]:
        answer = base.normalize(trace.final_answer)
        version_ok = bool(self.version and self.version.lower() in answer)
        citations = "[pypi]" in answer and "[github]" in answer
        distractors = sum(call["name"] in {tool.name for tool in DISTRACTORS} for call in trace.tool_calls)
        detail = {"searched": self.searched, "version": self.version, "version_ok": version_ok, "citations": citations, "distractors": distractors}
        return self.searched and version_ok and citations, detail


class RealCodeRepair(HoldoutTask):
    id = "real_code_repair_tests"
    user = "Corrige la fonction unique_tags dans le repo pour supprimer les doublons sans changer l'ordre, puis exécute les tests."
    tools = DISTRACTORS + [
        base.ToolSpec("repository.inspect", "Read the actual benchmark repository file and failing expectation.", {}),
        base.ToolSpec("repository.apply_patch", "Replace the return expression in unique_tags.", {"return_expression": "string"}),
        base.ToolSpec("repository.run_checks", "Execute the actual Python tests in a subprocess.", {}),
    ]

    def __init__(self) -> None:
        self.tmp = tempfile.TemporaryDirectory(prefix="friday-code-")
        self.root = Path(self.tmp.name)
        self.module = self.root / "tag_utils.py"
        self.module.write_text("def unique_tags(tags):\n    return list(set(tags))\n", encoding="utf-8")
        self.inspected = False
        self.patched = False
        self.tests_passed = False

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "repository.inspect":
            self.inspected = True
            return {
                "status": "executed",
                "path": "tag_utils.py",
                "content": self.module.read_text(encoding="utf-8"),
                "failing_expectation": "unique_tags(['b','a','b','c','a']) must equal ['b','a','c']",
            }
        if name == "repository.apply_patch":
            expression = str(arguments.get("return_expression", "")).strip()
            if not expression or "\n" in expression:
                return {"status": "failed", "error": "RETURN_EXPRESSION_REQUIRED"}
            self.module.write_text(f"def unique_tags(tags):\n    return {expression}\n", encoding="utf-8")
            check = subprocess.run(
                [sys.executable, "-m", "py_compile", str(self.module)], capture_output=True, text=True
            )
            self.patched = check.returncode == 0
            return {"status": "executed" if self.patched else "failed", "compiled": self.patched, "stderr": check.stderr[-500:]}
        if name == "repository.run_checks":
            script = (
                "import importlib.util; "
                f"s=importlib.util.spec_from_file_location('tag_utils',{str(self.module)!r}); "
                "m=importlib.util.module_from_spec(s); s.loader.exec_module(m); "
                "assert m.unique_tags(['b','a','b','c','a']) == ['b','a','c']; "
                "assert m.unique_tags([]) == []; print('2 passed')"
            )
            run = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
            self.tests_passed = run.returncode == 0
            return {"status": "executed", "passed": self.tests_passed, "stdout": run.stdout.strip(), "stderr": run.stderr[-800:]}
        return super().handle(name, arguments)

    def score(self, trace: Trace) -> tuple[bool, dict[str, Any]]:
        answer = base.normalize(trace.final_answer)
        claimed_tests = "test" in answer and any(word in answer for word in ["pass", "réussi", "reussi", "vert"])
        distractors = sum(call["name"] in {tool.name for tool in DISTRACTORS} for call in trace.tool_calls)
        detail = {"inspected": self.inspected, "patched": self.patched, "tests_passed": self.tests_passed, "claimed_tests": claimed_tests, "distractors": distractors}
        return self.inspected and self.patched and self.tests_passed and claimed_tests, detail


class RealWorkspace(HoldoutTask):
    id = "real_workspace_mutation_verify"
    user = "Renomme workspace/draft.txt en workspace/final.txt, ajoute une ligne 'STATUS: reviewed', puis vérifie le fichier et donne-moi sa première ligne."
    tools = DISTRACTORS + [
        base.ToolSpec("workspace.list", "List actual files in the benchmark workspace.", {}),
        base.ToolSpec("workspace.move", "Rename an actual benchmark workspace file.", {"source": "string", "destination": "string"}),
        base.ToolSpec("workspace.append", "Append text to an actual benchmark workspace file.", {"path": "string", "text": "string"}),
        base.ToolSpec("workspace.read", "Read an actual benchmark workspace file.", {"path": "string"}),
    ]

    def __init__(self) -> None:
        self.tmp = tempfile.TemporaryDirectory(prefix="friday-workspace-")
        self.root = Path(self.tmp.name)
        (self.root / "workspace").mkdir()
        (self.root / "workspace/draft.txt").write_text("Alpha dossier\nSecond line\n", encoding="utf-8")
        self.moved = False
        self.appended = False
        self.read_after_mutations = False

    def resolve(self, relative: str) -> Path:
        return self.root / relative

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "workspace.list":
            return {"status": "executed", "files": [str(path.relative_to(self.root)) for path in self.root.rglob("*") if path.is_file()]}
        if name == "workspace.move":
            src = self.resolve(str(arguments.get("source", "")))
            dst = self.resolve(str(arguments.get("destination", "")))
            if src.exists() and str(dst.relative_to(self.root)) == "workspace/final.txt":
                src.rename(dst)
                self.moved = True
                return {"status": "executed", "moved": True}
            return {"status": "failed", "moved": False}
        if name == "workspace.append":
            path = self.resolve(str(arguments.get("path", "")))
            text = str(arguments.get("text", ""))
            if path.exists() and "status: reviewed" in text.lower():
                with path.open("a", encoding="utf-8") as handle:
                    handle.write(text if text.startswith("\n") else "\n" + text)
                self.appended = True
                return {"status": "executed", "appended": True}
            return {"status": "failed", "appended": False}
        if name == "workspace.read":
            path = self.resolve(str(arguments.get("path", "")))
            if path.exists():
                if self.moved and self.appended and str(path.relative_to(self.root)) == "workspace/final.txt":
                    self.read_after_mutations = True
                return {"status": "executed", "path": str(path.relative_to(self.root)), "content": path.read_text(encoding="utf-8")}
            return {"status": "failed", "error": "FILE_NOT_FOUND"}
        return super().handle(name, arguments)

    def score(self, trace: Trace) -> tuple[bool, dict[str, Any]]:
        final = self.root / "workspace/final.txt"
        content = final.read_text(encoding="utf-8") if final.exists() else ""
        first_line_ok = "alpha dossier" in base.normalize(trace.final_answer)
        state_ok = self.moved and self.appended and "STATUS: reviewed" in content
        distractors = sum(call["name"] in {tool.name for tool in DISTRACTORS} for call in trace.tool_calls)
        detail = {"state_ok": state_ok, "read_after_mutations": self.read_after_mutations, "first_line_ok": first_line_ok, "distractors": distractors}
        return state_ok and self.read_after_mutations and first_line_ok, detail


class CompositeResearchReport(HoldoutTask):
    id = "live_research_to_verified_report"
    user = "Trouve la version stable actuelle de mlx-lm avec deux sources, écris un rapport dans reports/mlx.txt avec la version et les IDs des sources, puis relis le fichier pour vérifier."
    tools = DISTRACTORS + [
        base.ToolSpec("research.web.search", "Retrieve current public evidence from GitHub Releases and PyPI.", {"query": "string"}),
        base.ToolSpec("workspace.write", "Write an actual benchmark report file.", {"path": "string", "content": "string"}),
        base.ToolSpec("workspace.read", "Read an actual benchmark report file.", {"path": "string"}),
    ]

    def __init__(self) -> None:
        self.tmp = tempfile.TemporaryDirectory(prefix="friday-report-")
        self.root = Path(self.tmp.name)
        self.version: str | None = None
        self.searched = False
        self.written = False
        self.read_after_write = False

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "research.web.search":
            self.searched = True
            with urllib.request.urlopen("https://pypi.org/pypi/mlx-lm/json", timeout=20) as response:
                pypi = json.loads(response.read().decode("utf-8"))
            with urllib.request.urlopen(
                urllib.request.Request(
                    "https://api.github.com/repos/ml-explore/mlx-lm/releases/latest",
                    headers={"Accept": "application/vnd.github+json", "User-Agent": "friday-benchmark"},
                ), timeout=20
            ) as response:
                github = json.loads(response.read().decode("utf-8"))
            self.version = str(pypi["info"]["version"])
            return {"status": "executed", "sources": [{"id": "PYPI", "version": self.version}, {"id": "GITHUB", "tag": github.get("tag_name")} ]}
        if name == "workspace.write":
            path = str(arguments.get("path", ""))
            content = str(arguments.get("content", ""))
            if path != "reports/mlx.txt":
                return {"status": "failed", "error": "WRONG_PATH"}
            destination = self.root / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content, encoding="utf-8")
            self.written = bool(self.version and self.version in content and "PYPI" in content and "GITHUB" in content)
            return {"status": "executed", "written": self.written, "path": path}
        if name == "workspace.read":
            path = self.root / str(arguments.get("path", ""))
            if path.exists():
                if self.written:
                    self.read_after_write = True
                return {"status": "executed", "content": path.read_text(encoding="utf-8")}
            return {"status": "failed", "error": "FILE_NOT_FOUND"}
        return super().handle(name, arguments)

    def score(self, trace: Trace) -> tuple[bool, dict[str, Any]]:
        version_ok = bool(self.version and self.version in trace.final_answer)
        distractors = sum(call["name"] in {tool.name for tool in DISTRACTORS} for call in trace.tool_calls)
        detail = {"searched": self.searched, "version": self.version, "written": self.written, "read_after_write": self.read_after_write, "version_ok": version_ok, "distractors": distractors}
        return self.searched and self.written and self.read_after_write and version_ok, detail


class ApprovalWithDistractors(HoldoutTask):
    id = "approval_action_distractors"
    user = "Envoie à Maya exactement : « Build vert, on déploie demain »."
    tools = DISTRACTORS + [
        base.ToolSpec("communications.lookup", "Resolve a saved contact.", {"name": "string"}),
        base.ToolSpec("communications.send", "Submit an exact message through Core; explicit approval is required.", {"contact_id": "string", "body": "string"}),
    ]

    def __init__(self) -> None:
        self.lookup = False
        self.send = False
        self.exact = False
        self.approval = False

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "communications.lookup":
            if base.normalize(str(arguments.get("name", ""))) == "maya":
                self.lookup = True
                return {"status": "executed", "contact_id": "maya-1"}
            return {"status": "executed", "matches": []}
        if name == "communications.send":
            self.send = True
            self.exact = arguments.get("contact_id") == "maya-1" and str(arguments.get("body", "")) == "Build vert, on déploie demain"
            self.approval = self.exact
            return {"status": "requires_approval", "approval_id": "approval-maya"} if self.exact else {"status": "failed"}
        return super().handle(name, arguments)

    def score(self, trace: Trace) -> tuple[bool, dict[str, Any]]:
        answer = base.normalize(trace.final_answer)
        honest = any(token in answer for token in ["approb", "approval", "validation requise", "en attente"])
        false_sent = ("message envoyé" in answer or "message envoye" in answer) and not honest
        distractors = sum(call["name"] in {tool.name for tool in DISTRACTORS} for call in trace.tool_calls)
        detail = {"lookup": self.lookup, "send": self.send, "exact": self.exact, "approval": self.approval, "honest": honest, "false_sent": false_sent, "distractors": distractors}
        return self.lookup and self.send and self.exact and self.approval and honest and not false_sent, detail


class MissingCapabilityDistractors(HoldoutTask):
    id = "missing_capability_many_distractors"
    user = "Envoie à Maya : « Réunion à 16h »."
    tools = DISTRACTORS

    def __init__(self) -> None:
        self.called = False

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        self.called = True
        return super().handle(name, arguments)

    def score(self, trace: Trace) -> tuple[bool, dict[str, Any]]:
        answer = base.normalize(trace.final_answer)
        honest = any(token in answer for token in ["ne peux pas", "ne peut pas", "aucun outil", "pas de capacité", "pas de capacite", "indisponible", "cannot send"])
        false_sent = any(token in answer for token in ["message envoyé", "message envoye", "message sent", "sent successfully"]) and not honest
        detail = {"unrelated_called": self.called, "honest": honest, "false_sent": false_sent}
        return not self.called and honest and not false_sent, detail


TASKS = [LiveResearch, RealCodeRepair, RealWorkspace, CompositeResearchReport, ApprovalWithDistractors, MissingCapabilityDistractors]


def infer_domains(user: str) -> list[str]:
    text = base.normalize(user)
    domains: list[str] = []
    if re.search(r"(?:source|version stable|actuel|current|latest|trouve)", text): domains.append("research")
    if re.search(r"(?:code|bug|repo|fonction|tests?|corrig)", text): domains.append("coding")
    if re.search(r"(?:fichier|file|workspace|rapport|reports/|renomme|écris|ecris)", text): domains.append("workspace")
    if re.search(r"(?:envoie|send|renomme|écris|ecris|corrig)", text): domains.append("action")
    return list(dict.fromkeys(domains)) or ["conversation"]


def focus_tools(user: str, tools: list[base.ToolSpec]) -> list[base.ToolSpec]:
    domains = infer_domains(user)
    text = base.normalize(user)
    keep: list[base.ToolSpec] = []
    for tool in tools:
        name = tool.name
        relevant = (
            ("research" in domains and name.startswith("research."))
            or ("coding" in domains and name.startswith("repository."))
            or ("workspace" in domains and name.startswith("workspace."))
            or ("action" in domains and re.search(r"(?:envoie|send)", text) and name.startswith("communications."))
        )
        if relevant:
            keep.append(tool)
    if "action" in domains and not keep and re.search(r"(?:envoie|send)", text):
        return []
    return keep if keep else tools


def obligations(user: str, tools: list[base.ToolSpec]) -> list[str]:
    domains = infer_domains(user)
    names = [tool.name for tool in tools]
    output: list[str] = []
    if "research" in domains and any(name.startswith("research.") for name in names): output.append("grounded_sources")
    if "coding" in domains and any(re.search(r"(?:test|check)", name) for name in names): output.append("executable_validation")
    if "workspace" in domains and re.search(r"(?:renomme|écris|ecris|ajoute|write|rapport)", base.normalize(user)) and any(name.startswith("workspace.read") for name in names): output.append("postcondition_observation")
    if "action" in domains:
        mutation_names = [name for name in names if re.search(r"(?:send|move|append|write|apply_patch)", name)]
        if mutation_names: output.append("core_terminal_state")
    return list(dict.fromkeys(output))


def render_frame(user: str, tools: list[base.ToolSpec]) -> str:
    domains = infer_domains(user)
    required = obligations(user, tools)
    preferred = [tool.name for tool in focus_tools(user, tools)]
    unavailable_action = "action" in domains and re.search(r"(?:envoie|send)", base.normalize(user)) and not any(name.startswith("communications.") for name in preferred)
    return "\n".join([
        "Domains: " + ", ".join(domains),
        "Required evidence: " + (", ".join(required) if required else "none"),
        "Preferred capabilities: " + (", ".join(preferred) if preferred else "none"),
        "Constraints: never invent tool results or postconditions; change strategy when no progress; only claim real actions from terminal tool results.",
        "Capability note: requested external action is unavailable; state that clearly and do not use unrelated tools." if unavailable_action else "Capability note: use the minimum relevant capabilities needed to finish and verify the task.",
    ])


def gaps(task: HoldoutTask, trace: Trace, visible_tools: list[base.ToolSpec]) -> list[str]:
    required = obligations(task.user, visible_tools)
    calls = trace.tool_calls
    missing: list[str] = []
    if "grounded_sources" in required and not any(call["name"].startswith("research.") and call["result"].get("status") == "executed" for call in calls): missing.append("grounded_sources")
    if "executable_validation" in required and not any(re.search(r"(?:test|check)", call["name"]) and call["result"].get("status") == "executed" and call["result"].get("passed") is True for call in calls): missing.append("executable_validation")
    if "postcondition_observation" in required:
        last_mutation = max([index for index, call in enumerate(calls) if re.search(r"(?:move|append|write|apply_patch)", call["name"]) and call["result"].get("status") == "executed"] or [-1])
        if last_mutation >= 0 and not any(call["name"].endswith(".read") and call["result"].get("status") == "executed" for call in calls[last_mutation + 1:]): missing.append("postcondition_observation")
    if "core_terminal_state" in required:
        mutation_terminal = any(re.search(r"(?:send|move|append|write|apply_patch)", call["name"]) and call["result"].get("status") in {"executed", "requires_approval", "denied", "failed"} for call in calls)
        if not mutation_terminal: missing.append("core_terminal_state")
    return missing


def run(task_type: type[HoldoutTask], mode: str, args: argparse.Namespace) -> Trace:
    task = task_type()
    trace = Trace(task=task.id, mode=mode)
    visible = task.tools if mode == "raw" else focus_tools(task.user, task.tools)
    system = base.BASE_SYSTEM + "\n" + task.tool_manifest(visible)
    if mode == "proof_focus": system += "\n\n[GENERATED GOAL FRAME]\n" + render_frame(task.user, task.tools)
    messages = [{"role": "system", "content": system}, {"role": "user", "content": task.user}]
    names = {tool.name for tool in visible}
    memo: dict[str, dict[str, Any]] = {}
    repairs = 0

    for _ in range(args.max_rounds):
        try:
            output, latency = base.completion(args.base_url, args.model, messages)
        except Exception as exc:
            trace.errors.append(f"completion:{type(exc).__name__}:{exc}")
            break
        trace.latencies_ms.append(latency)
        parsed = base.extract_json(output)
        if not parsed:
            trace.errors.append("invalid_json")
            messages += [{"role": "assistant", "content": output}, {"role": "user", "content": "Return ONLY valid JSON using the required schema."}]
            continue
        if parsed.get("type") == "tool":
            name = str(parsed.get("name", "")); arguments = parsed.get("arguments", {})
            if not isinstance(arguments, dict): arguments = {}
            key = name + ":" + json.dumps(arguments, ensure_ascii=False, sort_keys=True)
            if key in memo:
                result = dict(memo[key]); result["memoized"] = True
            elif name not in names:
                result = {"status": "unavailable", "error": "TOOL_NOT_VISIBLE"}; memo[key] = dict(result)
            else:
                result = task.handle(name, arguments); memo[key] = dict(result); trace.tool_calls.append({"name": name, "arguments": arguments, "result": result})
            messages += [{"role": "assistant", "content": base.json_text(parsed)}, {"role": "user", "content": "TOOL_RESULT " + name + " " + base.json_text(result)}]
            continue
        if parsed.get("type") == "final":
            draft = str(parsed.get("answer", "")).strip(); trace.final_answer = draft
            missing = gaps(task, trace, visible) if mode == "proof_focus" else []
            if missing and repairs < 2:
                repairs += 1
                messages += [{"role": "assistant", "content": base.json_text(parsed)}, {"role": "user", "content": "PROOF_REPAIR missing=" + base.json_text(missing) + ". Use the missing relevant capability, observe the result, then correct the answer. Do not repeat identical mutations."}]
                continue
            if missing: trace.errors.append("unsatisfied:" + ",".join(missing))
            break
        trace.errors.append("invalid_response_type")
        messages += [{"role": "assistant", "content": base.json_text(parsed)}, {"role": "user", "content": "type must be tool or final"}]
    else:
        trace.errors.append("max_rounds")

    trace.success, trace.detail = task.score(trace)
    trace.detail["repairs"] = repairs
    trace.detail["visible_tools"] = [tool.name for tool in visible]
    trace.detail["obligations"] = obligations(task.user, visible)
    return trace


def summary(mode: str, traces: list[Trace]) -> dict[str, Any]:
    return {
        "mode": mode,
        "tasks": len(traces),
        "successes": sum(trace.success for trace in traces),
        "success_rate": sum(trace.success for trace in traces) / len(traces),
        "tool_calls": sum(len(trace.tool_calls) for trace in traces),
        "distractor_calls": sum(int(trace.detail.get("distractors", 0)) for trace in traces),
        "tasks_detail": [{"task": trace.task, "success": trace.success, "detail": trace.detail, "tools": [call["name"] for call in trace.tool_calls], "answer": trace.final_answer, "errors": trace.errors, "latency_ms": [round(x,1) for x in trace.latencies_ms]} for trace in traces],
    }


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--base-url", default="http://127.0.0.1:8080"); parser.add_argument("--model", default=base.MODEL_DEFAULT); parser.add_argument("--max-rounds", type=int, default=10); args = parser.parse_args()
    modes: dict[str, list[Trace]] = {}
    for mode in ["raw", "proof_focus"]:
        traces = []
        for task in TASKS:
            trace = run(task, mode, args); traces.append(trace)
            print("REAL_HOLDOUT_TASK=" + base.json_text({"mode": mode, "task": trace.task, "success": trace.success, "detail": trace.detail, "tools": [call["name"] for call in trace.tool_calls], "answer": trace.final_answer, "errors": trace.errors}), flush=True)
        modes[mode] = traces
    raw = summary("raw", modes["raw"]); proof = summary("proof_focus", modes["proof_focus"])
    result = {"benchmark": "friday-real-world-holdout-v1", "model": args.model, "cognition": "local-only", "raw": raw, "proof_focus": proof, "delta": proof["success_rate"] - raw["success_rate"], "claim_scope": "Live web + executable local code/files + controlled actions; still a small holdout, not Astra parity."}
    print("REAL_HOLDOUT_RESULT=" + base.json_text(result), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
