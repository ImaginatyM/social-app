#!/usr/bin/env python3
"""M13.7-aligned public ARC-AGI-3 benchmark gate.

This file intentionally contains no private FRIDAY source. It reuses the already-public
REWM v2 benchmark controller and applies the causal-cycle correction validated in M13.7:
learned blocked transitions must never be reintroduced by graph navigation.

The benchmark remains game-agnostic and uses only public ARC actions/observations.
"""
from __future__ import annotations

import argparse
import collections
import json

import friday_arc3_rewm_v2 as v2


class M137KeyboardWorldModel(v2.KeyboardWorldModel):
    """REWM v2 keyboard model with M13.7 cycle-safe graph planning."""

    def __init__(self) -> None:
        super().__init__()
        self.cycle_edges: collections.deque[tuple[tuple[int, int], str, tuple[int, int]]] = collections.deque(maxlen=16)
        self.cycle_breaks = 0

    def _route_to_frontier(self, current: tuple[int, int], available: set[str]) -> list[str]:
        queue = collections.deque([(current, [])])
        visited = {current}
        while queue:
            pos, path = queue.popleft()
            remaining = [
                action
                for action in v2.DIRS
                if action in available
                and action not in self.tried_at_pos[pos]
                and (pos, action) not in self.blocked
            ]
            if remaining:
                return path
            for action, nxt in self.position_graph.get(pos, {}).items():
                # Critical M13.7 invariant: a transition falsified by observation cannot be
                # resurrected merely because an older graph edge still exists.
                if action not in available or (pos, action) in self.blocked or nxt == pos or nxt in visited:
                    continue
                visited.add(nxt)
                queue.append((nxt, path + [action]))
        return []

    def observe(self, before, action: str, data: dict[str, int], after) -> None:
        old_player = self.locate_player(before)
        before_level = int(getattr(before, "levels_completed", 0) or 0)
        super().observe(before, action, data, after)
        new_player = self.locate_player(after)
        after_level = int(getattr(after, "levels_completed", 0) or 0)
        if (
            action in v2.DIRS
            and old_player is not None
            and new_player is not None
            and before_level == after_level
        ):
            p0 = (old_player.cx2, old_player.cy2)
            p1 = (new_player.cx2, new_player.cy2)
            edge = (p0, action, p1)
            self.cycle_edges.append(edge)
            # If the exact same state/action transition is traversed repeatedly with no
            # objective progress, block it for graph navigation. This is deliberately
            # evidence-based rather than a game-specific heuristic.
            if sum(1 for item in self.cycle_edges if item == edge) >= 3:
                self.blocked.add((p0, action))
                self.plan.clear()
                self.cycle_breaks += 1


class M137Controller(v2.REWMController):
    def __init__(self) -> None:
        super().__init__()
        self.keyboard = M137KeyboardWorldModel()


# v2.play resolves this global at runtime, so the public harness can stay untouched.
v2.REWMController = M137Controller


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--games", default="ar25,ft09,lp85,ls20,dc22")
    parser.add_argument("--max-actions", type=int, default=300)
    args = parser.parse_args()

    results = []
    for game in [part.strip().lower() for part in args.games.split(",") if part.strip()]:
        try:
            result = v2.play(game, args.max_actions)
            result["m137"] = {
                "cycle_breaks": getattr(result, "cycle_breaks", None),
                "controller": "rewm-v2+cycle-safe-causal-planner",
            }
            results.append(result)
        except Exception as exc:
            result = {"game": game, "error": f"{type(exc).__name__}: {exc}"}
            results.append(result)
            print("GAME_RESULT=" + json.dumps(result), flush=True)

    summary = {
        "benchmark": "friday-m13.7-arc-agi3-public-five-game",
        "games": len(results),
        "levels_completed": sum(int(item.get("best_levels_completed", 0) or 0) for item in results),
        "nonzero_games": sum(int(item.get("best_levels_completed", 0) or 0) > 0 for item in results),
        "results": results,
    }
    print("M137_ARC_RESULT=" + json.dumps(summary, separators=(",", ":")), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
