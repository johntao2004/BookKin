#!/usr/bin/env python3
"""Measure supported tangent exits on actual source triangles, rejecting r23."""
import hashlib
import json
from pathlib import Path
import numpy as np
from verify_end_walls import Geometry
from verify_outer_aisles import ray_hits

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
CONFIG = ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json'

class StairGeometry:
    def __init__(self, path):
        source = Geometry(path)
        records = list(source.triangles((-10, -.5, -18), (10, 11, -10)))
        self.points = np.asarray([r[0] for r in records])
        self.materials = [r[1] for r in records]
        self.lo, self.hi = self.points.min(axis=1), self.points.max(axis=1)
    def triangles(self, lo, hi):
        for index in np.flatnonzero(np.all((self.hi >= lo) & (self.lo <= hi), axis=1)):
            yield self.points[index], self.materials[index]

def measure(path, config):
    g = StairGeometry(path)
    floor = config['dimensions']['galleryY']
    landings = []
    for side in (-1, 1):
        samples = []
        # The entire standing/turning zone including the former inner void.
        for x in (4.2, 4.6, 5.0, 5.5, 6.0, 7.0, 8.0, 8.6):
            for z in (-13.75, -14.65, -15.35, -16.2, -17.0):
                hits = ray_hits(g, (side*x, floor+.05, z), (0, -1, 0), .3)
                supported = bool(hits and -.002 <= hits[0][1][1]-floor <= .03)
                samples.append({'x': side*x, 'z': z, 'supported': supported})
        # A 1 m swept body band: 0.4 of center motion plus the unchanged .3 radius.
        blockers = []
        for dx in (-.2, 0, .2):
            for z in (-13.65, -14.2, -14.8, -15.4, -16.0, -16.5):
                for dy in (.5, 1.0, 1.78):
                    p = (side*4.6+dx, floor+dy, z)
                    for angle in np.arange(8)*np.pi/4:
                        hit = ray_hits(g, p, (np.cos(angle), 0, np.sin(angle)), .3)
                        if hit: blockers.append({'point': p, 'hit': hit[0][1]})
        landings.append({'side': side, 'floorSamples': samples, 'bodyBlockers': blockers,
                         'passed': all(s['supported'] for s in samples) and not blockers})
    return {'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'landings': landings, 'passed': all(s['passed'] for s in landings)}

if __name__ == '__main__':
    config = json.loads(CONFIG.read_text())
    current = measure(SOURCE, config)
    baseline = measure(ROOT/'.artifacts/model-clearance/stairs-before-r24.glb', config)
    report = {'revision': config['revision'], 'configSha256': hashlib.sha256(CONFIG.read_bytes()).hexdigest(),
              'contract': {'platformWidth': 5.3, 'platformDepth': 4.2, 'clearSweptExitBand': 1.0,
                           'bodyRadius': .3, 'physicalTriangleMeasurements': True},
              'current': current, 'baseline': baseline, 'negativeControlRejectsPreviousModel': not baseline['passed'],
              'passed': current['passed'] and not baseline['passed']}
    (ROOT/'docs/verification/reference-library-stair-landings.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'passed': report['passed'], 'negativeControl': not baseline['passed'],
                      'bodyBlockers': [len(x['bodyBlockers']) for x in current['landings']],
                      'unsupported': [sum(not s['supported'] for s in x['floorSamples']) for x in current['landings']]}))
    raise SystemExit(0 if report['passed'] else 1)
