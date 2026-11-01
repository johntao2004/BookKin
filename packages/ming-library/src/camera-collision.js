import * as THREE from 'three';

/**
 * Continuous camera collision for the actual library geometry.
 *
 * A swept sphere is tested against each rendered part's oriented bounding box;
 * curved roofs and explicitly marked notched solids use their actual triangles.
 * A BVH rejects remote parts.
 * Box corner/edge tests use the sphere's Euclidean distance, not an expanded
 * axis-aligned box alone. Book racks use their complete solid envelopes, so
 * adding thousands of books does not add thousands of collision bodies.
 */
const EPS = 1e-8;
const SKIN = .002;
const vec = value => value?.isVector3 ? value.clone() : Array.isArray(value) ? new THREE.Vector3(...value) : new THREE.Vector3(value?.x ?? 0, value?.y ?? 0, value?.z ?? 0);
const finite = p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const axisNames=['x','y','z'];

/** Includes the near-plane corners, even when the viewport is very wide. */
export function cameraCollisionRadius(camera, minimum=.20) {
  const near=Math.max(0,Number(camera?.near)||0);
  if(camera?.isPerspectiveCamera){
    const halfY=near*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/Math.max(.01,camera.zoom||1);
    return Math.max(minimum,Math.hypot(near,halfY,halfY*(camera.aspect||1))+.025);
  }
  return minimum;
}

