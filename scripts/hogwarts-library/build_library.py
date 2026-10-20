#!/usr/bin/env python3
"""BookKin reference reconstruction. Blender 4.3.2; project-scale estimates.
Run: blender -b -t 2 --python scripts/hogwarts-library/build_library.py -- --stage full
Architectural coordinates are Three.js (x, y up, z). Blender uses (x, -z, y).
No game meshes/textures, screenshot planes or synthetic shelf books are used.
"""
import bpy, math, json, sys, os, random, argparse
from mathutils import Vector
from pathlib import Path
from collections import defaultdict
P=argparse.ArgumentParser();P.add_argument('--stage',default='full',choices=['structure','full']);P.add_argument('--render',default='');P.add_argument('--samples',type=int,default=40);P.add_argument('--width',type=int,default=1100)
args=P.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'apps/web/public/assets/hogwarts-library';OUT.mkdir(parents=True,exist_ok=True)
SRC=Path(__file__).resolve().parent;DELIVER=SRC/'deliverables';DELIVER.mkdir(exist_ok=True);TEX=OUT/'textures';TEX.mkdir(exist_ok=True)
MATERIAL_MANIFEST=OUT/'materials.gltf'
TEXTURE_URIS={image['name']:image['uri'] for image in json.loads(MATERIAL_MANIFEST.read_text())['images']} if MATERIAL_MANIFEST.exists() else {}
def texture_path(filename):
 # Runtime texture names are content hashes. Resolve the stable material-map
 # names through materials.gltf so rebuilding never needs to regenerate or
 # duplicate the approved tracked PNG bytes.
 uri=TEXTURE_URIS.get(Path(filename).stem)
 path=OUT/uri if uri else TEX/filename
 if not path.exists():raise FileNotFoundError(f'Missing texture for {filename}: {path}')
 return path
def load_texture(filename,check_existing=False):
 image=bpy.data.images.load(str(texture_path(filename)),check_existing=check_existing);image.name=Path(filename).stem;image.pack();image.filepath_raw='//'+filename;return image
random.seed(4107);TAU=2*math.pi
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials):bpy.data.materials.remove(d)
FULL=args.stage=='full'
MATS={};BUILD={};COLLISIONS=[];ROUTES={};CAMERAS={};MODULE='Architecture';COLLECTIONS={}
# Architectural elevations grow; tagged human-scale objects translate rigidly.
HEIGHT_SCALE=1.2;HEIGHT_ANCHOR=None;COLLISION_HEIGHT_ANCHORS={}
def V(p):return (p[0],-p[2],p[1])
def rgb(h):return tuple((int(h[i:i+2],16)/255)**2.2 for i in (0,2,4))
def material(name,color,rough=.5,metal=0,emission=0,texture=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb(color),1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emission:p.inputs['Emission Color'].default_value=(*rgb(color),1);p.inputs['Emission Strength'].default_value=emission
 if texture:
  n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=load_texture(texture,True);m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])

 if emission and hasattr(m.cycles,'emission_sampling'):m.cycles.emission_sampling='NONE'
 m.diffuse_color=(*rgb(color),1);MATS[name]=m;return name
# Procedural, author-created grain maps. These are material tiles, not reference images.
def grain(name,color):
 w,h=512,1024;im=bpy.data.images.new(name,width=w,height=h);base=[(int(color[i:i+2],16)/255)**2.2 for i in (0,2,4)];pixels=[]
 for y in range(h):
  v=y/h
  for x in range(w):
   u=x/w;phase=u*TAU*23+0.75*math.sin(v*TAU*2)+.19*math.sin(v*TAU*7+u*4)
   n=.92+.055*math.sin(phase)+.026*math.sin(phase*4.1)+.019*math.sin(x*1.37+y*.073)+random.uniform(-.025,.025)
   # Sparse narrow vessels and restrained worn flecks
   n-=.045*max(0,math.sin(phase*9))**16
   pixels.extend([max(0,min(1,c*n)) for c in base]+[1])
 im.pixels=pixels;im.filepath_raw=str(TEX/(name+'.png'));im.file_format='PNG';im.save();bpy.data.images.remove(im)
material('Oak • rubbed midtone','715340',.53,texture='r2-oak-albedo.png');material('Walnut • deep recess','4c3529',.58,texture='r2-walnut-albedo.png');material('Oak • edge highlight','795b43',.53,texture='r2-oak-albedo.png');material('Oak • floor','715340',.6,texture='r2-oak-albedo.png')
material('Paint • blue gray vault','53636c',.8);material('Paint • faded ivory inlay','b5ad91',.78);material('Paint • teal border','264f50',.65);material('Stone • warm ashlar','8f8a77',.82);material('Stone • dark slate','535e59',.67);material('Stone • pale slate','73796e',.62);material('Stone • moss slate','5c6558',.68);material('Stone • grout','3b413e',.9)
material('Brass • aged edge','88704b',.5,.60);material('Iron • blue black','303838',.52,.45);material('Glass • green shade','214b31',.25,.15);material('Paper • ivory candle','d5c596',.5);material('Light • candle','ffcc71',.28,emission=3);material('Glass • pale window','b7cbd2',.34,emission=.16);material('Leather • desk inset','384a35',.7);material('Canvas • dark green','26332a',.9);material('Canvas • ochre silhouette','8b7550',.92);material('Globe • parchment','a8996a',.75);material('Globe • land','536751',.8)
material('Glass • cool window pane','a8c2cc',.36,emission=.14)
material('Glass • warm window pane','c6c9bb',.38,emission=.14)
def wire_pbr(mat,prefix,strength):
 m=MATS[mat];nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
 for suffix,socket in [('roughness','Roughness'),('normal','Normal')]:
  tex=nodes.new('ShaderNodeTexImage');tex.image=load_texture(prefix+'-'+suffix+'.png',True);tex.image.colorspace_settings.name='Non-Color'
  if suffix=='normal':
   normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=strength;links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
  else:links.new(tex.outputs['Color'],p.inputs[socket])
for m in ['Oak • rubbed midtone','Oak • edge highlight','Oak • floor']:wire_pbr(m,'r2-oak',.65)
wire_pbr('Walnut • deep recess','r2-walnut',.65)
for m in ['Stone • dark slate','Stone • pale slate','Stone • moss slate']:wire_pbr(m,'r2-slate',.55)
for m in ['Brass • aged edge','Iron • blue black']:wire_pbr(m,'r2-aged-metal',.55)
OAK='Oak • rubbed midtone';DARK='Walnut • deep recess';EDGE='Oak • edge highlight';GOLD='Brass • aged edge';TEAL='Paint • teal border';BLUE='Paint • blue gray vault';IRON='Iron • blue black';STONE='Stone • warm ashlar'
class Mesh:
 def __init__(self):self.v=[];self.f=[];self.uv=[];self.s=[];self.height_anchors=[]
 def face(self,vs,uv=None,smooth=False):
  i=len(self.v);self.v.extend(V(p) for p in vs);self.height_anchors.extend([HEIGHT_ANCHOR]*len(vs));self.f.append(tuple(range(i,i+len(vs))));
  if uv is None:
   spans=[max(p[a] for p in vs)-min(p[a] for p in vs) for a in range(3)]
   axes=sorted(range(3),key=lambda a:spans[a],reverse=True);long,short=axes[:2]
   uv=[(p[short]*1.4,p[long]*.35) for p in vs]
  self.uv.extend(uv);self.s.append(smooth)
def builder(mat):
 key=(MODULE,mat)
 if key not in BUILD:BUILD[key]=Mesh()
 return BUILD[key]
def face(mat,vs,uv=None,smooth=False):builder(mat).face(vs,uv,smooth)
def quad(mat,a,b,c,d,uv=None,smooth=False):face(mat,[a,b,c,d],uv,smooth)
def box(mat,c,s,bevel=0,rot=0):
 hx,hy,hz=[v/2 for v in s];cx,cy,cz=c
 def tr(p):x,y,z=p;return (cx+x*math.cos(rot)+z*math.sin(rot),cy+y,cz-x*math.sin(rot)+z*math.cos(rot))
 if bevel and min(s)>2*bevel:
  b=bevel;verts={}
  for ax in range(3):
   others=[i for i in range(3) if i!=ax]
   for sg in (-1,1):
    points=[]
    for a,d in [(-1,-1),(1,-1),(1,1),(-1,1)]:
     p=[0,0,0];p[ax]=[hx,hy,hz][ax]*sg;p[others[0]]=([hx,hy,hz][others[0]]-b)*a;p[others[1]]=([hx,hy,hz][others[1]]-b)*d;points.append(p)
    # Orient consistently outward.
    n=Vector(points[1])-Vector(points[0]);q=Vector(points[2])-Vector(points[0]);normal=n.cross(q)
    if normal[ax]*sg<0:points.reverse()
    face(mat,[tr(p) for p in points])
  # Bevel edge strips
  for ax in range(3):
   others=[i for i in range(3) if i!=ax];j,k=others
   for sj in (-1,1):
    for sk in (-1,1):
     pts=[]
     for end,jbig in [(-1,True),(1,True),(1,False),(-1,False)]:
      p=[0,0,0];p[ax]=end*([hx,hy,hz][ax]-b);p[j]=sj*([hx,hy,hz][j]-(0 if jbig else b));p[k]=sk*([hx,hy,hz][k]-(b if jbig else 0));pts.append(p)
     n=(Vector(pts[1])-Vector(pts[0])).cross(Vector(pts[2])-Vector(pts[0]));center=Vector((0,0,0));center[j]=sj;center[k]=sk
     if n.dot(center)<0:pts.reverse()
     face(mat,[tr(p) for p in pts])
  for sx in (-1,1):
   for sy in (-1,1):
    for sz in (-1,1):
     pts=[(sx*hx,sy*(hy-b),sz*(hz-b)),(sx*(hx-b),sy*hy,sz*(hz-b)),(sx*(hx-b),sy*(hy-b),sz*hz)]
     if (Vector(pts[1])-Vector(pts[0])).cross(Vector(pts[2])-Vector(pts[0])).dot(Vector((sx,sy,sz)))<0:pts.reverse()
     face(mat,[tr(p) for p in pts])
 else:
  p=[(-hx,-hy,-hz),(hx,-hy,-hz),(hx,hy,-hz),(-hx,hy,-hz),(-hx,-hy,hz),(hx,-hy,hz),(hx,hy,hz),(-hx,hy,hz)]
  for ids in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)]:face(mat,[tr(p[i]) for i in ids])
def collision_box(id,c,s,rotation=0):
 d={'id':id,'shape':'box','center':dict(zip('xyz',c)),'size':dict(zip('xyz',s))}
 if rotation:d['rotationY']=rotation
 COLLISIONS.append(d);COLLISION_HEIGHT_ANCHORS[id]=HEIGHT_ANCHOR
def cylinder(mat,c,r,h,n=12,r2=None):
 r2=r if r2 is None else r2;cx,y,cz=c
 for i in range(n):
  a=i*TAU/n;b=(i+1)*TAU/n
  p=[(cx+r*math.cos(a),y-h/2,cz+r*math.sin(a)),(cx+r*math.cos(b),y-h/2,cz+r*math.sin(b)),(cx+r2*math.cos(b),y+h/2,cz+r2*math.sin(b)),(cx+r2*math.cos(a),y+h/2,cz+r2*math.sin(a))]
  face(mat,p,smooth=True)
 face(mat,[(cx+r*math.cos(i*TAU/n),y-h/2,cz+r*math.sin(i*TAU/n)) for i in reversed(range(n))]);face(mat,[(cx+r2*math.cos(i*TAU/n),y+h/2,cz+r2*math.sin(i*TAU/n)) for i in range(n)])
def tube(mat,points,r=.035,n=6):
 if len(points)<2:return
 rings=[]
 for i,p in enumerate(points):
  tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)]);tangent.normalize();axis=Vector((0,1,0))
  if abs(tangent.dot(axis))>.9:axis=Vector((1,0,0))
  a=tangent.cross(axis).normalized();b=tangent.cross(a).normalized();rings.append([tuple(Vector(p)+r*(a*math.cos(j*TAU/n)+b*math.sin(j*TAU/n))) for j in range(n)])
 for i in range(len(rings)-1):
  for j in range(n):quad(mat,rings[i][j],rings[i][(j+1)%n],rings[i+1][(j+1)%n],rings[i+1][j],smooth=True)
 face(mat,rings[0][::-1]);face(mat,rings[-1])
def torus(mat,c,r,t,plane='xz',n=32):
 pts=[]
 for i in range(n+1):
  a=i*TAU/n
  if plane=='xz':p=(c[0]+r*math.cos(a),c[1],c[2]+r*math.sin(a))
  elif plane=='xy':p=(c[0]+r*math.cos(a),c[1]+r*math.sin(a),c[2])
  else:p=(c[0],c[1]+r*math.sin(a),c[2]+r*math.cos(a))
  pts.append(p)
 tube(mat,pts,t,6)
def sphere(mat,c,r,n=16,m=8):
 for j in range(m):
  a=-math.pi/2+j*math.pi/m;b=-math.pi/2+(j+1)*math.pi/m
  for i in range(n):
   u=i*TAU/n;v=(i+1)*TAU/n
   def p(t,k):return(c[0]+r*math.cos(t)*math.cos(k),c[1]+r*math.sin(t),c[2]+r*math.cos(t)*math.sin(k))
   face(mat,[p(a,u),p(a,v),p(b,v),p(b,u)],smooth=True)
def lathe(mat,c,profile,n=16):
 for (y,r),(yy,rr) in zip(profile,profile[1:]):
  for i in range(n):
   a=i*TAU/n;b=(i+1)*TAU/n
   face(mat,[(c[0]+r*math.cos(a),c[1]+y,c[2]+r*math.sin(a)),(c[0]+r*math.cos(b),c[1]+y,c[2]+r*math.sin(b)),(c[0]+rr*math.cos(b),c[1]+yy,c[2]+rr*math.sin(b)),(c[0]+rr*math.cos(a),c[1]+yy,c[2]+rr*math.sin(a))],smooth=True)
def arch(mat,center,half, spring,rise,thick,depth,axis='z',steps=24):
 # Ring band of elliptical arch. center has vertical floor origin; along plane x or z.
 cx,base,cz=center
 def p(a,outer,k):
  u=(half+outer*thick)*math.cos(a);y=base+spring+(rise+outer*thick)*math.sin(a)
  return (cx+u,y,cz+k) if axis=='z' else (cx+k,y,cz+u)
 for i in range(steps):
  a=i*math.pi/steps;b=(i+1)*math.pi/steps
  for k,flip in [(-depth/2,False),(depth/2,True)]:
   q=[p(a,0,k),p(b,0,k),p(b,1,k),p(a,1,k)];face(mat,q[::-1] if flip else q)
  quad(mat,p(a,0,-depth/2),p(a,0,depth/2),p(b,0,depth/2),p(b,0,-depth/2))
  quad(mat,p(b,1,-depth/2),p(b,1,depth/2),p(a,1,depth/2),p(a,1,-depth/2))
 for a in (0,math.pi):quad(mat,p(a,0,-depth/2),p(a,1,-depth/2),p(a,1,depth/2),p(a,0,depth/2))
def arch_spandrel(mat,center,half,spring,rise,top,depth,axis='z',steps=24):
 cx,base,cz=center
 def p(u,y,k):return(cx+u,base+y,cz+k) if axis=='z' else(cx+k,base+y,cz+u)
 for i in range(steps):
  a=i*math.pi/steps;b=(i+1)*math.pi/steps;u0=half*math.cos(a);u1=half*math.cos(b);y0=spring+rise*math.sin(a);y1=spring+rise*math.sin(b)
  for k in (-depth/2,depth/2):face(mat,[p(u0,y0,k),p(u1,y1,k),p(u1,top,k),p(u0,top,k)])
  quad(mat,p(u0,y0,-depth/2),p(u0,y0,depth/2),p(u1,y1,depth/2),p(u1,y1,-depth/2))
 quad(mat,p(-half,top,-depth/2),p(half,top,-depth/2),p(half,top,depth/2),p(-half,top,depth/2))
