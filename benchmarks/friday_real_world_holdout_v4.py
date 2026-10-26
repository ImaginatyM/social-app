#!/usr/bin/env python3
"""Real-world holdout v4: mirror FRIDAY's system-owned action guard and proof scheduler.

Tasks, live evidence, file/code effects and scoring stay frozen from v3. The only cognition
changes are generic:
- no relevant mutation capability => deterministic honest no-action completion;
- after a rejected draft, expose only capabilities that can satisfy the remaining proof;
- a recoverable negative tool result restores the normal focused tool set so prerequisites
  can be discovered before retrying.
"""
from __future__ import annotations

import argparse
import json
import re
from typing import Any

import friday_real_world_holdout_v3 as v3

h = v3.h

MUTATION = re.compile(
    r"(?:send|write|move|rename|update|create|delete|apply|patch|merge|trigger|set|install|publish|append|save)",
    re.I,
)
OBSERVE = re.compile(r"(?:read|list|inspect|get|status|observe|preview)", re.I)
VALIDATE = re.compile(r"(?:test|check|verify|validation|compile|build|lint|typecheck)", re.I)


def fingerprint(name: str, arguments: dict[str, Any]) -> str:
    return name + ":" + json.dumps(arguments, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def is_recoverable_result(result: dict[str, Any]) -> bool:
    status = str(result.get("status", ""))
    if status in {"failed", "unavailable"}:
        return True
    return status == "executed" and v3.explicit_negative(result)


def unresolved_failure(trace: h.Trace) -> bool:
    for index, call in enumerate(trace.tool_calls):
        if not is_recoverable_result(call["result"]):
            continue
        later_ok = any(
            later["name"] == call["name"] and not is_recoverable_result(later["result"])
            for later in trace.tool_calls[index + 1 :]
        )
        if not later_ok:
            return True
    return False


def mutation_tools(tools: list[h.base.ToolSpec]) -> list[h.base.ToolSpec]:
    return [tool for tool in tools if MUTATION.search(tool.name)]


def proof_tools(
    full_focused: list[h.base.ToolSpec],
    missing: list[str],
    has_failure: bool,
) -> list[h.base.ToolSpec]:
    if has_failure:
        return full_focused

    selected: list[h.base.ToolSpec] = []
    seen: set[str] = set()
    for tool in full_focused:
        keep = False
        for gap in missing:
            if gap == "grounded_sources":
                keep = keep or tool.name.startswith("research.") or tool.name.startswith("browser.")
            elif gap in {"executable_validation", "constraint_validation"}:
                keep = keep or bool(VALIDATE.search(tool.name + " " + tool.description))
            elif gap in {"postcondition_observation", "observed_state"}:
                keep = keep or (bool(OBSERVE.search(tool.name + " " + tool.description)) and not tool.name.startswith("research."))
            elif gap == "core_terminal_state":
                keep = keep or bool(MUTATION.search(tool.name + " " + tool.description))
        if keep and tool.name not in seen:
            selected.append(tool)
            seen.add(tool.name)
    return selected or full_focused


def french(text: str) -> bool:
    value = h.base.normalize(text)
    return bool(re.search(r"\b(?:envoie|fichier|rapport|corrige|trouve|renomme|ecris|ajoute|relis)\b", value))


def unavailable_action(user: str) -> str:
    if french(user):
        return "Je ne peux pas exécuter l’action demandée ici : aucune capability pertinente n’est disponible. Je n’ai rien exécuté."
    return "I cannot execute the requested action here because no relevant capability is available. I did not execute anything."


def incomplete(user: str, missing: list[str]) -> str:
    suffix = ", ".join(missing) if missing else "résultat d'outil négatif"
    if french(user):
        return f"Je n’ai pas pu terminer cette tâche de façon vérifiée ({suffix}). Je ne vais pas prétendre qu’elle est terminée."
    return f"I could not complete this task with verified evidence ({suffix}). I will not claim it is complete."


def run_scheduler(task_type: type[h.HoldoutTask], args: argparse.Namespace) -> h.Trace:
    task = task_type()
    trace = h.Trace(task=task.id, mode="proof_scheduler")
    full_focused = h.focus_tools(task.user, task.tools)
    domains = h.infer_domains(task.user)

    # Hard system boundary: do not let a weak model narrate a side effect when the
    # capability catalog has no relevant mutation affordance.
    if "action" in domains and not mutation_tools(full_focused):
        trace.final_answer = unavailable_action(task.user)
        trace.success, trace.detail = task.score(trace)
        trace.detail["system_guard"] = "no_relevant_mutation_capability"
        trace.detail["visible_tools"] = []
        trace.detail["obligations"] = h.obligations(task.user, full_focused)
        return trace

    system = h.base.BASE_SYSTEM + "\n" + task.tool_manifest(full_focused)
    system += "\n\n[GENERATED GOAL FRAME]\n" + h.render_frame(task.user, task.tools)
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": task.user},
    ]
    active_tools = full_focused
    memo: dict[str, dict[str, Any]] = {}
    repairs = 0

    for _round in range(args.max_rounds):
        visible_names = {tool.name for tool in active_tools}
        try:
            output, latency = h.base.completion(args.base_url, args.model, messages)
        except Exception as exc:
            trace.errors.append(f"completion:{type(exc).__name__}:{exc}")
            break
        trace.latencies_ms.append(latency)
        parsed = h.base.extract_json(output)
        if not parsed:
            trace.errors.append("invalid_json")
            messages += [
                {"role": "assistant", "content": output},
                {"role": "user", "content": "Protocol error: return ONLY valid JSON using the required schema."},
            ]
            continue

        response_type = parsed.get("type")
        if response_type == "tool":
            name = str(parsed.get("name", ""))
            arguments = parsed.get("arguments", {})
            if not isinstance(arguments, dict):
                arguments = {}
            key = fingerprint(name, arguments)
            memoized = memo.get(key)
            if memoized is not None and MUTATION.search(name) and not is_recoverable_result(memoized):
                result = dict(memoized)
                result["memoized"] = True
            elif name not in visible_names:
                result = {"status": "unavailable", "error": "TOOL_NOT_VISIBLE_IN_CURRENT_PROOF_STAGE"}
            else:
                result = task.handle(name, arguments)
                trace.tool_calls.append({"name": name, "arguments": arguments, "result": result})
                if MUTATION.search(name) and not is_recoverable_result(result):
                    memo[key] = dict(result)
            messages += [
                {"role": "assistant", "content": h.base.json_text(parsed)},
                {"role": "user", "content": "TOOL_RESULT " + name + " " + h.base.json_text(result)},
            ]
            continue

        if response_type != "final":
            trace.errors.append("invalid_response_type")
            messages += [
                {"role": "assistant", "content": h.base.json_text(parsed)},
                {"role": "user", "content": "Protocol error: type must be exactly 'tool' or 'final'."},
            ]
            continue

        draft = str(parsed.get("answer", "")).strip()
        missing = h.gaps(task, trace, full_focused)
        failure = unresolved_failure(trace)
        if not missing and not failure:
            trace.final_answer = draft
            break

        if repairs >= 2:
            trace.final_answer = incomplete(task.user, missing)
            trace.errors.append(
                "bounded_repair_exhausted:"
                + (",".join(missing) if missing else "negative_tool_outcome")
            )
            break

        repairs += 1
        active_tools = proof_tools(full_focused, missing, failure)
        evidence = [
            {"name": call["name"], "result": call["result"]}
            for call in trace.tool_calls[-8:]
        ]
        messages += [
            {"role": "assistant", "content": h.base.json_text(parsed)},
            {
                "role": "user",
                "content": (
                    "PROOF_SCHEDULER: draft rejected. Missing="
                    + h.base.json_text(missing)
                    + "; recoverable_failure="
                    + h.base.json_text(failure)
                    + "; observed_evidence="
                    + h.base.json_text(evidence)
                    + "; capabilities_for_next_stage="
                    + h.base.json_text([tool.name for tool in active_tools])
                    + ". Use only a capability from the next stage if one is needed, observe its result, then return a corrected final answer. Never invent a postcondition."
                ),
            },
        ]
    else:
        trace.errors.append("max_rounds")
        trace.final_answer = incomplete(task.user, h.gaps(task, trace, full_focused))

    trace.success, trace.detail = task.score(trace)
    trace.detail["repairs"] = repairs
    trace.detail["visible_tools_initial"] = [tool.name for tool in full_focused]
    trace.detail["obligations"] = h.obligations(task.user, full_focused)
    return trace


