#!/usr/bin/env python3
# 用区域缓存和射线核对端墙封闭、侧拱冠与主侧拱连接；历史 r16 尺寸契约需匹配所测模型。
# Uses regional caches and rays to check end-wall enclosure, side-arch crowns and vault junctions; the historical r16 dimensional contract must match the inspected model.
"""Blender-free verification of the r16 roof enclosure at both hall ends.

The r15 build left the two end bays (|z| in 15..20) with a low flat slab over the exhibition galleries, black gaps in the
outer-wall end bays, and no shell bridging the main vault arch (x8.8, y16.56) into
the side arch (x8.95, springY 14.58). This script casts rays against the
uncompressed GLB and checks, from measured geometry only:

1. Outer-wall black gaps: outward rays from the aisle centre at
   z in {±16.4, ±17.5, ±19.1}, y in {9.4, 12, 15} must hit Stone at
   outerWallX ± 0.3 (the new full-height wall for z 15..20 / -20..-15).
2. End arch crowns: upward rays at x in {±9.3, ±12, ±16.1} and
   z = end*17.5 + {-2, -1, 0, 1, 2} must hit the curved arch at
   y = 14.58 + 2.94*sqrt(1 - ((z - end*17.5)/2.5)^2) ± 0.08. Only the
   first BLUE vault material hit ('Paint • blue gray vault') counts, so
   art frames and bookcase cornices below the crown are ignored; a
   leftover flat slab at y=14.58 carries that same material and fails.
3. Main-to-side arch joint shells: upward rays near x 8.80..8.96 along the
   full z length (bay bounds plus seam offsets) must be covered by a shell
   whose first hit lands within y 14..18.

Only the triangles inside the probed bands are cached, so the hall is
scanned once instead of per ray.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np

from verify_end_walls import Geometry
from verify_outer_aisles import ray_hits, first_hit

REVISION = "20261020-lower-gallery-r27"

OUTER_WALL_DEFAULT_X = 20.0
GAP_Z = (16.4, 17.5, 19.1)
GAP_Y = (9.4, 12.0, 15.0)

ARCH_SPRING_Y = 14.58
ARCH_RISE = 2.94
ARCH_RADIUS = 2.5
ARCH_CENTER_Z = 17.5
ARCH_X = (9.3, 12.0, 18.1)
ARCH_DZ = (-2.0, -1.0, 0.0, 1.0, 2.0)
ARCH_TOLERANCE = 0.08

JOINT_X = (8.80, 8.88, 8.96)
JOINT_BAY_Z = (-20.0, -15.0, -10.0, -5.0, 0.0, 5.0, 10.0, 15.0, 20.0)
JOINT_SEAM_OFFSETS = (-0.06, 0.0, 0.06)
JOINT_HIT_RANGE = (14.0, 18.0)
JOINT_RAY_START_Y = 13.0
JOINT_RAY_T_MAX = 6.0


class EnclosureGeometry:
    """Cache triangles in the three probed bands; rays never rescan the GLB."""

    BOXES = []
    for _side in (-1, 1):
        _wall_x = sorted((_side * 15.0, _side * 20.6))
        _arch_x = sorted((_side * 8.8, _side * 20.0))
        _joint_x = sorted((_side * 8.5, _side * 9.3))
        for _end in (-1, 1):
            _gap_z = sorted((_end * 15.5, _end * 20.0))
            BOXES.append(((_wall_x[0], 8.5, _gap_z[0]), (_wall_x[1], 16.0, _gap_z[1])))
            _arch_z = sorted((_end * 14.9, _end * 20.1))
            BOXES.append(((_arch_x[0], 13.0, _arch_z[0]), (_arch_x[1], 18.0, _arch_z[1])))
        BOXES.append(((_joint_x[0], 12.5, -20.4), (_joint_x[1], 18.6, 20.4)))

    def __init__(self, source):
        records = []
        for lo, hi in self.BOXES:
            records.extend(source.triangles(lo, hi))
        self.points = np.asarray([r[0] for r in records], dtype=np.float64)
        self.materials = [r[1] for r in records]
        self.lo = self.points.min(axis=1)
        self.hi = self.points.max(axis=1)

    def triangles(self, lo, hi):
        selected = np.flatnonzero(np.all((self.hi >= lo) & (self.lo <= hi), axis=1))
        for index in selected:
            yield self.points[index], self.materials[index]


def expected_crown_y(z):
    ratio = (abs(z) - ARCH_CENTER_Z) / ARCH_RADIUS
    return ARCH_SPRING_Y + ARCH_RISE * math.sqrt(max(0.0, 1.0 - ratio * ratio))


def verify(glb_path, config_path):
    geometry = EnclosureGeometry(Geometry(glb_path))
    config = json.loads(config_path.read_text())
    failures = []
    probes = {"outerWallGaps": {}, "endArchCrown": {}, "archJointShell": {}}

    if config.get("revision") != REVISION:
        failures.append(f"revision expected {REVISION}: {config.get('revision')}")
    outer_wall_x = config.get("dimensions", {}).get("outerWallX")
    if not isinstance(outer_wall_x, (int, float)):
        failures.append(f"dimensions.outerWallX missing: {outer_wall_x}")
        outer_wall_x = OUTER_WALL_DEFAULT_X

    # 1. Full-height outer wall over both end bays.
    for side in (-1, 1):
        key = "left" if side < 0 else "right"
        rays = []
        for end in (-1, 1):
            for z_abs in GAP_Z:
                for y in GAP_Y:
                    origin = (side * 18.1, y, end * z_abs)
                    hit = first_hit(geometry, origin, (side, 0.0, 0.0), 4.0)
                    record = None
                    if hit is not None:
                        record = {"x": round(hit[1][0], 4), "material": hit[2]}
                    rays.append({"z": origin[2], "y": y, "hit": record})
                    if (
                        hit is None
                        or not hit[2].startswith("Stone")
                        or abs(abs(hit[1][0]) - outer_wall_x) > 0.3
                    ):
                        failures.append(
                            f"outer wall gap {key} z={origin[2]} y={y}: {record}"
                        )
        probes["outerWallGaps"][key] = rays

    # 2. Curved end arch crowns replace the deleted flat slabs.
    for side in (-1, 1):
        for x_abs in ARCH_X:
            for end in (-1, 1):
                for dz in ARCH_DZ:
                    z = end * ARCH_CENTER_Z + dz
                    expected = expected_crown_y(z)
                    origin = (side * x_abs, 9.5, z)
                    hits = ray_hits(geometry, origin, (0.0, 1.0, 0.0), 10.0)
                    vault_hits = [
                        hit for hit in hits if hit[2] == "Paint • blue gray vault"
                    ]
                    first_vault = vault_hits[0] if vault_hits else None
                    measured = round(first_vault[1][1], 4) if first_vault else None
                    probes["endArchCrown"][f"{side * x_abs}/{z}"] = {
                        "expectedY": round(expected, 4),
                        "measuredY": measured,
                    }
                    if (
                        first_vault is None
                        or abs(first_vault[1][1] - expected) > ARCH_TOLERANCE
                    ):
                        failures.append(
                            f"end arch crown x={side * x_abs} z={z}: "
                            f"expected y={expected:.4f}, vault hit={measured}"
                        )

    # 3. Joint shells between the main arch and the side arches.
    joint_zs = sorted(
        {
            round(bay + offset, 6)
            for bay in JOINT_BAY_Z
            for offset in JOINT_SEAM_OFFSETS
            if -20.0 <= bay + offset <= 20.0
        }
    )
    for side in (-1, 1):
        for x_abs in JOINT_X:
            gaps = []
            for z in joint_zs:
                origin = (side * x_abs, JOINT_RAY_START_Y, z)
                hit = first_hit(
                    geometry, origin, (0.0, 1.0, 0.0), JOINT_RAY_T_MAX
                )
                if hit is None or not (
                    JOINT_HIT_RANGE[0] <= hit[1][1] <= JOINT_HIT_RANGE[1]
                ):
                    gaps.append(
                        {
                            "z": z,
                            "hitY": round(hit[1][1], 4) if hit else None,
                            "material": hit[2] if hit else None,
                        }
                    )
            probes["archJointShell"][f"{side * x_abs}"] = {
                "zSamples": len(joint_zs),
                "gaps": gaps,
            }
            if gaps:
                failures.append(
                    f"arch joint shell x={side * x_abs}: {len(gaps)}/{len(joint_zs)} rays uncovered or outside y14..18"
                )

    return {
        "geometry": str(glb_path),
        "config": str(config_path),
        "revision": config.get("revision"),
        "parameters": {
            "outerWallX": outer_wall_x,
            "gapZ": GAP_Z,
            "gapY": GAP_Y,
            "archSpringY": ARCH_SPRING_Y,
            "archRise": ARCH_RISE,
            "archRadius": ARCH_RADIUS,
            "archCenterZ": ARCH_CENTER_Z,
            "archX": ARCH_X,
            "archDZ": ARCH_DZ,
            "archTolerance": ARCH_TOLERANCE,
            "jointX": JOINT_X,
            "jointHitRangeY": JOINT_HIT_RANGE,
        },
        "probes": probes,
        "passed": not failures,
        "failures": failures,
    }


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "glb",
        nargs="?",
        default=str(
            root / "scripts/hogwarts-library/deliverables/architecture-uncompressed.glb"
        ),
    )
    parser.add_argument(
        "--config",
        default=str(root / "apps/web/public/assets/hogwarts-library/scene-config.json"),
    )
    args = parser.parse_args()
    glb_path = Path(args.glb).resolve()
    config_path = Path(args.config).resolve()
    report = verify(glb_path, config_path)
    report["sourceSha256"] = hashlib.sha256(glb_path.read_bytes()).hexdigest()
    report["configSha256"] = hashlib.sha256(config_path.read_bytes()).hexdigest()
    report["revision"] = json.loads(config_path.read_text())["revision"]
    report_path = root / "docs/verification/reference-library-roof-enclosure.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps(report, indent=2))
    if not report["passed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
