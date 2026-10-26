#!/usr/bin/env python3
"""Standalone public ARC-AGI-3 benchmark for a compact local Qwen controller.

Public-data-only experiment. No private FRIDAY code or data is used.
The model receives a compact compiled state and proposes only the next action.
Low-level novelty exploration and action validation remain deterministic.
"""
from __future__ import annotations

import argparse, collections, hashlib, json, os, re, time
from typing import Any
import requests
from arc_agi import Arcade, OperationMode
from arcengine import GameAction, GameState


def built(v: Any) -> Any:
    if hasattr(v, "tolist"): return built(v.tolist())
    if isinstance(v, tuple): return [built(x) for x in v]
    if isinstance(v, list): return [built(x) for x in v]
    if isinstance(v, dict): return {k: built(x) for k, x in v.items()}
    return v


def grid(obs: Any) -> list[list[int]]:
    raw = built(getattr(obs, "frame", None))
    if not raw: return []
    if isinstance(raw[0], list) and raw[0] and isinstance(raw[0][0], int): return raw
    return raw[-1]


def sname(obs: Any) -> str:
    s = getattr(obs, "state", None)
    return getattr(s, "name", str(s))


def shash(obs: Any) -> str:
    p = [sname(obs), int(getattr(obs, "levels_completed", 0) or 0), grid(obs)]
    return hashlib.sha256(json.dumps(p, separators=(",", ":")).encode()).hexdigest()[:12]


def comps(g: list[list[int]], color: int) -> list[list[tuple[int,int]]]:
    if not g: return []
    h,w=len(g),len(g[0]); rem={(x,y) for y in range(h) for x in range(w) if g[y][x]==color}; out=[]
    while rem:
        p=rem.pop(); q=collections.deque([p]); c=[p]
        while q:
            x,y=q.popleft()
            for n in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if n in rem: rem.remove(n); q.append(n); c.append(n)
        out.append(c)
    return out


def compact_perception(obs: Any, prev: Any|None) -> dict[str,Any]:
    g=grid(obs)
    if not g: return {"shape":[0,0],"objects":[],"changed":None}
    h,w=len(g),len(g[0]); counts=collections.Counter(v for r in g for v in r); bg=counts.most_common(1)[0][0]
    objs=[]
    for color in sorted(counts, key=lambda c:(counts[c],c)):
        if color==bg: continue
        for c in sorted(comps(g,color), key=len, reverse=True)[:2]:
            xs=[p[0] for p in c]; ys=[p[1] for p in c]
            objs.append([color,len(c),round(sum(xs)/len(xs)),round(sum(ys)/len(ys)),min(xs),min(ys),max(xs),max(ys)])
            if len(objs)>=10: break
        if len(objs)>=10: break
    changed=None
    if prev is not None:
        pg=grid(prev)
        if pg and len(pg)==h and len(pg[0])==w:
            pts=[(x,y) for y in range(h) for x in range(w) if pg[y][x]!=g[y][x]]
            if pts:
                changed=[len(pts),round(sum(x for x,_ in pts)/len(pts)),round(sum(y for _,y in pts)/len(pts))]
    return {"shape":[w,h],"bg":bg,"objects":objs,"changed":changed}


