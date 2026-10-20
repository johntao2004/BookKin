#!/usr/bin/env python3
# 对 B 端阳台支撑、墙板与相关构件进行实际三角面探测；历史 r18 支撑契约不等同于当前删改后的设计要求。
# Probes actual B-end balcony-support, panel and feature triangles; the historical r18 support contract is not automatically the current design contract after removals.
"""Verify the exported r18 B-end balcony support and lower wall panels."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

from verify_end_walls import Geometry
from verify_outer_aisles import first_hit


ROOT = Path(__file__).resolve().parents[2]
EXPECTED_REVISION = "20261020-lower-gallery-r27"
OAK = "Oak • rubbed midtone"
EDGE = "Oak • edge highlight"
DARK = "Walnut • deep recess"
GOLD = "Brass • aged edge"
STRUCTURAL_OAK = {OAK, EDGE}

DOMAIN_LO = (-7.2, -0.05, 13.3)
DOMAIN_HI = (7.2, 7.2, 20.1)
SUPPORT_XS = (-2.3, 0.0, 2.3)
ARCH_XS = (-1.15, 1.15)
OPENING_YS = (1.78, 3.5)
HEAD_YS = (6.5, 6.85)
PANEL_XS = (-5.5, 5.5)


class EndBGeometry:
    """Cache only the B-end triangles needed by repeated ray and AABB probes."""

    def __init__(self, source: "Geometry"):
        records = list(source.triangles(DOMAIN_LO, DOMAIN_HI))
        self.points = np.asarray([record[0] for record in records], dtype=np.float64)
        if len(records) == 0:
            self.points = np.empty((0, 3, 3), dtype=np.float64)
        self.materials = [record[1] for record in records]
        self.lo = self.points.min(axis=1) if records else np.empty((0, 3))
        self.hi = self.points.max(axis=1) if records else np.empty((0, 3))

    def triangles(self, lo, hi):
        query_lo = np.asarray(lo, dtype=np.float64)
        query_hi = np.asarray(hi, dtype=np.float64)
        selected = np.flatnonzero(
            np.all((self.hi >= query_lo) & (self.lo <= query_hi), axis=1)
        )
        for index in selected:
            yield self.points[index], self.materials[index]

    def triangle_count(self, lo, hi, material=None):
        return sum(
            1
            for _triangle, triangle_material in self.triangles(lo, hi)
            if material is None or triangle_material == material
        )


def serialize_hit(hit):
    if hit is None:
        return None
    return {
        "t": round(float(hit[0]), 6),
        "point": [round(float(value), 6) for value in hit[1]],
        "material": hit[2],
    }


def near(value, expected, tolerance):
    return value is not None and abs(float(value) - expected) <= tolerance


def add_probe(probes, failures, probe):
    probes.append(probe)
    if not probe["passed"]:
        failures.append(probe["failure"])


def json_default(value):
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def verify(glb_path: Path, config_path: Path):
    source_bytes = glb_path.read_bytes()
    config_bytes = config_path.read_bytes()
    geometry = EndBGeometry(Geometry(glb_path))
    config = json.loads(config_bytes)
    failures = []
    probes = []

    if config.get("revision") != EXPECTED_REVISION:
        failures.append(
            f"revision expected {EXPECTED_REVISION}: {config.get('revision')}"
        )

    # The existing balcony footprint must terminate at the final architectural
    # underside rather than the old pre-scale elevation.
    for index, (x, z) in enumerate(
        ((-0.8, 14.2), (0.8, 14.2), (-0.8, 15.25), (0.8, 15.25))
    ):
        hit = first_hit(geometry, (x, 5.8, z), (0.0, 1.0, 0.0), 1.2)
        passed = hit is not None and near(hit[1][1], 6.888, 0.018)
        add_probe(
            probes,
            failures,
            {
                "id": f"balcony-underside-{index}",
                "kind": "balcony-underside",
                "origin": [x, 5.8, z],
                "direction": [0.0, 1.0, 0.0],
                "expectedY": 6.888,
                "actual": serialize_hit(hit),
                "passed": passed,
                "failure": f"balcony underside {index} expected y=6.888: {hit}",
            },
        )

    # Solid pier shafts define the three support lines and their 4.56 spring.
    for x in SUPPORT_XS:
        for y in (0.8, 2.0, 4.3):
            hit = first_hit(geometry, (x, y, 15.3), (0.0, 0.0, 1.0), 0.8)
            passed = (
                hit is not None
                and hit[2] in STRUCTURAL_OAK
                and 15.35 <= hit[1][2] <= 15.95
            )
            add_probe(
                probes,
                failures,
                {
                    "id": f"support-pier-{x}-{y}",
                    "kind": "support-pier",
                    "origin": [x, y, 15.3],
                    "direction": [0.0, 0.0, 1.0],
                    "expectedZRange": [15.35, 15.95],
                    "actual": serialize_hit(hit),
                    "passed": passed,
                    "failure": f"support pier missing at x={x} y={y}: {hit}",
                },
            )

    # The two round support rings must be solid between their inner and outer
    # elliptical bounds. Coordinates are sampled away from tessellation edges.
    arch_samples = []
    for center in ARCH_XS:
        arch_samples.extend(
            (
                ("spring-left", center - 0.955, 4.61),
                ("haunch-left", center - 0.45, 6.064),
                ("crown", center, 6.27),
                ("haunch-right", center + 0.45, 6.064),
                ("spring-right", center + 0.955, 4.61),
                ("spandrel-low", center, 6.5),
                ("spandrel-high", center, 6.85),
            )
        )
    for index, (sample, x, y) in enumerate(arch_samples):
        hit = first_hit(geometry, (x, y, 15.3), (0.0, 0.0, 1.0), 0.8)
        passed = (
            hit is not None
            and hit[2] in STRUCTURAL_OAK
            and 15.35 <= hit[1][2] <= 16.05
        )
        add_probe(
            probes,
            failures,
            {
                "id": f"round-arch-{index}",
                "kind": "round-arch",
                "sample": sample,
                "origin": [x, y, 15.3],
                "direction": [0.0, 0.0, 1.0],
                "expectedZRange": [15.35, 16.05],
                "actual": serialize_hit(hit),
                "passed": passed,
                "failure": f"round support arch missing at {x}/{y}: {hit}",
            },
        )

    # The explicit B-end openings must remain clear through the whole support
    # depth. This is geometry-only and does not depend on the revision string.
    for x in ARCH_XS:
        for y in OPENING_YS:
            hit = first_hit(geometry, (x, y, 14.5), (0.0, 0.0, 1.0), 1.7)
            passed = hit is None
            add_probe(
                probes,
                failures,
                {
                    "id": f"ground-opening-{x}-{y}",
                    "kind": "ground-opening",
                    "origin": [x, y, 14.5],
                    "direction": [0.0, 0.0, 1.0],
                    "expected": "clear through z=16.2",
                    "actual": serialize_hit(hit),
                    "passed": passed,
                    "failure": f"ground opening blocked at x={x} y={y}: {hit}",
                },
            )

    # Both arch-center support heads must reach the beam zone. r17 has no
    # geometry at y=6.85 here, even when its config revision is overwritten.
    for x in ARCH_XS:
        for y in HEAD_YS:
            hit = first_hit(geometry, (x, y, 15.3), (0.0, 0.0, 1.0), 0.8)
            passed = (
                hit is not None
                and hit[2] in STRUCTURAL_OAK
                and 15.35 <= hit[1][2] <= 15.95
            )
            add_probe(
                probes,
                failures,
                {
                    "id": f"support-head-{x}-{y}",
                    "kind": "support-head",
                    "origin": [x, y, 15.3],
                    "direction": [0.0, 0.0, 1.0],
                    "expectedZRange": [15.35, 15.95],
                    "actual": serialize_hit(hit),
                    "passed": passed,
                    "failure": f"support head not solid at x={x} y={y}: {hit}",
                },
            )

    # Beam span and its final 6.408..6.888 vertical section.
    for index, x in enumerate((-3.4, 0.0, 3.4)):
        hit = first_hit(geometry, (x, 6.65, 15.3), (0.0, 0.0, 1.0), 0.8)
        passed = (
            hit is not None
            and hit[2] in STRUCTURAL_OAK
            and 15.35 <= hit[1][2] <= 15.95
        )
        add_probe(
            probes,
            failures,
            {
                "id": f"beam-span-{index}",
                "kind": "beam-span",
                "origin": [x, 6.65, 15.3],
                "direction": [0.0, 0.0, 1.0],
                "expectedZRange": [15.35, 15.95],
                "actual": serialize_hit(hit),
                "passed": passed,
                "failure": f"support beam missing across span at x={x}: {hit}",
            },
        )

    beam_bottom = first_hit(
        geometry, (-3.4, 6.2, 15.68), (0.0, 1.0, 0.0), 0.4
    )
    add_probe(
        probes,
        failures,
        {
            "id": "beam-bottom",
            "kind": "beam-bottom",
            "origin": [-3.4, 6.2, 15.68],
            "direction": [0.0, 1.0, 0.0],
            "expectedY": 6.408,
            "actual": serialize_hit(beam_bottom),
            "passed": beam_bottom is not None
            and near(beam_bottom[1][1], 6.408, 0.025),
            "failure": f"support beam bottom expected y=6.408: {beam_bottom}",
        },
    )
    beam_top = first_hit(
        geometry, (-3.4, 7.1, 15.68), (0.0, -1.0, 0.0), 0.4
    )
    add_probe(
        probes,
        failures,
        {
            "id": "beam-top",
            "kind": "beam-top",
            "origin": [-3.4, 7.1, 15.68],
            "direction": [0.0, -1.0, 0.0],
            "expectedY": 6.888,
            "actual": serialize_hit(beam_top),
            "passed": beam_top is not None
            and near(beam_top[1][1], 6.888, 0.025),
            "failure": f"support beam top expected y=6.888: {beam_top}",
        },
    )

    # The retired r17 pointed arches were centered on all three piers. These
    # ray hits sit on their old curve but clear of the new paired round arches.
    for center in SUPPORT_XS:
        for side in (-1.0, 1.0):
            x = center + side * 0.7125
            y = 4.19
            hit = first_hit(geometry, (x, y, 15.3), (0.0, 0.0, 1.0), 0.8)
            passed = hit is None
            add_probe(
                probes,
                failures,
                {
                    "id": f"removed-pointed-arch-{center}-{side}",
                    "kind": "removed-pointed-arch",
                    "origin": [x, y, 15.3],
                    "direction": [0.0, 0.0, 1.0],
                    "expected": "clear",
                    "actual": serialize_hit(hit),
                    "passed": passed,
                    "failure": f"retired pointed arch remains at x={x} y={y}: {hit}",
                },
            )

    # Corbels stay on the three support axes even though the old lancets do not.
    for x in SUPPORT_XS:
        hit = first_hit(geometry, (x, 5.65, 15.3), (0.0, 0.0, 1.0), 0.8)
        passed = hit is not None and hit[2] in STRUCTURAL_OAK
        add_probe(
            probes,
            failures,
            {
                "id": f"corbel-{x}",
                "kind": "corbel",
                "origin": [x, 5.65, 15.3],
                "direction": [0.0, 0.0, 1.0],
                "actual": serialize_hit(hit),
                "passed": passed,
                "failure": f"support corbel missing at x={x}: {hit}",
            },
        )

    # Lower wall panels must have their decorated faces behind z=19.3. The
    # r17 frames occupied the discarded z=17..19.3 band and fail both checks.
    for x in PANEL_XS:
        unsupported = geometry.triangle_count(
            (x - 1.8, 2.0, 17.0),
            (x + 1.8, 5.0, 19.3),
        )
        panel_hit = first_hit(
            geometry, (x, 3.0, 16.5), (0.0, 0.0, 1.0), 3.6
        )
        panel_ok = (
            panel_hit is not None
            and panel_hit[2] == DARK
            and 19.5 <= panel_hit[1][2] <= 19.9
            and near(panel_hit[1][2], 19.74, 0.04)
        )
        add_probe(
            probes,
            failures,
            {
                "id": f"wall-panel-depth-{x}",
                "kind": "wall-panel-depth",
                "origin": [x, 3.0, 16.5],
                "direction": [0.0, 0.0, 1.0],
                "expectedZRange": [19.5, 19.9],
                "expectedBackingFrontZ": 19.74,
                "actual": serialize_hit(panel_hit),
                "passed": panel_ok,
                "failure": f"wall panel face not at z=19.5..19.9 for x={x}: {panel_hit}",
            },
        )
        add_probe(
            probes,
            failures,
            {
                "id": f"unsupported-frame-band-{x}",
                "kind": "unsupported-frame-band",
                "bounds": [
                    [x - 1.8, 2.0, 17.0],
                    [x + 1.8, 5.0, 19.3],
                ],
                "triangleCount": unsupported,
                "passed": unsupported == 0,
                "failure": f"unsupported wall-panel frame geometry for x={x}: {unsupported} triangles",
            },
        )

        frame_hits = []
        frame_passed = True
        for edge_x in (x - 1.5, x + 1.5):
            hit = first_hit(
                geometry, (edge_x, 3.0, 16.5), (0.0, 0.0, 1.0), 3.4
            )
            valid = (
                hit is not None
                and hit[2] in STRUCTURAL_OAK
                and 19.5 <= hit[1][2] <= 19.75
            )
            frame_hits.append(serialize_hit(hit))
            frame_passed = frame_passed and valid

        wheel_hit = first_hit(
            geometry, (x, 3.8, 16.5), (0.0, 0.0, 1.0), 3.3
        )
        wheel_ok = (
            wheel_hit is not None
            and wheel_hit[2] == GOLD
            and 19.5 <= wheel_hit[1][2] <= 19.74
        )
        add_probe(
            probes,
            failures,
            {
                "id": f"wall-panel-wheel-{x}",
                "kind": "wall-panel-wheel",
                "origin": [x, 3.8, 16.5],
                "direction": [0.0, 0.0, 1.0],
                "expectedZRange": [19.5, 19.74],
                "actual": serialize_hit(wheel_hit),
                "passed": wheel_ok,
                "failure": f"wall-panel wheel does not join backing at x={x}: {wheel_hit}",
            },
        )
        add_probe(
            probes,
            failures,
            {
                "id": f"wall-panel-frame-edges-{x}",
                "kind": "wall-panel-frame-edges",
                "actual": frame_hits,
                "passed": frame_passed,
                "failure": f"wall-panel frame front missing for x={x}: {frame_hits}",
            },
        )

        dark_triangles = list(
            geometry.triangles(
                (x - 1.7, 0.0, 19.6),
                (x + 1.7, 7.2, 19.8),
                )
        )
        dark_top = max(
            (
                float(point[1])
                for triangle, material in dark_triangles
                if material == DARK
                for point in triangle
            ),
            default=None,
        )
        top_ok = dark_top is not None and dark_top < 6.888 + 0.005
        add_probe(
            probes,
            failures,
            {
                "id": f"wall-panel-top-{x}",
                "kind": "wall-panel-top",
                "measuredDarkTopY": dark_top,
                "maximumY": 6.888,
                "passed": top_ok,
                "failure": f"wall panel top reaches y={dark_top}, maximum is 6.888",
            },
        )

    relevant_colliders = {
        collider["id"]: collider
        for collider in config.get("colliders", [])
        if collider.get("id", "").startswith(
            ("balcony-", "end-b-balcony-pier-", "end-b-lower-panel-")
        )
    }
    for x in SUPPORT_XS:
        if f"end-b-balcony-pier-{x:g}" not in relevant_colliders:
            failures.append(f"missing support pier collider for x={x}")
    for x in PANEL_XS:
        if f"end-b-lower-panel-{x:g}" not in relevant_colliders:
            failures.append(f"missing lower wall-panel collider for x={x}")

    return {
        "scope": (
            "Exported B-end GLB ray/AABB regression. This is model evidence, "
            "not browser, GPU, or arbitrary-angle visual acceptance."
        ),
        "source": str(glb_path),
        "config": str(config_path),
        "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
        "configSha256": hashlib.sha256(config_bytes).hexdigest(),
        "revision": config.get("revision"),
        "colliderCount": len(config.get("colliders", [])),
        "cache": {
            "bounds": {"min": DOMAIN_LO, "max": DOMAIN_HI},
            "triangles": len(geometry.materials),
        },
        "parameters": {
            "supportXs": SUPPORT_XS,
            "supportZ": 15.75,
            "springY": 4.56,
            "archXs": ARCH_XS,
            "innerHalf": 0.88,
            "innerRise": 1.35 * 1.2,
            "outerHalf": 1.03,
            "outerRise": 1.50 * 1.2,
            "balconyUndersideY": 6.888,
            "beamYRange": [6.408, 6.888],
            "beamXSpan": [-3.7, 3.7],
            "beamZ": 15.68,
            "beamDepth": 0.54,
            "panelXs": PANEL_XS,
            "panelBackingFrontZ": 19.74,
            "panelFrameFrontZ": 19.65,
            "panelWheelZ": 19.62,
        },
        "probes": probes,
        "passed": not failures,
        "failures": failures,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "glb",
        nargs="?",
        type=Path,
        default=ROOT
        / "scripts/hogwarts-library/deliverables/architecture-uncompressed.glb",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=ROOT / "apps/web/public/assets/hogwarts-library/scene-config.json",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=ROOT / "docs/verification/reference-library-end-b-support.json",
    )
    args = parser.parse_args()

    glb_path = args.glb.resolve()
    config_path = args.config.resolve()
    report_path = args.report.resolve()
    report = verify(glb_path, config_path)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False, default=json_default) + "\n"
    )
    print(
        json.dumps(
            {
                "passed": report["passed"],
                "revision": report["revision"],
                "sourceSha256": report["sourceSha256"],
                "configSha256": report["configSha256"],
                "probes": len(report["probes"]),
                "failures": report["failures"][:12],
                "report": str(report_path),
            },
            ensure_ascii=False,
        )
    )
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
