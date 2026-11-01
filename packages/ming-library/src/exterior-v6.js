import * as THREE from 'three';
import {upperLocalYV15} from './height-v15.js';
import {lowerRoofSurfaceHeight,upperRoofSurfaceHeight} from './roof-v6.js';
import {createPalaceDoorLacquer,palaceLatticeGeometry,palaceCartoucheGeometry,palaceRosetteGeometry} from './entrance-v3.js';
import {prepareContinuousFriezeTexture,continuousFriezeGeometry} from './continuous-frieze-v9.js';
import {PALACE_FRAME_V10 as FRAME,palaceBayStations} from './palace-frame-v10.js';
import {V12_COLUMN_COLOR} from './design-v12.js';
import {palaceColumnMaterialV12,palaceStoneMaterialV12,palaceColumnBaseGeometryV12} from './timber-style-v12.js';

/** Reference-led, genuinely stepped two-storey palace envelope. */
function texture(width,height,paint){
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=width;c.height=height;paint(c.getContext('2d'),width,height);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

function paintedFrieze(){
  return texture(1536,256,(c,w,h)=>{
    c.fillStyle='#194a56';c.fillRect(0,0,w,h);
    for(const[inset,color,line]of[[5,'#c3a158',5],[14,'#487d74',8],[25,'#cfb66b',3],[31,'#243d69',8]]){
      c.strokeStyle=color;c.lineWidth=line;c.strokeRect(inset,inset,w-inset*2,h-inset*2);
    }
    c.fillStyle='#263f67';c.fillRect(40,40,w-80,h-80);
    const cartouche=(cx,ww)=>{
      c.fillStyle='#174f4d';c.strokeStyle='#d4b665';c.lineWidth=4;
      const l=cx-ww/2,r=cx+ww/2;c.beginPath();c.moveTo(l+28,44);c.lineTo(r-28,44);c.lineTo(r-8,68);c.lineTo(r-8,188);c.lineTo(r-28,212);c.lineTo(l+28,212);c.lineTo(l+8,188);c.lineTo(l+8,68);c.closePath();c.fill();c.stroke();
      c.save();c.translate(cx,128);c.strokeStyle='#e1c580';c.lineWidth=4;c.lineCap='round';
      // Hand-painted coils, whiskers, claws and scales in the beam's central field.
      c.beginPath();c.moveTo(-ww*.25,20);c.bezierCurveTo(-ww*.14,-62,ww*.13,62,ww*.24,-24);c.stroke();
      c.beginPath();c.moveTo(-ww*.25,10);c.bezierCurveTo(-ww*.12,-54,ww*.10,55,ww*.24,-33);c.stroke();
      for(let i=0;i<18;i++){
        const x=-ww*.23+i*ww*.026,y=Math.sin(i*.39-1.4)*29;c.beginPath();c.arc(x,y,8,-2.2,.7);c.stroke();
      }
      c.lineWidth=3;
      for(const s of[-1,1]){
        c.beginPath();c.moveTo(s*ww*.08,-12);c.lineTo(s*ww*.13,-39);c.lineTo(s*ww*.21,-48);c.stroke();
        c.beginPath();c.moveTo(s*ww*.13,21);c.lineTo(s*ww*.21,49);c.lineTo(s*ww*.28,41);c.stroke();
        for(let k=0;k<3;k++){
          c.beginPath();c.moveTo(s*ww*.21,-48);c.lineTo(s*(ww*.23+k*9),-58+k*5);c.stroke();
        }
      }
      c.beginPath();c.ellipse(ww*.255,-25,24,16,-.5,0,Math.PI*2);c.stroke();
      c.beginPath();c.moveTo(ww*.245,-38);c.lineTo(ww*.23,-57);c.lineTo(ww*.20,-63);c.moveTo(ww*.26,-41);c.lineTo(ww*.29,-61);c.stroke();
      c.beginPath();c.moveTo(ww*.285,-20);c.bezierCurveTo(ww*.39,-24,ww*.31,5,ww*.36,9);c.stroke();
      c.fillStyle='#f5e4a9';c.beginPath();c.arc(ww*.265,-29,3.3,0,Math.PI*2);c.fill();
      c.strokeStyle='#638e82';c.lineWidth=2;
      for(const s of[-1,1])for(let j=0;j<3;j++){
        const x=s*(ww*.34+j*11),y=(j-1)*38;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+s*24,y-21,x+s*37,y+17,x+s*8,y+15);c.stroke();
      }
      c.restore();
    };
    cartouche(w*.5,850);cartouche(177,260);cartouche(w-177,260);
    for(const x of[330,w-330]){
      c.fillStyle='#51816c';c.fillRect(x-12,40,24,176);c.strokeStyle='#e0c679';c.lineWidth=3;c.strokeRect(x-12,40,24,176);
      for(const y of[66,128,190]){c.beginPath();c.arc(x,y,8,0,Math.PI*2);c.stroke();}
    }
  });
}

function lacquerTexture(){
  return texture(256,512,(c,w,h)=>{
    c.fillStyle='#d5b7a8';c.fillRect(0,0,w,h);
    for(let i=0;i<950;i++){
      const x=(i*71.136)%w,y=(i*43.718)%h;
      c.fillStyle=i%4?'rgba(78,37,31,.035)':'rgba(255,237,218,.08)';c.fillRect(x,y,1+(i%3),4+i%19);
    }
    for(let i=0;i<60;i++){
      c.strokeStyle='rgba(74,37,28,.055)';c.lineWidth=.5;c.beginPath();c.moveTo(i*4.341,0);c.bezierCurveTo(i*4.341+3,130,i*4.341-2,360,i*4.341+1,h);c.stroke();
    }
  });
}

