import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {elephantBodyGeometry,earGeometry,featherGeometry,curvedBodyGeometry,fittedWingFeather} from './ceremonial-sculpture-v8.js';

const vector=p=>new THREE.Vector3(...p);
const carvedGeometryCache=new Map();
/** The unchanged V8 outline, extruded directly with the final V11 settings.
 * Previously every first cache miss built a 12-segment/2-bevel temporary mesh,
 * discarded it, then built this exact 8-segment/1-bevel result a second time.
 * Shared cached geometry is immutable after construction; pitch variants clone
 * once into a separate cache before changing positions or normals. */
export function cachedCarvedApronGeometryV14(w,h,d){
  const key=[w,h,d].join('/');if(carvedGeometryCache.has(key))return carvedGeometryCache.get(key);
  const s=new THREE.Shape();s.moveTo(-w/2,h/2);s.lineTo(w/2,h/2);s.lineTo(w/2,-h*.30);s.bezierCurveTo(w*.43,-h*.36,w*.38,-h*.11,w*.31,-h*.23);s.bezierCurveTo(w*.21,-h*.50,w*.09,-h*.40,0,-h*.52);s.bezierCurveTo(-w*.09,-h*.40,-w*.21,-h*.50,-w*.31,-h*.23);s.bezierCurveTo(-w*.38,-h*.11,-w*.43,-h*.36,-w/2,-h*.30);s.closePath();
  const leaf=(cx,cy,ww,hh,sign)=>{const p=new THREE.Path();p.moveTo(cx-ww/2,cy-sign*hh*.18);p.bezierCurveTo(cx-ww*.18,cy+hh*.60,cx+ww*.28,cy+hh*.42,cx+ww/2,cy+sign*hh*.18);p.bezierCurveTo(cx+ww*.18,cy-hh*.60,cx-ww*.28,cy-hh*.42,cx-ww/2,cy-sign*hh*.18);p.closePath();return p;};
  for(let i=0;i<15;i++){const x=(i-7)*w*.061,edge=Math.abs(i-7)/7;s.holes.push(leaf(x,h*.25,w*.052,h*.30,i%2?1:-1));s.holes.push(leaf(x,h*(-.105+edge*.035),w*.052,h*(.32-edge*.08),i%2?-1:1));}
  for(let i=-3;i<=3;i++)s.holes.push(leaf(i*w*.061,-h*.36,w*.043,h*.09,i%2?1:-1));
  const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:1,curveSegments:8,steps:1});g.translate(0,0,-d/2);carvedGeometryCache.set(key,g);return g;
}
const carvedApronGeometry=cachedCarvedApronGeometryV14;
function mesh(parent,name,geometry,material,p=[0,0,0],rotation=null){
  // Sphere poles can extend U just beyond 1; contain every authored surface
  // inside its selected quadrant rather than sampling the adjacent material.
  if(material?.map?.userData?.sourceAsset==='ritual-surface-atlas-v11.png'){
    const uv=geometry.getAttribute('uv');if(uv){for(let i=0;i<uv.count;i++)uv.setXY(i,THREE.MathUtils.clamp(uv.getX(i),0,1),THREE.MathUtils.clamp(uv.getY(i),0,1));uv.needsUpdate=true;}
  }
  const o=new THREE.Mesh(geometry,material);o.name=name;o.position.set(...p);if(rotation)o.rotation.set(...rotation);o.castShadow=o.receiveShadow=true;
  o.userData={keepSolidInFallback:true,sculptureFeature:name};
  if(/^Crane_(Eye_Gold_Rim|Black_Inlaid_Eye|Vermilion_Crown)$/.test(name))o.userData.preserveSurfaceInFallback=true;
  parent.add(o);return o;
}
function sphere(parent,name,m,p,s,segments=24){const o=mesh(parent,name,new THREE.SphereGeometry(1,segments,16),m,p);o.scale.set(...s);return o;}
function tube(parent,name,points,r,m,segments=32,radial=7){return mesh(parent,name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(vector)),segments,r,radial,false),m);}
function tapered(parent,name,points,radii,m,segments=44,radial=12){
  const c=new THREE.CatmullRomCurve3(points.map(vector)),frames=c.computeFrenetFrames(segments,false),pos=[],uv=[],idx=[];
  for(let i=0;i<=segments;i++){const t=i/segments,k=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(k)),r=THREE.MathUtils.lerp(radii[j],radii[j+1],k-j),p=c.getPoint(t);
    for(let a=0;a<=radial;a++){const angle=a/radial*Math.PI*2,q=p.clone().addScaledVector(frames.normals[i],Math.cos(angle)*r).addScaledVector(frames.binormals[i],Math.sin(angle)*r);pos.push(...q);uv.push(a/radial,t);}}
  for(let i=0;i<segments;i++)for(let a=0;a<radial;a++){const k=i*(radial+1)+a;idx.push(k,k+1,k+radial+1,k+1,k+radial+2,k+radial+1);}
  for(const end of[0,1]){const k=pos.length/3,p=c.getPoint(end),ring=end*segments*(radial+1);pos.push(...p);uv.push(.5,end);for(let a=0;a<radial;a++)end?idx.push(k,ring+a,ring+a+1):idx.push(k,ring+a+1,ring+a);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return mesh(parent,name,g,m);
}
function lathe(points,segments=56){return new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),segments);}
function box(parent,name,m,p,s){return mesh(parent,name,new THREE.BoxGeometry(...s),m,p);}
function consolidate(parent,name){
  const parts=parent.children.filter(o=>o.name===name);if(parts.length<2)return;
  const gs=parts.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);}),g=mergeGeometries(gs,false);
  if(g){const o=mesh(parent,name,g,parts[0].material);o.userData.detailStrokes=parts.length;for(const p of parts){parent.remove(p);p.geometry.dispose();}}
  gs.forEach(g=>g.dispose());
}

