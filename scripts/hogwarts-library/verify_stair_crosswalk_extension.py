#!/usr/bin/env python3
# 探测延伸平台、双木扶手与出口净空；提供基线时要求旧模型失败，避免只有新模型自证。
# Probes the extended deck, dual timber rails and exit clearance, requiring an optional supplied baseline to fail rather than checking only the new model.
"""Probe actual exported deck, dual timber handrails and unobstructed exits."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from verify_stair_landings import StairGeometry
from verify_outer_aisles import ray_hits

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
CONFIG = ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json'


def measure(path, config):
    geometry = StairGeometry(path)
    floor = config['dimensions']['galleryY']
    probes = []
    for x in (-3.7, -2, 0, 2, 3.7):
        for z in (-15.55, -14.8, -14, -13.75):
            hits = ray_hits(geometry, (x, floor+.04, z), (0, -1, 0), .12)
            probes.append({'kind': 'deck', 'point': [x, floor, z],
                           'passed': bool(hits and abs(hits[0][1][1]-floor) < .002)})
    for side in (-1, 1):
        route = config['stairs']['left' if side < 0 else 'right']
        cx, cz = route['center']['x'], route['center']['z']
        for radius in (.36, 1.98):
            # Samples intentionally avoid the balusters so an old thin iron
            # pipe cannot masquerade as a supported profiled timber handrail.
            for step in (3, 10, 19, 27, 36):
                t = step/40
                angle = route['startAngle']+side*math.tau*route['turns']*t
                x, z = cx+radius*math.cos(angle), cz+radius*math.sin(angle)
                y = floor*t+1.23
                hits = ray_hits(geometry, (x, y+.25, z), (0, -1, 0), .5)
                oak = [h for h in hits if h[2].startswith('Oak') and abs(h[1][1]-y) < .13]
                probes.append({'kind': 'wood-handrail', 'side': side, 'radius': radius,
                               't': t, 'passed': bool(oak)})
        for radius in (.36, 1.94):
            for step in (3, 10, 19, 27, 36):
                t = (step+.5)/40
                angle = route['startAngle']+side*math.tau*route['turns']*t
                x, z = cx+radius*math.cos(angle), cz+radius*math.sin(angle)
                y = floor*(step+1)/40+1.08
                tangent = (-math.sin(angle), 0, math.cos(angle))
                origin = (x-.15*tangent[0], y, z-.15*tangent[2])
                hits = ray_hits(geometry, origin, tangent, .3)
                probes.append({'kind': 'baluster-rail-joint', 'side': side,
                               'radius': radius, 'step': step,
                               'passed': any(h[2].startswith('Oak') for h in hits)})
        for z in (-15.3, -14.6, -14.0):
            # Crossing the former longitudinal guard connects each landing to
            # the extended center deck. Sweep a standing body's 0.3 radius.
            for dy in (.5, 1, 1.78):
                for dz in (-.3, 0, .3):
                    hits = ray_hits(geometry, (side*4.6, floor+dy, z+dz), (-side, 0, 0), 2.2)
                    probes.append({'kind': 'exit-crossing', 'side': side,
                                   'point': [side*4.6, floor+dy, z+dz], 'passed': not hits})
        # Stair approach remains clear of the new front-rail endpoint.
        for x in (side*4.3, side*4.6, side*4.9):
            for dy in (.5, 1, 1.78):
                hits = ray_hits(geometry, (x, floor+dy, -13.6), (0, 0, -1), 1.6)
                probes.append({'kind': 'tangent-exit', 'side': side, 'passed': not hits})
    return {'passed': all(p['passed'] for p in probes), 'samples': len(probes),
            'failures': [p for p in probes if not p['passed']],
            'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path)
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text())
    report = {'revision': config['revision'], 'current': measure(SOURCE, config)}
    if args.baseline:
        report['baseline'] = measure(args.baseline, config)
    report['passed'] = report['current']['passed'] and (not args.baseline or not report['baseline']['passed'])
    dest = ROOT/'docs/verification/reference-library-stair-crosswalk.json'
    dest.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
