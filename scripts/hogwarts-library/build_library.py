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
random.seed(4107);TAU=2*math.pi
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials):bpy.data.materials.remove(d)
FULL=args.stage=='full'
MATS={};BUILD={};COLLISIONS=[];ROUTES={};CAMERAS={};MODULE='Architecture';COLLECTIONS={}
def V(p):return (p[0],-p[2],p[1])
def rgb(h):return tuple((int(h[i:i+2],16)/255)**2.2 for i in (0,2,4))
def material(name,color,rough=.5,metal=0,emission=0,texture=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb(color),1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emission:p.inputs['Emission Color'].default_value=(*rgb(color),1);p.inputs['Emission Strength'].default_value=emission
 if texture:
  n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(TEX/texture));n.image.pack();m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])

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
material('Brass • aged edge','88704b',.5,.60);material('Iron • blue black','303838',.52,.45);material('Iron • rubbed silver','555e5a',.53,.48);material('Glass • green shade','214b31',.25,.15);material('Paper • ivory candle','d5c596',.5);material('Light • candle','ffcc71',.28,emission=3);material('Glass • pale window','b7cbd2',.4,emission=.4);material('Leather • desk inset','384a35',.7);material('Canvas • dark green','26332a',.9);material('Canvas • ochre silhouette','8b7550',.92);material('Globe • parchment','a8996a',.75);material('Globe • land','536751',.8)
def wire_pbr(mat,prefix,strength):
 m=MATS[mat];nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
 for suffix,socket in [('roughness','Roughness'),('normal','Normal')]:
  tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(TEX/(prefix+'-'+suffix+'.png')),check_existing=True);tex.image.colorspace_settings.name='Non-Color';tex.image.pack()
  if suffix=='normal':
   normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=strength;links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
  else:links.new(tex.outputs['Color'],p.inputs[socket])
for m in ['Oak • rubbed midtone','Oak • edge highlight','Oak • floor']:wire_pbr(m,'r2-oak',.65)
wire_pbr('Walnut • deep recess','r2-walnut',.65)
for m in ['Stone • dark slate','Stone • pale slate','Stone • moss slate']:wire_pbr(m,'r2-slate',.55)
for m in ['Brass • aged edge','Iron • blue black','Iron • rubbed silver']:wire_pbr(m,'r2-aged-metal',.55)
material('Stone • carved pale scholar','b1b3a8',.88)
material('Bronze • end niche scholar','807047',.55,.72)
OAK='Oak • rubbed midtone';DARK='Walnut • deep recess';EDGE='Oak • edge highlight';GOLD='Brass • aged edge';TEAL='Paint • teal border';BLUE='Paint • blue gray vault';IRON='Iron • blue black';SILVER='Iron • rubbed silver';STONE='Stone • warm ashlar'
class Mesh:
 def __init__(self):self.v=[];self.f=[];self.uv=[];self.s=[]
 def face(self,vs,uv=None,smooth=False):
  i=len(self.v);self.v.extend(V(p) for p in vs);self.f.append(tuple(range(i,i+len(vs))));
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
 COLLISIONS.append(d)
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

def fluted_pier(x,z,base,height,width=.52):
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
  box(OAK,(x,yy,z),(sz,hh,sz),.018)
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
 length=z1-z0;cz=(z0+z1)/2
 for yy,ss in [(y+.12,(.35,.24,length)),(y+.33,(.21,.14,length)),(y+1.05,(.36,.17,length)),(y+1.16,(.43,.1,length))]:box(OAK,(x,yy,cz),ss,.035)
 n=max(1,round(length/2.4))
 for i in range(n+1):
  z=z0+length*i/n;box(OAK,(x,y+.61,z),(.46,1.22,.29),.025)
  box(EDGE,(x,y+1.18,z),(.51,.08,.4),.018)
 for i in range(n):
  z=z0+length*(i+.5)/n;panel_frame((x,y+.67,z),length/n-.22,.78,'x',DARK,.19)
  ribbon_scroll(OAK,(x,y+.68,z),length/n-.4,.66,'x',.06)
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
def turned_guard(name,points,y=6.2):
 # Heavy turned balusters belong to the stair/corner returns, distinct from
 # the pierced scroll-panel frontage. Segment ends share the same newel.
 for j,((x,z),(xx,zz)) in enumerate(zip(points,points[1:])):
  distance=math.hypot(xx-x,zz-z);n=max(1,round(distance/.28))
  if distance<.02:continue
  normal=(0,1,0)
  sweep_profile(OAK,[(x,y+1.16,z),(xx,y+1.16,zz)],normal,[(-.12,-.075),(.12,-.075),(.15,.00),(.11,.085),(-.11,.085),(-.15,0)])
  tube(OAK,[(x,y+.12,z),(xx,y+.12,zz)],.095,8)
  for k in range(n+1):
   t=k/n;bx=x+(xx-x)*t;bz=z+(zz-z)*t
   lathe(OAK,(bx,y+.14,bz),[(0,.06),(.09,.067),(.15,.04),(.24,.042),(.30,.077),(.42,.10),(.49,.09),(.60,.052),(.73,.040),(.82,.066),(.94,.049),(1.0,.06)],12)
  collision_box(f'guard-{name}-{j}',((x+xx)/2,y+.66,(z+zz)/2),(.30,1.32,distance),math.atan2(xx-x,zz-z))
 for x,z in points:
  box(OAK,(x,y+.61,z),(.26,1.22,.26),.025);box(EDGE,(x,y+1.22,z),(.34,.12,.34),.018)
# Original reference-informed sculptural mesh helpers; no external character asset.
exec(compile((SRC/'sculpture_helpers.fragment').read_text(),str(SRC/'sculpture_helpers.fragment'),'exec'))
BAYS=[-12.5,-7.5,-2.5,2.5,7.5,12.5];BOUNDS=[-15,-10,-5,0,5,10,15]
# Ground slab and actual inset stone tiles.
MODULE='00_Floor';box('Stone • grout',(0,-.18,0),(30.4,.36,36.4));collision_box('hall-floor',(0,-.18,0),(30.4,.36,36.4))
# Narrow chamfer-corner slate pavers with an inset border, based on S08/S09.
for ix in range(50):
 for iz in range(30):
  x=-14.7+ix*.6;z=-17.4+iz*1.2;w=.578;h=1.178;b=.092
  outline=[(-w/2+b,-h/2),(w/2-b,-h/2),(w/2,-h/2+b),(w/2,h/2-b),(w/2-b,h/2),(-w/2+b,h/2),(-w/2,h/2-b),(-w/2,-h/2+b)]
  face('Stone • pale slate',[(x+xx,.017,z+zz) for xx,zz in outline])
  inset=[(xx*.92,zz*.96) for xx,zz in outline]
  mat=['Stone • dark slate','Stone • moss slate','Stone • dark slate'][(ix*7+iz*11)%3]
  face(mat,[(x+xx,.021,z+zz) for xx,zz in inset])
  # Small, muted square between the cut corners of neighboring slabs.
  face('Stone • moss slate',[(x+.3,.018,z+.51),(x+.39,.018,z+.6),(x+.3,.018,z+.69),(x+.21,.018,z+.6)])