def pointed(mat,center,width,base,shoulder,height,thick=.12,depth=.22,axis='z'):
 cx,cy,cz=center;half=width/2
 # Two cubic curves meeting at a true cusp; profile assembled as solid tubes.
 pts=[]
 for side in (-1,1):
  part=[]
  for i in range(25):
   t=i/24;u=side*half*(1-t*t);y=cy+shoulder+(height-shoulder)*t
   part.append((cx+u,y,cz) if axis=='z' else(cx,y,cz+u))
  tube(mat,part,thick,8)
  if axis=='z':box(mat,(cx+side*half,cy+(base+shoulder)/2,cz),(thick*2,shoulder-base,depth),.018)
  else:box(mat,(cx,cy+(base+shoulder)/2,cz+side*half),(depth,shoulder-base,thick*2),.018)
def scroll(mat,c,width,height,axis='x',r=.034):
 # Two mirrored open S-curves, with central quatrefoil ring; never a flat panel texture.
 for sign in (-1,1):
  pts=[]
  for i in range(33):
   t=i/32;u=sign*width*.48*t;yy=c[1]+height*.29*math.sin(t*math.pi*1.65)
   pts.append((c[0],yy,c[2]+u) if axis=='x' else(c[0]+u,yy,c[2]))
  tube(mat,pts,r,6)
  pts=[]
  for i in range(33):
   t=i/32;u=sign*width*.46*t;yy=c[1]-height*.28*math.sin(t*math.pi*1.5)
   pts.append((c[0],yy,c[2]+u) if axis=='x' else(c[0]+u,yy,c[2]))
  tube(mat,pts,r,6)
 torus(mat,c,height*.23,r,'yz' if axis=='x' else 'xy',24)
# Round 2 reusable joinery kit: closed mouldings, carved relief and pierced panels.
def sweep_profile(mat,points,normal,profile):
 rings=[]
 for i,p in enumerate(points):
  tangent=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
  norm=Vector(normal(p) if callable(normal) else normal).normalized();across=tangent.cross(norm).normalized()
  rings.append([tuple(Vector(p)+across*a+norm*b) for a,b in profile])
 for ring,nxt in zip(rings,rings[1:]):
  for j in range(len(profile)):quad(mat,ring[j],ring[(j+1)%len(profile)],nxt[(j+1)%len(profile)],nxt[j],smooth=True)
 face(mat,rings[0][::-1]);face(mat,rings[-1])
def mitered_run(mat,path,y,profile,closed_profile=True,smooth=False,endpoint_offsets=None,cap_ends=True):
 # A single ring at each shared corner, with an exact planar miter. Independent
 # capped segments leave wedge cracks, duplicated faces and discontinuous UVs.
 tangents=[];lengths=[0.0]
 for (x,z),(xx,zz) in zip(path,path[1:]):
  distance=math.hypot(xx-x,zz-z)
  if distance<1e-8:raise ValueError('Duplicate miter station')
  tangents.append(((xx-x)/distance,(zz-z)/distance));lengths.append(lengths[-1]+distance)
 offsets=[]
 for k in range(len(path)):
  prev=tangents[max(0,k-1)];nxt=tangents[min(k,len(tangents)-1)]
  n0=(-prev[1],prev[0]);n1=(-nxt[1],nxt[0]);den=1+n0[0]*n1[0]+n0[1]*n1[1]
  if den<.2:raise ValueError('Miter turn too acute')
  offsets.append(((n0[0]+n1[0])/den,(n0[1]+n1[1])/den))
 if endpoint_offsets:offsets[0],offsets[-1]=endpoint_offsets
 rings=[[(x+ox*a,y+b,z+oz*a) for a,b in profile]
        for (x,z),(ox,oz) in zip(path,offsets)]
 perimeter=[0.0]
 for (a,b),(aa,bb) in zip(profile,profile[1:]+profile[:1]):perimeter.append(perimeter[-1]+math.hypot(aa-a,bb-b))
 area=sum(a*bb-aa*b for (a,b),(aa,bb) in zip(profile,profile[1:]+profile[:1]))
 count=len(profile) if closed_profile else len(profile)-1
 for k,(ring,nxt) in enumerate(zip(rings,rings[1:])):
  for j in range(count):
   q=(j+1)%len(profile)
   pts=[ring[j],nxt[j],nxt[q],ring[q]]
   uv=[(lengths[k]*.35,perimeter[j]*1.4),(lengths[k+1]*.35,perimeter[j]*1.4),
       (lengths[k+1]*.35,perimeter[j+1]*1.4),(lengths[k]*.35,perimeter[j+1]*1.4)]
   if area<0:pts.reverse();uv.reverse()
   face(mat,pts,uv,smooth=smooth)
 if cap_ends:
  face(mat,rings[0] if area>0 else list(reversed(rings[0])))
  face(mat,list(reversed(rings[-1])) if area>0 else rings[-1])
 return rings
def carved_arch(cx,z,base,half,shoulder,crown,width=.20,depth=.26,mat=None):
 mat=mat or OAK;pts=[(cx-half,base,z),(cx-half,shoulder,z)]
 for i in range(1,19):
  t=i/18;pts.append((cx-half*(1-t*t),shoulder+(crown-shoulder)*t,z))
 for i in range(17,-1,-1):
  t=i/18;pts.append((cx+half*(1-t*t),shoulder+(crown-shoulder)*t,z))
 pts.append((cx+half,base,z))
 prof=[(-.5,-.48),(.5,-.48),(.5,.1),(.38,.38),(.23,.35),(.12,.6),(-.1,.6),(-.23,.32),(-.4,.22),(-.5,.06)]
 sweep_profile(mat,pts,(0,0,1),[(a*width,b*depth) for a,b in prof])
def relief_leaf(mat,c,length=.35,width=.14,angle=0,axis='z',depth=.065):
 # A modeled, closed convex leaf with folded side lobes and an incised midrib.
 def transform(u,v,d):
  xx=u*math.cos(angle)-v*math.sin(angle);yy=u*math.sin(angle)+v*math.cos(angle)
  return (c[0]+xx,c[1]+yy,c[2]+d) if axis=='z' else(c[0]+(-d if axis=='-x' else d),c[1]+yy,c[2]+xx)
 rows=[]
 for i in range(7):
  t=i/6;w=width*math.sin(math.pi*t)**.7*(.8+.2*math.cos(t*6*math.pi));row=[]
  for j in range(5):
   u=(j/4-.5)*2;d=depth*math.sin(math.pi*t)*(1-.7*abs(u));row.append(transform(u*w,t*length,d))
  rows.append(row)
 for i in range(6):
  for j in range(4):quad(mat,rows[i][j],rows[i][j+1],rows[i+1][j+1],rows[i+1][j],smooth=True)
 outline=[r[0] for r in rows]+[r[-1] for r in reversed(rows)];face(mat,list(reversed(outline)))
 tube(DARK,[transform(0,length*i/6,depth*math.sin(math.pi*i/6)+.004) for i in range(7)],.008,4)
def rosette(mat,c,r=.15,axis='z'):
 for i in range(8):relief_leaf(mat,c,r,r*.24,i*TAU/8,axis,r*.20)
 if axis=='z':sphere(mat,(c[0],c[1],c[2]+r*.1),r*.13,10,6)
 else:sphere(mat,(c[0]+(-r*.1 if axis=='-x' else r*.1),c[1],c[2]),r*.13,10,6)
def ribbon_scroll(mat,c,w,h,axis='x',thick=.055):
 # Pierced timber scrolling: solid relief ribbons with curled terminals.
 for side in(-1,1):
  pts=[]
  for k in range(23):
   t=k/22;u=side*w*.43*t;v=h*.36*math.sin(t*math.pi*1.65)
   pts.append((c[0],c[1]+v,c[2]+u) if axis=='x' else(c[0]+u,c[1]+v,c[2]))
  normal=(1,0,0) if axis=='x' else(0,0,1)
  sweep_profile(mat,pts,normal,[(-thick,-.065),(thick,-.065),(thick,.045),(.6*thick,.075),(-.6*thick,.075),(-thick,.045)])
  pts=[]
  for k in range(19):
   a=k/18*math.pi*1.7;rr=h*.17*(1-k/30);u=side*(w*.28+rr*math.cos(a));v=-h*.08+rr*math.sin(a)
   pts.append((c[0],c[1]+v,c[2]+u) if axis=='x' else(c[0]+u,c[1]+v,c[2]))
  sweep_profile(mat,pts,normal,[(-thick*.6,-.04),(thick*.6,-.04),(thick*.6,.045),(-thick*.6,.045)])
 torus(mat,c,h*.22,thick*.8,'yz' if axis=='x' else'xy',24)
 rosette(EDGE,c,h*.12,axis='x' if axis=='x' else'z')
def pierced_header(cx,z,y0,y1,w,hole_y,r,depth=.3):
 # A full-thickness header with a genuine circular aperture; no mask plane.
 for i in range(48):
  a=i*TAU/48;b=(i+1)*TAU/48
  def pair(t,d):
   dx,dy=math.cos(t),math.sin(t);dist=min(w/2/max(abs(dx),1e-6),(y1-hole_y if dy>=0 else hole_y-y0)/max(abs(dy),1e-6))
   return (cx+r*dx,hole_y+r*dy,z+d),(cx+dist*dx,hole_y+dist*dy,z+d)
  p,q=pair(a,-depth/2);pp,qq=pair(b,-depth/2);P,Q=pair(a,depth/2);PP,QQ=pair(b,depth/2)
  quad(OAK,p,pp,qq,q);quad(OAK,P,Q,QQ,PP);quad(DARK,p,P,PP,pp);quad(OAK,q,qq,QQ,Q)
 torus(EDGE,(cx,hole_y,z+depth/2+.018),r+.025,.034,'xy',40)
 # Four internal curved lobes leave the oculus visibly open.
 for k in range(4):
  pts=[]
  for j in range(15):
   a=k*math.pi/2+(j/14-.5)*math.pi/2;rr=r*(.77+.2*math.cos(j/14*TAU));pts.append((cx+rr*math.cos(a),hole_y+rr*math.sin(a),z+.18))
  tube(OAK,pts,.025,6)
def cornice(mat,c,width,axis='z',depth=.6):
 # Multi-layer profiles, alternating coves, beads and projecting cap.
 for dy,wextra,dd,hh in [(-.18,0,.78,.09),(-.095,.06,.83,.06),(-.035,.11,.94,.075),(.055,.18,1.04,.09),(.125,.25,1.14,.065),(.19,.3,1.25,.08)]:
  if axis=='z':box(mat,(c[0],c[1]+dy,c[2]),(width+wextra,hh,depth*dd),.018)
  else:box(mat,(c[0],c[1]+dy,c[2]),(depth*dd,hh,width+wextra),.018)
def curved_corbel(x,z,base,height,width):
 rings=[]
 for yy,factor in[(0,1.0),(.10,1.025),(.20,1.12),(.30,1.31),(.42,1.47),(.51,1.53)]:
  h=width*factor/2;b=.045
  ring=[(-h+b,-h),(h-b,-h),(h,-h+b),(h,h-b),(h-b,h),(-h+b,h),(-h,h-b),(-h,-h+b)]
  rings.append([(x+u,base+height-.79+yy,z+v) for u,v in ring])
 for a,b in zip(rings,rings[1:]):
  for k in range(8):quad(OAK,a[k],a[(k+1)%8],b[(k+1)%8],b[k],smooth=True)
 face(OAK,rings[0][::-1]);face(OAK,rings[-1])
def pilaster_relief(x,z,base,height,width):
 # A tapered corbel below the capital and carved leaf sprays on both broad faces.
 for face_side in(-1,1):
  xx=x+face_side*(width/2+.035)
  for k in(-1,0,1):relief_leaf(OAK,(xx,base+height-.8,z+k*width*.22),.58,width*.18,-k*.18,'x' if face_side>0 else '-x',.07)
  rosette(EDGE,(xx,base+height+.075,z),.105,'x')

def fluted_pier(x,z,base,height,width=.52,passage_side=False):
 # Reference piers are solid square timber members with flat corner stiles and
 # a LIMITED inset fluted panel, below one tall flared corbel and a simple cap.
 # They are not bundles of full-face cylindrical reeds or stacked capitals.
 shaft0=base+.32;shaft1=base+height-(.92 if height>5 else .43)
 half=width/2; inset=width*.31; groove=.018
 for side in range(4):
  contour=[]
  for k in range(73):
   u=-half+width*k/72
   if abs(u)<inset:
    t=(u+inset)/(2*inset);d=.019+groove*math.sin(t*7*math.pi)**2
   else:d=0
   v=half-d
   if side==0:pt=(u,v)
   elif side==1:pt=(v,-u)
   elif side==2:pt=(-u,-v)
   else:pt=(-v,u)
   contour.append(pt)
  for (u,v),(uu,vv) in zip(contour,contour[1:]):
   quad(OAK,(x+u,shaft0,z+v),(x+uu,shaft0,z+vv),(x+uu,shaft1,z+vv),(x+u,shaft1,z+v),smooth=False)
 for yy,sz,hh in [(base+.10,width+.21,.20),(base+.245,width+.12,.085),(shaft0,width+.04,.085),(shaft1+.03,width+.10,.09)]:
  # Rebate only the gallery passage side of the foot moulding; the shaft
  # retains its broad square section and the other three faces keep their plinth.
  if passage_side and yy<base+.4:
   direction=1 if x>0 else -1
   box(OAK,(x-direction*(sz-width)/4,yy,z),((sz+width)/2,hh,sz),.018)
  else:box(OAK,(x,yy,z),(sz,hh,sz),.018)
 # A gently concave, broad timber corbel links the inset shaft to the roof rib.
 rings=[];capbase=shaft1+.075;capheight=base+height-.10-capbase
 for t,f in[(0,1.10),(.12,1.11),(.35,1.20),(.65,1.42),(.86,1.55),(1,1.58)]:
  hw=width*f/2;cut=.027;rings.append([(x+u,capbase+t*capheight,z+v) for u,v in[(-hw+cut,-hw),(hw-cut,-hw),(hw,-hw+cut),(hw,hw-cut),(hw-cut,hw),(-hw+cut,hw),(-hw,hw-cut),(-hw,-hw+cut)]])
 for low,high in zip(rings,rings[1:]):
  for k in range(8):quad(OAK,low[k],low[(k+1)%8],high[(k+1)%8],high[k],smooth=True)
 face(OAK,rings[-1]);box(OAK,(x,base+height,z),(width*1.68,.16,width*1.68),.025)
 if FULL:
  for sign in(-1,1):
   torus(GOLD,(x+sign*width*.795,base+height-.12,z),.040,.010,'yz',16)
def panel_frame(c,w,h,axis='z',mat=OAK,depth=.14):
 x,y,z=c
 if axis=='z':
  for xx in(-w/2,w/2):box(mat,(x+xx,y,z),(.13,h,depth),.016)
  for yy in(-h/2,h/2):box(mat,(x,y+yy,z),(w,.13,depth),.016)
 else:
  for zz in(-w/2,w/2):box(mat,(x,y,z+zz),(depth,h,.13),.016)
  for yy in(-h/2,h/2):box(mat,(x,y+yy,z),(depth,.13,w),.016)
def rail_side(x,z0,z1,y=6.2):
 # Giant piers are shared structural newels, not obstacles for a continuous
 # decorative strip. Stop each member just inside the .82-wide shaft face;
 # never place an independent newel or scroll across a pier's foot/shaft.
 pier_half=.41;tenon=.015
 piers=[z for z in BOUNDS if z0-pier_half<z<z1+pier_half]
 cuts=sorted({z0,z1,*[max(z0,min(z1,z+d*(pier_half-tenon))) for z in piers for d in(-1,1)]})
 for start,end in zip(cuts,cuts[1:]):
  if any(abs((start+end)/2-z)<pier_half-tenon for z in piers):continue
  length=end-start;cz=(start+end)/2
  for yy,ss in [(y+.12,(.35,.24,length)),(y+.33,(.21,.14,length)),(y+1.05,(.36,.17,length)),(y+1.16,(.43,.1,length))]:box(OAK,(x,yy,cz),ss,.035)
  if length<.8:continue
  n=max(1,round(length/2.4))
  posts=[start+length*i/n for i in range(n+1)]
  for z in posts:
   if any(abs(z-p)<.8 for p in piers):continue
   box(OAK,(x,y+.61,z),(.46,1.22,.29),.025)
   box(EDGE,(x,y+1.18,z),(.51,.08,.4),.018)
  for i in range(n):
   z=start+length*(i+.5)/n
   panel_frame((x,y+.67,z),length/n-.30,.78,'x',DARK,.19)
   ribbon_scroll(OAK,(x,y+.68,z),length/n-.48,.66,'x',.06)
 length=z1-z0;cz=(z0+z1)/2
 collision_box(f'rail-{x}-{z0}',(x,y+.67,cz),(.38,1.34,length))
