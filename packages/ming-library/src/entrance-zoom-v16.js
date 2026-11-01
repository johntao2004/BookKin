import * as THREE from 'three';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const vector=value=>value?.isVector3?value.clone():new THREE.Vector3(...value);

/** A reversible, bounded entrance approach, measured in world-space metres.
 * The aerial overview first clears the courtyard gateway; the lower portion
 * follows the actual three stair runs and their level landings. Only camera
 * motion is prescribed. No building collision or gate state is changed.
 *
 * After an orbit or pan leaves this path, advance returns onRoute:false instead
 * of snapping back. The app may then use its usual bounded orbit behaviour.
 */
export function createEntranceZoom({library,navigation,collision,start,innerX=16}={}){
  if(!library?.entrance||!navigation||!collision||!start?.position||!start?.target)throw new TypeError('Entrance zoom requires the current library, navigation, collision and start pose');
  const eyeHeight=navigation.eyeHeight,initialEye=vector(start.position),initialTarget=vector(start.target);
  const flights=[...(library.entrance.exteriorStairs??[])].filter(s=>s.axis==='x').sort((a,b)=>b.bottomX-a.bottomX);
  if(flights.length!==3)throw new Error('Entrance zoom requires three real exterior stair runs');
  const axisZ=(flights[0].minZ+flights[0].maxZ)/2,groundY=flights[0].bottomY;
  const approachX=flights[0].bottomX+5;
  const courtyardHalf=library.courtyard?.metadata?.enclosingWallHalf??86;
  const descentX=Math.max(approachX+5,courtyardHalf-5);
  const overGateY=Math.max(6.5,groundY+10.1);
  const points=[];
  const add=p=>{if(!points.length||points.at(-1).distanceToSquared(p)>1e-12)points.push(p);};
  // Smooth only the free-air descent. Stair runs keep the exact metadata
  // profile, without a spline overshooting a terrace or clipping a tread.
  function aerial(a,b){
    const pieces=Math.max(2,Math.ceil(a.distanceTo(b)/.35));
    for(let i=0;i<=pieces;i++){
      const t=i/pieces,p=a.clone().lerp(b,t);p.y=THREE.MathUtils.lerp(a.y,b.y,smooth(t));add(p);
    }
  }
  const overGate=new THREE.Vector3(descentX,overGateY,axisZ);
  const approach=new THREE.Vector3(approachX,groundY+eyeHeight,axisZ);
  aerial(initialEye,overGate);aerial(overGate,approach);
  const approachIndex=points.length-1;
  for(const flight of flights){
    add(new THREE.Vector3(flight.bottomX,flight.bottomY+eyeHeight,axisZ));
    add(new THREE.Vector3(flight.topX,flight.topY+eyeHeight,axisZ));
  }
  add(new THREE.Vector3(innerX,flights.at(-1).topY+eyeHeight,axisZ));
  const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+points[i-1].distanceTo(points[i]));
  const length=distances.at(-1),approachDistance=distances[approachIndex];
  const endingTarget=new THREE.Vector3(0,3.4,axisZ);
  function positionAt(value){
    const progress=clamp(Number(value)||0,0,length);
    let low=0,high=distances.length-1;
    while(low+1<high){const mid=(low+high)>>1;if(distances[mid]<=progress)low=mid;else high=mid;}
    const fraction=(progress-distances[low])/(distances[high]-distances[low]||1);
    return points[low].clone().lerp(points[high],clamp(fraction,0,1));
  }
  function sample(value){
    const progress=clamp(Number(value)||0,0,length),position=positionAt(progress);
    const target=positionAt(Math.min(length,progress+12));
    if(progress>length-12)target.lerp(endingTarget,smooth((progress-(length-12))/12));
    // At the far limit the original composition is exact; closer in, the
    // look direction gradually follows the stair route at human eye level.
    target.lerp(initialTarget,1-smooth(progress/approachDistance));
    return{progress,position,target};
  }
  function project(value){
    const p=vector(value);let best={progress:0,distance:Infinity,position:points[0].clone()};
    for(let i=1;i<points.length;i++){
      const a=points[i-1],delta=points[i].clone().sub(a),t=clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1),q=a.clone().addScaledVector(delta,t),distance=p.distanceTo(q);
      if(distance<best.distance)best={progress:THREE.MathUtils.lerp(distances[i-1],distances[i],t),distance,position:q};
    }
    return best;
  }
  function isOnRoute(position,progress,tolerance=.035){return vector(position).distanceTo(positionAt(progress))<=tolerance;}
  function advance(current,distance,{radius=.20}={}){
    const requested=Number(distance),progress=clamp(Number(current.progress)||0,0,length),position=vector(current.position??positionAt(progress));
    const initial={progress,position,target:vector(current.target??sample(progress).target),onRoute:true,blocked:false,blockedByDoor:false,hit:null,travelled:0,atStart:progress<=1e-7,atEnd:progress>=length-1e-7};
    if(!Number.isFinite(requested)||!isOnRoute(position,progress))return{...initial,onRoute:false};
    const destination=clamp(progress+requested,0,length),direction=Math.sign(destination-progress);
    if(!direction)return initial;
    let acceptedProgress=progress,acceptedPosition=position;
    while(Math.abs(destination-acceptedProgress)>1e-7){
      let nextProgress=acceptedProgress+direction*Math.min(.25,Math.abs(destination-acceptedProgress));
      // Stop each sweep at every path corner, so even a very large wheel
      // delta follows all three landings instead of drawing one long chord.
      if(direction>0){for(const knot of distances)if(knot>acceptedProgress+1e-7&&knot<nextProgress){nextProgress=knot;break;}}
      else{for(let i=distances.length-1;i>=0;i--)if(distances[i]<acceptedProgress-1e-7&&distances[i]>nextProgress){nextProgress=distances[i];break;}}
      const desired=positionAt(nextProgress),segment=acceptedPosition.distanceTo(desired);
      const resolved=collision.resolve(acceptedPosition,desired,{radius,slide:false});
      const fraction=segment>1e-10?clamp(acceptedPosition.distanceTo(resolved.position)/segment,0,1):1;
      acceptedProgress=THREE.MathUtils.lerp(acceptedProgress,nextProgress,fraction);acceptedPosition=resolved.position;
      if(resolved.blocked){
        const output=sample(acceptedProgress);
        return{...output,position:acceptedPosition,onRoute:true,blocked:true,blockedByDoor:library.entrance.doors.includes(resolved.hit?.object),hit:resolved.hit,travelled:acceptedProgress-progress,atStart:acceptedProgress<=1e-7,atEnd:acceptedProgress>=length-1e-7};
      }
    }
    return{...sample(acceptedProgress),position:acceptedPosition,onRoute:true,blocked:false,blockedByDoor:false,hit:null,travelled:acceptedProgress-progress,atStart:acceptedProgress<=1e-7,atEnd:acceptedProgress>=length-1e-7};
  }
  return{sample,positionAt,project,isOnRoute,advance,length,approachDistance,start:sample(0),end:sample(length),flights:flights.map(s=>({...s})),points:points.map(p=>p.clone()),distances:[...distances]};
}
