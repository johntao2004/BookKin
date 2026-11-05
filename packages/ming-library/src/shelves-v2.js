import * as THREE from 'three';
import {PALACE_FRAME_V10 as FRAME} from './palace-frame-v10.js';

// All racks use the same measured module. Coordinates are metres, Y-up.
export const SHELF_WIDTH=3.55;
export const SHELF_HEIGHT=3.48;
export const SHELF_DEPTH=1.04;
// Include crown mouldings and front/back nameplates when checking clearance.
export const SHELF_FOOTPRINT_WIDTH=3.76;
export const SHELF_FOOTPRINT_DEPTH=1.21;
export const SHELF_LEVELS=[.42,.97,1.52,2.07,2.62];
export const UPPER_Y=8.4;
export const CATEGORIES=['文学','历史','科技','艺术','哲学','生活'];
export const SHELF_ROW_X=[-13.6,-10.2,-6.8,-3.4,0,3.4,6.8,10.2,13.6];
export const SHELF_BAY_Z=[10.85,14.75];
// These annex bays occupy real floor left vacant behind/beyond the stairs.
// They do not add a floor slab or narrow either flight or its arrival landing.
export const SHELF_REAR_ROW_X=SHELF_ROW_X.slice(0,3);
export const SHELF_REAR_BAY_Z=21.7;
export const SHELF_OUTER_BAY_Z=28.0;

function tex(w,h,draw){
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

function materials(){
  const grain=tex(256,512,(c,w,h)=>{
    c.fillStyle='#c3a080';c.fillRect(0,0,w,h);
    for(let i=0;i<340;i++){
      const x=(i*53.117)%w;c.strokeStyle=`rgba(${i%3?'71,41,17':'247,220,179'},${.025+(i%7)*.012})`;
      c.lineWidth=i%6?1:1.8;c.beginPath();c.moveTo(x,0);
      for(let y=0;y<=h;y+=12)c.lineTo(x+Math.sin(y*.021+i)*2.1,y);c.stroke();
    }
  });
  const make=(name,color,roughness=.55,metalness=0,map=null)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,map});m.name=name;return m;};
  return {wood:make('Rack walnut',0x71452e,.43,0,grain),edge:make('Rack polished moulding',0x9b6941,.40,0,grain),dark:make('Rack recess',0x352b25,.76),gold:make('Rack bronze inlay',0xa88550,.42,.6),teal:make('Rack blue green panels',0x2b4e48,.62)};
}

class Batch {
  constructor(){this.batches=new Map();this.tmp=new THREE.Object3D();}
  part(geo,mat,pos,scale,rot=[0,0,0]){let key=geo.uuid+'/'+mat.uuid;if(!this.batches.has(key))this.batches.set(key,{geo,mat,matrices:[]});this.tmp.position.set(...pos);this.tmp.scale.set(...scale);this.tmp.rotation.set(...rot);this.tmp.updateMatrix();this.batches.get(key).matrices.push(this.tmp.matrix.clone());}
  build(){const g=new THREE.Group();g.name='Precision_Ming_Rack_Modules';for(const {geo,mat,matrices} of this.batches.values()){const m=new THREE.InstancedMesh(geo,mat,matrices.length);matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.castShadow=true;m.receiveShadow=true;m.computeBoundingBox();m.computeBoundingSphere();m.name=mat.name;g.add(m);}return g;}
}