def rail_end(z,x0,x1,y=6.2):
 length=x1-x0;cx=(x0+x1)/2
 for yy,ss in [(y+.12,(length,.24,.35)),(y+.33,(length,.12,.23)),(y+1.07,(length,.19,.37)),(y+1.18,(length,.09,.45))]:box(OAK,(cx,yy,z),ss,.025)
 n=max(1,round(length/2.1))
 for i in range(n+1):box(OAK,(x0+length*i/n,y+.60,z),(.32,1.2,.36),.025)
 for i in range(n):
  p=(x0+length*(i+.5)/n,y+.68,z)
  panel_frame(p,length/n-.22,.74,'z',DARK,.2)
  ribbon_scroll(OAK,p,length/n-.4,.62,'z',.055)
 collision_box(f'rail-end-{z}-{x0}',(cx,y+.65,z),(length,1.3,.4))
GUARD_JOINERY=[]
def turned_guard(name,points,y=6.2,shared_start=False):
 # One structural newel per vertex. Rails enter the shaft faces, while the
 # independent turned infill starts clear of those shafts on each segment.
 # This avoids stacked endpoint spindles and crossing moulding end caps.
 runs=[]
 for j,((x,z),(xx,zz)) in enumerate(zip(points,points[1:])):
  distance=math.hypot(xx-x,zz-z)
  if distance<.30:raise ValueError('Guard run too short for complete joinery: '+name)
  ux=(xx-x)/distance;uz=(zz-z)/distance;inset=.12
  start=(x+ux*inset,z+uz*inset);finish=(xx-ux*inset,zz-uz*inset)
  clear=distance-2*inset
  sweep_profile(OAK,[(start[0],y+1.12,start[1]),(finish[0],y+1.12,finish[1])],(0,1,0),[(-.12,-.075),(.12,-.075),(.15,0),(.11,.085),(-.11,.085),(-.15,0)])
  box(OAK,((x+xx)/2,y+.13,(z+zz)/2),(.18,.14,clear),.018,math.atan2(ux,uz))
  count=max(1,math.ceil(clear/.26));spindles=[]
  for k in range(count):
   t=(inset+clear*(k+.5)/count)/distance;bx=x+(xx-x)*t;bz=z+(zz-z)*t
   lathe(OAK,(bx,y+.20,bz),[(0,.055),(.06,.055),(.09,.035),(.20,.033),(.30,.050),(.42,.060),(.52,.050),(.64,.032),(.73,.033),(.78,.050),(.85,.050)],16)
   spindles.append({'x':bx,'z':bz})
  collision_box(f'guard-{name}-{j}',((x+xx)/2,y+.66,(z+zz)/2),(.30,1.32,distance),math.atan2(ux,uz))
  runs.append({'start':{'x':x,'z':z},'end':{'x':xx,'z':zz},'railInset':inset,'spindles':spindles})
 posts=points[1:] if shared_start else points
 for x,z in posts:
  box(OAK,(x,y+.61,z),(.26,1.22,.26),.018)
  box(OAK,(x,y+1.22,z),(.34,.12,.34),.015)
 GUARD_JOINERY.append({'id':name,'floorY':y*HEIGHT_SCALE,'sharedStart':shared_start,'newels':[dict(zip(('x','z'),p)) for p in posts],'runs':runs,'spindleRadiusMax':.06,'spindleBase':.20,'spindleHeight':.85,'handrailCenterY':1.12,'handrailBottomY':1.045,'handrailTopY':1.205,'bottomRailTopY':.20})
# Preserve the local dimensions of gallery guardrails at raised anchors.
def anchored_feature(fn,anchor_of):
 def wrapped(*a,**kw):
  global HEIGHT_ANCHOR
  previous=HEIGHT_ANCHOR;HEIGHT_ANCHOR=anchor_of(a,kw)
  try:return fn(*a,**kw)
  finally:HEIGHT_ANCHOR=previous
 return wrapped
rail_side=anchored_feature(rail_side,lambda a,k:k.get('y',a[3] if len(a)>3 else 6.2))
rail_end=anchored_feature(rail_end,lambda a,k:k.get('y',a[3] if len(a)>3 else 6.2))
turned_guard=anchored_feature(turned_guard,lambda a,k:k.get('y',a[2] if len(a)>2 else 6.2))
BAYS=[-12.5,-7.5,-2.5,2.5,7.5,12.5];BOUNDS=[-15,-10,-5,0,5,10,15]
HALL_LENGTH=40;END_Z=20;END_EXTENSION=2;CROSSWALK_INNER_Z=15.6;CROSSWALK_DEPTH=4.4;CROSSWALK_CENTERS=(-17.8,17.8);REVISION='20261020-terminal-arches-r42'
OUTER_AISLE_EXTENSION=5.0;CASE_WIDTH_EXTENSION=1.6;HALL_WIDTH=30+2*OUTER_AISLE_EXTENSION;OUTER_WALL_X=HALL_WIDTH/2
assert HALL_LENGTH==2*END_Z and CROSSWALK_DEPTH==END_Z-CROSSWALK_INNER_Z
# Ground slab and actual inset stone tiles.
MODULE='00_Floor';box('Stone • grout',(0,-.18,0),(HALL_WIDTH+.4,.36,HALL_LENGTH+.4));collision_box('hall-floor',(0,-.18,0),(HALL_WIDTH+.4,.36,HALL_LENGTH+.4))
# Narrow chamfer-corner slate pavers with an inset border, based on S08/S09.
for ix in range(round(HALL_WIDTH/.6)):
 for iz in range(34):
  x=-HALL_WIDTH/2+.3+ix*.6;z=-19.8+iz*1.2;w=.578;h=1.178;b=.092
  outline=[(-w/2+b,-h/2),(w/2-b,-h/2),(w/2,-h/2+b),(w/2,h/2-b),(w/2-b,h/2),(-w/2+b,h/2),(-w/2,h/2-b),(-w/2,-h/2+b)]
  face('Stone • pale slate',[(x+xx,.017,z+zz) for xx,zz in outline])
  inset=[(xx*.92,zz*.96) for xx,zz in outline]
  mat=['Stone • dark slate','Stone • moss slate','Stone • dark slate'][(ix*7+iz*11)%3]
  face(mat,[(x+xx,.021,z+zz) for xx,zz in inset])
  # Small, muted square between the cut corners of neighboring slabs.
  face('Stone • moss slate',[(x+.3,.018,z+.51),(x+.39,.018,z+.6),(x+.3,.018,z+.69),(x+.21,.018,z+.6)])
for x in (-8.55,8.55):box(OAK,(x,.03,0),(.22,.05,HALL_LENGTH))
for z in (-19.5,-14.5,-9.5,-4.5,.5,5.5,10.5,15.5,19.5):box(OAK,(0,.03,z),(17.3,.05,.16))
# Gallery slabs, with rectilinear safety clearance around both spiral apertures.
MODULE='01_Gallery_floors'
for side in (-1,1):
 slabs=[(11.9,4.3,6.2,31.4),(12.0,-13.5,6.0,4.2),(11.9,-17.8,6.2,CROSSWALK_DEPTH)]
 for k,(x,z,w,l) in enumerate(slabs):
  # Keep the hall-side edge fixed; extend only toward the new outer wall.
  x+=OUTER_AISLE_EXTENSION/2;w+=OUTER_AISLE_EXTENSION
  if k==1:x+=.05;w-=.1 # Butt the landing at x=9.1 without coplanar overlap.
  box(OAK,(side*x,5.97,z),(w,.46,l),.035);collision_box(f'gallery-{side}-{k}',(side*x,5.97,z),(w,.46,l))
 for z in CROSSWALK_CENTERS:
  if side==1:
   box(OAK,(0,5.97,z),(17.6,.46,CROSSWALK_DEPTH),.035)
   collision_box(f'crosswalk-{z}',(0,5.97,z),(17.6,.46,CROSSWALK_DEPTH))
 # Full-width top platform occupies the north half of the stairwell. The
 # previous turn is more than 2.3 below its underside; last treads approach
 # tangentially from the south, so no platform slab cuts across high treads.
 # A single L-shaped deck joins the resting platform and guard support.
 # One top surface removes the beveled V seam and overlapping floor faces.
 outline=[(3.8,-15.6),(9.1,-15.6),(9.1,-11.4),(8.4,-11.4),(8.4,-13.5),(3.8,-13.5)]
 top=[(side*x,6.2,z) for x,z in outline]
 if side>0:top.reverse()
 face(OAK,top);face(DARK,[(x,5.84,z) for x,y,z in reversed(top)])
 for p,q in zip(top,top[1:]+top[:1]):quad(OAK,p,q,(q[0],5.84,q[2]),(p[0],5.84,p[2]))
 collision_box(f'stair-landing-{side}',(side*6.45,6.02,-14.55),(5.3,.36,2.1))
 collision_box(f'stair-guard-sill-{side}',(side*8.75,6.02,-12.45),(.7,.36,2.1))
# Extend the central A-end deck to the tangent stair exits. Square butt
# joints share the landing edges; no overlapping top faces or beveled gaps.
box(OAK,(0,6.02,-14.55),(7.6,.36,2.1))
collision_box('a-end-stair-crosswalk-extension',(0,6.02,-14.55),(7.6,.36,2.1))
# The three mouldings finish the new exposed front below the railing.
for yy,depth,height in [(5.80,.16,.12),(5.99,.20,.16),(6.16,.24,.08)]:
 box(OAK,(0,yy,-13.5),(7.6,height,depth),.012)
# Close the outer floor edge with the same restrained timber profile as the
# gallery fascia. The end-wall collider owns the actual barrier at z=+/-20.
for end in (-1,1):
 for yy,width,height in[(5.66,.27,.18),(5.89,.38,.18),(6.17,.42,.16)]:
  box(OAK,(0,yy,end*20.02),(HALL_WIDTH-.2,height,width),.025)
exec(compile((SRC/'window_helpers.fragment').read_text(),str(SRC/'window_helpers.fragment'),'exec'))
# Outer stone walls with actual tall window openings; wall segments never cover the glass.
MODULE='02_Outer_walls'
for side in(-1,1):
 x=side*12.1
 # A real opening in each lower bay on both sides, with closed sill/head wall bands.
 lower_sill=.8;lower_head=ground_window_y(12.84)
 box(STONE,(x,lower_sill/2,0),(.4,lower_sill,HALL_LENGTH))
 box(STONE,(x,(lower_head+6.8)/2,0),(.4,6.8-lower_head,HALL_LENGTH))
 for z in BOUNDS+[-END_Z,END_Z]:box(STONE,(x,(lower_sill+lower_head)/2,z),(.4,lower_head-lower_sill,2.15 if abs(z)<END_Z else .5))
 for end in(-1,1):box(STONE,(x,(lower_sill+lower_head)/2,end*17.5),(.4,lower_head-lower_sill,5.0))
 for z in BAYS:collegiate_window(side,z,ground=True)
 box(STONE,(x,14.25,0),(.4,2.9,HALL_LENGTH));collision_box(f'outer-wall-{side}',(x,7.7,0),(.4,15.4,HALL_LENGTH))
 for z in BOUNDS+[-END_Z,END_Z]:box(STONE,(x,9.8,z),(.4,6.0,2.15 if abs(z)<END_Z else .5))
 # The end bays contain exhibition walls, not windows. Close the wall band
 # between the last window pier and each end wall instead of exposing void.
 for end in(-1,1):box(STONE,(x,9.8,end*17.5),(.4,6.0,5.0))
 for z in BAYS:collegiate_window(side,z)
# One shared elliptical section keeps the blue soffit inside its timber backing.
ARCADE_HALF=2.13;ARCADE_RISE=1.51;ARCADE_SPRING=3.9;ARCADE_BLUE_THICK=.065;ARCADE_WOOD_THICK=.20;ARCADE_STEPS=64
ARCADE_WOOD_HALF=ARCADE_HALF+ARCADE_BLUE_THICK;ARCADE_WOOD_RISE=ARCADE_RISE+ARCADE_BLUE_THICK
# Lower longitudinal round arcade and upper giant piers.
for side in(-1,1):
 for z in BOUNDS:
  MODULE=f'03_Pier_{side}_{z}'
  fluted_pier(side*5.8,z,0,3.95,.74);collision_box(f'lower-pier-{side}-{z}',(side*5.8,2.7,z),(.95,5.4,.95))
  fluted_pier(side*5.8,z,6.22,7.40,.82,passage_side=True)
  collision_box(f'upper-pier-{side}-{z}',(side*5.8,9.63,z),(.82,6.18,.82))
  collision_box(f'upper-pier-foot-{side}-{z}',(side*5.7475,6.41,z),(.925,.38,1.03))
  # Gallery fascia stays clear: no scholar, niche, plinth or ghost collision.
  # Corbel flare meets the crown rib with a stepped deep capital.
  box(OAK,(side*5.8,13.77,z),(1.38,.22,1.38),.025)
  collision_box(f'upper-pier-cap-{side}-{z}',(side*5.8,13.34,z),(1.4,1.10,1.4))

 for z in BAYS+[-17.5,17.5]:
  MODULE=f'04_Arcade_{side}_{z}'
  arch(OAK,(side*5.8,0,z),ARCADE_WOOD_HALF,ARCADE_SPRING,ARCADE_WOOD_RISE,ARCADE_WOOD_THICK,.57,'x',ARCADE_STEPS)
  arch(EDGE,(side*5.46,0,z),ARCADE_WOOD_HALF,ARCADE_SPRING,ARCADE_WOOD_RISE,.052,.035,'x',ARCADE_STEPS)
  arch_spandrel(OAK,(side*5.8,0,z),ARCADE_WOOD_HALF+ARCADE_WOOD_THICK,ARCADE_SPRING,ARCADE_WOOD_RISE+ARCADE_WOOD_THICK,5.82,.54,'x',ARCADE_STEPS)
  # Close the spring-to-beam shoulder all the way to each shared bay line.
  # The curved outer half-span is only 2.395; leaving it as the panel edge
  # exposed a .21-wide vertical slit above every common pier capital.
  shoulder_half=ARCADE_WOOD_HALF+ARCADE_WOOD_THICK
  for end in(-1,1):
   box(OAK,(side*5.8,(ARCADE_SPRING+5.82)/2,z+end*(shoulder_half+2.5)/2),
       (.54,5.82-ARCADE_SPRING,2.5-shoulder_half))
  # Blue-gray patterned soffit, framed by fine teal bands. The aperture stays open.
  arch(BLUE,(side*5.8,0,z),ARCADE_HALF,ARCADE_SPRING,ARCADE_RISE,ARCADE_BLUE_THICK,.7,'x',ARCADE_STEPS)
  for xx in(5.43,6.17):arch(TEAL,(side*xx,0,z),ARCADE_HALF,ARCADE_SPRING,ARCADE_RISE,ARCADE_BLUE_THICK,.04,'x',ARCADE_STEPS)
  if FULL:
   for k in range(21):
    a=(k+.5)*math.pi/21
    for xx in(5.59,6.01):
     pts=[]
     for u,v in[(0,-.038),(.042,0),(0,.038),(-.042,0),(0,-.038)]:
      t=a+v;pts.append((side*(xx+u),ARCADE_SPRING+(ARCADE_RISE-.004)*math.sin(t),z+(ARCADE_HALF-.004)*math.cos(t)))
     tube('Paint • faded ivory inlay',pts,.012,5)
  # The longitudinal entablature below is continuous across all arcade bays.
  if FULL:
   for off,thick in [(-.38,.08),(-.42,.035)]:arch(OAK if thick>.05 else EDGE,(side*(5.8+off),0,z),2.2,3.9,1.61,thick,.08,'x',28)
   for zz in(-1.92,1.92):rosette(OAK,(side*5.475,5.43,z+zz),.13,'x')
   for t in range(17):
    a=(t+.5)*math.pi/17;yy=3.9+1.59*math.sin(a);zz=z+2.22*math.cos(a);torus(GOLD,(side*5.435,yy,zz),.047,.012,'yz',8)