function active(object,ignoreInvisible) {
  if(!ignoreInvisible || !object)return true;
  for(let p=object;p;p=p.parent)if(p.visible===false)return false;
  return true;
}
function descendant(object,ancestor){for(let p=object;p;p=p.parent)if(p===ancestor)return true;return false;}
// Decoration may be merged across a whole paved ring or tree crown. Its
// bounding box is not a wall: only the underlying physical slab / trunk is.
// Honour the explicit opt-out on ancestors as well as individual meshes.
function collisionDisabled(object){for(let p=object;p;p=p.parent)if(p.userData?.collision==='none'||p.userData?.backgroundOnly)return true;return false;}
function boxDistanceSq(p,b){
  const dx=Math.max(b.min.x-p.x,0,p.x-b.max.x),dy=Math.max(b.min.y-p.y,0,p.y-b.max.y),dz=Math.max(b.min.z-p.z,0,p.z-b.max.z);
  return dx*dx+dy*dy+dz*dz;
}
function segmentBoxEntry(from,delta,box,radius,maxT=1){
  let enter=0,exit=maxT;
  for(const key of axisNames){
    const low=box.min[key]-radius,high=box.max[key]+radius,d=delta[key],p=from[key];
    if(Math.abs(d)<EPS){if(p<low||p>high)return Infinity;continue;}
    let a=(low-p)/d,b=(high-p)/d;if(a>b)[a,b]=[b,a];
    enter=Math.max(enter,a);exit=Math.min(exit,b);if(enter>exit+EPS)return Infinity;
  }
  return exit<0||enter>maxT?Infinity:Math.max(0,enter);
}
function buildBVH(items){
  if(!items.length)return null;
  const box=new THREE.Box3();for(const item of items)box.union(item.box);
  if(items.length<=8)return {box,items};
  const size=box.getSize(new THREE.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';
  items.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));
  const half=items.length>>1;
  return {box,left:buildBVH(items.slice(0,half)),right:buildBVH(items.slice(half))};
}
function makeOBB(localBox,matrix,object,id){
  const center=localBox.getCenter(new THREE.Vector3()).applyMatrix4(matrix),e=matrix.elements;
  const axes=[new THREE.Vector3(e[0],e[1],e[2]),new THREE.Vector3(e[4],e[5],e[6]),new THREE.Vector3(e[8],e[9],e[10])];
  const localHalf=localBox.getSize(new THREE.Vector3()).multiplyScalar(.5),half=[localHalf.x,localHalf.y,localHalf.z];
  for(let i=0;i<3;i++){const scale=axes[i].length();half[i]*=scale;axes[i].multiplyScalar(scale>EPS?1/scale:0);}
  const box=localBox.clone().applyMatrix4(matrix);
  // A sheared parent requires a conservative world-space bound. Normal Three
  // mesh/instance transforms in the library have orthogonal basis columns.
  if(Math.abs(axes[0].dot(axes[1]))>.00001||Math.abs(axes[0].dot(axes[2]))>.00001||Math.abs(axes[1].dot(axes[2]))>.00001){
    return makeOBB(box,new THREE.Matrix4(),object,id);
  }
  return {kind:'box',center,axes,half,box,object,id};
}
function localPoint(p,c){const d=p.clone().sub(c.center);return c.axes.map(a=>a.dot(d));}
function localDelta(d,c){return c.axes.map(a=>a.dot(d));}
function localDistanceSq(p,h){let d=0;for(let i=0;i<3;i++){const q=Math.max(Math.abs(p[i])-h[i],0);d+=q*q;}return d;}
function boxNormal(p,c,delta){
  const n=[0,0,0];let length=0;
  for(let i=0;i<3;i++){n[i]=p[i]-clamp(p[i],-c.half[i],c.half[i]);length+=n[i]*n[i];}
  if(length<EPS){
    let index=0,depth=Infinity;
    for(let i=0;i<3;i++){const d=c.half[i]-Math.abs(p[i]);if(d<depth){depth=d;index=i;}}
    n[index]=Math.abs(p[index])>EPS?Math.sign(p[index]):delta?-Math.sign(c.axes[index].dot(delta))||1:1;
  }
  return c.axes[0].clone().multiplyScalar(n[0]).addScaledVector(c.axes[1],n[1]).addScaledVector(c.axes[2],n[2]).normalize();
}
function sweepOBB(from,delta,c,radius){
  const p=localPoint(from,c),v=localDelta(delta,c),h=c.half,r2=radius*radius;
  const distance=localDistanceSq(p,h);
  if(distance<r2-EPS)return {t:0,normal:boxNormal(p,c,delta)};
  const times=[0,1];
  for(let i=0;i<3;i++)if(Math.abs(v[i])>EPS)for(const edge of [-h[i],h[i]]){const t=(edge-p[i])/v[i];if(t>0&&t<1)times.push(t);}
  times.sort((a,b)=>a-b);
  for(let j=0;j+1<times.length;j++){
    const lo=times[j],hi=times[j+1];if(hi-lo<EPS)continue;
    const mid=(lo+hi)/2;let A=0,B=0,C=-r2;
    for(let i=0;i<3;i++){
      const pm=p[i]+v[i]*mid;
      if(pm>=-h[i]&&pm<=h[i])continue;
      const q=p[i]-(pm<-h[i]?-h[i]:h[i]);A+=v[i]*v[i];B+=2*q*v[i];C+=q*q;
    }
    let t=null;
    const atLo=A*lo*lo+B*lo+C;
    if(atLo<=EPS){
      // Tangential/outward contact is allowed. Only an inward derivative or an
      // already-penetrating start produces a zero-time collision.
      if(atLo<-EPS || 2*A*lo+B<-EPS)t=lo;
    }
    if(t===null && A>EPS){
      const disc=B*B-4*A*C;
      if(disc>=0){const root=(-B-Math.sqrt(disc))/(2*A);if(root>=lo-EPS&&root<=hi+EPS&&root>=0&&2*A*root+B<-EPS)t=clamp(root,lo,hi);}
    }
    if(t!==null&&t<=1){const point=p.map((x,i)=>x+v[i]*t);return {t,normal:boxNormal(point,c,delta)};}
  }
  return null;
}
function quadraticEntry(a,b,c){
  if(a<EPS)return null;
  const discriminant=b*b-4*a*c;if(discriminant<0)return null;
  const t=(-b-Math.sqrt(discriminant))/(2*a);
  return t>=-EPS&&t<=1+EPS&&2*a*t+b<-EPS?clamp(t,0,1):null;
}
function sweepTriangle(from,delta,c,radius){
  const triangle=c.triangle,closest=new THREE.Vector3();triangle.closestPointToPoint(from,closest);
  const offset=from.clone().sub(closest),distance=offset.length();
  if(distance<radius-1e-7){return {t:0,normal:distance>EPS?offset.multiplyScalar(1/distance):c.normal.clone().multiplyScalar(c.normal.dot(delta)>0?-1:1)};}
  let best=null;
  const offer=(t,normal)=>{if(t!==null&&t>=0&&t<=1&&(!best||t<best.t))best={t,normal};};
  const normal=c.normal,planeOffset=from.clone().sub(triangle.a).dot(normal),velocity=delta.dot(normal);
  if(Math.abs(velocity)>EPS){
    for(const side of [-1,1]){
      if(velocity*side>=0)continue;
      const t=(side*radius-planeOffset)/velocity;
      if(t<0||t>1)continue;
      const center=from.clone().addScaledVector(delta,t),point=center.clone().addScaledVector(normal,-side*radius);
      if(triangle.containsPoint(point))offer(t,normal.clone().multiplyScalar(side));
    }
  }
  const points=[triangle.a,triangle.b,triangle.c];
  for(let i=0;i<3;i++){
    const a=points[i],b=points[(i+1)%3],edge=b.clone().sub(a),len2=edge.lengthSq();
    const w=from.clone().sub(a),wDot=w.dot(edge)/len2,vDot=delta.dot(edge)/len2;
    const wp=w.clone().addScaledVector(edge,-wDot),vp=delta.clone().addScaledVector(edge,-vDot);
    const t=quadraticEntry(vp.lengthSq(),2*wp.dot(vp),wp.lengthSq()-radius*radius);
    if(t!==null){const along=wDot+vDot*t;if(along>=0&&along<=1){const n=wp.addScaledVector(vp,t).normalize();offer(t,n);}}
    const sv=from.clone().sub(a),ts=quadraticEntry(delta.lengthSq(),2*sv.dot(delta),sv.lengthSq()-radius*radius);
    if(ts!==null)offer(ts,sv.addScaledVector(delta,ts).normalize());
  }
  return best;
}
function pointIntersects(p,c,radius){
  if(c.kind==='box')return localDistanceSq(localPoint(p,c),c.half)<radius*radius-EPS;
  const q=c.triangle.closestPointToPoint(p,new THREE.Vector3());return q.distanceToSquared(p)<radius*radius-EPS;
}
function localGroupBounds(root){
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),box=new THREE.Box3(),instance=new THREE.Matrix4(),matrix=new THREE.Matrix4();
  root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;
    mesh.geometry.computeBoundingBox();const count=mesh.isInstancedMesh?mesh.count:1;
    for(let i=0;i<count;i++){
      matrix.multiplyMatrices(inverse,mesh.matrixWorld);
      if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}
      box.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix));
    }
  });return box;
}

