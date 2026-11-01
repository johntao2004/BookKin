import * as THREE from 'three';
import {upperWorldYV15} from './height-v15.js';
import {cushionGeometry,refinedCrestGeometry} from './ceremonial-sculpture-v8.js';
import {buildRitualSculpturesV11,cachedCarvedApronGeometryV14 as carvedApronGeometry} from './ceremonial-sculpture-v11.js';
import {PALACE_PLAN_SCALE,V12_COLUMN_COLOR,V12_JOINERY_COLOR} from './design-v12.js';
import tracedThrone from './throne-openwork-v11.json' with {type:'json'};

/** Local +Z = world +X (entrance), local +X = world -Z. All Y values below
 * are FINAL elevations. Do not stretch this human-scale furniture group. */
const DAIS=2.1,UP=new THREE.Vector3(0,1,0),UNIT_BOX=new THREE.BoxGeometry(1,1,1),UNIT_CYLINDER=new THREE.CylinderGeometry(1,1,1,20);
const pitchedApronCache=new Map(),stairPanelCache=new Map(),crestGeometryCache=new Map();
function pitchedApronGeometry(w,h,d,pitch){
  const key=[w,h,d,pitch].join('/');if(pitchedApronCache.has(key))return pitchedApronCache.get(key);
  const g=carvedApronGeometry(w,h,d).clone(),p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+pitch*p.getX(i));g.computeVertexNormals();pitchedApronCache.set(key,g);return g;
}
function cachedCrestGeometry(w,h){const key=[w,h].join('/');if(!crestGeometryCache.has(key))crestGeometryCache.set(key,refinedCrestGeometry(w,h));return crestGeometryCache.get(key);}
class Batch{
  constructor(parent){this.parent=parent;this.items=new Map();this.object=new THREE.Object3D();}
  add(g,m,p,s,rotation=null){const key=g.uuid+'/'+m.uuid;if(!this.items.has(key))this.items.set(key,{g,m,matrices:[]});const o=this.object;o.position.set(...p);o.scale.set(...s);o.quaternion.identity();if(rotation?.isQuaternion)o.quaternion.copy(rotation);else if(rotation)o.rotation.set(...rotation);o.updateMatrix();this.items.get(key).matrices.push(o.matrix.clone());}
  box(m,u,y,n,w,h,d,rotation=null){this.add(UNIT_BOX,m,[u,y,n],[w,h,d],rotation);}
  rod(m,a,b,r=.025){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),v=bb.clone().sub(aa),length=v.length();if(length<1e-6)return;this.add(UNIT_CYLINDER,m,aa.add(bb).multiplyScalar(.5).toArray(),[r,length,r],new THREE.Quaternion().setFromUnitVectors(UP,v.normalize()));}
  finish(){let count=0;for(const{g,m,matrices}of this.items.values()){const o=new THREE.InstancedMesh(g,m,matrices.length);matrices.forEach((matrix,i)=>o.setMatrixAt(i,matrix));o.name='V11_Ceremony_'+m.name;o.castShadow=o.receiveShadow=true;o.userData.keepSolidInFallback=true;o.computeBoundingBox();o.computeBoundingSphere();this.parent.add(o);count+=matrices.length;}return count;}
}
function mesh(parent,name,g,m,p=[0,0,0],rotation=null){const o=new THREE.Mesh(g,m);o.name=name;o.position.set(...p);if(rotation)o.rotation.set(...rotation);o.castShadow=o.receiveShadow=true;o.userData.keepSolidInFallback=true;parent.add(o);return o;}
function curve(parent,name,points,r,material,segments=36,radial=8){return mesh(parent,name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,r,radial,false),material);}
function photoSize(texture,fallback){const image=texture?.image;return[image?.naturalWidth||image?.width||fallback[0],image?.naturalHeight||image?.height||fallback[1]];}
function imageMaterial(name,texture,{color=0xffffff,alpha=false}={}){const m=new THREE.MeshStandardMaterial({map:texture,color,roughness:.63,metalness:.18,alphaTest:alpha?.44:0,side:alpha?THREE.DoubleSide:THREE.FrontSide});m.name=name;if(texture){texture.anisotropy=16;texture.userData={...texture.userData,detailPriority:true,preserveResolution:true};}return m;}

