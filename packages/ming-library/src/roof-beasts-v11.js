import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import tracedBeasts from './roof-beast-outlines-v11.json' with {type:'json'};

/** The latest user photograph (091602) shows seven walking beasts, led by an
 * immortal on a phoenix and followed uphill by a large hanging beast. The
 * labelled diagram swaps some names; the actual photograph determines count
 * and orientation, and the Palace Museum's sequence supplies the names.
 */
export const RIDGE_BEAST_ORDER_V11=Object.freeze(['dragon','phoenix','lion','heavenly-horse','sea-horse','suanni','fish-dragon']);
export const RIDGE_BEAST_NAMES_V11=Object.freeze({
  'immortal-on-phoenix':'仙人骑凤',dragon:'龙',phoenix:'凤',lion:'狮子','heavenly-horse':'天马','sea-horse':'海马',suanni:'狻猊','fish-dragon':'押鱼',xiezhi:'獬豸',douniu:'斗牛',xingshi:'行什','hanging-beast':'垂兽',
});
const REFERENCE_FEATURES={
  'immortal-on-phoenix':['human-rider','seated-robe','large-phoenix-tail','bird-beak'],
  dragon:['dragon-antlers','scaled-upright-neck','open-jaw','dorsal-crest'],
  phoenix:['layered-feather-wing','long-phoenix-tail','feather-crest','bird-beak'],
  lion:['curled-lion-mane','round-lion-head','short-muzzle'],
  'heavenly-horse':['winged-horse','layered-feather-wing','upright-ears'],
  'sea-horse':['sea-scroll-tail','horse-profile','scaled-saddle'],
  suanni:['broad-shoulder-lion','long-beard','curled-lion-mane'],
  'fish-dragon':['fish-scale-body','serrated-dorsal-fin','fish-tail'],
  xiezhi:['single-high-horn','goat-beard'],douniu:['paired-bull-horns','broad-nose','scaled-haunch'],
  xingshi:['upright-human-ape','back-wings','vajra-staff'],
  'hanging-beast':['large-rear-hanging-beast','towering-flame-tail','dragon-open-jaw','curled-horns'],
};

/** The outline dimensions are obtained from the alpha of the actual atlas.
 * No generic silhouette is placed behind an unrelated animal picture. */
export function ridgeBeastDimensionsV11(kind){
  const part=tracedBeasts.parts[kind];
  if(!part)return {width:kind==='immortal-on-phoenix'?1.8:kind==='hanging-beast'?1.7:1.2,height:kind==='hanging-beast'?2.8:1.8,depth:kind==='hanging-beast'?.64:.46,traced:false};
  const [x0,y0,x1,y1]=part.bounds;
  let height=kind==='hanging-beast'?2.40:kind==='immortal-on-phoenix'?1.58:1.48,width=(x1-x0)/(y1-y0)*height;
  const maxWidth=kind==='immortal-on-phoenix'?1.22:kind==='hanging-beast'?1.55:.86;
  if(width>maxWidth){height*=maxWidth/width;width=maxWidth;}
  return{width,height,depth:kind==='hanging-beast'?.22:kind==='immortal-on-phoenix'?.19:.17,traced:true};
}