# Wide double-sided shelves retain real-book scale, rear gap and front inset.
# Heavier .16 back, .24 stiles and .14 boards read as solid timber joinery.
SHELF_BACK=.16;SHELF_BOARD=.14;CASE_STILE_WIDTH=.24;BOOK_DEPTH=.30*.96;BOOK_REAR_GAP=.024;BOOK_FRONT_INSET=.018
SHELF_DEPTH=round(SHELF_BACK+2*(BOOK_REAR_GAP+BOOK_DEPTH+BOOK_FRONT_INSET),6)
BOOK_CENTER=SHELF_BACK/2+BOOK_REAR_GAP+BOOK_DEPTH/2
CASE_STILE_DEPTH=SHELF_DEPTH+.07
UPPER_PASSAGE_STILE_SHIFT=.035
# Transverse bookcases use exact catalog contract. Empty shelves are intentional.
for side in(-1,1):
 for z in BOUNDS:
  for level in(0,1):
   MODULE=f'05_Case_{"L" if side<0 else "R"}_{level}_{z}'
   x0,x1=(6.45,11.4+CASE_WIDTH_EXTENSION) if level==0 else(8.10,11.58+CASE_WIDTH_EXTENSION);cx=side*(x0+x1)/2;width=x1-x0;base=.25 if level==0 else 6.45;pitch=.77 if level==0 else .88;top=base+6*pitch
   box(DARK,(cx,(base+top)/2,z),(width,top-base+.12,SHELF_BACK));collision_box(f'case-back-{side}-{level}-{z}',(cx,(base+top)/2,z),(width,top-base+.15,SHELF_BACK+.02))
   for r in range(7):
    y=base+r*pitch;box(OAK,(cx,y,z),(width,SHELF_BOARD,SHELF_DEPTH),.018)
    for facez in(-SHELF_DEPTH/2-.012,SHELF_DEPTH/2+.012):box(EDGE,(cx,y-.008,z+facez),(width,.075,.04),.01)
   for x in(x0,x1):
    # Rebate the hall-facing end into the widened case, retaining the original
    # 1.805 clear doorway instead of spending it on thicker timber.
    x+=UPPER_PASSAGE_STILE_SHIFT if level==1 and x==x0 else 0
    box(OAK,(side*x,(base+top)/2,z),(CASE_STILE_WIDTH,top-base+.24,CASE_STILE_DEPTH),.023);collision_box(f'case-stile-{side}-{level}-{z}-{x}',(side*x,(base+top)/2,z),(CASE_STILE_WIDTH+.01,top-base+.24,CASE_STILE_DEPTH+.02))
   for endx in(x0,x1):
    endx+=UPPER_PASSAGE_STILE_SHIFT if level==1 and endx==x0 else 0
    for j in range(48):
     u=-(CASE_STILE_DEPTH-.12)/2+j*(CASE_STILE_DEPTH-.12)/48;v=-(CASE_STILE_DEPTH-.12)/2+(j+1)*(CASE_STILE_DEPTH-.12)/48
     a=side*(endx-(CASE_STILE_WIDTH/2)+.02*math.sin(j*math.pi/8)**2);b=side*(endx-(CASE_STILE_WIDTH/2)+.02*math.sin((j+1)*math.pi/8)**2)
     quad(OAK,(a,base+.12,z+u),(b,base+.12,z+v),(b,top-.1,z+v),(a,top-.1,z+u),smooth=True)
   # Shelf bays stay horizontally clear for the app's contiguous real-catalog run.
   for yy,ww,dd in[(base-.13,width+(.245 if level==1 else .32),SHELF_DEPTH+.18),(top+.18,width+.36,SHELF_DEPTH+.18),(top+.33,width+.5,SHELF_DEPTH+.27)]:
    foot_shift=side*.0375 if level==1 and yy<base else 0
    box(OAK,(cx+foot_shift,yy,z),(ww,.20,dd),.018)
   cornice(OAK,(cx,top+.29,z),width+.24,'z',SHELF_DEPTH+.08)
   for endx in(x0,x1):
    endx+=UPPER_PASSAGE_STILE_SHIFT if level==1 and endx==x0 else 0
    for zz in(-SHELF_DEPTH/2-.08,SHELF_DEPTH/2+.08):
     for groove in(-.055,0,.055):tube(DARK,[(side*endx+groove,base+.16,z+zz),(side*endx+groove,top-.06,z+zz)],.011,5)
     rosette(OAK,(side*endx,top+.25,z+zz),.085,'z')
   # Dado cabinet under shelf one, still below the contractual shelf rest height.
   if level==1:
    for xx in range(3):
     xc=side*(x0+(xx+.5)*width/3);panel_frame((xc,6.33,z+CASE_STILE_DEPTH/2+.005),width/3-.1,.16)
# Upper gallery partitions: one coherent wall/screen/case assembly at each bay.
# The visible rounded Gothic doorway leads along the inner gallery; the outer
# edge meets the transverse real-catalog cabinet, with no floating screen gap.
for side in(-1,1):
 for z in BOUNDS:
  MODULE=f'06_Gothic_screen_{side}_{z}';cx=side*7.1125
  half=.9025;spring=9.38;rise=1.43;crown=spring+rise
  # Broad solid side stiles tied into pier and cabinet rather than freestanding posts.
  # The outer jamb is the actual cabinet stile: no duplicate upright inside
  # the doorway. The inner jamb remains tied into the giant pier.
  box(OAK,(side*6.055,8.00,z),(.31,3.56,.49),.025)
  for yy in(6.40,9.38):box(OAK,(side*6.055,yy,z),(.31,.13,.59),.018)
  # Closed timber shoulders following a round arch (visible curved reference top).
  for k in range(40):
   a=k*math.pi/40;b=(k+1)*math.pi/40
   u=half*math.cos(a);uu=half*math.cos(b);y=spring+rise*math.sin(a);yy=spring+rise*math.sin(b)
   for zz in(-.245,.245):quad(OAK,(cx+u,y,z+zz),(cx+uu,yy,z+zz),(cx+uu,10.92,z+zz),(cx+u,10.92,z+zz))
  arch(OAK,(cx,0,z),half,spring,rise,.13,.58,'z',40)
  for facez in(-.32,.32):
   arch(EDGE,(cx,0,z+facez),half+.045,spring,rise,.035,.04,'z',40)
   # Paired lancet cusps remain above head height. Lower doorway stays clear.
   for dx in(-.4075,.4075):carved_arch(cx+dx,z+facez,9.25,.3975,9.73,10.38,.075,.12)
   for sg in(-1,1):relief_leaf(OAK,(cx+sg*.67,10.19,z+facez),.38,.12,-sg*.52,'z',.06)
  pierced_header(cx,z,10.92,12.16,2.13,11.40,.36,.49)
  for sign in(-1,1):
   relief_leaf(OAK,(cx+sign*.83,11.80,z+.26),.39,.11,-sign*.55,'z',.065)
   cylinder(OAK,(cx+sign*.87,12.29,z),.065,.30,10,r2=.016)
  # Paneled frieze continues across the screen and bookcase to the outer wall.
  case_center=side*(9.18+CASE_WIDTH_EXTENSION/2)
  box(OAK,(case_center,12.32,z),(4.42+CASE_WIDTH_EXTENSION,.43,.31),.018)
  cornice(OAK,(side*(8.62+CASE_WIDTH_EXTENSION/2),12.16,z),5.83+CASE_WIDTH_EXTENSION,'z',.59)
  for zz in(-.20,.20):
   for xx in(8.1,9.2,10.3,11.3,12.4):panel_frame((side*xx,12.34,z+zz),.86,.23,'z',EDGE,.07)
  collision_box(f'screen-stile-{side}-{z}-6.055',(side*6.055,8.0,z),(.31,3.6,.52))
  collision_box(f'screen-header-{side}-{z}',(cx,11.48,z),(2.13,1.40,.5))
# Complete all exposed floor edges. Stair aperture returns use the second,
# turned-baluster railing type visible in the close foreground of S01/S03.
MODULE='07_Gallery_railings'
for side in(-1,1):
 rail_side(side*8.62,-11.4,15.6)
 turned_guard(f'aperture-{side}',[(side*8.62,-11.4),(side*8.62,-13.5),(side*5.9,-13.5)],shared_start=True)
rail_end(-13.5,-3.92,3.92)
rail_end(15.6,-8.62,-2.4);rail_end(15.6,2.4,8.62)
# One closed extruded entablature carries every upper pier foot. The former
# per-arch 4.32/4.8-long caps left .68/.20 gaps at each 5-unit bay boundary,
# exposing unrelated rear fascia layers as broken, stepped joints.
GALLERY_BEAM_PROFILE=[(-.37,5.55),(-.37,5.84),(-.48,5.84),(-.48,6.01),
                      (-.40,6.01),(-.40,6.09),(-.43,6.09),(-.43,6.20),
                      (.10,6.20),(.10,5.55)]
# Shared diagonal profile stations stitch each crosswalk fascia to the long
# runs. Omit internal joint caps and overlapping top triangles at the T joins.
for side in(-1,1):
 segments=[(-1,0),(0,0),(1,0)]
 for segment,_ in segments:
  rings=[]
  for station in(0,1):
   ring=[]
   for u,y in GALLERY_BEAM_PROFILE:
    if segment==0:z=(-1 if station==0 else 1)*(15.6+u)
    elif segment<0:z=-END_Z if station==0 else -15.7
    else:z=15.7 if station==0 else END_Z
    ring.append((side*(8.8+u),y,z))
   rings.append(ring)
  if segment<0:face(OAK,rings[0] if side>0 else list(reversed(rings[0])))
  if segment>0:face(OAK,list(reversed(rings[1])) if side>0 else rings[1])
  for i in range(len(GALLERY_BEAM_PROFILE)):
   j=(i+1)%len(GALLERY_BEAM_PROFILE)
   points=[rings[0][i],rings[1][i],rings[1][j],rings[0][j]]
   face(OAK,points if side>0 else list(reversed(points)))
for end in(-1,):
 rings=[[(side*(8.8+u),y,end*(15.6+u)) for u,y in GALLERY_BEAM_PROFILE] for side in(-1,1)]
 for i in range(len(GALLERY_BEAM_PROFILE)):
  j=(i+1)%len(GALLERY_BEAM_PROFILE)
  points=[rings[0][i],rings[1][i],rings[1][j],rings[0][j]]
  face(OAK,list(reversed(points)) if end>0 else points)
# Continuous timber barrel roof; multiple thick arc ribs.
MODULE='08_Main_barrel_vault'
for i in range(64):
 a=i*math.pi/64;b=(i+1)*math.pi/64
 p=lambda t,z:(8.8*math.cos(t),13.8+4.9*math.sin(t),z)
 quad(OAK,p(a,-END_Z),p(b,-END_Z),p(b,END_Z),p(a,END_Z),[(a*2,0),(b*2,0),(b*2,9),(a*2,9)])
 quad(DARK,(p(a,-END_Z)[0],p(a,-END_Z)[1]+.24,-END_Z),(p(a,END_Z)[0],p(a,END_Z)[1]+.24,END_Z),(p(b,END_Z)[0],p(b,END_Z)[1]+.24,END_Z),(p(b,-END_Z)[0],p(b,-END_Z)[1]+.24,-END_Z))
# Fine longitudinal board joints and pegged transverse rib mouldings are geometry.
for i in range(1,38):
 a=i*math.pi/38
 tube(DARK,[(8.795*math.cos(a),13.8+4.895*math.sin(a),-END_Z),(8.795*math.cos(a),13.8+4.895*math.sin(a),END_Z)],.011,5)
for z in BOUNDS+[-END_Z,END_Z]:
 arch(DARK,(0,0,z),8.66,13.8,4.79,.24,.28,'z',48);arch(EDGE,(0,0,z),8.64,13.8,4.76,.045,.33,'z',48)
for side in(-1,1):
 box(OAK,(side*8.76,13.95,0),(.26,.5,HALL_LENGTH),.02)
 box(TEAL,(side*8.59,14.13,0),(.06,.48,HALL_LENGTH-.2))
 if FULL:
  for z in [i-19.5 for i in range(40)]:scroll(GOLD,(side*8.545,14.14,z),.92,.4,'x',.016)
# Separate cross-barrel side vaults with star and diamond decorations.
for side in(-1,1):
 for z in BAYS:
  MODULE=f'09_Side_vault_{side}_{z}'
  for i in range(28):
   a=i*math.pi/28;b=(i+1)*math.pi/28
   p=lambda t,x:(side*x,12.15+2.45*math.sin(t),z+2.45*math.cos(t))
   quad(BLUE,p(a,5.95),p(b,5.95),p(b,11.98+OUTER_AISLE_EXTENSION),p(a,11.98+OUTER_AISLE_EXTENSION),[(a,0),(b,0),(b,2),(a,2)])
  arch(TEAL,(side*6.08,0,z),2.45,12.15,2.45,.19,.36,'x',32)
  for x in(5.87,6.29,11.72,11.72+OUTER_AISLE_EXTENSION/2,11.72+OUTER_AISLE_EXTENSION):arch(GOLD,(side*x,0,z),2.44,12.15,2.44,.033,.04,'x',32)
  if FULL:
   for i in range(16):
    a=(i+.5)*math.pi/16;yy=12.15+2.48*math.sin(a);zz=z+2.48*math.cos(a)
    # Diamond tracery following arch reveal.
    pts=[(side*5.87,yy-.13,zz),(side*5.87,yy,zz+.12),(side*5.87,yy+.13,zz),(side*5.87,yy,zz-.12),(side*5.87,yy-.13,zz)];tube(GOLD,pts,.022,5)
   # Dense pale lozenge/star pattern hugs the curved blue-gray soffit.
   # Ribbon strips are modeled, not a screenshot texture or floating decoration.
   def vp(xx,aa,rr=2.427):return(side*xx,12.15+rr*math.sin(aa),z+rr*math.cos(aa))
   for col in range(int((11.98+OUTER_AISLE_EXTENSION-.225-6.18)/.47)+1):
    xx=6.18+col*.47
    for row in range(14):
     aa=.13+row*(math.pi-.26)/13
     points=[vp(xx-.225,aa),vp(xx,aa-.105),vp(xx+.225,aa),vp(xx,aa+.105),vp(xx-.225,aa)]
     for q,r in zip(points,points[1:]):tube('Paint • faded ivory inlay',[q,r],.009,4)
     if (col+row)%2==0:
      face('Paint • faded ivory inlay',[vp(xx,aa-.063,2.418),vp(xx+.030,aa-.011,2.418),vp(xx+.115,aa,2.418),vp(xx+.030,aa+.011,2.418),vp(xx,aa+.063,2.418),vp(xx-.030,aa+.011,2.418),vp(xx-.115,aa,2.418),vp(xx-.030,aa-.011,2.418)])
   # Three transverse curved mouldings articulate the depth of each side barrel.
   for xx in(6.4,8.95,11.65,11.65+OUTER_AISLE_EXTENSION/2,11.65+OUTER_AISLE_EXTENSION):
    arch(EDGE,(side*xx,0,z),2.40,12.15,2.40,.032,.08,'x',40)
