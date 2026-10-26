#!/usr/bin/env python3
"""Public ARC-AGI-3 benchmark for a Retrodictive Executable World Model (REWM) v2.

Standalone benchmark code only; no private FRIDAY code/data is used.

Design goals:
- never use raw frame hashes as semantic state;
- represent frames as objects/components and transition evidence;
- infer the controllable object's motion from action/outcome pairs;
- retrodict learned movement rules over the transition ledger;
- explore keyboard worlds as a graph of semantic positions;
- explore click worlds with object + lattice candidates and anti-loop evidence;
- reward only actual level progress, never raw pixel activity.

The agent is game-agnostic. It knows only the public ARC action semantics.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
import time
from dataclasses import dataclass
from typing import Any, Iterable

from arc_agi import Arcade, OperationMode
from arcengine import GameAction, GameState

DIRS = ("ACTION1", "ACTION2", "ACTION3", "ACTION4")
EXPECTED_SIGN = {
    "ACTION1": (0, -1),
    "ACTION2": (0, 1),
    "ACTION3": (-1, 0),
    "ACTION4": (1, 0),
}
INVERSE = {"ACTION1": "ACTION2", "ACTION2": "ACTION1", "ACTION3": "ACTION4", "ACTION4": "ACTION3"}


def builtin(value: Any) -> Any:
    if hasattr(value, "tolist"):
        return builtin(value.tolist())
    if isinstance(value, tuple):
        return [builtin(v) for v in value]
    if isinstance(value, list):
        return [builtin(v) for v in value]
    if isinstance(value, dict):
        return {k: builtin(v) for k, v in value.items()}
    return value


def frame_stack(obs: Any) -> list[list[list[int]]]:
    raw = getattr(obs, "frame", None)
    if raw is None:
        return []
    value = builtin(raw)
    if not value:
        return []
    # Some clients return a single 2-D frame, others a T x H x W animation stack.
    if isinstance(value[0], list) and value[0] and isinstance(value[0][0], int):
        return [value]
    return value


def grid(obs: Any) -> list[list[int]]:
    frames = frame_stack(obs)
    return frames[-1] if frames else []


def state_name(obs: Any) -> str:
    state = getattr(obs, "state", None)
    return getattr(state, "name", str(state))


def actions(env: Any) -> dict[str, GameAction]:
    return {action.name: action for action in list(env.action_space)}


@dataclass(frozen=True)
class Component:
    color: int
    size: int
    x0: int
    y0: int
    x1: int
    y1: int
    cx2: int  # center x * 2, integer for stable exact matching
    cy2: int

    @property
    def width(self) -> int:
        return self.x1 - self.x0 + 1

    @property
    def height(self) -> int:
        return self.y1 - self.y0 + 1

    @property
    def center(self) -> tuple[float, float]:
        return self.cx2 / 2, self.cy2 / 2

    @property
    def shape_sig(self) -> tuple[int, int, int, int]:
        return self.color, self.size, self.width, self.height


def connected_components(g: list[list[int]], color: int) -> list[Component]:
    if not g or not g[0]:
        return []
    h, w = len(g), len(g[0])
    remaining = {(x, y) for y in range(h) for x in range(w) if g[y][x] == color}
    out: list[Component] = []
    while remaining:
        start = remaining.pop()
        queue = collections.deque([start])
        cells = [start]
        while queue:
            x, y = queue.popleft()
            for nxt in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if nxt in remaining:
                    remaining.remove(nxt)
                    queue.append(nxt)
                    cells.append(nxt)
        xs = [x for x, _ in cells]
        ys = [y for _, y in cells]
        out.append(
            Component(
                color=color,
                size=len(cells),
                x0=min(xs),
                y0=min(ys),
                x1=max(xs),
                y1=max(ys),
                cx2=round(2 * sum(xs) / len(xs)),
                cy2=round(2 * sum(ys) / len(ys)),
            )
        )
    return out


def components(obs: Any, max_component_size: int = 1200) -> list[Component]:
    g = grid(obs)
    if not g or not g[0]:
        return []
    counts = collections.Counter(value for row in g for value in row)
    background = counts.most_common(1)[0][0]
    out: list[Component] = []
    for color in counts:
        if color == background:
            continue
        for comp in connected_components(g, color):
            if comp.size <= max_component_size:
                out.append(comp)
    return sorted(out, key=lambda c: (c.size, c.color, c.y0, c.x0))


def component_inventory(obs: Any, ignore_sig: tuple[int, int, int, int] | None = None) -> tuple[Any, ...]:
    """Object-centric signature, robust to animation stacks and background churn.

    Large components/HUD-like structures are intentionally omitted. Centers are quantized
    to 2-cell bins so sub-cell sprite animation does not create a new logical state.
    """
    items: list[tuple[int, int, int, int, int, int]] = []
    for comp in components(obs, max_component_size=512):
        if ignore_sig is not None and comp.shape_sig == ignore_sig:
            continue
        qx = round((comp.cx2 / 2) / 2)
        qy = round((comp.cy2 / 2) / 2)
        items.append((comp.color, min(comp.size, 255), comp.width, comp.height, qx, qy))
    # Cap to keep noisy sprite fragments from dominating identity.
    return tuple(sorted(items)[:48])


def semantic_hash(obs: Any, player: Component | None = None) -> str:
    payload = {
        "level": int(getattr(obs, "levels_completed", 0) or 0),
        "player": None if player is None else [player.shape_sig, player.cx2, player.cy2],
        "objects": component_inventory(obs, None if player is None else player.shape_sig),
    }
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest()[:18]


def raw_changed_cells(a: Any, b: Any) -> int:
    ga, gb = grid(a), grid(b)
    if not ga or not gb or len(ga) != len(gb):
        return 0
    total = 0
    for ra, rb in zip(ga, gb):
        if len(ra) != len(rb):
            return 0
        total += sum(x != y for x, y in zip(ra, rb))
    return total


def match_component_motion(before: Any, after: Any) -> list[tuple[Component, Component, int, int]]:
    """Find same-shape components that moved between the final settled frames."""
    old = components(before, max_component_size=512)
    new = components(after, max_component_size=512)
    by_sig_new: dict[tuple[int, int, int, int], list[Component]] = collections.defaultdict(list)
    for comp in new:
        by_sig_new[comp.shape_sig].append(comp)

    moves: list[tuple[Component, Component, int, int]] = []
    for src in old:
        candidates = by_sig_new.get(src.shape_sig, [])
        if not candidates:
            continue
        dst = min(candidates, key=lambda c: abs(c.cx2 - src.cx2) + abs(c.cy2 - src.cy2))
        dx2, dy2 = dst.cx2 - src.cx2, dst.cy2 - src.cy2
        if dx2 or dy2:
            # Ignore huge teleports from ambiguous repeated-shape matching.
            if abs(dx2) <= 32 and abs(dy2) <= 32:
                moves.append((src, dst, dx2, dy2))
    return moves


def direction_compatible(action: str, dx2: int, dy2: int) -> bool:
    sx, sy = EXPECTED_SIGN.get(action, (0, 0))
    if sx:
        return dx2 * sx > 0 and abs(dx2) >= abs(dy2)
    if sy:
        return dy2 * sy > 0 and abs(dy2) >= abs(dx2)
    return False


@dataclass
class Transition:
    action: str
    data: dict[str, int]
    before_sem: str
    after_sem: str
    level_before: int
    level_after: int
    raw_changed: int
    moved: list[tuple[tuple[int, int, int, int], int, int]]


class KeyboardWorldModel:
    def __init__(self) -> None:
        self.ledger: list[Transition] = []
        self.sig_votes: collections.Counter[tuple[int, int, int, int]] = collections.Counter()
        self.action_vectors: dict[str, collections.Counter[tuple[int, int]]] = collections.defaultdict(collections.Counter)
        self.player_sig: tuple[int, int, int, int] | None = None
        self.last_player: Component | None = None
        self.position_graph: dict[tuple[int, int], dict[str, tuple[int, int]]] = collections.defaultdict(dict)
        self.tried_at_pos: dict[tuple[int, int], set[str]] = collections.defaultdict(set)
        self.blocked: set[tuple[tuple[int, int], str]] = set()
        self.probe_count: collections.Counter[str] = collections.Counter()
        self.plan: collections.deque[str] = collections.deque()
        self.level = 0
        self.retrodiction_confidence = 0.0

    def reset_level_graph(self, keep_model: bool = True) -> None:
        self.position_graph.clear()
        self.tried_at_pos.clear()
        self.blocked.clear()
        self.plan.clear()
        self.last_player = None
        if not keep_model:
            self.sig_votes.clear()
            self.action_vectors.clear()
            self.player_sig = None
            self.retrodiction_confidence = 0.0

    def locate_player(self, obs: Any) -> Component | None:
        if self.player_sig is None:
            return None
        matches = [c for c in components(obs, max_component_size=512) if c.shape_sig == self.player_sig]
        if not matches:
            return None
        if self.last_player is None:
            return matches[0] if len(matches) == 1 else None
        return min(matches, key=lambda c: abs(c.cx2 - self.last_player.cx2) + abs(c.cy2 - self.last_player.cy2))

    def _refresh_player_model(self) -> None:
        if not self.sig_votes:
            return
        sig, votes = self.sig_votes.most_common(1)[0]
        # Require repeated directional evidence before trusting the controlled object.
        if votes >= 2:
            self.player_sig = sig
        if self.player_sig is None:
            return
        relevant = [t for t in self.ledger if any(m[0] == self.player_sig for m in t.moved) and t.action in DIRS]
        if not relevant:
            return
        good = 0
        total = 0
        for transition in relevant:
            for sig2, dx2, dy2 in transition.moved:
                if sig2 != self.player_sig:
                    continue
                total += 1
                if direction_compatible(transition.action, dx2, dy2):
                    good += 1
        self.retrodiction_confidence = good / total if total else 0.0
        # Reject a seductive but historically inconsistent player hypothesis.
        if total >= 4 and self.retrodiction_confidence < 0.65:
            self.sig_votes[self.player_sig] = 0
            self.player_sig = None
            self.last_player = None

    def observe(self, before: Any, action: str, data: dict[str, int], after: Any) -> None:
        level_before = int(getattr(before, "levels_completed", 0) or 0)
        level_after = int(getattr(after, "levels_completed", 0) or 0)
        old_player = self.locate_player(before)
        moves = match_component_motion(before, after)
        moved_summary: list[tuple[tuple[int, int, int, int], int, int]] = []
        for src, dst, dx2, dy2 in moves:
            moved_summary.append((src.shape_sig, dx2, dy2))
            if action in DIRS and direction_compatible(action, dx2, dy2):
                # Favor compact moving objects over huge decorative regions.
                weight = 3 if src.size <= 64 else 2 if src.size <= 256 else 1
                self.sig_votes[src.shape_sig] += weight
                self.action_vectors[action][(dx2, dy2)] += weight
        self._refresh_player_model()

        new_player = self.locate_player(after)
        before_sem = semantic_hash(before, old_player)
        after_sem = semantic_hash(after, new_player)
        self.ledger.append(
            Transition(
                action=action,
                data=data,
                before_sem=before_sem,
                after_sem=after_sem,
                level_before=level_before,
                level_after=level_after,
                raw_changed=raw_changed_cells(before, after),
                moved=moved_summary,
            )
        )

        if old_player is not None and new_player is not None and action in DIRS:
            p0 = (old_player.cx2, old_player.cy2)
            p1 = (new_player.cx2, new_player.cy2)
            self.tried_at_pos[p0].add(action)
            if p0 == p1:
                self.blocked.add((p0, action))
            else:
                self.position_graph[p0][action] = p1
                inverse = INVERSE[action]
                self.position_graph[p1].setdefault(inverse, p0)
            self.last_player = new_player
        elif new_player is not None:
            self.last_player = new_player

        if level_after > level_before:
            self.level = level_after
            self.reset_level_graph(keep_model=True)

    def _vector(self, action: str) -> tuple[int, int] | None:
        if not self.action_vectors[action]:
            return None
        return self.action_vectors[action].most_common(1)[0][0]

    def _route_to_frontier(self, current: tuple[int, int], available: set[str]) -> list[str]:
        queue = collections.deque([(current, [])])
        visited = {current}
        while queue:
            pos, path = queue.popleft()
            remaining = [a for a in DIRS if a in available and a not in self.tried_at_pos[pos] and (pos, a) not in self.blocked]
            if remaining:
                return path
            for action, nxt in self.position_graph.get(pos, {}).items():
                if action not in available or nxt in visited:
                    continue
                visited.add(nxt)
                queue.append((nxt, path + [action]))
        return []

    def choose(self, env: Any, obs: Any) -> tuple[GameAction, dict[str, int], str]:
        available = actions(env)
        dir_names = [name for name in DIRS if name in available]
        if not dir_names:
            # Non-keyboard simple action, if any.
            simple = [a for a in available.values() if not a.is_complex() and a.name != "RESET"]
            if simple:
                return simple[0], {}, "simple-probe"
            raise RuntimeError("no keyboard/simple action")

        player = self.locate_player(obs)
        if player is not None and self.retrodiction_confidence >= 0.65:
            current = (player.cx2, player.cy2)
            if self.plan:
                name = self.plan.popleft()
                if name in available:
                    return available[name], {}, "graph-plan"

            # Prefer actions that, from the learned displacement model, lead to an unseen position.
            candidates: list[tuple[int, int, str]] = []
            for name in dir_names:
                if name in self.tried_at_pos[current] or (current, name) in self.blocked:
                    continue
                vec = self._vector(name)
                predicted_seen = 1
                if vec is not None:
                    predicted = (current[0] + vec[0], current[1] + vec[1])
                    predicted_seen = int(predicted in self.position_graph)
                candidates.append((predicted_seen, self.probe_count[name], name))
            if candidates:
                _, _, name = min(candidates)
                self.probe_count[name] += 1
                return available[name], {}, "semantic-frontier"

            route = self._route_to_frontier(current, set(available))
            if route:
                self.plan.extend(route[1:])
                return available[route[0]], {}, "bfs-to-frontier"

        # Before the player abstraction is trusted, gather discriminating direction probes.
        # Avoid immediate inverse pairs when possible to get broader evidence.
        dir_names.sort(key=lambda name: (self.probe_count[name], -sum(self.action_vectors[name].values())))
        name = dir_names[0]
        self.probe_count[name] += 1
        return available[name], {}, "causal-probe"


class ClickWorldModel:
    def __init__(self) -> None:
        self.level = 0
        self.tried_in_state: dict[str, set[tuple[int, int]]] = collections.defaultdict(set)
        self.global_attempts: collections.Counter[tuple[int, int]] = collections.Counter()
        self.no_effect: set[tuple[int, int]] = set()
        self.effect_value: collections.Counter[tuple[int, int]] = collections.Counter()
        self.recent: collections.deque[tuple[int, int]] = collections.deque(maxlen=8)
        self.ledger: list[Transition] = []

    def reset_level(self) -> None:
        self.tried_in_state.clear()
        self.global_attempts.clear()
        self.no_effect.clear()
        self.effect_value.clear()
        self.recent.clear()

    def logical_state(self, obs: Any) -> str:
        # No full-frame hash: only object inventory + level.
        payload = [int(getattr(obs, "levels_completed", 0) or 0), component_inventory(obs)]
        return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest()[:18]

    def candidate_coordinates(self, obs: Any) -> list[tuple[int, int]]:
        g = grid(obs)
        if not g or not g[0]:
            return [(32, 32)]
        h, w = len(g), len(g[0])
        out: list[tuple[int, int]] = []

        # 1) Object centers and corners: strong prior for buttons/pieces.
        for comp in components(obs, max_component_size=1024):
            cx, cy = comp.center
            for point in (
                (round(cx), round(cy)),
                (comp.x0, comp.y0),
                (comp.x1, comp.y1),
                ((comp.x0 + comp.x1) // 2, comp.y0),
                ((comp.x0 + comp.x1) // 2, comp.y1),
            ):
                if 0 <= point[0] < w and 0 <= point[1] < h and point not in out:
                    out.append(point)

        # 2) Generic spatial probes. ARC click targets can be background-like and therefore
        # invisible to component-centroid heuristics. Interleave 8px lattices with offsets.
        for offset in (4, 0, 2, 6):
            for y in range(offset, h, 8):
                for x in range(offset, w, 8):
                    point = (x, y)
                    if point not in out:
                        out.append(point)

        # 3) Coarser center/corners as final fallback.
        for point in ((w // 2, h // 2), (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
            if point not in out:
                out.append(point)
        return out

    def observe(self, before: Any, action: str, data: dict[str, int], after: Any) -> None:
        before_level = int(getattr(before, "levels_completed", 0) or 0)
        after_level = int(getattr(after, "levels_completed", 0) or 0)
        before_sem = self.logical_state(before)
        after_sem = self.logical_state(after)
        changed = raw_changed_cells(before, after)
        coord = (int(data.get("x", -1)), int(data.get("y", -1)))
        self.global_attempts[coord] += 1
        self.recent.append(coord)

        # Pixel churn is evidence that an action has an effect, NOT evidence of progress.
        if before_sem == after_sem and after_level == before_level:
            self.no_effect.add(coord)
        elif after_level == before_level:
            self.effect_value[coord] += 1
        else:
            # Genuine objective progress is the only strong reward.
            self.effect_value[coord] += 1000 * (after_level - before_level)

        self.ledger.append(
            Transition(
                action=action,
                data=data,
                before_sem=before_sem,
                after_sem=after_sem,
                level_before=before_level,
                level_after=after_level,
                raw_changed=changed,
                moved=[],
            )
        )
        if after_level > before_level:
            self.level = after_level
            self.reset_level()

    def choose(self, env: Any, obs: Any) -> tuple[GameAction, dict[str, int], str]:
        available = actions(env)
        if "ACTION6" not in available:
            # Interact may be the meaningful non-coordinate operation in mixed worlds.
            if "ACTION5" in available:
                return available["ACTION5"], {}, "interact-probe"
            simple = [a for a in available.values() if not a.is_complex() and a.name != "RESET"]
            if simple:
                return simple[0], {}, "simple-probe"
            raise RuntimeError("no usable click/simple action")

        state = self.logical_state(obs)
        candidates = self.candidate_coordinates(obs)

        def rank(coord: tuple[int, int]) -> tuple[int, int, int, int]:
            repeated_recently = sum(1 for item in self.recent if item == coord)
            return (
                int(coord in self.no_effect),
                int(coord in self.tried_in_state[state]),
                self.global_attempts[coord] + 3 * repeated_recently,
                -self.effect_value[coord],
            )

        # Never let an animated but non-progressing coordinate monopolize the controller.
        usable = [c for c in candidates if self.global_attempts[c] < 3 or self.effect_value[c] >= 1000]
        if not usable:
            usable = candidates
        coord = min(usable, key=rank)
        self.tried_in_state[state].add(coord)
        return available["ACTION6"], {"x": coord[0], "y": coord[1]}, "evidence-click"


class REWMController:
    def __init__(self) -> None:
        self.keyboard = KeyboardWorldModel()
        self.click = ClickWorldModel()
        self.level = 0
        self.no_progress_steps = 0
        self.mode_counts = collections.Counter()

    def choose(self, env: Any, obs: Any) -> tuple[GameAction, dict[str, int], str]:
        available = actions(env)
        has_dirs = any(name in available for name in DIRS)
        has_click = "ACTION6" in available
        # Pure click worlds are handled by click induction. Keyboard/mixed worlds start with
        # controllable-object induction; ACTION5/6 can be added later when navigation stalls.
        if has_click and not has_dirs:
            action, data, route = self.click.choose(env, obs)
            self.mode_counts["click"] += 1
            return action, data, route
        if has_dirs:
            # If keyboard exploration has made no objective progress for a long time in a mixed
            # world, occasionally probe interaction/click rather than cycling directions forever.
            if self.no_progress_steps >= 32:
                if "ACTION5" in available and self.no_progress_steps % 8 == 0:
                    self.mode_counts["interact"] += 1
                    return available["ACTION5"], {}, "stuck-interact"
                if has_click and self.no_progress_steps % 8 == 4:
                    action, data, _ = self.click.choose(env, obs)
                    self.mode_counts["click"] += 1
                    return action, data, "stuck-click"
            action, data, route = self.keyboard.choose(env, obs)
            self.mode_counts["keyboard"] += 1
            return action, data, route
        action, data, route = self.click.choose(env, obs)
        self.mode_counts["other"] += 1
        return action, data, route

    def observe(self, before: Any, action: str, data: dict[str, int], after: Any) -> None:
        before_level = int(getattr(before, "levels_completed", 0) or 0)
        after_level = int(getattr(after, "levels_completed", 0) or 0)
        if action == "ACTION6":
            self.click.observe(before, action, data, after)
        else:
            self.keyboard.observe(before, action, data, after)
        if after_level > before_level:
            self.level = after_level
            self.no_progress_steps = 0
        else:
            self.no_progress_steps += 1

    def reset_after_game_over(self) -> None:
        # Keep causal model evidence across a retry, but discard current graph/short-term loops.
        self.keyboard.reset_level_graph(keep_model=True)
        self.click.tried_in_state.clear()
        self.click.recent.clear()
        self.no_progress_steps = 0


def play(game_id: str, max_actions: int) -> dict[str, Any]:
    arcade = Arcade(operation_mode=OperationMode.ONLINE)
    env = arcade.make(game_id, save_recording=False, include_frame_data=False)
    if env is None:
        raise RuntimeError(f"environment unavailable: {game_id}")
    obs = env.reset()
    if obs is None:
        obs = env.observation_space
    if obs is None:
        raise RuntimeError("no initial observation")

    controller = REWMController()
    started = time.perf_counter()
    best_levels = int(getattr(obs, "levels_completed", 0) or 0)
    game_overs = 0
    route_counts = collections.Counter()
    actions_taken = 0

    for index in range(max_actions):
        action, data, route = controller.choose(env, obs)
        before = obs
        next_obs = env.step(action, data=data)
        actions_taken += 1
        route_counts[route] += 1
        if next_obs is None:
            print(f"{game_id} step={index+1} route={route} action={action.name} data={data} no_obs=1", flush=True)
            continue
        obs = next_obs
        controller.observe(before, action.name, data, obs)
        levels = int(getattr(obs, "levels_completed", 0) or 0)
        best_levels = max(best_levels, levels)
        player = controller.keyboard.locate_player(obs)
        print(
            f"{game_id} step={index+1} route={route} action={action.name} data={data} "
            f"changed={raw_changed_cells(before,obs)} levels={levels} state={state_name(obs)} "
            f"player_sig={controller.keyboard.player_sig} player={None if player is None else player.center} "
            f"retro={controller.keyboard.retrodiction_confidence:.2f}",
            flush=True,
        )
        if getattr(obs, "state", None) is GameState.WIN:
            break
        if getattr(obs, "state", None) is GameState.GAME_OVER:
            game_overs += 1
            reset_obs = env.reset()
            if reset_obs is not None:
                obs = reset_obs
            controller.reset_after_game_over()

    card = arcade.close_scorecard()
    result = {
        "game": game_id,
        "actions": actions_taken,
        "best_levels_completed": best_levels,
        "game_overs": game_overs,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "routes": dict(route_counts),
        "modes": dict(controller.mode_counts),
        "keyboard": {
            "player_sig": controller.keyboard.player_sig,
            "retrodiction_confidence": round(controller.keyboard.retrodiction_confidence, 3),
            "ledger": len(controller.keyboard.ledger),
            "graph_states": len(controller.keyboard.position_graph),
            "action_vectors": {k: v.most_common(3) for k, v in controller.keyboard.action_vectors.items()},
        },
        "click": {
            "ledger": len(controller.click.ledger),
            "unique_coords": len(controller.click.global_attempts),
            "no_effect_coords": len(controller.click.no_effect),
        },
        "scorecard": card.model_dump(mode="json") if card is not None else None,
    }
    print("GAME_RESULT=" + json.dumps(result, separators=(",", ":")), flush=True)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--games", default="ft09,lp85,ls20")
    parser.add_argument("--max-actions", type=int, default=300)
    args = parser.parse_args()
    results = []
    for game in [part.strip().lower() for part in args.games.split(",") if part.strip()]:
        try:
            results.append(play(game, args.max_actions))
        except Exception as exc:
            result = {"game": game, "error": f"{type(exc).__name__}: {exc}"}
            results.append(result)
            print("GAME_RESULT=" + json.dumps(result), flush=True)
    print("REWM_V2_RESULT=" + json.dumps({"benchmark": "rewm-v2-public", "results": results}, separators=(",", ":")), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
