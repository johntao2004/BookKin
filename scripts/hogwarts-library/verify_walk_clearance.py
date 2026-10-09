"""Blender ray verification of final exported geometry, not source-presence claims.
Run: blender -b --python scripts/hogwarts-library/verify_walk_clearance.py
The modular exact-triangle proof binds these exported-source samples to all13GLBs.
"""
import bpy,json,math,sys,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/verification';ASSETS=ROOT/'apps/web/public/assets/hogwarts-library';SRC=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SRC));scene=bpy.context.scene;dep=bpy.context.evaluated_depsgraph_get();V=lambda p:Vector((p[0],-p[2],p[1]))
def ray(p,d,distance=30):
 ok,loc,n,face,obj,mat=scene.ray_cast(dep,V(p),V(d),distance=distance)
 return None if not ok else {'point':[loc.x,loc.z,-loc.y],'distance':(loc-V(p)).length,'object':obj.name,'triangle':face}
report={'geometrySource':'Reimported final exported GLB; exact modular triangle-preservation proof required','sourceSha256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'unitNote':'Estimated model units, not surveyed real-world dimensions','doorways':[],'bookRows':[],'stairExits':[],'guardSupports':[],'wallGaps':[]}
for side in(-1,1):
 for z in(-15,-10,-5,0,5,10,15):
  widths=[];heads=[]
  for y in(6.25,6.4,6.55,6.7,7.2,7.98,8.28):
   for dz in(-.4,-.32,-.2,0,.2,.32,.4):
    p=[side*10.1125,y,z+dz];a=ray(p,[-1,0,0],2);b=ray(p,[1,0,0],2);h=ray(p,[0,1,0],10)
    if a and b:widths.append(a['distance']+b['distance'])
    if h:heads.append(h['point'][1]-6.2)
  floor=ray([side*10.1125,7.98,z],[0,-1,0],3)
  assert floor and abs(floor['point'][1]-6.2)<.0001
  assert min(widths)>=1.8049,(side,z,min(widths))
  assert min(heads)>=3.0499,(side,z,min(heads))
  report['doorways'].append({'side':side,'z':z,'minimumSampledWidth':min(widths),'minimumSampledHeadroom':min(heads),'floorY':floor['point'][1]})
  for row in range(6):
   bounds=[]
   for dy in(.06,.2925,.53):
    for face in(-1,1):
     for dz in(.067,.208,.349):
      p=[side*12.84,6.45+row*.88+dy,z+face*dz];a=ray(p,[-1,0,0],2);b=ray(p,[1,0,0],2)
      assert a and b,(side,z,row,p)
      bounds.append((a['distance'],b['distance']))
   minimum=min(min(a,b) for a,b in bounds);visible_margin=minimum-3.2691/2;hit_margin=minimum-3.276/2
   assert visible_margin>.01 and hit_margin>.01,(side,z,row,minimum,visible_margin,hit_margin)
   report['bookRows'].append({'side':side,'z':z,'row':row,'minimumHalfWidth':minimum,'visibleModelEdgeClearance':visible_margin,'hitTargetEdgeClearance':hit_margin})
  a=ray([side*14.86,12.21,z],[side,0,0],1);b=ray([side*14.86,12.21,z],[-side,0,0],1)
  assert a and b and abs(a['distance']+b['distance']-.05)<.0001
  report['wallGaps'].append({'side':side,'z':z,'corniceToWall':a['distance']+b['distance']})
 for z in(-15.4,-14.5,-13.5,-12.5,-11.6):
  # Start below the foot rail to verify positive supporting floor, not guard geometry.
  q=ray([side*9.10,6.21,z],[0,-1,0],1)
  assert q and abs(q['point'][1]-6.2)<.0001,(side,z,q)
  report['guardSupports'].append({'side':side,'z':z,'floorY':q['point'][1]})
 for x,z in[(side*6.8,-15.45),(side*7.05,-14.55),(side*7.25,-14.5),(side*7.30,-14.2)]:
  q=ray([x,6.7,z],[0,-1,0],1)
  assert q and abs(q['point'][1]-6.2)<.0001,(x,z,q)
  report['stairExits'].append({'x':x,'z':z,'topY':q['point'][1]})
config=json.loads((ASSETS/'scene-config.json').read_text())
report['routeHeadChecks']=[]
for side,route in config['stairRoutes'].items():
 count=0
 for a,b in zip(route,route[1:]):
  for i in range(11):
   t=i/10;p=[a[k]*(1-t)+b[k]*t for k in('x','y','z')];p[1]+=1.78
   hit=ray(p,[0,1,0],.30)
   assert not hit,(side,p,hit)
   count+=1
 report['routeHeadChecks'].append({'side':side,'samples':count,'headRadius':.30,'passed':True})
proof=json.loads((OUT/'reference-library-exact-preservation.json').read_text());assert proof['sourceSha256']==report['sourceSha256'] and proof['completeTriangleMultisetIdentical'];report['modularProof']=proof['canonicalTriangleMultisetSha256'];report['passed']=True
(OUT/'reference-library-walk-clearance.json').write_text(json.dumps(report,indent=2));print('WALK_CLEARANCE_PASSED',json.dumps({'doors':len(report['doorways']),'bookRows':len(report['bookRows']),'colliders':len(config['colliders'])}))
