import * as THREE from 'three';
import { PALACE_FRAME_V10 } from './palace-frame-v10.js';
import { buildThreeTierPlinth } from './palace-plinth-v11.js';
import { buildExteriorPlaqueV11 } from './palace-plaque-v11.js';
import { upperLocalYV15 } from './height-v15.js';

/**
 * Guanwen IX — two mirrored palace screen leaves on the long elevation.
 * The public factory name is retained for integrations. World units are metres,
 * Y is up; the entrance faces +X at the centre of the 62 m long elevation.
 * The entrance is modelled in a local joinery frame: U is the gate width, N is
 * the outward normal. Rotation maps U to -Z and N to +X without fake doorways.
 */
const WALL_X=PALACE_FRAME_V10.lower.wallX;
const PIVOT_N=.47;
const PIVOT_U=2.28;
const LEAF_WIDTH=2.27;
const LEAF_HEIGHT=5.10;
const LEAF_THICKNESS=.18;
const OPEN_ANGLE=Math.PI/2;
const CLEAR_WIDTH=4.60;
const CLEAR_HEIGHT=5.17;

// One lacquer specification is shared by the working leaf, the fixed facade
// screens and their wood lattice. Colour differences now come from real depth
// and lighting, not alternating red, black and brown door materials.
export const PALACE_DOOR_LACQUER=0x762c27;
export function createPalaceDoorLacquer(){
  const material=new THREE.MeshStandardMaterial({color:PALACE_DOOR_LACQUER,roughness:.43,metalness:0});
  material.name='Palace_Unified_Dark_Red_Lacquer';
  material.userData={role:'palace-door-woodwork',lacquerHex:'#762c27'};
  return material;
}

/** A real, pierced octagonal lattice with closed timber edges and no bitmap. */
export function palaceLatticeGeometry(width,height,{pitch=.225,depth=.046,border=.025,bar=.017}={}){
  const shape=new THREE.Shape();
  shape.moveTo(-width/2,-height/2);shape.lineTo(width/2,-height/2);shape.lineTo(width/2,height/2);shape.lineTo(-width/2,height/2);shape.closePath();
  const nx=Math.max(1,Math.ceil((width-border*2)/pitch)),ny=Math.max(1,Math.ceil((height-border*2)/pitch));
  const dx=(width-border*2)/nx,dy=(height-border*2)/ny;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const cx=-width/2+border+(i+.5)*dx,cy=-height/2+border+(j+.5)*dy,rx=(dx-bar)/2,ry=(dy-bar)/2,cut=Math.min(rx,ry)*.46;
    // Clockwise holes leave a connected timber web around every eight-sided
    // light. The shortened corners form the small diamond nodes of the grid.
    const pts=[[-rx+cut,-ry],[-rx,-ry+cut],[-rx,ry-cut],[-rx+cut,ry],[rx-cut,ry],[rx,ry-cut],[rx,-ry+cut],[rx-cut,-ry]];
    const hole=new THREE.Path();pts.forEach(([x,y],k)=>k?hole.lineTo(cx+x,cy+y):hole.moveTo(cx+x,cy+y));hole.closePath();shape.holes.push(hole);
  }
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});geometry.translate(0,0,-depth/2);
  geometry.userData={design:'pierced-octagonal-connected-lattice',openingCount:nx*ny,columns:nx,rows:ny,pitchX:dx,pitchY:dy,barWidth:bar,depth};
  return geometry;
}

/** Raised gilt moulding, cut as a continuous chamfered frame. */
export function palaceCartoucheGeometry(width,height,band=.012,depth=.018){
  const contour=(w,h)=>{const x=w/2,y=h/2,c=Math.min(w,h)*.17;return [[-x+c,-y],[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]];};
  const outer=contour(width,height),inner=contour(width-band*2,height-band*2).reverse(),s=new THREE.Shape();
  outer.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const hole=new THREE.Path();inner.forEach(([x,y],i)=>i?hole.lineTo(x,y):hole.moveTo(x,y));hole.closePath();s.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:1,curveSegments:1});geometry.translate(0,0,-depth/2);return geometry;
}

