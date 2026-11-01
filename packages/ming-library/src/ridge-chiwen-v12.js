import * as THREE from 'three';
import {PALACE_PLAN_SCALE} from './design-v12.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Paired main-ridge dragon/fish ornaments. The Palace Museum distinguishes
 * these 正吻 from the small eave 走兽. The upper body is a thin upright ceramic
 * plate with a curled tail; the low open jaw receives the actual ridge end.
 * Dimensions are an interpretation of the published Taihe specimen's ratio,
 * not a claim to be a measured survey of Wenhua Hall. */
export const CHIWEN_REFERENCE_V12=Object.freeze({
  definition:'https://www.dpm.org.cn/lemmas/241554.html',
  measuredExample:'https://www.dpm.org.cn/Uploads/pdf/2199/T00018_00.pdf',
  repair:'https://www.dpm.org.cn/classify_detail/161472.html',
  height:3.40,profileWidth:2.68,ceramicCoreThickness:.32,
});

function outline(){
  const s=new THREE.Shape();
  // Lower jaw, broad rooted fish body and a scalloped dorsal edge.
  s.moveTo(-1.13,.05);s.lineTo(.58,.05);s.bezierCurveTo(.77,.19,.89,.41,.91,.66);
  s.bezierCurveTo(1.00,.86,1.23,1.02,1.35,1.18);
  s.lineTo(1.51,1.33);s.lineTo(1.33,1.37);s.lineTo(1.52,1.56);s.lineTo(1.31,1.58);
  s.lineTo(1.47,1.80);s.lineTo(1.23,1.79);s.lineTo(1.37,2.02);s.lineTo(1.13,1.99);
  s.lineTo(1.27,2.22);s.lineTo(1.02,2.18);s.lineTo(1.11,2.41);s.lineTo(.92,2.36);
  // Raised curled tail: a return at the crown, not a cone or standing dog.
  s.bezierCurveTo(1.04,2.65,.97,2.93,.75,3.10);
  s.bezierCurveTo(.47,3.34,.04,3.31,-.20,3.08);
  s.bezierCurveTo(-.41,2.87,-.38,2.58,-.16,2.48);
  s.bezierCurveTo(.06,2.38,.25,2.54,.20,2.72);
  s.bezierCurveTo(.15,2.87,-.01,2.86,-.06,2.78);
  s.bezierCurveTo(.02,2.98,.28,3.01,.42,2.83);
  s.bezierCurveTo(.57,2.61,.46,2.36,.27,2.12);
  s.bezierCurveTo(.09,1.90,.08,1.64,-.03,1.45);
  // Horned dragon head stays low, on the inward side of the main ridge.
  s.lineTo(-.22,1.61);s.lineTo(-.19,1.34);s.lineTo(-.41,1.50);s.lineTo(-.38,1.24);
  s.bezierCurveTo(-.66,1.35,-.92,1.19,-1.00,1.01);
  s.bezierCurveTo(-1.05,.95,-1.17,.94,-1.16,.80);s.lineTo(-1.16,.66);
  // Open inward bite: the glazed ridge passes between the two actual jaws.
  s.lineTo(-.28,.66);s.bezierCurveTo(-.19,.57,-.19,.24,-.30,.18);
  s.lineTo(-1.13,.18);s.lineTo(-1.13,.05);s.closePath();
  return s;
}