// Surface-only atlas application: the four original image quadrants are
// sampled directly. A narrow inset prevents filtering across quadrant seams.
function mappedSurface(material,source,name,column,rowFromTop,bumpScale=.0025){
  if(!source)return material;
  const inset=.003,map=source.clone();map.name='ArchitecturalDetail_Ritual_'+name;
  map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;map.repeat.set(.5-inset*2,.5-inset*2);map.offset.set(column*.5+inset,(1-rowFromTop)*.5+inset);
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=16;map.needsUpdate=true;map.userData={...source.userData,detailPriority:true,preserveResolution:true,sourceAsset:'ritual-surface-atlas-v11.png',quadrant:[column,rowFromTop],surfaceOnly:true};
  const bump=map.clone();bump.name=map.name+'_Micro_Engraving';bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
  material.name='ArchitecturalDetail_'+material.name;material.map=map;material.bumpMap=bump;material.bumpScale=bumpScale;material.color.setHex(0xffffff);material.needsUpdate=true;return material;
}
function elephantCastUV(geometry){
  // A global cylinder pinches the forehead and the four legs into gold
  // latitude bands. The unindexed casting permits bounded planar projection
  // per existing face, preserving its geometry and the scale of cloud motifs.
  geometry.computeBoundingBox();const p=geometry.attributes.position,n=geometry.attributes.normal,b=geometry.boundingBox,uv=[],size=b.getSize(new THREE.Vector3());
  for(let i=0;i<p.count;i+=3){
    const nx=Math.abs(n.getX(i)+n.getX(i+1)+n.getX(i+2)),ny=Math.abs(n.getY(i)+n.getY(i+1)+n.getY(i+2)),nz=Math.abs(n.getZ(i)+n.getZ(i+1)+n.getZ(i+2)),axis=ny>nx&&ny>nz?'top':nx>nz?'side':'front';
    for(let j=0;j<3;j++){const x=p.getX(i+j),y=p.getY(i+j),z=p.getZ(i+j);uv.push(axis==='side'?(z-b.min.z)/size.z:(x-b.min.x)/size.x,axis==='top'?(b.max.z-z)/size.z:(y-b.min.y)/size.y);}
  }
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.userData.surfaceMapping='bounded-dominant-plane-casting';return geometry;
}
function earSurfaceUV(geometry){
  geometry.computeBoundingBox();const b=geometry.boundingBox,p=geometry.attributes.position,uv=[];
  for(let i=0;i<p.count;i++)uv.push((p.getX(i)-b.min.x)/(b.max.x-b.min.x),(p.getY(i)-b.min.y)/(b.max.y-b.min.y));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
}

