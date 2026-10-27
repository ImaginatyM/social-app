#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import statistics
import tempfile
import time
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

MODEL_DEFAULT = "Qwen/Qwen3-8B-MLX-4bit"
BASE_SYSTEM = """You are FRIDAY, a local-only assistant. Return ONLY one JSON object per response.
Protocol:
- Tool call: {"type":"tool","name":"<available tool>","arguments":{...}}
- Final: {"type":"final","answer":"<concise answer>"}
Never claim a tool effect you did not observe. Use tools until the task's required evidence is complete.
If a tool reports a negative result, repair the task before finalizing. Do not invent paths, checks, sources, or approvals.
"""


def compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def post_json(url: str, payload: dict[str, Any], timeout: int = 180) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "friday-proof-microplan-benchmark/1"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode())


def get_json(url: str, timeout: int = 20) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": "friday-proof-microplan-benchmark/1"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode())


def current_mlx_snapshot() -> dict[str, Any]:
    try:
        pypi = get_json("https://pypi.org/pypi/mlx-lm/json")
        version = str(pypi.get("info", {}).get("version", "")).strip()
        if version:
            return {
                "version": version,
                "sources": [
                    {"id": "PYPI", "url": "https://pypi.org/project/mlx-lm/", "value": version},
                    {"id": "GITHUB", "url": "https://github.com/ml-explore/mlx-lm/releases", "value": version},
                ],
            }
    except Exception:
        pass
    # Frozen fallback is only used if the public network is unavailable; the result records this.
    return {
        "version": "0.32.2",
        "sources": [
            {"id": "PYPI", "url": "https://pypi.org/project/mlx-lm/", "value": "0.32.2"},
            {"id": "GITHUB", "url": "https://github.com/ml-explore/mlx-lm/releases", "value": "0.32.2"},
        ],
        "fallback": True,
    }


LIVE_SNAPSHOT = current_mlx_snapshot()


@dataclass
class Trace:
    task: str
    mode: str
    model_requests: int = 0
    request_latencies_ms: list[float] = field(default_factory=list)
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    repairs: int = 0
    final_answer: str = ""
    errors: list[str] = field(default_factory=list)
    success: bool = False
    detail: dict[str, Any] = field(default_factory=dict)


class Task:
    id = "base"
    user = ""
    goal = ""
    tools: dict[str, str] = {}

    def __init__(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="friday-microplan-")
        self.root = Path(self.temp.name)

    def manifest(self) -> str:
        return "\n".join(f"- {name}: {description}" for name, description in self.tools.items())

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def auto_proofs(
        self, name: str, arguments: dict[str, Any], result: dict[str, Any]
    ) -> list[tuple[str, dict[str, Any]]]:
        return []

    def gaps(self) -> list[str]:
        raise NotImplementedError

    def score(self, trace: Trace) -> tuple[bool, dict[str, Any]]:
        raise NotImplementedError


class RepoConfigRepair(Task):
    id = "repo_config_repair_unique_check"
    user = (
        "/no_think\nCorrige config.json dans le repo : la liste tags doit supprimer les doublons en conservant "
        "l'ordre, sans modifier les autres champs. Inspecte le fichier, écris la correction, puis exécute le check allowlisté."
    )
    goal = (
        "Goal: repair the repository file. Required evidence: observe source state, perform the exact local write, "
        "observe the written file, and obtain a passing allowlisted repository check. The only allowed check id is unit."
    )
    tools = {
        "repo.file.read": "Read config.json from the isolated worktree. arguments: {path}",
        "repo.file.write": "Write config.json in the isolated worktree. arguments: {path, content}",
        "repo.check": "Run the only allowlisted semantic check. arguments: {checkId}; checkId must be unit.",
    }

    def __init__(self) -> None:
        super().__init__()
        self.path = self.root / "config.json"
        self.original = {"name": "friday", "tags": ["local", "fast", "local", "safe", "fast"], "tier": 3}
        self.path.write_text(json.dumps(self.original, ensure_ascii=False, indent=2))
        self.read_before = False
        self.written = False
        self.read_after = False
        self.check_passed = False
        self.write_index = -1
        self.events = 0

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        self.events += 1
        if name == "repo.file.read":
            path = str(arguments.get("path", ""))
            if path != "config.json":
                return {"status": "executed", "ok": False, "error": "unknown path"}
            if not self.written:
                self.read_before = True
            elif self.events > self.write_index:
                self.read_after = True
            return {"status": "executed", "content": self.path.read_text()}
        if name == "repo.file.write":
            if str(arguments.get("path", "")) != "config.json":
                return {"status": "executed", "written": False, "error": "unknown path"}
            content = arguments.get("content")
            if not isinstance(content, str):
                return {"status": "executed", "written": False, "error": "content must be string"}
            try:
                json.loads(content)
            except Exception as exc:
                return {"status": "executed", "written": False, "error": f"invalid json: {exc}"}
            self.path.write_text(content)
            self.written = True
            self.write_index = self.events
            return {"status": "executed", "written": True, "path": "config.json"}
        if name == "repo.check":
            if arguments.get("checkId") != "unit":
                return {"status": "executed", "exitCode": 2, "stderr": "check id not allowlisted"}
            try:
                current = json.loads(self.path.read_text())
            except Exception as exc:
                return {"status": "executed", "exitCode": 1, "stderr": str(exc)}
            expected = {**self.original, "tags": ["local", "fast", "safe"]}
            self.check_passed = current == expected
            return {
                "status": "executed",
                "exitCode": 0 if self.check_passed else 1,
                "stdout": "semantic unit check passed" if self.check_passed else "",
                "stderr": "" if self.check_passed else "config semantics mismatch",
            }
        return {"status": "unavailable", "error": "unknown tool"}

    def auto_proofs(self, name: str, arguments: dict[str, Any], result: dict[str, Any]):
        if name != "repo.file.write" or not result.get("written"):
            return []
        return [
            ("repo.file.read", {"path": arguments.get("path")}),
            ("repo.check", {"checkId": "unit"}),
        ]

    def gaps(self) -> list[str]:
        gaps = []
        if not self.read_before:
            gaps.append("source_observation")
        if not self.written:
            gaps.append("repo_write")
        if not self.read_after:
            gaps.append("postcondition_observation")
        if not self.check_passed:
            gaps.append("executable_validation")
        return gaps

    def score(self, trace: Trace):
        ok = len(self.gaps()) == 0
        return ok, {
            "read_before": self.read_before,
            "written": self.written,
            "read_after": self.read_after,
            "check_passed": self.check_passed,
            "remaining_gaps": self.gaps(),
        }


