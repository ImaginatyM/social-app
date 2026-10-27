# FRIDAY proof microplan v1 — temporary evidence only

This benchmark compares the same local `Qwen/Qwen3-8B-MLX-4bit` in two system configurations:

- `scheduler`: proof-directed repair with no automatic proof calls;
- `microplan`: the same scheduler plus bounded deterministic proof completion after a model-initiated mutation.

The three tasks use real temporary filesystem effects and a deterministic repository semantic check. The live-research task retrieves the current `mlx-lm` version from PyPI once per run, with an explicitly reported frozen fallback only if public network access fails.

Automatic proof calls are restricted to exact arguments derived from the mutation and a single pre-allowlisted check. They do not invent paths, source IDs, check IDs, approvals, or external actions.

This measures model-request and latency savings for proof closure only. It is not a general intelligence score, does not establish Astra parity, and must not promote FRIDAY readiness scores.

Temporary PR only. Do not merge.