for x in (-8.55,8.55):box(OAK,(x,.03,0),(.22,.05,36))
for z in (-15.5,-10.5,-5.5,-.5,4.5,9.5,14.5):box(OAK,(0,.03,z),(17.3,.05,.16))
# Gallery slabs, with rectilinear safety clearance around both spiral apertures.
MODULE='01_Gallery_floors'
for side in (-1,1):
 slabs=[(11.9,3.3,6.2,29.4),(12.15,-13.5,5.7,4.2),(11.9,-16.8,6.2,2.4)]
 for k,(x,z,w,l) in enumerate(slabs):
  box(OAK,(side*x,5.97,z),(w,.46,l),.035);collision_box(f'gallery-{side}-{k}',(side*x,5.97,z),(w,.46,l))
 for z in (-16.8,16.8):
  if side==1:box(OAK,(0,5.97,z),(17.6,.46,2.4),.035)
  if side==1:collision_box(f'crosswalk-{z}',(0,5.97,z),(17.6,.46,2.4))
 # Top landing extends from the radial exit into the rear crosswalk.
 box(OAK,(side*6.8,6.02,-15.675),(1.5,.36,1.35),.035);collision_box(f'stair-landing-{side}',(side*6.8,6.02,-15.675),(1.5,.36,1.35))
# Outer stone walls with actual tall window openings; wall segments never cover the glass.
MODULE='02_Outer_walls'
for side in(-1,1):
 x=side*12.1
 box(STONE,(x,3.4,0),(.4,6.8,36));box(STONE,(x,14.25,0),(.4,2.9,36));collision_box(f'outer-wall-{side}',(x,7.7,0),(.4,15.4,36))
 for z in BOUNDS+[ -18,18 ]:box(STONE,(x,9.8,z),(.4,6.0,2.15 if abs(z)<18 else .5))
 for z in BAYS:
  # Tall paired lancets mounted behind dimensional mullions.
  for dz in(-.63,.63):
   box('Glass • pale window',(side*12.14,9.8,z+dz),(.07,5.8,1.1))
   for edge in(-.57,.57):box(STONE,(side*11.86,9.8,z+dz+edge),(.29,6.0,.12),.015)
   pointed(STONE,(side*11.87,0,z+dz),1.15,7,11.95,12.7,.085,.22,'x')
  for yy in(7,9.25,11.5,12.95):box(STONE,(side*11.83,yy,z),(.32,.14,2.8),.015)
  torus(STONE,(side*11.83,12.08,z),.31,.07,'yz',24)
  for dz in(-.27,0,.27):box(STONE,(side*11.81,10,z+dz),(.23,5.5,.065),.008)
# Lower longitudinal round arcade and upper giant piers.
for side in(-1,1):
 for z in BOUNDS:
  MODULE=f'03_Pier_{side}_{z}'
  fluted_pier(side*5.8,z,0,3.95,.74);collision_box(f'lower-pier-{side}-{z}',(side*5.8,2.7,z),(.95,5.4,.95))
  fluted_pier(side*5.8,z,6.22,7.40,.82);collision_box(f'upper-pier-{side}-{z}',(side*5.8,9.85,z),(1.04,7.3,1.04))
  if FULL:
   gallery_scholar((side*5.29,5.19,z),height=1.80,yaw=-side*math.pi/2,mat='Stone • carved pale scholar',variant=(BOUNDS.index(z)+(1 if side>0 else 0))%3)
   collision_box(f'lower-pier-niche-{side}-{z}',(side*5.29,6.06,z),(.57,1.9,.94))
  # Corbel flare meets the crown rib with a stepped deep capital.
  box(OAK,(side*5.8,13.77,z),(1.38,.22,1.38),.025)
  collision_box(f'upper-pier-cap-{side}-{z}',(side*5.8,13.34,z),(1.4,1.10,1.4))

 for z in BAYS:
  MODULE=f'04_Arcade_{side}_{z}'
  arch(OAK,(side*5.8,0,z),2.15,3.9,1.55,.2,.57,'x');arch(EDGE,(side*5.46,0,z),2.15,3.9,1.55,.052,.035,'x')
  arch_spandrel(OAK,(side*5.8,0,z),2.5,3.8,1.57,5.82,.54,'x')
  # Blue-gray patterned soffit, framed by fine teal bands. The aperture stays open.
  arch(BLUE,(side*5.8,0,z),2.13,3.9,1.51,.065,.7,'x',32)
  for xx in(5.43,6.17):arch(TEAL,(side*xx,0,z),2.13,3.9,1.51,.065,.04,'x',32)
  if FULL:
   for k in range(21):
    a=(k+.5)*math.pi/21
    for xx in(5.59,6.01):
     pts=[]
     for u,v in[(0,-.038),(.042,0),(0,.038),(-.042,0),(0,-.038)]:
      t=a+v;pts.append((side*(xx+u),3.9+1.509*math.sin(t),z+2.129*math.cos(t)))
     tube('Paint • faded ivory inlay',pts,.012,5)
  box(DARK,(side*5.47,5.72,z),(.08,.34,4.32),.014)
  box(EDGE,(side*5.4,5.95,z),(.16,.12,4.8),.02)
  if FULL:
   for off,thick in [(-.38,.08),(-.42,.035)]:arch(OAK if thick>.05 else EDGE,(side*(5.8+off),0,z),2.2,3.9,1.61,thick,.08,'x',28)
   for zz in(-1.92,1.92):rosette(OAK,(side*5.475,5.43,z+zz),.13,'x')
   for t in range(17):
    a=(t+.5)*math.pi/17;yy=3.9+1.59*math.sin(a);zz=z+2.22*math.cos(a);torus(GOLD,(side*5.435,yy,zz),.047,.012,'yz',8)
