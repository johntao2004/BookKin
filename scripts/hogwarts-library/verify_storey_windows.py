#!/usr/bin/env python3
# 检查双侧两层共 24 个真实窗洞及对应面光源；可用旧模型证明新增六窗，而非只核对配置数量。
# Checks 24 physical openings across both sides/storeys and their area lights, optionally proving six new openings against a baseline rather than only counting configuration entries.
"""Measure mirrored window apertures on both floors, including a negative control."""
import argparse
import hashlib
import json
from pathlib import Path

from verify_end_walls import Geometry
from verify_outer_aisles import AisleGeometry, ray_hits

ROOT = Path(__file__).resolve().parents[2]
Z_CENTERS = (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5)
GLASS = {'Glass • pale window', 'Glass • cool window pane', 'Glass • warm window pane'}


def measure(source, config):
    cache = AisleGeometry(Geometry(source))
    records = []
    for storey in config['windows']['storeys']:
        bottom, spring = storey['bottomY'], storey['springY']
        ys = [bottom + .35, bottom + (spring-bottom)*.32,
              bottom + (spring-bottom)*.64, spring-.35]
        for side in storey['sides']:
            for z in Z_CENTERS:
                rays = []
                for y in ys:
                    for offset in (-.90, -.48, .48, .90):
                        hits = ray_hits(cache, (side*19.53, y, z+offset), (side, 0, 0), .8)
                        first = hits[0] if hits else None
                        rays.append({'y': y, 'z': z+offset, 'material': first[2] if first else None,
                                     'glassFirst': bool(first and first[2] in GLASS)})
                glass = sum(r['glassFirst'] for r in rays)
                # Pane-interior probes are intentionally clear of tracery. The
                # pointed head must also stay sealed across the whole width.
                head_hits = [ray_hits(cache, (side*19.53, storey['crownY']-.18, z+offset), (side, 0, 0), .8)
                             for offset in (-1.3, -1.0, -.5, 0, .5, 1.0, 1.3)]
                sealed = all(hits and hits[0][2] in GLASS | {'Stone • warm ashlar', 'Iron • blue black'} for hits in head_hits)
                records.append({'storey': storey['id'], 'side': side, 'z': z,
                                'glassFirstRays': glass, 'totalRays': len(rays),
                                'passed': glass == len(rays) and sealed, 'headSealed': sealed, 'rays': rays})
    return {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'windowCount': len(records), 'windows': records,
            'passed': len(records) == 24 and all(r['passed'] for r in records)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb')
    parser.add_argument('--config', type=Path, default=ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json')
    parser.add_argument('--baseline', type=Path)
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    assert config['windows']['count'] == 24
    assert [(s['id'], s['sides']) for s in config['windows']['storeys']] == [('lower', [-1, 1]), ('upper', [-1, 1])]
    actual = measure(args.source, config)
    # Every emitter must sit in the actual opening's straight-sided portion.
    areas = config['lighting']['areas']
    lights = []
    for storey in config['windows']['storeys']:
        y = (storey['bottomY'] + storey['springY']) / 2
        for side in storey['sides']:
            for z in Z_CENTERS:
                candidates = [a for a in areas if all(abs(v-w) < 1e-6 for v, w in zip(a['position'], (side*(config['windows']['glassX']-.24), y, z)))]
                passed = len(candidates) == 1
                if passed:
                    a = candidates[0]
                    passed = (a['target'] == [0, y, z] and a['intensity'] > 0
                              and abs(a['width'] - 2.5) < 1e-6
                              and abs(a['height'] - (storey['springY']-storey['bottomY'])) < 1e-6)
                lights.append({'storey': storey['id'], 'side': side, 'z': z, 'passed': passed})
    report = {'revision': config['revision'], 'configSha256': hashlib.sha256(args.config.read_bytes()).hexdigest(),
              'contract': 'six physical apertures per side on each floor, mirrored left and right; glass-first rays reject painted windows and glass hidden behind opaque walls',
              'current': actual, 'windowLightBindings': lights,
              'passed': actual['passed'] and len(areas) == 24 and all(r['passed'] for r in lights)}
    if args.baseline:
        baseline = measure(args.baseline, config)
        lower = [r for r in baseline['windows'] if r['storey'] == 'lower' and r['side'] == 1]
        upper = [r for r in baseline['windows'] if r['storey'] == 'upper' or r['side'] == -1]
        negative = all(not r['passed'] for r in lower) and all(r['passed'] for r in upper)
        report.update(baseline=baseline, negativeControlProvesSixNewOpenings=negative)
        report['passed'] = report['passed'] and negative
    target = ROOT/'docs/verification/reference-library-storey-windows.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'passed': report['passed'], 'windows': actual['windowCount'],
                      'failed': [(r['storey'], r['side'], r['z'], r['glassFirstRays']) for r in actual['windows'] if not r['passed']],
                      'negativeControl': report.get('negativeControlProvesSixNewOpenings')}))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
