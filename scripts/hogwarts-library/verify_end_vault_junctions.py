#!/usr/bin/env python3
# 拒绝与 A 端弧形拱底相交的凸起画墙补片，要求当前模型通过且改动前模型失败。
# Rejects raised A-end picture-wall patches intersecting the curved soffit, requiring current geometry to pass and pre-change geometry to fail.
"""Reject raised picture-wall patches that intersect the A-end curved soffit."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from verify_end_walls import Geometry
from verify_outer_aisles import ray_hits

ROOT = Path(__file__).resolve().parents[2]
STONE = 'Stone • warm ashlar'
BLUE = 'Paint • blue gray vault'


class JunctionGeometry:
    def __init__(self, path, end=-1):
        zlo, zhi = (-20.1, -15) if end < 0 else (15, 20.1)
        rows = list(Geometry(path).triangles((-20, 9, zlo), (20, 17.6, zhi)))
        self.points = np.asarray([t for t, _ in rows])
        self.materials = [m for _, m in rows]
        self.lo, self.hi = self.points.min(axis=1), self.points.max(axis=1)

    def triangles(self, lo, hi):
        for i in np.flatnonzero(np.all((self.hi >= lo) & (self.lo <= hi), axis=1)):
            yield self.points[i], self.materials[i]


def measure(path):
    geometry = JunctionGeometry(path)
    patches, probes = {}, []
    for x, width in [(-10.5, 4.8), (-4.6, 3.5), (4.6, 3.5), (10.5, 4.8)]:
        # The complete retained wall ends at -20.0, safely outside this slab.
        patches[str(x)] = sum(1 for _, m in geometry.triangles(
            (x-width/2, 9, -19.99), (x+width/2, 15.52, -19.89)) if m == STONE)
        for dx in (-.6, 0, .6):
            for y in (10, 13.8, 15.4):
                hits = [h for h in ray_hits(geometry, (x+dx, y, -19.2), (0, 0, -1), 1)
                        if h[2] == STONE]
                probes.append({'kind': 'continuous-wall', 'x': x+dx, 'y': y,
                               'passed': bool(hits and abs(hits[0][1][2]+20) < .003)})
    for side in (-1, 1):
        for x in (9.3, 10.5, 12.5):
            for z in (-19.7, -19.9, -19.97):
                expected = 14.58+2.94*math.sqrt(1-((z+17.5)/2.5)**2)
                hits = [h for h in ray_hits(geometry, (side*x, 13.8, z), (0, 1, 0), 4)
                        if h[2] == BLUE]
                probes.append({'kind': 'retained-curved-soffit', 'x': side*x, 'z': z,
                               'passed': bool(hits and abs(hits[0][1][1]-expected) < .015)})
    for end in (-1, 1):
        end_geometry = geometry if end < 0 else JunctionGeometry(path, end)
        for side in (-1, 1):
            for x in (9.08, 12, 14.65, 17.1, 19.78):
                hits = [h for h in ray_hits(end_geometry, (side*x, 16.5, end*17.5), (0, 1, 0), 1.1)
                        if h[2] == 'Oak • edge highlight']
                probes.append({'kind': 'inset-timber-rib', 'x': side*x, 'end': end,
                               'passed': bool(hits and abs(hits[0][1][1]-17.46) < .008)})
    return {'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'raisedStonePatchTriangles': patches, 'probes': len(probes),
            'failures': [p for p in probes if not p['passed']],
            'passed': not any(patches.values()) and all(p['passed'] for p in probes)}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--baseline', type=Path, required=True)
    args = p.parse_args()
    source = ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
    config = json.loads((ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json').read_text())
    current, before = measure(source), measure(args.baseline)
    report = {'revision': config['revision'], 'current': current, 'baseline': before,
              'passed': current['passed'] and not before['passed'],
              'scope': 'Actual exported wall/soffit geometry; browser evidence is separate.'}
    (ROOT/'docs/verification/reference-library-end-vault-junctions.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