# Transverse bookcases use exact catalog contract. Empty shelves are intentional.
for side in(-1,1):
 for z in BOUNDS:
  for level in(0,1):
   MODULE=f'05_Case_{"L" if side<0 else "R"}_{level}_{z}'
   x0,x1=(6.45,11.4) if level==0 else(8.0,11.4);cx=side*(x0+x1)/2;width=x1-x0;base=.25 if level==0 else 6.45;pitch=.77 if level==0 else .88;top=base+6*pitch
   box(DARK,(cx,(base+top)/2,z),(width,top-base+.12,.12));collision_box(f'case-back-{side}-{level}-{z}',(cx,(base+top)/2,z),(width,top-base+.15,.14))
   for r in range(7):
    y=base+r*pitch;box(OAK,(cx,y,z),(width,.105,.65),.018)
    for facez in(-.337,.337):box(EDGE,(cx,y-.008,z+facez),(width,.055,.035),.01)
   for x in(x0,x1):
    box(OAK,(side*x,(base+top)/2,z),(.17,top-base+.24,.72),.023);collision_box(f'case-stile-{side}-{level}-{z}-{x}',(side*x,(base+top)/2,z),(.18,top-base+.24,.74))
   for endx in(x0,x1):
    for j in range(48):
     u=-.30+j*.6/48;v=-.30+(j+1)*.6/48
     a=side*(endx-.122+.02*math.sin(j*math.pi/8)**2);b=side*(endx-.122+.02*math.sin((j+1)*math.pi/8)**2)
     quad(OAK,(a,base+.12,z+u),(b,base+.12,z+v),(b,top-.1,z+v),(a,top-.1,z+u),smooth=True)
   # Shelf bays stay horizontally clear for the app's contiguous real-catalog run.
   for yy,ww,dd in[(base-.13,width+.28,.83),(top+.18,width+.36,.83),(top+.33,width+.5,.92)]:box(OAK,(cx,yy,z),(ww,.16,dd),.018)
   cornice(OAK,(cx,top+.29,z),width+.24,'z',.73)
   for endx in(x0,x1):
    for zz in(-.405,.405):
     for groove in(-.055,0,.055):tube(DARK,[(side*endx+groove,base+.16,z+zz),(side*endx+groove,top-.06,z+zz)],.011,5)
     rosette(OAK,(side*endx,top+.25,z+zz),.085,'z')
   # Dado cabinet under shelf one, still below the contractual shelf rest height.
   if level==1:
    for xx in range(3):
     xc=side*(x0+(xx+.5)*width/3);panel_frame((xc,6.36,z+.365),width/3-.1,.16)
# Upper gallery partitions: one coherent wall/screen/case assembly at each bay.
# The visible rounded Gothic doorway leads along the inner gallery; the outer
# edge meets the transverse real-catalog cabinet, with no floating screen gap.
for side in(-1,1):
 for z in BOUNDS:
  MODULE=f'06_Gothic_screen_{side}_{z}';cx=side*6.96
  half=.76;spring=9.38;rise=1.43;crown=spring+rise
  # Broad solid side stiles tied into pier and cabinet rather than freestanding posts.
  for sign in(-1,1):
   box(OAK,(cx+sign*.905,8.00,z),(.31,3.56,.49),.025)
   for yy in(6.40,9.38):box(OAK,(cx+sign*.905,yy,z),(.40,.13,.59),.018)
  # Closed timber shoulders following a round arch (visible curved reference top).
  for k in range(40):
   a=k*math.pi/40;b=(k+1)*math.pi/40
   u=half*math.cos(a);uu=half*math.cos(b);y=spring+rise*math.sin(a);yy=spring+rise*math.sin(b)
   for zz in(-.245,.245):quad(OAK,(cx+u,y,z+zz),(cx+uu,yy,z+zz),(cx+uu,10.92,z+zz),(cx+u,10.92,z+zz))
  arch(OAK,(cx,0,z),half,spring,rise,.13,.58,'z',40)
  for facez in(-.32,.32):
   arch(EDGE,(cx,0,z+facez),half+.045,spring,rise,.035,.04,'z',40)
   # Paired lancet cusps remain above head height. Lower doorway stays clear.
   for dx in(-.34,.34):carved_arch(cx+dx,z+facez,9.25,.33,9.73,10.38,.075,.12)
   for sg in(-1,1):relief_leaf(OAK,(cx+sg*.67,10.19,z+facez),.38,.12,-sg*.52,'z',.06)
  pierced_header(cx,z,10.92,12.16,2.13,11.40,.36,.49)
  for sign in(-1,1):
   relief_leaf(OAK,(cx+sign*.83,11.80,z+.26),.39,.11,-sign*.55,'z',.065)
   cylinder(OAK,(cx+sign*.87,12.29,z),.065,.30,10,r2=.016)
  # Paneled frieze continues across the screen and bookcase to the outer wall.
  case_center=side*9.18
  box(OAK,(case_center,12.32,z),(4.42,.43,.31),.018)
  cornice(OAK,(side*8.62,12.16,z),5.83,'z',.59)
  for zz in(-.20,.20):
   for xx in(8.1,9.2,10.3,11.3):panel_frame((side*xx,12.34,z+zz),.86,.23,'z',EDGE,.07)
  for xx in(6.055,7.865):collision_box(f'screen-stile-{side}-{z}-{xx}',(side*xx,8.0,z),(.34,3.6,.52))
  collision_box(f'screen-header-{side}-{z}',(cx,11.48,z),(2.13,1.40,.5))
# Complete all exposed floor edges. Stair aperture returns use the second,
# turned-baluster railing type visible in the close foreground of S01/S03.
MODULE='07_Gallery_railings'
for side in(-1,1):
 rail_side(side*8.62,-11.4,15.6)
 turned_guard(f'aperture-{side}',[(side*8.62,-11.4),(side*9.13,-11.4),(side*9.13,-15.6),(side*7.55,-15.6)])
rail_end(-15.6,-6.05,6.05)
rail_end(15.6,-8.62,-2.4);rail_end(15.6,2.4,8.62)
# Reference fascia between lower arcade and gallery. All bays are connected.
for side in(-1,1):
 for yy,width,height in[(5.66,.27,.18),(5.89,.38,.18),(6.17,.42,.16)]:box(OAK,(side*8.63,yy,0),(width,height,31.2),.025)
# Continuous timber barrel roof; multiple thick arc ribs.
MODULE='08_Main_barrel_vault'
for i in range(64):
 a=i*math.pi/64;b=(i+1)*math.pi/64
 p=lambda t,z:(8.8*math.cos(t),13.8+4.9*math.sin(t),z)
 quad(OAK,p(a,-18),p(b,-18),p(b,18),p(a,18),[(a*2,0),(b*2,0),(b*2,9),(a*2,9)])
 quad(DARK,(p(a,-18)[0],p(a,-18)[1]+.24,-18),(p(a,18)[0],p(a,18)[1]+.24,18),(p(b,18)[0],p(b,18)[1]+.24,18),(p(b,-18)[0],p(b,-18)[1]+.24,-18))
# Fine longitudinal board joints and pegged transverse rib mouldings are geometry.
for i in range(1,38):
 a=i*math.pi/38
 tube(DARK,[(8.795*math.cos(a),13.8+4.895*math.sin(a),-18),(8.795*math.cos(a),13.8+4.895*math.sin(a),18)],.011,5)
for z in BOUNDS+[-18,18]:
 arch(DARK,(0,0,z),8.66,13.8,4.79,.24,.28,'z',48);arch(EDGE,(0,0,z),8.64,13.8,4.76,.045,.33,'z',48)
for side in(-1,1):
 box(OAK,(side*8.76,13.95,0),(.26,.5,36),.02)
 box(TEAL,(side*8.59,14.13,0),(.06,.48,35.8))
 if FULL:
  for z in [i-17.5 for i in range(36)]:scroll(GOLD,(side*8.545,14.14,z),.92,.4,'x',.016)
