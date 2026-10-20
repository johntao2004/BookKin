#!/usr/bin/env python3
"""Standalone GLB geometry verifier for B-end balcony continuous joinery.

Checks each of the three balcony assemblies is one closed solid (top mitered
handrail, bottom rail, stitched platform+fascia) rather than separate capped tubes /
separate fascia parts. Uses connected components over shared undirected edges,
not vertex touches.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from verify_end_walls import Geometry

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts/hogwarts-library/deliverables/architecture-uncompressed.glb"
CFG = ROOT / "apps/web/public/assets/hogwarts-library/scene-config.json"
BASE = ROOT / ".artifacts/model-clearance/balcony-before-r28.glb"
REPORT = ROOT / "docs/verification/reference-library-balcony-joinery.json"

BOX = ((-2.8, 6.7, 13.4), (2.8, 8.9, 15.61))
MATS = ("Oak", "Walnut")
WELD = 5  # decimal places -> survives float32


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load(path: Path):
    lo, hi = BOX
    tris, mats, degenerate = [], [], 0
    for tri, mat in Geometry(path).triangles(lo, hi):
        if not any(mat.startswith(prefix + " •") for prefix in MATS):
            continue
        raw = np.asarray(tri)
        if not (np.all(raw >= np.asarray(lo)) and np.all(raw <= np.asarray(hi))):
            continue
        a = np.round(raw, WELD)
        if np.linalg.norm(a[0] - a[1]) == 0 or np.linalg.norm(a[1] - a[2]) == 0 \
                or np.linalg.norm(a[2] - a[0]) == 0:
            degenerate += 1
            continue
        tris.append(a)
        mats.append(mat)
    return tris, mats, degenerate


def components(tris, mats):
    """DSU over faces sharing a whole undirected edge; vertex contacts do not join."""
    key, faces, n = {}, [], 0

    def vid(v):
        nonlocal n
        k = tuple(float(x) for x in v)
        if k not in key:
            key[k] = n
            n += 1
        return key[k]

    for t in tris:
        ids = [vid(v) for v in t]
        faces.append(ids)
    vlist = [None] * n
    for k, i in key.items():
        vlist[i] = k
    parent = list(range(len(faces)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    edge_face = {}
    for fi, f in enumerate(faces):
        for i in range(3):
            edge = tuple(sorted((f[i], f[(i+1)%3])))
            if edge in edge_face:
                a, b = find(fi), find(edge_face[edge])
                if a != b:
                    parent[b] = a
            else:
                edge_face[edge] = fi
    groups = {}
    for fi in range(len(faces)):
        groups.setdefault(find(fi), []).append(fi)
    out = []
    for fis in groups.values():
        ids = [v for fi in fis for v in faces[fi]]
        out.append({
            "faces": [faces[fi] for fi in fis],
            "bounds": (tuple(min(vlist[i][j] for i in ids) for j in range(3)),
                       tuple(max(vlist[i][j] for i in ids) for j in range(3))),
            "ntri": len(fis),
            "mat": max(set(mats[fi] for fi in fis),
                       key=lambda m: sum(mats[x] == m for x in fis)),
        })
    return out


CRIT = {
    "top_rail":    ((8.435, 8.665), 5.03, 13.785, 15.6),
    "bottom_rail": ((7.48, 7.68), 5.0, 13.8, 15.6),
    "platform":    ((6.888, 7.44), 5.24, 13.68, 15.6),
}
TOL = 0.002
THRESHOLDS = {k: {"y": v[0], "xspan": v[1], "minz": v[2], "maxz": v[3]}
              for k, v in CRIT.items()}
LIMITATIONS = (
    "bounded components only (domain x[-2.8,2.8] y[6.7,8.9] z[13.4,15.61], "
    "Oak/Walnut, weld at 5dp); no general solid boolean collision, no "
    "browser/interactivity proof; config used only for revision+hash record.")


def one_closed(comps, name):
    """Exactly one candidate matching bounds; every edge incidence exactly 2."""
    ylo, yhi = CRIT[name][0]
    xspan, minz, maxz = CRIT[name][1], CRIT[name][2], CRIT[name][3]
    cand = [c for c in comps
            if abs(c["bounds"][1][0] - c["bounds"][0][0] - xspan) <= TOL
            and abs(c["bounds"][0][0]+xspan/2) <= TOL
            and abs(c["bounds"][1][0]-xspan/2) <= TOL
            and abs(c["bounds"][0][2]-minz) <= TOL
            and abs(c["bounds"][1][2]-maxz) <= TOL
            and abs(c["bounds"][0][1]-ylo) <= TOL and abs(c["bounds"][1][1]-yhi) <= TOL]
    if len(cand) != 1:
        return False, ["exactly-one count=%d" % len(cand)]
    inc = {}
    for f in cand[0]["faces"]:
        for i in range(3):
            u, v = f[i], f[(i + 1) % 3]
            e = (u, v) if u < v else (v, u)
            inc[e] = inc.get(e, 0) + 1
    bad = [e for e, n in inc.items() if n != 2]
    return (True, []) if not bad else (False, ["edge-incidence n=%d" % len(bad)])


PATH = [(-2.4,15.6),(-2.4,14.62),(-1.45,13.9),(1.45,13.9),(2.4,14.62),(2.4,15.6)]

def spindle_checks(comps):
    # Actual upright components terminate inside both continuous rails. Check
    # one corner infill, no second turned post on the reused terminal shafts,
    # and real spacing along every edge, independently of config metadata.
    centers = []
    for c in comps:
        lo, hi = c['bounds']
        if (abs(lo[1]-7.58)<=TOL and abs(hi[1]-8.55)<=TOL
                and abs(hi[0]-lo[0]-.164)<=TOL
                and abs(hi[2]-lo[2]-.164)<=TOL):
            centers.append(((lo[0]+hi[0])/2,(lo[2]+hi[2])/2))
    errors = []
    if len(centers)!=25:
        errors.append(f'expected 25 separate infills, got {len(centers)}')
    for k, (x,z) in enumerate(PATH):
        count = sum(np.hypot(cx-x,cz-z)<=TOL for cx,cz in centers)
        expected = 0 if k in (0,len(PATH)-1) else 1
        if count!=expected:
            errors.append(f'corner/terminal {k}: {count}, expected {expected}')
    gaps = []
    for (x,z),(xx,zz) in zip(PATH,PATH[1:]):
        delta=np.array([xx-x,zz-z]);length=np.linalg.norm(delta);unit=delta/length
        stations=[0.0,float(length)]
        for cx,cz in centers:
            offset=np.array([cx-x,cz-z]);t=float(offset@unit)
            if -.002<=t<=length+.002 and np.linalg.norm(offset-unit*t)<=TOL:
                stations.append(min(float(length),max(0.0,t)))
        stations=sorted(set(round(t,5) for t in stations))
        gap=max(b-a for a,b in zip(stations,stations[1:]));gaps.append(gap)
        if gap>.30+TOL:
            errors.append(f'unsupported infill gap {gap}')
    return (not errors, errors), {'centers':centers,'maximumSegmentGaps':gaps}


def main():
    cfg = json.loads(open(CFG).read())
    rec = cfg.get("revision") or cfg.get("hash")
    data = {
        "revision_record": rec,
        "source_sha256": sha256(SRC),
        "baseline_sha256": sha256(BASE),
        "config_hash": hashlib.sha256(open(CFG, "rb").read()).hexdigest(),
        "box": BOX, "materials": list(MATS), "weld_dp": WELD,
        "tolerances": {"all_expected_bounds": TOL},
        "exact_thresholds": THRESHOLDS,
        "limitations": [LIMITATIONS],
    }
    status = {}
    for label, path in (("baseline", BASE), ("current", SRC)):
        tris, mats, deg = load(path)
        comps = components(tris, mats)
        results = {}
        for name in CRIT:
            results[name] = one_closed(comps, name)
        results["uprights"], upright_report = spindle_checks(comps)
        data[label] = {"triangles": len(tris), "degenerate": deg,
                       "components": [{"ntri": c["ntri"], "mat": c["mat"],
                                       "min": c["bounds"][0], "max": c["bounds"][1]}
                                      for c in comps],
                       "results": results, "uprights":upright_report}
        status[label] = results
        print("[%s] tris=%d degenerate=%d comps=%d" % (label, len(tris), deg, len(comps)))
        for name, r in results.items():
            print("  %-12s %s" % (name, "PASS" if r[0] else "FAIL " + str(r[1])))
    negative = all(not status["baseline"][name][0] for name in ("top_rail", "bottom_rail"))
    passed = negative and all(r[0] for r in status["current"].values())
    data["negativeControlBothRailsRejected"] = negative
    data["passed"] = bool(passed)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(data, indent=2))
    print("OVERALL", "PASS" if passed else "FAIL")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())