class Batch{
  constructor(group,{keepSolidInFallback=false,prefix='V7_Exterior'}={}){this.group=group;this.keepSolidInFallback=keepSolidInFallback;this.prefix=prefix;this.parts=new Map();this.boxGeometry=new THREE.BoxGeometry(1,1,1);this.planeGeometry=new THREE.PlaneGeometry(1,1);this.columnGeometry=new THREE.CylinderGeometry(1,1,1,36);this.cylinderGeometry=new THREE.CylinderGeometry(1,1,1,28);this.object=new THREE.Object3D();}
  add(geometry,material,position,scale,rotation=[0,0,0]){
    const key=geometry.uuid+'/'+material.uuid;if(!this.parts.has(key))this.parts.set(key,{geometry,material,matrices:[]});
    this.object.position.set(...position);this.object.scale.set(...scale);this.object.rotation.set(...rotation);this.object.updateMatrix();const matrices=this.parts.get(key).matrices,matrix=this.object.matrix.clone(),instanceIndex=matrices.length;matrices.push(matrix);return{matrix,instanceIndex,meshName:this.prefix+'_'+(geometry.name||geometry.type)+'_'+material.name};
  }
  box(mat,p,s,r){this.add(this.boxGeometry,mat,p,s,r);}
  rod(mat,a,b,width=.03,depth=width){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),length=start.distanceTo(end);if(length<.005)return;
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize()),r=new THREE.Euler().setFromQuaternion(q);
    this.box(mat,start.add(end).multiplyScalar(.5).toArray(),[width,length,depth],[r.x,r.y,r.z]);
  }
  finish(){let n=0;for(const{geometry,material,matrices}of this.parts.values()){
      const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.name=this.prefix+'_'+(geometry.name||geometry.type)+'_'+material.name;mesh.userData.keepSolidInFallback=this.keepSolidInFallback||geometry.userData?.retainDoorFrontFace===true;mesh.userData.architecturalDetail=material.name.includes('ArchitecturalDetail');mesh.userData.doorDetail=geometry.userData?.doorDetail;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();this.group.add(mesh);n+=matrices.length;
  }return n;}
}

function columnBaseGeometry(){
  return palaceColumnBaseGeometryV12();
}

function curvedSpandrel(){
  const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(1.12,0);s.lineTo(1.08,-.11);s.bezierCurveTo(.88,-.13,.90,-.25,.73,-.24);s.bezierCurveTo(.56,-.23,.61,-.43,.42,-.42);s.bezierCurveTo(.23,-.40,.29,-.63,0,-.65);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.13,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:1,curveSegments:8});g.translate(0,0,-.065);return g;
}

