import * as THREE from 'three';
import {PALACE_PLAN_SCALE} from './design-v12.js';
import {buildRidgeChiwenV12} from './ridge-chiwen-v12.js';
import { PALACE_FRAME_V10,palaceBayStations } from './palace-frame-v10.js';
import {buildRidgeBeastsV11,RIDGE_BEAST_ORDER_V11,ridgeBeastDimensionsV11} from './roof-beasts-v11.js';
import {upperLocalYV15} from './height-v15.js';

/**
 * Reference-led double-eave hipped roof, in metres, Y up.
 * The lower roof is a genuine annulus: it has no hidden horizontal surface
 * through the upper reading floor. Both timber shells are watertight solids.
 */
export const ROOF_V6 = Object.freeze({
  thickness: .22,
  upper: Object.freeze({ halfWidth: 20.8, halfDepth: 29.4, ridgeHalfLength: 10.8, ridgeY: upperLocalYV15(20.6), gridX: 64, gridZ: 64 }),
  // The continuous upper sill reaches .04 + .34/2 = .21 m outward from
  // the facade datum. Seat the annulus against that real outer face, not
  // against the facade centreline inside the pierced screen leaf.
  lower: Object.freeze({ halfWidth: 25.8, halfDepth: 35.3, innerHalfWidth: PALACE_FRAME_V10.upper.wallX+.21, innerHalfDepth: PALACE_FRAME_V10.upper.wallZ+.21, innerY: 7.25, tileStartClearance:.10, hipStartClearance:.22, edgeSegmentsX: 44, edgeSegmentsZ: 68, radialBands: 6 }),
});
const U=ROOF_V6.upper,L=ROOF_V6.lower,T=ROOF_V6.thickness;
const clamp=THREE.MathUtils.clamp;

function upperProfile(x,z){
  const ax=Math.abs(x)/U.halfWidth,az=Math.abs(z)/U.halfDepth;
  const t=Math.max(ax,Math.max(0,(Math.abs(z)-U.ridgeHalfLength)/(U.halfDepth-U.ridgeHalfLength)));
  // Steep crown, progressively flattened lower slope and restrained flying eave.
  return U.ridgeY-7*t+1.25*t**4+.35*t**10+.85*ax**8*az**8;
}
function lowerProfile(x,z){
  const t=clamp(Math.max((Math.abs(x)-L.innerHalfWidth)/(L.halfWidth-L.innerHalfWidth),
    (Math.abs(z)-L.innerHalfDepth)/(L.halfDepth-L.innerHalfDepth)),0,1);
  const wx=THREE.MathUtils.lerp(L.innerHalfWidth,L.halfWidth,t),dz=THREE.MathUtils.lerp(L.innerHalfDepth,L.halfDepth,t);
  return L.innerY-.62*t+.27*t**5+.08*t**3*(Math.abs(x)/wx)**10*(Math.abs(z)/dz)**10;
}
function baryHeight(x,z,a,b,c){
  const determinant=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  const p=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/determinant;
  const q=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/determinant;
  return p>=-1e-7&&q>=-1e-7&&p+q<=1+1e-7?p*a[1]+q*b[1]+(1-p-q)*c[1]:null;
}

/** Return the height on the actual rendered upper triangulation. */
export function upperRoofSurfaceHeight(x,z){
  if(Math.abs(x)>U.halfWidth+1e-7||Math.abs(z)>U.halfDepth+1e-7)return null;
  const fx=clamp((x+U.halfWidth)/(U.halfWidth*2)*U.gridX,0,U.gridX);
  const fz=clamp((z+U.halfDepth)/(U.halfDepth*2)*U.gridZ,0,U.gridZ);
  const ix=Math.min(U.gridX-1,Math.floor(fx)),iz=Math.min(U.gridZ-1,Math.floor(fz)),u=fx-ix,v=fz-iz;
  const x0=-U.halfWidth+ix*U.halfWidth*2/U.gridX,x1=x0+U.halfWidth*2/U.gridX;
  const z0=-U.halfDepth+iz*U.halfDepth*2/U.gridZ,z1=z0+U.halfDepth*2/U.gridZ;
  return u+v<=1
    ?upperProfile(x0,z0)*(1-u-v)+upperProfile(x1,z0)*u+upperProfile(x0,z1)*v
    :upperProfile(x1,z0)*(1-v)+upperProfile(x0,z1)*(1-u)+upperProfile(x1,z1)*(u+v-1);
}

