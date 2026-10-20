#!/usr/bin/env python3
# 读取未压缩 GLB 并提供区域三角面查询，验证端墙分层、碰撞和家具移除；历史布局断言须匹配所测基线。
# Reads uncompressed GLB regional triangles and verifies end-wall layers, collision and furniture removal; historical layout assertions must match the inspected baseline.
"""Blender-free checks for r7 gallery and end-wall layers, collisions and removed furniture."""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path

import numpy as np

EXPECTED_REVISION = "20261020-lower-gallery-r27"


class Geometry:
    def __init__(self, path: Path):
        data = path.read_bytes()
        magic, version, size = struct.unpack_from("<4sII", data, 0)
        if magic != b"glTF" or version != 2 or size != len(data):
            raise ValueError(f"not a glTF 2.0 binary: {path}")
        offset, doc, binary = 12, None, None
        while offset < len(data):
            chunk_size, kind = struct.unpack_from("<II", data, offset)
            payload = data[offset + 8:offset + 8 + chunk_size]
            offset += 8 + chunk_size
            if kind == 0x4E4F534A:
                doc = json.loads(payload)
            elif kind == 0x004E4942:
                binary = payload
        if doc is None or binary is None:
            raise ValueError("GLB has no JSON or BIN chunk")
        if doc.get("extensionsRequired"):
            raise ValueError("run before meshopt module compression")
        self.doc, self.binary = doc, binary

    def triangles(self, lo, hi):
        query_lo = np.asarray(lo, dtype=np.float32)
        query_hi = np.asarray(hi, dtype=np.float32)
        if np.any(query_lo > query_hi):
            raise ValueError(f"reversed query bounds: {lo} > {hi}")
        for mesh in self.doc["meshes"]:
            for primitive in mesh["primitives"]:
                position = self.doc["accessors"][primitive["attributes"]["POSITION"]]
                position_view = self.doc["bufferViews"][position["bufferView"]]
                index = self.doc["accessors"][primitive["indices"]]
                index_view = self.doc["bufferViews"][index["bufferView"]]
                if any(
                    position["max"][axis] < lo[axis]
                    or position["min"][axis] > hi[axis]
                    for axis in range(3)
                ):
                    continue
                dtype = {5121: "u1", 5123: "<u2", 5125: "<u4"}.get(
                    index["componentType"]
                )
                if dtype is None:
                    raise ValueError(f"unsupported index type {index['componentType']}")
                p_base = position_view.get("byteOffset", 0) + position.get(
                    "byteOffset", 0
                )
                i_base = index_view.get("byteOffset", 0) + index.get(
                    "byteOffset", 0
                )
                p_stride = position_view.get("byteStride", 12)
                vertices = np.ndarray(
                    (position["count"], 3),
                    dtype="<f4",
                    buffer=self.binary,
                    offset=p_base,
                    strides=(p_stride, 4),
                )
                indices = np.frombuffer(
                    self.binary,
                    dtype=dtype,
                    count=index["count"],
                    offset=i_base,
                ).reshape(-1, 3)
                triangles = vertices[indices]
                tri_lo = triangles.min(axis=1)
                tri_hi = triangles.max(axis=1)
                selected = triangles[
                    np.all((tri_hi >= query_lo) & (tri_lo <= query_hi), axis=1)
                ]
                material = self.doc["materials"][primitive["material"]].get(
                    "name", ""
                )
                for triangle in selected:
                    yield tuple(tuple(float(value) for value in point) for point in triangle), material


def surface_hits(geometry, x, y, start, end):
    direction = -1.0 if end < start else 1.0
    hits = []
    for triangle, material in geometry.triangles(
        (x - 1e-6, y - 1e-6, min(start, end)),
        (x + 1e-6, y + 1e-6, max(start, end)),
    ):
        a, b, c = triangle
        edge1 = tuple(b[i] - a[i] for i in range(3))
        edge2 = tuple(c[i] - a[i] for i in range(3))
        h = (-direction * edge2[1], direction * edge2[0], 0.0)
        determinant = sum(edge1[i] * h[i] for i in range(3))
        if abs(determinant) < 1e-12:
            continue
        inverse = 1.0 / determinant
        s = (x - a[0], y - a[1], start - a[2])
        u = inverse * sum(s[i] * h[i] for i in range(3))
        if u < 0.0 or u > 1.0:
            continue
        q = (
            s[1] * edge1[2] - s[2] * edge1[1],
            s[2] * edge1[0] - s[0] * edge1[2],
            s[0] * edge1[1] - s[1] * edge1[0],
        )
        v = inverse * direction * q[2]
        if v < 0.0 or u + v > 1.0:
            continue
        distance = inverse * sum(edge2[i] * q[i] for i in range(3))
        z = start + direction * distance
        if min(start, end) - 1e-7 <= z <= max(start, end) + 1e-7:
            hits.append((z, material))
    return sorted(hits, reverse=direction < 0)


def front_hit(geometry, x, y, start, end):
    hits = surface_hits(geometry, x, y, start, end)
    return hits[0] if hits else None


