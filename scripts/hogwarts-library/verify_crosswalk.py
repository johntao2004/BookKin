#!/usr/bin/env python3
# 结合导出三角面与配置检查横向通道的地面连通、净宽和端部阻挡；数值契约针对本文件约定的布局。
# Checks crosswalk floor connectivity, clear width and end obstructions from exported triangles and configuration under this file’s layout-specific contract.
"""Blender-free r6 crosswalk, end-clearance and side-gallery regression."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from collections import deque
from pathlib import Path

from verify_end_walls import Geometry, front_hit


REVISION = "20261020-lower-gallery-r27"
INNER_Z = 15.6
OUTER_Z = 20.0
REQUIRED_NET_WIDTH = 2.0
BODY_RADIUS = 0.3
HUMAN_EYE_Y = 1.78
CENTRAL_X_MIN = -10.1
CENTRAL_X_MAX = 10.1


def point_height(triangles, x, z, expected_y, tolerance=0.012):
    heights = []
    for triangle, _material in triangles:
        ax, ay, az = triangle[0]
        bx, by, bz = triangle[1]
        cx, cy, cz = triangle[2]
        denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
        if abs(denominator) < 1e-12:
            continue
        u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator
        v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator
        if u < -1e-8 or v < -1e-8 or u + v > 1 + 1e-8:
            continue
        height = ay + u * (by - ay) + v * (cy - ay)
        if abs(height - expected_y) <= tolerance:
            heights.append(height)
    return min(heights, key=lambda value: abs(value - expected_y)) if heights else None


def rect(collider):
    if collider["shape"] not in ("box", "cylinder"):
        return None
    center, y = collider["center"], collider["center"]["y"]
    if collider["shape"] == "cylinder":
        radius = collider["radius"]
        return (
            center["x"] - radius,
            center["x"] + radius,
            center["z"] - radius,
            center["z"] + radius,
            y - collider["height"] / 2,
            y + collider["height"] / 2,
        )
    size = collider["size"]
    angle = collider.get("rotationY", 0.0)
    x_extent = abs(math.cos(angle)) * size["x"] / 2 + abs(math.sin(angle)) * size["z"] / 2
    z_extent = abs(math.sin(angle)) * size["x"] / 2 + abs(math.cos(angle)) * size["z"] / 2
    return (
        center["x"] - x_extent,
        center["x"] + x_extent,
        center["z"] - z_extent,
        center["z"] + z_extent,
        y - size["y"] / 2,
        y + size["y"] / 2,
    )


def crosswalk_blockers(config, gallery_y):
    blockers = []
    for collider in config["colliders"]:
        bounds = rect(collider)
        if bounds is None:
            continue
        x0, x1, z0, z1, y0, y1 = bounds
        if y1 <= gallery_y + 0.03 or y0 >= gallery_y + HUMAN_EYE_Y:
            continue
        blockers.append((collider["id"], x0, x1, z0, z1))
    return blockers


def free_intervals(x, z0, z1, blockers, pad=0.0):
    blocked = []
    for _name, x0, x1, bz0, bz1 in blockers:
        if x0 - pad <= x <= x1 + pad:
            lo, hi = max(z0, bz0 - pad), min(z1, bz1 + pad)
            if lo < hi:
                blocked.append((lo, hi))
    free, cursor = [], z0
    for lo, hi in sorted(blocked):
        if lo > cursor:
            free.append((cursor, lo))
        cursor = max(cursor, hi)
    if cursor < z1:
        free.append((cursor, z1))
    return free


def point_blocked(x, z, blockers, pad=0.0):
    return any(
        x0 - pad <= x <= x1 + pad and z0 - pad <= z <= z1 + pad
        for _name, x0, x1, z0, z1 in blockers
    )


def full_width_components(z0, z1, blockers):
    step = 0.1
    count = round((CENTRAL_X_MAX - CENTRAL_X_MIN) / step) + 1
    xs = [CENTRAL_X_MIN + index * step for index in range(count)]
    zs = [z0 + index * step for index in range(round((z1 - z0) / step) + 1)]
    free = {
        (ix, iz)
        for ix, x in enumerate(xs)
        for iz, z in enumerate(zs)
        if not point_blocked(x, z, blockers, BODY_RADIUS)
    }
    components = []
    while free:
        seed = free.pop()
        component = {seed}
        queue = deque([seed])
        while queue:
            ix, iz = queue.popleft()
            for candidate in ((ix - 1, iz), (ix + 1, iz), (ix, iz - 1), (ix, iz + 1)):
                if candidate in free:
                    free.remove(candidate)
                    component.add(candidate)
                    queue.append(candidate)
        components.append(component)
    if not components:
        return {"cellCount": 0, "minimumX": None, "maximumX": None, "spans": False}
    largest = max(components, key=len)
    component_x = {xs[ix] for ix, _iz in largest}
    return {
        "cellCount": len(largest),
        "minimumX": min(component_x),
        "maximumX": max(component_x),
        "spans": len(component_x) == len(xs),
    }


def intersect_intervals(interval_groups):
    common = [(-math.inf, math.inf)]
    for intervals in interval_groups:
        next_common = sorted(
            (max(lo, other_lo), min(hi, other_hi))
            for lo, hi in common
            for other_lo, other_hi in intervals
            if min(hi, other_hi) > max(lo, other_lo)
        )
        common = []
        for lo, hi in next_common:
            if common and lo <= common[-1][1] + 1e-9:
                common[-1] = (common[-1][0], max(common[-1][1], hi))
            else:
                common.append((lo, hi))
    return common


def floor_connected(config, crosswalk_id, target_ids, gallery_y):
    nodes = {}
    for collider in config["colliders"]:
        bounds = rect(collider)
        if bounds is None:
            continue
        x0, x1, z0, z1, y0, y1 = bounds
        if abs(y1 - gallery_y) <= 0.02 and (
            collider["id"].startswith(("crosswalk-", "gallery-", "stair-"))
        ):
            nodes[collider["id"]] = (x0, x1, z0, z1)
    if crosswalk_id not in nodes:
        return False, []
    seen, queue = {crosswalk_id}, deque([crosswalk_id])
    while queue:
        current = queue.popleft()
        x0, x1, z0, z1 = nodes[current]
        for name, (xx0, xx1, zz0, zz1) in nodes.items():
            if name in seen:
                continue
            if x0 <= xx1 + 0.01 and xx0 <= x1 + 0.01 and z0 <= zz1 + 0.01 and zz0 <= z1 + 0.01:
                seen.add(name)
                queue.append(name)
    return all(name in seen for name in target_ids), sorted(seen)


def verify(glb_path, config_path):
    geometry, config = Geometry(glb_path), json.loads(config_path.read_text())
    failures, report = [], {"ends": {}, "sideGalleryConnections": {}}
    if config.get("revision") != REVISION:
        failures.append(f"revision: {config.get('revision')}")
    dimensions = config.get("dimensions", {})
    expected_dimensions = {"length": 40, "endA": -20, "endB": 20}
    for key, expected in expected_dimensions.items():
        if dimensions.get(key) != expected:
            failures.append(f"dimension {key}: {dimensions.get(key)}")
    gallery_y = dimensions.get("galleryY")
    vault_y = dimensions.get("vaultCrownY")
    layout = config.get("verticalLayout", {})
    vertical_scale = layout.get("heightScale")
    if vertical_scale is None or abs(vertical_scale - 1.2) > 1e-9:
        failures.append(f"vertical scale: {vertical_scale}")
        vertical_scale = 1.2
    if layout.get("rigidFeatures") != ["catalog books", "reading furniture", "globe", "paintings", "gallery guardrails", "chandelier bodies"]:
        failures.append(f"rigid feature contract: {layout.get('rigidFeatures')}")
    if not isinstance(gallery_y, (int, float)) or abs(gallery_y - 7.44) > 1e-9:
        failures.append(f"galleryY: {gallery_y}")
        gallery_y = 7.44
    if not isinstance(vault_y, (int, float)) or abs(vault_y - 22.44) > 1e-9:
        failures.append(f"vaultCrownY: {vault_y}")
        vault_y = 22.44

    crosswalk = config.get("crosswalk", {})
    expected_crosswalk = {
        "length": 40,
        "endA": -20,
        "endB": 20,
        "endExtension": 2,
        "innerZ": 15.6,
        "outerZ": 20,
        "depth": 4.4,
        "centralWidth": 17.6,
        "sideGallerySeamX": 8.8,
        "centralXMin": -10.1,
        "centralXMax": 10.1,
        "bodyRadius": 0.3,
        "requiredBodyClearBand": 2,
        "passed": True,
    }
    if crosswalk != expected_crosswalk:
        failures.append(f"crosswalk contract: {crosswalk}")
    if (
        abs(crosswalk.get("bodyRadius", -1) - BODY_RADIUS) > 1e-9
        or abs(crosswalk.get("requiredBodyClearBand", -1) - REQUIRED_NET_WIDTH) > 1e-9
    ):
        failures.append("human walking contract changed")

    by_id = {item["id"]: item for item in config["colliders"]}
    balcony_floor = by_id.get("balcony-floor", {})
    if balcony_floor.get("center", {}).get("z") != 14.95:
        failures.append(f"end B balcony projection moved: {balcony_floor}")
    balcony_rail_bounds = {
        name: rect(item)
        for name, item in by_id.items()
        if name.startswith("balcony-rail-")
    }
    if any(bounds is None or bounds[3] > 15.75 for bounds in balcony_rail_bounds.values()):
        failures.append(f"end B balcony rail intrudes into crosswalk: {balcony_rail_bounds}")
    gallery_piers = {
        name: item for name, item in by_id.items() if name.startswith("end-b-upper-pier-")
    }
    if any(item.get("center", {}).get("z") != 19.0 for item in gallery_piers.values()):
        failures.append(f"end B gallery-screen piers: {gallery_piers}")

    blockers = crosswalk_blockers(config, gallery_y)
    sample_x = [(-14.5 + index * 0.5) for index in range(59)]
    central_x = [CENTRAL_X_MIN + index * 0.1 for index in range(203)]
    sample_z = (16.0, 16.8, 17.8, 18.8, 19.5)
    for sign, label in ((-1, "A"), (1, "B")):
        z_lo, z_hi = sorted((sign * INNER_Z, sign * OUTER_Z))
        floor_triangles = list(
            geometry.triangles((-15.1, gallery_y - 0.012, z_lo), (15.1, gallery_y + 0.012, z_hi))
        )
        missing = []
        for absolute_z in sample_z:
            z = sign * absolute_z
            for x in sample_x:
                if point_height(floor_triangles, x, z, gallery_y) is None:
                    missing.append((x, z))
        physical_widths, body_widths, body_intervals = [], [], []
        for x in sample_x:
            intervals = free_intervals(x, z_lo, z_hi, blockers)
            physical_widths.append(max((hi - lo for lo, hi in intervals), default=0.0))
        for x in central_x:
            intervals = free_intervals(x, z_lo, z_hi, blockers, BODY_RADIUS)
            body_intervals.append(intervals)
            body_widths.append(max((hi - lo for lo, hi in intervals), default=0.0))
        common_band = intersect_intervals(body_intervals)
        common_width = max((hi - lo for lo, hi in common_band), default=0.0)
        component = full_width_components(z_lo, z_hi, blockers)
        wall = front_hit(geometry, 14.5, 9.5, sign * 18.8, sign * 20.25)
        wall_z = wall[0] if wall else None
        roof_z0, roof_z1 = sorted((sign * 19.4, sign * 20.1))
        roof_triangles = list(
            geometry.triangles((-8.9, vault_y - 5.5, roof_z0), (8.9, vault_y + .1, roof_z1))
        )
        roof_y = point_height(roof_triangles, 0.0, sign * 19.5, vault_y, tolerance=5.0)
        report["ends"][label] = {
            "zRange": [z_lo, z_hi],
            "floorSamples": len(sample_x) * len(sample_z),
            "floorHoles": missing,
            "minimumPhysicalNetWidth": min(physical_widths),
            "bodyRadius": BODY_RADIUS,
            "centralXRange": [CENTRAL_X_MIN, CENTRAL_X_MAX],
            "minimumPerColumnBodyClearWidth": min(body_widths),
            "commonBodyClearBand": common_band,
            "commonBodyClearBandWidth": common_width,
            "commonBodyClearBandPhysicalWidth": common_width + 2 * BODY_RADIUS,
            "fullWidthConnectedCells": component,
            "endWallFrontZ": wall_z,
            "roofSurfaceY": roof_y,
            "criticalBodyClearIntervals": {
                str(x): free_intervals(x, z_lo, z_hi, blockers, BODY_RADIUS)
                for x in (-8.7, -8.0, -4.0, -2.4, 0.0, 2.4, 4.0, 8.0, 8.7)
            },
        }
        if missing:
            failures.append(f"end {label}: {len(missing)} floor holes")
        if common_width + 1e-9 < REQUIRED_NET_WIDTH:
            failures.append(
                f"end {label}: full-width body-clear band {common_width:.3f} "
                f"< {REQUIRED_NET_WIDTH}"
            )
        if not component["spans"]:
            failures.append(f"end {label}: central full-width body walk is disconnected")
        if wall_z is None or abs(abs(wall_z) - OUTER_Z) > 0.025:
            failures.append(f"end {label}: wall front {wall_z}, expected +/-20")
        if roof_y is None or abs(roof_y - vault_y) > .1:
            failures.append(f"end {label}: roof surface missing at z+/-19.5: {roof_y}")

    for sign, label in ((-1, "A"), (1, "B")):
        crosswalk_id = f"crosswalk-{sign * 17.8}"
        connected, members = floor_connected(
            config,
            crosswalk_id,
            ("gallery--1-0", "gallery-1-0"),
            gallery_y,
        )
        report["sideGalleryConnections"][label] = {
            "crosswalk": crosswalk_id,
            "connected": connected,
            "floorColliderChain": members,
        }
        if not connected:
            failures.append(f"end {label}: crosswalk does not join both side galleries")

    stairs = config.get("stairRoutes", {})
    anchors = {}
    for side, sign in (("left", -1), ("right", 1)):
        route = stairs.get(side, [])
        if not route or route[0].get("y") != 0 or abs(route[-1].get("y") - gallery_y) > 1e-9:
            failures.append(f"stair route {side} changed")
        stair = config.get("stairs", {}).get(side, {})
        if stair.get("steps") != 40 or abs(stair.get("rise", -1) - gallery_y) > 1e-9:
            failures.append(f"stair contract {side} changed: {stair}")
        anchor = config.get("stairs", {}).get(side, {}).get("center")
        anchors[side] = anchor
        if anchor != {"x": sign * 5.9, "y": 0, "z": -13.5}:
            failures.append(f"stair anchor {side} changed: {anchor}")
        if route and (
            abs(route[0].get("x", 0) - sign * 8.2) > 1e-6
            or abs(route[0].get("z", 0) + 12.2) > 1e-6
            or abs(route[-1].get("x", 0) - sign * 4.6) > 1e-6
            or abs(route[-1].get("z", 0) + 16.5) > 1e-6
        ):
            failures.append(f"stair route terminals {side} changed")
    report["stairAnchors"] = anchors
    report["blockerCount"] = len(blockers)
    report["revision"] = config.get("revision")
    report["verticalScale"] = vertical_scale
    report["galleryY"] = gallery_y
    report["vaultCrownY"] = vault_y
    report["walkingContract"] = {
        "eyeY": HUMAN_EYE_Y,
        "bodyRadius": BODY_RADIUS,
        "requiredBodyClearBand": REQUIRED_NET_WIDTH,
    }
    report["endBBalconyRailColliderBounds"] = balcony_rail_bounds
    report["endBGalleryPierZ"] = sorted(
        item.get("center", {}).get("z") for item in gallery_piers.values()
    )
    report["bodyRadius"] = BODY_RADIUS
    report["centralXRange"] = [CENTRAL_X_MIN, CENTRAL_X_MAX]
    report["requiredBodyClearBand"] = REQUIRED_NET_WIDTH
    report["passed"] = not failures
    report["failures"] = failures
    return report


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
    glb_path, config_path = Path(args.glb).resolve(), Path(args.config).resolve()
    report = verify(glb_path, config_path)
    report["sourceSha256"] = hashlib.sha256(glb_path.read_bytes()).hexdigest()
    report["configSha256"] = hashlib.sha256(config_path.read_bytes()).hexdigest()
    report["revision"] = json.loads(config_path.read_text())["revision"]
    report_path = root / "docs/verification/reference-library-crosswalk.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if not report["passed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
