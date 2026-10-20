#!/usr/bin/env python3
"""Check exported gallery rail surfaces do not run through giant pier interiors."""
import argparse
import hashlib
import json
from pathlib import Path
from verify_end_walls import Geometry

ROOT = Path(__file__).resolve().parents[2]

def measure(path):
    geometry = Geometry(path)
    # Shaft side faces lie at |x|=8.39/9.21 and z=bay +/- .41.
    # This inset volume excludes those real faces but catches the old handrails,
    # scrolls and independently spaced newels passing through the solid shaft.
    rows = []
    for side in (-1, 1):
        lo, hi = sorted((side*8.43, side*8.81))
        for z in (-10, -5, 0, 5, 10, 15):
            count = sum(1 for _, material in geometry.triangles(
                (lo, 8.40, z-.28), (hi, 8.96, z+.28))
                if material in ('Oak • rubbed midtone', 'Walnut • deep recess', 'Oak • edge highlight'))
            rows.append({'side': side, 'pierZ': z, 'interiorSurfaceTriangles': count, 'passed': count == 0})
    return {'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'probes': rows, 'passed': all(row['passed'] for row in rows)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = measure(args.source)
    if args.report:
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0 if result['passed'] else 1)
