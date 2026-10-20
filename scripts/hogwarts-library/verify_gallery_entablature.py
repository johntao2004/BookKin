#!/usr/bin/env python3
# 沿廊下通长檐口测量空隙和深度台阶，以旧 GLB 作为必须失败的负对照。
# Samples the continuous gallery entablature for gaps and depth steps, using the old GLB as a required failing control.
"""Reject gaps and depth steps in the exported longitudinal gallery entablature."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from verify_end_walls import Geometry
from verify_outer_aisles import ray_hits

ROOT = Path(__file__).resolve().parents[2]

class BeamGeometry:
    def __init__(self, path):
        rows = list(Geometry(path).triangles((-9.5, 6.6, -15.6), (9.5, 7.49, 15.6)))
        self.points = np.asarray([p for p, _ in rows])
        self.materials = [m for _, m in rows]
        self.lo, self.hi = self.points.min(axis=1), self.points.max(axis=1)
    def triangles(self, lo, hi):
        for i in np.flatnonzero(np.all((self.hi >= lo) & (self.lo <= hi), axis=1)):
            yield self.points[i], self.materials[i]

def measure(path):
    geometry = BeamGeometry(path)
    rows = []
    # Sample every former bay boundary and the spans on both sides of it.
    for side in (-1, 1):
        for z in range(-15, 16):
            for y, expected in ((6.75, 8.43), (7.10, 8.32), (7.42, 8.37)):
                hits = ray_hits(geometry, (side*8, y, z), (side, 0, 0), 1)
                first = hits[0] if hits else None
                passed = bool(first and abs(abs(first[1][0])-expected) < .002)
                rows.append({'side': side, 'z': z, 'y': y, 'frontX': first[1][0] if first else None, 'passed': passed})
    return {'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'probes': len(rows), 'failures': [r for r in rows if not r['passed']],
            'passed': all(r['passed'] for r in rows)}

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--baseline', type=Path, required=True)
    args = p.parse_args()
    source = ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
    current, baseline = measure(source), measure(args.baseline)
    result = {'current': current, 'baseline': baseline, 'passed': current['passed'] and not baseline['passed']}
    (ROOT/'docs/verification/reference-library-gallery-entablature.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result))
    raise SystemExit(0 if result['passed'] else 1)