# Separate cross-barrel side vaults with star and diamond decorations.
for side in(-1,1):
 for z in BAYS:
  MODULE=f'09_Side_vault_{side}_{z}'
  for i in range(28):
   a=i*math.pi/28;b=(i+1)*math.pi/28
   p=lambda t,x:(side*x,12.15+2.45*math.sin(t),z+2.45*math.cos(t))
   quad(BLUE,p(a,5.95),p(b,5.95),p(b,11.98),p(a,11.98),[(a,0),(b,0),(b,2),(a,2)])
  arch(TEAL,(side*6.08,0,z),2.45,12.15,2.45,.19,.36,'x',32)
  for x in(5.87,6.29,11.72):arch(GOLD,(side*x,0,z),2.44,12.15,2.44,.033,.04,'x',32)
  if FULL:
   for i in range(16):
    a=(i+.5)*math.pi/16;yy=12.15+2.48*math.sin(a);zz=z+2.48*math.cos(a)
    # Diamond tracery following arch reveal.
    pts=[(side*5.87,yy-.13,zz),(side*5.87,yy,zz+.12),(side*5.87,yy+.13,zz),(side*5.87,yy,zz-.12),(side*5.87,yy-.13,zz)];tube(GOLD,pts,.022,5)
   # Dense pale lozenge/star pattern hugs the curved blue-gray soffit.
   # Ribbon strips are modeled, not a screenshot texture or floating decoration.
   def vp(xx,aa,rr=2.427):return(side*xx,12.15+rr*math.sin(aa),z+rr*math.cos(aa))
   for col in range(12):
    xx=6.18+col*.47
    for row in range(14):
     aa=.13+row*(math.pi-.26)/13
     points=[vp(xx-.225,aa),vp(xx,aa-.105),vp(xx+.225,aa),vp(xx,aa+.105),vp(xx-.225,aa)]
     for q,r in zip(points,points[1:]):tube('Paint • faded ivory inlay',[q,r],.009,4)
     if (col+row)%2==0:
      face('Paint • faded ivory inlay',[vp(xx,aa-.063,2.418),vp(xx+.030,aa-.011,2.418),vp(xx+.115,aa,2.418),vp(xx+.030,aa+.011,2.418),vp(xx,aa+.063,2.418),vp(xx-.030,aa+.011,2.418),vp(xx-.115,aa,2.418),vp(xx-.030,aa-.011,2.418)])
   # Three transverse curved mouldings articulate the depth of each side barrel.
   for xx in(6.4,8.95,11.65):
    arch(EDGE,(side*xx,0,z),2.40,12.15,2.40,.032,.08,'x',40)
# End A: lower arcade, rear enclosed chamber, large portrait and original geometric frame.
MODULE='10_End_A'
box(STONE,(0,9.5,-18.2),(30,19,.4));collision_box('end-a-wall',(0,9.5,-18.2),(30,19,.4));box(DARK,(0,16.6,-17.94),(17.7,4.2,.16))
for x in(-8,-4.8,-1.6,1.6,4.8,8):
 fluted_pier(x,-15.7,0,3.9,.39);collision_box(f'end-a-ground-pier-{x}',(x,2,-15.7),(.68,4.1,.68))
for x in(-6.4,-3.2,0,3.2,6.4):arch(OAK,(x,0,-15.7),1.42,3.9,1.35,.2,.48,'z')
box(DARK,(0,3,-17.93),(17.6,6,.18))
for x in(-10.5,-4.6,4.6,10.5):
 w=3.5 if abs(x)<6 else 4.8
 collision_box(f'end-a-wall-cabinet-{x}',(x,9.7,-17.6),(w+.3,6.9,.88))
 box(DARK,(x,9.7,-17.85),(w,6.45,.2));panel_frame((x,9.7,-17.62),w,6.45)
 for k in range(8):box(OAK,(x,6.65+k*.79,-17.45),(w-.22,.12,.56),.018)
 for dx in(-w*.5,0,w*.5):box(OAK,(x+dx,9.7,-17.43),(.13,6.6,.62),.024)
 for y in(6.36,12.99):box(OAK,(x,y,-17.41),(w+.25,.22,.75),.022)
# A-end panel hierarchy and deep cornices, with the same four end bookcases.
for y,w in[(6.35,28.8),(13.23,28.8)]:cornice(OAK,(0,y,-17.58),w,'z',.8)
for x in(-13.35,-7.1,-2.02,2.02,7.1,13.35):
 fluted_pier(x,-17.46,6.35,6.8,.40)
for x in(-7.3,7.3):
 box(DARK,(x,9.7,-17.74),(1.4,5.9,.25),.08)
 carved_arch(x,-17.40,6.7,.56,10.8,12.0,.18,.32)
 rosette(OAK,(x,12.22,-17.3),.20,'z')
# Original illustrative canvas, with layered muted robe shapes instead of a protruding gold figure.
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
# Flat original artwork: all paint remains just above the canvas, inside the frame.
portrait_path=TEX/'portrait-scholar-generated-r2.png'
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
# Reference-supported A rear-wall joinery: a deeply layered dark rounded
# central door/recess and asymmetrical framed side panels behind the arcade.
# No unseen room is invented or opened through the sealed outer envelope.
material('Paint • end recess','293431',.93)
box('Paint • end recess',(0,1.83,-17.79),(2.78,3.30,.10),.022)
face('Paint • end recess',[(1.39*math.cos(k*math.pi/48),3.48+1.42*math.sin(k*math.pi/48),-17.728) for k in range(49)])
for half,thick,dep,mat in[(1.42,.15,.30,DARK),(1.53,.085,.20,OAK),(1.64,.038,.08,EDGE)]:
 arch(mat,(0,0,-17.61),half,3.47,1.42,thick,dep,'z',40)
 for x in(-half,half):box(mat,(x,1.82,-17.61),(thick*1.8,3.32,dep),.018)
for x in(-.68,.68):
 panel_frame((x,1.80,-17.66),1.22,3.10,'z',DARK,.07)
 panel_frame((x,.89,-17.60),1.02,1.00,'z',OAK,.035)
box(DARK,(0,1.91,-17.61),(.055,3.40,.08),.008)
for x in(-.14,.14):
 cylinder(GOLD,(x,1.78,-17.54),.035,.19,12)