function roundCeramicRelief(source,contours,depth,height){
  // Subdivide only the two painted caps. A distance-to-contour bulge rounds
  // the haunch, neck and torso while preserving all real silhouette openings.
  // Side walls remain closed; this is a volume, never an alpha billboard.
  const positions=[],uvs=[],groups=[],p=source.attributes.position,uv=source.attributes.uv;
  const read=i=>[p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)];
  const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])/2);
  const triangle=(a,b,c)=>{for(const q of[a,b,c]){positions.push(q[0],q[1],q[2]);uvs.push(q[3],q[4]);}};
  for(const group of source.groups){
    const start=positions.length/3;
    for(let i=group.start;i<group.start+group.count;i+=3){
      const a=read(i),b=read(i+1),c=read(i+2);
      if(group.materialIndex===0&&Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-10)continue;
      const onCap=q=>Math.abs(Math.abs(q[2])-(depth/2+.03))<2e-6;
      if(group.materialIndex===0||[a,b,c].every(onCap)&&Math.abs(a[2]-b[2])<2e-6&&Math.abs(a[2]-c[2])<2e-6){
        const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangle(a,ab,ca);triangle(ab,b,bc);triangle(ca,bc,c);triangle(ab,bc,ca);
      }else{
        // Split a matching cap/side edge as well. Otherwise a displaced cap
        // midpoint would create a tiny open T-junction at the rounded rim.
        const edge=[[a,b,c],[b,c,a],[c,a,b]].find(([p,q])=>onCap(p)&&onCap(q)&&Math.abs(p[2]-q[2])<2e-6);
        if(edge){const[p,q,r]=edge,m=midpoint(p,q);triangle(p,m,r);triangle(m,q,r);}else triangle(a,b,c);
      }
    }
    groups.push({start,count:positions.length/3-start,materialIndex:group.materialIndex});
  }
  const segments=[];for(const loop of contours)for(let i=0;i<loop.length;i++)segments.push([loop[i],loop[(i+1)%loop.length]]);
  const cache=new Map();
  const bulge=(x,y)=>{
    const key=`${Math.round(x*1e6)}/${Math.round(y*1e6)}`;if(cache.has(key))return cache.get(key);
    let distance2=Infinity;
    for(const[a,b]of segments){const dx=b.x-a.x,dy=b.y-a.y,t=THREE.MathUtils.clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1),xx=a.x+t*dx,yy=a.y+t*dy;distance2=Math.min(distance2,(x-xx)**2+(y-yy)**2);}
    const amount=depth*.23*(1-Math.exp(-Math.sqrt(distance2)/.12))*THREE.MathUtils.smoothstep(y,.04,height*.16);
    cache.set(key,amount);return amount;
  };
  for(let i=0;i<positions.length;i+=3){const z=positions[i+2],weight=THREE.MathUtils.smoothstep(Math.abs(z),depth/2-.035,depth/2+.03);positions[i+2]+=Math.sign(z)*bulge(positions[i],positions[i+1])*weight;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  for(const g of groups)geo.addGroup(g.start,g.count,g.materialIndex);
  const smooth=mergeVertices(geo,1e-5);smooth.computeVertexNormals();return smooth;
}

function tracedPrototype(kind){
  const data=tracedBeasts.parts[kind];if(!data)return null;
  const [iw,ih]=tracedBeasts.imageSize,[x0,y0,x1,y1]=data.bounds,d=ridgeBeastDimensionsV11(kind);
  const point=p=>new THREE.Vector2(((p[0]-x0)/(x1-x0)-.5)*d.width,(y1-p[1])/(y1-y0)*d.height);
  // A subpixel vertical offset keeps an earcut bridge from being exactly
  // collinear with an outside pixel edge. It is below the 1.05 px tracing
  // tolerance and avoids zero-area cap triangles becoming folds when rounded.
  const shapeContours=data.shapes.map(p=>({outline:p.outline.map(point),holes:p.holes.map((h,i)=>h.map(([x,y])=>point([x,y+.125+i*.03125])))}));
  const shapes=shapeContours.map(p=>{const s=new THREE.Shape(p.outline);for(const hole of p.holes)s.holes.push(new THREE.Path(hole));return s;});
  let geometry=new THREE.ExtrudeGeometry(shapes,{depth:d.depth,bevelEnabled:true,bevelThickness:.030,bevelSize:.008,bevelSegments:3,curveSegments:1,steps:1});geometry.translate(0,0,-d.depth/2);
  const p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    uv.setXY(i,(x0+(p.getX(i)/d.width+.5)*(x1-x0))/iw,1-(y1-p.getY(i)/d.height*(y1-y0))/ih);
  }
  p.needsUpdate=true;uv.needsUpdate=true;
  geometry=roundCeramicRelief(geometry,shapeContours.flatMap(s=>[s.outline,...s.holes]),d.depth,d.height);
  geometry.computeBoundingBox();geometry.translate(0,-geometry.boundingBox.min.y,0);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.name=`V11_${kind}_Reference_Traced_Ceramic`;
  geometry.userData={sourceAsset:tracedBeasts.source,sourceSha256:tracedBeasts.sourceSha256,kind,actualAlphaHoles:data.holes,physicalThickness:d.depth,roundedTorsoRelief:true,traceTolerancePixels:tracedBeasts.traceTolerancePixels};
  return {body:geometry,relief:null,grooves:null,traced:true,features:['reference-traced-silhouette','rounded-solid-ceramic-volume','photographic-glaze-scales-and-mane',...(data.holes?['real-openwork-holes']:[])]};
}

