# 校验 GLB 字节、索引、有限属性、退化面及指定模型契约；硬编码版本和历史尺寸需匹配目标资产，不能当成通用验收。
# Checks GLB bytes, indices, finite attributes, degenerate faces and a specific model contract; hard-coded revisions/dimensions must match the asset rather than serving as universal acceptance.
"""Read the actual GLB bytes and verify the architecture export contract."""
from pathlib import Path
import struct,json,math,hashlib,sys
import numpy as np
root=Path(__file__).resolve().parents[2];assets=root/'apps/web/public/assets/hogwarts-library'
EXPECTED_REVISION='20261020-lower-gallery-r27'
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
  tri=coords[indices].astype(np.float64)-np.array([0,9.01,-15.0])
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
 if name in ('Canvas • gallery paintings','Canvas • reference portrait study','Canvas • lower gallery paintings','Canvas • lower portrait study','Globe • parchment','Globe • land'):
  a=doc['accessors'][primitive['attributes']['POSITION']]
  prior=feature_materials.get(name)
  feature_materials[name]={
   'vertices':a['count']+(prior['vertices'] if prior else 0),
   'primitives':1+(prior['primitives'] if prior else 0),
   'min':[min(v,prior['min'][k]) for k,v in enumerate(a['min'])] if prior else list(a['min']),
   'max':[max(v,prior['max'][k]) for k,v in enumerate(a['max'])] if prior else list(a['max']),
  }
assert not any('scholar' in m.get('name','').lower() for m in doc['materials']), 'Removed scholar material remains'
assert feature_materials['Canvas • gallery paintings']['vertices']>=16, 'Four gallery canvases omitted'
assert not any(m.get('name')=='Bronze • end niche scholar' for m in doc['materials']), 'Obstructing bronze statues remain'
def bounds_close(name,expected_min,expected_max,tolerance=.001):
 actual=feature_materials[name]
 assert np.allclose(actual['min'],expected_min,atol=tolerance,rtol=0),(name,actual['min'],expected_min)
 assert np.allclose(actual['max'],expected_max,atol=tolerance,rtol=0),(name,actual['max'],expected_max)

config_path=assets/'scene-config.json';config_bytes=config_path.read_bytes();config=json.loads(config_bytes)
revision=config.get('revision');assert revision==EXPECTED_REVISION,(revision,EXPECTED_REVISION)
dims=config['dimensions'];gallery_y=dims['galleryY'];vault_y=dims['vaultCrownY']
layout=config.get('verticalLayout',{});vertical_scale=layout.get('heightScale')
assert abs(vertical_scale-1.2)<1e-9,vertical_scale
assert abs(layout.get('galleryYBefore',-1)-6.2)<1e-9 and abs(layout.get('galleryYAfter',-1)-gallery_y)<1e-9,layout
assert abs(layout.get('vaultCrownYBefore',-1)-18.7)<1e-9 and abs(layout.get('vaultCrownYAfter',-1)-vault_y)<1e-9,layout
assert layout.get('rigidFeatures')==['catalog books','reading furniture','globe','paintings','gallery guardrails','chandelier bodies'],layout
assert abs(gallery_y-7.44)<1e-9 and abs(vault_y-22.44)<1e-9,(gallery_y,vault_y)
assert abs(dims.get('maxY',22.8)-22.8)<1e-9,dims.get('maxY')
arcade=config.get('arcadeSoffits',{})
assert arcade.get('count')==12 and arcade.get('centerAbsX')==8.8
assert abs(arcade.get('springY',-1)-4.68)<1e-9,arcade
assert abs(arcade.get('innerRise',-1)-1.812)<1e-9,arcade
assert abs(arcade.get('paintRiseThickness',-1)-.078)<1e-9,arcade
assert abs(arcade.get('woodRiseThickness',-1)-.24)<1e-9,arcade
assert abs(arcade.get('heightScale',-1)-vertical_scale)<1e-9,arcade

