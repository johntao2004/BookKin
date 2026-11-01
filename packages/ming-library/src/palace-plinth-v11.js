import * as THREE from 'three';
import { PALACE_PLAN_SCALE, V12_COURTYARD_HALF } from './design-v12.js';
import { createJointedPavingV13 } from './paving-v13.js';

/** Three real, successively recessed stone terraces. All values are metres.
 * This subassembly keeps its actual dimensions when the timber hall gets taller.
 * The upper stone ring meets architecture's existing 48.4 × 66.4 m floor.
 */
export const PALACE_PLINTH_V11=Object.freeze({
  courtyardY:-3.6,courtyardHalf:V12_COURTYARD_HALF/PALACE_PLAN_SCALE,stepRise:.15,stepRun:.40,stepsPerFlight:8,
  stairHalfWidth:8.8,
  terraces:Object.freeze([
    Object.freeze({id:'upper',level:3,halfX:36,halfZ:43,y:0,bottomY:-1.2}),
    Object.freeze({id:'middle',level:2,halfX:45,halfZ:52,y:-1.2,bottomY:-2.4}),
    Object.freeze({id:'lower',level:1,halfX:54,halfZ:61,y:-2.4,bottomY:-3.6}),
  ]),
});

const splitAround=(r,h)=>{
  const x0=Math.max(r.minX,h.minX),x1=Math.min(r.maxX,h.maxX),z0=Math.max(r.minZ,h.minZ),z1=Math.min(r.maxZ,h.maxZ);
  if(x1<=x0+1e-8||z1<=z0+1e-8)return[r];
  return[
    {...r,minX:r.minX,maxX:x0}, {...r,minX:x1,maxX:r.maxX},
    {...r,minX:x0,maxX:x1,minZ:r.minZ,maxZ:z0},
    {...r,minX:x0,maxX:x1,minZ:z1,maxZ:r.maxZ},
  ].filter(a=>a.maxX-a.minX>1e-7&&a.maxZ-a.minZ>1e-7);
};

