#!/usr/bin/env python3
"""Standalone public ARC-AGI-3 world-model benchmark.

No private FRIDAY code/data. Generic explorer only:
- persistent state/action graph
- documented ARC action semantics (A1..A4 directions, A5 interact, A6 click, A7 undo)
- connected-component click proposals
- DFS/frontier exploration + inverse-action backtracking
- empirical action-effect memory across states
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any

from arc_agi import Arcade, OperationMode
from arcengine import GameAction, GameState

INV = {"ACTION1":"ACTION2", "ACTION2":"ACTION1", "ACTION3":"ACTION4", "ACTION4":"ACTION3"}
DIRS = ("ACTION1","ACTION2","ACTION3","ACTION4")


def builtin(v: Any) -> Any:
    if hasattr(v, "tolist"): return builtin(v.tolist())
    if isinstance(v, tuple): return [builtin(x) for x in v]
    if isinstance(v, list): return [builtin(x) for x in v]
    if isinstance(v, dict): return {k:builtin(x) for k,x in v.items()}
    return v


def frames(obs: Any) -> list[list[list[int]]]:
    raw = getattr(obs,"frame",None)
    if raw is None: return []
    v = builtin(raw)
    if not v: return []
    if isinstance(v[0],list) and v[0] and isinstance(v[0][0],int): return [v]
    return v


def grid(obs: Any) -> list[list[int]]:
    fs=frames(obs); return fs[-1] if fs else []


def state_name(obs: Any) -> str:
    s=getattr(obs,"state",None); return getattr(s,"name",str(s))


def state_hash(obs: Any) -> str:
    payload=[state_name(obs),int(getattr(obs,"levels_completed",0) or 0),grid(obs)]
    return hashlib.sha256(json.dumps(payload,separators=(",",":")).encode()).hexdigest()[:20]


def changed(a: Any,b: Any)->int:
    ga,gb=grid(a),grid(b)
    if not ga or not gb or len(ga)!=len(gb): return 0
    n=0
    for ra,rb in zip(ga,gb):
        if len(ra)!=len(rb): return 0
        n += sum(x!=y for x,y in zip(ra,rb))
    return n


def comps(g:list[list[int]], color:int)->list[list[tuple[int,int]]]:
    if not g:return []
    h,w=len(g),len(g[0]); rem={(x,y) for y in range(h) for x in range(w) if g[y][x]==color}; out=[]
    while rem:
        s=rem.pop(); q=collections.deque([s]); c=[s]
        while q:
            x,y=q.popleft()
            for p in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if p in rem: rem.remove(p); q.append(p); c.append(p)
        out.append(c)
    return out


def click_candidates(obs:Any, limit:int=48)->list[tuple[int,int,str]]:
    g=grid(obs)
    if not g:return [(32,32,"default")]
    h,w=len(g),len(g[0]); cnt=collections.Counter(v for r in g for v in r); bg=cnt.most_common(1)[0][0]
    cand=[]
    # Small/rare components first. This is generic visual saliency, not game-specific.
    for color in sorted(cnt,key=lambda c:(cnt[c],c)):
        if color==bg: continue
        for comp in sorted(comps(g,color),key=len)[:8]:
            xs=[p[0] for p in comp]; ys=[p[1] for p in comp]
            cx,cy=round(sum(xs)/len(xs)),round(sum(ys)/len(ys))
            sig=f"c{color}:n{min(len(comp),99)}:b{max(xs)-min(xs)+1}x{max(ys)-min(ys)+1}"
            for x,y in ((cx,cy),comp[0],comp[-1]):
                item=(int(x),int(y),sig)
                if item not in cand: cand.append(item)
                if len(cand)>=limit:return cand
    for x,y in ((w//2,h//2),(0,0),(w-1,0),(0,h-1),(w-1,h-1)):
        item=(x,y,"fallback")
        if item not in cand:cand.append(item)
    return cand[:limit]


@dataclass
class Edge:
    src:str; action:str; data:dict[str,int]; dst:str; changed:int; level_delta:int


class Explorer:
    def __init__(self):
        self.tried:dict[str,set[tuple[str,int|None,int|None]]]=collections.defaultdict(set)
        self.edges:dict[str,list[Edge]]=collections.defaultdict(list)
        self.parents:dict[str,tuple[str,str]|None]={}
        self.effect=collections.Counter()      # semantic action signature -> changed count sum
        self.trials=collections.Counter()
        self.progress=collections.Counter()
        self.click_sig_stats=collections.Counter()
        self.click_sig_trials=collections.Counter()
        self.stack:list[str]=[]

    def reset_level(self):
        self.tried.clear(); self.edges.clear(); self.parents.clear(); self.stack.clear()

    @staticmethod
    def key(action:str,data:dict[str,int])->tuple[str,int|None,int|None]:
        return action,data.get("x"),data.get("y")

    def record(self,src:str,action:str,data:dict[str,int],dst:str,delta:int,level_delta:int,click_sig:str|None=None):
        self.edges[src].append(Edge(src,action,data,dst,delta,level_delta))
        self.trials[action]+=1; self.effect[action]+=delta; self.progress[action]+=max(0,level_delta)
        if click_sig:
            self.click_sig_trials[click_sig]+=1
            self.click_sig_stats[click_sig]+=delta + 100000*max(0,level_delta)
        if dst!=src and dst not in self.parents and action in INV:
            self.parents[dst]=(src,INV[action])

    def choose(self,env:Any,obs:Any)->tuple[GameAction,dict[str,int],str,str|None]:
        sh=state_hash(obs); available={a.name:a for a in env.action_space}
        self.parents.setdefault(sh,None)

        # Try directional actions in a balanced order. Persist attempts per actual state.
        dirs=[a for a in DIRS if a in available]
        dirs.sort(key=lambda a:(self.trials[a],-self.progress[a],-self.effect[a]))
        for name in dirs:
            k=(name,None,None)
            if k not in self.tried[sh]:
                self.tried[sh].add(k); return available[name],{},"frontier-direction",None

        # Interact is cheap and often state-sensitive; try once per state after movement probes.
        if "ACTION5" in available:
            k=("ACTION5",None,None)
            if k not in self.tried[sh]:
                self.tried[sh].add(k); return available["ACTION5"],{},"frontier-interact",None

        # Click candidates are ranked by learned component-signature effect, then rarity order.
        if "ACTION6" in available:
            candidates=click_candidates(obs)
            candidates.sort(key=lambda p:(
                0 if self.click_sig_trials[p[2]]==0 else 1,
                -(self.click_sig_stats[p[2]]/max(1,self.click_sig_trials[p[2]])),
            ))
            for x,y,sig in candidates:
                k=("ACTION6",x,y)
                if k not in self.tried[sh]:
                    self.tried[sh].add(k); return available["ACTION6"],{"x":x,"y":y},"frontier-click",sig

        # If Undo exists, use it as a generic backtracking operator after exhausting a state.
        if "ACTION7" in available:
            k=("ACTION7",None,None)
            if k not in self.tried[sh]:
                self.tried[sh].add(k); return available["ACTION7"],{},"undo-backtrack",None

        # For directional worlds, use known inverse of parent edge to backtrack.
        parent=self.parents.get(sh)
        if parent and parent[1] in available:
            return available[parent[1]],{},"inverse-backtrack",None

        # Last resort: pick empirically best-changing simple action; avoids a fixed ACTION1 loop.
        simples=[a for a in available if not a.is_complex()]
        if simples:
            simples.sort(key=lambda a:(-self.progress[a.name],-(self.effect[a.name]/max(1,self.trials[a.name])),self.trials[a.name]))
            return simples[0],{},"empirical-fallback",None
        if "ACTION6" in available:
            x,y,sig=click_candidates(obs)[0]; return available["ACTION6"],{"x":x,"y":y},"click-fallback",sig
        raise RuntimeError("no available action")


def play(game_id:str,max_actions:int)->dict[str,Any]:
    arcade=Arcade(operation_mode=OperationMode.ONLINE)
    env=arcade.make(game_id,save_recording=False,include_frame_data=False)
    if env is None:raise RuntimeError("environment unavailable")
    obs=env.reset() or env.observation_space
    ex=Explorer(); best=int(getattr(obs,"levels_completed",0) or 0); previous_levels=best
    counts=collections.Counter(); game_overs=0; started=time.perf_counter(); actions_taken=0
    for i in range(max_actions):
        src=state_hash(obs); action,data,route,click_sig=ex.choose(env,obs); before=obs
        nxt=env.step(action,data=data); actions_taken+=1; counts[route]+=1
        if nxt is None: continue
        obs=nxt; levels=int(getattr(obs,"levels_completed",0) or 0); delta=changed(before,obs)
        ex.record(src,action.name,data,state_hash(obs),delta,levels-previous_levels,click_sig)
        best=max(best,levels)
        print(f"{game_id} step={i+1} route={route} action={action.name} data={data} changed={delta} levels={levels} state={state_name(obs)}",flush=True)
        if levels>previous_levels:
            previous_levels=levels; ex.reset_level()
        if getattr(obs,"state",None) is GameState.WIN: break
        if getattr(obs,"state",None) is GameState.GAME_OVER:
            game_overs+=1; r=env.reset(); obs=r if r is not None else obs; ex.reset_level()
    card=arcade.close_scorecard()
    result={
        "game":game_id,"actions":actions_taken,"best_levels_completed":best,"game_overs":game_overs,
        "elapsed_seconds":round(time.perf_counter()-started,3),"routes":dict(counts),
        "action_trials":dict(ex.trials),"action_progress":dict(ex.progress),
        "scorecard":card.model_dump(mode="json") if card else None,
    }
    print("GAME_RESULT="+json.dumps(result,separators=(",",":")),flush=True)
    return result


def main()->int:
    p=argparse.ArgumentParser(); p.add_argument("--games",default="ar25,ft09,lp85,ls20,dc22"); p.add_argument("--max-actions",type=int,default=250); a=p.parse_args()
    results=[]
    for game in [x.strip().lower() for x in a.games.split(",") if x.strip()]:
        try:results.append(play(game,a.max_actions))
        except Exception as e:
            r={"game":game,"error":f"{type(e).__name__}: {e}"}; print("GAME_RESULT="+json.dumps(r),flush=True); results.append(r)
    print("WORLD_MODEL_RESULT="+json.dumps({"benchmark":"arc3-worldmodel-v1","results":results},separators=(",",":")),flush=True)
    return 0

if __name__=="__main__": raise SystemExit(main())