def coords(obs: Any) -> list[tuple[int,int]]:
    p=compact_perception(obs,None); w,h=p["shape"]; out=[]
    for o in p["objects"]:
        for pt in ((o[2],o[3]),(o[4],o[5]),(o[6],o[7])):
            if pt not in out: out.append(pt)
    for pt in ((w//2,h//2),(0,0),(max(w-1,0),max(h-1,0))):
        if pt not in out: out.append(pt)
    return out[:12] or [(0,0)]


def akey(a: GameAction,d: dict[str,int]): return a.name,d.get("x"),d.get("y")


def fallback(env: Any,obs: Any,seen:set[tuple]) -> tuple[GameAction,dict[str,int],str]:
    h=shash(obs); acts=list(env.action_space); cs=coords(obs)
    for a in acts:
        if not a.is_complex() and (h,*akey(a,{})) not in seen: return a,{},"novel-simple"
    for a in acts:
        if a.is_complex():
            for x,y in cs:
                d={"x":int(x),"y":int(y)}
                if (h,*akey(a,d)) not in seen: return a,d,"novel-coordinate"
    a=acts[len(seen)%len(acts)]
    if a.is_complex():
        x,y=cs[len(seen)%len(cs)]; return a,{"x":int(x),"y":int(y)},"cycled"
    return a,{},"cycled"


def parse_obj(text:str):
    text=re.sub(r"<think>.*?</think>","",text,flags=re.S).strip()
    for c in [text]+re.findall(r"\{.*?\}",text,flags=re.S):
        try:
            x=json.loads(c)
            if isinstance(x,dict): return x
        except Exception: pass
    return None


def ask_model(env:Any,obs:Any,prev:Any|None,hist:list[dict[str,Any]],seen:set[tuple],timeout:float):
    acts=list(env.action_space); names=[a.name for a in acts]
    state={
        "level":int(getattr(obs,"levels_completed",0) or 0),
        "state":sname(obs),
        "actions":names,
        "coords":coords(obs),
        "view":compact_perception(obs,prev),
        "recent":hist[-4:],
    }
    prompt=("Unknown ARC-AGI-3 game. Choose one useful next action from actions. Infer rules from recent transitions. "
            "Prefer progress or information gain. Never invent actions. Coordinate actions may use listed coords. "
            "Return only JSON: {\"action\":\"ACTION1\"} or {\"action\":\"ACTION6\",\"x\":1,\"y\":2}. /no_think\n"+
            json.dumps(state,separators=(",",":")))
    t=time.perf_counter(); parsed=None; err="model"
    try:
        r=requests.post(os.environ.get("FRIDAY_MODEL_BASE_URL","http://127.0.0.1:8080/v1").rstrip("/")+"/chat/completions",
            json={"model":os.environ.get("FRIDAY_MODEL_ID","friday-qwen3-8b"),"messages":[{"role":"user","content":prompt}],"temperature":0,"max_tokens":32,"stream":False},timeout=timeout)
        r.raise_for_status(); parsed=parse_obj(r.json()["choices"][0]["message"]["content"])
    except Exception as e: err="model-"+type(e).__name__
    elapsed=time.perf_counter()-t
    if parsed:
        req=str(parsed.get("action","")).upper(); a=next((x for x in acts if x.name==req),None)
        if a:
            if a.is_complex():
                x,y=parsed.get("x"),parsed.get("y")
                if isinstance(x,int) and isinstance(y,int):
                    d={"x":x,"y":y}
                    if (shash(obs),*akey(a,d)) not in seen: return a,d,"model",elapsed
            elif (shash(obs),*akey(a,{})) not in seen: return a,{},"model",elapsed
    a,d,route=fallback(env,obs,seen); return a,d,err+"+"+route,elapsed


def play(game:str,max_actions:int,model_every:int,timeout:float,no_model:bool):
    arcade=Arcade(operation_mode=OperationMode.ONLINE); env=arcade.make(game,save_recording=False,include_frame_data=False)
    if env is None: raise RuntimeError("environment unavailable")
    obs=env.reset() or env.observation_space; prev=None; seen=set(); hist=[]; routes=collections.Counter(); best=0; over=0; calls=0; model_s=0.0; win=False; stagnant=0; start=time.perf_counter()
    for i in range(max_actions):
        consult=(not no_model) and (i==0 or i%model_every==0 or stagnant>=6)
        if consult:
            a,d,route,dt=ask_model(env,obs,prev,hist,seen,timeout); calls+=1; model_s+=dt; stagnant=0
        else:
            a,d,route=fallback(env,obs,seen); dt=0
        routes[route]+=1; seen.add((shash(obs),*akey(a,d))); before=obs; nxt=env.step(a,data=d)
        if nxt is None: continue
        prev=before; obs=nxt; changed=sum(x!=y for ra,rb in zip(grid(before),grid(obs)) for x,y in zip(ra,rb)) if grid(before) and grid(obs) else 0
        lev=int(getattr(obs,"levels_completed",0) or 0); best=max(best,lev); stagnant=stagnant+1 if changed==0 else 0
        hist.append({"a":a.name,"d":d,"chg":changed,"lvl":lev}); hist=hist[-6:]
        print(f"{game} step={i+1} route={route} action={a.name} changed={changed} levels={lev}",flush=True)
        if getattr(obs,"state",None) is GameState.WIN: win=True; break
        if getattr(obs,"state",None) is GameState.GAME_OVER:
            over+=1; r=env.reset(); obs=r or obs; prev=None; seen.clear(); hist.clear(); stagnant=0
    sc=arcade.close_scorecard()
    return {"game":game,"actions":i+1,"best_levels_completed":best,"win":win,"game_overs":over,"model_calls":calls,"model_seconds":round(model_s,2),"elapsed_seconds":round(time.perf_counter()-start,2),"routes":dict(routes),"scorecard":sc.model_dump(mode="json") if sc else None}


def main():
    p=argparse.ArgumentParser(); p.add_argument("--games",default="ar25,ft09,ls20"); p.add_argument("--max-actions",type=int,default=48); p.add_argument("--model-every",type=int,default=12); p.add_argument("--timeout",type=float,default=45); p.add_argument("--no-model",action="store_true"); a=p.parse_args(); results=[]
    for g in [x.strip().lower() for x in a.games.split(",") if x.strip()]:
        try:r=play(g,a.max_actions,a.model_every,a.timeout,a.no_model)
        except Exception as e:r={"game":g,"error":f"{type(e).__name__}:{e}"}
        results.append(r); print("GAME_RESULT="+json.dumps(r,separators=(",",":")),flush=True)
    print("FRIDAY_ARC_RESULT="+json.dumps({"benchmark":"public-arc3-compact-cpu-v2","no_model":a.no_model,"results":results},separators=(",",":")),flush=True)

if __name__=="__main__": main()