export function buildThreeTierPlinth({parent,wallX,materials}){
  const spec=PALACE_PLINTH_V11,group=new THREE.Group();
  group.name='V13_Open_Three_Tier_Terraces_With_Jointed_Paving';
  group.userData={heightPolicy:'preserve-world',preservePhysicalHeight:true,structuralSystem:'three-stepped-stone-terraces'};
  parent.add(group);
  const m={...materials},partMap=new Map(),o=new THREE.Object3D();
  m.pavingBed=new THREE.MeshStandardMaterial({color:0x747b78,roughness:.98});m.pavingBed.name='V13_Terrace_Stone_Joint_Bed';
  const g={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,12,8),
    torus:new THREE.TorusGeometry(1,.13,6,20),
    baluster:new THREE.LatheGeometry([[.105,0],[.11,.04],[.065,.09],[.055,.18],[.08,.22],[.09,.28],[.065,.35],[.08,.42]].map(p=>new THREE.Vector2(...p)),12),
    cap:new THREE.LatheGeometry([[.15,0],[.17,.04],[.15,.08],[.13,.11],[.08,.17],[.05,.20],[0,.22]].map(p=>new THREE.Vector2(...p)),16),
  };
  const components=[],edgeCollision=[],surfaces=[],exteriorSteps=[],stairRuns=[],stoneRails=[],postRegistry=new Set();
  const add=(kind,geometry,mat,x,y,z,sx,sy,sz,rotation=[0,0,0])=>{
    // Entrance local U=-world Z, N=world X-wallX.
    const key=geometry.uuid+'/'+mat.uuid;
    if(!partMap.has(key))partMap.set(key,{geometry,material:mat,matrices:[]});
    o.position.set(-z,y,x-wallX);o.scale.set(sz,sy,sx);o.rotation.set(...rotation);o.updateMatrix();
    const list=partMap.get(key).matrices,index=list.length;list.push(o.matrix.clone());
    const record={id:`plinth-${kind}-${components.length}`,kind,meshName:'V11_Stone_'+geometry.type+'_'+mat.name,instanceIndex:index,
      bounds:{minX:x-sx/2,maxX:x+sx/2,minY:y-sy/2,maxY:y+sy/2,minZ:z-sz/2,maxZ:z+sz/2}};
    components.push(record);return record;
  };
  const box=(kind,mat,x,y,z,sx,sy,sz)=>add(kind,g.box,mat,x,y,z,sx,sy,sz);
  const ring=(outer,inner)=>splitAround(outer,inner);
  const slab=(r,y0,y1,kind='terrace-body',mat=m.stone)=>box(kind,mat,(r.minX+r.maxX)/2,(y0+y1)/2,(r.minZ+r.maxZ)/2,r.maxX-r.minX,y1-y0,r.maxZ-r.minZ);
  const rectangle=t=>({id:`stone-terrace-${t.id}`,minX:-t.halfX,maxX:t.halfX,minZ:-t.halfZ,maxZ:t.halfZ,y:t.y,level:t.level,type:'stoneTerrace'});
  const oldFloor={minX:-24.2,maxX:24.2,minZ:-33.2,maxZ:33.2};

  for(const [i,t] of spec.terraces.entries()){
    const r=rectangle(t);
    if(i===0){
      slab(r,t.bottomY,-.34);
      for(const piece of ring(r,oldFloor))slab(piece,-.34,-.008,'upper-terrace-paving',m.pavingBed);
    }else{
      slab(r,t.bottomY,t.y-.025);
      slab(r,t.y-.025,t.y-.008,'terrace-paving-joint-bed',m.pavingBed);
    }
    // The dressed base, recessed waist, and upper cornice are individual
    // projecting stones seated on the same body, with no duplicate top skin.
    for(const axis of['x','z'])for(const side of[-1,1]){
      const half=axis==='x'?t.halfZ:t.halfX,at=axis==='x'?t.halfX:t.halfZ;
      for(const [offset,height,depth,mat] of [[-.09,.18,.08,m.stoneLight],[-.37,.08,.035,m.stoneEdge],[-1.10,.20,.10,m.stoneLight]]){
        const normal=side*(at+depth/2),yy=t.y+offset;
        box('terrace-dressed-course',mat,axis==='x'?normal:0,yy,axis==='z'?normal:0,axis==='x'?depth:half*2,height,axis==='z'?depth:half*2);
      }
      const count=Math.ceil(half*2/2.8),pitch=half*2/count;
      for(let k=0;k<count;k++){
        const u=-half+(k+.5)*pitch,normal=side*(at+.009);
        box('stone-course-joint',m.stoneEdge,axis==='x'?normal:u,t.y-.69,axis==='z'?normal:u,axis==='x'?.018:.014,.55,axis==='z'?.018:.014);
        // Shallow shaped relief at the waist, not a separately floating slab.
        if(k%2===0){
          const a=axis==='x'?normal:u,z=axis==='z'?normal:u;
          add('stone-waist-medallion',g.torus,m.stoneLight,a,t.y-.69,z,.03,.23,.23,axis==='z'?[0,Math.PI/2,0]:[0,0,0]);
        }
      }
    }
    const inner=i===0?oldFloor:rectangle(spec.terraces[i-1]);
    let pieces=ring(r,inner);
    if(i>0){
      const prior=spec.terraces[i-1];
      pieces=pieces.flatMap(p=>splitAround(p,{minX:prior.halfX,maxX:prior.halfX+spec.stepsPerFlight*spec.stepRun,minZ:-spec.stairHalfWidth,maxZ:spec.stairHalfWidth}));
    }
    pieces.forEach((p,j)=>surfaces.push({...p,id:`${r.id}-surface-${j}`,meshBacked:true}));
    const paving=createJointedPavingV13({rects:pieces,pitchX:1.05,pitchZ:.80,joint:.018,stagger:true,
      colors:[0x858d89,0x8d948e,0x959a92,0x8b918a,0x9ba097],name:`V13_${t.id}_Terrace_Grey_Stone_Pavers`,mapPoint:(x,y,z)=>[-z,y,x-wallX]});
    group.add(paving);
  }

  // All stair flights descend towards +X, aligned to the long-elevation gate.
  // Each flight has eight 150 mm rises. The horizontal setting-out turns
  // 400 mm local goings into 480 mm actual goings, with a 6.96 m landing
  // between successive stair flights. The two metre-scale rail cheeks remain
  // outside the 17.6 m clear stair width.
  for(const [j,t] of spec.terraces.entries()){
    const startX=t.halfX,bottomY=t.y-1.2,endX=startX+3.2;
    const run={id:`stone-stair-flight-${j+1}`,axis:'x',minX:startX,maxX:endX,minZ:-spec.stairHalfWidth,maxZ:spec.stairHalfWidth,
      topX:startX,bottomX:endX,topY:t.y,bottomY,steps:8,riser:.15,tread:.40,clearWidth:17.6,type:'exteriorStoneStair'};
    stairRuns.push(run);
    for(let i=0;i<8;i++){
      const x0=startX+i*.40,x1=x0+.40,y=t.y-(i+1)*.15;
      if(y>bottomY+1e-7)box('stone-stair-solid',m.stoneLight,(x0+x1)/2,(y+bottomY)/2,0,.40,y-bottomY,spec.stairHalfWidth*2);
      else box('stone-stair-flush-foot',m.stoneLight,(x0+x1)/2,bottomY-.0075,0,.40,.015,spec.stairHalfWidth*2);
      // Last tread is flush on the lower terrace/courtyard, not a zero-thick
      // duplicate mesh. Every entry still has a real support surface.
      exteriorSteps.push({id:`stone-stair-${j+1}-tread-${i+1}`,flightId:run.id,minX:x0,maxX:x1,minZ:-spec.stairHalfWidth,maxZ:spec.stairHalfWidth,y,meshBacked:true});
      if(i<7)box('stone-tread-nosing',m.stoneEdge,x1-.012,y-.025,0,.024,.05,spec.stairHalfWidth*2-.02);
    }
  }

  const rail=(id,a,b,baseA,baseB,segments)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),count=segments??Math.max(1,Math.ceil(length/2.3));
    const alongX=Math.abs(dx)>Math.abs(dz),normalAxis=alongX?'z':'x',railRecords=[];
    const point=t=>[a[0]+dx*t,THREE.MathUtils.lerp(baseA,baseB,t),a[1]+dz*t];
    for(let i=0;i<=count;i++){
      const [x,y,z]=point(i/count);
      const key=[x,y,z].map(v=>v.toFixed(5)).join('/');
      if(!postRegistry.has(key)){
        postRegistry.add(key);box('stone-rail-post',m.stoneLight,x,y+.49,z,.22,.82,.22);
        box('stone-rail-base',m.stone,x,y+.08,z,.34,.16,.34);
        add('stone-lotus-post-cap',g.cap,m.stoneLight,x,y+.90,z,1,1,1);
      }
    }
    for(let i=0;i<count;i++){
      const p=point(i/count),q=point((i+1)/count),span=length/count-.22,midX=(p[0]+q[0])/2,midZ=(p[2]+q[2])/2,midY=(p[1]+q[1])/2;
      // Sloped flights use true sloped rails whose ends touch the posts.
      const slope=Math.atan2(q[1]-p[1],length/count),rot=alongX?[-slope,0,0]:[0,0,-slope],inclinedSpan=span/Math.cos(slope);
      for(const[h,thickness]of[[.28,.10],[.82,.13]]){
        const ref=add('stone-rail-rail',g.box,m.stoneLight,midX,midY+h,midZ,alongX?inclinedSpan:.12,thickness,alongX?.12:inclinedSpan,rot);railRecords.push(ref.id);
      }
      const n=Math.max(2,Math.round(span/.36));
      for(let k=1;k<=n;k++){
        const fraction=(i+(k/(n+1)))/count,[x,y,z]=point(fraction);
        add('stone-pierced-baluster',g.baluster,m.stoneLight,x,y+.33,z,1,1,1);
      }
    }
    const thickness=.35,record={id,type:'stoneBalustrade',minX:Math.min(a[0],b[0])-(normalAxis==='x'?thickness/2:.16),maxX:Math.max(a[0],b[0])+(normalAxis==='x'?thickness/2:.16),
      minZ:Math.min(a[1],b[1])-(normalAxis==='z'?thickness/2:.16),maxZ:Math.max(a[1],b[1])+(normalAxis==='z'?thickness/2:.16),
      minY:Math.min(baseA,baseB),maxY:Math.max(baseA,baseB)+1.12};
    edgeCollision.push(record);stoneRails.push({id,a,b,baseA,baseB,count,railRecords});
  };

  for(const t of spec.terraces){
    const x=t.halfX-.18,z=t.halfZ-.18,opening=spec.stairHalfWidth+.24;
    rail(`${t.id}-west-rail`,[-x,-z],[-x,z],t.y,t.y);
    rail(`${t.id}-north-rail`,[-x,-z],[x,-z],t.y,t.y);
    rail(`${t.id}-south-rail`,[-x,z],[x,z],t.y,t.y);
    rail(`${t.id}-entry-left-rail`,[x,-z],[x,-opening],t.y,t.y);
    rail(`${t.id}-entry-right-rail`,[x,opening],[x,z],t.y,t.y);
    for(const side of[-1,1])rail(`${t.id}-stair-side-${side}`,[t.halfX-.18,side*opening],[t.halfX+3.2,side*opening],t.y,t.y-1.2,2);
  }
  // The landings and adjacent ring terraces are the SAME horizontal surface.
  // There is no drop along their shared boundary, therefore no return fence.
  // Stair cheeks and the outside terrace perimeter above remain guarded.
  const lateralOpenings=spec.terraces.slice(0,-1).flatMap((t,i)=>[-1,1].map(side=>({
    id:`${t.id}-open-lateral-passage-${side}`,side,minX:t.halfX+3.2+.20,maxX:spec.terraces[i+1].halfX-.44,
    minZ:side<0?-spec.stairHalfWidth-2.8:spec.stairHalfWidth-1.0,
    maxZ:side<0?-spec.stairHalfWidth+1.0:spec.stairHalfWidth+2.8,y:t.y-1.2,meshBacked:true,type:'openTerracePassage',
  })));

  const lower=spec.terraces.at(-1),outer={minX:-spec.courtyardHalf,maxX:spec.courtyardHalf,minZ:-spec.courtyardHalf,maxZ:spec.courtyardHalf,y:spec.courtyardY,type:'courtyard'};
  const courtyardSurfaces=ring(outer,rectangle(lower)).flatMap(r=>splitAround(r,{minX:lower.halfX,maxX:lower.halfX+3.2,minZ:-spec.stairHalfWidth,maxZ:spec.stairHalfWidth})).map((r,i)=>({...r,id:`courtyard-surface-${i}`,meshBacked:true}));
  let instanceCount=0;
  for(const {geometry,material,matrices} of partMap.values()){
    const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;
    mesh.name='V11_Stone_'+geometry.type+'_'+material.name;mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={keepSolidInFallback:geometry===g.box,stoneTerrace:true,preservePhysicalHeight:true};mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);instanceCount+=matrices.length;
  }
  const metadata={version:13,tierCount:3,datumY:0,courtyardY:spec.courtyardY,totalHeight:3.6,terraces:spec.terraces.map(t=>({...t})),
    stairFlights:3,stepsPerFlight:8,stepRise:.15,stepRun:.40,landingDepth:5.8,stairClearWidth:17.6,doorForecourt:{depth:spec.terraces[0].halfX-wallX,minX:wallX,maxX:spec.terraces[0].halfX},sideApron:{depth:spec.terraces[0].halfZ-30.85},
    landingRects:spec.terraces.slice(0,-1).map((t,i)=>({id:`broad-landing-${i+1}`,minX:t.halfX+3.2,maxX:spec.terraces[i+1].halfX,minZ:-spec.stairHalfWidth,maxZ:spec.stairHalfWidth,y:t.y-1.2})),
    oldFloorOpening:oldFloor,surfaces,stairRuns,steps:exteriorSteps,edgeCollision,stoneRails,components,instanceCount,lateralOpenings,
    paving:{actualJoints:true,localPitch:[1.05,.80],joint:.018,stagger:true,bedDepth:.008}};
  group.userData.plinth=metadata;
  return{group,metadata,surfaces,courtyardSurfaces,exteriorSteps,stairRuns,edgeCollision,components,instanceCount};
}