const perimeterSegments=2*(L.edgeSegmentsX+L.edgeSegmentsZ);
const edges=[{n:L.edgeSegmentsX,start:0},{n:L.edgeSegmentsZ,start:L.edgeSegmentsX},
  {n:L.edgeSegmentsX,start:L.edgeSegmentsX+L.edgeSegmentsZ},{n:L.edgeSegmentsZ,start:2*L.edgeSegmentsX+L.edgeSegmentsZ}];
function perimeterPoint(index,t){
  let i=((index%perimeterSegments)+perimeterSegments)%perimeterSegments;
  const w=THREE.MathUtils.lerp(L.innerHalfWidth,L.halfWidth,t),d=THREE.MathUtils.lerp(L.innerHalfDepth,L.halfDepth,t);
  if(i<L.edgeSegmentsX)return [-w+2*w*i/L.edgeSegmentsX,-d];
  i-=L.edgeSegmentsX;if(i<L.edgeSegmentsZ)return [w,-d+2*d*i/L.edgeSegmentsZ];
  i-=L.edgeSegmentsZ;if(i<L.edgeSegmentsX)return [w-2*w*i/L.edgeSegmentsX,d];
  i-=L.edgeSegmentsX;return [-w,d-2*d*i/L.edgeSegmentsZ];
}
function lowerPoint(index,t){const[x,z]=perimeterPoint(index,t);return[x,lowerProfile(x,z),z];}

/** Return null in the open centre or beyond the actual lower eave. */
export function lowerRoofSurfaceHeight(x,z){
  if(Math.abs(x)>L.halfWidth+1e-7||Math.abs(z)>L.halfDepth+1e-7)return null;
  if(Math.abs(x)<L.innerHalfWidth-1e-7&&Math.abs(z)<L.innerHalfDepth-1e-7)return null;
  const tx=(Math.abs(x)-L.innerHalfWidth)/(L.halfWidth-L.innerHalfWidth);
  const tz=(Math.abs(z)-L.innerHalfDepth)/(L.halfDepth-L.innerHalfDepth),t=clamp(Math.max(tx,tz),0,1);
  const wx=THREE.MathUtils.lerp(L.innerHalfWidth,L.halfWidth,t),dz=THREE.MathUtils.lerp(L.innerHalfDepth,L.halfDepth,t);
  const edge=tx>=tz?(x>=0?1:3):(z>=0?2:0);
  const along=edge===0?(x/wx+1)/2:edge===1?(z/dz+1)/2:edge===2?(1-x/wx)/2:(1-z/dz)/2;
  const spec=edges[edge],i=spec.start+Math.min(spec.n-1,Math.floor(clamp(along,0,1)*spec.n));
  const band=Math.min(L.radialBands-1,Math.floor(t*L.radialBands)),t0=band/L.radialBands,t1=(band+1)/L.radialBands;
  const a=lowerPoint(i,t0),b=lowerPoint(i+1,t0),c=lowerPoint(i,t1),d=lowerPoint(i+1,t1);
  return baryHeight(x,z,a,b,c)??baryHeight(x,z,b,d,c);
}