const outlines={
  dragon:[['M',-.58,.07],['L',-.22,.07],['C',-.06,.17,-.11,.35,-.21,.44],['C',-.44,.52,-.38,.85,-.20,1.01],['L',-.12,1.30],['L',-.20,1.47],['L',-.03,1.42],['L',.04,1.59],['L',.15,1.41],['C',.29,1.44,.36,1.33,.38,1.28],['L',.60,1.24],['L',.60,1.10],['L',.37,1.04],['C',.25,.88,.27,.73,.34,.62],['L',.36,.15],['L',.48,.07],['L',.17,.07],['L',.10,.48],['C',-.02,.47,-.08,.32,.00,.19],['L',.00,.07],['L',-.13,.02],['C',-.42,-.01,-.70,.10,-.67,.40],['C',-.65,.57,-.53,.66,-.58,.80],['C',-.39,.69,-.42,.49,-.50,.40],['C',-.60,.29,-.59,.18,-.58,.07]],
  phoenix:[['M',-.54,.08],['L',-.25,.08],['L',-.11,.22],['L',-.08,.49],['C',-.35,.56,-.48,.78,-.35,.99],['C',-.21,1.13,-.02,1.17,.05,1.39],['L',.00,1.58],['L',.14,1.52],['L',.23,1.67],['L',.28,1.47],['C',.43,1.49,.47,1.34,.44,1.26],['L',.67,1.17],['L',.43,1.12],['C',.24,.99,.17,.91,.20,.72],['C',.29,.53,.15,.43,.06,.40],['L',.07,.16],['L',.22,.08],['L',-.04,.08],['L',-.12,.15],['C',-.37,.16,-.67,.29,-.78,.58],['C',-.82,.74,-.91,.88,-.85,1.12],['C',-.71,.95,-.58,.88,-.43,.79],['C',-.49,.53,-.32,.35,-.27,.31],['L',-.33,.17],['L',-.54,.08]],
  lion:[['M',-.46,.06],['L',-.14,.06],['L',-.10,.32],['C',-.29,.35,-.41,.61,-.31,.84],['C',-.26,1.01,-.10,1.07,-.02,1.12],['C',-.12,1.35,.01,1.55,.22,1.53],['C',.41,1.55,.53,1.43,.51,1.29],['L',.66,1.23],['L',.61,1.08],['L',.42,1.05],['C',.29,.93,.26,.80,.29,.61],['L',.32,.15],['L',.46,.06],['L',.15,.06],['L',.08,.46],['C',-.06,.43,-.09,.27,-.02,.15],['L',.02,.06],['L',-.10,.02],['C',-.40,-.04,-.62,.19,-.57,.42],['C',-.57,.55,-.44,.62,-.39,.49],['C',-.47,.35,-.48,.19,-.46,.06]],
  'heavenly-horse':[['M',-.50,.06],['L',-.19,.06],['L',-.14,.34],['C',-.37,.43,-.46,.71,-.26,.89],['C',-.12,1.01,.02,1.08,.03,1.33],['L',.06,1.58],['L',.18,1.46],['L',.24,1.64],['L',.33,1.46],['C',.47,1.42,.56,1.32,.60,1.19],['L',.66,1.07],['L',.50,1.02],['L',.38,1.13],['C',.24,1.08,.23,.90,.30,.72],['L',.34,.16],['L',.48,.06],['L',.18,.06],['L',.10,.53],['C',-.05,.46,-.12,.30,-.04,.18],['L',-.01,.06],['L',-.15,.02],['C',-.47,-.01,-.67,.19,-.63,.46],['L',-.55,.65],['C',-.48,.60,-.42,.52,-.48,.43],['C',-.56,.29,-.53,.17,-.50,.06]],
  'sea-horse':[['M',-.58,.07],['L',-.20,.07],['C',-.08,.18,-.18,.33,-.22,.45],['C',-.48,.53,-.42,.84,-.19,.93],['C',-.01,1.05,.07,1.25,.02,1.43],['L',.12,1.38],['L',.24,1.60],['L',.31,1.41],['L',.49,1.34],['L',.65,1.18],['L',.60,1.06],['L',.39,1.10],['C',.23,.98,.22,.83,.30,.68],['L',.36,.17],['L',.50,.07],['L',.17,.07],['L',.08,.47],['C',-.02,.38,-.04,.27,.03,.17],['L',.03,.07],['C',-.15,-.02,-.34,-.02,-.48,.02],['C',-.77,.11,-.73,.39,-.59,.51],['L',-.68,.70],['L',-.47,.61],['C',-.38,.44,-.62,.35,-.62,.20],['L',-.58,.07]],
  suanni:[['M',-.45,.07],['L',-.13,.07],['L',-.09,.32],['C',-.32,.34,-.45,.57,-.34,.82],['C',-.30,.99,-.18,1.04,-.10,1.12],['C',-.18,1.30,-.10,1.48,.12,1.50],['C',.34,1.58,.53,1.46,.51,1.30],['L',.65,1.24],['L',.61,1.12],['L',.41,1.07],['L',.34,.94],['L',.26,.68],['L',.31,.16],['L',.46,.07],['L',.15,.07],['L',.08,.44],['C',-.07,.43,-.12,.26,-.03,.15],['L',.01,.07],['C',-.26,-.05,-.59,.07,-.60,.31],['C',-.65,.49,-.48,.64,-.43,.51],['C',-.44,.36,-.54,.22,-.45,.07]],
  'fish-dragon':[['M',-.52,.05],['L',-.16,.05],['C',.00,.20,-.05,.38,-.12,.48],['C',-.33,.48,-.41,.75,-.28,.96],['L',-.44,1.04],['L',-.24,1.15],['L',-.32,1.29],['L',-.10,1.25],['L',-.13,1.48],['L',.04,1.39],['L',.16,1.66],['L',.26,1.40],['C',.39,1.38,.40,1.30,.44,1.24],['L',.63,1.21],['L',.62,1.08],['L',.36,1.02],['C',.22,.90,.21,.74,.30,.62],['L',.34,.14],['L',.46,.05],['L',.16,.05],['L',.07,.46],['C',-.01,.44,-.07,.33,.00,.20],['L',.00,.05],['C',-.32,-.01,-.69,.04,-.74,.31],['L',-.64,.43],['L',-.74,.61],['L',-.51,.56],['L',-.43,.39],['C',-.52,.27,-.60,.16,-.52,.05]],
  xiezhi:[['M',-.47,.06],['L',-.15,.06],['L',-.10,.33],['C',-.31,.40,-.42,.63,-.29,.88],['C',-.15,1.03,-.03,1.06,.00,1.23],['L',-.06,1.40],['L',.09,1.36],['L',.22,1.70],['L',.29,1.38],['C',.39,1.39,.43,1.29,.47,1.22],['L',.64,1.16],['L',.58,1.04],['L',.39,1.04],['L',.34,.88],['L',.24,.68],['L',.29,.16],['L',.43,.06],['L',.12,.06],['L',.07,.48],['C',-.08,.43,-.12,.29,-.03,.17],['L',.00,.06],['C',-.29,-.02,-.55,.09,-.59,.31],['C',-.64,.47,-.55,.60,-.45,.59],['L',-.40,.46],['C',-.52,.35,-.53,.19,-.47,.06]],
  douniu:[['M',-.50,.06],['L',-.15,.06],['L',-.13,.33],['C',-.35,.43,-.38,.70,-.24,.91],['C',-.20,1.04,-.04,1.11,-.02,1.26],['L',-.12,1.43],['L',.05,1.39],['L',.17,1.57],['L',.29,1.42],['C',.45,1.42,.49,1.29,.47,1.24],['L',.66,1.19],['L',.62,1.06],['L',.40,1.03],['C',.26,.88,.27,.73,.32,.61],['L',.35,.16],['L',.50,.06],['L',.15,.06],['L',.08,.47],['C',-.07,.43,-.11,.27,-.02,.16],['L',.01,.06],['C',-.23,-.02,-.55,.03,-.62,.25],['C',-.71,.44,-.57,.57,-.49,.55],['L',-.47,.42],['C',-.56,.31,-.58,.17,-.50,.06]],
  xingshi:[['M',-.30,.05],['L',-.11,.05],['L',-.09,.46],['L',.04,.54],['L',.15,.43],['L',.14,.05],['L',.34,.05],['L',.37,.12],['L',.29,.18],['L',.31,.54],['L',.21,.67],['L',.23,1.04],['L',.39,1.12],['L',.44,1.25],['L',.30,1.29],['C',.37,1.46,.27,1.61,.10,1.59],['C',-.09,1.61,-.18,1.44,-.11,1.31],['L',-.15,1.18],['L',-.32,1.05],['L',-.25,.79],['L',-.13,.81],['L',-.15,.55],['L',-.30,.44],['L',-.28,.15],['L',-.37,.10],['L',-.30,.05]],
  'hanging-beast':[['M',-.64,.04],['L',.42,.04],['L',.51,.36],['C',.60,.57,.46,.86,.28,1.03],['L',.23,1.36],['C',.39,1.49,.45,1.65,.40,1.75],['L',.67,1.72],['L',.84,1.58],['L',1.03,1.57],['L',1.06,1.40],['L',.80,1.27],['C',.67,1.04,.60,.83,.52,.63],['L',.47,.37],['L',.40,.08],['L',-.45,.08],['C',-.58,.42,-.70,.65,-.64,.95],['C',-.56,1.32,-.84,1.58,-.80,2.05],['C',-.78,2.35,-.56,2.48,-.53,2.70],['C',-.31,2.47,-.41,2.18,-.15,2.01],['C',.06,1.87,.00,1.63,.13,1.49],['C',.06,1.22,-.04,1.03,-.16,.81],['C',-.22,.57,-.45,.45,-.64,.04]],
};