# End A: lower arcade, rear enclosed chamber, large portrait and original geometric frame.
MODULE='10_End_A'
box(STONE,(0,9.5,-18.2),(HALL_WIDTH,19,.4));collision_box('end-a-wall',(0,9.5,-18.2),(HALL_WIDTH,19,.4));box(DARK,(0,16.6,-17.94),(17.7,4.2,.16))
# End aisles stay visually open: no freestanding ground piers or arch screens.
END_ARCADE_CENTERS=(-6.4,-3.2,0,3.2,6.4)
box(DARK,(0,3,-17.93),(17.6,6,.18))
# Four independent framed works replace the end-wall scenery bookcases.
# Keep these shallow, with their collision shells behind the clear crosswalk.
GALLERY_PAINTINGS=[(-10.5,3.6,4.8),(-4.6,3.0,4.0),(4.6,3.0,4.0),(10.5,3.6,4.8)]
material('Canvas • gallery paintings','ffffff',.92,texture='gallery-paintings-original-r7.png')
for index,(x,w,h) in enumerate(GALLERY_PAINTINGS):
 HEIGHT_ANCHOR=None
 # Use the continuous end wall: raised per-picture stone patches cut through
 # the descending cross-barrel soffit and expose tracery across a stepped edge.
 HEIGHT_ANCHOR=9.8
 box(DARK,(x,9.8,-17.72),(w+.24,h+.24,.10),.016)
 for offset,extra,mat,depth in[(0,.40,OAK,.17),(.065,.25,DARK,.10),(.105,.13,GOLD,.055),(.125,.035,EDGE,.035)]:
  panel_frame((x,9.8,-17.60+offset),w+extra,h+extra,mat=mat,depth=depth)
 col=index%2;row=index//2;u0=col*.5+.006;u1=(col+1)*.5-.006;v0=(1-row)*.5+.006;v1=(2-row)*.5-.006
 face('Canvas • gallery paintings',[(x-w/2,9.8-h/2,-17.654),(x+w/2,9.8-h/2,-17.654),(x+w/2,9.8+h/2,-17.654),(x-w/2,9.8+h/2,-17.654)],[(u0,v0),(u1,v0),(u1,v1),(u0,v1)])
 collision_box(f'end-a-art-panel-{x}',(x,9.8,-17.64),(w+.45,h+.45,.32))
HEIGHT_ANCHOR=None
# The exhibition wall carries only the five individually framed artworks.
# User follow-up removes all six floating decorative pilasters and their
# independent surround cornices; the ground arcade remains structural.
# Original illustrative canvas, with layered muted robe shapes instead of a protruding gold figure.
HEIGHT_ANCHOR=10.0
material('Canvas • robe umber','49372c',.93);material('Canvas • warm skin','98784e',.93);material('Canvas • robe shadow','2b2722',.94)
box('Canvas • dark green',(0,10.0,-17.73),(3.0,6.7,.1))
for off,w,h,mat in[(0,3.38,7.1,OAK),(.11,3.17,6.9,DARK),(.16,3.04,6.76,GOLD),(.20,2.93,6.64,OAK)]:panel_frame((0,10.0,-17.58+off),w,h,mat=mat,depth=.12)
carved_arch(0,-17.48,6.44,1.92,12.47,14.3,.27,.55)
for sign in(-1,1):
 for k in range(8):
  t=(k+.4)/8;xx=sign*(1.92*(1-t*t));yy=12.47+(14.3-12.47)*t
  relief_leaf(OAK,(xx,yy,-17.28),.29,.095,-sign*(.35+t*.4),'z',.085)
 for y in(6.61,13.21):rosette(OAK,(sign*1.75,y,-17.28),.19,'z')
box(OAK,(0,6.35,-17.42),(3.9,.32,.63),.04)
collision_box('end-a-portrait-wall',(0,10.35,-17.48),(4.24,8.40,.76))
# Flat original artwork: all paint remains just above the canvas, inside the frame.
portrait_path=texture_path('portrait-scholar-generated-r2.png')
if portrait_path.exists():
 material('Canvas • reference portrait study','ffffff',.91,texture='portrait-scholar-generated-r2.png')
 face('Canvas • reference portrait study',[(-1.3278,6.68,-17.654),(1.3278,6.68,-17.654),(1.3278,13.32,-17.654),(-1.3278,13.32,-17.654)],[(0,0),(1,0),(1,1),(0,1)])
else:
 zpaint=-17.655
 face('Canvas • robe shadow',[(-.72,7.02,zpaint),(.72,7.02,zpaint),(.55,10.68,zpaint),(.2,11.16,zpaint),(-.33,11.06,zpaint),(-.58,10.53,zpaint)])
 face('Canvas • robe umber',[(-.32,11.0,zpaint+.003),(.34,11.0,zpaint+.003),(.62,7.12,zpaint+.003),(-.11,7.1,zpaint+.003)])
 face('Canvas • warm skin',[(.015+.28*math.cos(i*TAU/32),11.6+.37*math.sin(i*TAU/32),zpaint+.006) for i in range(32)])
 face('Canvas • robe shadow',[(-.27,11.82,zpaint+.01),(.19,12.03,zpaint+.01),(.34,11.83,zpaint+.01),(.3,11.59,zpaint+.01),(.08,11.84,zpaint+.01)])
 for sign in(-1,1):
  face('Canvas • robe umber',[(sign*.30,10.77,zpaint+.01),(sign*.75,9.92,zpaint+.01),(sign*.2,9.57,zpaint+.01),(sign*.08,9.84,zpaint+.01),(sign*.43,10.02,zpaint+.01)])
  face('Canvas • warm skin',[(sign*.18+.12*math.cos(i*TAU/16),9.66+.08*math.sin(i*TAU/16),zpaint+.012) for i in range(16)])
  for k in range(3):tube('Canvas • robe shadow',[(sign*(.1+k*.09),10.45,zpaint+.014),(sign*(.14+k*.12),8.95,zpaint+.014),(sign*(.18+k*.12),7.23,zpaint+.014)],.013,4)
# A-end ground exhibition wall: five real textured paintings occupy the
# arcade axes. The former decorative door, handles and silhouette cutouts
# are removed; the sealed rear wall and structural arcade remain intact.
HEIGHT_ANCHOR=None
# Keep low side wainscot outside the central portrait footprint.
for side in(-1,1):
 for j in range(5):
  x=side*(2.24+j*1.26)
  panel_frame((x,.58,-17.71),1.05,.70,'z',OAK,.10)
 for y in(.20,1.0):box(OAK,(side*5.2,y,-17.69),(6.3,.13,.18),.012)
material('Canvas • lower gallery paintings','ffffff',.92,texture='gallery-paintings-original-r7.png')
material('Canvas • lower portrait study','ffffff',.91,texture='portrait-scholar-generated-r2.png')
LOWER_PAINTING_CENTERS=(-6.4,-3.2,0,3.2,6.4)
for x in LOWER_PAINTING_CENTERS:
 yy=2.3;w=1.5;h=3.75 if x==0 else 2.0
 # Paintings and frames keep their local dimensions while their center
 # follows the architectural storey transform, just like the upper artworks.
 HEIGHT_ANCHOR=yy
 box(DARK,(x,yy,-17.69),(w+.12,h+.12,.045),.012)
 panel_frame((x,yy,-17.62),w+.10,h+.10,'z',OAK,.12)
 panel_frame((x,yy,-17.54),w-.08,h-.08,'z',GOLD,.030)
 if x==0:
  mat='Canvas • lower portrait study';uvs=[(0,0),(1,0),(1,1),(0,1)]
 else:
  index=(-6.4,-3.2,3.2,6.4).index(x);col=index%2;row=index//2
  u0=col*.5+.006;u1=(col+1)*.5-.006;v0=(1-row)*.5+.006;v1=(2-row)*.5-.006
  mat='Canvas • lower gallery paintings';uvs=[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]
 face(mat,[(x-w/2,yy-h/2,-17.525),(x+w/2,yy-h/2,-17.525),(x+w/2,yy+h/2,-17.525),(x-w/2,yy+h/2,-17.525)],uvs)
 collision_box(f'end-a-lower-picture-{x}',(x,yy,-17.60),(w+.30,h+.30,.30))
HEIGHT_ANCHOR=None
# The former bronze niche statues are omitted so every painting is unobstructed.
# End B: real wide arch, side open lancets, projecting polygon balcony, blind panel crown.
MODULE='11_End_B';box(STONE,(0,9.5,18.2),(HALL_WIDTH,19,.4));collision_box('end-b-wall',(0,9.5,18.2),(HALL_WIDTH,19,.4));box(DARK,(0,17.85,17.98),(17.7,1.7,.12))
# Upper balcony stays open: omit decorative piers and central/side arch screens.
for x in(-12,-8,-4,0,4,8,12):
 # Blind paired lancets and oculus add a second depth inside each large timber panel.
 for dx in(-.72,.72):carved_arch(x+dx,17.71,12.15,.62,14.72,15.88,.075,.13)
 torus(OAK,(x,16.12,17.68),.34,.055,'xy',32)
 for k in range(4):
  a=k*math.pi/2;torus(OAK,(x+.14*math.cos(a),16.12+.14*math.sin(a),17.68),.14,.022,'xy',16)
 box(DARK,(x,14.6,17.93),(3.84,4.72,.14));pointed(OAK,(x,11.9,17.79),3.55,0,3.0,4.6,.11,.18)
 for xx in(-1.8,1.8):box(OAK,(x+xx,14.5,17.78),(.14,5.2,.18),.015)
collision_box('end-b-picture-wall',(0,14.6,17.75),(24.20,4.80,.55))
for yy in(6.35,12.0,17.2):cornice(OAK,(0,yy,16.65 if yy<13 else 17.6),28.9,'z',.7)
# Continuous B-end balcony: the rear edge butts the crosswalk at z=15.6.
# Its front fascia and floor form a single stitched solid instead of capped
# pieces overlapping a second floor sidewall. Shared miter rings close every
# corner without internal end caps or duplicate coplanar deck faces.
MODULE='11_End_B_Balcony'
BALCONY_PATH=[(-2.4,15.6),(-2.4,14.62),(-1.45,13.9),(1.45,13.9),(2.4,14.62),(2.4,15.6)]
fascia_profile=[(.10,5.55-5.98)]+[(u,y-5.98) for u,y in GALLERY_BEAM_PROFILE[:-1]]
# One path carries the crosswalk front around the projecting balcony.
combined_path=[(-8.8,15.6)]+BALCONY_PATH+[(8.8,15.6)]
combined_rings=mitered_run(OAK,combined_path,5.98,fascia_profile,closed_profile=False,endpoint_offsets=((-1,1),(1,1)),cap_ends=False)
rings=combined_rings[1:-1]
top=[(ring[-1][0],ring[-1][1],min(15.6,ring[-1][2])) for ring in rings]
bottom=[(ring[0][0],ring[0][1],min(15.6,ring[0][2])) for ring in rings]
face(OAK,list(reversed(top)));face(DARK,bottom)
quad(OAK,top[0],bottom[0],bottom[-1],top[-1])
# Match the adjoining gallery's rigid handrail and lower-rail top elevations.
# Both terminal shafts already belong to rail_end; do not stack more posts.
HEIGHT_ANCHOR=6.2
for y,r in[(7.31,.115),(6.34,.10)]:
 mitered_run(OAK,BALCONY_PATH,y,[(r*math.cos(k*TAU/8),r*math.sin(k*TAU/8)) for k in range(8)],smooth=True)
BALCONY_SPINDLES=list(BALCONY_PATH[1:-1])
for (x,z),(xx,zz) in zip(BALCONY_PATH,BALCONY_PATH[1:]):
 distance=math.hypot(xx-x,zz-z);count=math.ceil(distance/.30)
 for k in range(1,count):
  t=k/count;BALCONY_SPINDLES.append((x+(xx-x)*t,z+(zz-z)*t))
 angle=math.atan2(xx-x,zz-z)
 collision_box(f'balcony-rail-{x}-{z}',((x+xx)/2,6.85,(z+zz)/2),(.25,1.3,distance),angle)
for x,z in BALCONY_SPINDLES:
 lathe(OAK,(x,6.34,z),[(0,.055),(.18,.075),(.4,.055),(.62,.082),(.80,.055),(.97,.055)],12)
HEIGHT_ANCHOR=None
collision_box('balcony-floor',(0,5.875,14.95),(4.8,.65,1.6))
# Polygon balcony supports and dark lower pierced screen.
MODULE='11_End_B'
box(DARK,(0,2.9,17.94),(17.6,5.8,.15))
MODULE='11_End_B_Balcony'
box(OAK,(0,5.54,15.68),(7.4,.40,.54))
# The balcony keeps its platform, perimeter guards and horizontal beam;
# the lower ornamental piers, brackets, arch infill and their colliders are removed.
MODULE='11_End_B'
for x in(-5.5,5.5):
 # All panel layers sit against the rear wall, not 1.6 m in front of it.
 # Negative-z is the interior face at this end.
 box(DARK,(x,2.9,17.84),(3.12,5.66,.20))
 panel_frame((x,2.9,17.72),3.0,5.5)
 torus(GOLD,(x,3.8,17.62),.64,.06,'xy',32)
 tube(GOLD,[(x,3.8,17.60),(x,3.8,17.84)],.075,12)
 for k in range(8):
  a=k*TAU/8;tube(GOLD,[(x,3.8,17.61),(x+.56*math.cos(a),3.8+.56*math.sin(a),17.61)],.025,6)
 collision_box(f'end-b-lower-panel-{x}',(x,2.9,17.73),(3.15,5.68,.36))
# Closed double timber door on the B-end ground wall. Door details stay rigid
# while the surrounding hall uses its architectural height transform.
MODULE='11_End_B';HEIGHT_ANCHOR=0
box(DARK,(0,2.36,17.78),(3.16,4.72,.16),.025)
for side in(-1,1):
 x=side*.7375
 box(OAK,(x,2.36,17.66),(1.435,4.64,.16),.028)
 for yy,hh in[(1.24,1.80),(3.38,1.76)]:
  box(DARK,(x,yy,17.566),(1.10,hh,.035),.018)
  panel_frame((x,yy,17.53),1.14,hh+.04,mat=OAK,depth=.08)
 # Paired hardware, two hinges per leaf, and a visible central seam.
 box(GOLD,(side*.18,2.24,17.53),(.09,.38,.035),.012)
 torus(GOLD,(side*.18,2.20,17.477),.085,.018,'xy',24)
 for yy in(.90,3.82):box(GOLD,(side*1.35,yy,17.55),(.12,.22,.035),.01)
for x in(-1.65,1.65):
 box(OAK,(x,2.42,17.61),(.20,4.84,.31),.028)
 box(EDGE,(x,2.42,17.435),(.055,4.76,.04),.009)
