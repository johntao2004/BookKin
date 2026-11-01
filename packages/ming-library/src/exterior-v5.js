import * as THREE from 'three';

/**
 * The reference-led red palace envelope. The 52 m elevation at +X is the
 * principal facade. All dimensions below are real geometry, not an image card.
 * The opening is intentionally left to entrance-v3.js for a clean joint.
 */
function texture(width,height,paint){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  paint(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;return map;
}

function paintedFrieze(){
  return texture(1536,256,(c,w,h)=>{
    c.fillStyle='#31584f';c.fillRect(0,0,w,h);
    c.fillStyle='#244047';c.fillRect(12,21,w-24,h-42);
    for(const [inset,color,line] of [[10,'#b5a06d',5],[22,'#d3b985',3],[30,'#638578',2]]){
      c.strokeStyle=color;c.lineWidth=line;c.strokeRect(inset,inset,w-2*inset,h-2*inset);
    }
    const field=(x0,x1)=>{
      const cy=h/2,bevel=38,pad=12;
      c.fillStyle='#395f53';c.beginPath();c.moveTo(x0+bevel,41);c.lineTo(x1-bevel,41);c.lineTo(x1-pad,75);c.lineTo(x1-pad,181);c.lineTo(x1-bevel,215);c.lineTo(x0+bevel,215);c.lineTo(x0+pad,181);c.lineTo(x0+pad,75);c.closePath();c.fill();
      c.strokeStyle='#c3af7b';c.lineWidth=3;c.stroke();
      c.strokeStyle='#809280';c.lineWidth=2;
      for(const sy of [-1,1]){
        c.beginPath();c.moveTo(x0+52,cy+sy*35);c.bezierCurveTo(x0+118,cy+sy*95,x0+176,cy-sy*60,x0+242,cy+sy*13);
        c.bezierCurveTo((x0+x1)/2,cy+sy*68,x1-120,cy-sy*46,x1-52,cy+sy*35);c.stroke();
      }
      const cx=(x0+x1)/2;
      c.strokeStyle='#cfb680';c.lineWidth=4;c.beginPath();
      for(let i=0;i<8;i++){const a=i*Math.PI/4,xx=cx+Math.cos(a)*65,yy=cy+Math.sin(a)*65;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();c.stroke();
      c.lineWidth=2;
      for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.ellipse(cx+Math.cos(a)*23,cy+Math.sin(a)*23,21,8,a,0,Math.PI*2);c.stroke();}
      c.fillStyle='#bda46b';c.beginPath();c.arc(cx,cy,9,0,Math.PI*2);c.fill();
    };
    field(48,w-48);
    for(const side of [-1,1])for(let j=0;j<3;j++){
      const x=side<0?33+j*10:w-33-j*10;c.strokeStyle=j%2?'#688b76':'#c0ac75';c.lineWidth=2;c.beginPath();c.moveTo(x,43);c.lineTo(x+side*10,67);c.lineTo(x+side*10,h-67);c.lineTo(x,h-43);c.stroke();
    }
  });
}

function stoneTexture(){
  return texture(1024,256,(c,w,h)=>{
    c.fillStyle='#b9b5a6';c.fillRect(0,0,w,h);
    for(let row=0;row<3;row++)for(let col=-1;col<9;col++){
      const x=col*128+(row%2)*64,y=row*h/3;
      const tint=174+((row*13+col*7+119)%15);c.fillStyle=`rgb(${tint+9},${tint+7},${tint-4})`;c.fillRect(x+2,y+1,125,h/3-2);
      c.strokeStyle='rgba(241,234,212,.34)';c.lineWidth=1;c.strokeRect(x+3,y+2,123,h/3-4);
    }
    for(let i=0;i<4200;i++){
      c.fillStyle=i%3?'rgba(62,62,48,.05)':'rgba(255,247,215,.11)';c.fillRect((i*117.21)%w,(i*53.73)%h,1.1,1.1);
    }
  });
}

class Batch{
  constructor(group){this.group=group;this.parts=new Map();this.boxGeometry=new THREE.BoxGeometry(1,1,1);this.cylinderGeometry=new THREE.CylinderGeometry(1,1,1,12);this.object=new THREE.Object3D();}
  add(geometry,material,position,scale,rotation=[0,0,0]){
    const key=geometry.uuid+'/'+material.uuid;if(!this.parts.has(key))this.parts.set(key,{geometry,material,matrices:[]});
    this.object.position.set(...position);this.object.scale.set(...scale);this.object.rotation.set(...rotation);this.object.updateMatrix();this.parts.get(key).matrices.push(this.object.matrix.clone());
  }
  box(material,position,scale,rotation){this.add(this.boxGeometry,material,position,scale,rotation);}
  rod(material,a,b,width=.034,depth=width){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),length=start.distanceTo(end);
    if(length<1e-5)return;
    const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize()));
    this.box(material,start.add(end).multiplyScalar(.5).toArray(),[width,length,depth],[rotation.x,rotation.y,rotation.z]);
  }
  finish(prefix){let count=0;for(const{geometry,material,matrices}of this.parts.values()){
    const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=prefix+'_'+material.name;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();this.group.add(mesh);count+=matrices.length;
  }return count;}
}