box(OAK,(0,.10,-17.57),(3.40,.14,.55),.022)
collision_box('end-a-door-trim',(0,2.48,-17.59),(3.45,4.98,.44))
# Paneled skirting unifies the previously bare lower background wall.
for side in(-1,1):
 for j in range(5):
  x=side*(2.24+j*1.26)
  panel_frame((x,.98,-17.71),1.05,1.47,'z',OAK,.10)
 for y in(.20,1.81):box(OAK,(side*5.2,y,-17.69),(6.3,.13,.18),.012)
 for k,(xx,yy,w,h) in enumerate([(3.25,3.42,1.1,1.45),(4.69,4.02,.89,1.18),(5.52,2.75,1.00,1.37),(3.76,2.13,1.18,1.16),(6.18,4.34,1.03,1.17)]):
  x=side*xx
  box('Paint • end recess',(x,yy,-17.69),(w,h,.045),.012)
  panel_frame((x,yy,-17.62),w+.10,h+.10,'z',OAK,.12)
  panel_frame((x,yy,-17.54),w-.08,h-.08,'z',GOLD,.030)
  # Low-contrast original painted cameo silhouette, kept flat in its frame.
  color='Canvas • robe umber' if k%2==0 else 'Canvas • ochre silhouette'
  zpaint=-17.525
  face(color,[(x-w*.20,yy-h*.32,zpaint),(x+w*.20,yy-h*.32,zpaint),(x+w*.14,yy+h*.12,zpaint),(x-w*.12,yy+h*.10,zpaint)])
  face(color,[(x+w*.11*math.cos(t*TAU/24),yy+h*.22+h*.13*math.sin(t*TAU/24),zpaint+.002) for t in range(24)])
if FULL:
 for index,x in enumerate((-3.2,3.2)):
  gallery_scholar((x,5.19,-15.40),height=1.80,yaw=0,mat='Stone • carved pale scholar',variant=index)
if FULL:
 for index,x in enumerate((-3.6,3.6)):
  gallery_scholar((x,6.43,-17.32),height=3.05,yaw=0,mat='Bronze • end niche scholar',variant=1+index)
  collision_box(f'end-a-bronze-niche-{index}',(x,7.96,-17.14),(1.36,3.1,.48))
# End B: real wide arch, side open lancets, projecting polygon balcony, blind panel crown.
MODULE='11_End_B';box(STONE,(0,9.5,18.2),(30,19,.4));collision_box('end-b-wall',(0,9.5,18.2),(30,19,.4));box(DARK,(0,16.6,17.96),(17.7,4.2,.16))
for x in(-12,-8,-4,4,8,12):
 fluted_pier(x,16.5,6.2,5.85,.43);collision_box(f'end-b-upper-pier-{x}',(x,9.2,16.5),(.8,6.15,.8))
arch(OAK,(0,6.2,16.5),3.5,3.7,2.0,.28,.48,'z',32)
for x in(-10,-6.5,6.5,10):
 pointed(OAK,(x,6.2,16.5),1.5,0,3.6,5.5,.16,.4)
 torus(OAK,(x,11.33,16.5),.3,.06,'xy',24)
for x in(-12,-8,-4,0,4,8,12):
 # Blind paired lancets and oculus add a second depth inside each large timber panel.
 for dx in(-.72,.72):carved_arch(x+dx,17.71,12.15,.62,14.72,15.88,.075,.13)
 torus(OAK,(x,16.12,17.68),.34,.055,'xy',32)
 for k in range(4):
  a=k*math.pi/2;torus(OAK,(x+.14*math.cos(a),16.12+.14*math.sin(a),17.68),.14,.022,'xy',16)
 box(DARK,(x,14.6,17.93),(3.84,4.72,.14));pointed(OAK,(x,11.9,17.79),3.55,0,3.0,4.6,.11,.18)
 for xx in(-1.8,1.8):box(OAK,(x+xx,14.5,17.78),(.14,5.2,.18),.015)
for yy in(6.35,12.3,17.2):cornice(OAK,(0,yy,16.65 if yy<13 else 17.6),28.9,'z',.7)
for half,dep,mat in[(3.58,.54,DARK),(3.67,.24,OAK),(3.77,.1,EDGE)]:arch(mat,(0,6.2,16.34),half,3.7,2.0,.08,dep,'z',36)
for x in(-12,-8,-4,4,8,12):
 rosette(OAK,(x,12.43,16.24),.22,'z')
for x in(-10,-6.5,6.5,10):
 carved_arch(x,16.42,6.4,.77,9.8,11.72,.21,.36)
 rosette(EDGE,(x,11.9,16.2),.12,'z')
# Polygon floor solid extrusion and faceted front rail.
poly=[(-2.4,15.65),(-2.4,14.62),(-1.45,13.9),(1.45,13.9),(2.4,14.62),(2.4,15.65)]
face(OAK,[(x,6.2,z) for x,z in poly]);face(DARK,[(x,5.74,z) for x,z in reversed(poly)])
for (x,z),(xx,zz) in zip(poly,poly[1:]+poly[:1]):
 quad(OAK,(x,5.74,z),(xx,5.74,zz),(xx,6.2,zz),(x,6.2,z))
 if z<15.65 or zz<15.65:
  tube(OAK,[(x,7.29,z),(xx,7.29,zz)],.115,8);tube(OAK,[(x,6.4,z),(xx,6.4,zz)],.1,8)
  dist=math.hypot(xx-x,zz-z)
  for k in range(5):
   t=k/4;bx=x+(xx-x)*t;bz=z+(zz-z)*t;lathe(OAK,(bx,6.4,bz),[(0,.055),(.18,.075),(.4,.055),(.62,.082),(.9,.055)],10)
  angle=math.atan2(xx-x,zz-z);collision_box(f'balcony-rail-{x}-{z}',((x+xx)/2,6.85,(z+zz)/2),(.25,1.3,dist),angle)
for (x,z),(xx,zz) in zip(poly,poly[1:]+poly[:1]):
 if z<15.65 or zz<15.65:
  sweep_profile(OAK,[(x,5.98,z),(xx,5.98,zz)],(0,1,0),[(-.13,-.22),(.14,-.22),(.18,-.16),(.14,-.08),(.2,0),(.15,.1),(.22,.17),(.2,.23),(-.13,.23)])
collision_box('balcony-floor',(0,5.96,14.95),(4.8,.48,1.6))
# Polygon balcony supports and dark lower pierced screen.
box(DARK,(0,2.9,17.94),(17.6,5.8,.15))
box(OAK,(0,5.46,15.68),(7.4,.33,.54),.03)
for x in(-2.3,0,2.3):
 collision_box(f'end-b-balcony-pier-{x}',(x,2.0,15.75),(.64,4.0,.64))
 fluted_pier(x,15.75,0,3.8,.36);carved_arch(x,15.7,.12,.95,3.15,5.23,.20,.39)
 bracket=[(5.77,14.46),(5.77,15.87),(3.85,15.87),(4.5,15.28),(5.15,15.08),(5.48,14.46)]
 for dx in(-.15,.15):face(OAK,[(x+dx,y,z) for y,z in bracket])
 for p,q in zip(bracket,bracket[1:]+bracket[:1]):quad(OAK,(x-.15,p[0],p[1]),(x-.15,q[0],q[1]),(x+.15,q[0],q[1]),(x+.15,p[0],p[1]))
 relief_leaf(OAK,(x-.17,4.75,15.3),.57,.18,.15,'x',.055)
 tube(OAK,[(x,5.77,14.5),(x,4.6,15.75),(x,3.9,15.8)],.14,8)