export function palaceRosetteGeometry(radius=.19,band=.010,depth=.014){
  const s=new THREE.Shape(),hole=new THREE.Path(),points=64;
  const contour=(target,offset,reverse)=>{for(let i=0;i<=points;i++){const a=(reverse?-1:1)*i/points*Math.PI*2,r=radius*(1+.11*Math.cos(8*a))-offset,x=Math.cos(a)*r,y=Math.sin(a)*r;i?target.lineTo(x,y):target.moveTo(x,y);}target.closePath();};
  contour(s,0,false);contour(hole,band,true);s.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,steps:1,curveSegments:1});geometry.translate(0,0,-depth/2);return geometry;
}

function canvasTexture(width,height,paint){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  paint(canvas.getContext('2d'),width,height);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  return texture;
}
function pavingTexture(width,depth){
  const texture=canvasTexture(512,512,(c,w,h)=>{
    c.fillStyle='#c4b9a3';c.fillRect(0,0,w,h);
    for(let j=0;j<2;j++)for(let i=0;i<2;i++){
      const shade=202+((i*7+j*11)%13);c.fillStyle=`rgb(${shade},${shade-7},${shade-22})`;
      c.fillRect(i*256+2,j*256+2,252,252);
      c.strokeStyle='rgba(255,248,224,.35)';c.lineWidth=1;c.strokeRect(i*256+3,j*256+3,250,250);
    }
    for(let i=0;i<3200;i++){
      c.fillStyle=i%3?'rgba(70,62,49,.025)':'rgba(255,249,230,.09)';
      c.fillRect((i*71.31)%w,(i*137.17)%h,1.5,1.2);
    }
  });
  if(texture){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(width/3.4,depth/3.4);}
  return texture;
}
function signTexture(){
  const map=canvasTexture(1024,2304,(c,w,h)=>{
    c.fillStyle='#12294f';c.fillRect(0,0,w,h);
    const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(46,72,122,.22)');g.addColorStop(1,'rgba(0,10,31,.18)');
    c.fillStyle=g;c.fillRect(0,0,w,h);
    c.strokeStyle='#e5b746';c.lineWidth=16;c.strokeRect(37,37,w-74,h-74);
    c.lineWidth=5;c.strokeRect(66,66,w-132,h-132);
    c.fillStyle='#f4cb5d';c.textAlign='center';c.textBaseline='middle';
    c.font='600 608px MingSerif, BookCJK, "Noto Serif TC", "Songti TC", "Songti SC", serif';
    [...'文華殿'].forEach((ch,i)=>c.fillText(ch,w/2,430+i*722));
  });
  if(map){map.name='ArchitecturalDetail_Wenhuadian_Traditional_Plaque_1024x2304';map.anisotropy=16;map.magFilter=THREE.LinearFilter;}
  return map;
}
class Batch{
  constructor(group,geometry){this.group=group;this.geometry=geometry;this.parts=new Map();this.object=new THREE.Object3D();}
  add(shape,material,position,scale=[1,1,1],rotation=[0,0,0]){
    const geometry=this.geometry[shape],key=geometry.uuid+'/'+material.uuid;
    if(!this.parts.has(key))this.parts.set(key,{geometry,material,matrices:[]});
    this.object.position.set(...position);this.object.scale.set(...scale);this.object.rotation.set(...rotation);this.object.updateMatrix();
    this.parts.get(key).matrices.push(this.object.matrix.clone());
  }
  box(material,x,y,z,w,h,d){this.add('box',material,[x,y,z],[w,h,d]);}
  line(material,a,b,width=.035,depth=.05){
    const dx=b[0]-a[0],dy=b[1]-a[1];const length=Math.hypot(dx,dy);if(length<.005)return;
    this.add('box',material,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[length,width,depth],[0,0,Math.atan2(dy,dx)]);
  }
  finish(prefix){
    let instances=0;
    for(const {geometry,material,matrices} of this.parts.values()){
      const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);
      matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=prefix+'_'+material.name;
      mesh.computeBoundingBox();mesh.computeBoundingSphere();this.group.add(mesh);instances+=matrices.length;
    }
    return instances;
  }
}
function obstacleFromBounds(id,box,type='entrance'){
  return {id,type,minX:box.min.x,maxX:box.max.x,minY:box.min.y,maxY:box.max.y,minZ:box.min.z,maxZ:box.max.z};
}
function copyBounds(b){return {minX:b.minX,maxX:b.maxX,minY:b.minY,maxY:b.maxY,minZ:b.minZ,maxZ:b.maxZ};}

