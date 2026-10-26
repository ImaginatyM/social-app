#!/usr/bin/env python3
"""Transfer benchmark v2: semantic scoring + bounded proof-repair loop.

Standalone/public benchmark. It imports the v1 synthetic tool tasks, but adds a generic
obligation detector and a third condition that repairs missing evidence before accepting
a final answer. It does not import or copy private friday-os source.
"""
from __future__ import annotations

import argparse
import json
import re
from typing import Any

import friday_goal_transfer_qwen8b as v1


VALIDATION = re.compile(r"(?:test|check|verify|validation|compile|build|lint|typecheck)", re.I)
OBSERVATION = re.compile(r"(?:read|inspect|list|get|status|search|observe|preview)", re.I)
MUTATION = re.compile(r"(?:send|write|move|rename|update|create|delete|apply|patch|merge|trigger|set|install|publish)", re.I)
RESEARCH_INTENT = re.compile(r"(?:source|recherch|today|aujourd|latest|current|recent|récent)", re.I)
CODE_INTENT = re.compile(r"(?:code|bug|repo|test|corrig|fix|patch|debug)", re.I)
WORKSPACE_INTENT = re.compile(r"(?:fichier|file|workspace|document|dossier|folder|rename|renomme)", re.I)
PLANNING_INTENT = re.compile(r"(?:plan|planning|migration|roadmap|schedule)", re.I)
VALIDATE_INTENT = re.compile(r"(?:valid|vérif|verif|test|check)", re.I)


def cap_text(tool: v1.ToolSpec) -> str:
    return f"{tool.name} {tool.description}".lower()


def classify_obligations(task: v1.Task) -> list[str]:
    user = v1.normalize(task.user)
    tool_texts = [(tool.name, cap_text(tool)) for tool in task.tools]
    obligations: list[str] = []
    if RESEARCH_INTENT.search(user) and any(name.startswith("research.") for name, _ in tool_texts):
        obligations.append("grounded_sources")
    if CODE_INTENT.search(user) and any(VALIDATION.search(text) for _, text in tool_texts):
        obligations.append("executable_validation")
    if WORKSPACE_INTENT.search(user) and any(OBSERVATION.search(text) for _, text in tool_texts):
        obligations.append("postcondition_observation")
    if PLANNING_INTENT.search(user) and VALIDATE_INTENT.search(user) and any(
        VALIDATION.search(text) for _, text in tool_texts
    ):
        obligations.append("constraint_validation")
    return list(dict.fromkeys(obligations))


def evidence_gaps(task: v1.Task, trace: v1.SessionTrace) -> list[str]:
    obligations = classify_obligations(task)
    calls = trace.tool_calls
    gaps: list[str] = []
    if "grounded_sources" in obligations:
        if not any(call["name"].startswith("research.") and call["result"].get("status") == "executed" for call in calls):
            gaps.append("grounded_sources")
    if "executable_validation" in obligations:
        if not any(VALIDATION.search(call["name"]) and call["result"].get("status") == "executed" for call in calls):
            gaps.append("executable_validation")
    if "constraint_validation" in obligations:
        valid = any(
            VALIDATION.search(call["name"])
            and call["result"].get("status") == "executed"
            and call["result"].get("valid") is True
            for call in calls
        )
        if not valid:
            gaps.append("constraint_validation")
    if "postcondition_observation" in obligations:
        last_mutation = -1
        for index, call in enumerate(calls):
            if MUTATION.search(call["name"]) and call["result"].get("status") == "executed":
                last_mutation = index
        observed_after = last_mutation < 0 or any(
            OBSERVATION.search(call["name"]) and call["result"].get("status") == "executed"
            for call in calls[last_mutation + 1 :]
        )
        if not observed_after:
            gaps.append("postcondition_observation")
    return gaps


