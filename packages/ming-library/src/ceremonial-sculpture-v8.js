import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Purpose-made sculptural meshes. All coordinates are in the ceremonial frame:
// +Z faces the doorway and +Y is up. Small carving is geometry, not billboards.
const Y=new THREE.Vector3(0,1,0);
const V=p=>new THREE.Vector3(...p);
// Preserve the continuous skin of these few cast bodies in the CPU preview.
// Fine engraved strokes, scales, feathers and other ornaments keep ordinary
// projected-area culling; this is not a blanket sculpture/detail exemption.
const CLOSED_CASTINGS=new Set(['Elephant_Continuous_Anatomical_Casting','Elephant_Curled_Trunk','Crane_Sculpted_Torso','Crane_Curved_Neck','Tripod_Cloisonne_Censer']);
function add(parent,name,geometry,material,position=[0,0,0],rotation=null,priority=true){
  const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(...position);
  if(rotation)m.rotation.set(...rotation);m.castShadow=true;m.receiveShadow=true;
  m.userData={keepSolidInFallback:priority,sculptureFeature:name};
  if(CLOSED_CASTINGS.has(name))m.userData.preserveSurfaceInFallback=true;
  parent.add(m);return m;
}
function tube(parent,name,points,radius,material,segments=24,radial=7,priority=true){
  const path=new THREE.CatmullRomCurve3(points.map(V));
  return add(parent,name,new THREE.TubeGeometry(path,segments,radius,radial,false),material,[0,0,0],null,priority);
}
function tapered(parent,name,points,radii,material,segments=40,radial=12){
  const curve=new THREE.CatmullRomCurve3(points.map(V)),frames=curve.computeFrenetFrames(segments,false),positions=[],uvs=[],indices=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments,p=curve.getPoint(t),k=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(k)),r=THREE.MathUtils.lerp(radii[j],radii[j+1],k-j);
    for(let a=0;a<=radial;a++){const angle=a/radial*Math.PI*2,q=p.clone().addScaledVector(frames.normals[i],Math.cos(angle)*r).addScaledVector(frames.binormals[i],Math.sin(angle)*r);positions.push(...q);uvs.push(a/radial,t);}
  }
  for(let i=0;i<segments;i++)for(let a=0;a<radial;a++){const j=i*(radial+1)+a;indices.push(j,j+1,j+radial+1,j+1,j+radial+2,j+radial+1);}
  // The end faces close the manufactured bronze skin.
  for(const end of[0,1]){const center=curve.getPoint(end),index=positions.length/3;positions.push(...center);uvs.push(.5,end);const ring=end*segments*(radial+1);for(let a=0;a<radial;a++)end?indices.push(index,ring+a,ring+a+1):indices.push(index,ring+a+1,ring+a);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  return add(parent,name,g,material);
}
function lathe(profile,segments=48){
  const points=profile.map(p=>new THREE.Vector2(...p));return new THREE.LatheGeometry(points,segments);
}
function sphere(parent,name,m,p,s,segments=24){const o=add(parent,name,new THREE.SphereGeometry(1,segments,16),m,p);o.scale.set(...s);return o;}
function shapeGeometry(shape,depth=.055,bevel=.009,segments=12){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,curveSegments:segments,steps:1});g.translate(0,0,-depth/2);return g;}
function rectangleShape(w,h,r){
  const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
export function cushionGeometry(w,h,d,r=.06){
  const g=shapeGeometry(rectangleShape(w,d,r),h-2*r,r,10);g.rotateX(-Math.PI/2);return g;
}

function cloudHole(cx,cy,w,h){
  const p=new THREE.Path();p.moveTo(cx-w*.44,cy-h*.15);p.bezierCurveTo(cx-w*.60,cy+h*.30,cx-w*.19,cy+h*.53,cx-w*.05,cy+h*.28);p.bezierCurveTo(cx+w*.04,cy+h*.67,cx+w*.39,cy+h*.59,cx+w*.39,cy+h*.18);p.bezierCurveTo(cx+w*.66,cy+h*.12,cx+w*.56,cy-h*.38,cx+w*.22,cy-h*.33);p.bezierCurveTo(cx-w*.01,cy-h*.55,cx-w*.36,cy-h*.46,cx-w*.44,cy-h*.15);p.closePath();return p;
}
export function carvedApronGeometry(w,h,depth=.09){
  const s=new THREE.Shape();s.moveTo(-w/2,h/2);s.lineTo(w/2,h/2);s.lineTo(w/2,-h*.30);s.bezierCurveTo(w*.43,-h*.36,w*.38,-h*.11,w*.31,-h*.23);s.bezierCurveTo(w*.21,-h*.50,w*.09,-h*.40,0,-h*.52);s.bezierCurveTo(-w*.09,-h*.40,-w*.21,-h*.50,-w*.31,-h*.23);s.bezierCurveTo(-w*.38,-h*.11,-w*.43,-h*.36,-w/2,-h*.30);s.closePath();
  // Two interlaced ranks of lanceolate openings leave a continuous, narrow
  // carved vine network. Small drop-shaped cuts follow the scalloped bottom.
  const leaf=(cx,cy,ww,hh,sign)=>{const p=new THREE.Path();p.moveTo(cx-ww/2,cy-sign*hh*.18);p.bezierCurveTo(cx-ww*.18,cy+hh*.60,cx+ww*.28,cy+hh*.42,cx+ww/2,cy+sign*hh*.18);p.bezierCurveTo(cx+ww*.18,cy-hh*.60,cx-ww*.28,cy-hh*.42,cx-ww/2,cy-sign*hh*.18);p.closePath();return p;};
  for(let i=0;i<15;i++){
    const x=(i-7)*w*.061,edge=Math.abs(i-7)/7;
    s.holes.push(leaf(x,h*.25,w*.052,h*.30,i%2?1:-1));
    s.holes.push(leaf(x,h*(-.105+edge*.035),w*.052,h*(.32-edge*.08),i%2?-1:1));
  }
  for(let i=-3;i<=3;i++)s.holes.push(leaf(i*w*.061,-h*.36,w*.043,h*.09,i%2?1:-1));
  return shapeGeometry(s,depth,.004,12);
}
export function refinedCrestGeometry(w,h){
  const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h*.11);
  s.bezierCurveTo(-w*.49,h*.40,-w*.39,h*.02,-w*.35,h*.30);s.bezierCurveTo(-w*.44,h*.64,-w*.21,h*.35,-w*.20,h*.62);s.bezierCurveTo(-w*.27,h*.85,-w*.09,h*.61,-w*.07,h*.82);s.quadraticCurveTo(0,h*1.13,w*.07,h*.82);s.bezierCurveTo(w*.09,h*.61,w*.27,h*.85,w*.20,h*.62);s.bezierCurveTo(w*.21,h*.35,w*.44,h*.64,w*.35,h*.30);s.bezierCurveTo(w*.39,h*.02,w*.49,h*.40,w/2,h*.11);s.lineTo(w/2,0);s.closePath();
  s.holes.push(cloudHole(0,h*.34,w*.17,h*.35));
  for(const sign of[-1,1])s.holes.push(cloudHole(sign*w*.26,h*.22,w*.17,h*.25));
  return shapeGeometry(s,.115,.012,14);
}