function shapeFrom(commands){
  const s=new THREE.Shape();
  for(const c of commands){if(c[0]==='M')s.moveTo(c[1],c[2]);else if(c[0]==='L')s.lineTo(c[1],c[2]);else s.bezierCurveTo(...c.slice(1));}
  s.closePath();return s;
}
function shell(commands,depth=.30,bevel=.035){
  return new THREE.ExtrudeGeometry(shapeFrom(commands),{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,curveSegments:7}).translate(0,0,-depth/2);
}

function prototype(kind){
  const body=[],relief=[],grooves=[],features=[],o=new THREE.Object3D();
  const surfaceZ=kind==='hanging-beast'?.291:kind==='immortal-on-phoenix'?.241:.186;
  const silhouette=outlines[kind]?shapeFrom(outlines[kind]).getPoints(16):null;
  const inside=(x,y)=>{
    if(!silhouette)return true;
    let odd=false;
    for(let i=0,j=silhouette.length-1;i<silhouette.length;j=i++){
      const a=silhouette[i],b=silhouette[j];
      if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)odd=!odd;
    }
    return odd;
  };
  const add=(target,g,p=[0,0,0],s=[1,1,1],r=[0,0,0])=>{
    o.position.set(...p);o.scale.set(...s);o.rotation.set(...r);o.updateMatrix();
    const geo=g.index?g.toNonIndexed():g.clone();geo.applyMatrix4(o.matrix);target.push(geo);
  };
  const sphere=new THREE.SphereGeometry(1,10,7),box=new THREE.BoxGeometry(1,1,1);
  const ball=(p,s,target=relief)=>add(target,sphere,p,s);
  const tube=(points,r=.016,target=relief,segments=20)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    add(target,new THREE.TubeGeometry(curve,segments,r,5,false));
  };
  const sides=(fn)=>{for(const side of[-1,1])fn(side);};
  const eye=(x,y)=>sides(s=>{ball([x,y,s*(surfaceZ+.005)],[.030,.034,.020]);ball([x+.008,y+.002,s*(surfaceZ+.024)],[.012,.015,.008],grooves);});
  const line=(pts,r=.011)=>{
    // Incised lines must remain on the solid ceramic body. This also avoids
    // floating scales beside a tapered neck or stray toe marks in the air.
    if(!pts.every(([x,y])=>inside(x,y)))return;
    sides(s=>tube(pts.map(([x,y,z=surfaceZ+.002])=>[x,y,z*s]),r,grooves,Math.max(6,pts.length*2)));
  };
  const scales=(x0,y0,rows,cols,dx=.12,dy=.11,trim=()=>true)=>{
    features.push('incised-overlapping-scales');
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const x=x0+i*dx+(j%2)*dx*.5,y=y0+j*dy;
      if(trim(x,y))line([[x-dx*.40,y+dy*.17],[x,y-dy*.28],[x+dx*.40,y+dy*.17]],.0085);
    }
  };
  const feather=(x,y,w,h,angle=0)=>{
    const cmd=[['M',0,0],['C',-w*.7,h*.48,-w*.3,h*.85,0,h],['C',w*.38,h*.73,w*.52,h*.31,0,0]];
    sides(s=>add(relief,shell(cmd,.025,.006),[x,y,s*(surfaceZ+.007)],[1,1,1],[0,0,angle]));
  };
  const wing=(x=-.13,y=.62,scale=1)=>{
    features.push('layered-feather-wing');
    for(let i=0;i<6;i++)feather(x-.08*i*scale,y+.026*i*scale,.095*scale,.43*scale,-.45-i*.10);
    line([[x-.02,y+.07],[x-.22*scale,y+.28],[x-.34*scale,y+.43]],.014);
  };
  const horn=(x,y,spread=.16)=>{
    features.push('curved-horns');
    sides(s=>tube([[x,y,s*.105],[x-.06,y+.15,s*.13],[x+spread*.12,y+.30,s*.16],[x+spread,y+.38,s*.12]],.031,body,14));
  };
  const mane=(flowing=false)=>{
    features.push(flowing?'flowing-shoulder-mane':'curled-lion-mane');
    if(flowing){for(let i=0;i<7;i++)line([[-.08+i*.042,1.39],[-.17+i*.041,1.23],[-.16+i*.037,1.00],[-.28+i*.035,.88]],.012);}
    else sides(s=>{for(let i=0;i<18;i++){const a=i/18*Math.PI*1.9;ball([.13+Math.cos(a)*.20,1.34+Math.sin(a)*.22,s*.18],[.039,.039,.033]);}});
  };
  const lionFace=()=>{
    eye(.39,1.34);sides(s=>{ball([.49,1.20,s*.16],[.09,.065,.055]);ball([.57,1.22,s*.17],[.04,.025,.025],grooves);});
    line([[.37,1.17],[.48,1.10],[.58,1.12]],.013);
    sides(s=>add(relief,shell([['M',.48,1.16],['L',.50,.98],['L',.56,1.16]],.024,.004),[0,0,s*(surfaceZ+.015)]));
  };

  if(kind==='immortal-on-phoenix'){
    // The leading figure is a seated person above a large bird, with a clear
    // human head, robe, knees, separate beak and sweeping feathered tail.
    const bird=[['M',-.76,.09],['L',.46,.09],['C',.69,.16,.79,.40,.66,.67],['L',.65,.88],['C',.70,1.08,.94,1.06,.97,.89],['L',1.14,.80],['L',.92,.76],['L',.88,.53],['C',.87,.27,.62,.20,.43,.18],['C',.11,.25,-.08,.52,-.25,.60],['C',-.49,.77,-.54,1.02,-.78,1.18],['C',-.73,.91,-.90,.73,-.76,.53],['C',-.62,.29,-.60,.24,-.76,.09]];
    add(body,shell(bird,.39,.045));
    const robe=[['M',-.32,.55],['L',.39,.55],['L',.47,.69],['L',.16,1.05],['L',.17,1.45],['L',-.09,1.46],['L',-.18,1.16],['L',-.36,.86],['L',-.32,.55]];
    add(body,shell(robe,.26,.026));ball([.05,1.60,0],[.12,.145,.12],body);
    add(grooves,box,[.03,1.76,0],[.16,.12,.14]);
    tube([[.14,1.35,.15],[.28,1.20,.17],[.24,1.03,.17]],.05,body,14);
    tube([[.19,.70,.14],[.42,.60,.18],[.44,.34,.17]],.065,body,12);
    for(let i=0;i<8;i++)line([[-.08+i*.036,1.33,.163],[-.14+i*.045,1.0,.163],[-.22+i*.055,.66,.163]],.009);
    for(let i=0;i<7;i++)line([[-.65,.32],[-.66+i*.04,.63],[-.72+i*.065,.98]],.011);
    wing(.22,.37,1.2);eye(.87,.90);
    ball([.145,1.62,.09],[.028,.02,.014],grooves);
    features.push('human-rider','seated-robe','large-phoenix-tail','bird-beak');
  }else{
    add(body,shell(outlines[kind],kind==='hanging-beast'?.48:.30,kind==='hanging-beast'?.05:.035));
    if(kind==='dragon'){
      eye(.36,1.31);horn(.04,1.43,.21);scales(-.27,.54,8,4,.115,.095,(x,y)=>x<.16+(1.2-y)*.18);
      sides(s=>tube([[.01,1.59,s*.13],[-.13,1.65,s*.17],[-.19,1.76,s*.17]],.022,body,10));
      sides(s=>add(relief,shell([['M',.46,1.14],['L',.43,.96],['L',.53,1.13]],.025,.004),[0,0,s*(surfaceZ+.012)]));
      line([[.31,1.16],[.49,1.10],[.59,1.15]],.014);line([[.35,1.09],[.41,.91],[.33,.84]],.012);
      for(let i=0;i<5;i++)add(relief,shell([['M',0,0],['L',-.10,.12],['L',.04,.09]],.10,.005),[-.32+i*.03,.66+i*.13,0]);
      features.push('dragon-antlers','scaled-upright-neck','open-jaw','dorsal-crest');
    }else if(kind==='phoenix'){
      eye(.35,1.36);wing();
      for(let i=0;i<6;i++)line([[-.33,.31],[-.57+i*.035,.58],[-.80+i*.075,1.01]],.012);
      for(let i=0;i<4;i++)tube([[.14,1.46,0],[.04-i*.03,1.60+i*.035,0],[-.05-i*.08,1.65+i*.025,0]],.019,relief,12);
      features.push('long-phoenix-tail','feather-crest','bird-beak');
    }else if(kind==='lion'){
      mane();lionFace();line([[-.25,.45],[-.15,.68],[.03,.73],[.14,.65]],.018);
      features.push('round-lion-head','short-muzzle','curled-haunch');
    }else if(kind==='heavenly-horse'||kind==='sea-horse'){
      eye(.36,1.34);line([[.49,1.22],[.54,1.13],[.61,1.12]],.012);
      for(let i=0;i<6;i++)line([[.08+i*.026,1.39],[.00+i*.035,1.15],[-.10+i*.045,.99]],.010);
      if(kind==='heavenly-horse'){wing(-.07,.62,.9);features.push('winged-horse','upright-ears');}
      else{scales(-.20,.58,5,3,.12,.09);line([[-.57,.14],[-.62,.23],[-.54,.32],[-.46,.27]],.018);features.push('sea-scroll-tail','horse-profile','scaled-saddle');}
      sides(s=>add(relief,box,[.33,.11,s*.13],[.21,.085,.08]));
    }else if(kind==='suanni'){
      mane(true);lionFace();line([[-.25,.43],[-.26,.66],[-.05,.77],[.13,.66]],.017);features.push('broad-shoulder-lion','long-beard');
      line([[.42,1.10],[.38,.99],[.30,.95]],.017);
    }else if(kind==='fish-dragon'){
      eye(.35,1.31);scales(-.25,.49,9,4,.11,.10,(x,y)=>x<.20);
      for(let i=0;i<4;i++)line([[-.22,1.01+i*.1],[-.08,1.02+i*.11]],.016);
      horn(.10,1.40,.15);features.push('fish-scale-body','serrated-dorsal-fin','fish-tail');
    }else if(kind==='xiezhi'){
      eye(.35,1.29);tube([[.19,1.41,0],[.17,1.60,0],[.28,1.88,0]],.043,body,15);
      line([[.45,1.07],[.40,.91],[.33,.83]],.016);mane(true);features.push('single-high-horn','goat-beard');
    }else if(kind==='douniu'){
      eye(.36,1.31);horn(.16,1.39,.26);scales(-.28,.51,8,4,.11,.105,(x,y)=>x<.22);
      sides(s=>ball([.46,1.17,s*.16],[.12,.06,.05]));features.push('paired-bull-horns','broad-nose','scaled-haunch');
    }else if(kind==='xingshi'){
      features.push('upright-human-ape','back-wings','vajra-staff');
      ball([.13,1.43,0],[.11,.14,.20],body);eye(.23,1.47);
      sides(s=>{ball([.25,1.41,s*.17],[.08,.055,.045],body);ball([.30,1.40,s*.20],[.035,.018,.012],grooves);});
      const w=[['M',-.16,.74],['C',-.49,.87,-.58,1.12,-.64,1.31],['C',-.46,1.21,-.36,1.23,-.16,1.22]];
      sides(s=>add(relief,shell(w,.055,.012),[0,0,s*.17]));
      tube([[.39,.12,.20],[.39,.68,.20],[.39,1.24,.20]],.022,body,8);
      ball([.39,1.31,.20],[.055,.085,.055],body);
      for(let i=0;i<5;i++)line([[-.20,1.18-i*.06],[-.46,1.17-i*.065]],.012);
      line([[-.08,.87],[.10,.79],[.24,.91]],.012);
    }else if(kind==='hanging-beast'){
      features.push('large-rear-hanging-beast','towering-flame-tail','dragon-open-jaw','curled-horns');
      horn(.43,1.68,.33);eye(.78,1.62);
      scales(-.43,.24,8,6,.14,.12,(x,y)=>x<.37&&y<1.05);
      for(let i=0;i<8;i++)line([[-.38+i*.04,.86],[-.29+i*.035,1.35],[-.51+i*.045,1.90],[-.57+i*.025,2.38]],.016);
      line([[.57,1.50],[.69,1.35],[.94,1.42]],.021);
      sides(s=>{ball([.62,1.44,s*.25],[.12,.10,.055]);ball([.72,1.43,s*.25],[.05,.06,.06],grooves);});
    }
    if(kind!=='xingshi'&&kind!=='hanging-beast'){
      // Toe separations and a modeled shoulder, rather than cylinder legs.
      for(const x of[.22,.28,.34])line([[x,.07],[x-.012,.15]],.010);
      line([[-.22,.30],[-.27,.48],[-.13,.64]],.014);
    }
  }
  // Every ceramic statue has a separate base seated directly on the ridge.
  const baseWidth=kind==='immortal-on-phoenix'?1.80:kind==='hanging-beast'?1.70:1.20;
  add(body,box,[kind==='immortal-on-phoenix'?.13:kind==='hanging-beast'?.12:-.02,-.052,0],[baseWidth,.104,kind==='hanging-beast'?.64:.46]);
  const merge=list=>list.length?mergeGeometries(list,false):null;
  const result={body:merge(body),relief:merge(relief),grooves:merge(grooves),features};
  // Bottom of the ceramic base is local Y=0. Preserving an animal's shape
  // while moving its roof anchor therefore keeps the feet exactly seated.
  for(const [key,geometry]of Object.entries(result))if(geometry?.isBufferGeometry){geometry.translate(0,.104,0);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.name=`V11_${kind}_${key}`;}
  return result;
}