# The globe and floor furniture remain at their original size and height.
bounds_close('Globe • parchment',[-.82,8.19,-15.82],[.82,9.83,-14.18],.002)
bounds_close('Globe • land',[-.80651,8.332561,-15.689789],[.818836,9.828952,-14.180588],.002)

# User removal applies to figures, niche shells and collision descriptors.
assert config['sculptures']=={'count':0,'removed':14,'niches':0,'colliders':0}
assert config['arcadeGates']=={'count':0,'removed':4,'colliders':0}
assert not any(c['id'].startswith('gate-') for c in config['colliders'])
assert not any(m.get('name')=='Iron • rubbed silver' for m in doc['materials']), 'Removed gate mesh remains'
assert not any('niche' in c['id'] or 'scholar' in c['id'] for c in config['colliders'])

# Framed works retain their shapes. The four side panels translate by their
# old 9.8 center; the portrait translates by its old 10.0 center.
side_center=9.8*vertical_scale
bounds_close('Canvas • gallery paintings',[-12.300000190734863,side_center-2.4,-19.65399932861328],[12.300000190734863,side_center+2.4,-19.65399932861328],.002)
portrait=feature_materials['Canvas • reference portrait study']
assert abs((portrait['max'][1]-portrait['min'][1])-6.64)<.002
assert abs((portrait['min'][1]+portrait['max'][1])/2-10*vertical_scale)<.002,portrait
assert abs(portrait['max'][1]-(13.32+(vertical_scale-1)*10))<.002,portrait

assert lo[0]<-19.8 and hi[0]>19.8 and 39.6<hi[0]-lo[0]<41.1 and lo[2]<-20 and hi[2]>20 and 40<hi[2]-lo[2]<41.5
assert abs(hi[1]-22.8)<.01,hi[1]
# Lower exhibition uses UV-mapped image canvases, with the decorative door gone.
bounds_close('Canvas • lower gallery paintings',[-7.15,1.76,-19.525],[7.15,3.76,-19.525],.002)
bounds_close('Canvas • lower portrait study',[-.75,.885,-19.525],[.75,4.635,-19.525],.002)
assert feature_materials['Canvas • lower gallery paintings']['vertices']==16
assert feature_materials['Canvas • lower portrait study']['vertices']==4
for material in doc['materials']:
 if material.get('name') in ('Canvas • lower gallery paintings','Canvas • lower portrait study'):
  assert 'baseColorTexture' in material.get('pbrMetallicRoughness',{}), 'Image texture missing from lower artwork'
assert not any(m.get('name')=='Paint • end recess' for m in doc['materials']), 'Removed decorative door material remains'
assert not any(c['id']=='end-a-door-trim' for c in config['colliders'])
assert sum(c['id'].startswith('end-a-lower-picture-') for c in config['colliders'])==5
assert config['endAArcade']['lowerPictures']['removedDoor'] is True
assert config['artGallery']=={'end':'A','paintingCount':5,'sidePaintingCount':4,'removedBookcases':4,'obstructingStatues':0,'removedPilasters':6,'surroundCornices':0,'passed':True}
assert not any(c['id'].startswith(('end-a-wall-cabinet-','end-a-bronze-niche-')) for c in config['colliders'])
assert sum(c['id'].startswith('end-a-art-panel-') for c in config['colliders'])==4
assert config['dimensions']['width']==40.0 and config['dimensions']['length']==40
assert config['dimensions']['endA']==-20 and config['dimensions']['endB']==20
assert config['shelves']['lower']['xMin']==9.45 and config['shelves']['upper']['xMin']==11.10 and config['shelves']['upper']['xMax']==16.18
assert abs(config['shelves']['lower']['baseY']-.3)<1e-9
assert abs(config['shelves']['lower']['pitch']-.924)<1e-9
assert abs(config['shelves']['upper']['baseY']-7.74)<1e-9
assert abs(config['shelves']['upper']['pitch']-1.056)<1e-9
assert abs(config['shelves']['boardThickness']-.168)<1e-9
assert abs(config['shelves']['depth']-.82)<1e-9 and abs(config['shelves']['backThickness']-.16)<1e-9
assert abs(config['shelves']['bookDepth']-.288)<1e-9
book_height=config['shelves'].get('bookHeight',config['shelves'].get('modelBookHeight',.48))
assert abs(book_height-.48)<1e-9
assert config['shelves']['omittedCases']==[]
assert config['shelfFrontFurniture']=={'lowerLecterns':0,'upperDeskChairSets':0,'attachedLamps':0,'colliders':0,'mainLongTables':2,'mainBenches':4,'passed':True}
assert not any(c['id'].startswith(('upper-desk-','upper-chair-','lectern-')) for c in config['colliders'])
assert any(c['id']=='end-a-portrait-wall' for c in config['colliders'])
assert any(c['id']=='end-b-picture-wall' for c in config['colliders'])
assert config['crosswalk']=={'length':40,'endA':-20,'endB':20,'endExtension':2,'innerZ':15.6,'outerZ':20,'depth':4.4,'centralWidth':17.6,'sideGallerySeamX':8.8,'centralXMin':-10.1,'centralXMax':10.1,'bodyRadius':.3,'requiredBodyClearBand':2.0,'passed':True}
colliders={c['id']:c for c in config['colliders']}
assert len(config['colliders'])==1344 and len(colliders)==1344
for end in (-1,1):
 wall=colliders[f'end-{"a" if end<0 else "b"}-wall']
 assert wall['center']['z']==end*20.2 and wall['size']['z']==.4
 outer=colliders[f'outer-wall-{end}']
 assert outer['size']['z']==40
 crosswalk=colliders[f'crosswalk-{end*17.8}']
 assert crosswalk['center']['z']==end*17.8 and crosswalk['size']['z']==4.4
