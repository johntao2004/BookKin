import * as THREE from 'three';

export const EXTERIOR_PLAQUE_REFERENCE_V11=Object.freeze({
  source:'wenhuadian-original-v11.png',imageSize:[1280,1920],
  // Top-left, top-right, bottom-right, bottom-left of the original blue field.
  quad:[[388,565],[915,557],[912,1290],[402,1299]],
  sha256:'8679ebc7962b034cf17bfffb71f459637088fd08fe4bd00bf6426466abc92b90',
});

/** Project a rectified plaque coordinate into the untouched reference image.
 * Four-point projective mapping keeps both lettering and the field straight.
 */
export function exteriorPlaqueUvPoint(u,v){
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=EXTERIOR_PLAQUE_REFERENCE_V11.quad;
  const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3,den=dx1*dy2-dx2*dy1;
  const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;
  const a=x1-x0+g*x1,b=x3-x0+h*x3,d=y1-y0+g*y1,e=y3-y0+h*y3,w=g*u+h*v+1;
  return[(a*u+b*v+x0)/w,(d*u+e*v+y0)/w];
}

// The outline follows the user's photograph: broad cloud wings, shaped side
// returns and two long pendent cloud feet. It is solid carved wood, not a
// rectangular picture with a decorative rectangle drawn around it.
function cloudOutline(){
  const right=[
    ['C',.24,1.61,.48,1.54,.63,1.49],['C',.69,1.55,.77,1.48,.82,1.47],
    ['C',.94,1.54,1.06,1.62,1.20,1.56],['C',1.34,1.55,1.43,1.50,1.55,1.48],
    ['C',1.64,1.49,1.69,1.43,1.80,1.43],['C',1.94,1.41,1.92,1.29,1.79,1.24],
    ['C',1.63,1.18,1.42,1.20,1.20,1.15],['L',1.17,1.03],
    ['C',1.28,.97,1.28,.82,1.17,.76],['C',1.22,.62,1.19,.50,1.23,.32],
    ['C',1.29,.14,1.26,-.01,1.25,-.18],['C',1.27,-.39,1.24,-.55,1.19,-.70],
    ['C',1.17,-.83,1.19,-.96,1.21,-1.08],['C',1.16,-1.17,1.23,-1.25,1.26,-1.37],
    ['C',1.29,-1.58,1.22,-1.84,1.18,-1.99],['C',1.13,-2.16,1.05,-2.28,.98,-2.17],
    ['C',.92,-2.08,.86,-1.87,.86,-1.65],['L',.86,-1.50],
    ['C',.73,-1.47,.65,-1.54,.56,-1.46],['C',.43,-1.56,.30,-1.56,.18,-1.59],
    ['C',.10,-1.63,.04,-1.63,0,-1.63],
  ];
  const s=new THREE.Shape();s.moveTo(0,1.58);
  const segments=[];let prior=[0,1.58];
  for(const c of right){segments.push({start:prior,cmd:c});if(c[0]==='L')s.lineTo(c[1],c[2]);else s.bezierCurveTo(...c.slice(1));prior=c.slice(-2);}
  for(const {start,cmd} of segments.reverse()){
    if(cmd[0]==='L')s.lineTo(-start[0],start[1]);
    else s.bezierCurveTo(-cmd[3],cmd[4],-cmd[1],cmd[2],-start[0],start[1]);
  }
  s.closePath();return s;
}
const rectHole=(w,h)=>new THREE.Path().moveTo(-w/2,-h/2).lineTo(-w/2,h/2).lineTo(w/2,h/2).lineTo(w/2,-h/2).closePath();
const extrude=(shape,depth,bevel)=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:18}).translate(0,0,-depth/2);

