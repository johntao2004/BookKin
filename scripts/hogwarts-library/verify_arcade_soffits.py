#!/usr/bin/env python3
"""Blender-free verification of the twelve r12 arcade soffits in the source GLB.

Run with NumPy:

  .local/tools/blender-volume/Blender.app/Contents/Resources/4.3/python/bin/python3.11 \
    scripts/hogwarts-library/verify_arcade_soffits.py --json /tmp/arcade-r12.json

The r10 baseline has no `arcadeSoffits` object. It is sampled with the r10
fallback contract and must fail; its saved evidence remains at
`.local/logs/arcade-baseline-r10.json`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_GLB = ROOT / "scripts/hogwarts-library/deliverables/architecture-uncompressed.glb"
DEFAULT_CONFIG = ROOT / "apps/web/public/assets/hogwarts-library/scene-config.json"
TARGET_REVISION = "20261020-lower-gallery-r27"
BLUE = "Paint • blue gray vault"
TEAL = "Paint • teal border"
IVORY = "Paint • faded ivory inlay"
BAYS = (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5)
PRIMARY_DX = (-0.29, -0.17, 0.0, 0.17, 0.29)
ANGLES = np.linspace(0.15, math.pi - 0.15, 45)
TEAL_OFFSET = 0.37
TEAL_DEPTH = 0.04
DISTANCE_TOLERANCE = 0.016
MIN_BLUE_COVERAGE = 0.80

EXPECTED = {
    "count": 12,
    "centerAbsX": 8.8,
    "springY": 4.68,
    "innerHalf": 2.13,
    "innerRise": 1.812,
    "paintThickness": 0.065,
    "paintRiseThickness": 0.078,
    "woodThickness": 0.20,
    "woodRiseThickness": 0.24,
    "heightScale": 1.2,
    "segments": 64,
    "depth": 0.7,
    "style": "shared-nested-elliptical-profiles",
}


@dataclass(frozen=True)
class Contract:
    count: int
    center_abs_x: float
    spring_y: float
    inner_half: float
    inner_rise: float
    paint_thickness: float
    paint_rise_thickness: float
    wood_thickness: float
    wood_rise_thickness: float
    height_scale: float
    segments: int
    depth: float


LEGACY_R10 = Contract(
    count=12,
    center_abs_x=8.8,
    spring_y=3.9,
    inner_half=2.13,
    inner_rise=1.51,
    paint_thickness=0.065,
    paint_rise_thickness=0.065,
    wood_thickness=0.20,
    wood_rise_thickness=0.20,
    height_scale=1.0,
    segments=64,
    depth=0.7,
)


def load_contract(config, failures):
    raw = config.get("arcadeSoffits")
    if not isinstance(raw, dict):
        failures.append("arcadeSoffits contract is missing from scene-config")
        return LEGACY_R10

    def get(name):
        if name not in raw:
            failures.append(f"arcadeSoffits.{name} is missing")
            return EXPECTED[name]
        return raw[name]

    return Contract(
        count=int(get("count")),
        center_abs_x=float(get("centerAbsX")),
        spring_y=float(get("springY")),
        inner_half=float(get("innerHalf")),
        inner_rise=float(get("innerRise")),
        paint_thickness=float(get("paintThickness")),
        paint_rise_thickness=float(get("paintRiseThickness")),
        wood_thickness=float(get("woodThickness")),
        wood_rise_thickness=float(get("woodRiseThickness")),
        height_scale=float(get("heightScale")),
        segments=int(get("segments")),
        depth=float(get("depth")),
    )


def validate_contract(config, contract, failures):
    actual = {
        "count": contract.count,
        "centerAbsX": contract.center_abs_x,
        "springY": contract.spring_y,
        "innerHalf": contract.inner_half,
        "innerRise": contract.inner_rise,
        "paintThickness": contract.paint_thickness,
        "paintRiseThickness": contract.paint_rise_thickness,
        "woodThickness": contract.wood_thickness,
        "woodRiseThickness": contract.wood_rise_thickness,
        "heightScale": contract.height_scale,
        "segments": contract.segments,
        "depth": contract.depth,
        "style": config.get("arcadeSoffits", {}).get("style"),
    }
    for name, wanted in EXPECTED.items():
        found = actual[name]
        matches = (
            math.isclose(found, wanted, abs_tol=1e-9)
            if isinstance(wanted, float)
            else found == wanted
        )
        if not matches:
            failures.append(
                f"arcadeSoffits.{name}: expected {wanted!r}, got {found!r}"
            )
    bays = tuple(config.get("bays", ()))
    if bays != BAYS:
        failures.append(f"scene bays: expected {BAYS}, got {bays}")


class SnapshotGeometry:
    """Parse the exact GLB bytes whose hash is reported."""

    def __init__(self, data: bytes, path: Path):
        magic, version, size = struct.unpack_from("<4sII", data, 0)
        if magic != b"glTF" or version != 2 or size != len(data):
            raise ValueError(f"not a glTF 2.0 binary: {path}")
        self.doc = self.binary = None
        offset = 12
        while offset < len(data):
            chunk_size, kind = struct.unpack_from("<II", data, offset)
            payload = data[offset + 8 : offset + 8 + chunk_size]
            offset += 8 + chunk_size
            if kind == 0x4E4F534A:
                self.doc = json.loads(payload)
            elif kind == 0x004E4942:
                self.binary = payload
        if self.doc is None or self.binary is None:
            raise ValueError("GLB has no JSON or BIN chunk")
        if self.doc.get("extensionsRequired"):
            raise ValueError("run before meshopt module compression")


def load_region(geometry, lo, hi):
    """Load actual triangles touching the arch's local bounding box."""
    query_lo = np.asarray(lo, dtype=np.float32)
    query_hi = np.asarray(hi, dtype=np.float32)
    triangle_blocks = []
    material_blocks = []
    for mesh in geometry.doc["meshes"]:
        for primitive in mesh["primitives"]:
            if primitive.get("mode", 4) != 4 or "indices" not in primitive:
                raise ValueError("arcade verifier requires indexed triangles")
            position = geometry.doc["accessors"][primitive["attributes"]["POSITION"]]
            position_view = geometry.doc["bufferViews"][position["bufferView"]]
            if position.get("componentType") != 5126 or position.get("normalized"):
                raise ValueError("arcade verifier requires float32 POSITION")
            if any(
                position["max"][axis] < query_lo[axis]
                or position["min"][axis] > query_hi[axis]
                for axis in range(3)
            ):
                continue
            index = geometry.doc["accessors"][primitive["indices"]]
            index_view = geometry.doc["bufferViews"][index["bufferView"]]
            dtype = {5121: "u1", 5123: "<u2", 5125: "<u4"}.get(
                index.get("componentType")
            )
            if dtype is None or index.get("normalized"):
                raise ValueError("unsupported index accessor")
            p_base = position_view.get("byteOffset", 0) + position.get(
                "byteOffset", 0
            )
            i_base = index_view.get("byteOffset", 0) + index.get("byteOffset", 0)
            vertices = np.ndarray(
                (position["count"], 3),
                dtype="<f4",
                buffer=geometry.binary,
                offset=p_base,
                strides=(position_view.get("byteStride", 12), 4),
            )
            indices = np.frombuffer(
                geometry.binary,
                dtype=dtype,
                count=index["count"],
                offset=i_base,
            ).reshape(-1, 3)
            triangles = vertices[indices]
            tri_lo = triangles.min(axis=1)
            tri_hi = triangles.max(axis=1)
            selected = np.all(
                (tri_hi >= query_lo) & (tri_lo <= query_hi), axis=1
            )
            if not np.any(selected):
                continue
            material_index = primitive.get("material")
            material = (
                "<none>"
                if material_index is None
                else geometry.doc["materials"][material_index].get("name", "")
            )
            triangle_blocks.append(triangles[selected])
            material_blocks.append(
                np.full(int(np.count_nonzero(selected)), material, dtype=object)
            )
    if not triangle_blocks:
        return np.empty((0, 3, 3), dtype=np.float32), np.empty(0, dtype=object)
    return np.concatenate(triangle_blocks), np.concatenate(material_blocks)