export function buildExteriorV6({envelope,obstacles,paintTexture=null}){
  const group=new THREE.Group();group.name='Reference_Double_Eave_Stepped_Envelope';envelope.add(group);
  const lower=new THREE.Group();lower.name='Lower_Broad_Hall_And_Round_Colonnade';group.add(lower);
  const upper=new THREE.Group();upper.name='Recessed_Upper_Clerestory';group.add(upper);
  const lb=new Batch(lower),ub=new Batch(upper),lsb=new Batch(lower,{keepSolidInFallback:true,prefix:'V7_Lower_Support'}),usb=new Batch(upper,{keepSolidInFallback:true,prefix:'V7_Upper_Support'});
  const columnFootprints=[],upperColumnFootprints=[],supportConnections=[],groundFrameConnections=[],groundWallBeamSockets=[],groundColumnCarriers=[],paintPanels=[],screenPanels=[],registry=new Set(),upperRegistry=new Set(),grain=lacquerTexture(),doorGeometryCache=new Map(),latticeFrontCaps=new Map(),friezeGeometryCache=new Map();
  const detailTexture=prepareContinuousFriezeTexture(paintTexture||paintedFrieze());
  if(detailTexture){detailTexture.name='ArchitecturalDetail_Palace_Dragon_Frieze';detailTexture.anisotropy=16;detailTexture.magFilter=THREE.LinearFilter;}
  const image=detailTexture?.image,detailAspect=image?.width&&image?.height?image.width/image.height:3;
  const make=(name,color,options={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.67,...options});m.name='Palace_'+name;return m;};
  const m={
    column:palaceColumnMaterialV12(),
    red:make('Red_Lacquer_Joinery',V12_COLUMN_COLOR,{roughness:.53}),
    shadow:make('Window_Recess_Shadow',0x291914,{roughness:.96}),paper:make('Interior_Paper',0xd8ccb0,{roughness:.95}),
    green:make('Mineral_Green',0x246453),blue:make('Mineral_Blue',0x244d73),
    gold:make('Painted_Gold_Outlines',0xc8ab61,{metalness:.30,roughness:.62}),
    paint:make('ArchitecturalDetail_Dragon_Cloud_Painted_Frieze',0xffffff,{map:detailTexture,roughness:.78}),
    stone:palaceStoneMaterialV12(),stoneTop:make('Stone_Edge',0xd0cbbb,{roughness:.90}),
  };
  m.door=createPalaceDoorLacquer();m.wood=m.lattice=m.darkRed=m.door;
  const doorGeometry=(kind,w,h)=>{
    const key=kind+'_'+w.toFixed(5)+'_'+h.toFixed(5);
    if(!doorGeometryCache.has(key)){
      const geo=kind==='lattice'?palaceLatticeGeometry(w,h,{pitch:.225,bar:.016,depth:.046}):kind==='cartouche'?palaceCartoucheGeometry(w,h,.011,.014):palaceRosetteGeometry(w,.010,.013);
      geo.name='Palace_'+key;geo.userData.doorDetail=kind;
      if(kind==='lattice'){
        // Retain both sides of the web in the bounded CPU renderer. The old
        // area-based budget kept the larger diamond nodes but dropped their
        // slender joining faces. This partitions the real geometry: no extra
        // overlay, no coplanar duplicate and no opaque replacement picture.
        const front={position:[],normal:[],uv:[]},rest={position:[],normal:[],uv:[]};
        const pos=geo.attributes.position,norm=geo.attributes.normal;
        for(let i=0;i<pos.count;i+=3){
          const target=Math.abs(norm.getZ(i))>.999&&Math.abs(norm.getZ(i+1))>.999&&Math.abs(norm.getZ(i+2))>.999?front:rest;
          for(const name of['position','normal','uv']){
            const attr=geo.attributes[name];
            for(let j=0;j<3;j++)for(let k=0;k<attr.itemSize;k++)target[name].push(attr.array[(i+j)*attr.itemSize+k]);
          }
        }
        const cap=new THREE.BufferGeometry();cap.name=geo.name+'_Outward_Web';
        for(const[name,size]of[['position',3],['normal',3],['uv',2]]){
          cap.setAttribute(name,new THREE.Float32BufferAttribute(front[name],size));
          geo.setAttribute(name,new THREE.Float32BufferAttribute(rest[name],size));
        }
        geo.clearGroups();geo.userData.frontCapSeparated=true;
        cap.userData={doorDetail:'lattice-front-web',retainDoorFrontFace:true,sourceLatticeName:geo.name,sharedInteriorExterior:true,frontAndBackFaces:true};
        latticeFrontCaps.set(geo.name,cap);
      }
      doorGeometryCache.set(key,geo);
    }
    return doorGeometryCache.get(key);
  };
  const lowerFaces=[
    {id:'east',axis:'x',side:1,at:FRAME.lower.wallX,half:FRAME.lower.wallZ,columnsAt:FRAME.lower.outerColumnX,entrance:true,
      posts:FRAME.lower.postStationsLong.filter(u=>Math.abs(Math.abs(u)-4.9)>1e-6),
      // Screen divisions remain independent from the restored ±7.35 porch
      // columns; this keeps the existing gate-side joinery stations intact.
      screenStations:FRAME.lower.postStationsLong.filter(u=>Math.abs(Math.abs(u)-7.35)>1e-6),
      eaveTransferStations:[-7.35,7.35]},
    {id:'west',axis:'x',side:-1,at:FRAME.lower.wallX,half:FRAME.lower.wallZ,columnsAt:FRAME.lower.outerColumnX,
      posts:FRAME.lower.postStationsLong.filter(u=>Math.abs(Math.abs(u)-4.9)>1e-6),
      // Rear screen bays keep their original joinery grid after these shafts
      // are removed; the eave transfer stations remain independent of posts.
      screenStations:FRAME.lower.postStationsLong,eaveTransferStations:[-4.9,4.9]},
    {id:'south',axis:'z',side:1,at:FRAME.lower.wallZ,half:FRAME.lower.wallX,columnsAt:FRAME.lower.outerColumnZ,posts:FRAME.lower.postStationsShort},
    {id:'north',axis:'z',side:-1,at:FRAME.lower.wallZ,half:FRAME.lower.wallX,columnsAt:FRAME.lower.outerColumnZ,posts:FRAME.lower.postStationsShort},
  ];
  const upperFaces=[
    {id:'east',axis:'x',side:1,at:FRAME.upper.wallX,half:FRAME.upper.wallZ,posts:FRAME.columns.z},
    {id:'west',axis:'x',side:-1,at:FRAME.upper.wallX,half:FRAME.upper.wallZ,posts:FRAME.columns.z},
    {id:'south',axis:'z',side:1,at:FRAME.upper.wallZ,half:FRAME.upper.wallX,posts:FRAME.columns.x},
    {id:'north',axis:'z',side:-1,at:FRAME.upper.wallZ,half:FRAME.upper.wallX,posts:FRAME.columns.x},
  ];
  let leaves=0,lowerLeaves=0,upperLeaves=0;
  const base=columnBaseGeometry(),spandrel=curvedSpandrel();
  function facade(face,b,sb,level){
    const point=(u,y,n=0)=>face.axis==='x'?[face.side*(face.at+n),y,u]:[u,y,face.side*(face.at+n)];
    const box=(mat,u,y,n,w,h,d)=>b.box(mat,point(u,y,n),face.axis==='x'?[d,h,w]:[w,h,d]);
    const structural=(id,kind,geometry,mat,position,scale,rotation=[0,0,0],extra={})=>{
      const ref=sb.add(geometry,mat,position,scale,rotation);
      if(!geometry.boundingBox)geometry.computeBoundingBox();
      const bounds=geometry.boundingBox.clone().applyMatrix4(ref.matrix);
      const record={id:`v7-${level}-${face.id}-${id}`,kind,level,face:face.id,meshName:ref.meshName,instanceIndex:ref.instanceIndex,
        bounds:{minX:bounds.min.x,maxX:bounds.max.x,minY:bounds.min.y,maxY:bounds.max.y,minZ:bounds.min.z,maxZ:bounds.max.z},...extra};
      supportConnections.push(record);return record;
    };
    const supportBox=(id,kind,mat,u,y,n,w,h,d,extra={})=>structural(id,kind,sb.boxGeometry,mat,point(u,y,n),face.axis==='x'?[d,h,w]:[w,h,d],[0,0,0],extra);
    const supportRod=(id,kind,mat,a,z,thickness=.28,extra={})=>{
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...z),length=start.distanceTo(end);
      const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize()));
      return structural(id,kind,sb.boxGeometry,mat,start.add(end).multiplyScalar(.5).toArray(),[thickness,length,thickness],[rotation.x,rotation.y,rotation.z],extra);
    };
    const segmentedHeader=(id,kind,mat,y,n,width,height,depth,stations,passages=[])=>{
      const cuts=[-width/2,...stations.filter(u=>u>-width/2+1e-6&&u<width/2-1e-6),width/2];
      const records=[];
      for(let i=0;i<cuts.length-1;i++){
        const startPassage=passages.find(u=>Math.abs(u-cuts[i])<1e-6),endPassage=passages.find(u=>Math.abs(u-cuts[i+1])<1e-6);
        const lo=cuts[i]+(startPassage===undefined?0:FRAME.groundTransfers.mainWidth/2),hi=cuts[i+1]-(endPassage===undefined?0:FRAME.groundTransfers.mainWidth/2);
        records.push(supportBox(`${id}-section-${i}`,kind,mat,(lo+hi)/2,y,n,hi-lo,height,depth,{timberRole:'eaves-bay-timber',primaryRoofCarrier:true,bayIndex:i,spanStart:lo,spanEnd:hi,bandCenterY:y,runId:`v10-${level}-${face.id}-${id}`,timberLength:hi-lo,transferStart:startPassage,transferEnd:endPassage}));
      }
      return records;
    };
    const paintedPanel=(u,y,n,w,h,backingKind=null)=>{
      // One physical paint face spans the complete header, including former
      // inter-cartouche gaps. UVs repeat at the source aspect; no stretched
      // dragon, detached picture frame, or blank diamond spacer remains.
      const key=`${w.toFixed(5)}/${h.toFixed(5)}/${detailAspect}`;
      if(!friezeGeometryCache.has(key))friezeGeometryCache.set(key,continuousFriezeGeometry(w,h,{aspect:detailAspect}));
      const geometry=friezeGeometryCache.get(key);
      const rotation=[0,face.axis==='x'?face.side*Math.PI/2:face.side<0?Math.PI:0,0];
      const ref=b.add(geometry,m.paint,point(u,y,n),[w,h,1],rotation);
      paintPanels.push({level,face:face.id,center:point(u,y,n),width:w,height:h,
        sourceAspect:detailAspect,continuous:true,backingKind,bandCenterY:y,uvStart:geometry.userData.uvStart,uvEnd:geometry.userData.uvEnd,
        spanStart:u-w/2,spanEnd:u+w/2,meshName:ref.meshName,instanceIndex:ref.instanceIndex});
      for(const yy of[y-h/2-.012,y+h/2+.012])box(m.gold,u,yy,n+.004,w,.022,.018);
    };
    const roofBearing=(surface,lo,hi,tailNormal,bracketNormal,bearingBottom,bearingUs,maxPitch=1.12)=>{
      const count=Math.ceil((hi-lo)/maxPitch),pitch=(hi-lo)/count;
      const purlinDepth=level===1?.16:.28,rafterBottomOffset=level===1?.34:.445;
      const bearingTop=u=>{const p=point(u,0,tailNormal);return surface(p[0],p[2])-rafterBottomOffset;};
      for(let i=0;i<count;i++){
        const u0=lo+i*pitch,u1=u0+pitch,cu=(u0+u1)/2,y0=bearingTop(u0),y1=bearingTop(u1);
        // The purlin top seats the existing roof-rafter tail (radius .061 m),
        // .225 m below the timber shell. Short chords follow the real roof.
        supportRod(`rafter-purlin-${i}`,'roof-rafter-bearing-purlin',m.blue,point(u0,y0-purlinDepth/2,tailNormal),point(u1,y1-purlinDepth/2,tailNormal),purlinDepth,{roofTier:level===1?'lower':'upper',rafterBottomAtEnds:[y0-(level===1?.001:.006),y1-(level===1?.001:.006)]});
      }
      for(const [i,u] of bearingUs.entries()){
        // Bearing blocks follow the actual bracket centres, not the midpoint
        // of the independently tessellated purlin segments.
        const top=bearingTop(u)-purlinDepth+.014,bottom=bearingBottom;
        if(top>bottom)supportBox(`bearing-block-${i}`,'seated-roof-bearing-block',m.red,u,(top+bottom)/2,bracketNormal,.32,top-bottom,level===1?1.04:.55,{bearingBottom:bottom,bearingTop:top,bracketCenterU:u});
      }
    };

    const wall=(id,lo,hi,y0,y1)=>{
      const p=point(lo,y0,-.18),q=point(hi,y1,.24);
      obstacles.push({id:`v6-${level}-${face.id}-${id}`,type:'exteriorWall',minX:Math.min(p[0],q[0]),maxX:Math.max(p[0],q[0]),minZ:Math.min(p[2],q[2]),maxZ:Math.max(p[2],q[2]),minY:y0,maxY:y1});
    };
    const panel=(u0,u1,bottom,top)=>{
      const width=u1-u0,count=Math.max(1,Math.round(width/1.03)),pitch=width/count;
      const rotation=[0,face.axis==='x'?face.side*Math.PI/2:face.side<0?Math.PI:0,0];
      for(let i=0;i<count;i++){
        const u=u0+(i+.5)*pitch,w=pitch-.028,skirt=level===1?1.10:.13,waist=level===1?.20:0;
        const lower=bottom+skirt+waist+.0365,upper=top-(level===1?.5265:.0765),cy=(lower+upper)/2;
        // The whole wood leaf is one dark-red finish. Frame, recessed skirt,
        // waist and true pierced timber lattice differ only in geometry.
        box(m.door,u,bottom+skirt/2,.065,w-.10,skirt-.05,.13);
        if(level===1)box(m.door,u,bottom+skirt+waist/2,.065,w-.10,waist-.055,.13);
        for(const side of[-1,1]){
          box(m.door,u+side*(w/2-.037),(bottom+top)/2,.11,.074,top-bottom,.14);
          box(m.gold,u+side*(w/2-.073),(bottom+top)/2,.186,.009,top-bottom-.12,.012);
        }
        const rails=[bottom+.04,bottom+skirt,bottom+skirt+waist,top-.04];
        if(level===1)rails.push(top-.49);
        for(const y of new Set(rails)){box(m.door,u,y,.11,w,.075,.14);box(m.gold,u,y,.187,w-.14,.009,.012);}
        const fields=[[cy,upper-lower,'main']];
        if(level===1)fields.push([top-.265,.376,'transom']);
        const record={level,face:face.id,center:point(u,(bottom+top)/2,.11),width:w,height:top-bottom,fields:[],skirt:{bottom,top:bottom+skirt},woodColor:'#762c27',sharedInteriorExterior:true,opaqueBacking:false,normal:face.axis==='x'?[face.side,0,0]:[0,0,face.side]};
        for(const[y,h,kind]of fields){
          const geo=doorGeometry('lattice',w-.145,h),ref=b.add(geo,m.door,point(u,y,.125),[1,1,1],rotation);
          const front=latticeFrontCaps.get(geo.name),capRef=b.add(front,m.door,point(u,y,.125),[1,1,1],rotation);
          record.fields.push({kind,meshName:ref.meshName,instanceIndex:ref.instanceIndex,frontCapMeshName:capRef.meshName,frontCapInstanceIndex:capRef.instanceIndex,width:w-.145,height:h,...geo.userData});
          for(const sign of[-1,1])box(m.gold,u+sign*(w/2-.087),y,.153,.009,h+.017,.010);
          for(const yy of[y-h/2,y+h/2])box(m.gold,u,yy,.153,w-.164,.009,.010);
          // A pair of simple ruyi corner returns, rather than gilding every bar.
          for(const sign of[-1,1])for(const sy of[-1,1]){
            const ux=u+sign*(w/2-.037),yy=y+sy*(h/2+.035),len=Math.min(.12,(w-.20)*.20);
            b.rod(m.gold,point(ux,yy,.185),point(ux-sign*len,yy,.185),.009,.010);
            b.rod(m.gold,point(ux,yy,.185),point(ux,yy-sy*len,.185),.009,.010);
          }
        }
        if(level===1){
          const skirtY=bottom+skirt/2;
          b.add(doorGeometry('cartouche',w-.22,skirt-.25),m.gold,point(u,skirtY,.139),[1,1,1],rotation);
          b.add(doorGeometry('rosette',Math.min(.22,(w-.28)*.32),0),m.gold,point(u,skirtY,.1365),[1,1,1],rotation);
          for(let k=0;k<8;k++){
            const a=k*Math.PI/4;const r=Math.min(.22,(w-.28)*.32);
            b.rod(m.gold,point(u+Math.cos(a)*r*.36,skirtY+Math.sin(a)*r*.36,.135),point(u+Math.cos(a)*r*.78,skirtY+Math.sin(a)*r*.78,.135),.008,.010);
          }
          // Ring-pull backplate is physically fixed to the waist, not painted.
          box(m.gold,u,bottom+skirt+waist/2,.139,.050,.086,.018);
        }
        screenPanels.push(record);leaves++;if(level===1)lowerLeaves++;else upperLeaves++;
      }
    };
    if(level===1){
      const {centerY:beamY,bottomY:beamBottom,topY:beamTop,height:beamHeight}=FRAME.groundBeam;
      const receiverHalf=face.axis==='x'?FRAME.lower.wallZ+FRAME.lower.headerOffset+FRAME.lower.headerDepth/2:FRAME.lower.innerX;
      const frameConnection=(upper,lower,type,axis='y',extra={})=>groundFrameConnections.push({id:`ground-frame-${groundFrameConnections.length+1}`,type,upperId:upper.id,lowerId:lower.id,axis,...extra});
      const primaryUs=face.axis==='x'?FRAME.columns.z:FRAME.columns.x;
      const primaryWidth=FRAME.groundTransfers.mainWidth,tangentAxis=face.axis==='x'?'z':'x';
      const secondaryUs=face.posts.filter(u=>Math.abs(u)<face.half-.2&&!primaryUs.some(p=>Math.abs(p-u)<1e-6));
      const zones=[...primaryUs.map(u=>({u,half:primaryWidth/2,primary:true})),...secondaryUs.map(u=>({u,half:.22,primary:false}))].sort((a,b)=>a.u-b.u);
      const receivers=[],headerNodes=new Map();
      const headerPart=(id,lo,hi,bottom=beamBottom,extra={})=>{
        const r=supportBox(id,'continuous-wall-header',m.red,(lo+hi)/2,(bottom+beamTop)/2,FRAME.lower.headerOffset,hi-lo,beamTop-bottom,FRAME.lower.headerDepth,
          {sharedFrame:true,normalAxis:face.axis,side:face.side,spanStart:lo,spanEnd:hi,receiverInnerNormal:face.at+FRAME.lower.headerOffset-FRAME.lower.headerDepth/2,timberRole:'screen-head-secondary-frame',primaryRoofCarrier:false,...extra});receivers.push(r);return r;
      };
      // Door/window framing and the light ceiling are secondary work. The
      // 22 primary timbers run directly from an inner column to an aligned
      // eaves column; this wall line contains real, full-height passages for
      // them. Its short members tenon into those actual passing beams.
      for(const zone of zones)if(!zone.primary)headerNodes.set(zone.u,headerPart(`wall-header-node-${zone.u}`,zone.u-zone.half,zone.u+zone.half,beamBottom,{jointNode:true}));
      let edge=-receiverHalf,bay=0;
      for(const zone of [...zones,{u:receiverHalf,half:0}]){
        const end=zone.u-zone.half,cuts=[edge,...(face.entrance?[-2.60,2.60].filter(u=>u>edge+1e-7&&u<end-1e-7):[]),end];
        for(let j=0;j<cuts.length-1;j++)if(cuts[j+1]-cuts[j]>.001){
          const lo=cuts[j],hi=cuts[j+1],entryMiddle=face.entrance&&Math.abs(lo+2.60)<1e-6&&Math.abs(hi-2.60)<1e-6;
          headerPart(entryMiddle?'wall-top-beam-1':`wall-header-bay-${bay}-${j}`,lo,hi,entryMiddle?5.39:beamBottom,{bayIndex:bay,gateNotch:entryMiddle});
        }
        edge=zone.u+zone.half;bay++;
      }
      receivers.sort((a,b)=>a.spanStart-b.spanStart);
      const wallTenon=(id,source,edge,direction,extra={})=>supportBox(id,'ground-header-tenon',m.wood,edge+direction*.05,beamY,FRAME.lower.headerOffset,.10,.24,.18,{headerId:source.id,...extra});
      for(const zone of zones){
        const neighbours=[...receivers.filter(r=>Math.abs(r.spanEnd-(zone.u-zone.half))<1e-6).map(r=>({r,edge:r.spanEnd,direction:1})),...receivers.filter(r=>Math.abs(r.spanStart-(zone.u+zone.half))<1e-6).map(r=>({r,edge:r.spanStart,direction:-1}))];
        const targetBeamId=`unified-primary-${face.axis}-${face.side}-${zone.u}`;
        const socket=zone.primary?{face:face.id,axis:face.axis,side:face.side,u:zone.u,width:primaryWidth,normalCenter:face.side*(face.at+FRAME.lower.headerOffset),targetBeamId,headerIds:[],tenons:[]}:null;
        for(const {r,edge,direction}of neighbours){
          const host=zone.primary?null:headerNodes.get(zone.u);
          const tenon=wallTenon(`wall-segment-tenon-${zone.u}-${direction}`,r,edge,direction,zone.primary?{targetBeamId,normalAxis:face.axis,side:face.side,station:zone.u,headerEnd:direction>0?'max':'min'}:{hostId:host.id});
          if(socket){socket.headerIds.push(r.id);socket.tenons.push(tenon);}else frameConnection(r,host,'housed-secondary-wall-node',tangentAxis,{tenonId:tenon.id,tenonDepth:.10});
        }
        if(socket)groundWallBeamSockets.push(socket);
      }
      // The gate's central member is not a second transom over the old one:
      // its 5.39 m underside meets the existing gate lintel. Adjacent timber
      // pieces have real short scarf joints, without a 62 m single beam.
      for(let i=0;i<receivers.length-1;i++){
        const left=receivers[i],right=receivers[i+1];
        if(Math.abs(left.spanEnd-right.spanStart)>1e-6||left.jointNode||right.jointNode)continue;
        const tenon=wallTenon(`wall-scarf-tenon-${i}`,left,left.spanEnd,1,{hostId:right.id});
        frameConnection(left,right,'housed-common-header-scarf',tangentAxis,{tenonId:tenon.id,tenonDepth:.10});
      }
      // X faces run through the corners; Z faces end at those inner faces.
      // These secondary wall members are supported by the timber frame,
      // never by treating a 200 mm screen jamb as a main building column.
      if(face.axis==='z')for(const side of[-1,1]){
        const source=side<0?receivers[0]:receivers.at(-1);
        const tenon=supportBox(`receiver-corner-tenon-${side}`,'ground-header-tenon',m.wood,side*(FRAME.lower.innerX+.08),beamY,FRAME.lower.headerOffset,.16,.24,.18,{sourceId:source.id,cornerReceiverFace:side<0?'west':'east'});
        groundFrameConnections.push({id:`ground-frame-${groundFrameConnections.length+1}`,type:'housed-common-wall-corner',upperId:source.id,lowerId:null,axis:'x',tenonId:tenon.id,tenonDepth:.16,targetFace:side<0?'west':'east',targetU:face.side*(face.at+FRAME.lower.headerOffset)});
      }
      const blockingDepth=.14,outerNormal=FRAME.lower.headerOffset+FRAME.lower.headerDepth/2;
      const blockingHalf=face.axis==='x'?FRAME.lower.wallZ+outerNormal:FRAME.lower.wallX+outerNormal-blockingDepth;
      const blocks=[],caps=[],blockingCount=Math.ceil(blockingHalf*2/2.4);
      for(let i=0;i<blockingCount;i++){
        const lo=-blockingHalf+i*blockingHalf*2/blockingCount,hi=-blockingHalf+(i+1)*blockingHalf*2/blockingCount;
        blocks.push(supportBox(`wall-ceiling-edge-blocking-${i}`,'wall-ceiling-edge-blocking',m.wood,(lo+hi)/2,(beamTop+FRAME.gallery.bottomY)/2,outerNormal-blockingDepth/2,hi-lo,FRAME.gallery.bottomY-beamTop,blockingDepth,{sharedFrame:true,spanStart:lo,spanEnd:hi,timberRole:'light-ceiling-edge-blocking',primaryRoofCarrier:false}));
      }
      const capCount=Math.ceil(receiverHalf*2/2.4);
      for(let i=0;i<capCount;i++){
        const lo=-receiverHalf+i*receiverHalf*2/capCount,hi=-receiverHalf+(i+1)*receiverHalf*2/capCount;
        caps.push(supportBox(`wall-ceiling-edge-cap-${i}`,'wall-ceiling-edge-cap',m.wood,(lo+hi)/2,FRAME.gallery.bottomY+FRAME.lowerAisleCeiling.thickness/2,FRAME.lower.headerOffset,hi-lo,FRAME.lowerAisleCeiling.thickness,FRAME.lower.headerDepth,{sharedFrame:true,spanStart:lo,spanEnd:hi,timberRole:'light-ceiling-edge-board',primaryRoofCarrier:false}));
      }
      for(const cap of caps)for(const block of blocks)if(Math.min(cap.spanEnd,block.spanEnd)>Math.max(cap.spanStart,block.spanStart)+1e-6)frameConnection(cap,block,'wall-ceiling-bearing');
      for(const block of blocks)for(const header of receivers)if(Math.min(block.spanEnd,header.spanEnd)>Math.max(block.spanStart,header.spanStart)+1e-6)frameConnection(block,header,'wall-ceiling-bearing');
      // The two entry-adjacent jambs now abut the actual gate-frame outer
      // edges at U=±2.60; the former overlapping return posts are removed.
      const spans=face.entrance?[[-face.half,-2.70],[2.70,face.half]]:[[-face.half,face.half]];
      for(const[lo,hi]of spans){
        box(m.door,(lo+hi)/2,.34,0,hi-lo,.68,.25);box(m.stone,(lo+hi)/2,.075,.03,hi-lo,.15,.34);
        box(m.wood,(lo+hi)/2,.72,.025,hi-lo,.10,.29);
        // The pierced leaf is the enclosure. No black backing board, inner
        // duplicate wall, paper plane or glass closes these real openings.
        wall('screens',lo,hi,0,FRAME.gallery.bottomY+FRAME.lowerAisleCeiling.thickness);
        const divisions=[lo,...(face.screenStations??face.posts).filter(p=>p>lo+.2&&p<hi-.2),hi];
        for(let j=0;j<divisions.length-1;j++)panel(divisions[j]+.10,divisions[j+1]-.10,.79,beamBottom);
        for(const u of divisions){
          supportBox(`screen-post-${u}`,'fixed-screen-jamb',m.door,u,(.34+beamBottom)/2,.04,.20,beamBottom-.34,.28,{timberRole:'screen-joinery',primaryRoofCarrier:false});
        }
      }
      if(face.entrance){
        wall('entry-receiver',-2.60,2.60,5.39,FRAME.gallery.bottomY+FRAME.lowerAisleCeiling.thickness);
      }
      const colNormal=face.columnsAt-face.at,length=face.posts.at(-1)-face.posts[0];
      const headerWidth=length+.96;
      const eaveStations=[...new Set([...face.posts,...(face.eaveTransferStations??[])])].sort((a,b)=>a-b);
      const eaveLower=segmentedHeader('lower-colonnade-beam','continuous-colonnade-beam',m.blue,5.62,colNormal,headerWidth,.62,.47,eaveStations,face.eaveTransferStations);
      const eaveFilling=segmentedHeader('colonnade-filling-beam','interlocking-header-fillet',m.green,5.935,colNormal,headerWidth,.01,.48,eaveStations);
      const eaveUpper=segmentedHeader('upper-colonnade-beam','continuous-colonnade-header',m.blue,6.035,colNormal,headerWidth,.19,.49,eaveStations);
      const eaveSeat=segmentedHeader('bracket-seat-plate','continuous-bracket-seat',m.green,6.145,colNormal+.10,headerWidth,.03,.52,eaveStations);
      if(face.eaveTransferStations)for(const[upper,lower]of[[eaveFilling,eaveLower],[eaveUpper,eaveFilling],[eaveSeat,eaveUpper]])for(const a of upper)for(const b of lower){
        if(Math.min(a.spanEnd,b.spanEnd)>Math.max(a.spanStart,b.spanStart)+1e-6)frameConnection(a,b,'seated-eave-band-bearing');
      }
      paintedPanel(0,5.62,colNormal+.237,headerWidth,.56,'continuous-colonnade-beam');
      paintedPanel(0,6.035,colNormal+.247,headerWidth,.16,'continuous-colonnade-header');
      for(const u of face.posts){
        const p=point(u,0,colNormal),key=p[0].toFixed(3)+'/'+p[2].toFixed(3);
        if(registry.has(key))continue;registry.add(key);
        const plinth=structural(`column-base-${u}`,'column-plinth',base,m.stone,[p[0],0,p[2]],[1,1,1]);
        const shaft=structural(`column-shaft-${u}`,'load-bearing-round-column',sb.columnGeometry,m.column,[p[0],3.15,p[2]],[.47,5.70,.47]);
        const neck=structural(`column-neck-${u}`,'column-neck-bearing',sb.cylinderGeometry,m.red,[p[0],6.02,p[2]],[.44,.10,.44]);
        const capital=structural(`column-capital-${u}`,'column-capital',sb.boxGeometry,m.red,[p[0],6.11,p[2]],[.97,.08,.97]);
        frameConnection(shaft,plinth,'outer-column-bearing');
        frameConnection(neck,shaft,'housed-column-neck-collar',face.axis);
        frameConnection(capital,neck,'housed-column-capital-collar',face.axis);
        for(const section of eaveLower.filter(r=>u>=r.spanStart-1e-6&&u<=r.spanEnd+1e-6))frameConnection(section,shaft,'housed-eave-fang-to-column',tangentAxis,{jointAtColumnAxis:u});
        for(const section of eaveUpper.filter(r=>u>=r.spanStart-1e-6&&u<=r.spanEnd+1e-6))frameConnection(section,capital,'housed-eave-fang-to-capital',tangentAxis,{jointAtColumnAxis:u});
        const primaryStation=primaryUs.some(q=>Math.abs(q-u)<1e-6);
        if(primaryStation)groundColumnCarriers.push({face:face.id,axis:face.axis,side:face.side,u,shaftId:shaft.id,plinthId:plinth.id,shaft,bodyEndNormal:face.side*(face.columnsAt-.30),targetBeamId:`unified-primary-${face.axis}-${face.side}-${u}`});
        // The 22 main bays are now one uninterrupted column-to-column beam
        // built by architecture-v7.js. Only the other 13 short supports are
        // retained here, carrying screen heads and the light ceiling. They
        // are not labelled as primary roof timbers or as through-column ties.
        if(Math.abs(u)<face.half-.2&&!primaryStation){
          const header=receivers.find(r=>u>=r.spanStart+.14&&u<=r.spanEnd-.14);
          if(!header)throw new Error(`Missing shared wall receiver for ${face.id}/${u}`);
          const start=face.at+FRAME.lower.headerOffset+FRAME.lower.headerDepth/2,end=face.columnsAt-.30;
          const tie=supportBox(`ground-portico-tie-${u}`,'ground-wall-to-colonnade-tie-beam',m.red,u,beamY,(start+end)/2-face.at,.28,beamHeight,end-start,{sharedFrame:true,headerId:header.id,shaftId:shaft.id,normalAxis:face.axis,side:face.side,timberRole:'secondary-screen-and-light-ceiling-support',primaryRoofCarrier:false});
          const wallTenon=supportBox(`ground-portico-wall-tenon-${u}`,'ground-portico-tenon',m.wood,u,beamY,start-.08-face.at,.18,.24,.16,{hostId:header.id});
          const shaftTenon=supportBox(`ground-portico-column-tenon-${u}`,'ground-portico-tenon',m.wood,u,beamY,end+.08-face.at,.18,.24,.16,{hostId:shaft.id});
          frameConnection(tie,header,'housed-ground-frame-joint',face.axis,{tenonId:wallTenon.id,tenonDepth:.16});
          frameConnection(tie,shaft,'housed-round-column-joint',face.axis,{tenonId:shaftTenon.id,tenonDepth:.16,housedBodyChord:.30});
        }
        const fp={id:'outer-column-'+columnFootprints.length,x:p[0],z:p[2],y:0,radius:.64,shaftRadius:.47,baseRadius:.64,baseHeight:.30,minY:0,maxY:6.15};columnFootprints.push(fp);
        obstacles.push({id:fp.id+'-base',type:'columnBase',minX:p[0]-.64,maxX:p[0]+.64,minZ:p[2]-.64,maxZ:p[2]+.64,minY:0,maxY:.30});
        obstacles.push({id:fp.id,type:'column',minX:p[0]-.47,maxX:p[0]+.47,minZ:p[2]-.47,maxZ:p[2]+.47,minY:.30,maxY:6.15});
        for(const sign of[-1,1]){
          // Local +X follows increasing bay coordinate on both elevations.
          // The former +90° turn on X faces pointed both spandrels through
          // the column centre; -90° seats them on its two outward shoulders.
          const rot=face.axis==='x'?[0,-Math.PI/2,0]:[0,0,0];
          structural(`spandrel-${u}-${sign}`,'seated-carved-spandrel',spandrel,m.blue,point(u+sign*.42,5.45,colNormal+.015),[sign*.72,.72,1],rot);
          b.rod(m.gold,point(u+sign*.45,5.41,colNormal+.095),point(u+sign*1.17,5.31,colNormal+.095),.027,.025);
        }
      }
      const bracketUs=palaceBayStations(eaveStations);
      for(const [i,u] of bracketUs.entries()){
        for(let tier=0;tier<3;tier++){
          const yy=6.195+tier*.055,nn=colNormal+.10+tier*.16,ww=.42+tier*.22;
          supportBox(`bracket-${i}-${tier}`,'interlocking-dougong-block',tier%2?m.green:m.blue,u,yy,nn,ww,.06,.32);
          supportBox(`bracket-arm-${i}-${tier}`,'interlocking-dougong-arm',m.red,u,yy+.025,nn+.10,.14,.04,.66+tier*.10);
          for(const side of[-1,1])box(m.gold,u+side*(ww/2-.05),yy+.047,nn+.16,.085,.012,.10);
        }
      }
      roofBearing(lowerRoofSurfaceHeight,face.posts[0],face.posts.at(-1),colNormal-.05,colNormal+.30,6.35,bracketUs);
    }else{
      const windowBottom=7.10,windowTop=upperLocalYV15(12.97),stileTop=upperLocalYV15(13.95);
      const shaftBottom=.30,shaftTop=upperLocalYV15(14.12);
      // A low solid dado is followed by one and the same pierced window from
      // either side. The old 5.14 m opaque wall and black upper backing have
      // been removed; daylight now crosses the actual lattice openings.
      box(m.door,0,6.645,.065,face.half*2,.69,.13);
      supportBox('upper-sill','continuous-upper-screen-sill',m.door,0,7.045,.04,face.half*2,.11,.34);
      wall('upper-wall',-face.half,face.half,6.3,upperLocalYV15(14.15));
      supportBox('frieze-lower-rail','upper-frieze-lower-rail',m.red,0,upperLocalYV15(13.015),.02,face.half*2,.09,.37);
      segmentedHeader('upper-frieze-body','continuous-upper-frieze-beam',m.blue,upperLocalYV15(13.49),.02,face.half*2,.90,.37,face.posts);
      for(let j=0;j<face.posts.length-1;j++){
        const lo=face.posts[j]+.19,hi=face.posts[j+1]-.19;
        panel(lo,hi,windowBottom,windowTop);

      }
      // The shared structural corner axes are inset from the screen plane.
      // Short solid corner returns close the remaining 250 mm of joinery;
      // neither elevation receives a hidden full wall behind its lights.
      for(const side of[-1,1])box(m.door,side*(face.half-.125),(windowBottom+windowTop)/2,.11,.25,windowTop-windowBottom,face.axis==='x'?.18:.16);
      paintedPanel(0,upperLocalYV15(13.49),.206,face.half*2,.84,'continuous-upper-frieze-beam');
      for(const u of face.posts){
        const postU=THREE.MathUtils.clamp(u,-face.half+.42,face.half-.42),p=point(postU,6.3,-.42);
        const key=p[0].toFixed(3)+'/'+p[2].toFixed(3);
        const removedCrossGalleryPost=face.axis==='x'&&Math.abs(Math.abs(postU)-7.35)<1e-6;
        if(!removedCrossGalleryPost&&!upperRegistry.has(key)){
          upperRegistry.add(key);
          const r=FRAME.columns.shaftRadius,br=FRAME.columns.baseRadius;
          const plinth=structural(`continuous-column-base-${postU}`,'continuous-perimeter-column-plinth',base,m.stone,[p[0],0,p[2]],[br/.64,1,br/.64],[0,0,0],{continuous:true,radius:br,floorBearingY:0});
          const record=structural(`upper-full-post-${postU}`,'floor-to-roof-upper-post',sb.columnGeometry,m.column,[p[0],(shaftBottom+shaftTop)/2,p[2]],[r,shaftTop-shaftBottom,r],[0,0,0],{floorBearingY:0,rimBeamLine:face.axis==='x'?17.73:25.73,continuous:true,radius:r,baseId:plinth.id,shaftBottomY:.30,shaftTopY:upperLocalYV15(14.12)});
          const fp={id:'upper-exterior-post-'+upperColumnFootprints.length,x:p[0],z:p[2],y:0,radius:r,baseRadius:br,minY:.30,maxY:upperLocalYV15(14.12),continuous:true,baseId:plinth.id,bounds:record.bounds};upperColumnFootprints.push(fp);
          obstacles.push({id:fp.id,type:'column',...record.bounds});
          obstacles.push({id:fp.id+'-base',type:'columnBase',...plinth.bounds});
        }
        // The outer screen stile is attached to the full post by solid cross
        // members at the sill and the roof header, not suspended above it.
        supportBox(`upper-face-stile-${u}`,'attached-upper-screen-stile',m.door,u,(windowBottom+stileTop)/2,.11,.34,stileTop-windowBottom,.18,{timberRole:'shared-window-jamb',primaryRoofCarrier:false});
        for(const y of(removedCrossGalleryPost?[upperLocalYV15(13.98)]:[7.045,upperLocalYV15(13.98)]))supportRod(`upper-cross-tie-${u}-${y}`,'upper-post-to-facade-tie',m.red,point(postU,y,-.08),point(u,y,.23),.28,{sharedFrame:true,primaryRoofCarrier:false});
      }
      segmentedHeader('upper-top-header','continuous-upper-roof-header',m.blue,upperLocalYV15(14.065),.02,face.half*2,.25,.37,face.posts);
      segmentedHeader('upper-bracket-seat','continuous-upper-bracket-seat',m.green,upperLocalYV15(14.205),.10,face.half*2,.05,.42,face.posts);
      const bracketUs=palaceBayStations(face.posts);
      for(const [i,u] of bracketUs.entries()){
        for(let tier=0;tier<2;tier++){
          supportBox(`upper-bracket-${i}-${tier}`,'upper-interlocking-dougong',tier?m.green:m.blue,u,upperLocalYV15(14.28)+tier*.18,.16+tier*.20,.42+tier*.22,.12,.35);
          supportBox(`upper-bracket-arm-${i}-${tier}`,'upper-dougong-cross-arm',m.red,u,upperLocalYV15(14.35)+tier*.18,.26+tier*.20,.14,.10,.48);
          box(m.gold,u,upperLocalYV15(14.35)+tier*.18,.34+tier*.20,.14,.025,.30);
        }
      }
      roofBearing(upperRoofSurfaceHeight,-face.half+.05,face.half-.05,face.axis==='x'?.10:.05,.22,upperLocalYV15(14.52),bracketUs);
    }
  }

  for(const face of lowerFaces)facade(face,lb,lsb,1);
  for(const face of upperFaces)facade(face,ub,usb,2);
  for(const connection of groundFrameConnections.filter(c=>c.type==='housed-common-wall-corner')){
    const host=supportConnections.find(r=>r.kind==='continuous-wall-header'&&r.face===connection.targetFace&&connection.targetU>=r.spanStart&&connection.targetU<=r.spanEnd);
    if(!host)throw new Error(`Missing actual shared corner receiver ${connection.targetFace}/${connection.targetU}`);
    connection.lowerId=host.id;
    const tenon=supportConnections.find(r=>r.id===connection.tenonId);tenon.hostId=host.id;
  }
  const exteriorInstances=lb.finish()+ub.finish()+lsb.finish()+usb.finish();
  const metadata={version:15,principalSide:'+X',principalWidth:62,storeys:2,lowerFootprint:{width:44,depth:62},upperFootprint:{width:36,depth:52},
    lowerWallX:21.85,lowerWallZ:30.85,upperWallX:18.15,upperWallZ:26.15,lowerColumnLineX:23.1,lowerColumnLineZ:32.1,
    columnCount:columnFootprints.length,lowerColumns:columnFootprints.length,columnStyle:'unified-round-vermilion-on-profiled-low-drum',columnFinish:'#942f29',columnBaseFamily:'closed-profiled-low-drum',removedSecondaryColumns:13,removedCrossGalleryColumns:4,removedEntranceColumns:2,removedRearColumns:2,columnBaseRadius:.64,columnShaftRadius:.47,
    doorWoodColor:'#762c27',screenStyle:'one-shared-pierced-octagonal-envelope',sharedInteriorExterior:true,opaqueWindowBackings:0,continuousPerimeterColumns:upperColumnFootprints.length,bracketSpacing:'shared-column-bays',latticeOpenings:screenPanels.reduce((n,p)=>n+p.fields.reduce((q,f)=>q+f.openingCount,0),0),
    windowLeaves:leaves,lowerWindowLeaves:lowerLeaves,upperWindowLeaves:upperLeaves,exteriorInstances,
    entryOpening:{minX:21.67,maxX:22.09,minZ:-2.30,maxZ:2.30,minY:0,maxY:5.17},
    structuralSupportMembers:supportConnections.length,upperSupportedPosts:upperColumnFootprints.length,paintedDetailPanels:paintPanels.length,continuousFriezeRuns:paintPanels.length,detailSourceAspect:detailAspect,
    commonGroundReceiverY:FRAME.groundBeam.centerY,groundFrameConnections:groundFrameConnections.length,groundPorticoTies:supportConnections.filter(r=>r.kind==='ground-wall-to-colonnade-tie-beam').length,
    primaryColumnCarriers:groundColumnCarriers.length,primaryWallPassages:groundWallBeamSockets.length,segmentedWallTimbers:supportConnections.filter(r=>r.kind==='continuous-wall-header').length,
    paintedHeaderTimbers:supportConnections.filter(r=>['continuous-colonnade-beam','continuous-colonnade-header','continuous-upper-frieze-beam'].includes(r.kind)).length,
    referenceFeatures:['unified-interior-exterior-frame','common-ground-wall-receiver','equal-mirrored-double-door','traditional-wenhuadian-plaque','continuous-supported-joinery','continuous-aspect-scaled-frieze','double-eave-stepped-massing','round-vermilion-colonnade','blue-green-gold-dragon-frieze','uniform-dark-red-fine-octagonal-screens','pale-low-column-bases','long-elevation-centred-entry']};
  group.userData={...metadata};return{group,lower,upper,metadata,columnFootprints,upperColumnFootprints,supportConnections,groundFrameConnections,groundWallBeamSockets,groundColumnCarriers,paintPanels,screenPanels,columns:columnFootprints,materials:m};
}
