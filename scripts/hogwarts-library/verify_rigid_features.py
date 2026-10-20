#!/usr/bin/env python3
# 与增高前 GLB 比较指定材质的顶点，消除约定的刚性竖移后检查尺寸；历史地球仪位置假设需与所选基线一致。
# Compares material-selected vertices with the pre-height-change GLB after prescribed rigid Y offsets; historical globe-placement assumptions must match the selected baseline.
"""Compare real exported feature coordinates with the pre-height-change GLB."""
import argparse
import hashlib
import json
import struct
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--baseline', type=Path, default=ROOT/'.local/model-baseline-r10/architecture-uncompressed.glb')
p.add_argument('--source', type=Path, default=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb')
p.add_argument('--json', type=Path, default=ROOT/'docs/verification/reference-library-rigid-features.json')
a = p.parse_args()

def read(path):
    raw = path.read_bytes()
    assert raw[:4] == b'glTF'
    n = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+n]); binary = raw[28+n:]
    positions = {}
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            accessor = doc['accessors'][primitive['attributes']['POSITION']]
            view = doc['bufferViews'][accessor['bufferView']]
            assert accessor['componentType'] == 5126
            vertices = np.ndarray((accessor['count'],3), dtype='<f4', buffer=binary,
                offset=view.get('byteOffset',0)+accessor.get('byteOffset',0),
                strides=(view.get('byteStride',12),4)).astype(np.float64)
            name = doc['materials'][primitive['material']]['name']
            positions.setdefault(name, []).append(vertices)
    return hashlib.sha256(raw).hexdigest(), {k:np.concatenate(v) for k,v in positions.items()}

baseline_sha, before = read(a.baseline)
source_sha, after = read(a.source)
assert 'Stone • carved pale scholar' in before, 'Baseline must include the removed scholars'
assert not any('scholar' in material.lower() for material in after), 'Removed statue geometry remains'
checks = []
features = [
    ('globe surface', ('Globe • parchment','Globe • land'), 0),
    ('reading desk surfaces and lamps', ('Leather • desk inset','Glass • green shade'), 0),
    ('four gallery paintings', ('Canvas • gallery paintings',), 9.8*.2),
    ('central portrait', ('Canvas • reference portrait study',), 10*.2),
]
for name, materials, shift in features:
    old = np.concatenate([before[m] for m in materials])
    new = np.concatenate([after[m] for m in materials]); new[:,1] -= shift
    # X/Z are unchanged bit-for-bit. Sort spatial samples by the unchanged
    # horizontal coordinates, then Y; tolerate only float32 translation noise.
    x=np.unique(old,axis=0);y=np.unique(new,axis=0)
    x=x[np.lexsort((x[:,1],x[:,2],x[:,0]))];y=y[np.lexsort((y[:,1],y[:,2],y[:,0]))]
    assert x.shape == y.shape and np.allclose(x,y,rtol=0,atol=.00001), (name,x.shape,y.shape,float(np.max(np.abs(x-y))) if x.shape==y.shape else None)
    checks.append({'feature':name,'uniqueSpatialSamples':len(x),'rigidYTranslation':shift,
                   'maximumExtentError':float(np.max(np.abs(np.ptp(old,axis=0)-np.ptp(new,axis=0)))),
                   'coordinatesEqualAtTolerance':.00001,'passed':True})
report = {'passed':True,'baselineSha256':baseline_sha,'sourceSha256':source_sha,
          'method':'Actual exported GLB material-space coordinates; unique samples after rigid anchor translation',
          'features':checks,'removedSculptureMaterialsAbsent':True}
a.json.parent.mkdir(parents=True,exist_ok=True);a.json.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
