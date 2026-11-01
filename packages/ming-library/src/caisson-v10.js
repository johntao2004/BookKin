import * as THREE from 'three';
import {upperLocalYV15} from './height-v15.js';

/** Reference-led caisson: a carried square timber curb, octagonal corbelled
 * well, engraved dragon panel and separately suspended bronze pearl cluster.
 * The dragon is a UV-mapped painting/relief texture, never a primitive snake.
 * The supplied panorama is visual evidence, not a measured survey. */
export const CAISSON_V10 = Object.freeze({centerX:0,centerZ:0,baseY:upperLocalYV15(14.34),outerHalf:4.25,openingHalf:3.95,bridgeOffset:4.10,tiers:5});
const BOX=new THREE.BoxGeometry(1,1,1),SPHERE=new THREE.SphereGeometry(1,32,20),BEAD=new THREE.SphereGeometry(1,8,6),CYLINDER=new THREE.CylinderGeometry(1,1,1,24);
const materialCache=new WeakMap();
let plainMaterials=null;
function atlasMaterials(texture){
  if(texture&&materialCache.has(texture))return materialCache.get(texture);
  if(!texture&&plainMaterials)return plainMaterials;
  if(texture){texture.name='ArchitecturalDetail_Caisson_Dragon_Atlas_V10';texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=16;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;}
  const make=(name,color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.65,...extra});m.name=name;return m;};
  const result={
    green:make('Caisson_Deep_Green_Lacquer',0x143d30,{roughness:.64}),
    gold:make('Caisson_Aged_Gilt_Moulding',0xbb8e3c,{metalness:.62,roughness:.44}),
    darkGold:make('Caisson_Recessed_Bronze',0x624927,{metalness:.48,roughness:.62}),
    pearl:make('Caisson_Patinated_Bronze_Pearl',0x8e8258,{metalness:.76,roughness:.30}),
    dragon:make('Caisson_Engraved_Dragon_Texture',texture?0xffffff:0xb8984c,{map:texture,metalness:.20,roughness:.60,emissive:0x4a3415,emissiveIntensity:.12,side:THREE.DoubleSide}),
    coffer:make('Caisson_Green_Gold_Coffer_Texture',texture?0xffffff:0x214e38,{map:texture,metalness:.05,roughness:.79,side:THREE.DoubleSide}),
  };
  if(texture)materialCache.set(texture,result);else plainMaterials=result;
  return result;
}
function tileGeometry(){
  const g=new THREE.PlaneGeometry(1,1),uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,.503+uv.getX(i)*.494,.006+uv.getY(i)*.988);
  return g;
}
const TILE=tileGeometry();

/** Divide the original structural ceiling bays into fine painted coffers;
 * their 40 mm muntins are decoration fixed to the real timber ceiling. */
export function addReferenceCofferTilesV10({batch,texture,materials,x,z,width,depth,y=CAISSON_V10.baseY}){
  const m=atlasMaterials(texture),nx=3,nz=3,w=width/nx,d=depth/nz;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)batch.add(TILE,m.coffer,[x-width/2+(i+.5)*w,y-.004,z-depth/2+(j+.5)*d],[w-.038,d-.038,1],[Math.PI/2,0,0],false);
  for(let i=1;i<nx;i++)batch.box(m.green,x-width/2+i*w,y-.021,z,.038,.04,depth);
  for(let j=1;j<nz;j++)batch.box(m.green,x,y-.021,z-depth/2+j*d,width,.04,.038);
  return nx*nz;
}

