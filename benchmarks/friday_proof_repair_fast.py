#!/usr/bin/env python3
"""Fast proof-repair-only gate using the frozen v2 transfer tasks/scorer."""
from __future__ import annotations

import argparse
import json

import friday_goal_transfer_qwen8b as v1
import friday_goal_transfer_qwen8b_v2 as v2


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--model", default=v1.MODEL_DEFAULT)
    parser.add_argument("--max-rounds", type=int, default=6)
    args = parser.parse_args()

    traces = []
    for task_template in v1.TASKS:
        trace = v2.run_proof_repair(task_template, args)
        traces.append(trace)
        print(
            "PROOF_FAST_TASK="
            + v1.json_text(
                {
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

    summary = v1.summary_for("proof_repair", traces)
    result = {
        "benchmark": "friday-proof-repair-fast-v2",
        "model": args.model,
        "cognition": "local-only",
        "proof_repair": summary,
        "claim_scope": "Frozen six-task transfer gate; no raw comparison in this job.",
    }
    print("PROOF_FAST_RESULT=" + v1.json_text(result), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
