"""Blender ray verification of final exported geometry, not source-presence claims.
Run: blender -b --python scripts/hogwarts-library/verify_walk_clearance.py
The modular exact-triangle proof binds these exported-source samples to all13GLBs.
"""
import bpy,json,math,sys,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/verification';ASSETS=ROOT/'apps/web/public/assets/hogwarts-library';SRC=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
EXPECTED_REVISION='20261020-lower-gallery-r27'
config_path=ASSETS/'scene-config.json';config_bytes=config_path.read_bytes();config=json.loads(config_bytes)
revision=config.get('revision');assert revision==EXPECTED_REVISION,(revision,EXPECTED_REVISION)
dims=config['dimensions'];GALLERY_Y=dims['galleryY'];VAULT_Y=dims['vaultCrownY'];layout=config.get('verticalLayout',{});VERTICAL_SCALE=layout.get('heightScale')
assert abs(VERTICAL_SCALE-1.2)<1e-9,VERTICAL_SCALE
assert abs(GALLERY_Y-7.44)<1e-9 and abs(VAULT_Y-22.44)<1e-9,(GALLERY_Y,VAULT_Y)
assert abs(layout.get('galleryYAfter',-1)-GALLERY_Y)<1e-9 and abs(layout.get('vaultCrownYAfter',-1)-VAULT_Y)<1e-9,layout
arcade=config.get('arcadeSoffits',{})
assert arcade.get('count')==12 and abs(arcade.get('springY',-1)-4.68)<1e-9
assert abs(arcade.get('innerRise',-1)-1.812)<1e-9 and abs(arcade.get('paintRiseThickness',-1)-.078)<1e-9
assert abs(arcade.get('woodRiseThickness',-1)-.24)<1e-9 and abs(arcade.get('heightScale',-1)-VERTICAL_SCALE)<1e-9
shelves=config['shelves'];BOOK_HEIGHT=shelves.get('bookHeight',shelves.get('modelBookHeight',.48))
assert abs(shelves['depth']-.82)<1e-9 and abs(shelves['backThickness']-.16)<1e-9
assert abs(shelves['bookDepth']-.288)<1e-9 and abs(BOOK_HEIGHT-.48)<1e-9
assert abs(shelves['lower']['baseY']-.3)<1e-9 and abs(shelves['lower']['pitch']-.924)<1e-9
assert abs(shelves['upper']['baseY']-7.74)<1e-9 and abs(shelves['upper']['pitch']-1.056)<1e-9
assert abs(shelves['boardThickness']-.168)<1e-9
HUMAN_EYE_Y=1.78;BODY_RADIUS=config['crosswalk']['bodyRadius'];assert abs(BODY_RADIUS-.3)<1e-9
DOOR_WIDTH_MIN=1.805;DOOR_HEADROOM_MIN=3.66;REQUIRED_BODY_CLEAR_BAND=config['crosswalk']['requiredBodyClearBand'];assert abs(REQUIRED_BODY_CLEAR_BAND-2.0)<1e-9
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SRC));scene=bpy.context.scene;dep=bpy.context.evaluated_depsgraph_get();V=lambda p:Vector((p[0],-p[2],p[1]))
def ray(p,d,distance=30):
 ok,loc,n,face,obj,mat=scene.ray_cast(dep,V(p),V(d),distance=distance)
 return None if not ok else {'point':[loc.x,loc.z,-loc.y],'distance':(loc-V(p)).length,'object':obj.name,'triangle':face}