export function createShelfLayout(planScale=1){
  const racks=[];const counts={1:0,2:0};
  const add=(x,z,floor,rowIndex,wing,bay,zone='main')=>{
    counts[floor]++;const index=counts[floor];const category=CATEGORIES[rowIndex%CATEGORIES.length];
    racks.push({id:`F${floor}-${String(index).padStart(2,'0')}`,floor,position:[x*planScale,floor===1?0:UPPER_Y,z*planScale],
      rotationY:Math.PI/2,width:SHELF_WIDTH,depth:SHELF_DEPTH,height:SHELF_HEIGHT,
      footprintWidth:SHELF_FOOTPRINT_WIDTH,footprintDepth:SHELF_FOOTPRINT_DEPTH,
      rowId:`F${floor}-${wing}-${zone}-R${String(rowIndex+1).padStart(2,'0')}`,rowIndex,wing,bay,zone,
      category,title:`${floor}F · ${category} ${String(index).padStart(2,'0')}架`});
  };
  // The library follows the actual +X entrance axis. Both wings are now
  // north/south of the central ceremonial hall. Racks run along Z, their
  // modern-book spines face ±X. A 3.4 m pitch leaves a measured 2.19 m
  // browsing aisle after the full crown/nameplate footprint is subtracted.
  for(const floor of [1,2])for(const [rowIndex,x] of SHELF_ROW_X.entries()){
    for(const side of [-1,1]){
      const wing=side<0?'north':'south';
      for(const [bay,z] of SHELF_BAY_Z.entries())add(x,side*z,floor,rowIndex,wing,bay);
      if(SHELF_REAR_ROW_X.includes(x))add(x,side*SHELF_REAR_BAY_Z,floor,rowIndex,wing,2,'rear');
      // The upper storey ends at |Z|=26 m. Only the wider ground storey
      // receives this final band, separated from the staircase by an aisle.
      if(floor===1)add(x,side*SHELF_OUTER_BAY_Z,floor,rowIndex,wing,3,'outer');
    }
  }
  return racks;
}