function prototype(materials){
  const body=new THREE.ExtrudeGeometry(outline(),{depth:.32,bevelEnabled:true,bevelThickness:.014,bevelSize:.014,bevelSegments:2,curveSegments:16,steps:1});
  body.translate(0,0,-.16);body.computeVertexNormals();body.computeBoundingBox();body.computeBoundingSphere();
  const groups={relief:[],incised:[],eye:[],teeth:[]};
  const add=(key,g,p=[0,0,0],scale=[1,1,1],rot=[0,0,0])=>{
    const o=new THREE.Object3D();o.position.set(...p);o.scale.set(...scale);o.rotation.set(...rot);o.updateMatrix();
    const geo=g.index?g.toNonIndexed():g.clone();geo.applyMatrix4(o.matrix);groups[key].push(geo);
  };
  const profile=outline().getPoints(80);
  const inside=(x,y)=>{let odd=false;for(let i=0,j=profile.length-1;i<profile.length;j=i++){const a=profile[i],b=profile[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)odd=!odd;}return odd;};
  const line=(key,points,z,r=.018)=>{
    const surfaceZ=key==='incised'?Math.sign(z)*.178:z,curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],surfaceZ))),samples=curve.getPoints(Math.max(16,points.length*8));
    let chain=[];
    const flush=()=>{if(chain.length>1)add(key,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chain),Math.max(5,Math.min(16,Math.ceil(chain.length/2))),r,key==='incised'?4:5,false));chain=[];};
    for(const p of samples){if(inside(p.x,p.y))chain.push(p);else flush();}flush();
  };
  const sphere=new THREE.SphereGeometry(1,12,8),torus=new THREE.TorusGeometry(1,.14,6,24);
  for(const side of[-1,1]){
    const z=side*.182;
    // Symmetric sculpted cheek, brow, nostril and incised open-lip detail.
    add('relief',sphere,[-.62,.99,z],[.28,.20,.055]);
    add('relief',torus,[-.63,1.04,z+side*.035],[.105,.085,.06]);
    add('eye',sphere,[-.63,1.04,z+side*.065],[.040,.043,.020]);
    add('relief',torus,[-1.00,.86,z],[.070,.065,.055]);
    line('relief',[[-.96,1.09],[-.79,1.20],[-.58,1.23],[-.43,1.15]],z+side*.015,.028);
    line('incised',[[-1.08,.69],[-.84,.65],[-.51,.67],[-.25,.63]],z+side*.022,.012);
    line('relief',[[-.29,.64],[-.15,.82],[-.19,1.06],[-.37,1.20]],z,.024);
    line('relief',[[-.12,.52],[.10,.65],[.16,.90],[.04,1.10]],z,.021);
    line('relief',[[-.21,.40],[.15,.39],[.38,.56],[.43,.80]],z,.021);
    // Whiskers curl against the ceramic body instead of projecting as tubes.
    line('relief',[[-.93,.93],[-.79,.81],[-.51,.79],[-.42,.88]],z+side*.025,.017);
    // Nine carefully bounded tail ribs echo the scalloped fish fin.
    for(let k=0;k<9;k++){
      const yy=.81+k*.155,xx=.51+k*.035;
      line('relief',[[.39,yy],[xx+.16,yy+.06],[xx+.35,yy+.18],[xx+.37,yy+.26]],z,.014);
    }
    line('relief',[[.48,.57],[.64,.96],[.70,1.45],[.62,1.93],[.47,2.36]],z,.023);
    line('relief',[[.59,2.43],[.73,2.72],[.61,2.99],[.31,3.12],[.02,3.03]],z,.020);
    line('incised',[[.10,2.59],[.08,2.74],[-.08,2.75],[-.17,2.65]],z+side*.012,.011);
    // Small fish scales in staggered rows, restricted to the body itself.
    for(let row=0;row<8;row++)for(let col=0;col<3;col++){
      const yy=.69+row*.18,xx=.08+col*.16+(row%2)*.07;
      if(xx>.70-(yy-1.4)*.16)continue;
      line('incised',[[xx-.068,yy+.025],[xx,yy-.036],[xx+.068,yy+.025]],z+side*.008,.008);
    }
    // Fired-piece joint seams are shallow grooves, not gaps or floating blocks.
    line('incised',[[-1.08,.18],[-.52,.18],[.20,.18],[.65,.18]],z+side*.009,.008);
    line('incised',[[.20,1.45],[.58,1.45],[1.10,1.45]],z+side*.010,.007);
    line('incised',[[.35,2.24],[.70,2.24],[.98,2.24]],z+side*.010,.007);
    // Short teeth sit on the inner upper jaw, separated from the ridge cap.
    for(let k=0;k<4;k++)add('teeth',new THREE.ConeGeometry(.033,.068,5),[-.96+k*.15,.63,side*.15],[1,1,1],[0,0,Math.PI]);
  }
  // The traditional sword/locking fin is restrained, located behind the tail.
  const blade=new THREE.Shape();blade.moveTo(.79,2.47);blade.lineTo(.83,3.30);blade.lineTo(.88,3.40);blade.lineTo(.93,3.30);blade.lineTo(.94,2.47);blade.closePath();
  const sword=new THREE.ExtrudeGeometry(blade,{depth:.055,bevelEnabled:false});sword.translate(0,0,-.0275);add('relief',sword);
  add('relief',new THREE.BoxGeometry(.30,.06,.11),[.86,3.13,0]);
  const merge=list=>list.length?mergeGeometries(list,false):null;
  return{body,relief:merge(groups.relief),incised:merge(groups.incised),eye:merge(groups.eye),teeth:merge(groups.teeth)};
}