// Projective UV sampling preserves the photographed original brush shapes.
function homography(quad,source=[[0,0],[1,0],[1,1],[0,1]]){
  const a=[],b=[];
  source.forEach(([x,y],i)=>{const[u,v]=quad[i];a.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);a.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);});
  for(let i=0;i<8;i++){let row=i;for(let j=i+1;j<8;j++)if(Math.abs(a[j][i])>Math.abs(a[row][i]))row=j;[a[i],a[row]]=[a[row],a[i]];[b[i],b[row]]=[b[row],b[i]];const scale=a[i][i];if(Math.abs(scale)<1e-12)throw new Error('Degenerate reference quadrilateral');for(let k=i;k<8;k++)a[i][k]/=scale;b[i]/=scale;for(let j=0;j<8;j++)if(j!==i){const f=a[j][i];for(let k=i;k<8;k++)a[j][k]-=f*a[i][k];b[j]-=f*b[i];}}
  return(x,y)=>{const d=b[6]*x+b[7]*y+1;return[(b[0]*x+b[1]*y+b[2])/d,(b[3]*x+b[4]*y+b[5])/d];};
}
function referencePlane(parent,name,texture,quad,imageDimensions,w,h,p,rotation=null){
  const g=new THREE.PlaneGeometry(w,h,14,42),uv=g.attributes.uv,[iw,ih]=photoSize(texture,imageDimensions),map=homography(quad);
  for(let i=0;i<uv.count;i++){const[x,y]=map(uv.getX(i),1-uv.getY(i));uv.setXY(i,x/iw,1-y/ih);}uv.needsUpdate=true;
  const o=mesh(parent,name,g,imageMaterial(name+'_Original_Calligraphy',texture),p,rotation);o.userData={...o.userData,referencePixels:quad,originalBrushwork:true,projectiveUv:true};return o;
}
function atlasFace(parent,name,texture,rect,w,h,p,{alpha=false,rotation=null}={}){
  const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv,[x0,y0,x1,y1]=rect;
  for(let i=0;i<uv.count;i++)uv.setXY(i,THREE.MathUtils.lerp(x0,x1,uv.getX(i)),THREE.MathUtils.lerp(1-y1,1-y0,uv.getY(i)));
  const o=mesh(parent,name,g,imageMaterial(name+'_Reference_Texture',texture,{alpha}),p,rotation);o.userData={...o.userData,textureRole:'gilt-reference-surface',atlasRect:rect,part:name};return o;
}
function tracedOpenwork(parent,name,texture,part,width,height,depth,n,sideMaterial){
  const data=tracedThrone.parts[part],[iw,ih]=tracedThrone.imageSize,point=p=>new THREE.Vector2((p[0]/iw-.5)*width,(1-p[1]/ih)*height);
  const shapes=data.shapes.map(p=>{const s=new THREE.Shape(p.outline.map(point));for(const hole of p.holes)s.holes.push(new THREE.Path(hole.map(point)));return s;});
  const geometry=new THREE.ExtrudeGeometry(shapes,{depth,steps:1,bevelEnabled:false,curveSegments:1});geometry.translate(0,0,-depth/2);
  const p=geometry.attributes.position,uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,p.getX(i)/width+.5,p.getY(i)/height);uv.needsUpdate=true;
  const mat=imageMaterial(name+'_Mapped_Gilt_Openwork',texture,{alpha:true}),o=mesh(parent,name,geometry,[mat,sideMaterial],[0,DAIS,n]);
  o.userData={...o.userData,part:'reference-traced-openwork',textureRole:'gilt-reference-surface',sourceAsset:tracedThrone.source,sourceSha256:tracedThrone.sourceSha256,physicalThickness:depth,realOpenings:data.holes,traceTolerancePixels:tracedThrone.traceTolerancePixels};return o;
}
function rug(parent,b,name,texture,width,length,y,n){
  const make=color=>new THREE.MeshStandardMaterial({color,roughness:.99}),edge=make(0x866747),navy=make(0x273f4c),cream=make(0xc4ad7c);
  b.box(edge,0,y+.006,n,width,.012,length);const border=.27,fieldW=width-border*2,fieldL=length-border*2,g=new THREE.PlaneGeometry(fieldW,fieldL),mat=make(texture?0xffffff:0xb29561);
  if(texture){mat.map=texture.clone();mat.map.wrapS=mat.map.wrapT=THREE.RepeatWrapping;mat.map.anisotropy=16;mat.map.repeat.set(fieldW/4,fieldL/4);mat.map.needsUpdate=true;}
  mesh(parent,name+'_Woven_Field',g,mat,[0,y+.0123,n],[-Math.PI/2,0,0]);
  let inset=0;for(const[band,m]of[[.025,cream],[.035,navy],[.025,cream],[.16,navy],[.025,cream]]){const w=width-inset*2,l=length-inset*2;for(const s of[-1,1]){b.box(m,0,y+.0123,n+s*(l/2-band/2),w,.001,band);b.box(m,s*(w/2-band/2),y+.0123,n,band,.001,l-band*2);}inset+=band;}
  return{id:name,width,length,baseY:y,minX:n-length/2,maxX:n+length/2,minZ:-width/2,maxZ:width/2,tileMetres:4,borderWidth:border};
}

/** A fitted hardwood rail panel, with actual ruyi-cloud openings. The panel's
 * edges follow its stair pitch; the openings remain carved into that timber. */
function stairCarvedPanel(width,height,pitch,depth=.065){
  const key=[width,height,pitch,depth].join('/');if(stairPanelCache.has(key))return stairPanelCache.get(key);
  const shape=new THREE.Shape(),h=height/2,w=width/2;
  shape.moveTo(-w,-h);shape.lineTo(w,-h);shape.lineTo(w,h);shape.lineTo(-w,h);shape.closePath();
  for(const [cx,scale]of[[-width*.30,.20],[0,.27],[width*.30,.20]]){
    const a=width*scale,b=height*.56,p=new THREE.Path();
    p.moveTo(cx-a*.46,-b*.16);p.bezierCurveTo(cx-a*.57,b*.22,cx-a*.23,b*.40,cx-a*.09,b*.21);
    p.bezierCurveTo(cx-a*.02,b*.57,cx+a*.32,b*.56,cx+a*.35,b*.20);
    p.bezierCurveTo(cx+a*.60,b*.10,cx+a*.49,-b*.37,cx+a*.18,-b*.31);
    p.bezierCurveTo(cx-a*.02,-b*.48,cx-a*.39,-b*.40,cx-a*.46,-b*.16);p.closePath();shape.holes.push(p);
  }
  const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:.005,bevelSize:.005,bevelSegments:1,curveSegments:8});
  const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+pitch*p.getX(i));
  g.translate(0,0,-depth/2);g.computeVertexNormals();stairPanelCache.set(key,g);return g;
}

/** Project the reference from a visitor standing in front of the throne.
 * The pattern is complete in that frontal view, rather than when the cloth
 * is unrolled. The substrate remains twelve real risers and eleven treads;
 * no billboard or inclined face is introduced in front of the stairs. */