def first_hit(triangles, materials, tri_lo, tri_hi, origin, direction, max_t):
    """Return the first double-sided triangle distance and material."""
    origin = np.asarray(origin, dtype=np.float64)
    direction = np.asarray(direction, dtype=np.float64)
    end = origin + direction * max_t
    lo = np.minimum(origin, end) - 2e-5
    hi = np.maximum(origin, end) + 2e-5
    selected = np.flatnonzero(
        np.all((tri_hi >= lo) & (tri_lo <= hi), axis=1)
    )
    if selected.size == 0:
        return None
    tris = triangles[selected].astype(np.float64, copy=False)
    edge1 = tris[:, 1] - tris[:, 0]
    edge2 = tris[:, 2] - tris[:, 0]
    pvec = np.cross(direction, edge2)
    determinant = np.einsum("ij,ij->i", edge1, pvec)
    valid = np.abs(determinant) > 1e-12
    inverse = np.zeros_like(determinant)
    inverse[valid] = 1.0 / determinant[valid]
    tvec = origin - tris[:, 0]
    u = np.einsum("ij,ij->i", tvec, pvec) * inverse
    qvec = np.cross(tvec, edge1)
    v = np.einsum("j,ij->i", direction, qvec) * inverse
    distance = np.einsum("ij,ij->i", edge2, qvec) * inverse
    valid &= (
        (u >= -1e-8)
        & (v >= -1e-8)
        & (u + v <= 1.0 + 1e-8)
        & (distance > 1e-8)
        & (distance <= max_t)
    )
    if not np.any(valid):
        return None
    nearest = float(distance[valid].min())
    tied = valid & (np.abs(distance - nearest) <= 1e-7)
    names = sorted(set(str(name) for name in materials[selected][tied]))
    material = next(
        (name for name in names if name.startswith("Oak •")), names[0]
    )
    return nearest, material