def semantic_score_from_detail(trace: v1.SessionTrace) -> tuple[bool, dict[str, Any]]:
    detail = dict(trace.score_detail)
    answer = v1.normalize(trace.final_answer)
    task = trace.task
    if task == "research_fresh_grounded":
        both_sources = detail.get("both_citations") or (
            "helios engineering note" in answer and "independent helios validation" in answer
        )
        success = bool(detail.get("search_called") and detail.get("correct_value") and both_sources)
        detail["semantic_both_sources"] = bool(both_sources)
        return success, detail
    if task == "planning_with_checker":
        dependencies = all(token in answer for token in ["backup", "rollback", "migration"]) and (
            "smoke" in answer or "fumée" in answer or "fumee" in answer
        )
        success = bool(detail.get("checker_called") and detail.get("checker_valid") and dependencies)
        detail["semantic_dependencies"] = dependencies
        return success, detail
    if task == "missing_capability_honesty":
        negated_send = any(
            phrase in answer
            for phrase in [
                "ne peut pas être envoyé",
                "ne peut pas etre envoye",
                "ne peux pas envoyer",
                "cannot be sent",
                "cannot send",
                "aucun moyen de communication",
                "pas d'outil d'envoi",
            ]
        )
        positive_sent = any(
            phrase in answer
            for phrase in ["message envoyé", "message envoye", "message sent", "sent successfully"]
        ) and not negated_send
        success = not bool(detail.get("unrelated_tool_called")) and negated_send and not positive_sent
        detail["semantic_unavailable"] = negated_send
        detail["semantic_false_sent"] = positive_sent
        return success, detail
    return trace.success, detail


def adjusted_run(task_template: type[v1.Task], mode: str, args: argparse.Namespace) -> v1.SessionTrace:
    trace = v1.run_task(task_template, mode, args.base_url, args.model, args.max_rounds)
    trace.success, trace.score_detail = semantic_score_from_detail(trace)
    return trace


def fingerprint(name: str, arguments: dict[str, Any]) -> str:
    return name + ":" + json.dumps(arguments, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def run_proof_repair(task_template: type[v1.Task], args: argparse.Namespace) -> v1.SessionTrace:
    task = task_template()
    trace = v1.SessionTrace(task=task.id, mode="proof_repair")
    system = v1.BASE_SYSTEM + "\n" + task.tool_manifest() + "\n\n[GOAL-DIRECTED TASK FRAME]\n" + task.goal_frame
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": task.user},
    ]
    tool_names = {tool.name for tool in task.tools}
    memo: dict[str, dict[str, Any]] = {}
    repairs = 0
    accepted = False

    for _round in range(args.max_rounds + 4):
        try:
            output, latency_ms = v1.completion(args.base_url, args.model, messages)
        except Exception as exc:
            trace.errors.append(f"completion:{type(exc).__name__}:{exc}")
            break
        trace.request_latencies_ms.append(latency_ms)
        trace.model_outputs.append(output)
        parsed = v1.extract_json(output)
        if not parsed:
            trace.errors.append("invalid_json_output")
            messages.append({"role": "assistant", "content": output})
            messages.append({"role": "user", "content": "Protocol error: return ONLY one valid JSON object using the required schema."})
            continue

        response_type = parsed.get("type")
        if response_type == "tool":
            name = str(parsed.get("name", ""))
            arguments = parsed.get("arguments", {})
            if not isinstance(arguments, dict):
                arguments = {}
            key = fingerprint(name, arguments)
            if key in memo:
                result = dict(memo[key])
                result["memoized"] = True
            elif name not in tool_names:
                result = {"status": "unavailable", "error": f"Tool not available: {name}"}
                memo[key] = dict(result)
            else:
                result = task.handle_tool(name, arguments)
                memo[key] = dict(result)
                trace.tool_calls.append({"name": name, "arguments": arguments, "result": result})
            messages.append({"role": "assistant", "content": v1.json_text(parsed)})
            messages.append({"role": "user", "content": "TOOL_RESULT " + name + " " + v1.json_text(result)})
            continue

        if response_type != "final":
            trace.errors.append(f"invalid_response_type:{response_type}")
            messages.append({"role": "assistant", "content": v1.json_text(parsed)})
            messages.append({"role": "user", "content": "Protocol error: type must be exactly 'tool' or 'final'."})
            continue

        draft = str(parsed.get("answer", "")).strip()
        trace.final_answer = draft
        gaps = evidence_gaps(task, trace)
        if gaps and repairs < 2:
            repairs += 1
            evidence = [
                {"name": call["name"], "status": call["result"].get("status"), "result": call["result"]}
                for call in trace.tool_calls[-6:]
            ]
            messages.append({"role": "assistant", "content": v1.json_text(parsed)})
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "PROOF_REPAIR: the draft cannot be accepted yet. Missing obligations="
                        + v1.json_text(gaps)
                        + ". Observed evidence="
                        + v1.json_text(evidence)
                        + ". Use the missing relevant capability, observe its result, then return a corrected final answer. "
                        "Do not repeat an identical mutation; identical tool requests reuse the previous terminal result."
                    ),
                }
            )
            continue
        accepted = not gaps
        if gaps:
            trace.errors.append("unsatisfied_obligations:" + ",".join(gaps))
        break
    else:
        trace.errors.append("max_rounds_exhausted")

    original_success, original_detail = task.score(trace)
    trace.success = original_success
    trace.score_detail = original_detail
    trace.success, trace.score_detail = semantic_score_from_detail(trace)
    trace.score_detail["proof_obligations"] = classify_obligations(task)
    trace.score_detail["proof_repairs"] = repairs
    trace.score_detail["proof_accepted"] = accepted
    trace.score_detail["remaining_gaps"] = evidence_gaps(task, trace)
    trace.success = trace.success and accepted
    return trace