function foldedStairCarpet(parent,texture,{topX,bottomX,topY,steps,tread,width}){
  const riser=topY/steps,segments=[],quad=[[949,537],[1103,537],[1124,727],[931,727]],map=homography(quad),[iw,ih]=photoSize(texture,[2048,848]);
  const flap=.22,epsilon=.010,eyeX=14,eyeY=1.72;
  // Local +Z is world +X. A pinhole projection with no screen tilt is
  // sufficient: looking up/down only adds a homography to the same rays.
  const project=(u,y,n)=>[u/(eyeX-n),(y-eyeY)/(eyeX-n)];
  const projectedCorners=[project(-width/2,topY+epsilon,topX+epsilon),project(width/2,topY+epsilon,topX+epsilon),project(width/2,epsilon,bottomX+epsilon),project(-width/2,epsilon,bottomX+epsilon)];
  const rectify=homography([[0,0],[1,0],[1,1],[0,1]],projectedCorners);
  const sourceAt=(u,y,n)=>{const q=project(u,y,n),p=rectify(...q);return map(THREE.MathUtils.clamp(p[0],0,1),THREE.MathUtils.clamp(p[1],0,1));};
  segments.push({kind:'top-landing',a:[topX-flap,topY+epsilon],b:[topX+epsilon,topY+epsilon]});
  for(let i=0;i<steps;i++){
    const x=topX+i*tread,high=topY-i*riser,low=Math.max(0,high-riser);
    segments.push({kind:'riser',a:[x+epsilon,high+epsilon],b:[x+epsilon,low+epsilon],step:i+1});
    if(i<steps-1)segments.push({kind:'tread',a:[x+epsilon,low+epsilon],b:[x+tread+epsilon,low+epsilon],step:i+1});
  }
  segments.push({kind:'bottom-landing',a:[bottomX+epsilon,epsilon],b:[bottomX+flap,epsilon]});
  const total=segments.reduce((sum,s)=>sum+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0),positions=[],uvs=[],indices=[];
  for(const s of segments){
    const length=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),nx=20,ny=s.kind==='tread'?8:4,k=positions.length/3;
    // Subdivision approximates the projective field on actual horizontal
    // and vertical faces in both WebGL and the Canvas compatibility renderer.
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const u=(i/nx-.5)*width,n=THREE.MathUtils.lerp(s.a[0],s.b[0],j/ny),y=THREE.MathUtils.lerp(s.a[1],s.b[1],j/ny),[px,py]=sourceAt(u,y,n);
      positions.push(u,y,n);uvs.push(px/iw,1-py/ih);
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=k+j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,d,b,a,c,d);}
    s.vertexStart=k;s.vertexCount=(nx+1)*(ny+1);s.subdivisions=[nx,ny];s.projectedRange=[rectify(...project(0,s.a[1],s.a[0]))[1],rectify(...project(0,s.b[1],s.b[0]))[1]];s.unfoldedLength=length;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  const material=imageMaterial('Original_Dragon_Carpet_Folded_Over_Real_Steps',texture);material.roughness=.98;material.metalness=0;
  // The source photograph already contains textile shading; a small diffuse
  // fill keeps its illustration legible across the different face normals.
  if(texture){material.emissive.setHex(0xffffff);material.emissiveMap=texture;material.emissiveIntensity=.16;}
  const o=mesh(parent,'Original_Dragon_Carpet_Folded_Over_Real_Steps',g,material);o.userData={...o.userData,collision:'triangle-mesh',reference:'082632',sourceQuad:quad,continuousUnfoldedMapping:false,frontalProjectiveMapping:true,projectionEye:[eyeX,eyeY,0],projectionTarget:[4.9,1.35,0],projectedCorners,actualStairFaces:true,segments,totalUnfoldedLength:total,steps};
  return o;
}