def semantic_code_adjust(trace: h.Trace) -> None:
    if trace.task != "real_code_repair_tests":
        return
    answer = h.base.normalize(trace.final_answer)
    claimed = "test" in answer and any(
        token in answer for token in ["pass", "réussi", "reussi", "succès", "succes", "vert"]
    )
    trace.detail["claimed_tests_semantic"] = claimed
    trace.success = bool(
        trace.detail.get("inspected")
        and trace.detail.get("patched")
        and trace.detail.get("tests_passed")
        and claimed
    )


def summarize(mode: str, traces: list[h.Trace]) -> dict[str, Any]:
    return {
        "mode": mode,
        "tasks": len(traces),
        "successes": sum(trace.success for trace in traces),
        "success_rate": sum(trace.success for trace in traces) / len(traces),
        "tool_calls": sum(len(trace.tool_calls) for trace in traces),
        "tasks_detail": [
            {
                "task": trace.task,
                "success": trace.success,
                "detail": trace.detail,
                "tools": [call["name"] for call in trace.tool_calls],
                "answer": trace.final_answer,
                "errors": trace.errors,
                "latency_ms": [round(value, 1) for value in trace.latencies_ms],
            }
            for trace in traces
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--model", default=h.base.MODEL_DEFAULT)
    parser.add_argument("--max-rounds", type=int, default=12)
    args = parser.parse_args()

    # Keep the existing v3 RAW result as the comparison condition in this run.
    raw_traces: list[h.Trace] = []
    scheduler_traces: list[h.Trace] = []
    for task_type in h.TASKS:
        raw = h.run(task_type, "raw", args)
        semantic_code_adjust(raw)
        raw_traces.append(raw)
        print("V4_TASK=" + h.base.json_text({"mode": "raw", "task": raw.task, "success": raw.success, "detail": raw.detail, "tools": [call["name"] for call in raw.tool_calls], "answer": raw.final_answer, "errors": raw.errors}), flush=True)

        scheduled = run_scheduler(task_type, args)
        semantic_code_adjust(scheduled)
        scheduler_traces.append(scheduled)
        print("V4_TASK=" + h.base.json_text({"mode": "proof_scheduler", "task": scheduled.task, "success": scheduled.success, "detail": scheduled.detail, "tools": [call["name"] for call in scheduled.tool_calls], "answer": scheduled.final_answer, "errors": scheduled.errors}), flush=True)

    raw_summary = summarize("raw", raw_traces)
    scheduler_summary = summarize("proof_scheduler", scheduler_traces)
    result = {
        "benchmark": "friday-real-world-holdout-v4",
        "model": args.model,
        "cognition": "local-only",
        "raw": raw_summary,
        "proof_scheduler": scheduler_summary,
        "delta": scheduler_summary["success_rate"] - raw_summary["success_rate"],
        "claim_scope": "Frozen six-task live/executable assistant holdout; system-owned unavailable-action guard plus generic proof-directed scheduling; not Astra parity.",
    }
    print("REAL_HOLDOUT_V4_RESULT=" + h.base.json_text(result), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
