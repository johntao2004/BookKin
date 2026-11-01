import * as THREE from 'three';
import {V12_COLUMN_COLOR,V12_STONE_COLOR,V12_COURTYARD_HALF,V12_COMPOUND_WALL_HALF} from './design-v12.js';
import {createJointedPavingV13} from './paving-v13.js';
import {buildCourtyardCypressV13} from './cypress-v13.js';

/** Final world coordinates: this enclosing courtyard is intentionally not
 * multiplied by the enlarged palace plan. Its outside silhouette stays within
 * the existing 180 m navigation square; the main hall remains the only palace. */
export function buildPalaceCourtyardV12(){
  const group=new THREE.Group();group.name='V13_Jointed_Grey_Paving_And_Red_Wall_Palace_Court';
  const half=V12_COMPOUND_WALL_HALF,groundY=-3.6,wallHeight=5.4,gateHalf=8.4;
  const obstacles=[],parts=[],batches=new Map(),object=new THREE.Object3D();
  const make=(name,color,roughness=.82)=>{const m=new THREE.MeshStandardMaterial({color,roughness});m.name=name;return m;};
  const m={red:make('V12_Courtyard_Limewashed_Vermilion',V12_COLUMN_COLOR,.94),stone:make('V12_Courtyard_Warm_Pale_Stone',V12_STONE_COLOR,.94),
    base:make('V12_Weathered_Grey_Foundation',0x7c7b70,.98),tile:make('V12_Enclosing_Wall_Ochre_Glazed_Tile',0xc69a43,.55),
    dark:make('V12_Courtyard_Joined_Red_Timber',0x6c2821,.67),gold:make('V12_Courtyard_Muted_Gilt',0xbba05b,.53),
    joint:make('V13_Charcoal_Grey_Paving_Joints',0x515d5d,.99),drain:make('V13_Recessed_Dark_Drainage_Channel',0x454e4d,.98),soil:make('V13_Cypress_Earth',0x534f3f,1)};
  const box=new THREE.BoxGeometry(1,1,1),cyl=new THREE.CylinderGeometry(1,1,1,12);
  const add=(geometry,material,p,s=[1,1,1],rotation=[0,0,0])=>{
    const key=geometry.uuid+'/'+material.uuid;if(!batches.has(key))batches.set(key,{geometry,material,matrices:[]});
    object.position.set(...p);object.scale.set(...s);object.rotation.set(...rotation);object.updateMatrix();batches.get(key).matrices.push(object.matrix.clone());
  };
  const block=(material,x,y,z,sx,sy,sz)=>add(box,material,[x,y,z],[sx,sy,sz]);
  const collider=(id,x,z,w,d,y0,y1,type='courtyardWall')=>{
    const bounds={id,type,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:y0,maxY:y1};obstacles.push(bounds);return bounds;
  };
  block(m.joint,0,groundY-.104,0,V12_COURTYARD_HALF*2,.192,V12_COURTYARD_HALF*2);
  const treePositions=[[-76,-43],[-76,43],[76,-43],[76,43]],treeHalf=1.9;
  const treeHoles=treePositions.map(([x,z])=>({minX:x-treeHalf,maxX:x+treeHalf,minZ:z-treeHalf,maxZ:z+treeHalf}));
  // Courtyard brick field (海墁), a central dressed-stone route (甬路), and
  // narrow border courses (牙子) have visibly different setting-out.
  const axisRoute={minX:68.64,maxX:89.2,minZ:-10.8,maxZ:10.8,y:groundY};
  const courtPavers=createJointedPavingV13({rects:[{minX:-90,maxX:90,minZ:-90,maxZ:90,y:groundY}],exclude:[{minX:-64.8,maxX:64.8,minZ:-73.2,maxZ:73.2},{minX:64.8,maxX:68.64,minZ:-10.56,maxZ:10.56},axisRoute,...treeHoles],pitchX:.90,pitchZ:.60,joint:.014,stagger:true,colors:[0x7c8582,0x87908b,0x747f7d,0x91968e,0x818986],name:'V13_Courtyard_Staggered_Grey_Brick_Field'});group.add(courtPavers);
  const pathPavers=createJointedPavingV13({rects:[axisRoute],pitchX:1.35,pitchZ:1.08,joint:.018,colors:[0xa0a59c,0x979f98,0xa9ada3,0x9da49b],name:'V13_Axial_Dressed_Stone_Yonglu'});group.add(pathPavers);
  for(const z of[-10.94,10.94])block(m.base,78.92,groundY-.02,z,20.56,.04,.24);
  // Drainage edges sit alongside the lower terrace, outside the circulation
  // surface; their narrow stone covers remain flush with the paving.
  for(const s of[-1,1]){
    block(m.drain,s*65.55,groundY-.015,0,.42,.03,147.8);
    block(m.drain,0,groundY-.015,s*74.02,131.5,.03,.42);
    for(let k=-72;k<=72;k+=1.6)block(m.base,s*65.55,groundY-.008,k,.44,.016,.11);
    for(let k=-64;k<=64;k+=1.6)block(m.base,k,groundY-.008,s*74.02,.11,.016,.44);
  }

  const capProfile=new THREE.Shape();capProfile.moveTo(-1.22,0);capProfile.lineTo(1.22,0);
  capProfile.bezierCurveTo(.95,.17,.55,.40,0,.51);capProfile.bezierCurveTo(-.55,.40,-.95,.17,-1.22,0);capProfile.closePath();
  const capCache=new Map();
  const wall=(id,axis,at,start,end)=>{
    const length=end-start,mid=(start+end)/2,x=axis==='x'?at:mid,z=axis==='x'?mid:at;
    const w=axis==='x'?1.20:length,d=axis==='x'?length:1.20;
    block(m.base,x,groundY+.28,z,w+.18,.56,d+.18);
    block(m.red,x,groundY+.56+(wallHeight-.56)/2,z,w,wallHeight-.56,d);
    block(m.stone,x,groundY+wallHeight-.035,z,axis==='x'?1.34:length,.13,axis==='x'?length:1.34);
    const key=length.toFixed(4);if(!capCache.has(key))capCache.set(key,new THREE.ExtrudeGeometry(capProfile,{depth:length,bevelEnabled:false,curveSegments:8}).translate(0,0,-length/2));
    add(capCache.get(key),m.tile,[x,groundY+wallHeight+.03,z],[1,1,1],axis==='x'?[0,0,0]:[0,Math.PI/2,0]);
    // Real barrel rows trace both sides of the wall cap.
    const n=Math.max(1,Math.ceil(length/.65));for(let i=0;i<=n;i++){
      const u=start+i*length/n;
      for(const side of[-1,1]){
        const p=axis==='x'?[at+side*.56,groundY+wallHeight+.30,u]:[u,groundY+wallHeight+.30,at+side*.56];
        add(cyl,m.tile,p,[.055,1.23,.055],axis==='x'?[0,0,side*.41*Math.PI]:[side*.41*Math.PI,0,0]);
      }
    }
    // Narrow courses make the wall foot read as masonry rather than a plain
    // red panel planted directly onto the court. The red plaster stays calm.
    const facing=axis==='x'?Math.sign(at)*-1:Math.sign(at)*-1;
    const nStone=Math.max(1,Math.ceil(length/1.8));
    for(let j=0;j<nStone;j++){
      const u=start+(j+.5)*length/nStone;
      block(m.joint,axis==='x'?at+facing*.693:u,groundY+.29,axis==='x'?u:at+facing*.693,axis==='x'?.016:.018,.42,axis==='x'?.018:.016);
    }
    for(const offset of[.08,.53])block(m.base,x,groundY+offset,z,axis==='x'?1.47:length,.07,axis==='x'?length:1.47);
    parts.push({...collider(id,x,z,w,d,groundY,groundY+wallHeight+.54),axis,length});
  };
  wall('courtyard-wall-west','x',-half,-half-.6,half+.6);
  wall('courtyard-wall-north','z',-half,-half+.6,half-.6);
  wall('courtyard-wall-south','z',half,-half+.6,half-.6);
  wall('courtyard-wall-east-left','x',half,-half-.6,-gateHalf);
  wall('courtyard-wall-east-right','x',half,gateHalf,half+.6);

  // A subordinate single-roof wall gate, entirely open on the visitor axis.
  // Its two jambs carry a deep lintel; there is no floating roof or third hall.
  for(const s of[-1,1]){
    block(m.stone,half,groundY+.20,s*gateHalf,1.64,.40,1.34);
    block(m.red,half,groundY+3.35,s*gateHalf,1.35,6.30,1.08);
    block(m.dark,half,groundY+6.46,s*gateHalf,1.64,.28,1.28);
    collider('courtyard-gate-jamb-'+s,half,s*gateHalf,1.64,1.34,groundY,groundY+6.60,'courtyardGateJamb');
  }
  block(m.dark,half,groundY+6.57,0,1.60,.48,gateHalf*2+1.28);
  block(m.red,half,groundY+6.92,0,1.74,.22,gateHalf*2+1.50);
  for(const s of[-1,1])block(m.gold,half+s*.883,groundY+6.58,0,.026,.045,gateHalf*2+.85);
  collider('courtyard-gate-lintel',half,0,1.74,gateHalf*2+1.50,groundY+6.33,groundY+7.06,'courtyardGateLintel');
  const gateRoofShape=new THREE.Shape();gateRoofShape.moveTo(-2.65,0);gateRoofShape.lineTo(2.65,0);
  gateRoofShape.bezierCurveTo(1.78,.11,.82,1.17,0,1.27);gateRoofShape.bezierCurveTo(-.82,1.17,-1.78,.11,-2.65,0);gateRoofShape.closePath();
  const gateRoof=new THREE.ExtrudeGeometry(gateRoofShape,{depth:19.7,bevelEnabled:false,curveSegments:14}).translate(0,0,-9.85);
  add(gateRoof,m.tile,[half,groundY+7.06,0]);
  for(let z=-9.7;z<=9.71;z+=.40)for(const s of[-1,1]){
    for(let j=0;j<3;j++){
      const x0=s*j*.85,x1=s*(j+1)*.85;
      const roofY=x=>{let lo=0,hi=1;for(let k=0;k<24;k++){const t=(lo+hi)/2,q=1-t,xx=q*q*q*2.65+3*q*q*t*1.78+3*q*t*t*.82;if(xx>Math.abs(x))lo=t;else hi=t;}const t=(lo+hi)/2,q=1-t;return groundY+7.06+3*q*q*t*.11+3*q*t*t*1.17+t*t*t*1.27;};
      const a=new THREE.Vector3(half+x0,roofY(x0)+.04,z),b=new THREE.Vector3(half+x1,roofY(x1)+.04,z),v=b.clone().sub(a);
      const o=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()),e=new THREE.Euler().setFromQuaternion(o);
      add(cyl,m.tile,a.add(b).multiplyScalar(.5).toArray(),[.055,v.length(),.055],[e.x,e.y,e.z]);
    }
  }
  // Near the front boundary the gate eave must remain inside the 90 m limit.
  // Its x maximum is 88.65 m, leaving 1.35 m to the navigation edge.
  parts.push({id:'courtyard-gate-roof',type:'gateRoof',minX:half-2.65,maxX:half+2.65,minZ:-9.85,maxZ:9.85,minY:groundY+7.06,maxY:groundY+8.33});

  const treeRecords=[];
  for(const [index,[x,z]]of treePositions.entries()){
    block(m.soil,x,groundY-.015,z,treeHalf*2,.03,treeHalf*2);
    for(const s of[-1,1]){block(m.base,x+s*treeHalf,groundY+.065,z,.16,.13,treeHalf*2+.16);block(m.base,x,groundY+.065,z+s*treeHalf,treeHalf*2-.16,.13,.16);}
    const tree=buildCourtyardCypressV13({index,x,z,groundY,scale:index%2?.95:1.04});group.add(tree);
    treeRecords.push({...collider('courtyard-cypress-'+index,x,z,treeHalf*2+.16,treeHalf*2+.16,groundY,groundY+.13,'courtyardTreeBed'),branchCount:tree.userData.branchCount,frondCount:tree.userData.frondCount});
    collider('courtyard-cypress-trunk-'+index,x,z,.72,.72,groundY+.13,groundY+4.4,'courtyardTreeTrunk');
  }

  let instances=0;
  for(const {geometry,material,matrices}of batches.values()){
    const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.name='V12_Courtyard_'+material.name+'_'+geometry.type;mesh.castShadow=mesh.receiveShadow=true;
    mesh.userData={keepSolidInFallback:geometry===box,courtyard:true,collision:'box'};
    mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);instances+=matrices.length;
  }
  const metadata={version:13,coordinateSpace:'final-world-metres',enclosingWallHalf:half,siteHalf:V12_COURTYARD_HALF,
    wallHeight,groundY,treeCount:treePositions.length,gateClearWidth:gateHalf*2-1.08,gateClearHeight:6.33,
    gateOpen:true,maxEnclosingX:half+2.65,maxEnclosingZ:half+1.22,parts,trees:treeRecords,instances,
    paving:{actualJoints:true,brickCount:courtPavers.userData.tileCount,routeStoneCount:pathPavers.userData.tileCount,brickPitch:[.90,.60],joint:.014,stagger:true,axisRoute},
    design:'A bounded red-wall court centred on the hall, with staggered grey brick, a dressed axial route, drainage margins and four naturally branched cypresses'};
  group.userData={...metadata};return{group,obstacles,materials:m,metadata};
}