def boundary_bins(triangles, centre, bay, spring, half, rise, steps):
    if len(triangles) == 0:
        return []
    vertices = np.unique(triangles.reshape(-1, 3), axis=0)
    y = (vertices[:, 1] - spring) / rise
    z = (vertices[:, 2] - bay) / half
    on_ellipse = np.abs(np.hypot(y, z) - 1.0) <= 2e-4
    angle = np.arctan2(y[on_ellipse], z[on_ellipse])
    step = math.pi / steps
    index = np.rint(angle / step).astype(int)
    keep = (
        (angle >= -2e-4)
        & (angle <= math.pi + 2e-4)
        & (np.abs(angle - index * step) <= 2e-4)
    )
    return sorted(int(value) for value in np.unique(index[keep]))


def ellipse_distance(angle, half, rise):
    return 1.0 / math.sqrt(
        (math.cos(angle) / half) ** 2 + (math.sin(angle) / rise) ** 2
    )


def check_arch(geometry, side, bay, contract, failures, geometry_checks):
    centre = side * contract.center_abs_x
    lo = (
        centre - 0.75,
        contract.spring_y - 0.08,
        bay - contract.inner_half - 0.27,
    )
    hi = (
        centre + 0.75,
        contract.spring_y
        + contract.inner_rise
        + contract.paint_rise_thickness
        + contract.wood_rise_thickness
        + 0.30,
        bay + contract.inner_half + 0.27,
    )
    triangles, materials = load_region(geometry, lo, hi)
    tri_lo = triangles.min(axis=1) if len(triangles) else np.empty((0, 3))
    tri_hi = triangles.max(axis=1) if len(triangles) else np.empty((0, 3))
    arch_id = f"{side:+d}/{bay:g}"
    counts = Counter(str(name) for name in materials)
    blue = triangles[materials == BLUE]
    oak = triangles[np.char.startswith(materials.astype(str), "Oak •")]
    ivory = triangles[materials == IVORY]
    teal = triangles[materials == TEAL]
    if len(blue) == 0:
        failures.append(f"arch {arch_id}: blue soffit surface is missing")
    if len(oak) == 0:
        failures.append(f"arch {arch_id}: timber ring/spandrel is missing")
    if len(ivory) == 0:
        failures.append(f"arch {arch_id}: ivory soffit ornament is missing")

    expected_bins = list(range(contract.segments + 1))
    edges = {
        "blue inner ellipse": (blue, contract.inner_half, contract.inner_rise),
        "blue outer ellipse": (
            blue,
            contract.inner_half + contract.paint_thickness,
            contract.inner_rise + contract.paint_rise_thickness,
        ),
        "wood inner ellipse": (
            oak,
            contract.inner_half + contract.paint_thickness,
            contract.inner_rise + contract.paint_rise_thickness,
        ),
        "wood/spandrel ringouter ellipse": (
            oak,
            contract.inner_half + contract.paint_thickness + contract.wood_thickness,
            contract.inner_rise
            + contract.paint_rise_thickness
            + contract.wood_rise_thickness,
        ),
    }
    segment_counts = {}
    for label, (surface, half, rise) in edges.items():
        bins = boundary_bins(
            surface,
            centre,
            bay,
            contract.spring_y,
            half,
            rise,
            contract.segments,
        )
        segment_counts[label] = len(bins)
        if bins != expected_bins:
            failures.append(
                f"arch {arch_id}: {label} has "
                f"{len(bins)}/{contract.segments + 1} aligned segment vertices"
            )

    blue_min = blue_max = None
    if len(blue):
        blue_x = blue.reshape(-1, 3)[:, 0]
        blue_min, blue_max = float(blue_x.min()), float(blue_x.max())
        if (
            abs(blue_min - (centre - contract.depth / 2)) > 2e-3
            or abs(blue_max - (centre + contract.depth / 2)) > 2e-3
        ):
            failures.append(
                f"arch {arch_id}: blue depth is {blue_min:.4f}..{blue_max:.4f}"
            )

    teal_ranges = {}
    for offset in (-TEAL_OFFSET, TEAL_OFFSET):
        expected_x = centre + offset
        local = (
            np.abs(teal.reshape(-1, 3)[:, 0] - expected_x) <= 0.03
            if len(teal)
            else np.empty(0, dtype=bool)
        )
        if not np.any(local):
            failures.append(
                f"arch {arch_id}: teal ring missing at x={expected_x:.4f}"
            )
            continue
        low = float(teal.reshape(-1, 3)[local, 0].min())
        high = float(teal.reshape(-1, 3)[local, 0].max())
        teal_ranges[f"{offset:+.2f}"] = [low, high]
        if (
            abs((low + high) / 2 - expected_x) > 2e-3
            or abs(high - low - TEAL_DEPTH) > 2e-3
        ):
            failures.append(
                f"arch {arch_id}: teal ring {offset:+.2f} spans {low:.4f}..{high:.4f}"
            )

    first_hits = Counter()
    failures_by_reason = Counter()
    examples = defaultdict(list)
    errors = []
    coverage = {}
    for dx in PRIMARY_DX:
        face_blue = 0
        for angle in ANGLES:
            origin = (centre + dx, contract.spring_y, bay)
            direction = (0.0, math.sin(float(angle)), math.cos(float(angle)))
            expected = ellipse_distance(
                float(angle), contract.inner_half, contract.inner_rise
            )
            hit = first_hit(
                triangles,
                materials,
                tri_lo,
                tri_hi,
                origin,
                direction,
                expected + 0.12,
            )
            if hit is None:
                failures_by_reason["no-hit"] += 1
                if len(examples["no-hit"]) < 3:
                    examples["no-hit"].append(f"dx={dx:+.2f} a={angle:.4f}")
                continue
            distance, material = hit
            first_hits[material] += 1
            if material == BLUE:
                face_blue += 1
                error = distance - expected
                errors.append(error)
                if abs(error) > DISTANCE_TOLERANCE:
                    failures_by_reason["ellipse-distance"] += 1
                    if len(examples["ellipse-distance"]) < 3:
                        examples["ellipse-distance"].append(
                            f"dx={dx:+.2f} a={angle:.4f} error={error:+.4f}"
                        )
            if material not in (BLUE, IVORY):
                reason = (
                    "timber-first"
                    if material.startswith("Oak •")
                    else f"unexpected-first:{material}"
                )
                failures_by_reason[reason] += 1
                if len(examples[reason]) < 3:
                    examples[reason].append(f"dx={dx:+.2f} a={angle:.4f}")
        coverage[f"{dx:+.2f}"] = face_blue / len(ANGLES)

    low = {dx: value for dx, value in coverage.items() if value < MIN_BLUE_COVERAGE}
    if low:
        failures.append(
            f"arch {arch_id}: blue coverage below {MIN_BLUE_COVERAGE:.2f} "
            f"on {len(low)}/5 lanes"
        )
    for reason, count in failures_by_reason.items():
        failures.append(
            f"arch {arch_id}: primary {reason} {count}/225: "
            + ", ".join(examples[reason])
        )

    oblique_hits = Counter()
    oblique_failures = Counter()
    for dx_sign in (-1, 1):
        for angle in (0.55, 0.90, math.pi - 0.90, math.pi - 0.55):
            origin = np.asarray(
                (centre + dx_sign * 0.65, contract.spring_y, bay)
            )
            target = np.asarray(
                (
                    centre + dx_sign * 0.20,
                    contract.spring_y + contract.inner_rise * math.sin(angle),
                    bay + contract.inner_half * math.cos(angle),
                )
            )
            vector = target - origin
            length = float(np.linalg.norm(vector))
            hit = first_hit(
                triangles,
                materials,
                tri_lo,
                tri_hi,
                origin,
                vector / length,
                length + 0.18,
            )
            if hit is None:
                oblique_failures["no-hit"] += 1
                continue
            material = hit[1]
            oblique_hits[material] += 1
            if material.startswith("Oak •"):
                oblique_failures["timber-first"] += 1
    for reason, count in oblique_failures.items():
        failures.append(
            f"arch {arch_id}: oblique {reason} {count}/8"
        )

    geometry_checks[arch_id] = {
        "triangles": int(len(triangles)),
        "materials": dict(sorted(counts.items())),
        "segmentVertices": segment_counts,
        "blueDepth": [blue_min, blue_max],
        "tealRanges": teal_ranges,
    }
    return {
        "primaryTotal": len(PRIMARY_DX) * len(ANGLES),
        "primaryFirstHits": dict(sorted(first_hits.items())),
        "faceBlueCoverage": coverage,
        "ellipseErrorMaxAbs": max((abs(e) for e in errors), default=None),
        "obliqueTotal": 8,
        "obliqueFirstHits": dict(sorted(oblique_hits.items())),
    }