export function createCameraCollision({library,radius=.20,groundY=null}={}){
  if(!library?.group)throw new TypeError('createCameraCollision requires a library with a Three.js group');
  const defaultRadius=Math.max(.01,Number(radius)||.20),statics=[],dynamics=[],doorDescriptors=[];
  const candidates=[library.architecture?.group??library.group,library.entrance?.group,library.ceremonial?.group,library.courtyard?.group].filter(Boolean);
  const roots=candidates.filter((root,i)=>candidates.indexOf(root)===i&&!candidates.some(other=>other!==root&&descendant(root,other)));
  const roof=library.architecture?.roof,doors=library.entrance?.doors??[];
  library.group.updateWorldMatrix(true,true);
  let serial=0;
  const instance=new THREE.Matrix4(),matrix=new THREE.Matrix4();
  for(const root of roots)root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.attributes?.position||collisionDisabled(mesh)||doors.some(door=>descendant(mesh,door)))return;
    if(library.furniture?.group&&descendant(mesh,library.furniture.group))return;
    const geometry=mesh.geometry;geometry.computeBoundingBox();
    const preciseSurface=mesh.userData?.collision!=='box'&&((roof&&descendant(mesh,roof)&&geometry.type==='BufferGeometry')
      ||mesh.userData?.collision==='triangle-mesh'||geometry.userData?.collision==='triangle-mesh');
    const count=mesh.isInstancedMesh?Math.min(mesh.count,mesh.instanceMatrix.count):1;
    for(let i=0;i<count;i++){
      matrix.copy(mesh.matrixWorld);if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}
      const id=mesh.name+'#'+i+'-'+(++serial);
      if(preciseSurface){
        const position=geometry.getAttribute('position'),indices=geometry.index,total=indices?.count??position.count;
        for(let j=0;j+2<total;j+=3){
          const read=k=>new THREE.Vector3().fromBufferAttribute(position,indices?indices.getX(k):k).applyMatrix4(matrix);
          const triangle=new THREE.Triangle(read(j),read(j+1),read(j+2));
          const normal=triangle.getNormal(new THREE.Vector3());if(normal.lengthSq()<.5)continue;
          statics.push({kind:'triangle',triangle,normal,object:mesh,id:id+'/t'+(j/3),box:new THREE.Box3().setFromPoints([triangle.a,triangle.b,triangle.c])});
        }
      }else statics.push(makeOBB(geometry.boundingBox,matrix,mesh,id));
    }
  });
  for(const b of library.furniture?.obstacles??[]){
    const local=new THREE.Box3(new THREE.Vector3(b.minX,b.minY,b.minZ),new THREE.Vector3(b.maxX,b.maxY,b.maxZ));
    statics.push(makeOBB(local,library.group.matrixWorld,library.furniture.group,'rack:'+b.id));
  }
  for(const door of doors)doorDescriptors.push({door,localBox:localGroupBounds(door)});
  const tree=buildBVH(statics.slice());
  const stats={staticColliders:statics.length,boxColliders:statics.filter(x=>x.kind==='box').length,
    triangleColliders:statics.filter(x=>x.kind==='triangle').length,
    roofTriangles:statics.filter(x=>x.kind==='triangle'&&roof&&descendant(x.object,roof)).length,
    dynamicColliders:0,lastNarrowPhaseTests:0,radius:defaultRadius};
  function refreshDynamic(){
    dynamics.length=0;
    for(const {door,localBox} of doorDescriptors){door.updateWorldMatrix(true,false);dynamics.push(makeOBB(localBox,door.matrixWorld,door,door.name));}
    stats.dynamicColliders=dynamics.length;return dynamics.length;
  }
  refreshDynamic();
  function config(options={}){return {radius:Math.max(.01,Number(options.radius)||defaultRadius),ignoreInvisible:options.ignoreInvisible!==false};}
  function isSafe(position,options={}){
    const p=vec(position),cfg=config(options);if(!finite(p))return false;
    if(Number.isFinite(groundY)&&p.y<groundY+cfg.radius-1e-7)return false;
    const check=c=>active(c.object,cfg.ignoreInvisible)&&boxDistanceSq(p,c.box)<cfg.radius*cfg.radius&&pointIntersects(p,c,cfg.radius);
    const visit=node=>{
      if(!node||boxDistanceSq(p,node.box)>=cfg.radius*cfg.radius)return false;
      if(node.items)return node.items.some(check);
      return visit(node.left)||visit(node.right);
    };
    return !visit(tree)&&!dynamics.some(check);
  }
  function sweep(fromValue,toValue,options={}){
    const from=vec(fromValue),to=vec(toValue),delta=to.clone().sub(from),cfg=config(options);stats.lastNarrowPhaseTests=0;
    if(!finite(from)||!finite(to))return {t:0,normal:new THREE.Vector3(),colliderId:'invalid-coordinate'};
    let best=null;
    if(Number.isFinite(groundY)){
      const plane=groundY+cfg.radius;
      if(from.y<plane-1e-7)best={t:0,normal:new THREE.Vector3(0,1,0),colliderId:'exterior-ground'};
      else if(delta.y<-EPS&&to.y<plane){const t=(plane-from.y)/delta.y;if(t>=0&&t<=1)best={t,normal:new THREE.Vector3(0,1,0),colliderId:'exterior-ground'};}
    }
    const test=c=>{
      if(!active(c.object,cfg.ignoreInvisible)||segmentBoxEntry(from,delta,c.box,cfg.radius,best?.t??1)===Infinity)return;
      stats.lastNarrowPhaseTests++;
      const hit=c.kind==='box'?sweepOBB(from,delta,c,cfg.radius):sweepTriangle(from,delta,c,cfg.radius);
      if(hit&&hit.t<=(best?.t??1))best={...hit,colliderId:c.id,object:c.object};
    };
    const visit=node=>{
      if(!node||segmentBoxEntry(from,delta,node.box,cfg.radius,best?.t??1)===Infinity)return;
      if(node.items){for(const item of node.items)test(item);return;}
      const left=segmentBoxEntry(from,delta,node.left.box,cfg.radius,best?.t??1),right=segmentBoxEntry(from,delta,node.right.box,cfg.radius,best?.t??1);
      if(left<=right){visit(node.left);visit(node.right);}else{visit(node.right);visit(node.left);}
    };
    visit(tree);for(const c of dynamics)test(c);return best;
  }
  function resolve(fromValue,toValue,options={}){
    const start=vec(fromValue),target=vec(toValue),cfg=config(options);
    if(!finite(start)||!finite(target))return {position:start,blocked:true,invalidStart:true,hit:null,iterations:0};
    if(!isSafe(start,cfg))return {position:start,blocked:true,invalidStart:true,hit:null,iterations:0};
    const position=start.clone();let remaining=target.clone().sub(start),blocked=false,firstHit=null,iterations=0;
    const slide=options.slide!==false,maxIterations=slide?5:1;
    for(;iterations<maxIterations&&remaining.lengthSq()>1e-12;iterations++){
      const hit=sweep(position,position.clone().add(remaining),cfg);
      if(!hit){position.add(remaining);remaining.set(0,0,0);break;}
      blocked=true;firstHit??=hit;
      const length=remaining.length(),t=Math.max(0,hit.t-SKIN/Math.max(length,SKIN));
      position.addScaledVector(remaining,t);
      if(!slide)break;
      remaining.multiplyScalar(1-t);const into=remaining.dot(hit.normal);
      if(into<0)remaining.addScaledVector(hit.normal,-into);
      else break;
    }
    // The sweep normally guarantees safety. Precision guard keeps the previous
    // legal point if a newly hidden/visible body or degenerate feature changed.
    if(!isSafe(position,cfg))return {position:start,blocked:true,hit:firstHit,iterations,invalidStart:false};
    return {position,blocked,hit:firstHit,iterations,invalidStart:false};
  }
  function findSafePosition(value,options={}){
    const desired=vec(value),cfg=config(options);if(isSafe(desired,cfg))return desired;
    const maxDistance=Math.max(0,options.maxDistance??3),directions=[];
    for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push(new THREE.Vector3(x,y,z).normalize());
    // Prefer height and lateral corrections before diagonal jumps.
    directions.sort((a,b)=>(Math.abs(a.x)+Math.abs(a.y)+Math.abs(a.z))-(Math.abs(b.x)+Math.abs(b.y)+Math.abs(b.z)));
    const step=Math.max(.08,cfg.radius*.5);
    for(let distance=step;distance<=maxDistance+EPS;distance+=step)for(const direction of directions){
      const point=desired.clone().addScaledVector(direction,distance);if(isSafe(point,cfg))return point;
    }
    if(options.fallback){const fallback=vec(options.fallback);if(isSafe(fallback,cfg))return fallback;}
    return null;
  }
  return {resolve,sweep,isSafe,findSafePosition,refreshDynamic,stats,radius:defaultRadius};
}