/** Spatial intent for navigation/audits; clear zones are not extra floor slabs. */
export function getShelfLayoutMetadata(racks=createShelfLayout(),planScale=1){
  const rowXs=SHELF_ROW_X.map(x=>x*planScale),rearXs=SHELF_REAR_ROW_X.map(x=>x*planScale);
  const halfX=SHELF_FOOTPRINT_DEPTH/2,halfZ=SHELF_FOOTPRINT_WIDTH/2;
  const innerZ=SHELF_BAY_Z[0]*planScale-halfZ,outerZ=SHELF_BAY_Z[1]*planScale+halfZ;
  const round=v=>Number(v.toFixed(3));
  const rows=[],aisles=[],clearZones=[],protectedStairs=[],storageZones=[];
  for(const floor of [1,2]){
    const y=floor===1?0:UPPER_Y;
    clearZones.push({id:`F${floor}-entry-throne-axis`,floor,y,role:'central-hall-clear-of-shelves',minX:-18,maxX:21.85,minZ:-FRAME.atrium.openingHalfZ,maxZ:FRAME.atrium.openingHalfZ});
    // The actual clear route ends before the window-line column bases.
    // Columns belong to the wall / rail / shelf-end setting-out, never this lane.
    const laneInner=FRAME.atrium.openingHalfX+.20,laneOuter=FRAME.columns.x.at(-1)-FRAME.columns.baseRadius-.10;
    for(const side of[-1,1])clearZones.push({id:`F${floor}-${side>0?'front':'rear'}-cross-gallery`,floor,y,role:'entrance-and-stair-arrival',minX:side>0?laneInner:-laneOuter,maxX:side>0?laneOuter:-laneInner,minZ:-26,maxZ:26});
    if(floor===1)clearZones.push({id:'F1-single-door-passage',floor,y,role:'long-side-entrance-passage',minX:6.3,maxX:21.85,minZ:-2.3,maxZ:2.3});
    for(const side of [-1,1]){
      const wing=side<0?'north':'south',minZ=side<0?-outerZ:innerZ,maxZ=side<0?-innerZ:outerZ;
      const stair=FRAME.stairs;
      protectedStairs.push({id:`F${floor}-${wing}-stair-reserve`,floor,y,minX:stair.protectedMinX,maxX:stair.protectedMaxX,minZ:side*stair.centerZ-stair.protectedHalfZ,maxZ:side*stair.centerZ+stair.protectedHalfZ});
      const bands=[{zone:'main',xs:rowXs,minZ,maxZ},
        {zone:'rear',xs:rearXs,minZ:side*SHELF_REAR_BAY_Z*planScale-halfZ,maxZ:side*SHELF_REAR_BAY_Z*planScale+halfZ},
        ...(floor===1?[{zone:'outer',xs:rowXs,minZ:side*SHELF_OUTER_BAY_Z*planScale-halfZ,maxZ:side*SHELF_OUTER_BAY_Z*planScale+halfZ}]:[])];
      for(const band of bands){
        storageZones.push({id:`F${floor}-${wing}-${band.zone}`,floor,wing,zone:band.zone,y,minX:round(band.xs[0]-halfX),maxX:round(band.xs.at(-1)+halfX),minZ:round(band.minZ),maxZ:round(band.maxZ),rackCount:racks.filter(r=>r.floor===floor&&r.wing===wing&&r.zone===band.zone).length});
        for(const [rowIndex,x] of band.xs.entries()){
          rows.push({id:`F${floor}-${wing}-${band.zone}-R${String(rowIndex+1).padStart(2,'0')}`,floor,wing,zone:band.zone,y,rowIndex,minX:round(x-halfX),maxX:round(x+halfX),minZ:round(band.minZ),maxZ:round(band.maxZ)});
          if(rowIndex<band.xs.length-1){const next=band.xs[rowIndex+1];aisles.push({id:`F${floor}-${wing}-${band.zone}-aisle-${rowIndex+1}`,floor,wing,zone:band.zone,y,role:'between-shelf-rows',minX:round(x+halfX),maxX:round(next-halfX),minZ:round(band.minZ),maxZ:round(band.maxZ),clearWidth:round(next-x-SHELF_FOOTPRINT_DEPTH)});}
        }
      }
    }
  }
  for(const rect of [...clearZones,...protectedStairs])for(const key of ['minX','maxX','minZ','maxZ'])rect[key]*=planScale;
  const rackCounts={lower:racks.filter(r=>r.floor===1).length,upper:racks.filter(r=>r.floor===2).length,total:racks.length};
  return {version:13,planScale,orientation:'transverse-Z',longAxis:'Z',spineFaces:['+X','-X'],hallAxis:'X',entryLooksToward:'-X',rowPitch:3.4*planScale,
    entranceDirection:'+X',entrancePassageWidth:4.6*planScale,rowsPerWing:SHELF_ROW_X.length,
    rowsPerFloorWing:Object.fromEntries([1,2].flatMap(floor=>['north','south'].map(wing=>[`${floor}-${wing}`,new Set(racks.filter(r=>r.floor===floor&&r.wing===wing&&r.zone==='main').map(r=>r.position[0])).size]))),rows,aisles,clearZones,protectedStairs,storageZones,rackCounts,
    previousRackCount:56,additionalRackCount:racks.length-56,storageIncreasePercent:round((racks.length/56-1)*100),
    rackFootprintArea:round(racks.length*SHELF_FOOTPRINT_WIDTH*SHELF_FOOTPRINT_DEPTH),
    addedZones:storageZones.filter(z=>z.zone!=='main').map(z=>z.id),
    minRowAisleWidth:Math.min(...aisles.map(a=>a.clearWidth)),centralClearWidth:2*innerZ,
    atriumOpening:{minX:-FRAME.atrium.openingHalfX*planScale,maxX:FRAME.atrium.openingHalfX*planScale,minZ:-FRAME.atrium.openingHalfZ*planScale,maxZ:FRAME.atrium.openingHalfZ*planScale},moduleJoinGap:round((SHELF_BAY_Z[1]-SHELF_BAY_Z[0])*planScale-SHELF_FOOTPRINT_WIDTH),moduleJoinIsWalkway:false,
    innerAisleAtColumn:round(innerZ-(FRAME.atrium.railZ+FRAME.columns.baseRadius)*planScale),frontShelfEdge:round(rowXs.at(-1)+halfX)};
}