/** Final world elevations: the ritual furniture is deliberately NOT Y-scaled. */
export function buildRitualSculpturesV11({ornaments,materials:m,wallBound,daisY=2.1,ritualSurfaceTexture=null}){
  const group=new THREE.Group();group.name='V11_Reference_Ritual_Ensemble';ornaments.add(group);
  const make=(name,color,roughness,metalness,side=THREE.FrontSide)=>{const mat=new THREE.MeshStandardMaterial({color,roughness,metalness,side});mat.name=name;return mat;};
  const ivory=make('Ceremonial_Crane_Ivory_Gilt_Feathers',0xe4d6b5,.52,.32),wing=make('Ceremonial_Crane_Pale_Gold_Wings',0xc8b789,.57,.30,THREE.DoubleSide);
  const greenBronze=make('Ceremonial_Crane_Patinated_Green_Legs',0x4f7461,.51,.52),beak=make('Ceremonial_Crane_Green_Gilt_Beak',0x768259,.41,.50);
  const enamel=make('Ceremonial_Turquoise_Cloisonne',0x50a5a1,.29,.20),blue=make('Ceremonial_Cobalt_Floral_Enamel',0x315c8f,.34,.17);
  const patina=make('Ceremonial_Carved_Bronze_Pedestal',0x716247,.55,.34),accent=make('Ceremonial_Worn_Gilt_Ridges',0xb69a5c,.45,.46);
  const tableWood=m.joinery??m.daisCarving,tableEdge=m.joineryLight??m.daisCarving;
  const elephantGold=m.gold.clone();elephantGold.name='Ceremonial_Offering_Elephant_Chased_Gold';
  mappedSurface(ivory,ritualSurfaceTexture,'Ivory_Gilt_Feather_Field',0,0,.0025);mappedSurface(wing,ritualSurfaceTexture,'Ivory_Gilt_Wing_Field',0,0,.0025);
  mappedSurface(greenBronze,ritualSurfaceTexture,'Green_Bronze_Scale_Field',1,0,.002);mappedSurface(elephantGold,ritualSurfaceTexture,'Offering_Elephant_Cloud_Chasing',0,1,.003);
  mappedSurface(enamel,ritualSurfaceTexture,'Turquoise_Cloisonne_Flower_Field',1,1,.002);
  const features={version:13,cranes:[],elephants:[],censers:[],tables:[],referenceImages:['082127','082632'],surfaceAtlas:ritualSurfaceTexture?{sourceAsset:'ritual-surface-atlas-v11.png',quadrants:['ivory-feather','green-bronze-scale','gilt-elephant-cloud','turquoise-cloisonne'],bumpScaleMetres:[.0025,.002,.003,.002],contoursUnchanged:true}:null};
  const birdBody=curvedBodyGeometry(),tailFeather=featherGeometry(.40,.11);

  // Reference cranes: ivory feather bodies, pale folded wings, green slender
  // legs, a vermilion crown and visibly separate upper / lower beaks.
  let cranePrototype=null;
  for(const side of[-1,1]){
    if(cranePrototype){
      const u=side*4.65,n=-.18,base=daisY,c=cranePrototype.clone(true);c.name='Reference_Ivory_Crane_'+side;c.position.set(u,base,n);c.rotation.y=-side*.22;group.add(c);
      wallBound('ivory-crane-'+side,u,n+.25,.82,1.62,base,base+2.58);
      features.cranes.push({name:c.name,baseY:base,height:2.58,feathers:51,openBeak:true,body:'ivory-gilt',legs:'green-patinated-bronze',reference:'082127'});continue;
    }
    const u=side*4.65,n=-.18,base=daisY,c=new THREE.Group();c.name='Reference_Ivory_Crane_'+side;c.position.set(u,base,n);c.rotation.y=-side*.22;group.add(c);
    box(c,'Crane_Carved_Foot_Plinth',m.dark,[0,.07,0],[.70,.14,.72]);mesh(c,'Crane_Octagonal_Standing_Base',new THREE.CylinderGeometry(.32,.35,.045,8),greenBronze,[0,.1625,0]);
    for(const sign of[-1,1]){
      const x=sign*.104;
      tapered(c,'Crane_Slender_Green_Leg',[[x,.185,.05],[x,.47,.00],[x,.77,-.08],[x,.98,-.03],[x,1.22,.025]],[.021,.020,.027,.023,.031],greenBronze,42,10);
      sphere(c,'Crane_Ankle',greenBronze,[x,.76,-.08],[.034,.041,.036],16);
      for(let k=-1;k<=1;k++)tapered(c,'Crane_Forward_Toe',[[x,.202,.05],[x+k*.068,.19,.16],[x+k*.102,.187,.31]],[.013,.010,.002],greenBronze,16,6);
      tapered(c,'Crane_Rear_Toe',[[x,.202,.04],[x+sign*.035,.188,-.10],[x+sign*.06,.185,-.18]],[.012,.009,.002],greenBronze,14,6);
      for(let j=0;j<11;j++){const y=.30+j*.04,z=.026-(y-.30)*.16;tube(c,'Crane_Leg_Engraving',[[x-.020,y,z],[x,y+.003,z+.011],[x+.020,y,z]],.0025,accent,8,4);}
    }
    const torso=mesh(c,'Crane_Ivory_Continuous_Breast',birdBody,ivory);torso.userData.preserveSurfaceInFallback=true;
    const neck=tapered(c,'Crane_Slender_Ivory_Neck',[[0,1.51,.21],[0,1.74,.27],[0,2.00,.17],[0,2.26,.19],[0,2.46,.33],[0,2.49,.49]],[.088,.060,.043,.039,.048,.061],ivory,64,16);neck.userData.preserveSurfaceInFallback=true;
    sphere(c,'Crane_Sculpted_Head',ivory,[0,2.49,.51],[.087,.076,.115],28);sphere(c,'Crane_Vermilion_Crown',m.red,[0,2.554,.485],[.052,.016,.058],24);
    for(const sign of[-1,1]){sphere(c,'Crane_Eye_Gold_Rim',accent,[sign*.077,2.508,.543],[.021,.021,.014],16);sphere(c,'Crane_Black_Inlaid_Eye',m.black,[sign*.088,2.51,.549],[.010,.011,.010],16);}
    tapered(c,'Crane_Upper_Open_Beak',[[0,2.493,.603],[0,2.50,.77],[0,2.51,.99]],[.027,.017,.001],beak,28,10);
    tapered(c,'Crane_Lower_Open_Beak',[[0,2.471,.605],[0,2.448,.76],[0,2.442,.91]],[.019,.012,.001],beak,28,10);
    for(const sign of[-1,1])for(const[kind,count]of[['Primary',12],['Covert',10]])for(let j=0;j<count;j++){
      const primary=kind==='Primary',f=fittedWingFeather({rootY:(primary?1.61:1.70)-j*.012,rootZ:.18-j*.031,length:primary?.31+j*.01:.235,width:primary?.094:.084,side:sign});
      const feather=mesh(c,'Crane_'+kind+'_Pale_Feather',f.geometry,primary?wing:ivory);feather.userData.featherRoot=f.root;
      tube(c,'Crane_Engraved_Feather_Quill',f.spine.map(p=>[p[0]+sign*.002,p[1],p[2]]),.0029,accent,20,4);
      if(primary)for(const t of[.25,.43,.61,.77])for(const edge of[-1,1])tube(c,'Crane_Chased_Feather_Barb',[f.point(t),f.point(t+.045,edge*.024),f.point(t+.085,edge*.032)].map(p=>[p[0]+sign*.0026,p[1],p[2]]),.0016,accent,7,4);
    }
    for(let j=-3;j<=3;j++){const feather=mesh(c,'Crane_Layered_Tail',tailFeather,wing,[j*.034,1.29,-.31],[.68,j*.10,0]);feather.scale.z=1.18;}
    for(const name of['Crane_Engraved_Feather_Quill','Crane_Chased_Feather_Barb','Crane_Leg_Engraving','Crane_Primary_Pale_Feather','Crane_Covert_Pale_Feather','Crane_Layered_Tail','Crane_Forward_Toe','Crane_Rear_Toe'])consolidate(c,name);
    wallBound('ivory-crane-'+side,u,n+.25,.82,1.62,base,base+2.58);
    features.cranes.push({name:c.name,baseY:base,height:2.58,feathers:51,openBeak:true,body:'ivory-gilt',legs:'green-patinated-bronze',reference:'082127'});
    cranePrototype=c;
  }

  // Continuous Asian-elephant casting, attached ears and tusks, chased trunk,
  // draped enamel saddle and a balanced offering vase; no disjoint spheres.
  const elephantGeometry=elephantCastUV(elephantBodyGeometry()),ears={1:earSurfaceUV(earGeometry(1)),'-1':earSurfaceUV(earGeometry(-1))};
  for(const side of[-1,1]){
    const u=side*3.48,n=-1.15,base=daisY,pedestalHeight=.48,e=new THREE.Group();e.name='Reference_Offering_Elephant_'+side;e.position.set(u,base+pedestalHeight,n);e.rotation.y=-side*Math.PI*.36;group.add(e);
    box(group,'Elephant_Joined_Plinth_'+side,patina,[u,base+.12,n],[1.10,.24,1.10]);box(group,'Elephant_Upper_Plinth_'+side,accent,[u,base+.36,n],[1.04,.24,1.04]);
    const body=mesh(e,'Elephant_Continuous_Anatomical_Casting',elephantGeometry,elephantGold);body.userData.preserveSurfaceInFallback=true;
    for(const sign of[-1,1]){
      const ear=new THREE.Group();ear.position.set(sign*.21,.76,.37);ear.scale.set(.68,.70,.68);e.add(ear);mesh(ear,'Elephant_Sculpted_Asian_Ear',ears[sign],elephantGold);
      tube(ear,'Elephant_Ear_Rim',[[sign*.035,.20,.05],[sign*.18,.21,.05],[sign*.35,.07,.05],[sign*.33,-.16,.05],[sign*.18,-.27,.05],[sign*.05,-.12,.05]],.013,m.goldLight,32,6);
      for(let j=0;j<5;j++)tube(ear,'Elephant_Ear_Chased_Folds',[[sign*.044,.01,.071],[sign*(.12+j*.023),.07-j*.047,.078],[sign*(.24+j*.013),.12-j*.078,.074]],.005,m.goldShade,12,4);
      sphere(e,'Elephant_Inlaid_Eye',m.black,[sign*.185,.895,.652],[.023,.019,.019],18);
      tapered(e,'Elephant_Tapered_Ivory_Tusk',[[sign*.17,.71,.64],[sign*.22,.61,.81],[sign*.22,.59,.95],[sign*.16,.67,1.03]],[.042,.036,.021,.0018],m.ivory,36,12);
    }
    tapered(e,'Elephant_Curled_Trunk',[[0,.86,.66],[0,.65,.79],[0,.42,.83],[0,.20,.88],[0,.21,1.04],[0,.34,1.12],[0,.46,1.035]],[.103,.090,.073,.057,.044,.034,.025],elephantGold,64,16);
    for(let j=0;j<14;j++){const y=.43+j*.028,z=.83-(y-.44)*.20,r=.073+(y-.44)*.085;tube(e,'Elephant_Trunk_Chasing',[[-r*.85,y,z+.034],[0,y-.011,z+r*1.10],[r*.85,y,z+.034]],.0048,m.goldShade,14,4);}
    tapered(e,'Elephant_Thin_Tail',[[0,.72,-.48],[.02,.51,-.57],[.05,.27,-.55],[.10,.20,-.51]],[.023,.020,.015,.007],elephantGold,28,8);
    for(const x of[-.253,.253])for(const z of[-.30,.27])for(const toe of[-1,0,1])sphere(e,'Elephant_Toenail',m.goldLight,[x+toe*.044,.048,z+.104],[.023,.032,.012],12);
    const positions=[],uv=[],indices=[];
    for(let i=0;i<=20;i++)for(let j=0;j<=16;j++){const x=(i/20-.5)*.77,z=-.41+j/16*.63;positions.push(x,.645+.31*Math.sqrt(Math.max(.06,1-(x/.39)**2)),z);uv.push(i/20,j/16);}
    for(let i=0;i<20;i++)for(let j=0;j<16;j++){const k=i*17+j;indices.push(k,k+1,k+17,k+1,k+18,k+17);}
    const saddle=new THREE.BufferGeometry();saddle.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));saddle.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));saddle.setIndex(indices);saddle.computeVertexNormals();mesh(e,'Elephant_Draped_Cloisonne_Saddle',saddle,blue);
    for(const z of[-.41,.22]){const points=[];for(let i=0;i<=24;i++){const x=(i/24-.5)*.77;points.push([x,.652+.31*Math.sqrt(Math.max(.06,1-(x/.39)**2)),z]);}tube(e,'Elephant_Saddle_Woven_Border',points,.012,m.goldLight,30,6);}
    for(const sign of[-1,1])for(let j=0;j<6;j++)tapered(e,'Elephant_Saddle_Tassel',[[sign*.38,.72,-.36+j*.10],[sign*.396,.65,-.36+j*.10],[sign*.40,.60,-.36+j*.10]],[.007,.011,.0015],m.goldLight,10,5);
    mesh(e,'Elephant_Vase_Base',lathe([[0,0],[.17,0],[.17,.025],[.14,.06],[0,.06]]),m.goldShade,[0,.95,-.07]);
    mesh(e,'Elephant_Offering_Vase',lathe([[0,0],[.115,0],[.13,.03],[.11,.07],[.17,.12],[.185,.21],[.15,.28],[.085,.33],[.075,.40],[.11,.46],[.11,.49],[.08,.49],[.06,.41],[.055,.35],[0,.31]]),enamel,[0,1.01,-.07]);
    for(const y of[1.04,1.14,1.46])mesh(e,'Elephant_Vase_Gilt_Band',new THREE.TorusGeometry(y===1.14?.16:.11,.008,6,32),m.goldLight,[0,y,-.07],[Math.PI/2,0,0]);
    for(const name of['Elephant_Trunk_Chasing','Elephant_Toenail','Elephant_Saddle_Tassel','Elephant_Vase_Gilt_Band'])consolidate(e,name);wallBound('elephant-pedestal-'+side,u,n,1.10,1.10,base,base+pedestalHeight);wallBound('offering-elephant-'+side,u-side*.24,n+.08,1.70,1.26,base+pedestalHeight,base+pedestalHeight+1.52);
    features.elephants.push({name:e.name,baseY:base+pedestalHeight,continuousCasting:true,castTriangles:elephantGeometry.attributes.position.count/3,reference:'overall-hall-silhouette; no separate close-up supplied'});
  }

  // Four tall cloisonné censers stand on carved ground-supported pedestals,
  // exactly as the front reference arrangement around the two stair flights.
  const pedestalHeight=2.27,pedestalPlanScale=.82;
  // All four authored tables and censers have identical local geometry. Clone
  // the completed prototype after engraving consolidation; never re-extrude
  // the same scrolls, flowers, tubes and turned profiles for every placement.
  // Only Object3D transforms/userData are cloned; static final buffers and the
  // same per-build materials are shared and are not disposed in this branch.
  let tablePrototype=null,censerPrototype=null;
  for(const side of[-1,1])for(const rank of['inner','outer']){
    if(tablePrototype&&censerPrototype){
      const u=side*(rank==='inner'?1.57:5.35),n=7.40,stand=tablePrototype.clone(true),c=censerPrototype.clone(true);
      stand.name='Carved_Censer_Pedestal_'+side+'_'+rank;stand.position.set(u,0,n);group.add(stand);
      c.name='Turquoise_Tall_Lid_Censer_'+side+'_'+rank;c.position.set(u,pedestalHeight,n);group.add(c);
      features.tables.push({name:stand.name,woodColor:tableWood.color.getHex(),carvedAprons:4,legs:4,style:'carved-hardwood-cabriole-and-pierced-apron',worldX:n,worldZ:-u,planScale:pedestalPlanScale,topWidth:pedestalPlanScale,baseY:0,topY:pedestalHeight,placement:'clear-of-column-plinths-and-stair-rails'});
      wallBound('censer-pedestal-'+side+'-'+rank,u,n,pedestalPlanScale,pedestalPlanScale,0,pedestalHeight);
      wallBound('turquoise-censer-'+side+'-'+rank,u,n,1.68,.88,pedestalHeight,pedestalHeight+1.86);
      features.censers.push({name:c.name,baseY:pedestalHeight,height:1.86,pedestalHeight,tripodLegs:3,floralMedallions:12,handles:'tall-S-curves',reference:'082632',worldX:n,worldZ:-u,supportedBy:stand.name});continue;
    }
    // The inner stands fit the clear strips BETWEEN the central stairs and
    // the side-flight rails. The outer stands are forward of the dragon
    // column plinths. Both pairs remain mirrored about the throne axis.
    const u=side*(rank==='inner'?1.57:5.35),n=7.40,stand=new THREE.Group();stand.name='Carved_Censer_Pedestal_'+side+'_'+rank;stand.position.set(u,0,n);stand.scale.set(pedestalPlanScale,1,pedestalPlanScale);group.add(stand);
    for(const[y,w,h]of[[.055,.92,.11],[.16,.84,.10],[.26,.78,.10],[pedestalHeight-.19,.85,.13],[pedestalHeight-.07,1.00,.14]])box(stand,'Censer_Pedestal_Moulding',y<.3?tableWood:tableEdge,[0,y,0],[w,h,w]);
    for(const sx of[-1,1])for(const sz of[-1,1]){
      tapered(stand,'Censer_Pedestal_Carved_Cabriole_Leg',[[sx*.33,.31,sz*.33],[sx*.35,.47,sz*.35],[sx*.27,1.25,sz*.27],[sx*.30,1.86,sz*.30],[sx*.38,pedestalHeight-.25,sz*.38]],[.065,.063,.049,.065,.093],tableWood,44,10);
      tube(stand,'Censer_Pedestal_Raised_Leg_Carving',[[sx*.35,.34,sz*.35],[sx*.37,.51,sz*.37],[sx*.29,1.25,sz*.29],[sx*.32,1.86,sz*.32],[sx*.40,pedestalHeight-.25,sz*.40]],.012,tableEdge,40,5);
    }
    for(const sign of[-1,1]){mesh(stand,'Censer_Pedestal_Pierced_Apron',carvedApronGeometry(.81,.38,.055),tableEdge,[0,pedestalHeight-.36,sign*.39]);mesh(stand,'Censer_Pedestal_Pierced_Apron',carvedApronGeometry(.81,.38,.055),tableEdge,[sign*.39,pedestalHeight-.36,0],[0,Math.PI/2,0]);}
    for(const y of[.37,.60])for(const sign of[-1,1]){box(stand,'Censer_Pedestal_Lower_Stretchers',tableWood,[0,y,sign*.31],[.62,.045,.045]);box(stand,'Censer_Pedestal_Lower_Stretchers',tableWood,[sign*.31,y,0],[.045,.045,.62]);}
    stand.userData.traditionalWoodwork='carved-hardwood-cabriole-and-pierced-apron';
    features.tables.push({name:stand.name,woodColor:tableWood.color.getHex(),carvedAprons:4,legs:4,style:'carved-hardwood-cabriole-and-pierced-apron',worldX:n,worldZ:-u,planScale:pedestalPlanScale,topWidth:pedestalPlanScale,baseY:0,topY:pedestalHeight,placement:'clear-of-column-plinths-and-stair-rails'});
    const c=new THREE.Group();c.name='Turquoise_Tall_Lid_Censer_'+side+'_'+rank;c.position.set(u,pedestalHeight,n);group.add(c);
    mesh(c,'Censer_Tripod_Foot_Ring',lathe([[0,0],[.34,0],[.35,.04],[.31,.07],[0,.07]]),accent);
    for(let j=0;j<3;j++){const a=j*Math.PI*2/3,point=(r,y)=>[Math.cos(a)*r,y,Math.sin(a)*r];tapered(c,'Censer_Three_Cabriole_Feet',[point(.30,.07),point(.34,.15),point(.27,.28),point(.235,.39)],[.057,.053,.044,.065],m.gold,32,12);sphere(c,'Censer_Claw_Foot',accent,point(.30,.08),[.071,.025,.070],20);}
    const body=mesh(c,'Censer_Turquoise_Lobed_Bowl',lathe([[0,0],[.18,0],[.24,.04],[.33,.13],[.405,.27],[.423,.41],[.405,.55],[.35,.65],[.29,.69],[.28,.75],[.32,.78],[.32,.81],[.27,.81],[.25,.75],[.27,.66],[.32,.59],[.36,.48],[.36,.33],[.31,.19],[.21,.10],[0,.10]],64),enamel,[0,.33,0]);body.userData.preserveSurfaceInFallback=true;
    for(const[y,r]of[[.38,.235],[.51,.33],[.98,.35],[1.12,.32]])mesh(c,'Censer_Chased_Gilt_Band',new THREE.TorusGeometry(r,.014,8,64),m.goldLight,[0,y,0],[Math.PI/2,0,0]);
    // High domed lid, stepped neck and lotus bud: each concentric section is
    // seated on the previous one, without the old floating squat cap.
    mesh(c,'Censer_Tall_Turquoise_Lid',lathe([[0,0],[.345,0],[.35,.04],[.31,.08],[.28,.17],[.235,.27],[.18,.35],[.13,.40],[.095,.42],[0,.42]],64),enamel,[0,1.14,0]);
    for(const[y,r]of[[1.16,.348],[1.28,.285],[1.43,.21],[1.56,.095]])mesh(c,'Censer_Lid_Gilt_Enamel_Boundary',new THREE.TorusGeometry(r,.011,8,56),m.goldLight,[0,y,0],[Math.PI/2,0,0]);
    mesh(c,'Censer_Lotus_Bud_Finial',lathe([[0,0],[.075,0],[.075,.04],[.11,.09],[.105,.16],[.07,.21],[.04,.25],[0,.29]],48),m.gold,[0,1.56,0]);
    for(const sign of[-1,1]){
      const handlePoints=[[sign*.36,.88,0],[sign*.57,.91,0],[sign*.63,1.12,0],[sign*.62,1.33,0],[sign*.68,1.47,0],[sign*.78,1.49,0]];
      tapered(c,'Censer_Tall_S_Curve_Ear',handlePoints,[.037,.033,.030,.029,.033,.045],m.goldLight,52,12);
      sphere(c,'Censer_Upturned_Ear_Lip',m.gold,[sign*.782,1.49,0],[.053,.025,.037],20);
      tube(c,'Censer_Handle_Dark_Chasing',handlePoints.map(p=>[p[0],p[1],.025]),.0045,m.goldShade,44,5);
    }
    for(let j=0;j<12;j++){
      const a=j*Math.PI/6,r=.424,cy=.745;
      for(const petal of[0,1,2,3,4,5]){
        const points=[];for(let k=0;k<=16;k++){const t=k/16*Math.PI*2,pa=petal*Math.PI/3,ex=Math.cos(pa)*.057+Math.cos(t)*.032,ey=Math.sin(pa)*.057+Math.sin(t)*.042,aa=a+ex/r;points.push([Math.cos(aa)*(r-.35*ey*ey),cy+ey,Math.sin(aa)*(r-.35*ey*ey)]);}tube(c,'Censer_Cloisonne_Wire_Floral_Petals',points,.0045,m.goldLight,20,5);
      }
      const flower=sphere(c,'Censer_Cobalt_Flower_Centre',blue,[Math.cos(a)*.43,cy,Math.sin(a)*.43],[.022,.023,.010],16);flower.rotation.y=-a+Math.PI/2;
      for(const sign of[-1,1]){const points=[];for(let k=0;k<=20;k++){const t=k/20,aa=a+sign*(.11+Math.sin(t*Math.PI)*.10),y=.48+t*.49,rr=.34+.086*Math.sin(t*Math.PI);points.push([Math.cos(aa)*rr,y,Math.sin(aa)*rr]);}tube(c,'Censer_Continuous_Cloisonne_Vines',points,.0042,m.goldLight,24,5);}
      const line=[];for(let k=0;k<=20;k++){const t=k/20,y=1.20+t*.33,rr=.32*(1-t)+.13*t,aa=a+.12*Math.sin(t*Math.PI);line.push([Math.cos(aa)*rr,y,Math.sin(aa)*rr]);}tube(c,'Censer_Lid_Gilt_Ribs',line,.006,m.goldLight,24,5);
    }
    for(const name of['Censer_Cloisonne_Wire_Floral_Petals','Censer_Continuous_Cloisonne_Vines','Censer_Lid_Gilt_Ribs'])consolidate(c,name);
    wallBound('censer-pedestal-'+side+'-'+rank,u,n,pedestalPlanScale,pedestalPlanScale,0,pedestalHeight);
    wallBound('turquoise-censer-'+side+'-'+rank,u,n,1.68,.88,pedestalHeight,pedestalHeight+1.86);
    features.censers.push({name:c.name,baseY:pedestalHeight,height:1.86,pedestalHeight,tripodLegs:3,floralMedallions:12,handles:'tall-S-curves',reference:'082632',worldX:n,worldZ:-u,supportedBy:stand.name});
    tablePrototype=stand;censerPrototype=c;
  }
  return {group,features};
}
