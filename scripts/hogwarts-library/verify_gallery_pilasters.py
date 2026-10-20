#!/usr/bin/env python3
"""Bounded A-end pilaster-removal clearance on baked, uncompressed GLB triangles.

The six decorative fluted pilasters (x=+/-13.35, +/-7.1, +/-2.02) and their
independent upper/lower surround cornices must be physically absent, while the
five paintings with their individual frames, the structural ground arcade and
the external walls are preserved. Every absence zone clips real baked timber
triangles to its box and requires zero clipped surface area above the 1e-9
real-area tolerance. Revision strings are metadata only; the before GLB must
fail all six absence zones while retaining painting visibility. No generator
inspection or rendering is involved; all coordinates below are in exported
scene units.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from verify_end_walls import Geometry
from verify_outer_aisles import first_hit


ROOT = Path(__file__).resolve().parents[2]
BOUNDS = ((-14.5, 7.3, -20.12), (14.5, 16.3, -18.9))
# Removed pilaster centres and the six bounded absence boxes (scene units).
# At absX=2.02 the box is offset outward to [2.12, 2.55] to protect the
# preserved central Gothic portrait frame; the other four outer boxes are
# centered +/-0.55 on the removed pier centres.
PIER_X = (-13.35, -7.1, -2.02, 2.02, 7.1, 13.35)
ABSENCE_X = ((-13.9, -12.8), (-7.65, -6.55),
             (-2.55, -2.12), (2.12, 2.55), (6.55, 7.65), (12.8, 13.9))
ABSENCE_Y = (7.55, 16.3)
ABSENCE_Z = (-19.98, -19.0)
TIMBER_AREA_EPSILON = 1e-9


def timber(material):
    return material.startswith(("Oak •", "Walnut •"))


class GalleryGeometry:
    """Decode the bounded wall once, then reuse the existing ray helper."""

    def __init__(self, source):
        # Geometry reads baked mesh coordinates. Reject transforms it cannot apply.
        for node in source.doc.get("nodes", []):
            for key, identity in (("matrix", np.eye(4).reshape(-1).tolist()),
                                  ("translation", [0, 0, 0]),
                                  ("rotation", [0, 0, 0, 1]), ("scale", [1, 1, 1])):
                if key in node and not np.allclose(node[key], identity, atol=1e-9, rtol=0):
                    raise ValueError("requires baked identity node transforms")
        records = list(source.triangles(*BOUNDS))
        if not records:
            raise ValueError("A-end query has no triangles")
        self.points = np.asarray([r[0] for r in records], dtype=np.float64)
        self.materials = [r[1] for r in records]
        self.lo, self.hi = self.points.min(axis=1), self.points.max(axis=1)

    def triangles(self, lo, hi):
        selected = np.flatnonzero(np.all((self.hi >= lo) & (self.lo <= hi), axis=1))
        for index in selected:
            yield self.points[index], self.materials[index]


def clip_polygon(points, lo, hi):
    """Clip a real triangle to a box; AABB overlap alone is insufficient."""
    polygon = list(points)
    for axis in range(len(lo)):
        for bound, sign in ((lo[axis], 1), (hi[axis], -1)):
            output = []
            for a, b in zip(polygon, polygon[1:] + polygon[:1]):
                da, db = sign * (a[axis] - bound), sign * (b[axis] - bound)
                if da >= 0:
                    output.append(a)
                if (da >= 0) != (db >= 0):
                    output.append(a + (b - a) * da / (da - db))
            polygon = output
            if not polygon:
                return []
    return polygon


def clipped_area(triangle, lo, hi):
    polygon = clip_polygon(triangle, lo, hi)
    if len(polygon) < 3:
        return 0.0
    return sum(float(np.linalg.norm(np.cross(polygon[i] - polygon[0],
                                            polygon[i + 1] - polygon[0]))) / 2
               for i in range(1, len(polygon) - 1))


def absence_zone(geometry, center_x, box_x):
    lo, hi = (box_x[0], ABSENCE_Y[0], ABSENCE_Z[0]), (box_x[1], ABSENCE_Y[1], ABSENCE_Z[1])
    area, count, materials = 0.0, 0, set()
    roof_area = 0.0
    for triangle, material in geometry.triangles(lo, hi):
        if timber(material):
            overlap = clipped_area(triangle, lo, hi)
            # The preserved side-vault backing enters only the rear upper
            # corners of these broad boxes. It is Walnut, unlike the removed
            # Oak shafts/cornices. Keep its measured curved envelope explicit;
            # no Oak geometry or other Walnut surfaces receive an exemption.
            polygon = clip_polygon(triangle, lo, hi)
            roof_backing = (abs(center_x) > 12 and material.startswith("Walnut •")
                            and polygon and all(p[1] >= 15.0 and p[2] <= -19.60
                                                for p in polygon))
            if roof_backing:
                roof_area += overlap
                continue
            if overlap > TIMBER_AREA_EPSILON:
                area += overlap
                count += 1
                materials.add(material)
    return {"pierX": center_x, "bounds": [lo, hi],
            "timberTriangleCount": count, "preservedRoofBackingArea": round(roof_area, 8),
            "clippedSurfaceArea": round(area, 8),
            "clear": area <= TIMBER_AREA_EPSILON,
            "materials": sorted(materials)}


def artwork_visibility(geometry):
    artworks = [(-10.5, 11.76, 3.6, 4.8), (-4.6, 11.76, 3.0, 4.0),
                (0.0, 12.0, 2.6556, 6.64), (4.6, 11.76, 3.0, 4.0),
                (10.5, 11.76, 3.6, 4.8)]
    views = ((0, 0), (-25, 0), (25, 0), (-15, -12), (15, 12))
    results = []
    for x, y, width, height in artworks:
        material = "Canvas • reference portrait study" if x == 0 else "Canvas • gallery paintings"
        failures, count = [], 0
        for yaw, pitch in views:
            for dx in np.linspace(-width / 2 + .14, width / 2 - .14, 7):
                for dy in np.linspace(-height / 2 + .14, height / 2 - .14, 9):
                    target = np.array((x + dx, y + dy, -19.654))
                    offset = np.array((np.tan(np.radians(yaw)) * .85,
                                       np.tan(np.radians(pitch)) * .85, .85))
                    distance = float(np.linalg.norm(offset))
                    hit = first_hit(geometry, target + offset, -offset, distance + .003)
                    count += 1
                    if not (hit and hit[2] == material
                            and np.linalg.norm(np.asarray(hit[1]) - target) < .002):
                        failures.append({"yawPitchDegrees": [yaw, pitch],
                                         "target": target.tolist(), "hit": hit})
        results.append({"centerX": x, "centerY": y, "canvasSize": [width, height],
                        "probeCount": count, "failures": failures,
                        "passed": not failures})
    return results


def verify(source_path, config_path):
    config = json.loads(config_path.read_text())
    geometry = GalleryGeometry(Geometry(source_path))
    zones = [absence_zone(geometry, x, bx)
             for x, bx in zip(PIER_X, ABSENCE_X)]
    artworks = artwork_visibility(geometry)
    failures = ([f"removed pilaster x={z['pierX']} still has timber "
                 f"area={z['clippedSurfaceArea']} in zone {z['bounds']}"
                 for z in zones if not z["clear"]]
                + [f"canvas missing/obstructed at x={r['centerX']}"
                   for r in artworks if not r["passed"]])
    return {"source": str(source_path),
            "sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
            "config": str(config_path),
            "configSha256": hashlib.sha256(config_path.read_bytes()).hexdigest(),
            "revisionMetadata": config.get("revision"), "revisionUsedForAcceptance": False,
            "boundedTriangleCount": len(geometry.points), "absenceZones": zones,
            "artworkVisibility": artworks,
            "geometryPassed": not failures, "failures": failures}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "scripts/hogwarts-library/deliverables/architecture-uncompressed.glb")
    parser.add_argument("--config", type=Path, default=ROOT / "apps/web/public/assets/hogwarts-library/scene-config.json")
    parser.add_argument("--report", type=Path, default=ROOT / "docs/verification/reference-library-gallery-pilasters.json")
    parser.add_argument("--before-source", type=Path, default=ROOT / ".artifacts/model-clearance/pilasters-before-r26.glb")
    parser.add_argument("--before-config", type=Path, default=ROOT / ".artifacts/model-clearance/pilasters-before-r26.json")
    args = parser.parse_args()
    current = verify(args.source.resolve(), args.config.resolve())
    before = verify(args.before_source.resolve(), args.before_config.resolve())
    negative_proven = (all(not z["clear"] for z in before["absenceZones"])
                       and all(r["passed"] for r in before["artworkVisibility"]))
    report = {"passed": current["geometryPassed"] and negative_proven,
              "queryBounds": BOUNDS,
              "contract": {"removedPilasterCentersX": list(PIER_X),
                           "absenceX": {"abs2_02": "outward [2.12,2.55] preserving central frame",
                                        "otherFour": "center +/-0.55"},
                           "absenceY": list(ABSENCE_Y), "absenceZ": list(ABSENCE_Z),
                           "timberRealAreaEpsilon": TIMBER_AREA_EPSILON,
                           "preservedFloorMaximumY": 7.5,
                           "preservedRoofBacking": "outer corners only, Walnut, y>=15 and z<=-19.60; no Oak exemptions",
                           "artworkViewsYawPitchDegrees":
                           [[0, 0], [-25, 0], [25, 0], [-15, -12], [15, 12]]},
              "limitations": ["Baked uncompressed source GLB only; compressed runtime modules and browser lighting are not evaluated.",
                              "Absence zones clip real timber triangles to six bounded boxes (Y 7.55-16.3, Z -19.98 to -19.0, X centered +/-0.55 except the +/-2.02 outward frame-protected zones) and require zero clipped area above 1e-9; they are not a solid-volume or manufacturing proof and cover only these bounded footprints.",
                              "Canvas visibility samples a 7x9 grid inset 0.14 per artwork and five local views, 0.85 units in front; it does not prove every pixel or arbitrary camera angles.",
                              "Structural ground arcade and exterior wall preservation require the separate end-arcade and end-wall verifiers; this script only checks decorative absence and artwork visibility."],
              "current": current, "negativeControl": before,
              "negativeControlProvesAllSixAbsenceZonesFailAndArtworkRetained":
              negative_proven}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"passed": report["passed"], "currentFailures": current["failures"],
                      "negativeControlFailures": before["failures"],
                      "negativeControlProven": negative_proven,
                      "report": str(args.report)}, ensure_ascii=False))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())