export function refineThroneV8({solid,ornaments,materials:m}){
  const detail=new THREE.Group();detail.name='V8_Throne_Carved_Joinery';ornaments.add(detail);
  // A pierced continuous apron replaces the row of bead-like ornaments.
  for(const n of[-1.085,1.085]){
    add(solid,'Throne_Pierced_Cloud_Apron',carvedApronGeometry(3.18,.53,.10),m.gold,[0,1.69,n]);
    for(let i=0;i<15;i++){
      const x=(i-7)*3.18*.061;
      // Raised vine stems connect the actual webs between the two cut rows.
      tube(detail,'Apron_Continuous_Gilt_Vine',[[x-.09,1.71,n+.063],[x-.047,1.77,n+.064],[x+.005,1.70,n+.065],[x+.052,1.65,n+.064],[x+.096,1.71,n+.063]],.012,m.goldLight,18,5);
      for(const sign of[-1,1])tube(detail,'Apron_Routed_Leaf_Vein',[[x+sign*.014,1.73,n+.065],[x+sign*.045,1.82,n+.065],[x+sign*.080,1.85,n+.064]],.006,m.goldShade,10,4);
    }
    for(const sign of[-1,1]){
      tube(detail,'Apron_Raised_Carved_Scroll',[[sign*.06,1.70,n+.065],[sign*.24,1.84,n+.066],[sign*.48,1.73,n+.067],[sign*.72,1.79,n+.065],[sign*1.04,1.69,n+.066],[sign*1.31,1.80,n+.062],[sign*1.48,1.68,n+.058]],.019,m.goldLight,36,5);
      tube(detail,'Apron_Lower_Chased_Edge',[[0,1.41,n+.060],[sign*.37,1.47,n+.060],[sign*.70,1.44,n+.060],[sign*1.02,1.56,n+.060],[sign*1.39,1.53,n+.060],[sign*1.57,1.55,n+.060]],.014,m.goldShade,32,5);
    }
  }
  // Fine beading and stacked mouldings soften the bearing frame, rather than
  // hiding it inside an oversized decorative box.
  for(const n of[-1.09,1.09])for(const[y,r,mat]of[[1.90,.022,m.goldLight],[2.04,.025,m.gold],[2.075,.013,m.goldShade]])tube(detail,'Throne_Continuous_Seat_Moulding',[[-1.67,y,n],[-.82,y,n],[.82,y,n],[1.67,y,n]],r,mat,8,7);
  for(const n of[-1.085,1.085]){
    // The bearing seat rail carries three concentric routed frames and a
    // repeating carved cloud band; it no longer reads as a blank gold plank.
    for(const[w,h,r,mat]of[[3.30,.174,.011,m.goldShade],[3.25,.133,.009,m.goldLight],[3.18,.092,.006,m.goldShade]]){
      const s=rectangleShape(w,h,.04),pts=s.getPoints(22).map(p=>[p.x,p.y+1.965,n-Math.sign(n)*.009]);tube(detail,'Throne_Seat_Rail_Routed_Moulding',pts,r,mat,64,5);
    }
    for(let i=-10;i<=10;i++){
      const x=i*.145,pts=[];for(let j=0;j<=18;j++){const t=j/18*Math.PI*1.65,rr=.032*(1-j/25);pts.push([x+Math.cos(t)*rr,1.965+Math.sin(t)*rr,n-Math.sign(n)*.010]);}
      tube(detail,'Throne_Seat_Rail_Cloud_Carving',pts,.0065,m.goldLight,18,5);
    }
  }
  for(const side of[-1,1]){
    tube(detail,'Throne_Side_Scroll_Tendril',[[side*1.62,1.94,-.86],[side*1.68,1.69,-.65],[side*1.65,1.56,-.26],[side*1.65,1.72,.07],[side*1.67,1.59,.43],[side*1.62,1.91,.83]],.037,m.gold,38,7);
    for(const u of[side*1.45])for(const n of[-.96,.90]){
      tube(detail,'Leg_Hand_Carved_Fluting',[[u,1.12,n+.115],[u*1.025,1.31,n+.15],[u*.98,1.54,n+.115],[u*.98,1.81,n+.115]],.017,m.goldLight,20,5);
      for(const q of[-1,0,1])sphere(detail,'Throne_Paw_Toe',m.goldLight,[u+q*.072,1.055,n+.14],[.043,.038,.061],12);
    }
    // Curved open arm panels leave the intended through-openings readable.
    for(const n of[-.47,.06,.56]){
      tube(detail,'Throne_Arm_Openwork_Ruyi',[[side*1.50,2.51,n-.18],[side*1.50,2.66,n-.16],[side*1.50,2.71,n],[side*1.50,2.91,n+.04],[side*1.50,2.74,n+.16],[side*1.50,2.58,n+.16],[side*1.50,2.51,n+.22]],.022,m.goldLight,24,6);
    }
    tube(detail,'Throne_Back_Moulded_Inner_Frame',[[side*1.31,2.29,-.945],[side*1.31,3.75,-.945],[side*1.16,3.93,-.945],[side*.12,3.93,-.945]],.025,m.goldLight,30,7);
  }
  // Front stool shares the same pierced wood-carving language.
  add(detail,'Footstool_Pierced_Apron',carvedApronGeometry(1.48,.23,.045),m.gold,[0,1.073,2.025]);
  for(const side of[-1,1])tube(detail,'Footstool_Rounded_Moulding',[[side*.76,1.235,1.41],[side*.81,1.235,1.47],[side*.81,1.235,1.94],[side*.76,1.235,2.02]],.018,m.goldLight,18,6);
  return detail;
}