export function buildShelvesV2({planScale=1}={}){
  const racks=createShelfLayout(planScale),m=materials(),b=new Batch(),box=new THREE.BoxGeometry(1,1,1),cyl=new THREE.CylinderGeometry(1,1,1,8);
  const labels=new THREE.Group();labels.name='Rack_Call_Numbers';
  const compartments=[],obstacles=[];
  let compartmentIndex=0;
  for(const rack of racks){
    const [x,y,z]=rack.position,ry=rack.rotationY,cos=Math.cos(ry),sin=Math.sin(ry);
    const point=(xx,yy,zz)=>[x+xx*cos+zz*sin,y+yy,z-xx*sin+zz*cos];
    const part=(mat,xx,yy,zz,w,h,d,rz=0)=>b.part(box,mat,point(xx,yy,zz),[w,h,d],[0,ry,rz]);
    const rod=(mat,xx,yy,zz,r,h)=>b.part(cyl,mat,point(xx,yy,zz),[r,h,r],[0,ry,0]);
    // Four substantial outside stiles, a shared back panel, and twin shelving faces.
    for(const xx of [-1.715,1.715])for(const zz of [-.47,.47]){
      part(m.wood,xx,1.73,zz,.105,3.46,.105);
      part(m.dark,xx,.12,zz,.13,.24,.13);part(m.gold,xx,.285,zz,.11,.016,.11);
      rod(m.edge,xx,1.75,zz+.054,.013,3.05);
    }
    part(m.dark,0,1.72,0,3.34,3.03,.055);
    // A central upright divides the furniture into two balanced bays.
    for(const zz of [-.47,.47])part(m.wood,0,1.74,zz,.07,3.30,.095);
    for(const yy of [...SHELF_LEVELS,3.19]){
      part(m.wood,0,yy,0,3.44,.075,1.04);
      for(const zz of [-.53,.53]){
        part(m.edge,0,yy+.019,zz,3.46,.037,.024);
        part(m.gold,0,yy-.018,zz,3.36,.009,.009);
      }
    }
    // Plinth, recessed panels and three stepped crown mouldings.
    part(m.wood,0,.25,0,3.44,.20,1.02);part(m.dark,0,.125,0,3.32,.08,.91);
    for(const zz of [-.525,.525])for(const xx of [-.84,.84]){
      part(m.dark,xx,.265,zz,1.50,.105,.018);part(m.edge,xx,.31,zz,1.46,.012,.025);
    }
    for(const [yy,w,h,d]of [[3.25,3.57,.08,1.10],[3.32,3.66,.065,1.16],[3.38,3.71,.055,1.19]])part(m.wood,0,yy,0,w,h,d);
    for(const zz of [-.59,.59])part(m.gold,0,3.385,zz,3.58,.012,.014);
    for(const end of [-1,1]){
      // Ming-derived open fretwork on the short ends, without solid clumsy boxes.
      for(const yy of [.71,1.26,1.81,2.36,2.91]){
        part(m.wood,end*1.72,yy,0,.06,.035,.88);
        for(const zz of [-.31,0,.31])part(m.edge,end*1.727,yy+.15,zz,.025,.26,.025);
      }
      part(m.teal,end*1.777,3.00,0,.025,.31,.55);
      part(m.gold,end*1.795,3.00,0,.012,.23,.46);
      part(m.teal,end*1.806,3.00,0,.012,.20,.43);
    }
    const signMap=tex(512,96,(c,w,h)=>{
      c.fillStyle='#29463e';c.fillRect(0,0,w,h);c.strokeStyle='#b99354';c.lineWidth=3;c.strokeRect(6,6,w-12,h-12);
      c.fillStyle='#e9d8ad';c.font='500 38px Silvae Serif, Noto Serif SC, serif';c.textAlign='center';c.textBaseline='middle';c.fillText(`${rack.id}  ·  ${rack.category}`,w/2,h*.54);
    });
    const signMat=new THREE.MeshStandardMaterial({map:signMap,color:0xffffff,roughness:.7});
    for(const face of [-1,1]){
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.12,.17),signMat);sign.position.set(...point(0,3.28,face*.602));sign.rotation.y=ry+(face<0?Math.PI:0);sign.name=`Label_${rack.id}`;labels.add(sign);
      for(let level=0;level<SHELF_LEVELS.length;level++)for(const bay of [-1,1]){
        compartments.push({id:`cell-${++compartmentIndex}`,shelfId:rack.id,floor:rack.floor,category:rack.category,origin:point(bay*.84,SHELF_LEVELS[level]+.039,face*.495),rotationY:ry+(face<0?Math.PI:0),width:1.52,maxHeight:.47,maxDepth:.43,maxThickness:.13,level});
      }
    }
    const halfX=Math.abs(cos)*SHELF_FOOTPRINT_WIDTH/2+Math.abs(sin)*SHELF_FOOTPRINT_DEPTH/2;
    const halfZ=Math.abs(sin)*SHELF_FOOTPRINT_WIDTH/2+Math.abs(cos)*SHELF_FOOTPRINT_DEPTH/2;
    obstacles.push({minX:x-halfX,maxX:x+halfX,minZ:z-halfZ,maxZ:z+halfZ,minY:y,maxY:y+3.5,type:'shelf',id:rack.id});
  }
  const layout=getShelfLayoutMetadata(racks,planScale);
  const group=b.build();group.add(labels);group.userData={racks:racks.length,floors:2,type:'Ming_style_modern_book_racks',layoutVersion:13,orientation:layout.orientation};
  return {group,racks,compartments,obstacles,layout,aisles:layout.aisles,clearZones:layout.clearZones,
    stats:{shelves:racks.length,lowerShelves:racks.filter(r=>r.floor===1).length,upperShelves:racks.filter(r=>r.floor===2).length,
      shelfOrientation:layout.orientation,rowsPerWing:layout.rowsPerWing,minRowAisleWidth:layout.minRowAisleWidth,centralClearWidth:layout.centralClearWidth,
      compartments:compartments.length,additionalShelves:layout.additionalRackCount,storageIncreasePercent:layout.storageIncreasePercent,storageZones:layout.storageZones.length}};
}