for x in(-5.5,5.5):
 panel_frame((x,2.9,16.35),3.0,5.5);torus(GOLD,(x,3.8,16.15),.64,.06,'xy',32)
 for k in range(8):
  a=k*TAU/8;tube(GOLD,[(x,3.8,16.14),(x+.56*math.cos(a),3.8+.56*math.sin(a),16.14)],.025,6)
# Twin spiral stairs: actual wedge treads, helical fascia, continuous guarded handrails.
for side in(-1,1):
 MODULE=f'12_Spiral_{"left" if side<0 else "right"}';cx=side*6.8;cz=-13.5;N=32;direction=side;end=-math.pi/2;start=end-direction*TAU*.95;steps=[]
 for i in range(N):
  a=start+direction*TAU*.95*i/N;b=start+direction*TAU*.95*(i+1)/N;yy=6.2*(i+1)/N;ri=.31;ro=2.0
  vs=[]
  for ang in [a+(b-a)*k/4 for k in range(5)]:vs.append((cx+ro*math.cos(ang),yy,cz+ro*math.sin(ang)))
  for ang in [b+(a-b)*k/4 for k in range(5)]:vs.append((cx+ri*math.cos(ang),yy,cz+ri*math.sin(ang)))
  face(OAK,vs);face(DARK,[(x,y-.12,z) for x,y,z in reversed(vs)])
  for p,q in zip(vs,vs[1:]+vs[:1]):quad(OAK,p,q,(q[0],q[1]-.12,q[2]),(p[0],p[1]-.12,p[2]))
  tube(EDGE,[(cx+ri*math.cos(a),yy-.015,cz+ri*math.sin(a)),(cx+ro*math.cos(a),yy-.015,cz+ro*math.sin(a))],.032,8)
  # Balusters on the outer margin; last exit sector left open.
  if i<N-1:
   mid=(a+b)/2;bx=cx+1.94*math.cos(mid);bz=cz+1.94*math.sin(mid)
   lathe(OAK,(bx,yy,bz),[(0,.044),(.07,.046),(.1,.032),(.17,.031),(.22,.049),(.29,.065),(.35,.061),(.40,.04),(.50,.027),(.60,.03),(.68,.048),(.74,.055),(.8,.04),(.9,.025),(.97,.034),(1.05,.037)],12)
  mid=(a+b)/2
  collision_box(f'stair-tread-{side}-{i}',(cx+1.16*math.cos(mid),yy-.065,cz+1.16*math.sin(mid)),(1.66,.13,.31),-mid)
  steps.append({'x':cx+1.05*math.cos((a+b)/2),'y':yy,'z':cz+1.05*math.sin((a+b)/2)})
 for radius,yadd in[(1.98,1.05),(1.98,.25),(.36,.96)]:
  pts=[]
  for i in range(160):
   t=i/159*(N-1)/N;a=start+direction*TAU*.95*t;pts.append((cx+radius*math.cos(a),.18+6.2*t+yadd,cz+radius*math.sin(a)))

  if yadd>1:sweep_profile(OAK,pts,(0,1,0),[(-.085,-.045),(.085,-.045),(.105,.02),(.078,.072),(0,.09),(-.078,.072),(-.105,.02)])
  else:tube(IRON,pts,.028,8)
 # Solid profiled outer helical stringer and raised edge beads.
 helix=[]
 for i in range(129):
  t=i/128;a=start+direction*TAU*.95*t;helix.append((cx+1.95*math.cos(a),6.2*t,cz+1.95*math.sin(a)))
 sweep_profile(OAK,helix,(0,1,0),[(-.07,-.21),(.07,-.21),(.09,-.15),(.085,.13),(.06,.2),(-.06,.2),(-.085,.13),(-.09,-.15)])
 for off in(-.16,.14):tube(EDGE,[(x,y+off,z) for x,y,z in helix],.024,6)
 lathe(OAK,(cx,0,cz),[(0,.38),(.2,.42),(.4,.3),(6.4,.28),(6.6,.37),(6.78,.18),(6.95,.0)],20)
 COLLISIONS.append({'id':f'stair-center-{side}','shape':'cylinder','center':{'x':cx,'y':3.3,'z':cz},'radius':.4,'height':6.6})
 # Only the final stair-access edge is open; lateral landing edges are guarded.
 for edge,x in enumerate((cx-.75,cx+.75)):
  turned_guard(f'landing-{side}-{edge}',[(x,-15.6),(x,-15.0)])
 COLLISIONS.append({'id':f'stair-outer-guard-{side}','shape':'arc','center':{'x':cx,'y':3.4,'z':cz},'radius':1.99,'radialDepth':.16,'height':6.8,'startAngle':min(start,end-direction*TAU*.95/N),'endAngle':max(start,end-direction*TAU*.95/N),'segments':48})
 ROUTES['left' if side<0 else 'right']={'center':{'x':cx,'y':0,'z':cz},'outerRadius':2.,'innerRadius':.31,'rise':6.2,'turns':.95,'direction':direction,'startAngle':start,'endAngle':end,'steps':N,'route':[{'x':steps[0]['x'],'y':0,'z':steps[0]['z']}]+steps+[{'x':cx,'y':6.2,'z':-15.25},{'x':cx,'y':6.2,'z':-16.25}], 'aperture':{'xMin':cx-2.1,'xMax':cx+2.1,'zMin':-15.6,'zMax':-11.4},'landing':{'center':{'x':cx,'y':6.2,'z':-15.675},'size':{'x':1.5,'z':1.35}}}
# Reading furniture and useful visual props. No books, writing paper, people or duplicate catalog objects.
MODULE='13_Reading_furniture'
def lamp(x,y,z):
 scale=.75
 lathe(GOLD,(x,y,z),[(a*scale,b*scale) for a,b in [(0,.2),(.06,.21),(.1,.13),(.18,.09),(.35,.065),(.4,.1),(.47,.06)]],24)
 lathe('Glass • green shade',(x,y+.45*scale,z),[(a*scale,b*scale) for a,b in [(0,.32),(.04,.34),(.15,.29),(.25,.18),(.29,.04)]],48)
 cylinder('Light • candle',(x,y+.46*scale,z),.21*scale,.035*scale,32)
