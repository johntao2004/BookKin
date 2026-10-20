#!/usr/bin/env python3
"""Check terminal arch openings, curved soffits, wall jambs and floor trim joins."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from verify_end_walls import Geometry
from verify_outer_aisles import ray_hits
ROOT=Path(__file__).resolve().parents[2]
class CachedGeometry:
    def __init__(self,path):
        rows=list(Geometry(path).triangles((-9.5,4.5,-20),(9.5,7.55,20)))
        self.p=np.asarray([p for p,_ in rows]);self.m=[m for _,m in rows]
        self.lo,self.hi=self.p.min(axis=1),self.p.max(axis=1)
    def triangles(self,lo,hi):
        for i in np.flatnonzero(np.all((self.hi>=lo)&(self.lo<=hi),axis=1)):
            yield self.p[i],self.m[i]
def measure(path):
    g=CachedGeometry(path);rows=[]
    for side in(-1,1):
        for end in(-1,1):
            z=end*17.5
            for y in(5.2,6.0):
                h=ray_hits(g,(side*8,y,z),(side,0,0),1.2)
                rows.append({'kind':'open-arch','side':side,'end':end,'y':y,'passed':not h})
            h=ray_hits(g,(side*8.8,5,z),(0,1,0),2)
            rows.append({'kind':'curved-soffit','side':side,'end':end,'passed':bool(h and h[0][2]=='Paint • blue gray vault' and abs(h[0][1][1]-6.492)<.004)})
            h=ray_hits(g,(side*8,5.2,end*19.95),(side,0,0),1.2)
            rows.append({'kind':'wall-jamb','side':side,'end':end,'passed':bool(h and abs(abs(h[0][1][0])-8.53)<.003)})
    for end in(-1,1):
        for x in(-8.1,-4,4,8.1):
            h=ray_hits(g,(x,7.1,end*14),(0,0,end),2)
            rows.append({'kind':'crosswalk-profile','end':end,'x':x,'passed':bool(h and abs(abs(h[0][1][2])-15.12)<.003)})
    h=ray_hits(g,(0,7.1,12),(0,0,1),3)
    rows.append({'kind':'balcony-matching-profile','passed':bool(h and abs(h[0][1][2]-13.42)<.003)})
    return {'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'probes':len(rows),'failures':[r for r in rows if not r['passed']],'passed':all(r['passed'] for r in rows)}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path,required=True);a=p.parse_args()
    current=measure(ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb');baseline=measure(a.baseline)
    result={'current':current,'baseline':baseline,'passed':current['passed'] and not baseline['passed']}
    (ROOT/'docs/verification/reference-library-terminal-arches.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result));raise SystemExit(0 if result['passed'] else 1)
