#!/usr/bin/env python3
# 探测共享拱肩和端墙连接，并要求当前模型通过、指定旧模型失败及 18 个碰撞连接存在。
# Probes shared arcade shoulders and end-wall ties, requiring current geometry to pass, the specified baseline to fail and 18 collision ties to exist.
"""Measure solid shared arcade shoulders and both terminal wall ties in the GLB."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from verify_end_walls import Geometry
from verify_outer_aisles import ray_hits
ROOT=Path(__file__).resolve().parents[2]
class LinkGeometry:
    def __init__(self,path):
        rows=list(Geometry(path).triangles((-9.5,4.9,-20),(9.5,7.5,20)))
        self.points=np.asarray([p for p,_ in rows]);self.materials=[m for _,m in rows]
        self.lo,self.hi=self.points.min(axis=1),self.points.max(axis=1)
    def triangles(self,lo,hi):
        for i in np.flatnonzero(np.all((self.hi>=lo)&(self.lo<=hi),axis=1)):
            yield self.points[i],self.materials[i]
def measure(path):
    g=LinkGeometry(path);rows=[]
    for side in(-1,1):
        for z in(-19.8,-17.5,-15,-10,-5,0,5,10,15,17.5,19.8):
            for y in(5.2,6.0,6.5):
                hits=ray_hits(g,(side*8,y,z),(side,0,0),1.2)
                first=hits[0] if hits else None
                passed=bool(first and abs(abs(first[1][0])-8.53)<.003 and first[2]=='Oak • rubbed midtone')
                rows.append({'side':side,'z':z,'y':y,'passed':passed})
        for z in(-19.8,-17.5,17.5,19.8):
            hits=ray_hits(g,(side*8,7.1,z),(side,0,0),1.2)
            rows.append({'side':side,'z':z,'kind':'beam-to-wall','passed':bool(hits and abs(abs(hits[0][1][0])-8.32)<.003)})
    return {'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'probes':len(rows),
            'failures':[r for r in rows if not r['passed']],'passed':all(r['passed'] for r in rows)}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path,required=True);a=p.parse_args()
    current=measure(ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb');baseline=measure(a.baseline)
    config=json.loads((ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json').read_text())
    ties=[c for c in config['colliders'] if c['id'].startswith(('arcade-shared-shoulder-','arcade-end-wall-tie-'))]
    result={'revision':config['revision'],'current':current,'baseline':baseline,'collisionCount':len(ties),
            'passed':current['passed'] and not baseline['passed'] and len(ties)==18}
    (ROOT/'docs/verification/reference-library-arcade-wall-links.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'passed':result['passed'],'current':current,'collisionCount':len(ties)}));raise SystemExit(0 if result['passed'] else 1)