function finishShell(positions,uvs,topIndices,boundaryEdges,metadata){
  const count=positions.length/3,indices=[...topIndices],topIndexCount=indices.length;
  for(let i=0;i<count;i++){positions.push(positions[i*3],positions[i*3+1]-T,positions[i*3+2]);uvs.push(uvs[i*2],uvs[i*2+1]);}
  for(let i=0;i<topIndices.length;i+=3)indices.push(topIndices[i]+count,topIndices[i+2]+count,topIndices[i+1]+count);
  const undersideIndexCount=indices.length-topIndexCount;
  // Boundary orientation is inherited from the top skin. Every directed top
  // edge receives one opposite side edge, including the inner annulus rim.
  for(const[a,b]of boundaryEdges)indices.push(b,a,a+count,b,a+count,b+count);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  geometry.addGroup(0,topIndexCount,0);geometry.addGroup(topIndexCount,undersideIndexCount,1);
  geometry.addGroup(topIndexCount+undersideIndexCount,indices.length-topIndexCount-undersideIndexCount,2);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={type:'closed-roof-shell',thickness:T,topVertexCount:count,topIndexCount,undersideIndexCount,...metadata};
  return geometry;
}
function upperGeometry(){
  const positions=[],uvs=[],indices=[],boundary=[];
  for(let j=0;j<=U.gridZ;j++)for(let i=0;i<=U.gridX;i++){
    const x=-U.halfWidth+2*U.halfWidth*i/U.gridX,z=-U.halfDepth+2*U.halfDepth*j/U.gridZ;
    positions.push(x,upperProfile(x,z),z);uvs.push((z+U.halfDepth)/.39,(x+U.halfWidth)/.60);
  }
  for(let j=0;j<U.gridZ;j++)for(let i=0;i<U.gridX;i++){
    const a=j*(U.gridX+1)+i,b=a+U.gridX+1;indices.push(a,b,a+1,a+1,b,b+1);
  }
  for(let i=0;i<U.gridX;i++){boundary.push([i+1,i]);const a=U.gridZ*(U.gridX+1)+i;boundary.push([a,a+1]);}
  for(let j=0;j<U.gridZ;j++){const a=j*(U.gridX+1);boundary.push([a,a+U.gridX+1],[a+2*U.gridX+1,a+U.gridX]);}
  return finishShell(positions,uvs,indices,boundary,{tier:'upper',shape:'four-sided-hip',...U});
}
function lowerGeometry(){
  const positions=[],uvs=[],indices=[],boundary=[];
  for(let band=0;band<=L.radialBands;band++)for(let i=0;i<perimeterSegments;i++){
    const p=lowerPoint(i,band/L.radialBands);positions.push(...p);uvs.push(i/1.4,band*1.4);
  }
  for(let band=0;band<L.radialBands;band++)for(let i=0;i<perimeterSegments;i++){
    const next=(i+1)%perimeterSegments,a=band*perimeterSegments+i,b=band*perimeterSegments+next,c=a+perimeterSegments,d=b+perimeterSegments;
    indices.push(a,b,c,b,d,c);
  }
  for(let i=0;i<perimeterSegments;i++){
    const next=(i+1)%perimeterSegments;boundary.push([i,next]);
    boundary.push([L.radialBands*perimeterSegments+next,L.radialBands*perimeterSegments+i]);
  }
  return finishShell(positions,uvs,indices,boundary,{tier:'lower',shape:'open-centre-hipped-annulus',...L,perimeterSegments});
}

function tileTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,128,0);
  gradient.addColorStop(0,'#bd8b2d');gradient.addColorStop(.24,'#d6a43e');gradient.addColorStop(.65,'#e0b14a');gradient.addColorStop(1,'#c29231');
  c.fillStyle=gradient;c.fillRect(0,0,128,128);
  c.fillStyle='rgba(87,53,13,.16)';c.fillRect(0,123,128,5);
  c.fillStyle='rgba(255,225,144,.16)';c.fillRect(0,0,128,3);
  for(let i=0;i<1100;i++){
    c.fillStyle=i%3?'rgba(81,51,20,.045)':'rgba(255,239,184,.07)';c.fillRect((i*71.67)%128,(i*31.31)%128,1,1);
  }
  const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;return map;
}
class Batch{
  constructor(group){this.group=group;this.parts=new Map();this.o=new THREE.Object3D();this.geometry={
    box:new THREE.BoxGeometry(1,1,1),barrel:new THREE.CylinderGeometry(1,1,1,8,1,true),cylinder:new THREE.CylinderGeometry(1,1,1,10),
    sphere:new THREE.SphereGeometry(1,12,8),torus:new THREE.TorusGeometry(1,.17,6,16),cone:new THREE.ConeGeometry(1,1,7),
  };}
  add(geometry,material,p,s=[1,1,1],r=[0,0,0]){
    const g=typeof geometry==='string'?this.geometry[geometry]:geometry,key=g.uuid+'/'+material.uuid;
    if(!this.parts.has(key))this.parts.set(key,{geometry:g,material,matrices:[]});
    this.o.position.set(...p);this.o.scale.set(...s);this.o.rotation.set(...r);this.o.updateMatrix();this.parts.get(key).matrices.push(this.o.matrix.clone());
  }
  box(m,p,s,r){this.add('box',m,p,s,r);}
  rod(m,a,b,r=.07,geometry='barrel'){
    const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(p),length=delta.length();if(length<.001)return;
    const e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    this.add(geometry,m,p.add(q).multiplyScalar(.5).toArray(),[r,length,r],[e.x,e.y,e.z]);
  }
  finish(){let instances=0;for(const{geometry,material,matrices}of this.parts.values()){
    const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((mat,i)=>mesh.setMatrixAt(i,mat));
    mesh.instanceMatrix.needsUpdate=true;mesh.name='Double_Roof_'+material.name;mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();this.group.add(mesh);instances+=matrices.length;
  }return instances;}
}
export function buildDoubleRoofV6({roof,timberMaterial,ridgeBeastAtlasTexture=null,ridgeCeramicTexture=null}={}){
  if(!roof?.isObject3D)throw new TypeError('buildDoubleRoofV6 requires a Three.js roof group');
  const make=(name,color,options={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.50,...options});m.name=name;return m;};
  const m={
    field:make('Golden_Glazed_Pan_Tiles',0xffffff,{map:tileTexture(),metalness:.06,roughness:.48}),
    gold:make('Golden_Glazed_Barrel_Tiles',0xe0ae3f,{metalness:.10,roughness:.42}),
    warm:make('Ochre_Tile_Variation',0xc79735,{metalness:.08,roughness:.49}),
    light:make('Yellow_Ridge_Glaze',0xe9bb55,{metalness:.12,roughness:.43}),
    shadow:make('Glaze_Carving_Shadow',0x8c5c20,{roughness:.69}),
    green:make('Eave_Mineral_Green',0x2f6553,{roughness:.67}),blue:make('Eave_Mineral_Blue',0x284f59,{roughness:.69}),
    gild:make('Eave_Gold_Detail',0xd5b46a,{metalness:.35,roughness:.58}),red:make('Eave_Vermilion_Timber',0x812d23,{roughness:.63}),
    soffit:timberMaterial??make('Solid_Timber_Soffit',0x76573a,{roughness:.85}),
  };
  // A texture-free server build still has the appropriate ochre base colour.
  if(!m.field.map)m.field.color.setHex(0xd7a541);
  const createShell=(name,geometry)=>{
    const mesh=new THREE.Mesh(geometry,[m.field,m.soffit,m.red]);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={...geometry.userData,collision:'solid-shell'};roof.add(mesh);return mesh;
  };
  const upperShell=createShell('Upper_Closed_Hipped_Roof',upperGeometry());
  const lowerShell=createShell('Lower_Closed_Annular_Eave_Roof',lowerGeometry());
  const detailGroup=new THREE.Group();detailGroup.name='Double_Roof_Glazed_Tiles_Ridges_And_Animals';roof.add(detailGroup);
  const b=new Batch(detailGroup),beastPlacements=[],beastBearings=[],rafterAxes=[];
  let tileSegments=0,roofBeasts=0,eaveDiscs=0;
  const tileRun=(points,seed)=>{
    for(let j=0;j<points.length-1;j++){
      const p=points[j],q=points[j+1];b.rod((seed+j)%7===0?m.warm:m.gold,p,q,.073);tileSegments++;
    }
  };
  // Each roof plane has correctly directed barrel rows. They stop at its hip
  // rather than continuing through an adjacent slope with the wrong direction.
  let serial=0;
  for(const sign of[-1,1]){
    for(let z=-U.halfDepth+.12;z<=U.halfDepth-.11;z+=.39){
      const inner=U.halfWidth*Math.max(0,(Math.abs(z)-U.ridgeHalfLength)/(U.halfDepth-U.ridgeHalfLength));
      if(U.halfWidth-inner<.16)continue;
      const points=[],segments=Math.max(1,Math.ceil((U.halfWidth-inner)/2.2));
      for(let j=0;j<=segments;j++){
        const x=sign*THREE.MathUtils.lerp(inner,U.halfWidth-.035,j/segments);points.push([x,upperRoofSurfaceHeight(x,z)+.065,z]);
      }tileRun(points,serial++);
    }
    for(let x=-U.halfWidth+.12;x<=U.halfWidth-.11;x+=.39){
      const inner=U.ridgeHalfLength+(U.halfDepth-U.ridgeHalfLength)*Math.abs(x)/U.halfWidth;
      if(U.halfDepth-inner<.16)continue;
      const points=[],segments=Math.max(1,Math.ceil((U.halfDepth-inner)/2.2));
      for(let j=0;j<=segments;j++){
        const z=sign*THREE.MathUtils.lerp(inner,U.halfDepth-.035,j/segments);points.push([x,upperRoofSurfaceHeight(x,z)+.065,z]);
      }tileRun(points,serial++);
    }
  }
  // Cylindrical crowns extend beyond their centreline endpoints. Keep their
  // complete section outside the sill; a narrow plain pan-tile abutment
  // remains between the screen and the first rounded crown.
  const lowerRadialSpan=Math.min(L.halfWidth-L.innerHalfWidth,L.halfDepth-L.innerHalfDepth);
  const lowerTileStart=L.tileStartClearance/lowerRadialSpan;
  for(let i=0;i<perimeterSegments;i++){
    const points=[];for(let j=0;j<=L.radialBands;j++){
      const p=lowerPoint(i,j===0?lowerTileStart:j/L.radialBands);points.push([p[0],p[1]+.065,p[2]]);
    }tileRun(points,serial++);
    // A second half-pitch row makes the broad lower eave read as densely tiled.
    const half=[];for(let j=0;j<=L.radialBands;j++){
      const t=j===0?lowerTileStart:j/L.radialBands,a=perimeterPoint(i,t),c=perimeterPoint(i+1,t),x=(a[0]+c[0])/2,z=(a[1]+c[1])/2;
      half.push([x,lowerRoofSurfaceHeight(x,z)+.065,z]);
    }tileRun(half,serial++);
  }

  // Rounded drip tiles and two separately modelled cornice layers trace the
  // same curved boundaries as their shells, including all flying corners.
  const edgeDetail=(surface,halfX,halfZ,innerX,innerZ,pitch)=>{
    const sides=[{axis:'x',half:halfZ,at:halfX,inner:innerX},{axis:'z',half:halfX,at:halfZ,inner:innerZ}];
    for(const side of[-1,1])for(const f of sides){
      const n=Math.round(f.half*2/pitch),point=(u,y,v)=>f.axis==='x'?[side*v,y,u]:[u,y,side*v];
      for(let i=0;i<=n;i++){
        const u=-f.half+.055+(f.half*2-.11)*i/n,p=point(u,0,f.at-.025);p[1]=surface(p[0],p[2])+.012;
        const outward=point(u,p[1],f.at+.15);b.rod(m.light,p,outward,.105,'cylinder');eaveDiscs++;
        const cap=point(u,p[1],f.at+.165);b.add('sphere',m.gild,cap,f.axis==='x'?[.015,.045,.045]:[.045,.045,.015]);
      }
      // Fine rafters use subdivisions of the structural column bays. The
      // closer tile rows above remain independent weathering components.
      // Thus column-head brackets, purlins and beam ends share axes without
      // incorrectly requiring one rafter per dougong group.
      const grid=f.axis==='x'?PALACE_FRAME_V10.columns.z:PALACE_FRAME_V10.columns.x;
      const bracketAxes=palaceBayStations([-f.half+.055,...grid,f.half-.055]);
      const fineAxes=palaceBayStations(bracketAxes,PALACE_FRAME_V10.timber.bracketMaxPitch/4);
      for(const u of fineAxes){
        const tail=point(u,0,f.inner),end=point(u,0,f.at-.08);
        const aY=surface(tail[0],tail[2]),bY=surface(end[0],end[2]);
        if(aY!==null&&bY!==null){
          const rafterOffset=halfX===U.halfWidth?.39:.28;tail[1]=aY-rafterOffset;end[1]=bY-rafterOffset;b.rod(m.red,tail,end,.061,'cylinder');
          const face=point(u,bY-rafterOffset,f.at-.05);
          b.box(m.green,face,f.axis==='x'?[.12,.145,.15]:[.15,.145,.12]);
          const bead=point(u,bY-rafterOffset,f.at+.018);b.add('sphere',m.gild,bead,f.axis==='x'?[.017,.038,.038]:[.038,.038,.017]);
          rafterAxes.push({tier:halfX===U.halfWidth?'upper':'lower',faceAxis:f.axis,side,station:u,tail:[...tail],end:[...end],sharedBayGrid:true});
        }
      }
      for(let i=0;i<n;i++){
        const u0=-f.half+i*f.half*2/n,u1=-f.half+(i+1)*f.half*2/n;
        for(const[material,offset,radius]of[[m.green,-.49,.105],[m.gild,-.58,.028],[m.red,-.22,.052]]){
          const a=point(u0,0,f.at),c=point(u1,0,f.at);a[1]=surface(a[0],a[2])+offset;c[1]=surface(c[0],c[2])+offset;b.rod(material,a,c,radius,'cylinder');
        }
      }
    }
  };
  edgeDetail(upperRoofSurfaceHeight,U.halfWidth,U.halfDepth,18.25,26.20,.39);
  edgeDetail(lowerRoofSurfaceHeight,L.halfWidth,L.halfDepth,23.05,32.05,.39);

  // Three stepped components of the straight main ridge; the circular cap
  // sits on real ridge masonry, rather than floating above the roof skin.
  b.box(m.warm,[0,U.ridgeY+.125,0],[.60,.25,U.ridgeHalfLength*2+.30]);
  b.box(m.light,[0,U.ridgeY+.315,0],[.46,.13,U.ridgeHalfLength*2+.28]);
  b.rod(m.light,[0,U.ridgeY+.43,-U.ridgeHalfLength],[0,U.ridgeY+.43,U.ridgeHalfLength],.14,'cylinder');
  for(let z=-U.ridgeHalfLength+.22;z<U.ridgeHalfLength;z+=.47)
    for(const side of[-1,1])b.box(m.shadow,[side*.304,U.ridgeY+.145,z],[.008,.17,.012]);
  const mainRidgeFigures=buildRidgeChiwenV12({parent:detailGroup,ridgeY:U.ridgeY,ridgeHalfLength:U.ridgeHalfLength,roofSurface:upperRoofSurfaceHeight,materials:m,ceramicTexture:ridgeCeramicTexture});
  const hips=(surface,innerX,innerZ,outerX,outerZ,lower=false)=>{
    for(const sx of[-1,1])for(const sz of[-1,1]){
      const at=t=>{const x=sx*THREE.MathUtils.lerp(innerX,outerX,t),z=sz*THREE.MathUtils.lerp(innerZ,outerZ,t);return[x,surface(x,z)+.17,z];};
      const segments=24;
      for(let j=0;j<segments;j++){
        const a=at(lower&&j===0?L.hipStartClearance/lowerRadialSpan:j/segments),c=at((j+1)/segments);b.rod(m.light,a,c,.135,'cylinder');
        const aa=[...a],cc=[...c];aa[1]-=.105;cc[1]-=.105;b.rod(m.warm,aa,cc,.19,'cylinder');
      }
      const yaw=Math.atan2(-sz*(outerZ-innerZ),sx*(outerX-innerX));
      const ordered=['immortal-on-phoenix',...RIDGE_BEAST_ORDER_V11,'hanging-beast'];
      const row=ordered.map(kind=>{
        const scale=kind==='hanging-beast'?(lower?.65:.70):kind==='immortal-on-phoenix'?(lower?.55:.61):(lower?.62:.69),dimensions=ridgeBeastDimensionsV11(kind);
        // Anatomical volume is preserved when the whole building expands.
        // The bearing and placement dimensions therefore use pre-expansion units.
        return{scale,width:(dimensions.width+.02)*scale/PALACE_PLAN_SCALE,depth:(dimensions.depth*1.46+.06)*scale/PALACE_PLAN_SCALE};
      });
      const runLength=Math.hypot(outerX-innerX,outerZ-innerZ),gap=(lower?.16:.20)/PALACE_PLAN_SCALE;
      let distance=runLength*(lower?.945:.957);
      for(const [order,kind] of ordered.entries()){
        // Start at the eave with the rider, then progress uphill through the
        // seven photographed beasts to the much larger hanging beast. Real
        // body widths set the spacing, so its wide base never overlaps the
        // preceding animal even though it is about 1.7 times taller.
        const {scale,width,depth}=row[order];
        if(order)distance-=row[order-1].width/2+width/2+gap;
        const t=distance/runLength,p=at(t);
        const local=[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]],bottom=[];
        for(const[u,v]of local){
          const x=p[0]+Math.cos(yaw)*u+Math.sin(yaw)*v,z=p[2]-Math.sin(yaw)*u+Math.cos(yaw)*v;
          const h=surface(x,z);bottom.push((h??p[1]-.17)+.24);
        }
        const top=Math.max(...bottom)+.075,positions=[];
        for(let k=0;k<4;k++)positions.push(local[k][0],bottom[k]-top,local[k][1]);
        for(const[u,v]of local)positions.push(u,0,v);
        const support=new THREE.BufferGeometry();support.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        support.setIndex([4,7,6,4,6,5,0,1,2,0,2,3,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0]);support.computeVertexNormals();support.computeBoundingBox();support.computeBoundingSphere();
        support.name='Seated_Ceramic_Ridge_Wedge';b.add(support,m.warm,[p[0],top,p[2]],[1,1,1],[0,yaw,0]);
        const corner=`${sx<0?'W':'E'}${sz<0?'N':'S'}`;
        beastPlacements.push({kind,tier:lower?'lower':'upper',corner,order,fraction:t,position:[p[0],top,p[2]],scale,yaw});
        beastBearings.push({tier:lower?'lower':'upper',corner,kind,position:[p[0],top,p[2]],width,depth,topY:top,bottomYs:bottom});roofBeasts++;
      }
    }
  };
  hips(upperRoofSurfaceHeight,0,U.ridgeHalfLength,U.halfWidth,U.halfDepth);
  hips(lowerRoofSurfaceHeight,L.innerHalfWidth,L.innerHalfDepth,L.halfWidth,L.halfDepth,true);
  const instances=b.finish();
  const ridgeFigures=buildRidgeBeastsV11({parent:detailGroup,placements:beastPlacements,materials:m,atlasTexture:ridgeBeastAtlasTexture});
  const maxHeight=U.ridgeY+.125+3.40/(4/3);
  const metadata={version:12,style:'reference-led-double-eave-four-sided-hip',roofCount:2,thickness:T,
    upper:{...upperShell.geometry.userData},lower:{...lowerShell.geometry.userData},
    upperFootprint:[U.halfWidth*2,U.halfDepth*2],lowerFootprint:[L.halfWidth*2,L.halfDepth*2],
    lowerCentreOpening:[L.innerHalfWidth*2,L.innerHalfDepth*2],ridgeDirection:'Z',ridgeLength:U.ridgeHalfLength*2,
    tileSegments,roofBeasts,eaveDiscs,mainRidgeFigures:mainRidgeFigures.metadata,detailInstances:instances,maxHeight,ridgeFigures:ridgeFigures.metadata,beastBearings,rafterAxes,distinctRidgeFigureTypes:ridgeFigures.metadata.distinctForms};
  roof.userData={...roof.userData,doubleRoof:metadata};
  return {upperShell,lowerShell,roofShell:upperShell,shells:[upperShell,lowerShell],metadata,ridgeFigures,mainRidgeFigures,preserveFigureGroups:ridgeFigures.preserveGroups,
    stats:{roofCount:2,roofThickness:T,roofTileSegments:tileSegments,roofBeasts,distinctRidgeFigureTypes:ridgeFigures.metadata.distinctForms,roofEaveDiscs:eaveDiscs,roofDetailInstances:instances,height:maxHeight,maxHeight}};
}