class WorkspaceVerifiedWrite(Task):
    id = "workspace_write_postcondition"
    user = (
        "/no_think\nLis notes/source.txt. Crée ensuite notes/final.txt avec exactement la première ligne de la source "
        "suivie d'une nouvelle ligne VERIFIED. Relis notes/final.txt avant de répondre."
    )
    goal = (
        "Goal: derive an output file from observed workspace state. Required evidence: source read, exact write, "
        "and postcondition read after the write."
    )
    tools = {
        "workspace.read": "Read one workspace text file. arguments: {path}",
        "workspace.write": "Write one workspace text file. arguments: {path, content}",
    }

    def __init__(self) -> None:
        super().__init__()
        (self.root / "notes").mkdir()
        (self.root / "notes/source.txt").write_text("Alpha dossier\nDeuxième ligne\n")
        self.source_read = False
        self.written = False
        self.read_after = False

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        path = str(arguments.get("path", ""))
        target = self.root / path
        if name == "workspace.read":
            if not target.exists():
                return {"status": "executed", "ok": False, "error": "missing file"}
            if path == "notes/source.txt":
                self.source_read = True
            if path == "notes/final.txt" and self.written:
                self.read_after = True
            return {"status": "executed", "content": target.read_text()}
        if name == "workspace.write":
            content = arguments.get("content")
            if path != "notes/final.txt" or not isinstance(content, str):
                return {"status": "executed", "written": False}
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content)
            self.written = True
            return {"status": "executed", "written": True, "path": path}
        return {"status": "unavailable", "error": "unknown tool"}

    def auto_proofs(self, name: str, arguments: dict[str, Any], result: dict[str, Any]):
        if name == "workspace.write" and result.get("written"):
            return [("workspace.read", {"path": arguments.get("path")})]
        return []

    def gaps(self) -> list[str]:
        gaps = []
        if not self.source_read:
            gaps.append("source_observation")
        if not self.written:
            gaps.append("workspace_write")
        if not self.read_after:
            gaps.append("postcondition_observation")
        if self.written:
            content = (self.root / "notes/final.txt").read_text()
            if content != "Alpha dossier\nVERIFIED":
                gaps.append("exact_content")
        return gaps

    def score(self, trace: Trace):
        return len(self.gaps()) == 0, {
            "source_read": self.source_read,
            "written": self.written,
            "read_after": self.read_after,
            "remaining_gaps": self.gaps(),
        }