function octagon(apothem){const t=Math.tan(Math.PI/8)*apothem;return [[-apothem,-t],[-t,-apothem],[t,-apothem],[apothem,-t],[apothem,t],[t,apothem],[-t,apothem],[-apothem,t]];}
function polygonRingGeometry(outer,inner,height){
  const shape=new THREE.Shape();outer.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  const hole=new THREE.Path();[...inner].reverse().forEach(([x,z],i)=>i?hole.lineTo(x,z):hole.moveTo(x,z));hole.closePath();shape.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(shape,{depth:height,steps:1,bevelEnabled:false});
  // Shape XY becomes plan XZ; extrusion grows upward.
  g.rotateX(Math.PI/2);g.translate(0,height,0);g.computeVertexNormals();return g;
}
function slopingRingGeometry(outer,inner,y0,y1,thickness=.045){
  const positions=[],uvs=[],indices=[];
  const put=(p,y)=>{positions.push(p[0],y,p[1]);uvs.push(.25+p[0]/17,.5+p[1]/8.5);};
  for(let i=0;i<outer.length;i++){
    const n=(i+1)%outer.length,k=positions.length/3;
    for(const [p,y] of [[outer[i],y0],[outer[n],y0],[inner[n],y1],[inner[i],y1],[outer[i],y0+thickness],[outer[n],y0+thickness],[inner[n],y1+thickness],[inner[i],y1+thickness]])put(p,y);
    indices.push(k,k+1,k+2,k,k+2,k+3,k+4,k+6,k+5,k+4,k+7,k+6,k,k+4,k+5,k,k+5,k+1,k+3,k+2,k+6,k+3,k+6,k+7);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function addReferenceCaissonV10({parent,texture=null,materials={},centerX=0,centerZ=0,baseY=CAISSON_V10.baseY}){
  const group=new THREE.Group();group.name='Throne_Axis_Caisson';group.position.set(centerX,0,centerZ);parent.add(group);
  const m=atlasMaterials(texture),parts=[],supports=[],groups=new Map(),object=new THREE.Object3D();
  const add=(name,geometry,material,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],kind='ornament')=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.scale.set(...scale);mesh.rotation.set(...rotation);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.keepSolidInFallback=true;
    if(kind==='ring'||kind==='infill')mesh.userData.collision='triangle-mesh';
    group.add(mesh);parts.push({name,kind,mesh});return mesh;
  };
  const batch=(name,material,position,scale,rotation=[0,0,0],geometry=BOX)=>{
    const key=geometry.uuid+'/'+material.uuid;if(!groups.has(key))groups.set(key,{geometry,material,entries:[]});
    object.position.set(...position);object.scale.set(...scale);object.rotation.set(...rotation);object.updateMatrix();
    groups.get(key).entries.push({name,matrix:object.matrix.clone()});
  };
  const square=(name,half,width,bottom,height,material=m.gold)=>{
    const meshes=[];
    for(const s of[-1,1]){
      meshes.push(add(name+'-x-'+s,BOX,material,[0,bottom+height/2,s*(half-width/2)],[half*2,height,width],[0,0,0],'square-curb'));
      meshes.push(add(name+'-z-'+s,BOX,material,[s*(half-width/2),bottom+height/2,0],[width,height,half*2-width*2],[0,0,0],'square-curb'));
    }return meshes;
  };
  const curbs=square('Caisson_Carried_Square_Base',4.25,.30,baseY,.22,materials.red??m.darkGold);
  square('Caisson_Square_Gilt_Architrave',4.25,.30,baseY+.22,.035);
  const ledge=square('Caisson_Square_Upper_Ledge',4.19,.39,baseY+.255,.105,m.darkGold);
  const fineFillet=square('Caisson_Square_Fine_Fillet',4.19,.11,baseY+.36,.025);
  const cornerGeometry=polygonRingGeometry([[-4.19,-4.19],[4.19,-4.19],[4.19,4.19],[-4.19,4.19]],octagon(3.70),.055);
  const cornerPosition=cornerGeometry.attributes.position,cornerUV=cornerGeometry.attributes.uv;
  for(let i=0;i<cornerUV.count;i++)cornerUV.setXY(i,.25+cornerPosition.getX(i)/17,.5+cornerPosition.getZ(i)/8.5);
  const cornerDeck=add('Caisson_Square_To_Octagon_Corner_Panels',cornerGeometry,m.dragon,[0,baseY+.385,0],[1,1,1],[0,0,0],'ring');
  supports.push({carried:cornerDeck.name,bearing:fineFillet.map(x=>x.name),type:'board-on-curb'});
  for(const f of fineFillet)supports.push({carried:f.name,bearing:ledge.map(x=>x.name),type:'fillet-on-ledge'});
  // Fine, closely spaced bracket blocks beneath the first octagonal curb.
  for(const sign of[-1,1])for(let i=0;i<27;i++){
    const v=-3.88+i*(7.76/26);
    batch('Caisson_Square_Dentil',m.gold,[v,baseY+.31,sign*4.06],[.12,.10,.18]);
    batch('Caisson_Square_Dentil',m.gold,[sign*4.06,baseY+.31,v],[.18,.10,.12]);
  }
  const rings=[],levels=[];
  for(let level=0;level<5;level++){
    const outerA=3.86-level*.365,innerA=outerA-.23,bottom=baseY+.44+level*.245;
    const ring=add(`Caisson_Octagonal_Curb_${level+1}`,polygonRingGeometry(octagon(outerA),octagon(innerA),.115),m.darkGold,[0,bottom,0],[1,1,1],[0,0,0],'ring');
    const fillet=add(`Caisson_Octagonal_Gilt_Lip_${level+1}`,polygonRingGeometry(octagon(outerA+.012),octagon(innerA-.025),.026),m.gold,[0,bottom+.115,0],[1,1,1],[0,0,0],'ring');
    rings.push(ring);levels.push({outerA,innerA,bottom,top:bottom+.141,ring: ring.name});
    if(level===0)supports.push({carried:ring.name,bearing:[cornerDeck.name],type:'octagon-on-corner-panels'});
    if(level<4){
      const nextA=outerA-.365,nextBottom=bottom+.245;
      const panel=add(`Caisson_Engraved_Sloping_Infill_${level+1}`,slopingRingGeometry(octagon(innerA),octagon(nextA-.03),bottom+.116,nextBottom+.015),m.dragon,[0,0,0],[1,1,1],[0,0,0],'infill');
      // Three small corbel arms per face. Their outer seats overlap the lower
      // curb, while their inner tips support the following smaller curb.
      for(let side=0;side<8;side++){
        const theta=-Math.PI/2+side*Math.PI/4,nx=Math.cos(theta),nz=Math.sin(theta),tx=-nz,tz=nx;
        for(const t of[-.65,0,.65]){
          const r=(outerA+nextA)/2-.11;
          batch(`Caisson_Seated_Corbel_${level+1}`,m.gold,[nx*r+tx*t,nextBottom-.052,nz*r+tz*t],[.55,.104,.095],[0,-theta,0]);
        }
      }
      supports.push({carried:`Caisson_Octagonal_Curb_${level+2}`,bearing:[ring.name],type:'seated-cantilever-corbel',infill:panel.name});
    }
    // Gilt beading follows the actual eight sides; no dragon-shaped primitives.
    const points=octagon(outerA-.06);
    for(let side=0;side<8;side++){
      const a=points[side],b=points[(side+1)%8],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.floor(length/.19);
      for(let j=0;j<n;j++)batch('Caisson_Gilt_Bead',m.gold,[THREE.MathUtils.lerp(a[0],b[0],(j+.5)/n),bottom-.008,THREE.MathUtils.lerp(a[1],b[1],(j+.5)/n)],[.026,.026,.026],[0,0,0],BEAD);
    }
  }
  const final=levels.at(-1),capY=final.top,capRadius=2.36;
  const cap=add('Caisson_Dragon_Roundel_Timber_Back',new THREE.CylinderGeometry(capRadius,capRadius,.10,96),m.darkGold,[0,capY+.05,0],[1,1,1],[0,0,0],'medallion-back');
  const disc=new THREE.CircleGeometry(capRadius-.045,96),uv=disc.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,.004+uv.getX(i)*.492,.008+uv.getY(i)*.984);
  const dragon=add('Caisson_Central_Dragon_Engraved_Face',disc,m.dragon,[0,capY-.002,0],[1,1,1],[Math.PI/2,0,Math.PI/2],'dragon-texture');
  const roundLip=add('Caisson_Round_Dragon_Frame',new THREE.TorusGeometry(capRadius-.016,.055,10,96),m.gold,[0,capY+.002,0],[1,1,1],[Math.PI/2,0,0],'gilt-moulding');
  supports.push({carried:cap.name,bearing:['Caisson_Octagonal_Gilt_Lip_5'],type:'round-panel-on-octagonal-curb'});
  // Actual central suspension: one stem, one central bronze sphere and six
  // satellites on curved-free metal rods. They all connect to the roundel.
  const pearlY=baseY-.54,mainRadius=.43;
  const stemTop=capY+.06,stemBottom=pearlY+mainRadius-.04;
  const stem=add('Caisson_Pearl_Central_Suspension',CYLINDER,m.pearl,[0,(stemTop+stemBottom)/2,0],[.055,stemTop-stemBottom,.055],[0,0,0],'suspension');
  add('Caisson_Pearl_Suspension_Boss',CYLINDER,m.gold,[0,capY-.075,0],[.22,.15,.22]);
  const central=add('Caisson_Central_Bronze_Pearl',SPHERE,m.pearl,[0,pearlY,0],[mainRadius,mainRadius,mainRadius],[0,0,0],'pearl');
  const satellites=[];
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3,rr=.72,r=.17,yy=pearlY+.24+(i%2)*.19,x=Math.cos(angle)*rr,z=Math.sin(angle)*rr;
    const top=[x,capY-.40+.0175,z],bottom=[x,yy+r-.025,z];
    add(`Caisson_Pearl_Hanger_${i+1}`,CYLINDER,m.pearl,[x,(top[1]+bottom[1])/2,z],[.016,top[1]-bottom[1],.016],[0,0,0],'suspension');
    // Radial head arms meet the central suspension stem.
    batch('Caisson_Suspension_Crown_Arm',m.pearl,[x/2,capY-.40,z/2],[rr,.035,.035],[0,-angle,0]);
    satellites.push(add(`Caisson_Satellite_Bronze_Pearl_${i+1}`,SPHERE,m.pearl,[x,yy,z],[r,r,r],[0,0,0],'pearl'));
  }
  supports.push({carried:central.name,bearing:[stem.name],type:'metal-hanger'});
  for(const {geometry,material,entries}of groups.values()){
    const mesh=new THREE.InstancedMesh(geometry,material,entries.length);mesh.name='Caisson_Detail_'+material.name+'_'+geometry.type;entries.forEach((r,i)=>mesh.setMatrixAt(i,r.matrix));mesh.instanceMatrix.needsUpdate=true;mesh.userData.keepSolidInFallback=true;mesh.userData.detailNames=entries.map(r=>r.name);mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
  }
  const metadata={reference:'https://pano.dpm.org.cn/#/panorama?regionId=20&secondAreaId=1&vpId=2&sphPicId=1942945065130049536&hotspotId=2052582318654984192',center:[centerX,0,centerZ],baseY,outerSize:8.50,openingSize:7.90,tiers:5,topY:capY+.10,pearlCount:7,atlas: 'caisson-atlas-v10.png',method:'Square carried curb, seated octagonal corbels, engraved texture and separately suspended bronze pearls'};
  group.userData.referenceCaisson=metadata;
  return {group,metadata,parts,supports,curbs,rings,dragon,roundLip,centralPearl:central,satellites,levels};
}
