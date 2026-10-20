#!/usr/bin/env python3
# 测量 A 端画框可见性、拱支撑与开口，并在提供旧模型时验证负对照；测量范围限于约定探针。
# Measures A-end frame visibility, arch support and openings, with a negative control when a baseline is supplied; coverage is limited to the defined probes.
"""Measure exported A-end frame visibility, supported arches and clear openings."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import sys
import numpy as np
from verify_end_walls import Geometry
from verify_outer_aisles import first_hit

REVISION = '20261020-lower-gallery-r27'
ROOT = Path(__file__).resolve().parents[2]
OAK = 'Oak • rubbed midtone'
PICTURE_MATERIALS = {'Canvas • lower gallery paintings', 'Canvas • lower portrait study'}
FRAME_MATERIALS = {OAK, 'Brass • aged edge'}


class EndGeometry:
    def __init__(self, path):
        records = list(Geometry(path).triangles((-8.5, 0, -20.1), (8.5, 7, -16.7)))
        self.points = np.asarray([r[0] for r in records], dtype=np.float64)
        self.materials = [r[1] for r in records]
        self.lo = self.points.min(axis=1)
        self.hi = self.points.max(axis=1)

    def triangles(self, lo, hi):
        indices = np.flatnonzero(np.all((self.hi >= lo) & (self.lo <= hi), axis=1))
        for i in indices:
            yield self.points[i], self.materials[i]


def verify(source, config_path, check_revision=True):
    geometry = EndGeometry(source)
    config = json.loads(config_path.read_text())
    failures, visibility, supports, openings = [], [], [], []
    if check_revision and config.get('revision') != REVISION:
        failures.append('revision mismatch')
    # Trace the complete inset canvas and actual bar centers through each
    # arcade opening. New material identity distinguishes images from the
    # old door and flat silhouette surfaces, independently of metadata.
    for x in (-6.4, -3.2, 0, 3.2, 6.4):
        h = 3.75 if x == 0 else 2.0
        expected = 'Canvas • lower portrait study' if x == 0 else 'Canvas • lower gallery paintings'
        interior = [(float(u), float(v), 'canvas')
                    for u in np.linspace(-.55, .55, 5)
                    for v in np.linspace(-h/2+.20, h/2-.20, 7)]
        perimeter = [(u, v, 'frame') for u in (-.5, 0, .5)
                     for v in (-(h+.10)/2, (h+.10)/2)]
        perimeter += [(u, v, 'frame') for u in (-.80, .80)
                      for v in (-h*.35, 0, h*.35)]
        for degrees in (-12, 0, 12):
            angle = math.radians(degrees)
            for u, v, kind in interior + perimeter:
                target_x, y = x + u, 2.76 + v
                target_z = -19.525 if kind == 'canvas' else -19.56
                start = (target_x - abs(target_z+14.0)*math.tan(angle), y, -14.0)
                hit = first_hit(geometry, start, (math.sin(angle), 0, -math.cos(angle)), 6.3)
                valid = hit is not None and -19.70 <= hit[1][2] <= -19.50
                valid = valid and (hit[2] == expected if kind == 'canvas' else hit[2] in FRAME_MATERIALS)
                visibility.append({'bayX': x, 'angle': degrees, 'offset': [u, v], 'kind': kind,
                                   'hitZ': float(hit[1][2]) if hit else None,
                                   'material': hit[2] if hit else None, 'passed': bool(valid)})
                if not valid:
                    failures.append(f'{kind} obstructed/missing: x={x} angle={degrees} offset={u}/{v}, hit={hit}')
    for x in (-6.4, -3.2, 0, 3.2, 6.4):
        for u in (-1.5, -.8, 0, .8, 1.5):
            for y in (6.60, 6.86, 6.884):
                hit = first_hit(geometry, (x + u, y, -16.8), (0, 0, -1), 1.7)
                valid = hit is not None and hit[2] == OAK and abs(hit[1][2] + 17.46) < .01
                supports.append({'bayX': x, 'offset': u, 'y': y, 'passed': bool(valid)})
                if not valid:
                    failures.append(f'unsupported spandrel: {x}/{u}/{y}: {hit}')
        for u in (-.8, 0, .8):
            for y in (1.78, 3.5):
                hit = first_hit(geometry, (x + u, y, -16.8), (0, 0, -1), 1.7)
                openings.append({'bayX': x, 'offset': u, 'y': y, 'passed': hit is None})
                if hit is not None:
                    failures.append(f'filled ground aperture: {x}/{u}/{y}: {hit}')
    # Door material absence is read from exported bounded triangles, not
    # inferred from its missing collider or a changed revision string.
    old_door_triangles = sum(material == 'Paint • end recess' for material in geometry.materials)
    if old_door_triangles:
        failures.append(f'old door/silhouette material remains: {old_door_triangles} triangles')
    if check_revision:
        expected = {'count': 5, 'centersX': [-6.4, -3.2, 0, 3.2, 6.4], 'centerY': 2.76,
                    'canvasWidth': 1.5, 'sideCanvasHeight': 2.0, 'centerCanvasHeight': 3.75,
                    'frontZ': -19.525, 'textured': True, 'removedDoor': True}
        actual = config.get('endAArcade', {}).get('lowerPictures', {})
        for key, value in expected.items():
            if actual.get(key) != value:
                failures.append(f'lower artwork contract {key}: {actual.get(key)}')
        colliders = [c for c in config['colliders'] if c['id'].startswith('end-a-lower-picture-')]
        if len(colliders) != 5 or any(c['id'] == 'end-a-door-trim' for c in config['colliders']):
            failures.append('expected five picture shells and no former door trim shell')
        if 'doorWidthScale' in config.get('endAArcade', {}):
            failures.append('obsolete door width contract remains')
    return {'revision': config.get('revision'), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'configSha256': hashlib.sha256(config_path.read_bytes()).hexdigest(),
            'parameters': {'viewAngles': [-12, 0, 12], 'frameCenters': [-6.4, -3.2, 0, 3.2, 6.4],
                           'canvasGrid': [5,7], 'galleryUndersideY': 6.888},
            'visibility': visibility, 'spandrelSupports': supports, 'openGroundApertures': openings,
            'oldDoorMaterialTriangleCount': old_door_triangles, 'failures': failures, 'passed': not failures,
            'scope': 'Exported geometry visibility at the tested angles, not arbitrary-angle or browser/GPU acceptance.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb', nargs='?', type=Path, default=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb')
    parser.add_argument('--config', type=Path, default=ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json')
    parser.add_argument('--report', type=Path, default=ROOT/'docs/verification/reference-library-end-arcade.json')
    parser.add_argument('--before-source', type=Path, default=ROOT/'.artifacts/model-clearance/lower-gallery-before-r27.glb')
    parser.add_argument('--before-config', type=Path, default=ROOT/'.artifacts/model-clearance/lower-gallery-before-r27.json')
    args = parser.parse_args()
    report = verify(args.glb, args.config)
    before = verify(args.before_source, args.before_config, check_revision=False)
    negative_proven = (any(not v['passed'] for v in before['visibility'] if v['kind']=='canvas')
                       and before['oldDoorMaterialTriangleCount'] > 0)
    report['negativeControl'] = before
    report['negativeControlGeometryRejected'] = negative_proven
    report['passed'] = report['passed'] and negative_proven
    args.report.write_text(json.dumps(report, indent=2))
    print(json.dumps({'passed': report['passed'], 'visibilityProbes': len(report['visibility']),
                      'spandrelProbes': len(report['spandrelSupports']), 'openingProbes': len(report['openGroundApertures']),
                      'removedDoorMaterialTriangles': report['oldDoorMaterialTriangleCount'],
                      'negativeControlProven': negative_proven, 'failures': report['failures'][:12]}))
    sys.exit(0 if report['passed'] else 1)
