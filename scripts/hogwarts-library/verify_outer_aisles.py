#!/usr/bin/env python3
# 对两侧上下层走廊测量净宽、人体包络、地面与屋顶连续性，并同时检查碰撞；尺寸判定来自实际几何。
# Measures clear width, body clearance and floor/roof continuity on both storeys and sides, also checking colliders; dimensional results come from actual geometry.
"""Blender-free verification of the r20 outer window aisles.

For each of the four aisles (left/right, lower/upper) this reads the actual
uncompressed GLB triangles and the scene colliders, then checks that:

* the window-side corridor is physically at least 3.0 m of net clear width,
* a 0.3 m-radius body up to 1.78 m eye height is unobstructed,
* the floor is continuous and at the expected height,
* the roof is continuous over the widened footprint (no exposed seams).

Pass/fail is derived from measured geometry, not from scene-config constants,
so the same script fails on the narrower r14 layout where the shelf ends sit
next to the old outer wall.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

from verify_end_walls import Geometry


REVISION = "20261020-lower-gallery-r27"
CENTER_ABS_X = 18.0
REQUIRED_NET_WIDTH = 3.0
RAY_MAX = 2.6
BODY_RADIUS = 0.3
EYE_Y = 1.78
Z_MIN, Z_MAX = -18.0, 18.0
BODY_HEIGHT_SAMPLES = (0.5, 1.0, 1.5)
FLOOR_TOLERANCE = 0.12
ROOF_LO_Y = 9.0
ROOF_HI_Y = 23.5
# Transverse vault bay boundaries where the 0.1 m seams used to show; the
# roof sweep probes each boundary plus +/-0.04/0.06 to catch a patched seam.
SEAM_Z = (-20.0, -15.0, -10.0, -5.0, 0.0, 5.0, 10.0, 15.0, 20.0)
SEAM_OFFSETS = (-0.06, -0.04, 0.0, 0.04, 0.06)


class AisleGeometry:
    """Cache only the two outer wings; repeated probes avoid decoding the full hall."""
    def __init__(self, source):
        records = []
        for side in (-1, 1):
            lo, hi = sorted((side * 13.4, side * 20.5))
            records.extend(source.triangles((lo, -0.1, -18.01), (hi, 23.5, 18.01)))
        self.points = np.asarray([r[0] for r in records], dtype=np.float64)
        self.materials = [r[1] for r in records]
        self.lo, self.hi = self.points.min(axis=1), self.points.max(axis=1)

    def triangles(self, lo, hi):
        selected = np.flatnonzero(np.all((self.hi >= lo) & (self.lo <= hi), axis=1))
        for index in selected:
            yield self.points[index], self.materials[index]


def ray_hits(geometry, origin, direction, t_max, pad=1e-3):
    """Return sorted (t, hit_point, material) along a segment via Mueller-Trumbore."""
    origin = np.asarray(origin, dtype=np.float64)
    direction = np.asarray(direction, dtype=np.float64)
    direction = direction / np.linalg.norm(direction)
    end = origin + direction * t_max
    lo = np.minimum(origin, end) - pad
    hi = np.maximum(origin, end) + pad
    hits = []
    for triangle, material in geometry.triangles(lo, hi):
        a = np.asarray(triangle[0], dtype=np.float64)
        b = np.asarray(triangle[1], dtype=np.float64)
        c = np.asarray(triangle[2], dtype=np.float64)
        edge1 = b - a
        edge2 = c - a
        p = np.cross(direction, edge2)
        determinant = np.dot(edge1, p)
        if abs(determinant) < 1e-12:
            continue
        inv = 1.0 / determinant
        s = origin - a
        u = inv * np.dot(s, p)
        if u < 0.0 or u > 1.0:
            continue
        q = np.cross(s, edge1)
        v = inv * np.dot(direction, q)
        if v < 0.0 or u + v > 1.0:
            continue
        t = inv * np.dot(edge2, q)
        if 1e-6 < t <= t_max:
            hits.append((float(t), tuple(origin + direction * t), material))
    hits.sort(key=lambda item: item[0])
    return hits


def first_hit(geometry, origin, direction, t_max):
    hits = ray_hits(geometry, origin, direction, t_max)
    return hits[0] if hits else None


def z_linspace(step):
    count = round((Z_MAX - Z_MIN) / step)
    return [round(Z_MIN + index * step, 6) for index in range(count + 1)]


def box_bounds(collider):
    shape = collider.get("shape")
    center = collider.get("center")
    if center is None:
        return None
    if shape == "box":
        size = collider.get("size")
        if not size:
            return None
        cx, cy, cz = center["x"], center["y"], center["z"]
        hx, hy, hz = size["x"] / 2, size["y"] / 2, size["z"] / 2
        return (cx - hx, cx + hx, cz - hz, cz + hz, cy - hy, cy + hy)
    if shape == "cylinder":
        radius = collider.get("radius")
        height = collider.get("height")
        if radius is None or height is None:
            return None
        cx, cy, cz = center["x"], center["y"], center["z"]
        return (cx - radius, cx + radius, cz - radius, cz + radius, cy - height / 2, cy + height / 2)
    return None


def is_floor_collider(collider_id, floor):
    if floor == "lower":
        return collider_id == "hall-floor"
    return collider_id.startswith("gallery-")


def floor_collider_covers(colliders, floor, x, z, floor_y):
    for collider in colliders:
        if not is_floor_collider(collider["id"], floor):
            continue
        bounds = box_bounds(collider)
        if bounds is None:
            continue
        x0, x1, z0, z1, y0, y1 = bounds
        if x0 <= x <= x1 and z0 <= z <= z1 and abs(y1 - floor_y) <= FLOOR_TOLERANCE:
            return collider["id"]
    return None


def body_collider_blockers(colliders, floor, side, z):
    center_x = side * CENTER_ABS_X
    floor_y = floor["floorY"]
    blockers = []
    for collider in colliders:
        if is_floor_collider(collider["id"], floor["name"]):
            continue
        bounds = box_bounds(collider)
        if bounds is None:
            continue
        x0, x1, z0, z1, y0, y1 = bounds
        if y1 <= floor_y + 0.03 or y0 >= floor_y + EYE_Y:
            continue
        if x0 - BODY_RADIUS < center_x < x1 + BODY_RADIUS and z0 - BODY_RADIUS < z < z1 + BODY_RADIUS:
            blockers.append(collider["id"])
    return blockers


def measure_width(geometry, side, floor_y, z):
    """Return (clearance_in, clearance_out, inner_x, outer_x) at body mid-height."""
    center_x = side * CENTER_ABS_X
    sample_y = floor_y + BODY_HEIGHT_SAMPLES[1]
    outward = first_hit(geometry, (center_x, sample_y, z), (side, 0.0, 0.0), RAY_MAX)
    inward = first_hit(geometry, (center_x, sample_y, z), (-side, 0.0, 0.0), RAY_MAX)
    clearance_in = inward[0] if inward else RAY_MAX
    clearance_out = outward[0] if outward else RAY_MAX
    inner_x = (center_x - side * clearance_in)
    outer_x = (center_x + side * clearance_out)
    return clearance_in, clearance_out, inner_x, outer_x


def verify(glb_path, config_path):
    geometry = AisleGeometry(Geometry(glb_path))
    config = json.loads(config_path.read_text())
    failures = []

    dimensions = config.get("dimensions", {})
    gallery_y = dimensions.get("galleryY")
    windows = config.get("windows", {})
    colliders = config.get("colliders", [])

    floors = (
        {"name": "lower", "floorY": 0.0},
        {"name": "upper", "floorY": gallery_y},
    )
    sides = (-1, 1)

    # Non-authoritative config sanity checks that fail fast when someone
    # regenerates the scene with the old width or missing the outer wall move.
    if config.get("revision") != REVISION:
        failures.append(f"revision expected {REVISION}: {config.get('revision')}")
    if dimensions.get("width") != 40.0:
        failures.append(f"dimensions.width expected 40.0: {dimensions.get('width')}")
    if dimensions.get("outerWallX") != 20.0:
        failures.append(f"dimensions.outerWallX expected 20.0: {dimensions.get('outerWallX')}")
    if abs(float(windows.get("glassX", 0.0)) - 20.02) > 0.05:
        failures.append(f"windows.glassX expected 20.02: {windows.get('glassX')}")
    if abs(float(windows.get("leadX", 0.0)) - 19.99) > 0.05:
        failures.append(f"windows.leadX expected 19.99: {windows.get('leadX')}")

    floor_zs = z_linspace(0.5)
    width_zs = z_linspace(1.0)
    roof_zs = sorted(set(z_linspace(1.0)))
    for seam in SEAM_Z:
        for offset in SEAM_OFFSETS:
            value = round(seam + offset, 6)
            if Z_MIN <= value <= Z_MAX:
                roof_zs.append(value)
    roof_zs = sorted(set(roof_zs))

    aisles = {}
    for floor in floors:
        aisles[floor["name"]] = {}
        for side in sides:
            key = "left" if side < 0 else "right"
            center_x = side * CENTER_ABS_X
            floor_y = floor["floorY"]

            floor_gaps = []
            for z in floor_zs:
                for x in (center_x - BODY_RADIUS, center_x, center_x + BODY_RADIUS):
                    cover = floor_collider_covers(colliders, floor["name"], x, z, floor_y)
                    hit = first_hit(geometry, (x, floor_y + 0.6, z), (0.0, -1.0, 0.0), 1.2)
                    surface_y = hit[1][1] if hit else None
                    if cover is None or surface_y is None or abs(surface_y - floor_y) > FLOOR_TOLERANCE:
                        floor_gaps.append({"x": x, "z": z, "collider": cover, "meshY": surface_y})

            # A conservative continuous-volume query catches geometry between
            # sample heights/stations, including thin ledges and shelf ends.
            # This proves a 3 m physical band over the entire standing height;
            # the camera's radius-.3 footprint also lies wholly in this band.
            band_lo, band_hi = sorted((side * (CENTER_ABS_X - REQUIRED_NET_WIDTH / 2),
                                       side * (CENTER_ABS_X + REQUIRED_NET_WIDTH / 2)))
            body_mesh = list(geometry.triangles(
                (band_lo, floor_y + 0.04, Z_MIN),
                (band_hi, floor_y + EYE_Y, Z_MAX),
            ))
            if body_mesh:
                failures.append(f"{key} {floor['name']} continuous body band intersects {len(body_mesh)} triangles")

            net_widths = []
            clearance_ins = []
            clearance_outs = []
            width_violations = []
            for z in width_zs:
                clearance_in, clearance_out, inner_x, outer_x = measure_width(
                    geometry, side, floor_y, z
                )
                net = clearance_in + clearance_out
                net_widths.append(net)
                clearance_ins.append(clearance_in)
                clearance_outs.append(clearance_out)
                if net < REQUIRED_NET_WIDTH or clearance_in < BODY_RADIUS or clearance_out < BODY_RADIUS:
                    width_violations.append(
                        {"z": z, "innerX": inner_x, "outerX": outer_x,
                         "clearanceIn": clearance_in, "clearanceOut": clearance_out, "net": net}
                    )

            collider_blockers = []
            for z in width_zs:
                blockers = body_collider_blockers(colliders, floor, side, z)
                for blocker in blockers:
                    collider_blockers.append({"z": z, "collider": blocker})

            roof_gaps = []
            if floor["name"] == "upper":
                for x_abs in (17.7, 18.0, 18.3):
                    x = side * x_abs
                    for z in roof_zs:
                        hit = first_hit(geometry, (x, ROOF_LO_Y, z), (0.0, 1.0, 0.0), ROOF_HI_Y - ROOF_LO_Y)
                        if hit is None or hit[1][1] > ROOF_HI_Y:
                            roof_gaps.append({"x": x, "z": z})

            min_net = min(net_widths) if net_widths else 0.0
            min_in = min(clearance_ins) if clearance_ins else 0.0
            min_out = min(clearance_outs) if clearance_outs else 0.0

            aisle = {
                "floorY": floor_y,
                "centerAbsX": CENTER_ABS_X,
                "floorSamples": len(floor_zs) * 3,
                "bodyClearBand": {"xMin": band_lo, "xMax": band_hi, "physicalWidth": REQUIRED_NET_WIDTH, "continuousZRange": [Z_MIN, Z_MAX]},
                "bodyMeshBlockers": len(body_mesh),
                "floorGaps": floor_gaps,
                "minNetWidth": round(min_net, 4),
                "minClearanceIn": round(min_in, 4),
                "minClearanceOut": round(min_out, 4),
                "widthViolations": width_violations,
                "colliderBlockers": collider_blockers,
            }
            if floor["name"] == "upper":
                aisle["roofSamples"] = len(roof_zs) * 3
                aisle["roofGaps"] = roof_gaps
                if roof_gaps:
                    failures.append(f"{key} upper roof gaps: {len(roof_gaps)}")

            if floor_gaps:
                failures.append(f"{key} {floor['name']} floor gaps: {len(floor_gaps)}")
            if width_violations:
                failures.append(f"{key} {floor['name']} width violations: {min_net:.3f}")
            if collider_blockers:
                failures.append(f"{key} {floor['name']} collider blockers: {len(collider_blockers)}")

            aisles[floor["name"]][key] = aisle

    return {
        "geometry": str(glb_path),
        "config": str(config_path),
        "revision": config.get("revision"),
        "parameters": {
            "centerAbsX": CENTER_ABS_X,
            "requiredNetWidth": REQUIRED_NET_WIDTH,
            "rayMax": RAY_MAX,
            "bodyRadius": BODY_RADIUS,
            "eyeY": EYE_Y,
            "zRange": [Z_MIN, Z_MAX],
        },
        "aisles": aisles,
        "passed": not failures,
        "failures": failures,
    }


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "glb",
        nargs="?",
        default=str(root / "scripts/hogwarts-library/deliverables/architecture-uncompressed.glb"),
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
    report_path = root / "docs/verification/reference-library-outer-aisles.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps(report, indent=2))
    if not report["passed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