/** Pack a real collection in order, or fill an explicitly labelled demo. */
export function allocateBookSlots(compartments,books,{repeat=false,maxBooks=30000}={}){
  if(!books.length)return [];
  const slots=[];let index=0;
  const perCellLimit=repeat?Math.max(1,Math.floor(maxBooks/compartments.length)):Infinity;
  for(const cell of compartments){
    let cursor=-cell.width/2+.018,cellCount=0;
    while(slots.length<maxBooks){
      if(cellCount>=perCellLimit)break;
      if(!repeat&&index>=books.length)return slots;
      const book=books[index%books.length];
      const t=Math.min(.13,Math.max(.028,Number(book.thickness)||(.028+Math.min(900,Number(book.pageCount)||320)*.000065)));
      if(cursor+t>cell.width/2-.016)break;
      const xx=cursor+t/2,cos=Math.cos(cell.rotationY),sin=Math.sin(cell.rotationY);
      slots.push({x:cell.origin[0]+xx*cos,y:cell.origin[1],z:cell.origin[2]-xx*sin,rotationY:cell.rotationY,bookId:book.id,shelfId:cell.shelfId,floor:cell.floor,cellId:cell.id,maxHeight:cell.maxHeight,maxDepth:cell.maxDepth,maxThickness:t});
      cursor+=t+.009;index++;cellCount++;
    }
    if(slots.length>=maxBooks)break;
  }
  return slots;
}