def triangle_count(geometry, lo, hi):
    return sum(1 for _ in geometry.triangles(lo, hi))


def verify(glb_path, config_path):
    geometry, config = Geometry(glb_path), json.loads(config_path.read_text())
    failures, probes = [], {}
    if config.get("revision") != EXPECTED_REVISION:
        failures.append(f"revision: {config.get('revision')}")
    dimensions = config.get("dimensions", {})
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
    if dimensions.get("length") != 40 or dimensions.get("endA") != -20 or dimensions.get("endB") != 20:
        failures.append(f"end dimensions: {dimensions}")
    furniture = config.get("shelfFrontFurniture", {})
    expected = {
        "lowerLecterns": 0,
        "upperDeskChairSets": 0,
        "attachedLamps": 0,
        "colliders": 0,
        "mainLongTables": 3,
        "mainBenches": 6,
        "passed": True,
    }
    if furniture != expected:
        failures.append(f"shelf furniture counts: {furniture}")

    collider_ids = {item["id"] for item in config["colliders"]}
    if any(
        name.startswith(("upper-desk-", "upper-chair-", "lectern-"))
        for name in collider_ids
    ):
        failures.append("removed furniture still has a collider")
    for required in ("end-a-portrait-wall", "end-b-picture-wall", "balcony-floor"):
        if required not in collider_ids:
            failures.append(f"missing collision {required}")
    walls = {item["id"]: item for item in config["colliders"] if item["id"] in ("end-a-wall", "end-b-wall")}
    for collider, expected in (("end-a-wall", -20.2), ("end-b-wall", 20.2)):
        if walls.get(collider, {}).get("center", {}).get("z") != expected:
            failures.append(f"{collider} was not moved outward: {walls.get(collider)}")
    end_b_pier = next(
        (item for item in config["colliders"] if item["id"] == "end-b-upper-pier-8"),
        None,
    )
    if not end_b_pier or end_b_pier.get("center", {}).get("z") != 19.0:
        failures.append(f"end B gallery pier clearance: {end_b_pier}")
    balcony_floor = next(
        (item for item in config["colliders"] if item["id"] == "balcony-floor"),
        None,
    )
    if not balcony_floor or balcony_floor.get("center", {}).get("z") != 14.95:
        failures.append(f"end B balcony must retain original projection: {balcony_floor}")

    gallery = config.get('artGallery', {})
    if gallery != {'end':'A','paintingCount':5,'sidePaintingCount':4,'removedBookcases':4,'obstructingStatues':0,'removedPilasters':6,'surroundCornices':0,'passed':True}:
        failures.append(f'art gallery contract: {gallery}')
    if any(name.startswith(('end-a-wall-cabinet-', 'end-a-bronze-niche-')) for name in collider_ids):
        failures.append('old gallery bookcase/statue collision remains')
    gallery_probes = {}
    side_painting_y = 9.8 * vertical_scale
    for x, w, h in ((-10.5,3.6,4.8),(-4.6,3.0,4.0),(4.6,3.0,4.0),(10.5,3.6,4.8)):
        painting = front_hit(geometry, x, side_painting_y, -18.8, -20.1)
        gallery_probes[str(x)] = painting
        if not painting or painting[1] != 'Canvas • gallery paintings' or abs(painting[0]+19.654)>0.002:
            failures.append(f'gallery painting missing or obstructed at {x}: {painting}')
        # Probe the complete retained canvas, including the former shelf-row
        # elevations after their architectural scaling.
        for old_y in (8.23,9.02,9.81,10.60,11.39):
            y = old_y * vertical_scale
            if abs(y-side_painting_y) >= h/2-0.15:
                continue
            for dx in (-w*.25,w*.25):
                hit = front_hit(geometry,x+dx,y,-18.8,-20.1)
                if not hit or hit[1] != 'Canvas • gallery paintings':
                    failures.append(f'gallery retains shelf board or obstruction: {x+dx}/{y}: {hit}')
        panel = next((item for item in config["colliders"] if item["id"] == f'end-a-art-panel-{x}'), None)
        if panel is None:
            failures.append(f'gallery painting collider missing: {x}')
        elif abs(panel.get("center", {}).get("y", 0) - side_painting_y) > 1e-9:
            failures.append(f'gallery painting collider did not translate with art: {x}: {panel}')

    # The expanded stair tongue must not bury the former lower-pier niches.
    for side in (-1, 1):
        x0, x1 = sorted((side * 7.7, side * 8.6))
        corner_figures = sum(1 for _triangle, material in geometry.triangles(
            (x0, gallery_y, -15.55), (x1, gallery_y + 1.0, -14.4)
        ) if material == 'Stone • carved pale scholar')
        if corner_figures or f'lower-pier-niche-{side}--15' in collider_ids:
            failures.append(f'stair-corner niche protrudes through widened landing: {side}')

    furniture_probes = {}
    # The pale scholars belong to the atrium-facing ledge. Moving them with
    # the rear wall buries their bodies in the extended crosswalk floor.
    for x in (-3.2, 3.2):
        buried_scholars = sum(
            1 for _triangle, material in geometry.triangles(
                (x - 0.5, gallery_y - .2, -18.5), (x + 0.5, gallery_y + 1.0, -16.1)
            ) if material == 'Stone • carved pale scholar'
        )
        if buried_scholars:
            failures.append(f'end A scholar protrudes through walking floor at x={x}')
    for side in (-1, 1):
        for z in (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5):
            xlo, xhi = sorted((side * 12.35, side * 13.45))
            furniture_probes[f"upper-{side}-{z}"] = triangle_count(
                geometry, (xlo, 6.35 * vertical_scale, z - 0.75), (xhi, 8.0 * vertical_scale, z + 1.65)
            )
    for side in (-1, 1):
        for z in (-5, 5, 11):
            xlo, xhi = sorted((side * 7.20, side * 8.30))
            furniture_probes[f"lower-{side}-{z}"] = triangle_count(
                geometry, (xlo, 0.1, z + 0.6), (xhi, 1.9, z + 1.5)
            )
    if any(furniture_probes.values()):
        failures.append(f"shelf-front furniture geometry remains: {furniture_probes}")

    for z in (-6.2, 2.0):
        if triangle_count(geometry, (-1.5, 1.1, z - 3.2), (1.5, 1.4, z + 3.2)) == 0:
            failures.append(f"central long table {z} was removed")

    portrait_center = 10.0 * vertical_scale
    portrait_height = 6.7
    portrait_top = portrait_center + portrait_height / 2
    portrait_shift = (vertical_scale - 1.0) * 10.0
    arch_top = 14.3 + portrait_shift
    a_high = front_hit(geometry, 0.0, arch_top - .1, -18.8, -20.1)
    a_cornice = front_hit(geometry, 0.0, 13.23 * vertical_scale, -18.8, -20.1)
    a_canvas = front_hit(geometry, 0.0, portrait_top - .1, -18.8, -20.1)
    probes["endA-high"] = a_high
    probes["endA-cornice-bay"] = a_cornice
    probes["endA-canvas"] = a_canvas
    if not a_high or not -19.35 <= a_high[0] <= -19.20 or not a_high[1].startswith("Oak"):
        failures.append(f"end A translated ornamental arch top is missing or displaced: {a_high}")
    if a_cornice and a_cornice[1].startswith("Oak"):
        failures.append(f"end A cornice still crosses portrait bay: {a_cornice}")
    if not a_canvas or "reference portrait" not in a_canvas[1]:
        failures.append(f"end A portrait is not visible below cornice: {a_canvas}")
    for x in (-1.9, 1.9):
        for y in (9.1, 10.0, 12.0):
            frame = front_hit(geometry, x, y, -18.8, -20.1)
            probes[f"endA-arch-{x}-{y}"] = frame
            if not frame or not frame[1].startswith("Oak"):
                failures.append(f"end A translated ornament is missing at {x}/{y}: {frame}")

    b_panel = front_hit(geometry, 0.0, 14.00 * vertical_scale, 18.8, 20.2)
    b_base = front_hit(geometry, 0.0, 12.24 * vertical_scale, 18.8, 20.2)
    b_hits = surface_hits(geometry, 0.0, 16.90 * vertical_scale, 20.2, 18.8)
    probes["endB-panel"] = b_panel
    probes["endB-base"] = b_base
    if not b_panel or not 19.84 <= b_panel[0] <= 19.89:
        failures.append(f"end B blind panel front is wrong: {b_panel}")
    if not b_base or b_base[0] < 19.84:
        failures.append(f"end B cornice still crosses blind panel: {b_base}")
    if any(
        19.87 < z < 19.95 and material.startswith("Walnut")
        for z, material in b_hits
    ):
        failures.append(f"end B backing panel intersects blind face: {b_hits}")

    return {
        "geometry": str(glb_path),
        "config": str(config_path),
        "revision": config.get("revision"),
        "verticalScale": vertical_scale,
        "walkingContract": {"eyeY": 1.78, "bodyRadius": config.get("crosswalk", {}).get("bodyRadius")},
        "shelfFurniture": furniture,
        "artGallery": gallery,
        "galleryRayProbes": gallery_probes,
        "furnitureTriangleProbes": furniture_probes,
        "wallRayProbes": probes,
        "requiredCollisions": ["end-a-portrait-wall", "end-b-picture-wall", "balcony-floor"],
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
    glb_path, config_path = Path(args.glb).resolve(), Path(args.config).resolve()
    report = verify(glb_path, config_path)
    report["sourceSha256"] = hashlib.sha256(glb_path.read_bytes()).hexdigest()
    report["configSha256"] = hashlib.sha256(config_path.read_bytes()).hexdigest()
    report["revision"] = json.loads(config_path.read_text())["revision"]
    report_path = root / "docs/verification/reference-library-end-walls.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps(report, indent=2))
    if not report["passed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
