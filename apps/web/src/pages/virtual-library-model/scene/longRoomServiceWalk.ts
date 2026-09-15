import {LONG_ROOM} from '../longRoomLayout';
type Point={x:number;y:number;z:number};
/** Use the stair builder's own samples, so the guided camera follows its treads. */
export function createServiceWalk(samples:readonly Point[]) {
 const points=samples.map(p=>({...p,z:p.z+LONG_ROOM.length/2}));
 if(points.length<2)throw new Error('Service stair route requires tread samples');
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y,p.z-points[i].z));
 const length=lengths.reduce((a,b)=>a+b,0);
 return {length,pointAt(distance:number):Point {
  let remaining=Math.max(0,Math.min(distance,length));
  for(let i=0;i<lengths.length;i++) {
   if(remaining<=lengths[i]||i===lengths.length-1) {
    const a=points[i],b=points[i+1],t=lengths[i]===0?0:remaining/lengths[i];
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
   }
   remaining-=lengths[i];
  }
  return {...points[points.length-1]};
 }};
}
