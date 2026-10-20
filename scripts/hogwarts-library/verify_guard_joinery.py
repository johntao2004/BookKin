#!/usr/bin/env python3
"""Measure guard mouldings and slender vertical spindles in the real export."""
import hashlib
import json
import math
from pathlib import Path
from verify_stair_landings import StairGeometry
from verify_outer_aisles import ray_hits

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
CONFIG=ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json'

def measure(path, config):
    geometry=StairGeometry(path)
    results=[]
    for guard in config['guardJoinery']['runs']:
        floor=guard['floorY']
        for run in guard['runs']:
            a,b=run['start'],run['end'];dx=b['x']-a['x'];dz=b['z']-a['z']
            length=math.hypot(dx,dz);normal=(dz/length,0,-dx/length)
            def width(x,y,z):
                distances=[]
                for sign in (-1,1):
                    origin=(x+sign*.25*normal[0],y,z+sign*.25*normal[2])
                    hits=ray_hits(geometry,origin,tuple(-sign*v for v in normal),.5)
                    if not hits:return None
                    distances.append(hits[0][0])
                return .5-sum(distances)
            for spindle in run['spindles']:
                # At the profile's widest turning, the two physical surfaces
                # must stay .12 apart on a vertical, unscaled center line.
                actual=width(spindle['x'],floor+.62,spindle['z'])
                clearance=min(math.hypot(spindle['x']-p['x'],spindle['z']-p['z']) for p in (a,b))
                results.append({'guard':guard['id'],'kind':'spindle','point':spindle,
                                'width':actual,'newelDistance':clearance,
                                'passed':actual is not None and abs(actual-.12)<.002 and clearance>.19})
            for t in (.25,.5,.75):
                x=a['x']+dx*t;z=a['z']+dz*t
                actual=width(x,floor+1.12,z)
                results.append({'guard':guard['id'],'kind':'handrail','t':t,'width':actual,
                                'passed':actual is not None and abs(actual-.30)<.002})
    return {'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'samples':results,
            'passed':bool(results) and all(x['passed'] for x in results)}

if __name__=='__main__':
    config=json.loads(CONFIG.read_text())
    current=measure(SOURCE,config)
    baseline=measure(ROOT/'.artifacts/model-clearance/guards-before-r25.glb',config)
    result={'revision':config['revision'],'configSha256':hashlib.sha256(CONFIG.read_bytes()).hexdigest(),
            'contract':'one structural newel per vertex; .12 spindle width; .30 uniform straight handrail width; inset spindle centers clear of newels',
            'current':current,'baseline':baseline,'negativeControlRejectsR24':not baseline['passed'],
            'passed':current['passed'] and not baseline['passed']}
    (ROOT/'docs/verification/reference-library-guard-joinery.json').write_text(json.dumps(result,indent=2)+'\n')
    failed=[x for x in current['samples'] if not x['passed']]
    print(json.dumps({'passed':result['passed'],'samples':len(current['samples']),'failures':failed,'negativeControl':not baseline['passed']}))
    raise SystemExit(0 if result['passed'] else 1)