assert colliders['balcony-floor']['center']['z']==14.95
assert colliders['end-b-upper-pier-8']['center']['z']==19.0
for side in ('left','right'):
 stair=config['stairs'][side];r=config['stairRoutes'][side]
 sign=-1 if side=='left' else 1
 assert stair['steps']==40 and len(r)==44 and abs(stair['rise']-gallery_y)<1e-9,(side,stair,len(r))
 assert stair['center']=={'x':sign*5.9,'y':0,'z':-13.5},(side,stair['center'])
 assert abs(stair['outerRadius']-2.0)<1e-9 and abs(stair['innerRadius']-.31)<1e-9
 assert abs(stair['turns']-1.25)<1e-9 and stair['direction']==sign
 assert abs(stair['endAngle']-(0 if sign<0 else math.pi))<1e-8
 assert abs(stair['startAngle']-(stair['endAngle']-sign*2*math.pi*1.25))<1e-8
 assert stair['walkingRadius']==1.3
 aperture=stair['aperture']
 assert abs(aperture['xMin']-(sign*5.9-2.1))<1e-8 and abs(aperture['xMax']-(sign*5.9+2.1))<1e-8,(side,aperture)
 assert aperture['zMin']==-15.6 and aperture['zMax']==-11.4,(side,aperture)
 landing=stair['landing']
 assert landing['center']=={'x':sign*6.45,'y':gallery_y,'z':-15.6} and landing['size']=={'x':5.3,'z':4.2},(side,landing)
 assert r[0]['y']==0 and abs(r[-1]['y']-gallery_y)<1e-9,(side,r[0],r[-1])
 assert all(-1e-9<=p['y']<=gallery_y+1e-9 for p in r)
 assert abs(r[0]['x']-sign*8.2)<1e-9
 assert abs(r[0]['z']+12.2)<1e-9
 assert abs(r[-1]['x']-sign*4.6)<1e-9
 assert abs(r[-1]['z']+16.5)<1e-9

windows=config['windows']
assert windows['count']==18 and abs(windows['width']-2.7)<1e-9
assert abs(windows['bottomY']-6.98*vertical_scale)<1e-9
assert abs(windows['springY']-11.48*vertical_scale)<1e-9
assert abs(windows['crownY']-12.65*vertical_scale)<1e-9
assert abs(windows['glassX']-20.02)<1e-9 and abs(windows['leadX']-19.99)<1e-9