for z in(-6.2,2.0,10.2):
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
# Reference-visible upper alcove furniture. These twelve compact reading sets
# occupy the deep shelf bays, leaving the inner x=9.95 circulation route clear.
# Desks contain no decorative books and cannot substitute for catalog objects.
for side in(-1,1):
 for index,z in enumerate(BAYS):
  MODULE=f'18_Upper_reading_bay_{side}_{index}';x=side*12.85;floor=6.2
  box(OAK,(x,floor+1.035,z),(1.76,.15,1.08),.045)
  box('Leather • desk inset',(x,floor+1.115,z),(1.40,.016,.83),.018)
  for dx in(-.718,.718):box(DARK,(x+dx,floor+1.12,z),(.03,.023,.90),.006)
  for dz in(-.45,.45):box(DARK,(x,floor+1.12,z+dz),(1.46,.023,.03),.006)
  for dx in(-.67,.67):
   for dz in(-.38,.38):
    lathe(OAK,(x+dx,floor,z+dz),[(0,.064),(.09,.081),(.18,.052),(.30,.040),(.48,.056),(.63,.048),(.85,.044),(1.00,.067)],12)
  for dz in(-.44,.44):
   box(OAK,(x,floor+.90,z+dz),(1.52,.20,.10),.02)
   panel_frame((x,floor+.90,z+dz),1.31,.11,'z',EDGE,.025)
  box(OAK,(x,floor+.28,z),(1.32,.09,.11),.018)
  for dx in(-.67,.67):box(OAK,(x+dx,floor+.28,z),(.10,.09,.76),.015)
  lamp(x-side*.46,floor+1.125,z-.17)
  # A solid wooden reading chair with turned feet and a pierced arched back.
  cz=z+1.10
  box(OAK,(x,floor+.54,cz),(.70,.12,.64),.035)
  box('Leather • desk inset',(x,floor+.607,cz),(.55,.018,.49),.018)
  for dx in(-.265,.265):
   for dz in(-.235,.235):lathe(OAK,(x+dx,floor,cz+dz),[(0,.038),(.07,.046),(.16,.027),(.30,.036),(.46,.035),(.51,.049)],10)
   box(OAK,(x+dx,floor+1.015,cz+.275),(.075,1.01,.08),.015)
  for yy in(.77,1.31):box(OAK,(x,floor+yy,cz+.275),(.59,.075,.10),.018)
  arch(OAK,(x,floor,cz+.275),.265,1.33,.21,.040,.09,'z',24)
  for dx in(-.12,0,.12):
   tube(OAK,[(x+dx,floor+.80,cz+.275),(x+dx*.78,floor+1.04,cz+.29),(x+dx,floor+1.30,cz+.275)],.023,7)
  rosette(OAK,(x,floor+1.44,cz+.326),.072,'z')
  collision_box(f'upper-desk-{side}-{index}',(x,floor+.575,z),(1.82,1.15,1.12))
  collision_box(f'upper-chair-{side}-{index}',(x,floor+.78,cz),(.77,1.56,.76))
MODULE='13_Reading_furniture'
# Angled, low empty lecterns stand in front of the ground arcade.
for side in(-1,1):
 for z in(-5,5,11):
  x=side*7.75
  box(OAK,(x,.16,z),(1.0,.21,3.65),.035)
  box(DARK,(x+side*.43,.69,z),(.10,1.08,3.6),.02)
  box(OAK,(x,.77,z),(.96,.10,3.6),.02)
  for dz in(-1.77,-.59,.59,1.77):box(OAK,(x,.68,z+dz),(.94,1.05,.105),.016)
  # Sloping solid top profile, deliberately left clear of book props.
  yy1,yy2=(1.3,1.78) if side>0 else(1.78,1.3)
  pts=[(x-.58,yy1,z-1.86),(x+.58,yy2,z-1.86),(x+.58,yy2,z+1.86),(x-.58,yy1,z+1.86)];face(OAK,pts);face(DARK,[(a,b-.12,c) for a,b,c in reversed(pts)])
  for p,q in zip(pts,pts[1:]+pts[:1]):quad(OAK,p,q,(q[0],q[1]-.12,q[2]),(p[0],p[1]-.12,p[2]))
  for endz in(-1.83,1.83):
   # Separate shaped side cheeks, with shallow carved relief on their outer face.
   poly=[(x-.52,.26),(x+.52,.26),(x+.52,yy2-.04),(x+.15,(yy1+yy2)*.5-.12),(x-.52,yy1-.04)]
   for dz in(-.06,.06):face(OAK,[(xx,y,z+endz+dz) for xx,y in poly])
   for p,q in zip(poly,poly[1:]+poly[:1]):quad(OAK,(p[0],p[1],z+endz-.06),(q[0],q[1],z+endz-.06),(q[0],q[1],z+endz+.06),(p[0],p[1],z+endz+.06))
   rosette(OAK,(x,.8,z+endz+(.065 if endz>0 else -.065)),.19,'z')
   lathe(OAK,(x,1.45,z+endz),[(0,.07),(.06,.075),(.13,.04),(.23,.02)],12)
  lowx=x-side*.55;lowy=min(yy1,yy2)
  box(OAK,(lowx,lowy+.075,z),(.07,.12,3.72),.02)
  for dz in(-1.2,0,1.2):tube(OAK,[(x-.55,yy1+.04,z+dz),(x+.55,yy2+.04,z+dz)],.022,6)
  collision_box(f'lectern-{side}-{z}',(x,.85,z),(1.2,1.7,3.75))
# Floor-standing atlas globe stays centered between the stairs, as the high-angle
# references confirm. The sphere rises clearly above the reading-table lamps.
MODULE='14_Globe';gx,gz=0,-11.7;gy=1.57;gr=.82
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
collision_box('globe',(gx,1.25,gz),(2.24,2.5,2.24))
# Open and gated lower bays, a deliberately varied subset from S08/S09.
if FULL:
 for side in(-1,1):
  for bi in(2,4):
   z=BAYS[bi];MODULE=f'15_Gate_{side}_{bi}';x=side*5.76
   for leaf in(-1,1):
    zc=z+leaf*1.02
    for zz in(-.92,.92):tube(SILVER,[(x,.3,zc+zz),(x,3.75,zc+zz)],.037,8)
    for yy in(.38,1.18,2.25):tube(SILVER,[(x,yy,zc-.93),(x,yy,zc+.93)],.035,8)
    pts=[]
    for k in range(25):
     zz=-.93+1.86*k/24;pts.append((x,3.18+.52*(zz/.93)**2,zc+zz))
    tube(SILVER,pts,.065,8)
    for k in range(9):
     zz=zc-.84+k*.21;y=3.2+.52*((zz-zc)/.93)**2
     tube(SILVER,[(x,.38,zz),(x,y+.18,zz)],.022,6)
     cylinder(SILVER,(x,y+.23,zz),.05,.16,6,r2=0)
    scroll(SILVER,(x,1.72,zc),1.8,.9,'x',.03)
   collision_box(f'gate-{side}-{bi}',(x,1.9,z),(.18,3.8,4.2))
# Suspended multi-ring chandeliers: cables terminate on the actual roof crown.
def chandelier(z,y=12.9,small=False,x=0):
 global MODULE
 MODULE=f'16_Chandelier_{x}_{z}';scale=.38 if small else 1
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
 tube(IRON,[(x,y+.2,z),(x,roof,z)],.035*scale,8)
 sphere(IRON,(x,y-.23*scale,z),.16*scale,16,8)
