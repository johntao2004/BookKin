#!/usr/bin/env python3
# 比较旧新 GLB 的局部三角面签名，要求上层屏风消失而平台、后墙和楼梯保持一致。
# Compares regional triangle signatures across old/new GLBs, requiring the upper screen to disappear while balcony, rear wall and stairs remain identical.
"""Compare exported balcony-screen clearance with an actual pre-change GLB."""
import argparse
import hashlib
import json
from pathlib import Path
from verify_end_walls import Geometry

ROOT = Path(__file__).resolve().parents[2]

def signature(geometry, lo, hi):
    triangles = sorted(geometry.triangles(lo, hi))
    return {'triangles': len(triangles), 'sha256': hashlib.sha256(repr(triangles).encode()).hexdigest()}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, required=True)
    args = parser.parse_args()
    old = Geometry(args.baseline)
    new = Geometry(ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb')
    bounds = ((-12.6, 8.1, 18.3), (12.6, 14.1, 19.5))
    before, after = signature(old, *bounds), signature(new, *bounds)
    assert before['triangles'] > 0, 'Baseline must contain the retired upper screen'
    assert after['triangles'] == 0, after
    retained = {}
    for name, lo, hi in [
        ('balcony', (-4, 6.5, 13.3), (4, 9.2, 16.1)),
        ('rear-wall', (-12.6, 8.1, 20.0), (12.6, 14.1, 20.4)),
        ('paired-stairs', (-9, 0.1, -18), (9, 9.2, -8)),
    ]:
        previous, current = signature(old, lo, hi), signature(new, lo, hi)
        assert current['triangles'] > 0 and current == previous, (name, previous, current)
        retained[name] = current
    config = json.loads((ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json').read_text())
    assert not any(c['id'].startswith('end-b-upper-pier-') for c in config['colliders'])
    report = {'revision': config['revision'], 'removedScreen': {'before': before, 'after': after}, 'retained': retained, 'passed': True}
    target = ROOT/'docs/verification/reference-library-upper-balcony-clearance.json'
    target.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
