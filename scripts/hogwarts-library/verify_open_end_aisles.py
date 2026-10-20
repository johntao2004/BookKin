#!/usr/bin/env python3
"""Check actual exported end-screen removal and retained paintings/structure."""
import argparse
import hashlib
import json
from pathlib import Path

from verify_end_walls import Geometry
from verify_end_arcade import verify as verify_artwork

ROOT = Path(__file__).resolve().parents[2]
RETIRED = ('end-a-ground-pier-', 'end-a-arcade-head-',
           'end-b-balcony-pier-', 'balcony-support-head-')


def screen_triangles(source):
    geometry = Geometry(source)
    # Both screens stand ahead of the preserved rear walls. Stay below the
    # retained balcony beam/floors, and outside the globe, tables and stairs.
    boxes = {'A': ((-8.55, .15, -18.05), (8.55, 6.87, -16.95)),
             'B': ((-2.85, .15, 15.30), (2.85, 6.38, 16.12))}
    counts = {}
    for end, (lo, hi) in boxes.items():
        counts[end] = sum(1 for _triangle, material in geometry.triangles(lo, hi)
                          if material.startswith(('Oak •', 'Walnut •')))
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb')
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--report', type=Path, default=ROOT/'docs/verification/reference-library-open-end-aisles.json')
    args = parser.parse_args()
    config_path = ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json'
    config = json.loads(config_path.read_text())
    current, baseline = screen_triangles(args.source), screen_triangles(args.baseline)
    failures = []
    for end, count in current.items():
        if count:
            failures.append(f'{end}: {count} timber triangles in retired screen')
        if baseline[end] == 0:
            failures.append(f'{end}: baseline did not demonstrate the old screen')
    stale = [c['id'] for c in config['colliders'] if c['id'].startswith(RETIRED)]
    if stale:
        failures.append(f'retired colliders remain: {stale}')
    required = {'end-a-wall', 'end-b-wall', 'balcony-floor',
                *(f'end-a-lower-picture-{x}' for x in (-6.4, -3.2, 0, 3.2, 6.4)),
                'end-b-lower-panel--5.5', 'end-b-lower-panel-5.5'}
    missing = required - {c['id'] for c in config['colliders']}
    if missing:
        failures.append(f'preserved collision shells missing: {sorted(missing)}')
    artwork = verify_artwork(args.source, config_path, check_revision=False)
    # The earlier verifier also expects the intentionally retired arch heads.
    # Preserve its independent front/oblique artwork and open-ground probes.
    visible = artwork['visibility'] + artwork['openGroundApertures']
    if not all(p['passed'] for p in visible):
        failures.append('rear artwork visibility or open-ground probes failed')
    report = {'revision': config['revision'], 'passed': not failures, 'failures': failures,
              'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
              'baselineSha256': hashlib.sha256(args.baseline.read_bytes()).hexdigest(),
              'retiredScreenTimberTriangles': current, 'baselineTimberTriangles': baseline,
              'retiredColliders': stale, 'artworkAndGroundProbes': len(visible),
              'scope': 'Exported geometry and collision descriptors; browser checked separately.'}
    args.report.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
