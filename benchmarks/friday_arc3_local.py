#!/usr/bin/env python3
"""Public, standalone ARC-AGI-3 local-model benchmark harness.

No private FRIDAY code or data is used. The harness combines a local OpenAI-compatible
model with compact frame summaries, short transition memory, action validation, and a
generic novelty fallback. It is intentionally game-agnostic.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import time
from typing import Any

import requests
from arc_agi import Arcade, OperationMode
from arcengine import GameAction, GameState


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


def frames(obs: Any) -> list[list[list[int]]]:
    raw = getattr(obs, "frame", None)
    if raw is None:
        return []
    value = builtin(raw)
    if not value:
        return []
    # Some ARC clients expose one 2-D frame, others a list of 2-D frames.
    if isinstance(value[0], list) and value[0] and isinstance(value[0][0], int):
        return [value]
    return value


def grid(obs: Any) -> list[list[int]]:
    fs = frames(obs)
    return fs[-1] if fs else []


def state_name(obs: Any) -> str:
    s = getattr(obs, "state", None)
    return getattr(s, "name", str(s))


def state_hash(obs: Any) -> str:
    payload = {
        "state": state_name(obs),
        "levels": int(getattr(obs, "levels_completed", 0) or 0),
        "grid": grid(obs),
    }
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest()[:16]


def changed_cells(a: Any, b: Any) -> int:
    ga, gb = grid(a), grid(b)
    if not ga or not gb or len(ga) != len(gb):
        return 0
    total = 0
    for ra, rb in zip(ga, gb):
        if len(ra) != len(rb):
            return 0
        total += sum(x != y for x, y in zip(ra, rb))
    return total


def components(g: list[list[int]], color: int) -> list[list[tuple[int, int]]]:
    if not g:
        return []
    h, w = len(g), len(g[0])
    remaining = {(x, y) for y in range(h) for x in range(w) if g[y][x] == color}
    out: list[list[tuple[int, int]]] = []
    while remaining:
        start = remaining.pop()
        q = collections.deque([start])
        comp = [start]
        while q:
            x, y = q.popleft()
            for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if n in remaining:
                    remaining.remove(n)
                    q.append(n)
                    comp.append(n)
        out.append(comp)
    return out


def perception(obs: Any, previous: Any | None = None) -> dict[str, Any]:
    g = grid(obs)
    if not g:
        return {"shape": [0, 0], "colors": [], "objects": [], "changed": []}
    h, w = len(g), len(g[0])
    counts = collections.Counter(v for row in g for v in row)
    background = counts.most_common(1)[0][0]
    objects: list[dict[str, Any]] = []
    for color in sorted(counts, key=lambda c: (counts[c], c)):
        if color == background:
            continue
        for comp in sorted(components(g, color), key=len, reverse=True)[:5]:
            xs = [p[0] for p in comp]
            ys = [p[1] for p in comp]
            objects.append({
                "color": color,
                "size": len(comp),
                "center": [round(sum(xs) / len(xs), 1), round(sum(ys) / len(ys), 1)],
                "bbox": [min(xs), min(ys), max(xs), max(ys)],
            })
    objects = sorted(objects, key=lambda x: (x["size"], x["color"]))[:24]

    changed: list[list[int]] = []
    if previous is not None:
        pg = grid(previous)
        if pg and len(pg) == h and all(len(row) == w for row in pg):
            pts = [(x, y) for y in range(h) for x in range(w) if pg[y][x] != g[y][x]]
            if pts:
                # Keep a compact sample plus centroid of changed pixels.
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                changed = [[x, y] for x, y in pts[:8]]
                changed.append([round(sum(xs) / len(xs)), round(sum(ys) / len(ys))])

    return {
        "shape": [w, h],
        "background": background,
        "colors": sorted([[int(c), int(n)] for c, n in counts.items()], key=lambda p: p[1]),
        "objects": objects,
        "changed": changed,
    }


def candidate_coords(obs: Any, previous: Any | None = None) -> list[tuple[int, int]]:
    p = perception(obs, previous)
    w, h = p["shape"]
    if not w or not h:
        return [(0, 0)]
    out: list[tuple[int, int]] = []
    for obj in p["objects"]:
        cx, cy = obj["center"]
        x0, y0, x1, y1 = obj["bbox"]
        for point in ((round(cx), round(cy)), (x0, y0), (x1, y1)):
            if point not in out:
                out.append(point)
    for point in p["changed"]:
        t = (int(point[0]), int(point[1]))
        if t not in out:
            out.append(t)
    for point in ((w // 2, h // 2), (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if point not in out:
            out.append(point)
    return out[:32]


def parse_json(text: str) -> dict[str, Any] | None:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    candidates = [text] + re.findall(r"\{.*?\}", text, flags=re.S)
    for candidate in candidates:
        try:
            value = json.loads(candidate)
            if isinstance(value, dict):
                return value
        except Exception:
            pass
    return None


def action_key(action: GameAction, data: dict[str, int]) -> tuple[str, int | None, int | None]:
    return action.name, data.get("x"), data.get("y")


def fallback_choice(
    env: Any,
    obs: Any,
    previous: Any | None,
    seen: set[tuple[str, str, int | None, int | None]],
) -> tuple[GameAction, dict[str, int], str]:
    sh = state_hash(obs)
    actions = list(env.action_space)
    coords = candidate_coords(obs, previous)
    for action in actions:
        if action.is_complex():
            continue
        data: dict[str, int] = {}
        if (sh, *action_key(action, data)) not in seen:
            return action, data, "novel-simple"
    for action in actions:
        if not action.is_complex():
            continue
        for x, y in coords:
            data = {"x": int(x), "y": int(y)}
            if (sh, *action_key(action, data)) not in seen:
                return action, data, "novel-coordinate"
    action = actions[len(seen) % len(actions)]
    if action.is_complex():
        x, y = coords[len(seen) % len(coords)]
        return action, {"x": int(x), "y": int(y)}, "cycled"
    return action, {}, "cycled"


def model_choice(
    env: Any,
    obs: Any,
    previous: Any | None,
    history: list[dict[str, Any]],
    seen: set[tuple[str, str, int | None, int | None]],
) -> tuple[GameAction, dict[str, int], str, float]:
    actions = list(env.action_space)
    names = [a.name for a in actions]
    coords = candidate_coords(obs, previous)
    compact = {
        "state": state_name(obs),
        "levels_completed": int(getattr(obs, "levels_completed", 0) or 0),
        "perception": perception(obs, previous),
        "available_actions": names,
        "candidate_coordinates": coords,
        "recent_transitions": history[-8:],
    }
    prompt = (
        "You control an unknown ARC-AGI-3 environment. Infer action semantics only from observed transitions. "
        "Goal: complete levels using as few actions as possible. Prefer information-gaining actions when uncertain. "
        "Never invent an unavailable action. For a coordinate action, choose x/y from the candidate list when possible. "
        "Return ONLY JSON with keys action, optional x, optional y, and hypothesis. /no_think\n" +
        json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    )
    base = os.environ.get("FRIDAY_MODEL_BASE_URL", "http://127.0.0.1:8080/v1").rstrip("/")
    model = os.environ.get("FRIDAY_MODEL_ID", "Qwen/Qwen3-8B-MLX-4bit")
    started = time.perf_counter()
    parsed = None
    err = "model"
    try:
        r = requests.post(
            base + "/chat/completions",
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "Act as a concise adaptive game controller. Output strict JSON only."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0,
                "max_tokens": 100,
                "stream": False,
            },
            timeout=20,
        )
        r.raise_for_status()
        parsed = parse_json(r.json()["choices"][0]["message"]["content"])
    except Exception as exc:
        err = f"model-{type(exc).__name__}"
    elapsed = time.perf_counter() - started

    if parsed:
        requested = str(parsed.get("action", "")).upper()
        action = next((a for a in actions if a.name == requested), None)
        if action is not None:
            if action.is_complex():
                x, y = parsed.get("x"), parsed.get("y")
                if isinstance(x, int) and isinstance(y, int):
                    w, h = perception(obs)["shape"]
                    if 0 <= x < max(w, 1) and 0 <= y < max(h, 1):
                        data = {"x": x, "y": y}
                        if (state_hash(obs), *action_key(action, data)) not in seen:
                            return action, data, "model", elapsed
            else:
                data = {}
                if (state_hash(obs), *action_key(action, data)) not in seen:
                    return action, data, "model", elapsed

    action, data, route = fallback_choice(env, obs, previous, seen)
    return action, data, f"{err}+{route}", elapsed


def play(game_id: str, max_actions: int, model_every: int) -> dict[str, Any]:
    arcade = Arcade(operation_mode=OperationMode.ONLINE)
    env = arcade.make(game_id, save_recording=False, include_frame_data=False)
    if env is None:
        raise RuntimeError(f"environment unavailable: {game_id}")
    obs = env.reset()
    if obs is None:
        obs = env.observation_space
    previous = None
    history: list[dict[str, Any]] = []
    seen: set[tuple[str, str, int | None, int | None]] = set()
    best_levels = int(getattr(obs, "levels_completed", 0) or 0)
    model_calls = 0
    model_seconds = 0.0
    route_counts = collections.Counter()
    game_overs = 0
    win = False
    started = time.perf_counter()

    for i in range(max_actions):
        if i % model_every == 0:
            action, data, route, model_elapsed = model_choice(env, obs, previous, history, seen)
            model_calls += 1
            model_seconds += model_elapsed
        else:
            action, data, route = fallback_choice(env, obs, previous, seen)
            model_elapsed = 0.0
        route_counts[route] += 1
        seen.add((state_hash(obs), *action_key(action, data)))

        before = obs
        next_obs = env.step(action, data=data)
        if next_obs is None:
            continue
        previous = before
        obs = next_obs
        levels = int(getattr(obs, "levels_completed", 0) or 0)
        best_levels = max(best_levels, levels)
        transition = {
            "action": action.name,
            "data": data,
            "changed_cells": changed_cells(before, obs),
            "levels": levels,
            "state": state_name(obs),
        }
        history.append(transition)
        print(f"{game_id} step={i+1} route={route} action={action.name} data={data} changed={transition['changed_cells']} levels={levels} state={transition['state']}", flush=True)

        if getattr(obs, "state", None) is GameState.WIN:
            win = True
            break
        if getattr(obs, "state", None) is GameState.GAME_OVER:
            game_overs += 1
            reset = env.reset()
            if reset is not None:
                obs = reset
            previous = None
            history.clear()
            seen.clear()

    scorecard = arcade.close_scorecard()
    return {
        "game": game_id,
        "actions": len(history),
        "best_levels_completed": best_levels,
        "win": win,
        "game_overs": game_overs,
        "model_calls": model_calls,
        "model_seconds": round(model_seconds, 3),
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "routes": dict(route_counts),
        "scorecard": scorecard.model_dump(mode="json") if scorecard else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--games", default="ar25,ft09,lp85,ls20,dc22")
    parser.add_argument("--max-actions", type=int, default=60)
    parser.add_argument("--model-every", type=int, default=2)
    args = parser.parse_args()
    results = []
    for game_id in [x.strip().lower() for x in args.games.split(",") if x.strip()]:
        try:
            result = play(game_id, args.max_actions, args.model_every)
        except Exception as exc:
            result = {"game": game_id, "error": f"{type(exc).__name__}: {exc}"}
        results.append(result)
        print("GAME_RESULT=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")), flush=True)
    summary = {"benchmark": "friday-local-arc-agi3-public-v1", "results": results}
    print("FRIDAY_ARC_RESULT=" + json.dumps(summary, ensure_ascii=False, separators=(",", ":")), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