export function buildExteriorPlaqueV11({texture=null,fallbackTexture=null,materials}){
  const group=new THREE.Group();group.name='V11_Carved_Ruyi_Cloud_Exterior_Plaque';
  group.userData={preservePhysicalProportions:true,heightPolicy:'translate-anchor-only',text:'文華殿',sourceReference:'image(20261025-091155).png'};
  const faceWidth=1.626,faceHeight=2.30;
  const red=new THREE.MeshStandardMaterial({color:0x9b2834,roughness:.43,metalness:.05});red.name='Exterior_Plaque_Carved_Vermilion_Wood';
  const shape=cloudOutline();shape.holes.push(rectHole(faceWidth,faceHeight));
  const frame=new THREE.Mesh(extrude(shape,.22,.014),red);frame.name='True_Extruded_Cloud_Outline';group.add(frame);
  const facePlate=new THREE.Mesh(new THREE.BoxGeometry(faceWidth,faceHeight,.10),materials.blue);facePlate.position.z=.028;facePlate.name='Blue_Lacquer_Plaque_Backboard';group.add(facePlate);
  const map=texture??fallbackTexture;
  if(map){map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=16;map.magFilter=THREE.LinearFilter;}
  const faceMaterial=new THREE.MeshStandardMaterial({color:map?0xffffff:0x123b9a,map,roughness:.62,metalness:.04});faceMaterial.name='ArchitecturalDetail_Wenhuadian_Plaque_Original_Brush_Lettering';
  const faceGeometry=new THREE.PlaneGeometry(faceWidth-.022,faceHeight-.022,8,12);
  if(texture){const uv=faceGeometry.attributes.uv;for(let i=0;i<uv.count;i++){const[x,y]=exteriorPlaqueUvPoint(uv.getX(i),1-uv.getY(i));uv.setXY(i,x/1280,1-y/1920);}uv.needsUpdate=true;}
  const face=new THREE.Mesh(faceGeometry,faceMaterial);
  face.position.z=.081;face.name='Wenhuadian_Vertical_Gate_Nameplate';face.userData={text:'文華殿',architecturalDetail:true,keepSolidInFallback:true,originalTexture:!!texture,originalUserPhotograph:!!texture,sourceAsset:EXTERIOR_PLAQUE_REFERENCE_V11.source,sourceSha256:EXTERIOR_PLAQUE_REFERENCE_V11.sha256,photoQuad:EXTERIOR_PLAQUE_REFERENCE_V11.quad};group.add(face);
  const addTube=(points,radius=.016)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y,z=.133])=>new THREE.Vector3(x,y,z)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.min(600,Math.max(24,points.length*6)),radius,6,false),materials.gold);
    mesh.name='Raised_Gilt_Cloud_Moulding';group.add(mesh);
  };
  const addWoodBackedBead=points=>{
    const supportCurve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,.15)));
    const support=new THREE.Mesh(new THREE.TubeGeometry(supportCurve,Math.max(4,points.length*6),.05,8,false),red);
    support.name='Carved_Raised_Scroll_Backing';group.add(support);
    addTube(points.map(([x,y])=>[x,y,.207]),.018);
  };
  const outer=cloudOutline().getPoints(22).map(p=>[p.x,p.y,.128]);outer.push(outer[0]);addTube(outer,.013);
  const rim=new THREE.Shape();rim.moveTo(-faceWidth/2-.036,-faceHeight/2-.036);rim.lineTo(faceWidth/2+.036,-faceHeight/2-.036);rim.lineTo(faceWidth/2+.036,faceHeight/2+.036);rim.lineTo(-faceWidth/2-.036,faceHeight/2+.036);rim.closePath();rim.holes.push(rectHole(faceWidth-.006,faceHeight-.006));
  const inner=new THREE.Mesh(extrude(rim,.046,.006),materials.gold);inner.position.z=.106;inner.name='Rebated_Gilt_Plaque_Inner_Frame';group.add(inner);
  // Four solid bevel faces turn from the recessed blue board to the raised
  // red surround. Their corner seams are the diagonal gold returns in the
  // original photograph, rather than a uniformly flat printed frame.
  const innerCorners=[[-faceWidth/2,-faceHeight/2],[faceWidth/2,-faceHeight/2],[faceWidth/2,faceHeight/2],[-faceWidth/2,faceHeight/2]],outerCorners=[[-1.14,-1.44],[1.14,-1.44],[1.14,1.44],[-1.14,1.44]];
  for(let i=0;i<4;i++){
    const j=(i+1)%4,corners=[innerCorners[i],innerCorners[j],outerCorners[j],outerCorners[i]],positions=[];
    corners.forEach(([x,y],k)=>positions.push(x,y,k<2?.130:.178));corners.forEach(([x,y])=>positions.push(x,y,.108));
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex([0,2,1,0,3,2,4,6,7,4,5,6,0,5,4,0,1,5,1,6,5,1,2,6,2,7,6,2,3,7,3,4,7,3,0,4]);geo.computeVertexNormals();
    const facet=new THREE.Mesh(geo,red);facet.name='Solid_Inclined_Plaque_Reveal_'+i;group.add(facet);
    const a=innerCorners[i],b=outerCorners[i];addWoodBackedBead([a,b]);
  }
  // Deliberately broad, hand-carved ruyi curls on the upper wings, upper and
  // lower side returns, and the low apron. All sit on the solid red surround.
  for(const side of[-1,1]){
    const curve=p=>addWoodBackedBead(p.map(([x,y])=>[x*side,y]));
    curve([[.56,1.41],[.66,1.37],[.76,1.37],[.79,1.44],[.74,1.47],[.68,1.44],[.72,1.41]]);
    curve([[.89,1.20],[1.12,1.42],[1.08,1.09],[1.17,.98],[1.14,.86],[1.04,.87],[1.02,.96],[1.08,1.01],[1.10,.96]]);
    curve([[1.10,.80],[1.05,.68],[1.12,.53],[1.07,.37],[1.15,.16],[1.10,.04],[1.13,-.12],[1.09,-.30],[1.16,-.50],[1.10,-.68],[1.15,-.85],[1.08,-1.04]]);
    curve([[1.07,-1.08],[1.17,-1.20],[1.15,-1.31],[1.04,-1.34],[1.00,-1.25],[1.04,-1.19],[1.10,-1.22],[1.07,-1.27]]);
    curve([[.83,-1.18],[.72,-1.32],[.61,-1.40],[.48,-1.39],[.44,-1.31],[.50,-1.26],[.59,-1.30],[.54,-1.35]]);
    // Tangible rear brackets bridge the gap to the upper painted head beam.
    const bracket=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.59),materials.frame);
    bracket.position.set(side*1.02,.59,-.405);bracket.name='Plaque_Seated_Rear_Beam_Bracket';group.add(bracket);
  }
  group.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.keepSolidInFallback=true;}});
  frame.geometry.computeBoundingBox();const bounds=frame.geometry.boundingBox;
  const metadata={text:'文華殿',faceWidth,faceHeight,frame:'solid-extruded-red-ruyi-cloud-surround-with-four-bevel-faces',source:'user-photo-091155',sourceAsset:EXTERIOR_PLAQUE_REFERENCE_V11.source,sourceSha256:EXTERIOR_PLAQUE_REFERENCE_V11.sha256,photoQuad:EXTERIOR_PLAQUE_REFERENCE_V11.quad,uvMapping:'four-point-projective-rectification',
    blueFaceAspect:faceWidth/faceHeight,preservePhysicalProportions:true,originalCalligraphyTexture:!!texture,generatedLettering:false,frameDepth:.32,outerWidth:bounds.max.x-bounds.min.x,outerHeight:bounds.max.y-bounds.min.y,frameLocalTopY:bounds.max.y,frameLocalBottomY:bounds.min.y};
  group.userData.plaque=metadata;return{group,metadata,face,frame};
}