export function buildCeremonialV11({reliefTexture=null,carpetTexture=null,goldColumns=null,throneAtlasTexture=null,plaqueReferenceTexture=null,leftCoupletReferenceTexture=null,ceremonyReferenceTexture=null,ritualSurfaceTexture=null}={}){
  const group=new THREE.Group();group.name='09_Centered_Reference_Throne_Ensemble';group.rotation.y=Math.PI/2;group.userData.finalHeightCoordinates=true;
  const solid=new THREE.Group();solid.name='V11_Traversable_Dais_And_Physical_Throne';const ornaments=new THREE.Group();ornaments.name='V11_Carved_Gilt_And_Ritual_Castings';const arts=new THREE.Group();arts.name='V11_Original_Brushwork_On_Structural_Columns';group.add(solid,ornaments,arts);
  const b=new Batch(solid),obstacles=[],supports=[],artworks=[],texturedSolids=[],armrests=[],walkableRects=[],stairs=[];
  const make=(name,color,roughness=.58,metalness=0)=>{const mat=new THREE.MeshStandardMaterial({color,roughness,metalness});mat.name='Ceremonial_'+name;return mat;};
  const m={gold:make('Warm_Gilt_Wood',0xb58a36,.56,.30),goldLight:make('Worn_Gilt_Edges',0xc7a453,.54,.32),goldShade:make('Carved_Amber_Recess',0x6d481f,.69,.18),dark:make('Dark_Joined_Hardwood',0x30251d,.65),red:make('Cinnabar_Red',V12_COLUMN_COLOR,.53),blue:make('Cobalt_Enamel',0x30516f,.36,.18),green:make('Patinated_Green',0x4b7869,.48,.31),ivory:make('Pale_Ivory',0xe4d7b7,.56,.20),black:make('Black_Inlay',0x161a17,.36),stone:make('Carved_Platform_Stone',0x82775e,.94),silk:make('Woven_Yellow_Seat',0xb79139,.96),daisCarving:make('Dark_Weathered_Dais_Carving',V12_JOINERY_COLOR,.71),joinery:make('Traditional_Carved_Hardwood',V12_JOINERY_COLOR,.64),joineryLight:make('Traditional_Hardwood_Edge',0x755238,.60),stepCarpet:make('Vermilion_Stair_Textile',0xb44b24,.98)};
  const wallBound=(id,u,n,w,depth,minY,maxY,extra={})=>{const o={id,type:'ceremonial',minX:n-depth/2,maxX:n+depth/2,minZ:-u-w/2,maxZ:-u+w/2,minY,maxY,...extra};obstacles.push(o);return o;};
  const support=(id,type,extra={})=>supports.push({id,type,gap:0,...extra});

  // The 2.1 m dais is continuously founded. Its back is intentionally open.
  const dais={minX:-3.6,maxX:3.4,minZ:-6.4,maxZ:6.4,y:DAIS,width:12.8,depth:7.0,height:DAIS};
  let bottom=0;for(const[i,h,w,d,mat]of[[0,.17,12.8,7,m.stone],[1,.12,12.68,6.90,m.daisCarving],[2,.20,12.54,6.80,m.dark],[3,.20,12.62,6.86,m.daisCarving],[4,.86,12.46,6.74,m.dark],[5,.18,12.62,6.86,m.daisCarving],[6,.13,12.70,6.92,m.dark],[7,.24,12.8,7,m.daisCarving]]){b.box(mat,0,bottom+h/2,-.10,w,h,d);support('dais-bearing-course-'+i,'seated-course',{childBottom:bottom,supportTop:bottom});bottom+=h;}
  wallBound('raised-dais-solid',0,-.10,12.8,7,0,DAIS,{supportSurface:true});walkableRects.push({...dais,id:'central-throne-dais'});
  for(const sign of[-1,1])for(let i=0;i<9;i++){const n=-3.15+i*.76;b.box(m.daisCarving,sign*6.245,1.11,n,.035,.70,.62);b.box(m.goldShade,sign*6.270,1.11,n,.022,.54,.47);mesh(ornaments,'Dais_Side_Pierced_Carving',carvedApronGeometry(.46,.42,.025),m.daisCarving,[sign*6.29,1.14,n],[0,sign*Math.PI/2,0]);}
  for(let i=-7;i<=7;i++){const u=i*.77;if(Math.abs(u)<1.15||Math.abs(Math.abs(u)-3.3)<1.1)continue;b.box(m.daisCarving,u,1.12,3.286,.65,.72,.03);mesh(ornaments,'Dais_Front_Carved_Panel',carvedApronGeometry(.52,.52,.04),m.daisCarving,[u,1.17,3.317]);}
  const riser=DAIS/12,tread=.4,topX=3.4,bottomX=7.8,flightWidth=1.8;
  for(const side of[-1,1]){
    const u=side*3.1,steps=[],structuralWidth=2.10;
    for(let i=0;i<11;i++){const near=topX+i*tread,far=near+tread,y=DAIS-riser*(i+1);b.box(m.daisCarving,u,y/2,(near+far)/2,structuralWidth,y,tread);b.box(m.stepCarpet,u,y+.008,(near+far)/2,flightWidth-.16,.016,tread-.012);b.box(m.stepCarpet,u,y-riser/2,far+.002,flightWidth-.16,riser,.006);const step={minX:near,maxX:far,minZ:-u-flightWidth/2,maxZ:-u+flightWidth/2,y,step:11-i};steps.push(step);wallBound('dais-stair-'+side+'-'+i,u,(near+far)/2,structuralWidth,tread,0,y,{supportSurface:true});}
    stairs.push({id:'dais-stair-'+side,axis:'x',minX:topX,maxX:bottomX,minZ:-u-flightWidth/2,maxZ:-u+flightWidth/2,bottomX,topX,bottomY:0,topY:DAIS,width:flightWidth,steps:12,treads:steps,riserHeight:riser,treadDepth:tread});
    for(const lateral of[-1,1]){
      const uu=u+lateral*(flightWidth/2+.07),nn=[3.4,4.6,5.8,7.0,7.8];
      for(const n of nn){
        const slopeY=DAIS*Math.max(0,(bottomX-n)/(bottomX-topX)),floorY=n===topX?DAIS:n===bottomX?0:Math.max(0,DAIS-riser*(Math.floor((n-topX+1e-6)/tread)+1)),h=slopeY+1.04-floorY;
        b.box(m.joinery,uu,floorY+h/2,n,.16,h,.16);b.box(m.joineryLight,uu,slopeY+1.06,n,.22,.07,.22);
        b.add(new THREE.CylinderGeometry(.09,.13,.09,8),m.joinery,[uu,slopeY+1.14,n],[1,1,1]);
        b.box(m.joineryLight,uu,floorY+.09,n,.22,.18,.22);
        support('stair-rail-post-'+side+'-'+lateral+'-'+n,'seated-on-tread',{childBottom:floorY,supportTop:floorY});
      }
      b.rod(m.joinery,[uu,DAIS+1.04,topX],[uu,1.04,bottomX],.080);b.rod(m.joinery,[uu,DAIS+.35,topX],[uu,.35,bottomX],.055);
      const pitch=-DAIS/(bottomX-topX);
      for(let i=0;i<nn.length-1;i++){
        const n=(nn[i]+nn[i+1])/2,y=DAIS*(bottomX-n)/(bottomX-topX),w=nn[i+1]-nn[i]-.165;
        const panel=mesh(ornaments,`Dais_Stair_Ruyi_Pierced_Panel_${side}_${lateral}_${i}`,stairCarvedPanel(w,.53,pitch),m.joinery,[uu,y+.68,n],[0,-Math.PI/2,0]);
        panel.userData.traditionalWoodwork='ruyi-cloud-pierced-hardwood';panel.userData.physicalOpenings=3;
        const apronGeometry=pitchedApronGeometry(w,.16,.050,pitch);
        mesh(ornaments,`Dais_Stair_Carved_Apron_${side}_${lateral}_${i}`,apronGeometry,m.joineryLight,[uu,y+.33,n],[0,-Math.PI/2,0]);
      }
      wallBound('stair-rail-'+side+'-'+lateral,uu,(topX+bottomX)/2,.14,bottomX-topX,0,DAIS+1.14,{stairRail:true,axis:'x',bottomX,topX,bottomY:0,topY:DAIS,railBaseOffset:.32,railHeight:1.12});
    }
  }
  // The central illustrated carpet follows twelve real risers; it is no
  // longer a diagonal apron. All three approaches are open to the visitor.
  const centralWidth=2.10,centralTreads=[];
  for(let i=0;i<11;i++){
    const near=topX+i*tread,far=near+tread,y=DAIS-riser*(i+1);
    b.box(m.joinery,0,y/2,(near+far)/2,centralWidth,y,tread);
    for(const side of[-1,1])b.box(m.joineryLight,side*(centralWidth/2+.035),y-.045,(near+far)/2,.070,.090,tread);
    centralTreads.push({minX:near,maxX:far,minZ:-centralWidth/2,maxZ:centralWidth/2,y,step:11-i});
    wallBound('central-dais-stair-'+i,0,(near+far)/2,centralWidth,tread,0,y,{supportSurface:true});
  }
  const centralStair={id:'central-dragon-carpet-stair',axis:'x',minX:topX,maxX:bottomX,minZ:-centralWidth/2,maxZ:centralWidth/2,bottomX,topX,bottomY:0,topY:DAIS,width:centralWidth,steps:12,treads:centralTreads,riserHeight:riser,treadDepth:tread,carpet:'frontal-projection-on-real-stepped-faces'};
  stairs.push(centralStair);
  const foldedCarpet=foldedStairCarpet(arts,ceremonyReferenceTexture,{topX,bottomX,topY:DAIS,steps:12,tread,width:centralWidth-.12});
  for(const side of[-1,1]){const u=side*6.22,ns=[-3.35,-2.03,-.71,.61,1.93,3.20],post=.15;for(const n of ns){b.box(m.daisCarving,u,DAIS+.52,n,post,1.04,post);b.box(m.goldShade,u,DAIS+1.075,n,.22,.07,.22);}for(let i=0;i<ns.length-1;i++){const length=ns[i+1]-ns[i]-post,n=(ns[i]+ns[i+1])/2;b.box(m.daisCarving,u,DAIS+.93,n,.13,.12,length);b.box(m.daisCarving,u,DAIS+.23,n,.13,.12,length);for(let k=0;k<5;k++)b.box(m.goldShade,u,DAIS+.58,n-length/2+(k+.5)*length/5,.032,.58,.032);}wallBound('dais-side-rail-'+side,u,(ns[0]+ns.at(-1))/2,.23,ns.at(-1)-ns[0]+.22,DAIS,DAIS+1.11);}
  const runnerStart=bottomX+.24,runnerEnd=21.8*PALACE_PLAN_SCALE;
  const carpets={group:solid,metadata:[rug(solid,b,'entry-runner',carpetTexture,4.0,runnerEnd-runnerStart,0,(runnerEnd+runnerStart)/2),rug(solid,b,'dais-woven-field',carpetTexture,11.68,5.80,DAIS,-.15)]};

  // Seven supported timber screen panels remain distinct from the chair.
  const screenN=-2.55,widths=[1.04,1.04,1.04,1.60,1.04,1.04,1.04],tops=[5.78,6.19,6.64,7.08,6.64,6.19,5.78],bottomScreen=DAIS+.19;
  b.box(m.dark,0,DAIS+.095,screenN,8.60,.19,.60);b.box(m.goldShade,0,DAIS+.205,screenN,8.44,.03,.51);support('seven-panel-screen-sill','dais-supported',{childBottom:DAIS,supportTop:DAIS});
  let cursor=-(widths.reduce((sum,w)=>sum+w,0)+.065*6)/2;for(let i=0;i<7;i++){
    const w=widths[i],u=cursor+w/2,n=screenN+Math.abs(u)*.045,top=tops[i],h=top-bottomScreen;cursor+=w+.065;b.box(m.dark,u,(bottomScreen+top)/2,n,w,h,.20);
    for(const sign of[-1,1]){b.box(m.goldShade,u+sign*(w/2-.045),(bottomScreen+top)/2,n+.115,.085,h,.07);b.box(m.goldLight,u+sign*(w/2-.095),(bottomScreen+top)/2,n+.157,.018,h-.15,.015);}
    for(const y of[bottomScreen+.06,bottomScreen+.94,top-.06]){b.box(m.goldShade,u,y,n+.115,w,.11,.07);b.box(m.goldLight,u,y+.025,n+.157,w-.06,.018,.015);}
    const panelH=top-bottomScreen-1.23,panelW=w-.28,mat=imageMaterial('Screen_Subdued_Gilt_Relief_'+i,reliefTexture,{color:0x6e4e2b});
    const panel=mesh(solid,'Screen_Dragon_Panel_'+i,new THREE.BoxGeometry(panelW,panelH,.04),[m.dark,m.dark,m.dark,m.dark,mat,m.dark],[u,top-.20-panelH/2,n+.115]);panel.userData.textureRole='subdued-screen-relief';texturedSolids.push(panel);mesh(ornaments,'Screen_Scalloped_Crest_'+i,cachedCrestGeometry(w+.09,i===3?.56:.37),m.goldShade,[u,top,n+.07]);
  }
  wallBound('seven-panel-throne-screen',0,screenN+.08,8.62,.72,DAIS,7.66);

  // A physical chair with bearing legs, frame, depth, arm rails and cushion.
  // The reference alpha supplies thin solid reliefs with 71 real openings.
  const chairW=3.65,chairH=3.65,seatY=DAIS+chairH*(1-.635)+.035,atlas=throneAtlasTexture||reliefTexture;
  b.box(m.goldShade,0,DAIS+.075,.02,3.52,.15,2.36);b.box(m.gold,0,DAIS+.175,.02,3.43,.05,2.27);
  for(const sign of[-1,1])for(const n of[-.94,.94]){const u=sign*1.46;curve(solid,'Throne_Joined_Cabriole_Leg',[[u,DAIS+.20,n],[u*1.015,DAIS+.36,n+.02],[u*.985,DAIS+.83,n],[u*.985,seatY-.14,n]],.105,m.gold,32,12);b.box(m.goldShade,u,DAIS+.22,n,.28,.09,.30);}
  for(const sign of[-1,1]){b.box(m.gold,0,seatY-.13,sign*1.025,3.22,.20,.17);b.box(m.gold,sign*1.52,seatY-.13,0,.17,.20,1.93);}b.box(m.dark,0,seatY-.015,0,3.10,.07,1.99);
  const cushion=mesh(solid,'Throne_Tailored_Seat_Cushion',cushionGeometry(2.84,.115,1.78,.028),m.silk,[0,seatY+.073,0]);cushion.userData.part='physical-sitting-cushion';const cushionTop=seatY+.1305;
  for(const side of[-1,1]){
    b.box(m.gold,side*1.48,seatY+.43,-.94,.13,1.00,.15);b.box(m.gold,side*1.48,seatY+.36,.86,.14,.80,.16);b.box(m.goldShade,side*1.48,seatY+.53,-.02,.17,.16,1.88);b.box(m.gold,side*1.48,seatY+.62,-.02,.19,.045,1.92);
    for(const n of[-.62,-.15,.32,.72])b.box(m.goldShade,side*1.48,seatY+.24,n,.055,.46,.065);
    const arm=atlasFace(ornaments,'Throne_Reference_Arm_Engraving_'+side,atlas,side<0?[.025,.25,.34,.58]:[.66,.25,.985,.58],1.88,.70,[side*1.588,seatY+.26,-.02],{alpha:true,rotation:[0,side*Math.PI/2,0]});armrests.push(arm);texturedSolids.push(arm);wallBound('throne-physical-arm-'+side,side*1.50,0,.24,2.04,seatY-.22,seatY+.70);
  }
  // Slim central backing leaves the surrounding dragon cutouts transparent.
  b.box(m.goldShade,0,DAIS+1.96,-.955,.75,1.02,.15);for(const side of[-1,1]){b.box(m.gold,side*.405,DAIS+2.02,-.955,.085,1.75,.16);b.box(m.gold,side*1.02,DAIS+1.81,-.86,.095,1.08,.14);}
  for(const[part,name,n,d]of[['centralBack','Throne_Traced_Central_Crown',-.865,.09],['leftOpenwork','Throne_Traced_Left_Dragon_Openwork',-.805,.08],['rightOpenwork','Throne_Traced_Right_Dragon_Openwork',-.805,.08],['frontApron','Throne_Traced_Front_Dragon_Apron',1.105,.095],['frontFoot','Throne_Traced_Lower_Carved_Plinth',1.145,.07]]){const o=tracedOpenwork(ornaments,name,atlas,part,chairW,chairH,d,n,m.goldShade);texturedSolids.push(o);}
  const frontRail=atlasFace(ornaments,'Throne_Gem_Inlaid_Seat_Rail',atlas,[.04,.632,.96,.698],chairW*.92,chairH*.066,[0,DAIS+chairH*(1-(.632+.698)/2),1.118]);texturedSolids.push(frontRail);
  for(const side of[-1,1]){mesh(solid,'Throne_Physical_Side_Pierced_Apron',carvedApronGeometry(1.89,.58,.085),m.gold,[side*1.51,DAIS+.82,.02],[0,side*Math.PI/2,0]);b.box(m.goldShade,side*1.55,DAIS+.35,.02,.12,.20,2.20);}mesh(solid,'Throne_Rear_Pierced_Apron',carvedApronGeometry(3.10,.57,.09),m.goldShade,[0,DAIS+.81,-1.03]);
  wallBound('throne-seat-and-base',0,.02,3.28,2.30,DAIS,cushionTop);wallBound('throne-tall-carved-back',0,-.88,3.56,.28,seatY,DAIS+chairH);support('throne-bearing-legs','dais-supported',{childBottom:DAIS,supportTop:DAIS});support('throne-seat-frame','leg-tenon-supported',{childBottom:seatY-.23,supportTop:seatY-.23});
  const footstoolHeight=.48;for(const u of[-.67,.67])for(const n of[1.48,1.96])b.box(m.gold,u,DAIS+footstoolHeight/2,n,.085,footstoolHeight,.085);b.box(m.goldShade,0,DAIS+footstoolHeight+.035,1.72,1.53,.07,.66);b.box(m.silk,0,DAIS+footstoolHeight+.095,1.72,1.40,.05,.56);mesh(ornaments,'Throne_Footstool_Carved_Apron',carvedApronGeometry(1.38,.24,.05),m.gold,[0,DAIS+.35,2.035]);wallBound('throne-supported-footstool',0,1.72,1.56,.71,DAIS,DAIS+footstoolHeight+.12);
  const seatEye=[.18,cushionTop+1.08,0],standingExit=[1.85,DAIS+1.72,1.55],seatSurface={id:'throne-seat',minX:-.745,maxX:.745,minZ:-1.24,maxZ:1.24,y:cushionTop};
  const ritualSculptures=buildRitualSculpturesV11({ornaments,materials:m,wallBound,daisY:DAIS,ritualSurfaceTexture});

  // Couplets attach to the structural rear dragon cylinders, without posts of
  // their own. Original reference strokes are sampled by projective UV.
  const rearColumnX=-4.9*PALACE_PLAN_SCALE,rearColumnR=.42*PALACE_PLAN_SCALE,coupletY=8.35,coupletH=7.10,coupletW=.92,coupletN=rearColumnX+rearColumnR+.075;
  const couplets=[{side:-1,text:'天心佑夫一德永言保之遹求厥寧',texture:leftCoupletReferenceTexture,quad:[[841,219],[873,230],[849,614],[810,618]],size:[2048,902],source:'081346'},{side:1,text:'帝命式于九圍茲惟艱哉奈何弗敬',texture:ceremonyReferenceTexture,quad:[[1189,284],[1212,283],[1220,515],[1195,516]],size:[2048,848],source:'082632'}];
  for(const c of couplets){const u=c.side*4.9*PALACE_PLAN_SCALE;b.box(m.dark,u,coupletY,coupletN,coupletW+.10,coupletH+.16,.13);b.box(m.red,u,coupletY,coupletN+.076,coupletW+.035,coupletH+.07,.022);const original=referencePlane(arts,'Original_Brush_Couplet_'+c.side,c.texture,c.quad,c.size,coupletW-.055,coupletH-.065,[u,coupletY,coupletN+.089]);original.userData.text=c.text;original.userData.reference=c.source;
    for(const du of[-1,1])b.box(m.goldShade,u+du*(coupletW/2+.019),coupletY,coupletN+.087,.030,coupletH+.10,.026);
    for(const y of[coupletY-coupletH/2+.16,coupletY+coupletH/2-.16]){b.box(m.dark,u,y,rearColumnX+rearColumnR+.021,.20,.18,.042);b.rod(m.goldShade,[u,y,coupletN+.096],[u,y,coupletN+.103],.028);}
    support('couplet-saddle-fixing-'+c.side,'fixed-to-dragon-structural-round-column',{columnX:rearColumnX,columnZ:-u,columnRadius:rearColumnR,boardBackX:coupletN-.065,shaftFrontX:rearColumnX+rearColumnR,centerY:coupletY,bottomY:coupletY-(coupletH+.16)/2,topY:coupletY+(coupletH+.16)/2,raisedBy:2,originalBrushwork:true});artworks.push({kind:'vertical-calligraphy',text:c.text,reading:'top-to-bottom',supported:true,mountedOn:'structural-dragon-round-column',reference:c.source,originalBrushwork:true,centerY:coupletY,raisedBy:2});
  }

  // Rear-beam position: the plaque is behind the caisson along the entrance
  // axis, slightly lower than before. Short hardwood hangers are housed into
  // the rear beam, and fitted wedges bear directly on the tilted back face.
  const rearBeamX=-4.9*PALACE_PLAN_SCALE,beamFace=rearBeamX+.42*PALACE_PLAN_SCALE,plaqueTopY=upperWorldYV15(17.60);
  const plaqueGroup=new THREE.Group();plaqueGroup.name='Canted_Original_Jianji_Suiyou_Plaque';plaqueGroup.position.set(0,plaqueTopY,beamFace+.35);plaqueGroup.rotation.x=THREE.MathUtils.degToRad(12);arts.add(plaqueGroup);
  const pb=new Batch(plaqueGroup),plaqueW=7.60,plaqueH=3.25;
  const plaqueCore=mesh(plaqueGroup,'Inclined_Plaque_Timber_Core',new THREE.BoxGeometry(plaqueW,plaqueH,.28),m.dark,[0,-plaqueH/2,0]);
  for(const[inset,thick,mat]of[[.03,.105,m.daisCarving],[.16,.055,m.red],[.235,.065,m.goldShade],[.335,.035,m.daisCarving]]){const w=plaqueW-inset*2,h=plaqueH-inset*2;for(const side of[-1,1]){pb.box(mat,0,-plaqueH/2+side*(h/2-thick/2),.157,w,thick,.045);pb.box(mat,side*(w/2-thick/2),-plaqueH/2,.157,thick,h-thick*2,.045);}}
  const plaque=referencePlane(plaqueGroup,'Jianji_Suiyou_Original_Brushwork',plaqueReferenceTexture,[[282,330],[1705,330],[1705,817],[282,817]],[1920,1280],6.64,2.272,[0,-plaqueH/2,.164]);plaque.userData.text='建極綏猷';plaque.userData.reading='right-to-left';
  // Each saddle is cut to the actual inclined BACK plane. A rectangular
  // spacer would either leave a gap or overlap the panel at one edge.
  const plaqueAngle=plaqueGroup.rotation.x,backTopY=plaqueGroup.position.y+.14*Math.sin(plaqueAngle),backTopN=plaqueGroup.position.z-.14*Math.cos(plaqueAngle);
  const plaqueBackN=y=>backTopN+(y-backTopY)*Math.tan(plaqueAngle),wedgeY0=upperWorldYV15(17.48),wedgeY1=plaqueTopY,hangerTopY=upperWorldYV15(18.20),beamBottomY=upperWorldYV15(18.0266666667),beamTopY=upperWorldYV15(18.8266666667),hangerFront=beamFace+.08;
  for(const u of[-2.5,2.5]){
    const hanger=mesh(solid,'Rear_Plaque_Tenoned_Hardwood_Hanger_'+u,new THREE.BoxGeometry(.23,hangerTopY-wedgeY0,.16),m.dark,[u,(hangerTopY+wedgeY0)/2,beamFace]);
    hanger.userData={...hanger.userData,joinery:'rear-beam-housed-short-timber-hanger',beamBottomY,tenonTopY:hangerTopY,beamFaceX:beamFace};
    support('rear-plaque-hanger-'+u,'housed-rear-crossbeam-timber',{meshName:hanger.name,worldX:beamFace,worldZ:-u,bottomY:wedgeY0,topY:hangerTopY,beamBottomY,beamTopY,tenonDepth:.1733333333});
    const section=new THREE.Shape();section.moveTo(hangerFront,wedgeY0);section.lineTo(plaqueBackN(wedgeY0),wedgeY0);section.lineTo(plaqueBackN(wedgeY1),wedgeY1);section.lineTo(hangerFront,wedgeY1);section.closePath();
    const geometry=new THREE.ExtrudeGeometry(section,{depth:.23,bevelEnabled:false});geometry.rotateY(-Math.PI/2);geometry.translate(u+.115,0,0);
    const saddle=mesh(solid,'Inclined_Plaque_Fitted_Wedge_'+u,geometry,m.dark);saddle.userData.contactFaces={beamPlaneX:beamFace,hangerFrontX:hangerFront,plaqueBackTilt:12,yRange:[wedgeY0,wedgeY1]};
    support('inclined-plaque-beam-saddle-'+u,'rear-crossbeam-fitted-wedge',{meshName:saddle.name,worldX:beamFace,worldZ:-u,beamBottomY,beamTopY,tiltDegrees:12,fastenerLength:plaqueBackN(wedgeY1)-hangerFront,fitting:'two-exact-contact-faces'});
  }
  for(const u of[-2.50,2.50]){const rosette=new THREE.Group();rosette.position.set(u,-plaqueH+.10,.207);plaqueGroup.add(rosette);for(let j=0;j<4;j++){const a=j*Math.PI/2;mesh(rosette,'Plaque_Gilt_Four_Lobe_Clasp',new THREE.TorusGeometry(.085,.020,6,20),m.goldLight,[Math.cos(a)*.054,Math.sin(a)*.054,0]);}mesh(rosette,'Plaque_Gilt_Clasp_Centre',new THREE.SphereGeometry(.045,14,10),m.goldLight,[0,0,.014]);}
  pb.finish();artworks.push({kind:'horizontal-calligraphy',text:'建極綏猷',reading:'right-to-left',supported:true,originalBrushwork:true,reference:'082307',tiltDegrees:12,support:'rear-crossbeam-housed-timber-and-fitted-wedges',beamX:rearBeamX,behindCaisson:true});

  b.finish();group.updateMatrixWorld(true);let instances=0;group.traverse(o=>{if(o.isMesh)instances+=o.isInstancedMesh?o.count:1;});const bounds=new THREE.Box3().setFromObject(group),columns=goldColumns??[-1,1].flatMap(sx=>[-1,1].map(sz=>({x:sx*4.9*PALACE_PLAN_SCALE,z:sz*4.9*PALACE_PLAN_SCALE,radius:(sx>0?.50:.42)*PALACE_PLAN_SCALE})));
  const metadata={version:13,axis:'X',facing:'+X',entryDirection:'-X',heightCoordinates:'final-human-scale',throneCenter:[0,cushionTop,0],dais,daisRects:walkableRects,walkableRects,stairs,steps:stairs.flatMap(s=>s.treads),ramps:[],centralCarpetStair:centralStair,foldedStairCarpet:{segments:foldedCarpet.userData.segments,totalUnfoldedLength:foldedCarpet.userData.totalUnfoldedLength,sourceQuad:foldedCarpet.userData.sourceQuad,continuousMapping:true,mapping:'frontal-camera-projection',projectionEye:foldedCarpet.userData.projectionEye,projectionTarget:foldedCarpet.userData.projectionTarget,completeFromFront:true,completeWhenUnfolded:false},coupletPosition:{centerY:coupletY,bottomY:coupletY-(coupletH+.16)/2,topY:coupletY+(coupletH+.16)/2,raisedBy:2,mountedOn:'structural-dragon-round-column'},seatEye,standingExit,seatSurface,screen:{centerX:screenN,width:8.60,highestY:7.66,panels:7},rearDaisRailing:false,independentSquareCoupletPosts:0,originalCalligraphy:true,
    plaque:{tiltDegrees:12,rearBeamX,beamFaceX:beamFace,topY:plaqueTopY,frameWidth:plaqueW,frameHeight:plaqueH,behindCaisson:true,verticalDrop:.60,originalImage:'imperial-plaque-reference-v11.png',support:'short-housed-hardwood-hangers-and-fitted-wedges'},goldColumnSurfaces:columns.map(c=>({x:c.x,z:c.z,shaftRadius:c.radius??c.shaftRadius??.5,representation:'texture-on-structural-cylinder'})),dragonDecoration:{representation:'reference-texture-on-extruded-openwork',addedDragonModels:0,sculptedDragonTubes:0,realOpenings:71,texturedFurnitureSolids:texturedSolids.length,sourceAsset:'throne-atlas-v11.png',sourceSha256:tracedThrone.sourceSha256},carpets:carpets.metadata,traditionalWoodwork:{color:V12_JOINERY_COLOR,stairPanels:'pierced-ruyi-cloud',tableStyle:'carved-cabriole-and-scalloped-apron'},ritualFeatures:ritualSculptures.features,artworks,supports,instances,worldBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},historicalScope:'Reference-led adaptation for a two-storey library; not a measured archaeological reconstruction'};
  group.userData={...group.userData,...metadata};
  return{group,solid,ornaments,arts,materials:m,armrests,texturedSolids,throneRefinement:ornaments,ritualSculptures,carpets,obstacles,supports,artworks,metadata,walkableRects,daisRects:walkableRects,stairs,ramps:[],seatEye,standingExit,seatSurface,stats:{thrones:1,ceremonialScreens:7,ritualCranes:2,ritualElephants:2,ritualCensers:4,traditionalArtworks:artworks.length,columnDragons:0,texturedDragonColumns:columns.length,sculptedDragons:0,realThroneOpenworkHoles:71,texturedFurnitureSolids:texturedSolids.length,ceremonialInstances:instances,ceremonialAxis:'X',traversableDais:true,ceremonialStairFlights:3}};
}