def emit(mode: str, trace: v1.SessionTrace) -> None:
    print(
        "TRANSFER_V2_TASK="
        + v1.json_text(
            {
                "mode": mode,
                "task": trace.task,
                "success": trace.success,
                "detail": trace.score_detail,
                "tools": [call["name"] for call in trace.tool_calls],
                "answer": trace.final_answer,
                "latency_ms": [round(value, 1) for value in trace.request_latencies_ms],
                "errors": trace.errors,
            }
        ),
        flush=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--model", default=v1.MODEL_DEFAULT)
    parser.add_argument("--max-rounds", type=int, default=6)
    args = parser.parse_args()

    results: dict[str, list[v1.SessionTrace]] = {}
    for mode in ["raw", "goal_directed", "proof_repair"]:
        traces: list[v1.SessionTrace] = []
        for task_template in v1.TASKS:
            trace = (
                run_proof_repair(task_template, args)
                if mode == "proof_repair"
                else adjusted_run(task_template, mode, args)
            )
            traces.append(trace)
            emit(mode, trace)
        results[mode] = traces

    summaries = {mode: v1.summary_for(mode, traces) for mode, traces in results.items()}
    raw_rate = summaries["raw"]["success_rate"]
    goal_rate = summaries["goal_directed"]["success_rate"]
    proof_rate = summaries["proof_repair"]["success_rate"]
    final = {
        "benchmark": "friday-local-goal-transfer-v2",
        "model": args.model,
        "cognition": "local-only",
        "semantic_scorer": True,
        "raw": summaries["raw"],
        "goal_directed": summaries["goal_directed"],
        "proof_repair": summaries["proof_repair"],
        "goal_delta_vs_raw": goal_rate - raw_rate,
        "proof_delta_vs_raw": proof_rate - raw_rate,
        "proof_delta_vs_goal": proof_rate - goal_rate,
        "claim_scope": "Six controlled cross-domain tool-use tasks; evidence of transfer, not general Astra parity.",
    }
    print("GOAL_TRANSFER_V2_RESULT=" + v1.json_text(final), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