def contract_json(contract):
    return {
        "count": contract.count,
        "centerAbsX": contract.center_abs_x,
        "springY": contract.spring_y,
        "innerHalf": contract.inner_half,
        "innerRise": contract.inner_rise,
        "paintThickness": contract.paint_thickness,
        "paintRiseThickness": contract.paint_rise_thickness,
        "woodThickness": contract.wood_thickness,
        "woodRiseThickness": contract.wood_rise_thickness,
        "heightScale": contract.height_scale,
        "segments": contract.segments,
        "depth": contract.depth,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--glb", type=Path, default=DEFAULT_GLB)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()

    glb_path, config_path = args.glb.resolve(), args.config.resolve()
    source = glb_path.read_bytes()
    config = json.loads(config_path.read_text())
    failures = []
    revision = config.get("revision")
    if revision != TARGET_REVISION:
        failures.append(
            f"revision: expected {TARGET_REVISION}, got {revision!r}; "
            "geometry was still sampled"
        )
    contract = load_contract(config, failures)
    validate_contract(config, contract, failures)
    geometry = SnapshotGeometry(source, glb_path)
    geometry_checks = {}
    samples = {}
    for side in (-1, 1):
        for bay in BAYS:
            key = f"{side:+d}/{bay:g}"
            samples[key] = check_arch(
                geometry, side, bay, contract, failures, geometry_checks
            )

    primary_hits = Counter()
    oblique_hits = Counter()
    coverage = []
    errors = []
    for sample in samples.values():
        primary_hits.update(sample["primaryFirstHits"])
        oblique_hits.update(sample["obliqueFirstHits"])
        coverage.extend(sample["faceBlueCoverage"].values())
        if sample["ellipseErrorMaxAbs"] is not None:
            errors.append(sample["ellipseErrorMaxAbs"])

    report = {
        "geometry": str(glb_path),
        "config": str(config_path),
        "sourceSha256": hashlib.sha256(source).hexdigest(),
        "sourceBytes": len(source),
        "revision": revision,
        "targetRevision": TARGET_REVISION,
        "contract": contract_json(contract),
        "samples": {
            "primary": {
                "total": sum(s["primaryTotal"] for s in samples.values()),
                "xOffsets": list(PRIMARY_DX),
                "anglesPerFace": len(ANGLES),
                "archCount": len(samples),
                "firstHits": dict(sorted(primary_hits.items())),
                "blueCoverage": {
                    "minimum": min(coverage, default=0.0),
                    "mean": float(np.mean(coverage)) if coverage else 0.0,
                    "threshold": MIN_BLUE_COVERAGE,
                },
                "ellipseDistanceTolerance": DISTANCE_TOLERANCE,
                "ellipseErrorMaxAbs": max(errors, default=None),
            },
            "oblique": {
                "total": sum(s["obliqueTotal"] for s in samples.values()),
                "originXOffsets": [-0.65, 0.65],
                "targetXOffsets": [-0.20, 0.20],
                "firstHits": dict(sorted(oblique_hits.items())),
            },
            "arches": samples,
        },
        "geometryChecks": geometry_checks,
        "failures": failures,
        "passed": not failures,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(rendered)
    sys.stdout.write(rendered)
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
