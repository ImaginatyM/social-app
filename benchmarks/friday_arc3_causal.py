#!/usr/bin/env python3
"""Public ARC-AGI-3 causal-exploration diagnostic.

Standalone public-data-only benchmark. No private FRIDAY code or data is used.
The controller is game-agnostic: it learns observed state/action transitions,
prioritizes information gain, detects stagnant cycles, and plans back to known
frontier states with untried experiments.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
import time
from dataclasses import dataclass
from typing import Any

from arc_agi import Arcade, OperationMode
from arcengine import GameAction, GameState


FIRST_LEVEL_BUDGETS = {
    "ar25": 64,
    "ft09": 86,
    "lp85": 34,
    "ls20": 44,
    "dc22": 118,
}


def built(value: Any) -> Any:
    if hasattr(value, "tolist"):
        return built(value.tolist())
    if isinstance(value, tuple):
        return [built(item) for item in value]
    if isinstance(value, list):
        return [built(item) for item in value]
    if isinstance(value, dict):
        return {key: built(item) for key, item in value.items()}
    return value


def grid(obs: Any) -> list[list[int]]:
    raw = built(getattr(obs, "frame", None))
    if not raw:
        return []
    if isinstance(raw[0], list) and raw[0] and isinstance(raw[0][0], int):
        return raw
    return raw[-1]


def state_name(obs: Any) -> str:
    state = getattr(obs, "state", None)
    return getattr(state, "name", str(state))


def state_hash(obs: Any) -> str:
    payload = [state_name(obs), int(getattr(obs, "levels_completed", 0) or 0), grid(obs)]
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest()[:16]


def components(frame: list[list[int]], color: int) -> list[list[tuple[int, int]]]:
    if not frame:
        return []
    height, width = len(frame), len(frame[0])
    remaining = {
        (x, y)
        for y in range(height)
        for x in range(width)
        if frame[y][x] == color
    }
    output: list[list[tuple[int, int]]] = []
    while remaining:
        start = remaining.pop()
        queue = collections.deque([start])
        component = [start]
        while queue:
            x, y = queue.popleft()
            for point in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if point in remaining:
                    remaining.remove(point)
                    queue.append(point)
                    component.append(point)
        output.append(component)
    return output


def candidate_coords(obs: Any) -> list[tuple[int, int]]:
    frame = grid(obs)
    if not frame:
        return [(0, 0)]
    height, width = len(frame), len(frame[0])
    counts = collections.Counter(value for row in frame for value in row)
    background = counts.most_common(1)[0][0]
    ranked: list[tuple[int, int, int]] = []
    for color in sorted(counts, key=lambda item: (counts[item], item)):
        if color == background:
            continue
        for component in sorted(components(frame, color), key=len)[:6]:
            xs = [point[0] for point in component]
            ys = [point[1] for point in component]
            center = (round(sum(xs) / len(xs)), round(sum(ys) / len(ys)))
            ranked.append((len(component), center[0], center[1]))
    output: list[tuple[int, int]] = []
    for _, x, y in sorted(ranked):
        if (x, y) not in output:
            output.append((x, y))
    for point in (
        (width // 2, height // 2),
        (0, 0),
        (max(width - 1, 0), 0),
        (0, max(height - 1, 0)),
        (max(width - 1, 0), max(height - 1, 0)),
    ):
        if point not in output:
            output.append(point)
    return output[:18]


def action_key(action: GameAction, data: dict[str, int]) -> str:
    if action.is_complex():
        return f"{action.name}@{data.get('x', 0)},{data.get('y', 0)}"
    return action.name


def candidate_actions(env: Any, obs: Any) -> list[tuple[GameAction, dict[str, int]]]:
    output: list[tuple[GameAction, dict[str, int]]] = []
    coordinates = candidate_coords(obs)
    for action in env.action_space:
        if action.is_complex():
            for x, y in coordinates:
                output.append((action, {"x": int(x), "y": int(y)}))
        else:
            output.append((action, {}))
    return output


def changed_summary(before: Any, after: Any) -> tuple[int, int, int, int, int]:
    left, right = grid(before), grid(after)
    if not left or not right or len(left) != len(right) or len(left[0]) != len(right[0]):
        return (0, 0, 0, 0, 0)
    changed = [
        (x, y)
        for y, (row_a, row_b) in enumerate(zip(left, right))
        for x, (a, b) in enumerate(zip(row_a, row_b))
        if a != b
    ]
    if not changed:
        return (0, 0, 0, 0, 0)
    xs = [point[0] for point in changed]
    ys = [point[1] for point in changed]
    return (len(changed), min(xs), min(ys), max(xs), max(ys))


def normalized_entropy(counter: collections.Counter[str]) -> float:
    total = sum(counter.values())
    if total <= 0 or len(counter) <= 1:
        return 0.0
    entropy = 0.0
    for count in counter.values():
        probability = count / total
        entropy -= probability * math.log2(probability)
    return entropy / math.log2(len(counter))


@dataclass(frozen=True)
class Edge:
    action_name: str
    data: tuple[tuple[str, int], ...]
    next_state: str


class CausalExplorer:
    def __init__(self) -> None:
        self.state_candidates: dict[str, dict[str, tuple[GameAction, dict[str, int]]]] = {}
        self.state_action_counts: collections.Counter[tuple[str, str]] = collections.Counter()
        self.action_counts: collections.Counter[str] = collections.Counter()
        self.action_outcomes: dict[str, collections.Counter[str]] = collections.defaultdict(collections.Counter)
        self.transitions: dict[tuple[str, str], collections.Counter[str]] = collections.defaultdict(collections.Counter)
        self.edges: dict[str, list[Edge]] = collections.defaultdict(list)
        self.state_visits: collections.Counter[str] = collections.Counter()
        self.recent_states: collections.deque[str] = collections.deque(maxlen=16)
        self.recent_actions: collections.deque[str] = collections.deque(maxlen=16)
        self.blocked_once: set[str] = set()

    def register_state(self, env: Any, obs: Any) -> str:
        state = state_hash(obs)
        self.state_visits[state] += 1
        self.recent_states.append(state)
        candidates = {
            action_key(action, data): (action, data)
            for action, data in candidate_actions(env, obs)
        }
        self.state_candidates[state] = candidates
        return state

    def _cycle_block(self) -> str | None:
        states = list(self.recent_states)
        actions = list(self.recent_actions)
        for period in range(1, min(6, len(actions) // 2) + 1):
            if len(actions) < period * 2 or len(states) < period * 2:
                continue
            if actions[-period:] == actions[-2 * period : -period] and states[-period:] == states[-2 * period : -period]:
                return actions[-1]
        return None

    def _frontier_action(self, current: str) -> tuple[GameAction, dict[str, int], str] | None:
        queue = collections.deque([(current, [])])
        visited = {current}
        while queue:
            state, path = queue.popleft()
            candidates = self.state_candidates.get(state, {})
            if any(self.state_action_counts[(state, key)] == 0 for key in candidates):
                if path:
                    first = path[0]
                    current_candidates = self.state_candidates.get(current, {})
                    candidate = current_candidates.get(first)
                    if candidate:
                        return candidate[0], dict(candidate[1]), "frontier-plan"
            for edge in self.edges.get(state, []):
                if edge.next_state in visited:
                    continue
                visited.add(edge.next_state)
                queue.append((edge.next_state, path + [edge.action_name]))
        return None

    def choose(self, env: Any, obs: Any) -> tuple[GameAction, dict[str, int], str, float]:
        state = state_hash(obs)
        candidates = self.state_candidates.get(state)
        if not candidates:
            self.register_state(env, obs)
            candidates = self.state_candidates[state]
        cycle_block = self._cycle_block()
        scored: list[tuple[float, str, GameAction, dict[str, int], str]] = []
        for key, (action, data) in candidates.items():
            local_count = self.state_action_counts[(state, key)]
            global_count = self.action_counts[key]
            outcomes = self.action_outcomes[key]
            transition_counter = self.transitions[(state, key)]
            known_next = transition_counter.most_common(1)[0][0] if transition_counter else None
            known_noop = known_next == state and sum(transition_counter.values()) >= 1
            unknown_bonus = 3.0 if local_count == 0 else 0.0
            scarcity = 1.0 / (1.0 + global_count)
            uncertainty = normalized_entropy(outcomes)
            destination_bonus = 0.0
            if known_next:
                destination_bonus = 1.5 / (1.0 + self.state_visits[known_next])
            no_op_penalty = 4.0 if known_noop else 0.0
            repeat_penalty = 1.5 if self.recent_actions and self.recent_actions[-1] == key else 0.0
            cycle_penalty = 8.0 if cycle_block == key else 0.0
            score = unknown_bonus + 1.2 * scarcity + uncertainty + destination_bonus - no_op_penalty - repeat_penalty - cycle_penalty
            scored.append((score, key, action, dict(data), "causal-info"))
        scored.sort(key=lambda item: (-item[0], item[1]))
        if scored and scored[0][0] > -1.0:
            score, _, action, data, route = scored[0]
            return action, data, route, score
        frontier = self._frontier_action(state)
        if frontier:
            action, data, route = frontier
            return action, data, route, 0.0
        if not scored:
            raise RuntimeError("no actions available")
        score, _, action, data, route = scored[0]
        return action, data, route, score

    def observe(self, before: Any, action: GameAction, data: dict[str, int], after: Any) -> None:
        source = state_hash(before)
        target = state_hash(after)
        key = action_key(action, data)
        summary = changed_summary(before, after)
        outcome = json.dumps(summary, separators=(",", ":"))
        self.state_action_counts[(source, key)] += 1
        self.action_counts[key] += 1
        self.action_outcomes[key][outcome] += 1
        self.transitions[(source, key)][target] += 1
        edge = Edge(action_name=key, data=tuple(sorted(data.items())), next_state=target)
        if edge not in self.edges[source]:
            self.edges[source].append(edge)
        self.recent_actions.append(key)


def play(game_id: str, budget: int) -> dict[str, Any]:
    arcade = Arcade(operation_mode=OperationMode.ONLINE)
    env = arcade.make(game_id, save_recording=False, include_frame_data=False)
    if env is None:
        raise RuntimeError(f"environment unavailable: {game_id}")
    obs = env.reset() or env.observation_space
    explorer = CausalExplorer()
    explorer.register_state(env, obs)
    best_levels = int(getattr(obs, "levels_completed", 0) or 0)
    routes: collections.Counter[str] = collections.Counter()
    started = time.perf_counter()
    level_completed_at: int | None = None

    for step in range(1, budget + 1):
        action, data, route, info_score = explorer.choose(env, obs)
        before = obs
        next_obs = env.step(action, data=data)
        if next_obs is None:
            continue
        obs = next_obs
        explorer.observe(before, action, data, obs)
        explorer.register_state(env, obs)
        levels = int(getattr(obs, "levels_completed", 0) or 0)
        best_levels = max(best_levels, levels)
        routes[route] += 1
        changed = changed_summary(before, obs)[0]
        print(
            f"{game_id} step={step} route={route} info={info_score:.3f} action={action.name} data={data} changed={changed} levels={levels}",
            flush=True,
        )
        if levels >= 1:
            level_completed_at = step
            break
        if getattr(obs, "state", None) is GameState.WIN:
            level_completed_at = step
            break
        if getattr(obs, "state", None) is GameState.GAME_OVER:
            reset = env.reset()
            if reset is not None:
                obs = reset
                explorer.register_state(env, obs)

    scorecard = arcade.close_scorecard()
    return {
        "game": game_id,
        "budget": budget,
        "actions": level_completed_at or budget,
        "first_level_completed": level_completed_at is not None,
        "first_level_action": level_completed_at,
        "best_levels_completed": best_levels,
        "states_seen": len(explorer.state_candidates),
        "state_action_pairs": len(explorer.state_action_counts),
        "routes": dict(routes),
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "scorecard": scorecard.model_dump(mode="json") if scorecard else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--games", default="ar25,ft09,lp85,ls20,dc22")
    args = parser.parse_args()
    results = []
    for game_id in [item.strip().lower() for item in args.games.split(",") if item.strip()]:
        budget = FIRST_LEVEL_BUDGETS.get(game_id, 120)
        try:
            result = play(game_id, budget)
        except Exception as exc:
            result = {"game": game_id, "budget": budget, "error": f"{type(exc).__name__}: {exc}"}
        results.append(result)
        print("GAME_RESULT=" + json.dumps(result, separators=(",", ":")), flush=True)
    completed = sum(bool(result.get("first_level_completed")) for result in results)
    summary = {
        "benchmark": "friday-public-arc3-causal-v1",
        "completed_first_levels": completed,
        "total_games": len(results),
        "results": results,
    }
    print("FRIDAY_ARC_CAUSAL_RESULT=" + json.dumps(summary, separators=(",", ":")), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