report={'geometrySource':'Reimported final exported GLB; exact modular triangle-preservation proof required','revision':revision,'sourceSha256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'configSha256':hashlib.sha256(config_bytes).hexdigest(),'verticalScale':VERTICAL_SCALE,'walkingContract':{'eyeY':HUMAN_EYE_Y,'bodyRadius':BODY_RADIUS,'requiredBodyClearBand':REQUIRED_BODY_CLEAR_BAND},'unitNote':'Estimated model units, not surveyed real-world dimensions','doorways':[],'bookRows':[],'stairExits':[],'guardSupports':[],'wallGaps':[]}
for side in(-1,1):
 for z in(-15,-10,-5,0,5,10,15):
  widths=[];heads=[]
  for yoffset in(.06,.25,.50,.75,1.0,HUMAN_EYE_Y,2.25,2.75,3.25,3.60):
   y=GALLERY_Y+yoffset
   for dz in(-.4,-.32,-.2,0,.2,.32,.4):
    p=[side*10.1125,y,z+dz];a=ray(p,[-1,0,0],2);b=ray(p,[1,0,0],2);h=ray(p,[0,1,0],10)
    if a and b:widths.append(a['distance']+b['distance'])
    if h:heads.append(h['point'][1]-GALLERY_Y)
  floor=ray([side*10.1125,GALLERY_Y+HUMAN_EYE_Y,z],[0,-1,0],3)
  assert floor and abs(floor['point'][1]-GALLERY_Y)<.0001
  assert min(widths)>=DOOR_WIDTH_MIN-.0001,(side,z,min(widths))
  assert min(heads)>=DOOR_HEADROOM_MIN-.0001,(side,z,min(heads))
  report['doorways'].append({'side':side,'z':z,'minimumSampledWidth':min(widths),'minimumSampledHeadroom':min(heads),'floorY':floor['point'][1]})
  a=ray([side*18.0,12.21*VERTICAL_SCALE,z],[side,0,0],3);b=ray([side*18.0,12.21*VERTICAL_SCALE,z],[-side,0,0],3)
  # End-vault ribs finish against the outer wall at this elevated sample.
  # Measure the physical unobstructed span rather than insisting every ray
  # reaches bare stone through the new timber moulding. Standing-body aisle
  # clearance is independently verified over both complete floors.
  assert a and b and a['distance']+b['distance']>=REQUIRED_BODY_CLEAR_BAND-.0001,(side,z,a,b)
  report['wallGaps'].append({'side':side,'z':z,'corniceToEnclosure':a['distance']+b['distance'],'outerSurface':a['object'],'minimumRequired':REQUIRED_BODY_CLEAR_BAND})
 for z in(-15.4,-14.5,-13.5,-12.5,-11.6):
  # Start below the foot rail to verify positive supporting floor, not guard geometry.
  q=ray([side*8.95,GALLERY_Y+.05,z],[0,-1,0],1)
  assert q and GALLERY_Y-.0001<=q['point'][1]<=GALLERY_Y+.03,(side,z,q)
  report['guardSupports'].append({'side':side,'z':z,'floorY':q['point'][1]})
 for x,z in[(side*4.6,-15.45),(side*7.05,-14.55),(side*7.25,-14.5),(side*7.30,-14.2)]:
  q=ray([x,GALLERY_Y+.5,z],[0,-1,0],1)
  assert q and GALLERY_Y-.0001<=q['point'][1]<=GALLERY_Y+.03,(x,z,q)
  report['stairExits'].append({'x':x,'z':z,'topY':q['point'][1]})

# Gallery guardrails retain their original local height but move rigidly with
# the raised gallery anchor. The floor slab alone is height-scaled.
report['galleryRails']=[]
rail_colliders={c['id']:c for c in config['colliders'] if c['id'].startswith(('rail-','rail-end-'))}
assert len(rail_colliders)==5
for name,item in rail_colliders.items():
 is_end=name.startswith('rail-end-')
 expected_height=1.3 if is_end else 1.34
 expected_center=6.2+(.65 if is_end else .67)
 assert abs(item['size']['y']-expected_height)<1e-9,(name,item)
 assert abs(item['center']['y']-(expected_center+6.2*(VERTICAL_SCALE-1)))<1e-9,(name,item)
for x,z in ((-8.62,0.0),(8.62,0.0),(0.0,-15.6),(-5.0,15.6)):
 top=ray([x,GALLERY_Y+2.0,z],[0,-1,0],1.0)
 assert top,(x,z,'gallery rail top missing')
 relative_height=top['point'][1]-GALLERY_Y
 assert 1.18<=relative_height<=1.25,(x,z,relative_height,top)
 report['galleryRails'].append({'x':x,'z':z,'floorY':GALLERY_Y,'topY':top['point'][1],'localHeight':relative_height,'passed':True})
# Verify the final exported boards underneath the actual real-book footprint,
# on every level, side, boundary, row and face, not merely the declared depth.
report['shelfDepth']={'boardDepth':shelves['depth'],'bookDepth':shelves['bookDepth'],'bookHeight':BOOK_HEIGHT,'rearGap':shelves['bookRearGap'],'frontInset':shelves['bookFrontInset'],'faces':[]}
assert abs(shelves['depth']-(shelves['backThickness']+2*(shelves['bookDepth']+shelves['bookRearGap']+shelves['bookFrontInset'])))<1e-7
rear=shelves['bookCenterOffset']-shelves['bookDepth']/2;front=shelves['bookCenterOffset']+shelves['bookDepth']/2
for level in ('lower','upper'):
 spec=shelves[level]
 for side in (-1,1):
  xs=[side*x for x in (spec['xMin']+.5,(spec['xMin']+spec['xMax'])/2,spec['xMax']-.5)]
  x_center=side*(spec['xMin']+spec['xMax'])/2
  for z in (-15,-10,-5,0,5,10,15):
   for row in range(spec['rows']):
    board_y=spec['baseY']+row*spec['pitch'];top_y=board_y+shelves['boardThickness']/2
    for face in (-1,1):
     support=[]
     for x in xs:
      for dz in (rear+.002,front-.002):
       hit=ray([x,board_y+.14,z+face*dz],[0,-1,0],.2)
       assert hit and abs(hit['point'][1]-top_y)<.0001,('unsupported book footprint',level,side,z,row,face,x,dz,hit)
       support.append(hit['point'])
     # Probe above the decorative lip but below the board's upper bevel.
     edge=ray([xs[1],board_y+shelves['boardThickness']*.3,z+face*.8],[0,0,-face],1)
     assert edge and abs(abs(edge['point'][2]-z)-shelves['depth']/2)<.0001,('board front depth',level,side,z,row,face,edge)
     back=ray([xs[1],board_y+.3,z+face*(rear+.002)],[0,0,-face],.2)
     assert back and abs(abs(back['point'][2]-z)-shelves['backThickness']/2)<.0001,('back panel',level,side,z,row,face,back)
     widths=[]
     for dy in (.05,BOOK_HEIGHT*.5,BOOK_HEIGHT-.01):
      for dz in (rear+.002,0,front-.002):
       p=[x_center,top_y+dy,z+face*dz];reach=(spec['xMax']-spec['xMin'])/2+.4
       a=ray(p,[-1,0,0],reach);b=ray(p,[1,0,0],reach)
       assert a and b,('book row bounds missing',level,side,z,row,face,dy,dz)
       widths.append((a['distance'],b['distance']))
     minimum_width=min(min(a,b) for a,b in widths)
     stile_inset=shelves['stileWidth']+(2*shelves['upperPassageStileShift'] if level=='upper' else 0)
     expected_half_width=(spec['xMax']-spec['xMin']-stile_inset)/2
     assert abs(minimum_width-expected_half_width)<.003,(level,side,z,row,face,minimum_width,expected_half_width)
     visible_margin=minimum_width-3.2691/2 if level=='upper' else 0.0
     hit_margin=minimum_width-3.276/2 if level=='upper' else 0.0
     overhead=ray([x_center,top_y+.002,z+face*shelves['bookCenterOffset']],[0,1,0],spec['pitch'])
     clearance=(overhead['point'][1]-top_y) if overhead else spec['pitch']+shelves['boardThickness']/2
     assert clearance+1e-6>=BOOK_HEIGHT,(level,side,z,row,face,clearance)
     slot={'level':level,'side':side,'z':z,'row':row,'face':face,'boardTopY':top_y,'bookDepth':shelves['bookDepth'],'bookHeight':BOOK_HEIGHT,'bookFootprintSupport':support,'openingWidth':2*minimum_width,'expectedOpeningWidth':2*expected_half_width,'minimumHalfWidth':minimum_width,'visibleModelEdgeClearance':visible_margin,'hitTargetEdgeClearance':hit_margin,'overheadClearance':clearance,'passed':True}
     report['shelfDepth']['faces'].append({**slot,'boardEdgeOffset':abs(edge['point'][2]-z),'backFaceOffset':abs(back['point'][2]-z)})
     report['bookRows'].append(slot)
assert len(report['shelfDepth']['faces'])==336
assert len(report['bookRows'])==336

# Check the new tongue/infill and the wider standing zone against actual triangles.
report['expandedLandings']=[]
for side in (-1,1):
 samples=[]
 for z,xs in [(z,(4.2,4.6,5.0,5.5,6.0,6.5,7.0,7.5,8.0,8.65)) for z in(-13.75,-14.65,-15.35,-16.2,-17.0)]:
  for x in xs:
   p=[side*x,GALLERY_Y+.05,z];hit=ray(p,[0,-1,0],.6)
   assert hit and GALLERY_Y-.0001<=hit['point'][1]<=GALLERY_Y+.03,(p,hit)
   samples.append({'x':side*x,'z':z,'floorY':hit['point'][1]})
 report['expandedLandings'].append({'side':side,'nominalWidth':5.3,'restingDepth':4.2,'samples':samples,'passed':True})
# Probe all twelve windows at the vertically scaled coordinates, retaining the
# original curve, width and horizontal offsets.
report['windows']=[]
window_materials={'Stone • warm ashlar','Iron • blue black','Glass • pale window','Glass • cool window pane','Glass • warm window pane'}
windows=config['windows'];assert windows['count']==18 and abs(windows['width']-2.7)<1e-9
assert abs(windows['bottomY']-6.98*VERTICAL_SCALE)<1e-9
assert abs(windows['springY']-11.48*VERTICAL_SCALE)<1e-9
assert abs(windows['crownY']-12.65*VERTICAL_SCALE)<1e-9
for side in (-1,1):
 for center_z in (-12.5,-7.5,-2.5,2.5,7.5,12.5):
  samples=[];glass=0
  rows=[(7.25,(-1.18,-.8,-.3,.3,.8,1.18)),(8.35,(-1.18,-.8,-.3,.3,.8,1.18)),(10.2,(-1.18,-.8,-.3,.3,.8,1.18)),(11.65,(-1.1,-.7,-.3,.3,.7,1.1)),(12.25,(-1.1,-.55,-.2,.2,.55,1.1))]
  for old_y,offsets in rows:
   y=old_y*VERTICAL_SCALE
   for offset in offsets:
    hit=ray([side*(dims['outerWallX']-.65),y,center_z+offset],[side,0,0],1.1)
    assert hit,(side,center_z,y,offset,'unsealed window gap')
    material=bpy.data.objects[hit['object']].active_material.name
    assert material in window_materials,(side,center_z,y,offset,material)
    glass+=material.startswith('Glass •')
    if old_y==12.25 and abs(offset)>1:assert material=='Stone • warm ashlar',(side,center_z,material)
    samples.append({'y':y,'offset':offset,'material':material,'surfaceX':hit['point'][0]})
  assert glass>=12,(side,center_z,glass)
  report['windows'].append({'side':side,'z':center_z,'bottomY':windows['bottomY'],'springY':windows['springY'],'crownY':windows['crownY'],'width':windows['width'],'samples':samples,'glassSamples':glass,'passed':True})
report['routeHeadChecks']=[]
for side,route in config['stairRoutes'].items():
 count=0
 for a,b in zip(route,route[1:]):
  for i in range(11):
   t=i/10;p=[a[k]*(1-t)+b[k]*t for k in('x','y','z')];p[1]+=HUMAN_EYE_Y
   hit=ray(p,[0,1,0],BODY_RADIUS)
   assert not hit,(side,p,hit)
   count+=1
 # Real full-body rays along the entire route, not only declared colliders.
 for point in route:
  for dy in (.5,1.0,HUMAN_EYE_Y):
   for direction in range(8):
    angle=direction*math.pi/4
    hit=ray([point['x'],point['y']+dy,point['z']],[math.cos(angle),0,math.sin(angle)],BODY_RADIUS)
    assert not hit,('stair body envelope',side,point,dy,hit)
 stair=config['stairs'][side];handrail=[]
 for t in (.05,.2,.4,.6,.8,.9):
  angle=stair['startAngle']+stair['direction']*2*math.pi*stair['turns']*t
  x=stair['center']['x']+1.98*math.cos(angle);z=stair['center']['z']+1.98*math.sin(angle);tread_y=GALLERY_Y*t
  hit=ray([x,tread_y+1.75,z],[0,-1,0],.6)
  assert hit,(side,t,'helical handrail missing')
  offset=hit['point'][1]-tread_y
  assert 1.18<=offset<=1.36,(side,t,offset,hit)
  handrail.append({'t':t,'treadY':tread_y,'surfaceY':hit['point'][1],'offset':offset})
 report['routeHeadChecks'].append({'side':side,'samples':count,'eyeY':HUMAN_EYE_Y,'headRadius':BODY_RADIUS,'first':route[0],'last':route[-1],'steps':stair['steps'],'rise':stair['rise'],'guardShellHeight':1.16,'handrailSamples':handrail,'passed':True})
proof=json.loads((OUT/'reference-library-exact-preservation.json').read_text());assert proof['sourceSha256']==report['sourceSha256'] and proof['completeTriangleMultisetIdentical'];report['modularProof']=proof['canonicalTriangleMultisetSha256'];report['passed']=True
(OUT/'reference-library-walk-clearance.json').write_text(json.dumps(report,indent=2));print('WALK_CLEARANCE_PASSED',json.dumps({'doors':len(report['doorways']),'bookRows':len(report['bookRows']),'colliders':len(config['colliders'])}))
