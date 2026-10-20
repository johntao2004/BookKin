#!/usr/bin/env python3
# 检查导出地球仪包围范围、单一碰撞体和脚下平台支撑，确保移位后仍是完整刚性物件。
# Checks the exported globe bounds, single collider and platform support after relocation as a complete rigid feature.
"""Verify the actual exported globe is rigid and supported on the portrait platform."""
import json
from pathlib import Path
import numpy as np
from verify_end_walls import Geometry

ROOT = Path(__file__).resolve().parents[2]
assets = ROOT/'apps/web/public/assets/hogwarts-library'
config = json.loads((assets/'scene-config.json').read_text())
geometry = Geometry(ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb')
floor_y = config['dimensions']['galleryY']
colliders = [c for c in config['colliders'] if c['id'] == 'globe']
assert len(colliders) == 1
assert colliders[0]['center'] == {'x': 0, 'y': floor_y + 1.25, 'z': -15.0}
assert colliders[0]['size'] == {'x': 2.24, 'y': 2.5, 'z': 2.24}
spheres = []
for mesh in geometry.doc['meshes']:
    for primitive in mesh['primitives']:
        material = geometry.doc['materials'][primitive['material']]['name']
        if material == 'Globe • parchment':
            spheres.append(geometry.doc['accessors'][primitive['attributes']['POSITION']])
assert len(spheres) == 1
sphere = spheres[0]
assert np.allclose(sphere['min'], [-.82, floor_y + .75, -15.82], atol=.002)
assert np.allclose(sphere['max'], [.82, floor_y + 2.39, -14.18], atol=.002)

# Probe upward-facing exported timber surfaces under all four globe feet.
supports = []
for x in (-.79/2**.5, .79/2**.5):
    for z in (-15-.79/2**.5, -15+.79/2**.5):
        heights = []
        for tri, material in geometry.triangles((x-.001, floor_y-.03, z-.001), (x+.001, floor_y+.03, z+.001)):
            if not material.startswith('Oak •'):
                continue
            a,b,c = np.asarray(tri)
            normal = np.cross(b-a,c-a)
            if normal[1] <= 1e-8:
                continue
            matrix = np.array([[b[0]-a[0],c[0]-a[0]],[b[2]-a[2],c[2]-a[2]]])
            if abs(np.linalg.det(matrix)) < 1e-9:
                continue
            u,v = np.linalg.solve(matrix, np.array([x-a[0],z-a[2]]))
            if u >= -1e-5 and v >= -1e-5 and u+v <= 1.00001:
                heights.append(float(a[1]+u*(b[1]-a[1])+v*(c[1]-a[1])))
        assert heights and any(abs(y-floor_y)<.005 for y in heights), (x,z,heights)
        supports.append({'x':x,'z':z,'floorY':min(heights,key=lambda y:abs(y-floor_y))})
report = {'revision':config['revision'],'globeCount':1,'baseY':floor_y,'sphereBounds':{'min':sphere['min'],'max':sphere['max']},'footSupport':supports,'passed':True}
(ROOT/'docs/verification/reference-library-gallery-globe.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
