"""Read the actual GLB bytes and verify the architecture export contract."""
from pathlib import Path
import struct,json,math,hashlib,sys
import numpy as np
root=Path(__file__).resolve().parents[2];assets=root/'apps/web/public/assets/hogwarts-library'
path=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
b=path.read_bytes();magic,version,length=struct.unpack_from('<4sII',b,0)
assert magic==b'glTF' and version==2 and length==len(b)
offset=12;doc=None;binary=None
while offset<len(b):
 size,kind=struct.unpack_from('<II',b,offset);payload=b[offset+8:offset+8+size];offset+=8+size
 if kind==0x4E4F534A:doc=json.loads(payload)
 if kind==0x004E4942:binary=payload
assert doc and binary
assert not doc.get('cameras')
assert not doc.get('extensions',{}).get('KHR_lights_punctual')
primitives=[p for m in doc['meshes'] for p in m['primitives']]
assert len(primitives)<=200
vertices=triangles=0;lo=[float('inf')]*3;hi=[-float('inf')]*3
for p in primitives:
 a=doc['accessors'][p['attributes']['POSITION']];vertices+=a['count'];ix=doc['accessors'][p['indices']];assert ix['count']%3==0;triangles+=ix['count']//3
 for k in range(3):lo[k]=min(lo[k],a['min'][k]);hi[k]=max(hi[k],a['max'][k])
 for attr in ('POSITION','NORMAL','TEXCOORD_0'):
  a=doc['accessors'][p['attributes'][attr]];view=doc['bufferViews'][a['bufferView']];n={'VEC2':2,'VEC3':3}[a['type']];assert a['componentType']==5126
  base=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',n*4)
  for j in range(a['count']):
   values=struct.unpack_from('<'+'f'*n,binary,base+j*stride);assert all(math.isfinite(v) for v in values)
# Validate the actual indexed triangles, not only finite attribute buffers.
degenerate_triangles=0;globe_land_primitives=0;globe_land_minimum_radius=None
for primitive in primitives:
 position=doc['accessors'][primitive['attributes']['POSITION']];pv=doc['bufferViews'][position['bufferView']]
 coords=np.ndarray((position['count'],3),dtype='<f4',buffer=binary,offset=pv.get('byteOffset',0)+position.get('byteOffset',0),strides=(pv.get('byteStride',12),4))
 index=doc['accessors'][primitive['indices']];iv=doc['bufferViews'][index['bufferView']];dtype={5121:'u1',5123:'<u2',5125:'<u4'}[index['componentType']]
 indices=np.frombuffer(binary,dtype=dtype,count=index['count'],offset=iv.get('byteOffset',0)+index.get('byteOffset',0)).reshape(-1,3)
 assert int(indices.max())<len(coords)
 for start in range(0,len(indices),100000):
  tri=coords[indices[start:start+100000]].astype(np.float64);area=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);degenerate_triangles+=int(np.count_nonzero(np.einsum('ij,ij->i',area,area)<1e-20))
 if doc['materials'][primitive['material']].get('name')=='Globe • land':
  globe_land_primitives+=1
  tri=coords[indices].astype(np.float64)-np.array([0,1.57,-11.7])
  p0,p1,p2=tri[:,0],tri[:,1],tri[:,2];u=p1-p0;v=p2-p0;n=np.cross(u,v)
  nn=np.einsum('ij,ij->i',n,n);q=n*(np.einsum('ij,ij->i',p0,n)/nn)[:,None];w=q-p0
  d00=np.einsum('ij,ij->i',u,u);d01=np.einsum('ij,ij->i',u,v);d11=np.einsum('ij,ij->i',v,v)
  d20=np.einsum('ij,ij->i',w,u);d21=np.einsum('ij,ij->i',w,v);den=d00*d11-d01*d01
  beta=(d11*d20-d01*d21)/den;gamma=(d00*d21-d01*d20)/den
  inside=(beta>=-1e-10)&(gamma>=-1e-10)&(beta+gamma<=1+1e-10)
  distance=np.full(len(tri),np.inf);distance[inside]=np.linalg.norm(q[inside],axis=1)
  for start,end in((p0,p1),(p1,p2),(p2,p0)):
   edge=end-start;t=np.clip(-np.einsum('ij,ij->i',start,edge)/np.einsum('ij,ij->i',edge,edge),0,1)
   distance=np.minimum(distance,np.linalg.norm(start+t[:,None]*edge,axis=1))
  globe_land_minimum_radius=float(distance.min())
  assert globe_land_minimum_radius>.82, 'Atlas faces intersect the base globe despite outward vertices'

assert degenerate_triangles==0, f'{degenerate_triangles} exported triangles have zero area'
assert globe_land_primitives==1, 'Globe land patches were omitted from the actual GLB'
feature_materials={}
for primitive in primitives:
 name=doc['materials'][primitive['material']].get('name','')
 if name in ('Stone • carved pale scholar','Bronze • end niche scholar','Globe • parchment','Globe • land'):
  a=doc['accessors'][primitive['attributes']['POSITION']]
  feature_materials[name]={'vertices':a['count'],'min':a['min'],'max':a['max']}
assert feature_materials['Stone • carved pale scholar']['vertices']>10000, 'Pale gallery sculpture omitted'
assert feature_materials['Bronze • end niche scholar']['vertices']>1000, 'A-end bronze sculpture omitted'
assert feature_materials['Globe • parchment']['max'][1]>2.3, 'Visible floor globe has reverted to small old model'
assert feature_materials['Globe • parchment']['min'][2]<-12.4

assert lo[0]<-15 and hi[0]>15 and 30<hi[0]-lo[0]<31.5 and lo[2]<-18 and hi[2]>18
assert hi[1]>=18.7 and hi[1]<20
config=json.loads((assets/'scene-config.json').read_text())
assert config['dimensions']['width']==30 and config['dimensions']['length']==36
assert config['dimensions']['galleryY']==6.2 and config['dimensions']['vaultCrownY']==18.7
assert config['shelves']['lower']['xMin']==9.45 and config['shelves']['upper']['xMin']==11
assert config['shelves']['lower']['baseY']==.25
assert config['shelves']['upper']['baseY']==6.45
assert config['shelves']['boardThickness']==.105
assert config['shelves']['omittedCases']==[]
for side in ('left','right'):
 r=config['stairRoutes'][side];assert r[0]['y']==0 and r[-1]['y']==6.2
 assert all(0<=p['y']<=6.2 for p in r)
summary={'file':'architecture-uncompressed.glb','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'meshes':len(doc['meshes']),'materials':len(doc['materials']),'materialPrimitives':len(primitives),'actualGltfVertices':vertices,'actualGltfTriangles':triangles,'bounds':{'min':lo,'max':hi},'embeddedImages':len(doc.get('images',[])),'externalImageUris':[i['uri'] for i in doc.get('images',[]) if 'uri' in i],'finiteAttributes':True,'noExportedLightsOrCameras':True,'catalogContractChecked':True,'zeroAreaTriangles':degenerate_triangles,'globeLandMaterialPrimitives':globe_land_primitives,'visibleFeatureMaterials':feature_materials,'globeLandMinimumTriangleRadius':globe_land_minimum_radius,'globeBaseSphereRadius':.82}
(root/'docs/verification/reference-library-source-geometry.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