box(OAK,(0,4.86,17.61),(3.50,.22,.31),.03)
box(EDGE,(0,4.87,17.435),(3.42,.055,.04),.009)
# A flush sill avoids an invented step while retaining the closed-door shell.
box(OAK,(0,.035,17.62),(3.12,.07,.30),.012)
collision_box('end-b-central-door',(0,2.40,17.60),(3.50,4.80,.36))
HEIGHT_ANCHOR=None
# Twin spiral stairs: actual wedge treads, helical fascia, continuous guarded handrails.
for side in(-1,1):
 MODULE=f'12_Spiral_{"left" if side<0 else "right"}';cx=side*5.9;cz=-13.5;N=40;direction=side;end=0 if side<0 else math.pi;turns=1.25;start=end-direction*TAU*turns;steps=[]
 for i in range(N):
  a=start+direction*TAU*turns*i/N;b=start+direction*TAU*turns*(i+1)/N;yy=6.2*(i+1)/N;ri=.31;ro=2.0
  vs=[]
  for ang in [a+(b-a)*k/4 for k in range(5)]:vs.append((cx+ro*math.cos(ang),yy,cz+ro*math.sin(ang)))
  for ang in [b+(a-b)*k/4 for k in range(5)]:vs.append((cx+ri*math.cos(ang),yy,cz+ri*math.sin(ang)))
  face(OAK,vs);face(DARK,[(x,y-.12,z) for x,y,z in reversed(vs)])
  for p,q in zip(vs,vs[1:]+vs[:1]):quad(OAK,p,q,(q[0],q[1]-.12,q[2]),(p[0],p[1]-.12,p[2]))
  tube(EDGE,[(cx+ri*math.cos(a),yy-.015,cz+ri*math.sin(a)),(cx+ro*math.cos(a),yy-.015,cz+ro*math.sin(a))],.032,8)
  # Both handrails have tread-mounted timber balusters; the inner run
  # hugs the center post, outside the unchanged radius-1.3 walking lane.
  for guard_radius in (1.94,.36):
   mid=(a+b)/2;bx=cx+guard_radius*math.cos(mid);bz=cz+guard_radius*math.sin(mid)
   HEIGHT_ANCHOR=yy
   lathe(OAK,(bx,yy,bz),[(0,.044),(.07,.046),(.1,.032),(.17,.031),(.22,.049),(.29,.065),(.35,.061),(.40,.04),(.50,.027),(.60,.03),(.68,.048),(.74,.055),(.8,.04),(.9,.025),(.97,.034),(1.14,.037)],12)
   HEIGHT_ANCHOR=None
  mid=(a+b)/2
  collision_box(f'stair-tread-{side}-{i}',(cx+1.16*math.cos(mid),yy-.065,cz+1.16*math.sin(mid)),(1.66,.13,.31),-mid)
  steps.append({'x':cx+1.3*math.cos((a+b)/2),'y':yy,'z':cz+1.3*math.sin((a+b)/2)})
 for radius,yadd in[(1.98,1.05),(1.98,.25),(.36,1.05)]:
  pts=[]
  for i in range(160):
   t=i/159;a=start+direction*TAU*turns*t;pts.append((cx+radius*math.cos(a),6.2*t+(.18+yadd)/HEIGHT_SCALE,cz+radius*math.sin(a)))

  if yadd>1:sweep_profile(OAK,pts,(0,1,0),[(-.085,-.045),(.085,-.045),(.105,.02),(.078,.072),(0,.09),(-.078,.072),(-.105,.02)])
  else:tube(IRON,pts,.028,8)
 # Solid profiled outer helical stringer and raised edge beads.
 helix=[]
 for i in range(129):
  t=i/128;a=start+direction*TAU*turns*t
  # Taper the raised outer stringer into the final radial exit instead of
  # leaving a 20 cm timber lip across the flush landing route.
  exit_t=max(0,min(1,(t-(N-2)/N)/(2/N)));lower=.20*exit_t*exit_t*(3-2*exit_t)
  helix.append((cx+1.95*math.cos(a),6.2*t-lower,cz+1.95*math.sin(a)))
 sweep_profile(OAK,helix,(0,1,0),[(-.07,-.21),(.07,-.21),(.09,-.15),(.085,.13),(.06,.2),(-.06,.2),(-.085,.13),(-.09,-.15)])
 for off in(-.16,.14):tube(EDGE,[(x,y+off,z) for x,y,z in helix],.024,6)
 lathe(OAK,(cx,0,cz),[(0,.38),(.2,.42),(.4,.3),(6.05,.28),(6.18,.28)],20)
 COLLISIONS.append({'id':f'stair-center-{side}','shape':'cylinder','center':{'x':cx,'y':3.09,'z':cz},'radius':.4,'height':6.18})
 # Raise the terminal newel above the upper floor to support the inner return.
 HEIGHT_ANCHOR=6.2
 lathe(OAK,(cx,6.2,cz),[(0,.19),(.12,.20),(.22,.14),(1.08,.14),(1.16,.20),(1.23,.20)],16)
 HEIGHT_ANCHOR=None
 COLLISION_HEIGHT_ANCHORS[f'stair-inner-newel-{side}']=6.2
 COLLISIONS.append({'id':f'stair-inner-newel-{side}','shape':'cylinder','center':{'x':cx,'y':6.815,'z':cz},'radius':.2,'height':1.23})
 # The center extension now supports both sides of this former edge.
 # Its longitudinal guard would divide the continuous upper platform.
 # The new transverse guard's endpoint newel receives the outer helix.
 # Every guard follows its own tread elevation; a full-height cylinder
 # invents a wall at the upper exit and does not describe the helical model.
 for i in range(N):
  a=start+direction*TAU*turns*i/N;b=start+direction*TAU*turns*(i+1)/N;yy=6.2*(i+1)/N
  for guard_name,guard_radius in [('outer',1.98),('inner',.36)]:
   guard_id=f'stair-{guard_name}-guard-{side}-{i}'
   COLLISION_HEIGHT_ANCHORS[guard_id]=yy
   COLLISIONS.append({'id':guard_id,'shape':'arc','center':{'x':cx,'y':yy+.58,'z':cz},'radius':guard_radius,'radialDepth':.21,'height':1.16,'startAngle':min(a,b),'endAngle':max(a,b),'segments':2})
 # Tangent top outlet: the outer helix ends at the perimeter guard newel.
 # A short radial inner return meets the center newel outside the walk lane.
 for radius,yadd,terminal_x in [(1.98,1.05,cx-side*1.98),(.36,1.05,cx)]:
  rail_end_point=(cx+radius*math.cos(end),6.2+(.18+yadd)/HEIGHT_SCALE,cz)
  terminal=(terminal_x,6.2+1.16/HEIGHT_SCALE,cz)
  tube(OAK,[rail_end_point,terminal],.06,10)
 ROUTES['left' if side<0 else 'right']={'center':{'x':cx,'y':0,'z':cz},'outerRadius':2.,'innerRadius':.31,'walkingRadius':1.3,'rise':6.2,'turns':turns,'direction':direction,'startAngle':start,'endAngle':end,'steps':N,'route':[{'x':cx+side*2.3,'y':0,'z':cz+1.3},{'x':steps[0]['x'],'y':0,'z':steps[0]['z']}]+steps+[{'x':cx-side*1.3,'y':6.2,'z':cz},{'x':cx-side*1.3,'y':6.2,'z':-16.5}], 'aperture':{'xMin':cx-2.1,'xMax':cx+2.1,'zMin':-15.6,'zMax':-11.4},'landing':{'center':{'x':side*6.45,'y':6.2,'z':-15.6},'size':{'x':5.3,'z':4.2},'openingWidth':1.98}}
# Reading furniture and useful visual props. No books, writing paper, people or duplicate catalog objects.
HEIGHT_ANCHOR=0
MODULE='13_Reading_furniture'
SHELF_FRONT_FURNITURE={'lowerLecterns':0,'upperDeskChairSets':0,'attachedLamps':0,'colliders':0}
def lamp(x,y,z):
 scale=.75
 lathe(GOLD,(x,y,z),[(a*scale,b*scale) for a,b in [(0,.2),(.06,.21),(.1,.13),(.18,.09),(.35,.065),(.4,.1),(.47,.06)]],24)
 lathe('Glass • green shade',(x,y+.45*scale,z),[(a*scale,b*scale) for a,b in [(0,.32),(.04,.34),(.15,.29),(.25,.18),(.29,.04)]],48)
 cylinder('Light • candle',(x,y+.46*scale,z),.21*scale,.035*scale,32)
for z in(-6.2,2.0):
 box(OAK,(0,1.13,z),(2.8,.22,6.25),.075);box('Leather • desk inset',(0,1.249,z),(1.84,.018,5.87),.025)
 # Thin inset edging, restrained upholstery pins, paneled table aprons and stretchers.
 for x in(-.947,.947):box(DARK,(x,1.257,z),(.035,.018,5.94),.007)
 for dz in(-2.965,2.965):box(DARK,(0,1.257,z+dz),(1.93,.018,.035),.007)
 for x in(-.965,.965):
  for j in range(30):sphere(GOLD,(x,1.265,z-2.9+j*.2),.012,6,4)
 for x in(-1.17,1.17):
  box(OAK,(x,.96,z),(.12,.26,5.68),.025)
  for dz in(-1.8,-.6,.6,1.8):panel_frame((x,.95,z+dz),1.0,.15,'x',DARK,.03)
 box(OAK,(0,.27,z),(.18,.20,4.96),.028)
 for dz in(-2.4,2.4):box(OAK,(0,.27,z+dz),(2.13,.17,.2),.028)
 for x in(-.94,.94):
  for dz in(-2.4,2.4):lathe(OAK,(x,0,z+dz),[(0,.16),(.12,.17),(.23,.12),(.45,.11),(.58,.2),(.71,.19),(.84,.1),(1.04,.13)],16)
 for x in(-2.0,2.0):
  box(OAK,(x,.59,z),(.65,.18,6.1),.055)
  for dz in(-2.3,2.3):box(OAK,(x,.28,z+dz),(.4,.55,.5),.03)
  box(OAK,(x,.25,z),(.14,.17,4.9),.025)
  for end in(-2.3,2.3):
   for sg in(-1,1):tube(OAK,[(x+sg*.23,.1,z+end),(x+sg*.15,.38,z+end),(x+sg*.27,.54,z+end)],.047,8)
  collision_box(f'bench-{x}-{z}',(x,.35,z),(.7,.7,6.1))
 collision_box(f'table-{z}',(0,.7,z),(2.8,1.4,6.25))
 for dz in(-1.75,1.75):lamp(0,1.26,z+dz)
# The former small shelf-front lecterns and upper desk/chair/lamp sets are
# intentionally absent. The two remaining central long tables, four benches and
# reception furniture remain.
# The foreground reading table, its benches and lamps are replaced by the
# existing floor-standing globe. Keep one globe and move its collision with it.
HEIGHT_ANCHOR=6.2
MODULE='14_Globe';gx,gz=0,-15.0;gy=1.57;gr=.82
sphere('Globe • parchment',(gx,gy,gz),gr,64,40)
# Original approximate atlas silhouettes, projected onto a true sphere.
continents=[ [(-168,67),(-130,70),(-109,57),(-91,52),(-65,50),(-57,32),(-81,10),(-97,18),(-107,31),(-126,43),(-149,54)], [(-81,11),(-61,7),(-43,-4),(-36,-13),(-50,-27),(-68,-55),(-75,-31),(-80,-5)], [(-17,34),(4,38),(31,31),(50,12),(42,-11),(31,-34),(16,-35),(6,-20),(-8,3),(-17,18)], [(-10,36),(-5,57),(20,71),(57,70),(87,77),(133,58),(162,60),(171,45),(142,33),(124,8),(104,-7),(78,6),(63,24),(37,31),(24,42)], [(112,-11),(136,-10),(153,-23),(146,-39),(127,-35),(114,-25)], [(-48,60),(-20,65),(-26,81),(-52,82),(-64,72)] ]
def geo(lon,lat,r=gr+.007):
 a=math.radians(lon+36);b=math.radians(lat)
 return(gx+r*math.cos(b)*math.cos(a),gy+r*math.sin(b),gz+r*math.cos(b)*math.sin(a))
from mathutils.geometry import tessellate_polygon
# Triangulate each genuinely concave atlas outline before refinement. The old
# centroid fan overlapped concave edges and its long chords cut into the sphere.
# Every final land edge is at most 4 degrees in lon/lat, keeping its entire
# projected triangle outside the base sphere, not merely its vertices.
def globe_land_triangle(a,b,c):
 pairs=[(a,b,c),(b,c,a),(c,a,b)]
 u,v,w=max(pairs,key=lambda t:math.hypot(t[0][0]-t[1][0],t[0][1]-t[1][1]))
 if math.hypot(u[0]-v[0],u[1]-v[1])>4.0:
  mid=((u[0]+v[0])/2,(u[1]+v[1])/2)
  globe_land_triangle(u,mid,w);globe_land_triangle(mid,v,w);return
 points=[geo(p[0],p[1]) for p in(a,b,c)]
 normal=(Vector(points[1])-Vector(points[0])).cross(Vector(points[2])-Vector(points[0]))
 outward=sum((Vector(q)-Vector((gx,gy,gz)) for q in points),Vector((0,0,0)))
 if normal.dot(outward)<0:points[1],points[2]=points[2],points[1]
 face('Globe • land',points,smooth=True)
for continent in continents:
 outline=[Vector((lon,lat,0)) for lon,lat in continent]
 for tri in tessellate_polygon([outline]):
  globe_land_triangle(*[tuple((outline[p] if isinstance(p,int) else p)[:2]) for p in tri])
for lon in range(-180,180,30):tube(GOLD,[geo(lon,lat,gr+.014) for lat in range(-88,89,4)],.0027,4)
for lat in range(-60,61,30):tube(GOLD,[geo(lon,lat,gr+.014) for lon in range(-180,181,4)],.0027,4)
# Engraved horizon rim, meridian ring and degree ticks, supported on four legs.
for r,t,mat in[(1.02,.065,OAK),(.985,.014,GOLD),(1.06,.014,GOLD)]:torus(mat,(gx,gy,gz),r,t,'xz',80)
pts=[]
for k in range(97):
 a=k*TAU/96;xx=.91*math.cos(a);yy=.91*math.sin(a)
 pts.append((gx+xx*math.cos(.28)-yy*math.sin(.28),gy+xx*math.sin(.28)+yy*math.cos(.28),gz))
tube(GOLD,pts,.031,8)
for k in range(72):
 a=k*TAU/72;r0=.976;r1=1.049 if k%6==0 else 1.026
 tube(GOLD,[(gx+r0*math.cos(a),gy+.063,gz+r0*math.sin(a)),(gx+r1*math.cos(a),gy+.063,gz+r1*math.sin(a))],.004,4)
for k in range(4):
 a=math.pi/4+k*TAU/4;dx,dz=math.cos(a),math.sin(a)
 lathe(OAK,(gx+.79*dx,0,gz+.79*dz),[(0,.11),(.08,.14),(.14,.105),(.35,.060),(.52,.077),(.73,.055),(.98,.077),(1.14,.055),(1.39,.080)],16)
 tube(OAK,[(gx+.79*dx,1.34,gz+.79*dz),(gx+.96*dx,1.48,gz+.96*dz),(gx+1.02*dx,gy,gz+1.02*dz)],.055,8)
 tube(OAK,[(gx,.33,gz),(gx+.48*dx,.29,gz+.48*dz),(gx+.79*dx,.33,gz+.79*dz)],.041,8)
lathe(OAK,(gx,.10,gz),[(0,.20),(.13,.13),(.27,.18),(.35,.10)],24)
# Lift the whole instrument as one rigid assembly onto the A-end platform.
# The shared height anchor then raises its base to the final gallery floor.
for (module,_material),data in BUILD.items():
 if module=='14_Globe':data.v=[(x,by,bz+6.2) for x,by,bz in data.v]
collision_box('globe',(gx,6.2+1.25,gz),(2.24,2.5,2.24))
HEIGHT_ANCHOR=None
# Lower arcade entrances stay open: the four iron gates and their collisions are removed.
# Suspended multi-ring chandeliers: cables terminate on the actual roof crown.
def chandelier(z,y=12.9,small=False,x=0):
 global MODULE,HEIGHT_ANCHOR
 previous_anchor=HEIGHT_ANCHOR;HEIGHT_ANCHOR=y
 MODULE=f'16_Chandelier_{x}_{z}';scale=.38 if small else 1
 COLLISION_HEIGHT_ANCHORS[f'chandelier-body-{x}-{z}']=y
 COLLISIONS.append({'id':f'chandelier-body-{x}-{z}','shape':'cylinder','center':{'x':x,'y':y+( .30 if small else 1.25),'z':z},'radius':1.55*scale,'height':1.2*scale if small else 3.05})
 for r,yy in[(1.4,0),(.93,1.28),(.43,2.25)]:
  if small and yy>0:continue
  torus(IRON,(x,y+yy*scale,z),r*scale,.072*scale,'xz',48)
  torus(GOLD,(x,y+.13*scale+yy*scale,z),r*scale,.023*scale,'xz',48)
  n=12 if yy==0 else 8
  for j in range(n):
   a=j*TAU/n;xx=x+r*scale*math.cos(a);zz=z+r*scale*math.sin(a)
   cylinder(GOLD,(xx,y+(yy+.18)*scale,zz),.11*scale,.12*scale,12)
   cylinder('Paper • ivory candle',(xx,y+(yy+.42)*scale,zz),.055*scale,.4*scale,12)
   sphere('Light • candle',(xx,y+(yy+.64)*scale,zz),.06*scale,8,6)
  for j in range(6):
   a=j*TAU/6;pts=[]
   for k in range(21):
    t=k/20;rr=r*scale*(1-t)*(.85+.3*math.sin(t*math.pi));pts.append((x+rr*math.cos(a),y+(yy+1.25*t)*scale,z+rr*math.sin(a)))
   tube(IRON,pts,.04*scale,7)
 roof=5.74 if small else 18.58  # Gallery slab underside is 5.97 - .46 / 2.
 HEIGHT_ANCHOR=None
 tube(IRON,[(x,y+.2/HEIGHT_SCALE,z),(x,roof,z)],.035*scale,8)
 HEIGHT_ANCHOR=y
 sphere(IRON,(x,y-.23*scale,z),.16*scale,16,8)
 HEIGHT_ANCHOR=previous_anchor
for z in(-8,1,10):chandelier(z)
for side in(-1,1):
 for z in BAYS:chandelier(z,4.6,True,side*8.9)