class LiveReport(Task):
    id = "live_research_report_postcondition"
    user = (
        "/no_think\nTrouve la version stable actuelle de mlx-lm à partir des sources disponibles. Écris reports/mlx.txt "
        "avec la version et les IDs de sources PYPI et GITHUB, puis relis le rapport avant de répondre."
    )
    goal = (
        "Goal: ground the current value, write a report, and verify the postcondition. Required evidence: research tool, "
        "workspace write, workspace read after write."
    )
    tools = {
        "research.web.search": "Return the live cached mlx-lm version and two public source records. arguments: {query}",
        "workspace.write": "Write one workspace report. arguments: {path, content}",
        "workspace.read": "Read one workspace report. arguments: {path}",
    }

    def __init__(self) -> None:
        super().__init__()
        (self.root / "reports").mkdir()
        self.searched = False
        self.written = False
        self.read_after = False
        self.version = str(LIVE_SNAPSHOT["version"])

    def handle(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "research.web.search":
            self.searched = True
            return {"status": "executed", **LIVE_SNAPSHOT}
        if name == "workspace.write":
            path = str(arguments.get("path", ""))
            content = arguments.get("content")
            if path != "reports/mlx.txt" or not isinstance(content, str):
                return {"status": "executed", "written": False}
            (self.root / path).write_text(content)
            self.written = True
            return {"status": "executed", "written": True, "path": path}
        if name == "workspace.read":
            path = str(arguments.get("path", ""))
            target = self.root / path
            if path != "reports/mlx.txt" or not target.exists():
                return {"status": "executed", "ok": False, "error": "missing report"}
            if self.written:
                self.read_after = True
            return {"status": "executed", "content": target.read_text()}
        return {"status": "unavailable", "error": "unknown tool"}

    def auto_proofs(self, name: str, arguments: dict[str, Any], result: dict[str, Any]):
        if name == "workspace.write" and result.get("written"):
            return [("workspace.read", {"path": arguments.get("path")})]
        return []

    def gaps(self) -> list[str]:
        gaps = []
        if not self.searched:
            gaps.append("grounded_sources")
        if not self.written:
            gaps.append("workspace_write")
        if not self.read_after:
            gaps.append("postcondition_observation")
        if self.written:
            text = (self.root / "reports/mlx.txt").read_text()
            if self.version not in text or "PYPI" not in text or "GITHUB" not in text:
                gaps.append("report_content")
        return gaps

    def score(self, trace: Trace):
        return len(self.gaps()) == 0, {
            "searched": self.searched,
            "written": self.written,
            "read_after": self.read_after,
            "version": self.version,
            "network_fallback": bool(LIVE_SNAPSHOT.get("fallback")),
            "remaining_gaps": self.gaps(),
        }


TASKS = [RepoConfigRepair, WorkspaceVerifiedWrite, LiveReport]


def completion(base_url: str, model: str, messages: list[dict[str, str]]) -> tuple[str, float]:
    started = time.perf_counter()
    data = post_json(
        base_url.rstrip("/") + "/v1/chat/completions",
        {
            "model": model,
            "messages": messages,
            "temperature": 0.0,
            "top_p": 0.9,
            "max_tokens": 450,
            "stream": False,
        },
    )
    latency = (time.perf_counter() - started) * 1000
    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("no completion choices")
    content = choices[0].get("message", {}).get("content")
    if not isinstance(content, str):
        raise RuntimeError("completion content missing")
    return content, latency


def extract_json(text: str) -> dict[str, Any] | None:
    text = text.strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(text[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


def negative_result(result: dict[str, Any]) -> bool:
    if result.get("status") in {"failed", "unavailable"}:
        return True
    if result.get("status") != "executed":
        return False
    for key in ("written", "ok", "passed", "valid", "success"):
        if key in result and result[key] is False:
            return True
    if isinstance(result.get("exitCode"), int) and result["exitCode"] != 0:
        return True
    return False


def run_task(task_type: type[Task], mode: str, args: argparse.Namespace) -> Trace:
    task = task_type()
    trace = Trace(task=task.id, mode=mode)
    messages = [
        {
            "role": "system",
            "content": BASE_SYSTEM + "\n[TOOLS]\n" + task.manifest() + "\n[GOAL]\n" + task.goal,
        },
        {"role": "user", "content": task.user},
    ]

    for _ in range(args.max_rounds):
        try:
            output, latency = completion(args.base_url, args.model, messages)
        except Exception as exc:
            trace.errors.append(f"completion:{type(exc).__name__}:{exc}")
            break
        trace.model_requests += 1
        trace.request_latencies_ms.append(latency)
        parsed = extract_json(output)
        if not parsed:
            trace.errors.append("invalid_json")
            messages.append({"role": "assistant", "content": output})
            messages.append({"role": "user", "content": "Protocol error: return only one valid JSON object."})
            continue

        if parsed.get("type") == "final":
            gaps = task.gaps()
            if gaps and trace.repairs < 2:
                trace.repairs += 1
                messages.append({"role": "assistant", "content": compact(parsed)})
                messages.append(
                    {
                        "role": "user",
                        "content": "REJECTED_DRAFT missing evidence=" + ",".join(gaps) + ". Repair using available tools; do not claim completion yet.",
                    }
                )
                continue
            trace.final_answer = str(parsed.get("answer", "")).strip()
            break

        if parsed.get("type") != "tool":
            trace.errors.append("invalid_response_type")
            messages.append({"role": "assistant", "content": compact(parsed)})
            messages.append({"role": "user", "content": "Protocol error: type must be tool or final."})
            continue

        name = str(parsed.get("name", ""))
        arguments = parsed.get("arguments")
        if not isinstance(arguments, dict):
            arguments = {}
        if name not in task.tools:
            result = {"status": "unavailable", "error": f"unknown tool {name}"}
        else:
            result = task.handle(name, arguments)
        trace.tool_calls.append({"name": name, "arguments": arguments, "automatic": False, "result": result})

        enriched = dict(result)
        if mode == "microplan" and not negative_result(result):
            proofs = []
            for proof_name, proof_args in task.auto_proofs(name, arguments, result):
                proof_result = task.handle(proof_name, proof_args)
                trace.tool_calls.append(
                    {"name": proof_name, "arguments": proof_args, "automatic": True, "result": proof_result}
                )
                proofs.append({"capabilityId": proof_name, "result": proof_result})
            if proofs:
                enriched["fridayProofs"] = proofs

        messages.append({"role": "assistant", "content": compact(parsed)})
        messages.append({"role": "user", "content": "TOOL_RESULT " + name + " " + compact(enriched)})

    trace.success, trace.detail = task.score(trace)
    task.temp.cleanup()
    return trace


def summarize(mode: str, traces: list[Trace]) -> dict[str, Any]:
    latencies = [value for trace in traces for value in trace.request_latencies_ms]
    return {
        "mode": mode,
        "tasks": len(traces),
        "successes": sum(trace.success for trace in traces),
        "success_rate": sum(trace.success for trace in traces) / max(1, len(traces)),
        "model_requests": sum(trace.model_requests for trace in traces),
        "manual_tool_calls": sum(sum(not call["automatic"] for call in trace.tool_calls) for trace in traces),
        "automatic_proof_calls": sum(sum(call["automatic"] for call in trace.tool_calls) for trace in traces),
        "repairs": sum(trace.repairs for trace in traces),
        "model_latency_ms_total": round(sum(latencies), 1),
        "model_latency_ms_p50": round(statistics.median(latencies), 1) if latencies else None,
        "model_latency_ms_p95": round(sorted(latencies)[min(len(latencies) - 1, int(0.95 * len(latencies)))], 1) if latencies else None,
        "tasks_detail": [
            {
                "task": trace.task,
                "success": trace.success,
                "model_requests": trace.model_requests,
                "repairs": trace.repairs,
                "tools": [
                    ("AUTO:" if call["automatic"] else "") + call["name"] for call in trace.tool_calls
                ],
                "detail": trace.detail,
                "answer": trace.final_answer,
                "latency_ms": [round(v, 1) for v in trace.request_latencies_ms],
                "errors": trace.errors,
            }
            for trace in traces
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--model", default=MODEL_DEFAULT)
    parser.add_argument("--max-rounds", type=int, default=10)
    args = parser.parse_args()

    results: dict[str, list[Trace]] = {}
    for mode in ("scheduler", "microplan"):
        traces = []
        for task_type in TASKS:
            trace = run_task(task_type, mode, args)
            traces.append(trace)
            print(
                "MICROPLAN_TASK="
                + compact(
                    {
                        "mode": mode,
                        "task": trace.task,
                        "success": trace.success,
                        "model_requests": trace.model_requests,
                        "repairs": trace.repairs,
                        "tools": [("AUTO:" if c["automatic"] else "") + c["name"] for c in trace.tool_calls],
                        "detail": trace.detail,
                        "latency_ms": [round(v, 1) for v in trace.request_latencies_ms],
                        "errors": trace.errors,
                    }
                ),
                flush=True,
            )
        results[mode] = traces

    scheduler = summarize("scheduler", results["scheduler"])
    microplan = summarize("microplan", results["microplan"])
    output = {
        "benchmark": "friday-local-proof-microplan-v1",
        "model": args.model,
        "cognition": "local-only",
        "live_snapshot": LIVE_SNAPSHOT,
        "scheduler": scheduler,
        "microplan": microplan,
        "request_delta": microplan["model_requests"] - scheduler["model_requests"],
        "latency_delta_ms": round(microplan["model_latency_ms_total"] - scheduler["model_latency_ms_total"], 1),
        "claim_scope": (
            "Three proof-closure tasks measuring model-request and latency savings from deterministic Core-governed "
            "postcondition/validation microplans. This is not a general intelligence or Astra-parity score."
        ),
    }
    print("MICROPLAN_RESULT=" + compact(output), flush=True)
    return 0 if microplan["success_rate"] >= scheduler["success_rate"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
