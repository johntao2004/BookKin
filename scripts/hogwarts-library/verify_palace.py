"""Verify the exported palace triangles, rather than just authoring declarations."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'scripts/hogwarts-library/deliverables/architecture-uncompressed.glb'
config=json.loads((ROOT/'apps/web/public/assets/hogwarts-library/scene-config.json').read_text())
assert config['revision']=='20261023-palace-furniture-r46'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene;dep=bpy.context.evaluated_depsgraph_get()
def v(p):return Vector((p[0],-p[2],p[1]))
def ray(p,d,length):
 hit,loc,*_=scene.ray_cast(dep,v(p),v(d),distance=length)
 return (loc.x,loc.z,-loc.y) if hit else None
checks=0
# Sweep the full outer aisles at foot, torso and head height on both floors.
for floor in (0,7.44):
 for side in (-1,1):
  for x in (17.6,18,18.4):
   for z in range(-18,18):
    for height in (.15,1,1.78):
     assert ray((side*x,floor+height,z),(0,0,1),.95) is None,('aisle',floor,side,x,z,height)
     checks+=1
# Removed column lines must be empty in the actual mesh, while retained frames remain solid.
for side in (-1,1):
 for height in (1.78,12):
  for z in (-10,0,10):
   assert ray((side*8.8,height,z-.8),(0,0,1),1.6) is None,('removed column',side,height,z)
   checks+=1
  for z in (-15,-5,5,15):
   assert ray((side*8.8,height,z-.8),(0,0,1),1.6) is not None,('retained column',side,height,z)
   checks+=1
# Sample all shelf faces for board support; the catalog still has 336 rows.
for level,spec in config['shelves'].items():
 if level not in ('lower','upper'):continue
 for side in (-1,1):
  x=side*(spec['xMin']+spec['xMax'])/2
  for z in config['boundaries']:
   for row in range(6):
    y=spec['baseY']+row*spec['pitch']+config['shelves']['boardThickness']/2
    for face in (-1,1):
     p=(x,y+.03,z+face*config['shelves']['bookCenterOffset'])
     hit=ray(p,(0,-1,0),.08)
     assert hit and abs(hit[1]-y)<.005,('book support',p,hit)
     checks+=1
# Furniture is real hardwood geometry at the preserved table and bench footprints.
for z in (-6.2,2.0):
 for x,top in [(0,1.255),(-2,.692),(2,.692)]:
  hit=ray((x,3,z),(0,-1,0),3)
  assert hit and abs(hit[1]-top)<.01,('furniture surface',x,z,hit)
  checks+=1
 for dz in (-1.75,1.75):
  hit=ray((0,3,z+dz),(0,-1,0),2)
  assert hit and 2.02<hit[1]<2.06,('table lantern',z,dz,hit)
  checks+=1
for end in (-1,1):
 for x in (-2.66,2.66):
  hit=ray((x,2.8,end*18),(0,0,end),3)
  assert hit and 19.4<abs(hit[2])<19.6,('door jamb',end,x,hit)
  checks+=1
# Sealed roof and end walls, actual straight lintels, and open ground circulation.
for x in (-18,-12,0,12,18):
 for z in (-17.5,-7.5,2.5,17.5):
  hit=ray((x,15,z),(0,1,0),8)
  assert hit and hit[1]<=22.45,('roof',x,z,hit)
  checks+=1
for side in (-1,1):
 for z in (-12.5,-7.5,-2.5,2.5,7.5,12.5):
  assert ray((side*8.8,1.78,z),(side,0,0),2) is None,('bay entry',side,z)
  hit=ray((side*8.8,2,z),(0,1,0),6)
  assert hit and 6.5<hit[1]<7,('straight lintel',side,z,hit)
  checks+=2
for end in (-1,1):
 for x in (-18,-12,0,12,18):
  hit=ray((x,3,end*18),(0,0,end),3)
  assert hit and abs(hit[2])<20.5,('end wall',end,x,hit)
  checks+=1
report={'revision':config['revision'],'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'rayChecks':checks,'passed':True,'scope':['hardwood tables, benches, lamps and door jambs','removed and retained column rows','outer aisles both floors','336 catalog shelf rows','roof enclosure','end walls','straight lintels and bay entries'],'browserAcceptance':False}
(ROOT/'docs/verification/palace-geometry-2026-10-23.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