// Smooth-union signed-distance sculpt: torso, shoulders, forehead and all four
// legs form a single continuous bronze surface with sculpted ankles and feet.
function elephantBodyGeometry(){
  const ell=(x,y,z,cx,cy,cz,rx,ry,rz)=>{x-=cx;y-=cy;z-=cz;const k0=Math.hypot(x/rx,y/ry,z/rz),k1=Math.hypot(x/(rx*rx),y/(ry*ry),z/(rz*rz));return k1<1e-8?-Math.min(rx,ry,rz):k0*(k0-1)/k1;};
  const smin=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
  const field=(x,y,z)=>{
    let d=ell(x,y,z,0,.61,-.045,.35,.31,.48);
    d=smin(d,ell(x,y,z,0,.67,.25,.32,.34,.29),.11);
    d=smin(d,ell(x,y,z,0,.80,.49,.245,.27,.25),.09);
    d=smin(d,ell(x,y,z,0,.91,.49,.228,.15,.22),.04);
    for(const u of[-.235,.235])for(const n of[-.30,.27]){
      const center=u+(y<.25?Math.sign(u)*.018:0),cy=Math.max(.10,Math.min(.48,y)),r=.101+.025*Math.exp(-(((y-.105)/.10)**2))+.025*Math.exp(-(((y-.43)/.12)**2));
      d=smin(d,Math.hypot(x-center,y-cy,z-n)-r,.075);
    }
    return Math.max(d,-y);
  };
  const min=[-.53,-.04,-.64],max=[.53,1.14,.80],step=.046,nx=Math.ceil((max[0]-min[0])/step),ny=Math.ceil((max[1]-min[1])/step),nz=Math.ceil((max[2]-min[2])/step),positions=[],normals=[];
  const corner=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
  const vertex=(a,b,da,db)=>{const t=da/(da-db);return a.map((v,i)=>v+(b[i]-v)*t);};
  const normal=p=>{const h=.001,[x,y,z]=p;return new THREE.Vector3(field(x+h,y,z)-field(x-h,y,z),field(x,y+h,z)-field(x,y-h,z),field(x,y,z+h)-field(x,y,z-h)).normalize();};
  const tri=(a,b,c)=>{const n=normal(a),face=new THREE.Vector3().crossVectors(V(b).sub(V(a)),V(c).sub(V(a)));if(face.dot(n)<0)[b,c]=[c,b];for(const p of[a,b,c]){positions.push(...p);normals.push(...normal(p));}};
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const ps=corner.map(q=>[min[0]+(x+q[0])*step,min[1]+(y+q[1])*step,min[2]+(z+q[2])*step]),ds=ps.map(p=>field(...p));
    if(ds.every(d=>d>0)||ds.every(d=>d<=0))continue;
    for(const tet of tets){const inside=tet.filter(i=>ds[i]<=0),outside=tet.filter(i=>ds[i]>0);if(!inside.length||!outside.length)continue;
      if(inside.length===1||outside.length===1){const lone=inside.length===1?inside[0]:outside[0],rest=inside.length===1?outside:inside;tri(...rest.map(j=>vertex(ps[lone],ps[j],ds[lone],ds[j])));}
      else {const[a,b]=inside,[c,d]=outside,p=vertex(ps[a],ps[c],ds[a],ds[c]),q=vertex(ps[a],ps[d],ds[a],ds[d]),r=vertex(ps[b],ps[c],ds[b],ds[c]),s=vertex(ps[b],ps[d],ds[b],ds[d]);tri(p,q,r);tri(q,s,r);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return g;
}

function earGeometry(sign=1){const s=new THREE.Shape();s.moveTo(0,.20);s.bezierCurveTo(sign*.15,.29,sign*.36,.19,sign*.36,.01);s.bezierCurveTo(sign*.40,-.11,sign*.26,-.29,sign*.17,-.28);s.bezierCurveTo(sign*.10,-.19,sign*.02,-.14,0,-.09);s.closePath();return shapeGeometry(s,.033,.014,16);}
function featherGeometry(length=.36,width=.095){
  const positions=[],uv=[],indices=[],segments=12;
  for(let i=0;i<=segments;i++){const t=i/segments,z=-length*t,half=width*.5*Math.sin(Math.PI*t)**.65;
    for(const side of[-1,0,1]){positions.push(side*half,.018*Math.sin(Math.PI*t)*(1-Math.abs(side))+.045*t*t,z);uv.push((side+1)/2,t);}
  }
  for(let i=0;i<segments;i++)for(let j=0;j<2;j++){const k=i*3+j;indices.push(k,k+1,k+3,k+1,k+4,k+3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function curvedBodyGeometry(){
  const rings=32,around=24,positions=[],indices=[],uv=[];
  for(let i=0;i<=rings;i++){const t=i/rings,z=.34-t*.77,r=Math.sin(Math.PI*t)**.72,cy=1.45+.12*Math.sin(t*Math.PI)-t*.10;
    for(let j=0;j<=around;j++){const a=j/around*Math.PI*2;positions.push(Math.cos(a)*.245*r,cy+Math.sin(a)*.31*r,z);uv.push(j/around,t);}
  }
  for(let i=0;i<rings;i++)for(let j=0;j<around;j++){const k=i*(around+1)+j;indices.push(k,k+around+1,k+1,k+1,k+around+1,k+around+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

function fittedWingFeather({rootY,rootZ,length,width,side}){
  const positions=[],uv=[],indices=[],spine=[],segments=16;
  const point=(t,lateral=0)=>{
    const z=rootZ-t*length,y=rootY-t*.16+lateral,bodyT=Math.max(.015,Math.min(.985,(.34-z)/.77)),r=Math.sin(Math.PI*bodyT)**.72,cy=1.45+.12*Math.sin(Math.PI*bodyT)-bodyT*.10;
    const dy=(y-cy)/(.31*r),surface=.245*r*Math.sqrt(Math.max(.035,1-dy*dy)),lift=-.006*(1-t)**8+.021*Math.sin(Math.PI*t)+.017*t;
    return[side*(surface+lift),y,z];
  };
  for(let i=0;i<=segments;i++){
    const t=i/segments,half=(.007*(1-t)+width*.5*Math.sin(Math.PI*t)**.70);
    for(const edge of[-1,0,1]){positions.push(...point(t,edge*half));uv.push((edge+1)/2,t);}spine.push(point(t));
  }
  for(let i=0;i<segments;i++)for(let j=0;j<2;j++){const k=i*3+j;side>0?indices.push(k,k+3,k+1,k+1,k+3,k+4):indices.push(k,k+1,k+3,k+1,k+4,k+3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return{geometry:g,spine,root:point(0),point};
}

function piercedLidGeometry(){
  const sectors=72,rings=18,positions=[],indices=[],uv=[],rAt=t=>.31*(1-t)**.65+.07*t,yAt=t=>.02+.34*t;
  const present=(i,j)=>!((i>=3&&i<=7&&j%6>=2&&j%6<=3)||(i>=10&&i<=13&&(j+3)%6>=2&&(j+3)%6<=3));
  const point=(i,j,inner=false)=>{const t=i/rings,a=j/sectors*Math.PI*2,r=rAt(t)-(inner?.018:0);return[Math.cos(a)*r,yAt(t),Math.sin(a)*r];};
  const quad=(points,inward=false)=>{const k=positions.length/3;for(let i=0;i<4;i++){positions.push(...points[i]);uv.push(i%2,Math.floor(i/2));}inward?indices.push(k,k+2,k+1,k,k+3,k+2):indices.push(k,k+1,k+2,k,k+2,k+3);};
  for(let i=0;i<rings;i++)for(let j=0;j<sectors;j++){if(!present(i,j))continue;const q=[point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)],p=[point(i,j,true),point(i+1,j,true),point(i+1,j+1,true),point(i,j+1,true)];quad(q);quad(p,true);
    for(const[e,ni,nj]of[[0,i,j-1],[1,i+1,j],[2,i,j+1],[3,i-1,j]]){if(ni>=0&&ni<rings&&present(ni,(nj+sectors)%sectors))continue;const next=(e+1)%4;quad([q[e],p[e],p[next],q[next]]);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

// Reused anatomical skins. The V11 arrangement supplies new reference-led
// materials, proportions and support geometry, without duplicating the skins.
export {elephantBodyGeometry,earGeometry,featherGeometry,curvedBodyGeometry,fittedWingFeather};

export function buildRitualSculpturesV8({solid,ornaments,materials:m,table,wallBound}){
  const group=new THREE.Group();group.name='V8_Sculpted_Ritual_Objects';ornaments.add(group);
  const bronze=new THREE.MeshStandardMaterial({color:0xa78b50,roughness:.43,metalness:.65});bronze.name='Ceremonial_Aged_Crane_Bronze';
  const featherMat=new THREE.MeshStandardMaterial({color:0x7c663f,roughness:.52,metalness:.48,side:THREE.DoubleSide});featherMat.name='Ceremonial_Sculpted_Feather_Edges';
  const enamel=new THREE.MeshStandardMaterial({color:0x577d77,roughness:.27,metalness:.18});enamel.name='Ceremonial_Cloisonne_Enamel';
  const sharedElephant=elephantBodyGeometry(),ears={1:earGeometry(1),'-1':earGeometry(-1)},feather=featherGeometry(),body=curvedBodyGeometry(),piercedLid=piercedLidGeometry();
  const features={elephants:[],cranes:[],censers:[]};
  for(const side of[-1,1]){
    const u=side*3.55,n=-.66,y=table(u,n,1.04),e=new THREE.Group();e.name='Sculpted_Bronze_Elephant_'+side;e.position.set(u,y,n);e.rotation.y=-side*68*Math.PI/180;group.add(e);
    add(e,'Elephant_Continuous_Anatomical_Casting',sharedElephant,m.gold);
    for(const sign of[-1,1]){
      const earGroup=new THREE.Group();earGroup.name='Elephant_Asian_Ear_'+sign;earGroup.position.set(sign*.21,.76,.37);earGroup.scale.set(.65,.65,.65);e.add(earGroup);
      add(earGroup,'Elephant_Flared_Sculpted_Ear',ears[sign],m.gold);
      tube(earGroup,'Elephant_Ear_Rim',[[sign*.037,.20,.05],[sign*.18,.21,.05],[sign*.35,.07,.05],[sign*.33,-.16,.05],[sign*.18,-.27,.05],[sign*.05,-.12,.05]],.016,m.goldLight,28,6);
      for(let j=0;j<4;j++)tube(earGroup,'Elephant_Ear_Folds',[[sign*.044,.01,.075],[sign*(.12+j*.025),.07-j*.060,.085],[sign*(.24+j*.015),.12-j*.096,.085]],.0075,m.goldShade,12,4,false);
      sphere(e,'Elephant_Inlaid_Eye',m.black,[sign*.185,.894,.653],[.027,.021,.021],16);
      tube(e,'Elephant_Carved_Eyelid',[[sign*.159,.910,.658],[sign*.185,.922,.659],[sign*.208,.903,.650]],.011,m.goldLight,12,5);
      tapered(e,'Elephant_Curved_Ivory_Tusk',[[sign*.17,.71,.64],[sign*.22,.61,.81],[sign*.22,.58,.95],[sign*.15,.68,1.04]],[.045,.039,.024,.0025],m.ivory,32,10);
    }
    tapered(e,'Elephant_Curled_Trunk',[[0,.86,.66],[0,.65,.79],[0,.42,.83],[0,.20,.88],[0,.21,1.04],[0,.34,1.12],[0,.46,1.035]],[.105,.093,.075,.059,.046,.037,.029],m.gold,52,14);
    for(let j=0;j<13;j++){
      const yy=.44+j*.027,zz=.83-(yy-.44)*.20,rr=.073+(yy-.44)*.085;
      tube(e,'Elephant_Trunk_Incised_Fold',[[-rr*.86,yy,zz+.038],[-rr*.42,yy-.009,zz+rr],[0,yy-.013,zz+rr*1.12],[rr*.42,yy-.009,zz+rr],[rr*.86,yy,zz+.038]],.005,m.goldShade,12,4,false);
    }
    tapered(e,'Elephant_Tail',[[0,.72,-.48],[.02,.51,-.57],[.05,.27,-.55],[.10,.20,-.51]],[.024,.022,.017,.009],m.gold,24,8);
    for(const du of[-.253,.253])for(const dn of[-.30,.27])for(const toe of[-1,0,1])sphere(e,'Elephant_Carved_Toenail',m.goldLight,[du+toe*.046,.048,dn+.106],[.025,.033,.012],10);
    // A curved saddle follows the back instead of floating as a flat square.
    const ps=[],ns=[],idx=[],uv=[];for(let i=0;i<=16;i++)for(let j=0;j<=12;j++){const uu=(i/16-.5)*.77,nn=-.41+j/12*.63;ps.push(uu,.64+.31*Math.sqrt(Math.max(.06,1-(uu/.39)**2)),nn);uv.push(i/16,j/12);}
    for(let i=0;i<16;i++)for(let j=0;j<12;j++){const k=i*13+j;idx.push(k,k+1,k+13,k+1,k+14,k+13);}const saddle=new THREE.BufferGeometry();saddle.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));saddle.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));saddle.setIndex(idx);saddle.computeVertexNormals();add(e,'Elephant_Curved_Enamel_Saddle',saddle,m.blue);
    for(const nn of[-.41,.22]){const points=[];for(let i=0;i<=20;i++){const uu=(i/20-.5)*.77;points.push([uu,.647+.31*Math.sqrt(Math.max(.06,1-(uu/.39)**2)),nn]);}tube(e,'Elephant_Saddle_Brocade_Border',points,.014,m.goldLight,24,5);}
    for(const sign of[-1,1])for(let j=0;j<6;j++)tapered(e,'Elephant_Saddle_Tassel',[[sign*.38,.72,-.36+j*.10],[sign*.395,.66,-.36+j*.10],[sign*.40,.61,-.36+j*.10]],[.009,.013,.002],m.goldLight,8,5);
    add(e,'Elephant_Balanced_Vase_Stand',lathe([[.18,0],[.18,.025],[.14,.05],[.14,.07]]),m.goldShade,[0,.95,-.07]);
    add(e,'Elephant_Offering_Vase',lathe([[0,0],[.115,0],[.13,.03],[.11,.07],[.17,.12],[.185,.21],[.15,.28],[.085,.33],[.075,.40],[.11,.46],[.11,.49],[.08,.49],[.06,.41],[.055,.35],[0,.31]],40),m.gold,[0,1.02,-.07]);
    for(let j=0;j<10;j++){const a=j*Math.PI/5;add(e,'Vase_Lotus_Petal',feather,m.goldLight,[Math.cos(a)*.15,1.23,-.07+Math.sin(a)*.15],[0,-a+Math.PI/2,Math.PI*.35]);}
    features.elephants.push({name:e.name,baseY:y,castTriangles:sharedElephant.attributes.position.count/3,inwardDegrees:68});
    wallBound('elephant-'+side,u-side*.255,n+.10,1.82,1.23,y,y+1.55);
  }
  for(const side of[-1,1]){
    const u=side*4.20,n=1.10,base=.85,c=new THREE.Group();c.name='Sculpted_Crane_'+side;c.position.set(u,base,n);group.add(c);
    add(c,'Crane_Stone_Pedestal',new THREE.BoxGeometry(.74,.14,.79),m.dark,[0,.07,0]);
    add(c,'Crane_Cast_Octagonal_Foot',new THREE.CylinderGeometry(.34,.37,.04,8),m.goldShade,[0,.16,0]);
    for(const sign of[-1,1]){
      const xx=sign*.105;
      tapered(c,'Crane_Anatomical_Leg',[[xx,.18,.04],[xx,.50,-.01],[xx,.76,-.085],[xx,.99,-.03],[xx,1.22,.025]],[.025,.025,.031,.028,.035],bronze,36,10);
      sphere(c,'Crane_Ankle_Joint',bronze,[xx,.74,-.085],[.042,.047,.043],14);
      for(let k=-1;k<=1;k++)tapered(c,'Crane_Articulated_Toe',[[xx,.205,.04],[xx+k*.065,.19,.16],[xx+k*.09,.187,.30]],[.014,.012,.003],m.goldShade,14,6);
      tapered(c,'Crane_Rear_Toe',[[xx,.205,.03],[xx+sign*.04,.19,-.10],[xx+sign*.06,.186,-.17]],[.013,.01,.003],m.goldShade,12,6);
      for(let j=0;j<9;j++){const yy=.28+j*.043;tube(c,'Crane_Leg_Scale_Bands',[[xx-.023,yy,.02-(yy-.28)*.17],[xx,yy+.005,.032-(yy-.28)*.17],[xx+.023,yy,.02-(yy-.28)*.17]],.004,m.goldLight,6,4,false);}
    }
    add(c,'Crane_Sculpted_Torso',body,bronze);
    tapered(c,'Crane_Curved_Neck',[[0,1.53,.20],[0,1.78,.27],[0,2.05,.21],[0,2.30,.22],[0,2.47,.37],[0,2.46,.54]],[.105,.071,.054,.046,.054,.066],bronze,56,14);
    sphere(c,'Crane_Head',bronze,[0,2.455,.54],[.092,.083,.126],24);
    sphere(c,'Crane_Red_Crown',m.red,[0,2.52,.51],[.058,.017,.060],20);
    for(const sign of[-1,1]){sphere(c,'Crane_Eye',m.black,[sign*.077,2.48,.575],[.013,.014,.012],12);tube(c,'Crane_Eye_Rim',[[sign*.08,2.492,.562],[sign*.084,2.496,.576],[sign*.08,2.485,.592]],.005,m.goldLight,10,5);}
    tapered(c,'Crane_Tapered_Beak',[[0,2.46,.63],[0,2.45,.79],[0,2.43,1.01]],[.032,.020,.0015],m.goldShade,22,10);
    tube(c,'Crane_Beak_Seam',[[.028,2.452,.64],[.017,2.444,.79],[.002,2.43,.99]],.0025,m.black,12,4,false);
    for(const sign of[-1,1]){
      for(const[kind,count]of[['Primary',11],['Covert',9]])for(let j=0;j<count;j++){
        const primary=kind==='Primary',f=fittedWingFeather({rootY:(primary?1.60:1.69)-j*(primary?.014:.013),rootZ:.18-j*(primary?.033:.036),length:primary?.31+j*.009:.235,width:primary?.095:.085,side:sign});
        const mesh=add(c,'Crane_Layered_'+kind+'_Feather',f.geometry,primary?featherMat:bronze);mesh.userData.featherRoot=f.root;
        const raised=f.spine.map(p=>[p[0]+sign*.0025,p[1],p[2]]);tube(c,'Crane_Engraved_Feather_Quill',raised,.0035,m.gold,20,4);
        if(primary)for(const t of[.25,.43,.61,.77])for(const edge of[-1,1]){
          const pts=[f.point(t),f.point(t+.045,edge*.024),f.point(t+.085,edge*.034)].map(p=>[p[0]+sign*.003,p[1],p[2]]);tube(c,'Crane_Chased_Feather_Barb',pts,.0018,m.goldLight,6,4,false);
        }
      }
    }
    for(let j=-2;j<=2;j++){const f=add(c,'Crane_Tail_Plume',feather,featherMat,[j*.04,1.29,-.31],[.65,j*.12,0]);f.scale.set(.95,1,1.15);}
    // Hundreds of engraved barbs share a pair of bounded meshes per bird;
    // their geometry remains real without hundreds of extra WebGL draw calls.
    for(const name of['Crane_Engraved_Feather_Quill','Crane_Chased_Feather_Barb']){
      const pieces=c.children.filter(o=>o.name===name),combined=mergeGeometries(pieces.map(o=>o.geometry),false);
      if(combined){const rendered=add(c,name,combined,pieces[0].material,[0,0,0],null,name.endsWith('Quill'));rendered.userData.carvedStrokes=pieces.length;for(const piece of pieces){c.remove(piece);piece.geometry.dispose();}}
    }
    features.cranes.push({name:c.name,feathers:45,toes:8});wallBound('crane-'+side,u,n+.30,.84,1.61,base,base+2.57);
  }
  for(const side of[-1,1]){
    const u=side*3.05,n=2.15,base=.85,c=new THREE.Group();c.name='Sculpted_Cloisonne_Censer_'+side;c.position.set(u,base,n);group.add(c);
    add(c,'Censer_Supported_Stone_Base',new THREE.BoxGeometry(.92,.14,.92),m.dark,[0,.07,0]);
    add(c,'Censer_Octagonal_Gilt_Base',new THREE.CylinderGeometry(.43,.43,.06,8),m.goldShade,[0,.17,0]);
    for(let j=0;j<3;j++){const a=j*Math.PI*2/3,rad=(r,y)=>[Math.cos(a)*r,y,Math.sin(a)*r];tapered(c,'Censer_Cabriole_Tripod_Leg',[rad(.34,.20),rad(.38,.29),rad(.27,.39),rad(.25,.52)],[.060,.052,.046,.073],m.gold,28,10);sphere(c,'Censer_Claw_Foot',m.goldLight,rad(.34,.221),[.075,.022,.070],14);}
    const profile=[[0,0],[.17,0],[.22,.03],[.29,.08],[.36,.16],[.40,.26],[.405,.36],[.385,.46],[.34,.55],[.275,.60],[.26,.66],[.29,.69],[.29,.72],[.25,.72],[.235,.66],[.25,.59],[.30,.53],[.34,.45],[.35,.35],[.345,.26],[.31,.17],[.24,.10],[.17,.08],[0,.08]];
    add(c,'Tripod_Cloisonne_Censer',lathe(profile,56),enamel,[0,.43,0]);
    for(const[y,r]of[[.47,.225],[.59,.36],[.98,.34],[1.12,.292]])add(c,'Censer_Turned_Gilt_Band',new THREE.TorusGeometry(r,.013,6,48),m.goldLight,[0,y,0],[Math.PI/2,0,0]);
    add(c,'Pierced_Censer_Lid',piercedLid,m.gold,[0,1.13,0]);
    add(c,'Censer_Lid_Lotus_Finial',lathe([[.065,0],[.065,.02],[.092,.065],[.075,.115],[.035,.15],[0,.18]],32),m.goldLight,[0,1.49,0]);
    // Eight actual perforations expose the dark hollow interior, with raised
    // wire rims and individual enamel petals following the vessel surface.
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4,r=.404,centerY=.78,points=[];
      for(let k=0;k<=48;k++){const t=k/48*Math.PI*2,lobe=.070*(.72+.28*Math.cos(t*5)),angle=a+Math.cos(t)*lobe/r,y=centerY+Math.sin(t)*lobe;points.push([Math.cos(angle)*(r-.010*((y-centerY)/.1)**2),y,Math.sin(angle)*(r-.010*((y-centerY)/.1)**2)]);}
      tube(c,'Censer_Cloisonne_Floral_Wire',points,.0065,m.goldLight,48,5);
      const petal=sphere(c,'Censer_Enamel_Flower_Centre',m.blue,[Math.cos(a)*.407,centerY,Math.sin(a)*.407],[.020,.020,.011],12);petal.rotation.y=-a+Math.PI/2;
      for(const sign of[-1,1]){const pts=[];for(let k=0;k<=18;k++){const t=k/18,aa=a+sign*(.08+Math.sin(t*Math.PI)*.10),yy=.65+t*.27,rr=.38+.027*Math.sin(t*Math.PI);pts.push([Math.cos(aa)*rr,yy,Math.sin(aa)*rr]);}tube(c,'Censer_Foliate_Gold_Wire',pts,.005,m.gold,20,5,false);}
    }
    for(const sign of[-1,1])tube(c,'Censer_Sculpted_Ruyi_Handle',[[sign*.32,.94,0],[sign*.49,1.00,0],[sign*.55,1.16,0],[sign*.50,1.30,0],[sign*.39,1.30,0],[sign*.38,1.19,0],[sign*.43,1.15,0]],.025,m.gold,36,8);
    features.censers.push({name:c.name,perforations:24,floralMedallions:8});wallBound('censer-'+side,u,n,1.18,.94,base,base+1.69);
  }
  return {group,features};
}

export function buildCeremonialCarpetsV8({solid,texture,materials:m}){
  const group=new THREE.Group();group.name='V8_True_Scale_Woven_Carpets';solid.add(group);
  const mat=(name,color)=>{const material=new THREE.MeshStandardMaterial({color,roughness:.98,metalness:0});material.name='Ceremonial_Carpet_'+name;return material;};
  const backing=mat('Woven_Edge',0x8b623e),navy=mat('Indigo_Border',0x243e4b),ochre=mat('Ochre_Border',0xb99051),cream=mat('Ivory_Border',0xd1b781),field=mat('Imperial_Cloud_Field',texture?0xffffff:0xb58a4b);
  if(texture){const map=texture.clone();map.name='ArchitecturalDetail_Metre_Scale_Imperial_Carpet';map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(1,1);map.anisotropy=16;map.userData={...map.userData,detailPriority:true,preserveResolution:true};map.needsUpdate=true;field.map=map;}
  const batches=new Map(),unitBox=new THREE.PlaneGeometry(1,1),temp=new THREE.Object3D(),metadata=[];
  const strip=(material,x,y,z,w,h)=>{if(!batches.has(material))batches.set(material,[]);temp.position.set(x,y,z);temp.scale.set(w,h,1);temp.rotation.set(-Math.PI/2,0,0);temp.updateMatrix();batches.get(material).push(temp.matrix.clone());};
  for(const[id,w,length,y,z,tileMetres]of[['entry-runner',4.4,26.7,0,19.15,4.0],['throne-dais',8.10,6.50,.85,.10,4.0]]){
    const body=add(group,id+'_Woven_Body',new THREE.BoxGeometry(w,.012,length),backing,[0,y+.006,z]);body.userData.carpetPart='backing';body.userData.carpetId=id;
    const border=.33,fieldWidth=w-2*border,fieldLength=length-2*border;
    const g=new THREE.PlaneGeometry(fieldWidth,fieldLength),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++){uv.setXY(i,uv.getX(i)*fieldWidth/tileMetres,uv.getY(i)*fieldLength/tileMetres);}uv.needsUpdate=true;
    const top=add(group,id+'_UV_Scaled_Woven_Field',g,field,[0,y+.0124,z],[-Math.PI/2,0,0]);top.userData={...top.userData,carpetPart:'woven-field',carpetId:id,tileMetres};
    // Six bands are dimensioned in metres. Side strips stop at end strips;
    // their joints are coplanar, without overlapping full-size rug planes.
    let inset=0;
    for(const[bandWidth,material]of[[.025,cream],[.035,navy],[.025,ochre],[.19,navy],[.025,cream],[.03,navy]]){
      const ww=w-inset*2,ll=length-inset*2,yy=y+.0124;
      strip(material,0,yy,z-ll/2+bandWidth/2,ww,bandWidth);strip(material,0,yy,z+ll/2-bandWidth/2,ww,bandWidth);
      for(const side of[-1,1])strip(material,side*(ww/2-bandWidth/2),yy,z,bandWidth,ll-bandWidth*2);
      inset+=bandWidth;
    }
    // Continuous square-key weaving uses short, flat bands in the rug plane.
    const key=(cx,cz,angle)=>{
      const points=[[-.062,-.060],[.062,-.060],[.062,.060],[-.026,.060],[-.026,-.015],[.025,-.015],[.025,.020]],th=.012;
      for(let i=0;i<points.length-1;i++){
        const [ax,az]=points[i],[bx,bz]=points[i+1],mx=(ax+bx)/2,mz=(az+bz)/2,xx=cx+mx*Math.cos(angle)-mz*Math.sin(angle),zz=cz+mx*Math.sin(angle)+mz*Math.cos(angle);
        const horizontal=Math.abs(bx-ax)>Math.abs(bz-az),len=horizontal?Math.abs(bx-ax)+th:Math.abs(bz-az)+th;
        if(Math.abs(Math.sin(angle))<.5)strip(cream,xx,y+.0131,zz,horizontal?len:th,horizontal?th:len);
        else strip(cream,xx,y+.0131,zz,horizontal?th:len,horizontal?len:th);
      }
    };
    const keyInset=.18,sideCount=Math.floor((length-.65)/.18),sidePitch=(length-.65)/sideCount,endCount=Math.floor((w-.65)/.18),endPitch=(w-.65)/endCount;
    for(const side of[-1,1]){
      for(let i=0;i<sideCount;i++)key(side*(w/2-keyInset),z-(length-.65)/2+(i+.5)*sidePitch,side*Math.PI/2);
      for(let i=0;i<endCount;i++)key(-(w-.65)/2+(i+.5)*endPitch,z+side*(length/2-keyInset),side<0?0:Math.PI);
    }
    metadata.push({id,width:w,length,baseY:y,minX:-11.7+z-length/2,maxX:-11.7+z+length/2,minZ:-w/2,maxZ:w/2,tileMetres,borderWidth:border,uvScale:[fieldWidth/tileMetres,fieldLength/tileMetres],fieldMeshName:top.name,bodyMeshName:body.name});
  }
  for(const[material,matrices]of batches){const mesh=new THREE.InstancedMesh(unitBox,material,matrices.length);mesh.name='Woven_In_Plane_Border_'+material.name;matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.userData={keepSolidInFallback:true,carpetPart:'border'};mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);}
  return{group,metadata};
}