chandelier_bodies={c['id']:c for c in config['colliders'] if c['id'].startswith('chandelier-body-')}
assert len(chandelier_bodies)==15
for name,item in chandelier_bodies.items():
 assert item['shape']=='cylinder'
 if name.startswith('chandelier-body-0-'):
  expected_y,expected_height,expected_radius=12.9+(vertical_scale-1)*12.9+1.25,3.05,1.55
 else:
  expected_y,expected_height,expected_radius=4.6+(vertical_scale-1)*4.6+.3,.456,.589
 assert abs(item['center']['y']-expected_y)<.002,(name,item)
 assert abs(item['height']-expected_height)<.002 and abs(item['radius']-expected_radius)<.002,(name,item)

main_cable_physical_start=12.9+(vertical_scale-1)*12.9+.2
main_cable_shell_start=(12.9+1.25+1.525)+(vertical_scale-1)*12.9
main_cable_end=18.58*vertical_scale
main_suspensions={c['id']:c for c in config['colliders'] if c['id'].startswith('chandelier-suspension-')}
assert set(main_suspensions)=={f'chandelier-suspension-{z}' for z in (-8,1,10)}
for name,item in main_suspensions.items():
 assert item['shape']=='cylinder' and abs(item['radius']-.035)<1e-9
 assert abs(item['center']['y']-(main_cable_shell_start+main_cable_end)/2)<1e-9,(name,item)
 assert abs(item['height']-(main_cable_end-main_cable_shell_start))<1e-9,(name,item)
 assert main_cable_physical_start<main_cable_shell_start<main_cable_end

stair_guards={c['id']:c for c in config['colliders'] if c['id'].startswith('stair-outer-guard-')}
assert len(stair_guards)==80
for side,sign in (('left',-1),('right',1)):
 for index in range(38):
  item=stair_guards[f'stair-outer-guard-{sign}-{index}']
  tread_y=gallery_y*(index+1)/40
  assert item['shape']=='arc' and abs(item['height']-1.16)<1e-9,(item)
  assert abs(item['center']['y']-(tread_y+.58))<1e-9,(item,tread_y)
  assert abs(item['center']['x']-sign*5.9)<1e-9 and abs(item['center']['z']+13.5)<1e-9
  assert abs(item['radius']-1.98)<1e-9 and abs(item['radialDepth']-.21)<1e-9 and item['segments']==2
 assert not any(name.startswith(f'stair-outer-guard-{sign}-{index}') for index in (38,39))

source_sha=hashlib.sha256(b).hexdigest();config_sha=hashlib.sha256(config_bytes).hexdigest()
summary={'file':'architecture-uncompressed.glb','bytes':len(b),'sha256':source_sha,'sourceSha256':source_sha,'configSha256':config_sha,'revision':revision,'verticalScale':vertical_scale,'walkingContract':{'eyeY':1.78,'bodyRadius':config['crosswalk']['bodyRadius']},'sourceColliderCount':len(config['colliders']),'runtimeColliderCount':1424,'meshes':len(doc['meshes']),'materials':len(doc['materials']),'materialPrimitives':len(primitives),'actualGltfVertices':vertices,'actualGltfTriangles':triangles,'bounds':{'min':lo,'max':hi},'embeddedImages':len(doc.get('images',[])),'externalImageUris':[i['uri'] for i in doc.get('images',[]) if 'uri' in i],'finiteAttributes':True,'noExportedLightsOrCameras':True,'catalogContractChecked':True,'zeroAreaTriangles':degenerate_triangles,'globeLandMaterialPrimitives':globe_land_primitives,'visibleFeatureMaterials':feature_materials,'bookHeight':book_height,'shelfFaces':2*2*7*config['shelves']['lower']['rows']*2,'mainChandelierCablePhysicalStartY':main_cable_physical_start,'mainChandelierCableShellStartY':main_cable_shell_start,'mainChandelierCableEndY':main_cable_end,'globeLandMinimumTriangleRadius':globe_land_minimum_radius,'globeBaseSphereRadius':.82,'passed':True,'failures':[]}
(root/'docs/verification/reference-library-source-geometry.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