# Both end-wall assemblies move outward as complete architectural units. Central
# six bays, shelf modules and stair anchors stay fixed. The B balcony keeps its
# original inner projection because moving it with the wall leaves only 0.3 m
# beyond the gallery rail. It joins the extended crosswalk floor and retains all
# floor, guard and support collisions.
END_MODULE_SHIFT={'10_End_A':-END_EXTENSION,'11_End_B':END_EXTENSION}
for (module,mat),data in BUILD.items():
 if module in END_MODULE_SHIFT:
  # Mesh vertices are Blender (x,-z,y); shift architecture z through axis 1.
  dz=END_MODULE_SHIFT[module];data.v=[(x,y-dz,z) for x,y,z in data.v]
for c in COLLISIONS:
 if c['id'].startswith('end-a-'):
  c['center']['z']+=END_MODULE_SHIFT['10_End_A']
 elif c['id'].startswith('end-b-') and not c['id'].startswith('end-b-balcony-pier-'):
  c['center']['z']+=END_MODULE_SHIFT['11_End_B']
def generated_z_bounds(module_name):
 values=[-v[1] for (module,_mat),data in BUILD.items() if module==module_name for v in data.v]
 return min(values),max(values)
assert -20.5<generated_z_bounds('10_End_A')[0]<-20.0
assert 17.0<generated_z_bounds('11_End_B')[0] and generated_z_bounds('11_End_B')[1]>20.0
balcony_bounds=generated_z_bounds('11_End_B_Balcony')
assert balcony_bounds[0]<14.0 and balcony_bounds[1]>15.8,balcony_bounds
# Width-only translation of complete side modules. No length/height/furniture scaling.
SIDE_PREFIXES=('02_','03_','04_','05_','06_','09_','15_')
for (module,mat),data in BUILD.items():
 if module.startswith(SIDE_PREFIXES) or (module.startswith('16_Chandelier_') and not module.startswith('16_Chandelier_0_')):
  data.v=[(x+(3 if x>0 else -3),by,bz) for x,by,bz in data.v]
for c in COLLISIONS:
 if c['id'].startswith(('outer-wall-','lower-pier-','upper-pier-','case-back-','case-stile-','screen-stile-','screen-header-')):
  c['center']['x']+=3 if c['center']['x']>0 else -3
for c in COLLISIONS:
 if c['id'].startswith('chandelier-body-') and c['center']['x']!=0:c['center']['x']+=3 if c['center']['x']>0 else -3
# Move only the outside stone/window assembly; shelf capacity, piers, stairs,
# inner gallery and catalog anchors retain their coordinates and proportions.
for (module,mat),data in BUILD.items():
 if module=='02_Outer_walls':
  data.v=[(x+(OUTER_AISLE_EXTENSION if x>0 else -OUTER_AISLE_EXTENSION),by,bz) for x,by,bz in data.v]
for c in COLLISIONS:
 if c['id'].startswith('outer-wall-'):
  c['center']['x']+=OUTER_AISLE_EXTENSION if c['center']['x']>0 else -OUTER_AISLE_EXTENSION
# Finish both end galleries with the same cross-barrel language as the side
# bays. These are final x coordinates, after the width translations above.
MODULE='09_End_gallery_vaults'
for side in(-1,1):
 for z in BOUNDS:
  box(BLUE,(side*(8.95+(OUTER_WALL_X+.08))/2,12.15,z),((OUTER_WALL_X+.08)-8.95,.12,.12))
 for end in(-1,1):
  z=end*17.5
  def ep(t,x,lift=0):return(side*x,12.15+2.45*math.sin(t)+lift,z+2.5*math.cos(t))
  for i in range(48):
   a=i*math.pi/48;b=(i+1)*math.pi/48
   quad(BLUE,ep(a,8.95),ep(b,8.95),ep(b,(OUTER_WALL_X+.08)),ep(a,(OUTER_WALL_X+.08)),[(a,0),(b,0),(b,2),(a,2)])
   quad(DARK,ep(a,8.95,.16),ep(a,(OUTER_WALL_X+.08),.16),ep(b,(OUTER_WALL_X+.08),.16),ep(b,8.95,.16))
  for xx in(9.08,12.0,14.65,17.1,OUTER_WALL_X-.22):
   # The visible rib projects into the room; its back overlaps the shell.
   # A ring starting exactly on the soffit produces coplanar brown flicker.
   arch(EDGE,(side*xx,0,z),2.45,12.15,2.40,.065,.08,'x',48)
  if FULL:
   for col in range(int((OUTER_WALL_X+.08-.225-9.18)/.47)+1):
    xx=9.18+col*.47
    for row in range(14):
     aa=.13+row*(math.pi-.26)/13
     def ev(x,t):return(side*x,12.15+2.427*math.sin(t),z+2.477*math.cos(t))
     points=[ev(xx-.225,aa),ev(xx,aa-.105),ev(xx+.225,aa),ev(xx,aa+.105),ev(xx-.225,aa)]
     for q,r in zip(points,points[1:]):tube('Paint • faded ivory inlay',[q,r],.009,4)
# A narrow timber roof transition seals the .15-wide main/side separation.
# Use exactly the side barrel vertices, including flat inter-bay seams, so
# there are no tiny wedges between independently tessellated curved roofs.
MODULE='09_Vault_junctions'
sections=[]
for z in BAYS:
 sections.append([(z+2.45*math.cos(i*math.pi/28),12.15+2.45*math.sin(i*math.pi/28)) for i in range(29)])
for end in(-1,1):
 sections.append([(end*17.5+2.5*math.cos(i*math.pi/48),12.15+2.45*math.sin(i*math.pi/48)) for i in range(49)])
for z in BOUNDS:sections.append([(z-.05,12.15),(z+.05,12.15)])
for side in(-1,1):
 for section in sections:
  for (za,ya),(zb,yb) in zip(section,section[1:]):
   quad(OAK,(side*8.79,13.8,za),(side*8.79,13.8,zb),(side*8.97,yb,zb),(side*8.97,ya,za))
   quad(DARK,(side*8.79,13.96,za),(side*8.97,ya+.16,za),(side*8.97,yb+.16,zb),(side*8.79,13.96,zb))
# Final-coordinate shells remain tied to the profiles above.
exec(compile((SRC/'walk_clearance_colliders.fragment').read_text(),str(SRC/'walk_clearance_colliders.fragment'),'exec'))
# Regression guard on actual generated vertices, before material batching.
fixture_modules={module for module,mat in BUILD if module.startswith('16_Chandelier_')}
small_fixture_tops=[];main_fixture_tops=[]
for module in fixture_modules:
 top=max(v[2] for (name,mat),data in BUILD.items() if name==module for v in data.v)
 if module.startswith('16_Chandelier_0_'):
  assert abs(top-18.58)<1e-6, (module,top)
  main_fixture_tops.append(top)
 else:
  assert abs(top-5.74)<1e-6, (module,top)
  small_fixture_tops.append(top)
assert len(small_fixture_tops)==12 and len(main_fixture_tops)==3
FIXTURE_CHECKS={'smallFixtureCount':12,'mainFixtureCount':3,'smallFixtureMaximumY':max(small_fixture_tops),'galleryUndersideY':5.74,'mainFixtureMaximumY':max(main_fixture_tops),'passed':True}
assert not any(module.startswith('18_Upper_reading_bay_') for module,mat in BUILD)
assert not any(c['id'].startswith(('upper-desk-','upper-chair-','lectern-')) for c in COLLISIONS)
table_colliders=[c for c in COLLISIONS if c['id'].startswith('table-')]
bench_colliders=[c for c in COLLISIONS if c['id'].startswith('bench-')]
assert len(table_colliders)==2 and len(bench_colliders)==4
SHELF_FRONT_CHECKS={**SHELF_FRONT_FURNITURE,'mainLongTables':len(table_colliders),'mainBenches':len(bench_colliders),'passed':True}
crosswalk_colliders={c['id']:c for c in COLLISIONS if c['id'].startswith('crosswalk-')}
assert set(crosswalk_colliders)=={'crosswalk--17.8','crosswalk-17.8'}
for item in crosswalk_colliders.values():
 assert item['size']=={'x':17.6,'y':.46,'z':CROSSWALK_DEPTH}
end_walls={c['id']:c for c in COLLISIONS if c['id'] in ('end-a-wall','end-b-wall')}
assert end_walls['end-a-wall']['center']['z']==-20.2 and end_walls['end-b-wall']['center']['z']==20.2
balcony_floor=next(c for c in COLLISIONS if c['id']=='balcony-floor')
assert balcony_floor['center']['z']==14.95 and balcony_floor['size']['z']==1.6
assert not any(c['id'].startswith('end-b-upper-pier-') for c in COLLISIONS)
for side in(-1,1):
 outer=next(c for c in COLLISIONS if c['id']==f'outer-wall-{side}')
 assert outer['size']['z']==HALL_LENGTH
CROSSWALK_CHECKS={'length':HALL_LENGTH,'endA':-END_Z,'endB':END_Z,'endExtension':END_EXTENSION,'innerZ':CROSSWALK_INNER_Z,'outerZ':END_Z,'depth':CROSSWALK_DEPTH,'centralWidth':17.6,'sideGallerySeamX':8.8,'centralXMin':-10.1,'centralXMax':10.1,'bodyRadius':.3,'requiredBodyClearBand':2.0,'passed':True}
# Apply one architectural height transform to the finalized source coordinates.
# Rigid local anchors preserve furniture, paintings and guardrail sizes.
for data in BUILD.values():
 assert len(data.height_anchors)==len(data.v)
 data.v=[(x,by,bz*HEIGHT_SCALE if anchor is None else bz+anchor*(HEIGHT_SCALE-1)) for (x,by,bz),anchor in zip(data.v,data.height_anchors)]
for c in COLLISIONS:
 anchor=COLLISION_HEIGHT_ANCHORS.get(c['id'])
 c['center']['y']=c['center']['y']*HEIGHT_SCALE if anchor is None else c['center']['y']+anchor*(HEIGHT_SCALE-1)
 if anchor is None:
  if 'size' in c:c['size']['y']*=HEIGHT_SCALE
  if 'height' in c:c['height']*=HEIGHT_SCALE
# Cable shells begin at the translated fixture body, then reach the raised roof.
for c in COLLISIONS:
 if c['id'].startswith('chandelier-suspension-'):
  bottom=15.675+12.9*(HEIGHT_SCALE-1);top=18.58*HEIGHT_SCALE
  c['center']['y']=(bottom+top)/2;c['height']=top-bottom
for route in ROUTES.values():
 route['rise']*=HEIGHT_SCALE
 route['center']['y']*=HEIGHT_SCALE
 route['landing']['center']['y']*=HEIGHT_SCALE
 for point in route['route']:point['y']*=HEIGHT_SCALE
for key in ('smallFixtureMaximumY','galleryUndersideY','mainFixtureMaximumY'):FIXTURE_CHECKS[key]*=HEIGHT_SCALE
# Assemble editable modules into collections, preserving meaningful names and UVs.
MESH_INTEGRITY=[]
def create_mesh(name,data,mat,collection):
 # Weld coincident vertices so tube/ring normals really interpolate and glTF can share vertices.
 unique=[];remap=[];lookup={}
 for point in data.v:
  key=tuple(round(c,7) for c in point)
  if key not in lookup:lookup[key]=len(unique);unique.append(point)
  remap.append(lookup[key])
 # Welding collapses repeated pole/cusp/closed-loop vertices. Keep each
 # surviving corner's original UV while removing only zero-area or duplicate
 # topology; this prevents the exporter from silently deleting visible faces.
 faces=[];corner_uv=[];smooth_flags=[];seen_faces=set();zero_area=duplicate_faces=collapsed_corners=0
 for source_face,smooth in zip(data.f,data.s):
  corners=[];seen_vertices=set()
  for index in source_face:
   vertex=remap[index]
   if vertex in seen_vertices:collapsed_corners+=1;continue
   seen_vertices.add(vertex);corners.append((vertex,data.uv[index]))
  # Long closed drapery/profile n-gons may contain straight boundary runs.
  # Remove collinear intermediate corners before glTF triangulation so its
  # fan never emits a zero-area triangle after float32 serialization.
  if len(corners)>4:
   changed=True
   while changed and len(corners)>3:
    changed=False
    for k in range(len(corners)):
     a=Vector(unique[corners[k-1][0]]);b=Vector(unique[corners[k][0]]);c=Vector(unique[corners[(k+1)%len(corners)][0]])
     u=b-a;v=c-b
     if u.cross(v).length_squared < 1e-10*max(1e-20,u.length_squared*v.length_squared) and u.dot(v)>=0:
      corners.pop(k);collapsed_corners+=1;changed=True;break
  if len(corners)<3:zero_area+=1;continue
  ids=tuple(c[0] for c in corners)
  area=Vector((0,0,0))
  for ia,ib in zip(ids,ids[1:]+ids[:1]):area+=Vector(unique[ia]).cross(Vector(unique[ib]))
  if area.length_squared<1e-18:zero_area+=1;continue
  key=tuple(sorted(ids))
  if key in seen_faces:duplicate_faces+=1;continue
  seen_faces.add(key);faces.append(ids);corner_uv.extend(c[1] for c in corners);smooth_flags.append(smooth)
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(unique,[],faces);mesh.update();uv=mesh.uv_layers.new(name='UVMap')
 for loop,coord in zip(uv.data,corner_uv):loop.uv=coord
 for poly,smooth in zip(mesh.polygons,smooth_flags):poly.use_smooth=smooth
 assert mesh.validate(verbose=False) is False, 'Unexpected mesh repair would alter exported topology: '+name
 MESH_INTEGRITY.append({'mesh':name,'sourceFaces':len(data.f),'validFaces':len(faces),'collapsedRepeatedCorners':collapsed_corners,'zeroAreaFacesRemoved':zero_area,'exactDuplicateFacesRemoved':duplicate_faces,'blenderValidationChangedMesh':False})
 # Freeze the same triangulation used by export and discard only zero-area
 # float32 triangles. This covers near-collinear corners that become exactly
 # collinear only after Blender stores them at final precision.
 mesh.calc_loop_triangles();tri_faces=[];tri_uv=[];tri_smooth=[];removed_triangles=0
 for tri in mesh.loop_triangles:
  pts=[tuple(float(v) for v in mesh.vertices[i].co) for i in tri.vertices]
  u=[pts[1][j]-pts[0][j] for j in range(3)];v=[pts[2][j]-pts[0][j] for j in range(3)]
  cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
  if sum(c*c for c in cross)<1e-18:removed_triangles+=1;continue
  tri_faces.append(tuple(tri.vertices));tri_uv.extend(tuple(uv.data[i].uv) for i in tri.loops);tri_smooth.append(mesh.polygons[tri.polygon_index].use_smooth)
 clean=bpy.data.meshes.new(name+' / validated triangles');clean.from_pydata([tuple(v.co) for v in mesh.vertices],[],tri_faces);clean.update();clean_uv=clean.uv_layers.new(name='UVMap')
 for loop,coord in zip(clean_uv.data,tri_uv):loop.uv=coord
 for poly,smooth in zip(clean.polygons,tri_smooth):poly.use_smooth=smooth
 assert clean.validate(verbose=False) is False
 MESH_INTEGRITY[-1]['zeroAreaTriangulationFacesRemoved']=removed_triangles
 bpy.data.meshes.remove(mesh);mesh=clean
 mesh.materials.append(MATS[mat]);ob=bpy.data.objects.new(name,mesh);collection.objects.link(ob);return ob
objects=[]
for (module,mat),data in BUILD.items():
 if module not in COLLECTIONS:
  col=bpy.data.collections.new(module);bpy.context.scene.collection.children.link(col);COLLECTIONS[module]=col
 ob=create_mesh(module+' / '+mat,data,mat,COLLECTIONS[module]);ob['module']=module;ob['source']='User reference screenshots S01–S09; dimensions estimated';objects.append(ob)