for z in(-8,1,10):chandelier(z)
for side in(-1,1):
 for z in BAYS:chandelier(z,4.6,True,side*8.9)
# Width-only translation of complete side modules. No length/height/furniture scaling.
SIDE_PREFIXES=('02_','03_','04_','05_','06_','09_','15_')
for (module,mat),data in BUILD.items():
 if module.startswith(SIDE_PREFIXES) or (module.startswith('16_Chandelier_') and not module.startswith('16_Chandelier_0_')):
  data.v=[(x+(3 if x>0 else -3),by,bz) for x,by,bz in data.v]
for c in COLLISIONS:
 if c['id'].startswith(('outer-wall-','lower-pier-','upper-pier-','case-back-','case-stile-','gate-','screen-stile-','screen-header-')):
  c['center']['x']+=3 if c['center']['x']>0 else -3
for c in COLLISIONS:
 if c['id'].startswith('chandelier-body-') and c['center']['x']!=0:c['center']['x']+=3 if c['center']['x']>0 else -3
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
 'detail-globe':([3.6,3.1,-7.3],[0,1.25,-11.7],40),
 'detail-column-statue':([0,8.95,5.8],[8.68,9.5,0],24),
 'detail-sculpture':([4.4,6.5,2.1],[8.29,6.12,0],42),
 'upper-corridor':([9.88,7.78,13.9],[9.95,8.1,-10],30),
 'stair-gallery-join':([2.8,10.1,-6.8],[7.2,6.35,-13.7],34),
 'reference-side-straight':([-3,6.8,2.5],[10.6,7.5,2.5],21),
 'detail-floor-joinery':([4.8,3.5,8.4],[2.15,.6,3.2],35),
}
camcol=bpy.data.collections.new('91_Fixed_reference_cameras');scene.collection.children.link(camcol)
for name,(pos,target,lens) in camera_defs.items():
 data=bpy.data.cameras.new(name);data.lens=lens;data.clip_start=.05;data.clip_end=250;ob=bpy.data.objects.new(name,data);camcol.objects.link(ob);ob.location=V(pos);ob.rotation_euler=(Vector(V(target))-ob.location).to_track_quat('-Z','Y').to_euler();CAMERAS[name]={'position':dict(zip('xyz',pos)),'target':dict(zip('xyz',target)),'lensMm':lens,'sensorWidthMm':36,'approximateMatch':True}
scene.camera=bpy.data.objects['ground-to-a']
# Data contract is independent from the display mesh and measured nowhere.
config={'revision':'round3-reference-geometry-repair','version':1,'coordinateSystem':'Three.js x width, y up, z length; meters are project scale estimates','source':'User-supplied Hogwarts Legacy screenshots, S01–S09; 5 unique original 2048×1152 PNGs plus PDF previews','dimensions':{'width':30,'length':36,'groundY':0,'galleryY':6.2,'outerWallX':15,'centralVoidX':8.8,'vaultSpringY':13.8,'vaultCrownY':18.7,'endA':-18,'endB':18},'bays':BAYS,'boundaries':BOUNDS,'shelves':{'lower':{'xMin':9.45,'xMax':14.4,'baseY':.25,'pitch':.77,'rows':6},'upper':{'xMin':11,'xMax':14.4,'baseY':6.45,'pitch':.88,'rows':6},'depth':.65,'frontOffset':.37,'boardThickness':.105,'backThickness':.12,'omittedCases':[]},'stairs':ROUTES,'collisions':COLLISIONS,'cameras':CAMERAS,'previewLighting':{'engine':'Cycles CPU','threads':2,'samples':args.samples,'viewTransform':'AgX','look':'Medium High Contrast','exposure':.6,'note':'Area lights and world are preview-only, not included in GLB. Browser lighting must be configured independently.'},'estimates':['All dimensions and counts, including six bays, are adjustable project-scale estimates, not a survey.','Upper transverse-case orientation and inner-gallery passage remain an interpretation of partial views.','Spiral turns, tread count, handedness and landing apertures are circulation adaptations pending close views.','End B room depth and polygon balcony angles are estimates.','The A-end canvas uses a newly generated painterly interpretation of the supplied portrait, not extracted game artwork or a verified character likeness; the pale gallery figures are original modeled scholarly sculptures, not verified character likenesses.','Window count and glass, inaccessible rear chambers, joinery details and full ornament profiles are not observed completely.'],'omissions':['No anonymous filler books; shelves are reserved for real catalog objects.','No screenshots applied as architectural planes, logos, NPCs, stationery or filler catalog books. Books held by sculptures are part of the stone relief only.','No claimed baked lighting, target-computer frame rate or surveyed accuracy.','Exact sculptural likeness, game-specific heraldry and unseen carvings are not reproduced.']}
config['scaleNote']=config['coordinateSystem']
config['colliders']=config.pop('collisions')
config['stairRoutes']={side:data['route'] for side,data in ROUTES.items()}
config['cameras']=[{'id':name,'position':list(c['position'].values()),'target':list(c['target'].values()),'fov':math.degrees(2*math.atan(36*9/16/(2*c['lensMm'])))} for name,c in CAMERAS.items()]
config['lighting']={'exposure':1.45,'hemisphere':{'sky':'#b5c5cf','ground':'#634d37','intensity':1.7},'ambient':{'color':'#fff0d7','intensity':.5},'directional':[{'position':[10,15,7],'target':[0,2,-5],'color':'#dbe9f1','intensity':2.2}],'points':[{'position':[0,12,z],'color':'#ffd399','intensity':24,'distance':21} for z in(-8,1,10)]}
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
report={'stage':args.stage,'blenderVersion':bpy.app.version_string,'editableMeshObjects':len(objects),'moduleCollections':len(COLLECTIONS),'sharedMaterials':len(merged),'verticesBeforeGltf':verts,'polygonsBeforeGltf':polys,'trianglesBeforeGltf':tris,'exportMaterialBatches':len(merged),'bounds':bounds,'actualRenders':[],'fixtureSuspensionChecks':FIXTURE_CHECKS}
(SRC/'verification-round3').mkdir(exist_ok=True)
(DELIVER/'build-report.json').write_text(json.dumps(report,indent=2));(SRC/'verification-round3/mesh-integrity.json').write_text(json.dumps({'passed':True,'checkedMeshes':len(MESH_INTEGRITY),'meshes':MESH_INTEGRITY},indent=2));print('GLB_READY',json.dumps(report),flush=True)
if args.render:
 for name in args.render.split(','):
  if name not in CAMERAS:continue
  scene.camera=bpy.data.objects[name];scene.render.filepath=str(OUT/('preview-'+name+'.png'));bpy.ops.render.render(write_still=True);report['actualRenders'].append({'file':'preview-'+name+'.png','camera':name,'engine':'Cycles CPU','samples':args.samples,'resolution':[scene.render.resolution_x,scene.render.resolution_y]});(DELIVER/'build-report.json').write_text(json.dumps(report,indent=2))
print('DONE',flush=True)