export function buildExteriorV5({envelope,roof,obstacles,roofSurfaceHeight}){
  const group=new THREE.Group();group.name='Reference_Red_Lattice_Palace_Envelope';envelope.add(group);
  const eaves=new THREE.Group();eaves.name='Painted_Eaves_And_Rafter_Ends';roof.add(eaves);
  const b=new Batch(group),eb=new Batch(eaves),frieze=paintedFrieze();
  const make=(name,color,options={})=>{const material=new THREE.MeshStandardMaterial({color,roughness:.64,...options});material.name='Exterior_'+name;return material;};
  const m={
    red:make('Cinnabar_Lacquer',0xb62f23,{roughness:.48}),
    redLight:make('Cinnabar_Edges',0xcf4e32,{roughness:.49}),
    darkRed:make('Recessed_Red_Joinery',0x7e241c),
    screen:make('Shadow_Behind_Lattice',0x304238,{roughness:.92}),
    paper:make('Interior_Window_Paper',0xddcfad,{roughness:.94,emissive:0x554b2c,emissiveIntensity:.08}),
    green:make('Mineral_Green',0x3c6252),blue:make('Mineral_Blue',0x294751),
    gold:make('Weathered_Gold',0xc0a66b,{metalness:.35,roughness:.63}),
    paint:make('Painted_Cloud_And_Floral_Frieze',0xffffff,{map:frieze,roughness:.84}),
    stone:make('Pale_Ashlar_Stone',0xffffff,{map:stoneTexture(),roughness:.96}),
    stoneCap:make('Cut_Stone_Coping',0xc6bfaa,{roughness:.92}),
  };
  const faces=[
    {id:'east-principal',axis:'x',side:1,at:18.15,half:26.25,entrance:true,posts:[-26.02,-21,-14,-5.7,5.7,14,21,26.02]},
    {id:'west',axis:'x',side:-1,at:18.15,half:26.25,posts:[-26.02,-21,-14,-7,0,7,14,21,26.02]},
    {id:'south-short',axis:'z',side:1,at:26.15,half:18.25,posts:[-18.02,-12,-6,0,6,12,18.02]},
    {id:'north-short',axis:'z',side:-1,at:26.15,half:18.25,posts:[-18.02,-12,-6,0,6,12,18.02]},
  ];
  let leaves=0;
  for(const face of faces){
    const point=(u,y,n=0)=>face.axis==='x'?[face.side*(face.at+n),y,u]:[u,y,face.side*(face.at+n)];
    const box=(mat,u,y,n,w,h,d)=>b.box(mat,point(u,y,n),face.axis==='x'?[d,h,w]:[w,h,d]);
    const spans=face.entrance?[[-face.half,-5.1],[5.1,face.half]]:[[-face.half,face.half]];
    const wallObstacle=(id,lo,hi,minY,maxY)=>{
      const a=point(lo,minY,-.19),z=point(hi,maxY,.42);
      obstacles.push({id:'exterior-'+face.id+'-'+id,type:'exteriorWall',minX:Math.min(a[0],z[0]),maxX:Math.max(a[0],z[0]),minY,maxY,minZ:Math.min(a[2],z[2]),maxZ:Math.max(a[2],z[2])});
    };
    for(const[lo,hi]of spans){
      const middle=(lo+hi)/2,width=hi-lo;
      box(m.stone,middle,.44,-.01,width,.88,.30);
      box(m.stoneCap,middle,.91,.045,width,.12,.41);
      box(m.darkRed,middle,1.05,.025,width,.15,.32);
      wallObstacle('lower',lo,hi,0,6.18);
    }
    // A genuine upper storey: short red sill panels and tall slender lattice
    // leaves rise above a restrained painted string course.
    box(m.darkRed,0,6.38,.02,face.half*2,.44,.33);
    box(m.green,0,6.58,.115,face.half*2,.40,.14);
    for(const y of[6.405,6.755])box(m.gold,0,y,.20,face.half*2-.04,.026,.035);
    box(m.red,0,6.94,.015,face.half*2,.32,.31);
    box(m.darkRed,0,12.72,.01,face.half*2,.54,.32);
    wallObstacle('upper',-face.half,face.half,6.12,14.05);
    const panel=(center,width,bottom,top)=>{
      const count=Math.max(1,Math.round(width/1.20)),pitch=width/count;
      for(let i=0;i<count;i++){
        const u=center-width/2+pitch*(i+.5),w=pitch-.085;
        const sillHeight=bottom<2?.72:.55;
        const panelBottom=bottom,screenBottom=bottom+sillHeight+.13,screenTop=top-.13;
        const h=screenTop-screenBottom,cy=(screenBottom+screenTop)/2;
        // Separate exterior shadow and interior paper layers have physical
        // depth; the wood grille sits proud of both, never coplanar with them.
        box(m.paper,u,cy,-.145,w-.04,h,.025);
        box(m.screen,u,cy,.055,w-.04,h,.028);
        box(m.darkRed,u,panelBottom+sillHeight/2,.02,w,sillHeight,.20);
        box(m.red,u,panelBottom+sillHeight/2,.145,w-.17,sillHeight-.16,.055);
        for(const sign of[-1,1]){
          box(m.red,u+sign*(w/2-.025),(bottom+top)/2,.18,.075,top-bottom+.07,.14);
          box(m.redLight,u+sign*(w/2-.087),panelBottom+sillHeight/2,.185,.025,sillHeight-.18,.025);
        }
        for(const y of[bottom+.025,screenBottom-.065,top-.025])box(m.red,u,y,.18,w,.085,.14);
        for(const y of[panelBottom+.10,panelBottom+sillHeight-.10])box(m.redLight,u,y,.19,w-.17,.028,.03);
        // Slanted bars are clipped to each window leaf. This creates a real
        // diamond lattice, including its edge terminations, rather than a decal.
        const halfW=(w-.20)/2,halfH=(h-.07)/2;
        for(const slope of[-1,1])for(let k=-Math.ceil((halfW+halfH)/.32);k<=Math.ceil((halfW+halfH)/.32);k++){
          const intercept=k*.32,lo=Math.max(-halfW,(-halfH-intercept)/slope),hi=Math.min(halfW,(halfH-intercept)/slope);
          let ax,bx;
          if(slope===1){ax=lo;bx=hi;}else{ax=Math.max(-halfW,intercept-halfH);bx=Math.min(halfW,intercept+halfH);}
          if(bx-ax<.045)continue;
          b.rod(m.red,point(u+ax,cy+slope*ax+intercept,.192),point(u+bx,cy+slope*bx+intercept,.192),.031,.040);
        }
        leaves++;
      }
    };
    // Lower panels respect the full entrance gap; upper panels remain complete.
    for(let j=0;j<face.posts.length-1;j++){
      const lo=face.posts[j]+.24,hi=face.posts[j+1]-.24;
      if(hi<=lo)continue;
      if(!(face.entrance&&lo<5.1&&hi>-5.1))panel((lo+hi)/2,hi-lo,1.08,5.29);
      panel((lo+hi)/2,hi-lo,7.13,12.42);
      const w=hi-lo;
      box(m.paint,(lo+hi)/2,5.72,.11,w,.66,.25);
      box(m.paint,(lo+hi)/2,13.45,.12,w,.86,.27);
      for(const y of[5.36,6.07,12.98,13.92])box(m.gold,(lo+hi)/2,y,.265,w,.025,.04);
      for(const y of[6.12,14.01])box(m.red,(lo+hi)/2,y,.10,w,.16,.36);
    }
    if(face.entrance){
      // Narrow fixed returns join the portal jambs without introducing a
      // hidden wall through the centre opening.
      for(const side of[-1,1]){
        box(m.red,side*5.30,2.66,.055,.40,5.32,.30);
        box(m.paint,side*5.28,5.72,.11,.36,.66,.25);
      }
    }
    // Facade posts are the exterior joinery, distinct from the inner structural
    // column row. Their bases meet the ashlar sill and their tops carry the eaves.
    for(const u of face.posts){
      box(m.stoneCap,u,.30,.06,.48,.60,.48);
      box(m.red,u,6.94,.07,.40,12.95,.42);
      box(m.redLight,u,6.94,.296,.055,12.90,.025);
      box(m.darkRed,u,13.52,.075,.61,.24,.54);
      box(m.green,u,13.72,.11,.75,.18,.62);
      box(m.gold,u,13.825,.13,.77,.03,.64);
    }
    // Small, regularly spaced bracket clusters enrich the deep shadow under
    // the single principal roof, following the reference's continuous cornice.
    const bracketCount=Math.floor(face.half*2/1.22);
    for(let i=0;i<=bracketCount;i++){
      const u=-face.half+.30+i*(face.half*2-.60)/bracketCount;
      for(let tier=0;tier<3;tier++){
        const yy=13.95+tier*.18,nn=.23+tier*.23,ww=.46+tier*.24;
        box(tier%2?m.green:m.red,u,yy,nn,ww,.13,.32);
        box(m.blue,u,yy+.075,nn+.14,.18,.12,.66+tier*.16);
        for(const side of[-1,1])box(m.gold,u+side*(ww/2-.07),yy+.083,nn,.12,.022,.35);
      }
    }
  }
  // Painted rafter ends and continuous fascia follow the same sampled roof
  // heights as the solid shell. These are real repeated geometric elements.
  for(const side of[-1,1]){
    for(let z=-28.5;z<=28.51;z+=.48){
      const a=[side*18.68,roofSurfaceHeight(side*18.68,z)-.40,z],c=[side*19.91,roofSurfaceHeight(side*19.91,z)-.40,z];
      eb.rod(m.darkRed,a,c,.12,.12);
      const y=c[1];eb.box(m.green,[side*19.92,y,z],[.11,.135,.16]);
      eb.box(m.gold,[side*19.985,y,z],[.025,.06,.07]);
    }
    for(let z=-28.5;z<28.5;z+=.75){
      const next=Math.min(28.5,z+.75);
      eb.rod(m.green,[side*19.98,roofSurfaceHeight(side*19.98,z)-.57,z],[side*19.98,roofSurfaceHeight(side*19.98,next)-.57,next],.17,.17);
    }
    for(let x=-19.45;x<=19.451;x+=.50){
      const a=[x,roofSurfaceHeight(x,side*27.0)-.40,side*27.0],c=[x,roofSurfaceHeight(x,side*28.88)-.40,side*28.88];
      eb.rod(m.darkRed,a,c,.12,.12);
      eb.box(m.green,[x,c[1],side*28.89],[.16,.135,.11]);
      eb.box(m.gold,[x,c[1],side*28.955],[.07,.06,.025]);
    }
  }
  const instances=b.finish('Palace_Facade')+eb.finish('Palace_Eaves');
  const metadata={version:5,principalSide:'+X',principalWidth:52.5,storeys:2,windowLeaves:leaves,
    entryOpening:{minX:17.96,maxX:18.57,minZ:-5.10,maxZ:5.10,minY:0,maxY:5.32},
    exteriorInstances:instances,referenceFeatures:['red-diamond-lattice','painted-green-blue-frieze','layered-eave-brackets','pale-ashlar-base','long-elevation-centred-entry']};
  group.userData={...metadata};return {group,eaves,metadata,materials:m};
}