export function buildRidgeChiwenV12({parent,ridgeY,ridgeHalfLength,roofSurface,materials,ceramicTexture=null}){
  const group=new THREE.Group();group.name='V12_Paired_Main_Ridge_Zhengwen';parent.add(group);
  const proto=prototype(materials),records=[],preserveGroups=[];
  const warm=materials.light.clone();warm.name='V12_Zhengwen_Yellow_Glazed_Ceramic';warm.roughness=.36;warm.metalness=.07;
  let patterned=warm;
  if(ceramicTexture){
    // The source bitmap stays unchanged. A continuous runtime colour field
    // blends its scales into plain glaze around the carved dragon neck; one
    // UV material covers the complete front/back cap, so triangle edges can
    // never become visible texture-mask boundaries.
    let mapped=ceramicTexture;
    const image=ceramicTexture.image;
    if(typeof document!=='undefined'&&image){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(image,0,0,1024,1024);const pixels=ctx.getImageData(0,0,1024,1024),a=pixels.data,
        base=new THREE.Color(warm.color).convertLinearToSRGB(),rgb=[base.r*255,base.g*255,base.b*255];
      for(let py=0;py<1024;py++)for(let px=0;px<1024;px++){
        const x=(px+.5)/1024*2.70-1.17,y=(1-(py+.5)/1024)*3.40,t=THREE.MathUtils.clamp((y-1.02)/.68,0,1),edge=.08-.43*t*t,
          weight=THREE.MathUtils.smoothstep(x,edge-.14,edge+.14)*THREE.MathUtils.smoothstep(y,.18,.40),i=(py*1024+px)*4;
        for(let k=0;k<3;k++)a[i+k]=Math.round(THREE.MathUtils.lerp(rgb[k],a[i+k],weight));a[i+3]=255;
      }
      ctx.putImageData(pixels,0,0);mapped=new THREE.CanvasTexture(canvas);mapped.name='V12_Continuous_Glaze_To_Fish_Scale_Field';
    }
    mapped.colorSpace=THREE.SRGBColorSpace;mapped.anisotropy=16;mapped.userData={...mapped.userData,detailPriority:true,preserveResolution:true};
    patterned=new THREE.MeshStandardMaterial({map:mapped,bumpMap:mapped,bumpScale:.006,color:0xffffff,roughness:.42,metalness:.06});patterned.name='V12_Zhengwen_Continuous_Glazed_Scale_Surface';
    const geometry=proto.body,p=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+1.17)/2.70,p.getY(i)/3.40);uv.needsUpdate=true;
    for(const g of geometry.groups)g.materialIndex=g.materialIndex===0?1:0;
    geometry.userData={organicFishBodyMask:true,continuousTextureBlend:true,noRectangularTextureOverlay:true,faceAndMouthRemainSculpted:true};
  }
  const shadow=materials.shadow.clone();shadow.name='V12_Zhengwen_Engraving_Recess';shadow.color.setHex(0x94631f);
  for(const side of[-1,1]){
    const instance=new THREE.Group();instance.name=`V12_Main_Ridge_${side<0?'North':'South'}_Zhengwen`;
    instance.position.set(0,ridgeY+.125,side*ridgeHalfLength);instance.rotation.y=-side*Math.PI/2;
    instance.userData={preservePhysicalHeight:true,preservePlanProportions:true,ridgeOrnament:'zhengwen',facesTowardRidge:true};
    for(const[k,m]of[['body',[warm,patterned]],['relief',materials.gold],['incised',shadow],['eye',shadow],['teeth',materials.light]]){
      const mesh=new THREE.Mesh(proto[k],m);mesh.name='V12_Zhengwen_'+k;mesh.castShadow=mesh.receiveShadow=true;
      mesh.userData={collision:'box',keepSolidInFallback:k==='body',preserveSurfaceInFallback:true,ridgeOrnament:'zhengwen',detailRole:k};instance.add(mesh);
    }
    group.add(instance);preserveGroups.push(instance);
    // A fitted ceramic haunch closes the space between the outward body and
    // the declining hip. Its bottom follows the rendered roof, its top meets
    // the original ornament's physical base after the vertical transform.
    if(roofSurface){
      const x0=.10/PALACE_PLAN_SCALE,x1=.66/PALACE_PLAN_SCALE,halfD=.18/PALACE_PLAN_SCALE,anchorY=ridgeY+.125,
        yTop=anchorY+.05/(4/3),low0=roofSurface(0,side*(ridgeHalfLength+x0))+.018,low1=roofSurface(0,side*(ridgeHalfLength+x1))+.018;
      const shape=new THREE.Shape();shape.moveTo(x0,low0);shape.lineTo(x1,low1);shape.lineTo(x1,yTop);shape.lineTo(x0,yTop);shape.closePath();
      const g=new THREE.ExtrudeGeometry(shape,{depth:halfD*2,bevelEnabled:false});g.translate(0,0,-halfD);
      const support=new THREE.Mesh(g,materials.warm);support.name='V12_Zhengwen_Fitted_Roof_Bearing_'+side;support.rotation.y=-side*Math.PI/2;support.position.z=side*ridgeHalfLength;
      support.userData={collision:'box',keepSolidInFallback:true,ridgeBearing:true};support.castShadow=support.receiveShadow=true;group.add(support);
    }
    records.push({side,position:instance.position.toArray(),yaw:instance.rotation.y,kind:'正吻',orientation:'mouth-inward-tail-outward',physicalDimensions:[2.68,3.4,.32],coreThickness:.32,biteOpening:[-.30,.18,-1.13,.66]});
  }
  const metadata={version:12,count:2,type:'正吻 / 龙吻 / 大吻',differentFromWalkingBeasts:true,
    reference:CHIWEN_REFERENCE_V12,physicalDimensions:[2.68,3.4,.32],coreThickness:.32,sculptedScales:true,texturedScaleField:!!ceramicTexture,openRidgeBite:true,records};
  group.userData.mainRidgeFigures=metadata;return{group,metadata,records,preserveGroups,prototypes:proto};
}