export function buildRidgeBeastsV11({parent,placements,materials,atlasTexture=null}){
  const group=new THREE.Group();group.name='V11_Distinct_Imperial_Ridge_Figures';parent.add(group);
  const glaze=materials.light.clone();glaze.name='V11_Amber_Glazed_Ceramic_Figures';glaze.color.setHex(atlasTexture?0xc99032:0xd9a83f);glaze.roughness=.32;glaze.metalness=.09;
  const relief=materials.gold.clone();relief.name='V11_Raised_Ceramic_Scales_Feathers_And_Curls';relief.color.setHex(0xf0bd53);relief.roughness=.36;
  const shadow=materials.shadow.clone();shadow.name='V11_Incised_Glaze_Relief_Lines';shadow.color.setHex(0x9d6a2a);shadow.roughness=.53;
  let atlasMaterial=null;
  if(atlasTexture){
    atlasTexture.colorSpace=THREE.SRGBColorSpace;atlasTexture.anisotropy=16;
    atlasTexture.userData={...atlasTexture.userData,detailPriority:true,preserveResolution:true};
    atlasMaterial=new THREE.MeshStandardMaterial({color:0xffffff,map:atlasTexture,bumpMap:atlasTexture,bumpScale:.014,metalness:.07,roughness:.35,alphaTest:.45});
    atlasMaterial.name='ArchitecturalDetail_Reference_Glazed_Ridge_Beast_Atlas';
  }
  const cache=new Map(),records=[],preserveGroups=[];
  for(const [index,p] of placements.entries()){
    if(!cache.has(p.kind)){
      // Geometry follows the same traced silhouette even without a loaded texture.
      const reference=tracedPrototype(p.kind);
      if(reference){reference.features.push(...REFERENCE_FEATURES[p.kind]);cache.set(p.kind,reference);}
      else cache.set(p.kind,prototype(p.kind));
    }
    const proto=cache.get(p.kind),instance=new THREE.Group();instance.name=`V11_Ridge_${p.tier}_${p.corner}_${RIDGE_BEAST_NAMES_V11[p.kind]}`;
    instance.position.set(...p.position);instance.rotation.y=p.yaw;instance.scale.setScalar(p.scale);
    instance.userData={preservePhysicalHeight:true,preservePlanProportions:true,preservePhysicalProportions:true,roofBeast:true,identity:p.kind,label:RIDGE_BEAST_NAMES_V11[p.kind],reference:'image(20261025-091602).png'};
    for(const[key,mat]of[['body',glaze],['relief',relief],['grooves',shadow]])if(proto[key]){
      const mesh=new THREE.Mesh(proto[key],proto.traced&&key==='body'?[atlasMaterial??glaze,glaze]:mat);mesh.name=`V11_${p.kind}_${key}`;mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.userData={roofBeast:true,beastIdentity:p.kind,detailRole:key,keepSolidInFallback:key==='body',collision:'box',referenceTraced:!!proto.traced};instance.add(mesh);
    }
    group.add(instance);preserveGroups.push(instance);
    records.push({id:`roof-figure-${index}`,kind:p.kind,label:RIDGE_BEAST_NAMES_V11[p.kind],tier:p.tier,corner:p.corner,order:p.order,fraction:p.fraction,
      position:[...p.position],scale:p.scale,yaw:p.yaw,features:[...proto.features],bodyGeometry:proto.body.name,bodyVertices:proto.body.attributes.position.count,
      seatedOnRidge:true,baseThickness:.104*p.scale,referenceTraced:!!proto.traced,actualAlphaHoles:proto.body.userData.actualAlphaHoles??0});
  }
  const metadata={version:12,distinctForms:cache.size,statueCount:records.length,walkingBeastsPerHip:7,figuresPerHip:9,slenderCeramicSection:true,preservedWorldProportions:true,order:[...RIDGE_BEAST_ORDER_V11],reference:'user-photo-091602',
    source:'https://www.dpm.org.cn/lemmas/241413.html',atlasSource:atlasTexture?tracedBeasts.source:null,referenceTracedTypes:[...cache.values()].filter(p=>p.traced).length,historicalScope:'Seven-beast arrangement from the latest supplied eave photograph; reference-led interpretation, not a measured reconstruction',records};
  group.userData.ridgeFigures=metadata;return{group,metadata,records,preserveGroups,prototypes:cache};
}