print('STRUCTURE_READY',len(objects),len(MATS),sum(len(d.f) for d in BUILD.values()),flush=True)
# Fixed, documented reference-comparison cameras and genuinely rendered lighting.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=False;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3;scene.cycles.caustics_reflective=False;scene.cycles.caustics_refractive=False;scene.cycles.sample_clamp_indirect=3
scene.render.resolution_x=args.width;scene.render.resolution_y=round(args.width*9/16);scene.render.resolution_percentage=100
scene.world.color=(.1,.1,.1);scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.43,.5,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.6
lighting=bpy.data.collections.new('90_Preview_lights_not_exported');scene.collection.children.link(lighting)
def light(name,loc,energy,color,size=5,target=None,kind='AREA'):
 loc=(loc[0],loc[1]*HEIGHT_SCALE,loc[2]);target=(target[0],target[1]*HEIGHT_SCALE,target[2]) if target else None
 data=bpy.data.lights.new(name,kind);data.energy=energy;data.color=color
 if kind=='AREA':data.shape='DISK';data.size=size
 ob=bpy.data.objects.new(name,data);lighting.objects.link(ob);ob.location=V(loc)
 if target:ob.rotation_euler=(Vector(V(target))-ob.location).to_track_quat('-Z','Y').to_euler()
 return ob
for side in(-1,1):
 for z in BAYS:light(f'window_{side}_{z}',(side*14.72,10.3,z),1250,(.8,.87,1),4,(0,4,z))
for side in(-1,1):
 for z in BAYS:light(f'bay_chandelier_{side}_{z}',(side*11.9,4.8,z),95,(1,.82,.60),1.2,(side*12.6,1.5,z))
for z in(-8,1,10):
 light(f'chandelier_bounce_{z}',(0,13.6,z),480,(1,.82,.60),4,(0,0,z));light(f'roof_bounce_{z}',(0,10,z),280,(.96,.87,.74),5,(0,18,z))
for z in(-14,0,14):light(f'ambient_readability_{z}',(0,5,z),270,(1,.91,.80),5,(0,0,z))
camera_defs={
 'ground-to-a':([0,2.4,12.2],[0,8,-14.4],21),
 'ground-to-b':([-1.9,2.5,-10.0],[.3,7.0,16.0],23),
 'gallery-diagonal':([-5.1,8.25,9.4],[4.9,9.35,-6.3],20),
 'gallery-vault':([-4.7,8.5,12.2],[0,13,-8],18),
 'side-bay-study':([0,6.2,11.0],[10.5,6.7,0],23),
 'detail-gallery-kit':([5.8,8.35,4.8],[9.5,9.2,.15],35),
 'detail-stair-kit':([2.3,3.2,-8.8],[6.8,3.7,-13.5],32),
 'reference-a-elevated':([0,5.3,7.6],[0,7.45,-15.7],25),
 'reference-side-elevated':([-4.4,5.9,8.0],[10.2,8.4,-2.5],24),
 'detail-globe':([3.6,8.8,-10.6],[0,7.51,-15.0],40),
 'detail-column-statue':([0,8.95,5.8],[8.68,9.5,0],24),
 'detail-sculpture':([4.4,6.5,2.1],[8.29,6.12,0],42),
 'upper-corridor':([9.88,7.78,13.9],[9.95,8.1,-10],30),
 'stair-gallery-join':([2.8,10.1,-6.8],[7.2,6.35,-13.7],34),
 'reference-side-straight':([-3,6.8,2.5],[10.6,7.5,2.5],21),
 'detail-floor-joinery':([4.8,3.5,8.4],[2.15,.6,3.2],35),
}
camcol=bpy.data.collections.new('91_Fixed_reference_cameras');scene.collection.children.link(camcol)
for name,(pos,target,lens) in camera_defs.items():
 pos=[pos[0],pos[1]*HEIGHT_SCALE,pos[2]];target=[target[0],target[1]*HEIGHT_SCALE,target[2]]
 data=bpy.data.cameras.new(name);data.lens=lens;data.clip_start=.05;data.clip_end=250;ob=bpy.data.objects.new(name,data);camcol.objects.link(ob);ob.location=V(pos);ob.rotation_euler=(Vector(V(target))-ob.location).to_track_quat('-Z','Y').to_euler();CAMERAS[name]={'position':dict(zip('xyz',pos)),'target':dict(zip('xyz',target)),'lensMm':lens,'sensorWidthMm':36,'approximateMatch':True}
scene.camera=bpy.data.objects['ground-to-a']
# Data contract is independent from the display mesh and measured nowhere.
config={'revision':REVISION,'version':1,'coordinateSystem':'Three.js x width, y up, z length; meters are project scale estimates','source':'User-supplied Hogwarts Legacy screenshots, S01–S09; 5 unique original 2048×1152 PNGs plus PDF previews','dimensions':{'width':HALL_WIDTH,'length':HALL_LENGTH,'groundY':0,'galleryY':6.2,'outerWallX':OUTER_WALL_X,'centralVoidX':8.8,'vaultSpringY':13.8,'vaultCrownY':18.7,'endA':-END_Z,'endB':END_Z},'bays':BAYS,'boundaries':BOUNDS,'shelves':{'lower':{'xMin':9.45,'xMax':16.0,'baseY':.25,'pitch':.77,'rows':6},'upper':{'xMin':11.10,'xMax':16.18,'baseY':6.45,'pitch':.88,'rows':6},'depth':SHELF_DEPTH,'frontOffset':SHELF_DEPTH/2,'boardThickness':SHELF_BOARD,'stileWidth':CASE_STILE_WIDTH,'upperPassageStileShift':UPPER_PASSAGE_STILE_SHIFT,'backThickness':SHELF_BACK,'bookDepth':BOOK_DEPTH,'bookCenterOffset':BOOK_CENTER,'bookRearGap':BOOK_REAR_GAP,'bookFrontInset':BOOK_FRONT_INSET,'omittedCases':[]},'stairs':ROUTES,'collisions':COLLISIONS,'cameras':CAMERAS,'previewLighting':{'engine':'Cycles CPU','threads':2,'samples':args.samples,'viewTransform':'AgX','look':'Medium High Contrast','exposure':.6,'note':'Area lights and world are preview-only, not included in GLB. Browser lighting must be configured independently.'},'estimates':['All dimensions and counts, including six bays, are adjustable project-scale estimates, not a survey.','Upper transverse-case orientation and inner-gallery passage remain an interpretation of partial views.','Spiral turns, tread count, handedness and landing apertures are circulation adaptations pending close views.','End B room depth and polygon balcony angles are estimates.','The A-end canvas uses a newly generated painterly interpretation of the supplied portrait, not extracted game artwork or a verified character likeness; the former gallery sculptures and their niche/base assemblies have been removed.','Window count and glass, inaccessible rear chambers, joinery details and full ornament profiles are not observed completely.'],'omissions':['No anonymous filler books; shelves are reserved for real catalog objects.','No screenshots applied as architectural planes, logos, NPCs, stationery or filler catalog books.','No claimed baked lighting, target-computer frame rate or surveyed accuracy.','Exact sculptural likeness, game-specific heraldry and unseen carvings are not reproduced.']}
for key in ('galleryY','vaultSpringY','vaultCrownY'):config['dimensions'][key]*=HEIGHT_SCALE
for level in ('lower','upper'):
 for key in ('baseY','pitch'):config['shelves'][level][key]*=HEIGHT_SCALE
config['shelves']['boardThickness']*=HEIGHT_SCALE
config['globePlacement']={'x':0,'z':-15.0,'baseY':6.2*HEIGHT_SCALE,'platform':'a-end-stair-crosswalk-extension'}
config['verticalLayout']={'heightScale':HEIGHT_SCALE,'galleryYBefore':6.2,'galleryYAfter':7.44,'vaultCrownYBefore':18.7,'vaultCrownYAfter':22.44,'rigidFeatures':['catalog books','reading furniture','globe','paintings','gallery guardrails','chandelier bodies']}
config['scaleNote']=config['coordinateSystem']
config['colliders']=config.pop('collisions')
config['stairRoutes']={side:data['route'] for side,data in ROUTES.items()}
config['shelfFrontFurniture']=SHELF_FRONT_CHECKS
config['arcadeSoffits']={'count':12,'centerAbsX':8.8,'springY':ARCADE_SPRING*HEIGHT_SCALE,'innerHalf':ARCADE_HALF,'innerRise':ARCADE_RISE*HEIGHT_SCALE,'paintThickness':ARCADE_BLUE_THICK,'paintRiseThickness':ARCADE_BLUE_THICK*HEIGHT_SCALE,'woodThickness':ARCADE_WOOD_THICK,'woodRiseThickness':ARCADE_WOOD_THICK*HEIGHT_SCALE,'heightScale':HEIGHT_SCALE,'segments':ARCADE_STEPS,'depth':.7,'style':'shared-nested-elliptical-profiles'}
config['windows']={'count':24,'width':2.70,'bottomY':6.98,'springY':11.48,'crownY':12.65,'glassX':15.02+OUTER_AISLE_EXTENSION,'leadX':14.99+OUTER_AISLE_EXTENSION,'style':'recessed-twin-lancet-diamond-glazing'}
for key in ('bottomY','springY','crownY'):config['windows'][key]*=HEIGHT_SCALE
config['windows']['storeys']=[{'id':'lower','sides':[-1,1],**{key:ground_window_y(y)*HEIGHT_SCALE for key,y in [('bottomY',6.98),('springY',11.48),('crownY',12.65)]}},{'id':'upper','sides':[-1,1],**{key:config['windows'][key] for key in ('bottomY','springY','crownY')}}]
config['windows']['leftCount']=12
config['windows']['rightCount']=12
config['sculptures']={'count':0,'removed':14,'niches':0,'colliders':0}
config['guardJoinery']={'style':'shared-newels-and-mortised-straight-runs','runs':GUARD_JOINERY}
config['arcadeGates']={'count':0,'removed':4,'colliders':0}
assert not any(module.startswith('15_Gate_') for module,mat in BUILD)
assert not any(c['id'].startswith('gate-') for c in COLLISIONS)
assert not any('scholar' in mat.lower() for module,mat in BUILD)
assert not any('niche' in c['id'] for c in COLLISIONS)
config['artGallery']={'end':'A','paintingCount':5,'sidePaintingCount':4,'removedBookcases':4,'obstructingStatues':0,'removedPilasters':6,'surroundCornices':0,'passed':True}
config['endBCentralDoor']={'closed':True,'centerX':0,'baseY':0,'width':3.5,'height':4.97,'frontZ':19.417,'leafCount':2,'collider':'end-b-central-door'}
config['endBSupport']={'count':0,'removedPiers':3,'removedArches':2,'pierCenters':[],'archCenters':[],'colliders':0,'wallPanels':{'centersX':[-5.5,5.5],'frameZ':19.72,'backFrontZ':19.74}}
config['endAGroundArcade']={'count':0,'removedPiers':6,'removedArches':5,'colliders':0}
config['balconyJoinery']={'path':[{'x':x,'z':z} for x,z in BALCONY_PATH],'rearJointZ':15.6,'continuousMiterRails':2,'stitchedPlatform':True,'duplicateCornerSpindles':0,'spindles':[{'x':x,'z':z} for x,z in BALCONY_SPINDLES],'terminalNewelsReused':True,'topRailCenterY':7.31+6.2*(HEIGHT_SCALE-1),'topRailRadius':.115,'bottomRailCenterY':6.34+6.2*(HEIGHT_SCALE-1),'bottomRailRadius':.10,'floorY':6.2*HEIGHT_SCALE,'floorUndersideY':5.55*HEIGHT_SCALE,'fasciaMaximumOutset':.48}
config['endAArcade']={'bayCenters':list(END_ARCADE_CENTERS),'count':0,'removedPiers':6,'removedArches':5,'pierCenters':[],'archCenters':[],'colliders':0,'lowerPictures':{'count':5,'centersX':list(LOWER_PAINTING_CENTERS),'centerY':2.3*HEIGHT_SCALE,'canvasWidth':1.5,'sideCanvasHeight':2.0,'centerCanvasHeight':3.75,'frontZ':-19.525,'textured':True,'removedDoor':True}}
config['crosswalk']=CROSSWALK_CHECKS
config['stairCrosswalkExtension']={'frontZ':-13.5,'rearZ':-15.6,'halfWidth':3.8,'floorY':6.2*HEIGHT_SCALE,'handrailRadii':[.36,1.98],'handrailHeight':1.23,'balustersPerSide':40,'formerInteriorGuardsRemoved':True}
config['outerAisles']={'levels':[0,6.2*HEIGHT_SCALE],'sides':[-1,1],'wallExtension':OUTER_AISLE_EXTENSION,'requiredPhysicalWidth':3.0,'bodyRadius':.3,'caseOuterX':16.18,'centerAbsX':18.0,'zMin':-18,'zMax':18,'style':'continuous-window-side-passages'}
config['cameras']=[{'id':name,'position':list(c['position'].values()),'target':list(c['target'].values()),'fov':math.degrees(2*math.atan(36*9/16/(2*c['lensMm'])))} for name,c in CAMERAS.items()]
# The browser uses the same independently reproducible window-light contract.
sys.path.insert(0,str(SRC))
from browser_lighting import browser_lighting
config['lighting']=browser_lighting(config['windows'],HEIGHT_SCALE)
(OUT/'scene-config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2))
(OUT/'reference-cameras.json').write_text(json.dumps(CAMERAS,indent=2))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(DELIVER/'library-source.blend'),compress=True)
# Compact static export: one mesh per shared material. Editable module hierarchy stays in .blend.
export_collection=bpy.data.collections.new('99_GLTF_static_material_batches');scene.collection.children.link(export_collection);merged=defaultdict(Mesh)
for (module,mat),d in BUILD.items():
 m=merged[mat];offset=len(m.v);m.v.extend(d.v);m.f.extend(tuple(i+offset for i in f) for f in d.f);m.uv.extend(d.uv);m.s.extend(d.s)
bpy.ops.object.select_all(action='DESELECT')
for mat,d in merged.items():
 ob=create_mesh('Architecture / '+mat,d,mat,export_collection);ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str((DELIVER/'architecture-structure.glb') if not FULL else (DELIVER/'architecture-uncompressed.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False,export_extras=False,export_materials='EXPORT')
for ob in list(export_collection.objects):bpy.data.objects.remove(ob,do_unlink=True)
bpy.data.collections.remove(export_collection)
verts=sum(len(d.v) for d in BUILD.values());polys=sum(len(d.f) for d in BUILD.values());tris=sum(sum(max(0,len(f)-2) for f in d.f) for d in BUILD.values());xyz=[(v[0],v[2],-v[1]) for d in BUILD.values() for v in d.v]
bounds={'min':dict(zip('xyz',[min(v[i] for v in xyz) for i in range(3)])),'max':dict(zip('xyz',[max(v[i] for v in xyz) for i in range(3)]))}
assert bounds['min']['y']>-1.0 and bounds['max']['y']<24.0,bounds
assert bounds['min']['z']<-20.0 and bounds['max']['z']>20.0,bounds
report={'stage':args.stage,'blenderVersion':bpy.app.version_string,'editableMeshObjects':len(objects),'moduleCollections':len(COLLECTIONS),'sharedMaterials':len(merged),'verticesBeforeGltf':verts,'polygonsBeforeGltf':polys,'trianglesBeforeGltf':tris,'exportMaterialBatches':len(merged),'bounds':bounds,'actualRenders':[],'fixtureSuspensionChecks':FIXTURE_CHECKS,'shelfFrontFurnitureChecks':SHELF_FRONT_CHECKS}
(SRC/'verification-round3').mkdir(exist_ok=True)
(DELIVER/'build-report.json').write_text(json.dumps(report,indent=2));(SRC/'verification-round3/mesh-integrity.json').write_text(json.dumps({'passed':True,'checkedMeshes':len(MESH_INTEGRITY),'meshes':MESH_INTEGRITY},indent=2));print('GLB_READY',json.dumps(report),flush=True)
if args.render:
 for name in args.render.split(','):
  if name not in CAMERAS:continue
  scene.camera=bpy.data.objects[name];scene.render.filepath=str(OUT/('preview-'+name+'.png'));bpy.ops.render.render(write_still=True);report['actualRenders'].append({'file':'preview-'+name+'.png','camera':name,'engine':'Cycles CPU','samples':args.samples,'resolution':[scene.render.resolution_x,scene.render.resolution_y]});(DELIVER/'build-report.json').write_text(json.dumps(report,indent=2))
print('DONE',flush=True)