export function buildEntranceV3(options={}){
  const group=new THREE.Group();group.name='08_Long_Elevation_Screen_Entrance';
  group.position.x=WALL_X;group.rotation.y=Math.PI/2;
  const porch=new THREE.Group();porch.name='Long_Facade_Stone_Apron';group.add(porch);
  const frame=new THREE.Group();frame.name='Screen_Door_Frame_And_Vertical_Plaque';group.add(frame);
  const leaves=new THREE.Group();leaves.name='Symmetric_Outward_Opening_Double_Lattice_Doors';group.add(leaves);
  const geometry={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,24),
    octagon:new THREE.CylinderGeometry(1,1,1,8),sphere:new THREE.SphereGeometry(1,12,8),
    ring:new THREE.TorusGeometry(1,.12,10,32),drum:new THREE.CylinderGeometry(1,1,1,28)};
  const doorWood=createPalaceDoorLacquer();
  const make=(name,color,options={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.57,...options});m.name='Entrance_'+name;return m;};
  const m={
    red:doorWood,frame:doorWood,raised:doorWood,recess:doorWood,
    gold:make('Plaque_Gilt',0xd3ae53,{metalness:.55,roughness:.42}),
    darkGold:make('Bronze_Fittings',0x8d7548,{metalness:.62,roughness:.48}),
    stone:make('Pale_Limestone',0xc9bea6,{roughness:.92}),
    stoneEdge:make('Dressed_Plinth_Stone',0xb3aa98,{roughness:.94}),
    stoneLight:make('Limestone_Edge_Light',0xd9ccb1,{roughness:.90}),
    blue:make('Plaque_Blue_Lacquer',0x132b53,{roughness:.54}),
  };
  const fb=new Batch(frame,geometry),pb=new Batch(porch,geometry),obstacles=[];
  const localObstacle=(id,u,y,n,w,h,d,type)=>{
    // Local U maps to -Z and N maps to +X. Exact world bounds, not old +Z blockers.
    obstacles.push({id,type,minX:WALL_X+n-d/2,maxX:WALL_X+n+d/2,minY:y-h/2,maxY:y+h/2,minZ:-u-w/2,maxZ:-u+w/2});
  };

  const plinth=buildThreeTierPlinth({parent:porch,wallX:WALL_X,materials:m});
  const exteriorSteps=plinth.exteriorSteps;
  obstacles.push(...plinth.edgeCollision);

  // A low 45 mm stone threshold. Closed leaves clear it by 15 mm.
  fb.box(m.stone,0,.0225,-.07,CLEAR_WIDTH,.045,.50);
  for(const side of [-1,1]){
    const u=side*2.45;
    fb.box(m.stone,u,.115,0,.30,.23,.60);
    fb.box(m.frame,u,2.70,0,.30,4.94,.58);
    fb.box(m.red,u,2.69,.305,.22,4.89,.025);
    fb.box(m.gold,u+side*.10,2.69,.323,.010,4.70,.015);
    for(const y of [.61,2.61,4.61]){
      // The hinge straps cross the jamb's outer face and physically reach the pin.
      fb.box(m.darkGold,side*2.39,y,.36,.28,.12,.35);
      fb.add('cylinder',m.darkGold,[side*PIVOT_U,y,PIVOT_N],[.063,.12,.063]);
    }
    localObstacle(side<0?'gate-jamb-north':'gate-jamb-south',u,2.585,0,.30,5.17,.60,'gateFrame');
    // The reference has low exposed column bases, with no bulky drum stones.
  }
  fb.box(m.frame,0,5.28,0,5.20,.22,.58);
  fb.box(m.red,0,5.28,.305,4.95,.11,.025);
  fb.box(m.raised,0,5.365,.323,4.82,.025,.016);
  localObstacle('gate-frame-lintel',0,5.28,0,5.20,.22,.58,'gateFrame');
  // Small metal joinery caps are fittings, not an imperial-studded fortress door.
  for(const u of [-2.11,2.11]){
    fb.add('octagon',m.darkGold,[u,5.27,.336],[.10,.026,.10],[Math.PI/2,0,0]);
    fb.add('sphere',m.gold,[u,5.27,.358],[.027,.027,.018]);
  }

  const gateFrameBox=new THREE.Box3();
  for(const part of fb.parts.values()){
    if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();
    for(const matrix of part.matrices)gateFrameBox.union(part.geometry.boundingBox.clone().applyMatrix4(matrix));
  }
  group.updateMatrix();gateFrameBox.applyMatrix4(group.matrix);
  const gateFrameBounds=copyBounds(obstacleFromBounds('double-gate-frame',gateFrameBox,'gateFrame'));

  // Upper-level vertical plaque: keep its position tied to the smaller
  // upper elevation, rather than to the relocated lower door frame.
  const plaqueY=upperLocalYV15(12.90),plaqueN=18.956-WALL_X;
  const plaque=buildExteriorPlaqueV11({texture:options.exteriorPlaqueTexture,fallbackTexture:options.exteriorPlaqueTexture?null:signTexture(),materials:m});
  plaque.group.position.set(0,plaqueY,plaqueN);frame.add(plaque.group);

  const createLeaf=side=>{
    const leaf=new THREE.Group();leaf.name=side<0?'Left_North_Hinged_Palace_Screen_Door':'Right_South_Hinged_Palace_Screen_Door';
    leaf.position.set(side*PIVOT_U,.06,PIVOT_N);leaves.add(leaf);
    const b=new Batch(leaf,geometry),direction=-side;
    const box=(mat,u,y,n,w,h,d)=>b.box(mat,direction*u,y,n,w,h,d);
    const line=(mat,u0,y0,u1,y1,n,width=.035,depth=.055)=>b.line(mat,[direction*u0,y0,n],[direction*u1,y1,n],width,depth);
    // Each equal leaf has two slender screen fields. Mirrored leaf positions,
    // not negative object scale, give a symmetrical four-field palace doorway.
    const stiles=[.075,LEAF_WIDTH/2,LEAF_WIDTH-.075];
    for(const [i,u] of stiles.entries())box(m.red,u,LEAF_HEIGHT/2,0,i===0||i===2?.15:.09,LEAF_HEIGHT,LEAF_THICKNESS);
    for(const [y,h] of [[.075,.15],[1.205,.13],[1.49,.13],[4.47,.10],[5.025,.15]])box(m.red,LEAF_WIDTH/2,y,0,LEAF_WIDTH-.15,h,LEAF_THICKNESS);
    const panelRecords=[];
    for(let panel=0;panel<2;panel++){
      const leftEdge=stiles[panel]+(panel===0?.075:.045),rightEdge=stiles[panel+1]-(panel===1?.075:.045),center=(leftEdge+rightEdge)/2,w=rightEdge-leftEdge;
      // Solid lower skirt, shallow inset and a double-waist panel have the
      // same lacquer; recesses are actual 34 mm set-backs.
      box(m.red,center,.645,0,w,1.00,.112);
      box(m.red,center,1.3475,0,w,.155,.112);
      const fields=[[2.9875,2.865],[4.735,.43]];
      for(const [cy,h] of fields){
        const lattice=new THREE.Mesh(palaceLatticeGeometry(w+.002,h,{pitch:.215,bar:.018,depth:.050}),m.red);
        lattice.name='Gate_Pierced_Octagonal_Lattice_'+panel+'_'+(cy>4?'Transom':'Main');
        lattice.position.set(direction*center,cy,0);lattice.userData={doorDetail:'pierced-lattice',panel,keepSolidInFallback:true};
        leaf.add(lattice);panelRecords.push({panel,center:[direction*center,cy,0],width:w+.002,height:h,...lattice.geometry.userData});
      }
      for(const face of[-1,1]){
        const front=face*.094;
        // Narrow gilded beads and L-shaped corner returns belong to the frame;
        // the intervening timber stays the same dark-red lacquer.
        for(const u of[center-w/2-.010,center+w/2+.010])box(m.gold,u,2.9875,front,.010,2.91,.012);
        for(const y of[1.533,4.442])box(m.gold,center,y,front,w+.02,.010,.012);
        for(const u of[center-w/2-.012,center+w/2+.012]){
          const sign=u<center?1:-1;
          for(const y of[1.49,4.47]){
            const sy=y<3?1:-1;line(m.gold,u,y,u+sign*.13,y,face*.096,.010,.012);
            line(m.gold,u,y,u,y+sy*.13,face*.096,.010,.012);
          }
        }
        const relief=new THREE.Mesh(palaceCartoucheGeometry(w-.14,.80,.012,.014),m.gold);
        relief.position.set(direction*center,.645,face*.065);relief.rotation.y=face<0?Math.PI:0;
        relief.name='Gate_Raised_Skirt_Cartouche_'+panel+'_'+face;relief.userData={doorDetail:'recessed-skirt-cartouche',keepSolidInFallback:true};leaf.add(relief);
        const flower=new THREE.Mesh(palaceRosetteGeometry(.205,.011,.014),m.gold);
        flower.position.set(direction*center,.645,face*.063);flower.rotation.y=face<0?Math.PI:0;
        flower.name='Gate_Carved_Eight_Petal_Medallion_'+panel+'_'+face;flower.userData={doorDetail:'carved-medallion',keepSolidInFallback:true};leaf.add(flower);
        for(let k=0;k<8;k++){
          const a=k*Math.PI/4,ra=.065,rb=.155;
          line(m.gold,center+Math.cos(a)*ra,.645+Math.sin(a)*ra,center+Math.cos(a)*rb,.645+Math.sin(a)*rb,face*.062,.009,.012);
        }
        for(const sy of[-1,1])for(let j=0;j<12;j++){
          const a=j/11*Math.PI*1.35,aa=(j+1)/11*Math.PI*1.35;
          const rr=.11-.043*j/11,r2=.11-.043*(j+1)/11;
          line(m.gold,center+sy*(.31+Math.cos(a)*rr),.645+Math.sin(a)*rr,center+sy*(.31+Math.cos(aa)*r2),.645+Math.sin(aa)*r2,face*.062,.008,.012);
        }
        for(const y of[1.301,1.394])box(m.gold,center,y,face*.066,w-.14,.009,.012);
      }
    }
    // Small bronze ring pulls sit on the central closing stiles.
    const pullU=LEAF_WIDTH-.12;
    b.add('octagon',m.darkGold,[direction*pullU,1.49,.108],[.10,.022,.10],[Math.PI/2,0,0]);
    b.add('sphere',m.gold,[direction*pullU,1.50,.14],[.035,.033,.035]);
    b.add('ring',m.darkGold,[direction*pullU,1.37,.172],[.105,.105,.105]);
    for(const y of [.55,2.55,4.55]){
      b.add('cylinder',m.darkGold,[0,y,0],[.055,.36,.055]);
      for(const dy of [-.14,.14])b.add('cylinder',m.gold,[0,y+dy,0],[.058,.022,.058]);
      box(m.darkGold,.19,y,.107,.28,.085,.023);
    }
    const instances=b.finish(side<0?'Left_Palace_Screen':'Right_Palace_Screen');
    leaf.userData={type:'opening-gate-leaf',design:'mirrored-double-leaf-palace-screen',woodColor:'#762c27',latticePanels:panelRecords,side,hingeSide:side<0?'north':'south',width:LEAF_WIDTH,height:LEAF_HEIGHT,thickness:LEAF_THICKNESS,pullLocal:[direction*pullU,1.37,.172],instances};
    return leaf;
  };
  const left=createLeaf(-1),right=createLeaf(1),doors=[left,right];
  const doorObstacles=[{id:'gate-left-leaf',type:'gateLeaf'},{id:'gate-right-leaf',type:'gateLeaf'}];
  obstacles.push(...doorObstacles);
  let isOpen=true;
  const closedAngles=[0,0],openAngles=[-OPEN_ANGLE,OPEN_ANGLE];
  const updateDoorBounds=()=>{
    group.updateWorldMatrix(true,true);
    for(const [i,leaf] of doors.entries())Object.assign(doorObstacles[i],obstacleFromBounds(doorObstacles[i].id,new THREE.Box3().setFromObject(leaf),'gateLeaf'));
  };
  const gate={
    get isOpen(){return isOpen;},left,right,doors,closedAngles,openAngles,obstacles:doorObstacles,
    setOpen(open){isOpen=Boolean(open);doors.forEach((leaf,i)=>{leaf.rotation.y=isOpen?openAngles[i]:closedAngles[i];});updateDoorBounds();return isOpen;},
  };
  const detailInstances=fb.finish('Long_Entrance_Frame')+pb.finish('Long_Entrance_Stone')+plinth.instanceCount+doors.reduce((sum,leaf)=>sum+leaf.userData.instances,0);
  // Door frame and leaf members are structural solids; the CPU fallback must
  // not discard the slender lattice rails while keeping their gold decoration.
  for(const container of [frame,leaves])container.traverse(mesh=>{if(mesh.isMesh)mesh.userData.keepSolidInFallback=true;});
  gate.setOpen(false);const closedBounds=doorObstacles.map(copyBounds);
  gate.setOpen(true);const openBounds=doorObstacles.map(copyBounds);
  const openClearance=Math.min(CLEAR_WIDTH/2,openBounds[0].minZ)-Math.max(-CLEAR_WIDTH/2,openBounds[1].maxZ);
  const groundRects=[
    {id:'long-entry-threshold-connection',minX:20.5,maxX:24.2,minZ:-2.3,maxZ:2.3,y:0},
    ...plinth.surfaces,...plinth.courtyardSurfaces,
  ];
  const geometryMetadata={
    orientation:'+X',facadeAxis:'Z',facadeLength:62,doorway:{minX:21.55,maxX:22.17,minY:0,maxY:CLEAR_HEIGHT,minZ:-CLEAR_WIDTH/2,maxZ:CLEAR_WIDTH/2},
    frameBounds:gateFrameBounds,doorLeafCount:2,
    doorStyle:'symmetric-double-leaf-octagonal-palace-screen',doorWoodColor:'#762c27',doorLatticeOpenings:doors.reduce((sum,leaf)=>sum+leaf.userData.latticePanels.reduce((n,p)=>n+p.openingCount,0),0),
    clearWidth:CLEAR_WIDTH,leafWidth:LEAF_WIDTH,leafHeight:LEAF_HEIGHT,leafThickness:LEAF_THICKNESS,
    pivots:[[WALL_X+PIVOT_N,.06,PIVOT_U],[WALL_X+PIVOT_N,.06,-PIVOT_U]],openAngleDegrees:90,openAnglesDegrees:[-90,90],hingeSide:'both-outer-jambs',openingDirection:'+X',centerSeamWidth:2*(PIVOT_U-LEAF_WIDTH),symmetryPlane:'Z=0',
    openClearance,openBounds,closedBounds,thresholdHeight:.045,
    forecourt:{minX:24.2,maxX:plinth.metadata.terraces[0].halfX,minZ:-plinth.metadata.terraces[0].halfZ,maxZ:plinth.metadata.terraces[0].halfZ,y:0,rectangles:plinth.surfaces.filter(r=>r.y===0)},
    exteriorSteps,exteriorStairs:plinth.stairRuns,exteriorGroundY:-3.6,walkingPlatformEndX:plinth.metadata.terraces[0].halfX,plinth:plinth.metadata,
    entranceSpawn:[26.2,1.72,0],entranceYaw:Math.PI/2,
    plaque:{...plaque.metadata,orientation:'+X',center:[19.037,plaqueY,0],width:plaque.metadata.faceWidth,height:plaque.metadata.faceHeight,frameHighestY:plaqueY+plaque.metadata.frameLocalTopY},
  };
  group.userData={version:'11.0',type:'Ming-inspired-long-elevation-screen-entrance',units:'metres',geometryMetadata};
  return {group,porch,frame,doors,gate,materials:m,obstacles,groundRects,exteriorSteps,exteriorStairs:plinth.stairRuns,terraceSurfaces:plinth.surfaces,courtyardSurfaces:plinth.courtyardSurfaces,terraceEdgeCollision:plinth.edgeCollision,terraceGroup:plinth.group,plinth,plaqueGroup:plaque.group,geometryMetadata,spawn:geometryMetadata.entranceSpawn,walkYaw:geometryMetadata.entranceYaw,
    stats:{doorLeaves:2,doorLeafWidth:LEAF_WIDTH,doorCenterSeamWidth:2*(PIVOT_U-LEAF_WIDTH),doorOpeningWidth:CLEAR_WIDTH,doorOpeningHeight:5.17,openGateClearance:openClearance,entranceInstances:detailInstances,stoneTerraceLevels:3,stoneStairFlights:3,stoneStairSteps:24,forecourtArea:4*plinth.metadata.terraces[0].halfX*plinth.metadata.terraces[0].halfZ-48.4*66.4,entranceFacing:'+X',entranceFacadeLength:62}};
}
