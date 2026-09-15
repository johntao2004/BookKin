import {LONG_ROOM} from '../longRoomLayout';
import {EAST_STAIR as S} from './longRoomEastStair';
import type {CameraPosition} from '../../virtual-library-collision';
const points:CameraPosition[]=[{x:0,y:0,z:-1.5},{x:0,y:0,z:S.centerZ+S.radius},
  {x:S.southX,y:0,z:S.centerZ+S.radius},{x:S.turnX,y:-S.rise/2,z:S.centerZ+S.radius}];
for(let i=1;i<=64;i++) {
  const a=Math.PI*(1-i/64);
  points.push({x:S.turnX-S.radius*Math.sin(a),y:-S.rise/2,z:S.centerZ-S.radius*Math.cos(a)});
}
points.push({x:S.southX,y:-S.rise,z:S.centerZ-S.radius},{x:-1.2,y:-S.rise,z:S.centerZ-S.radius});
const distances=[0];
for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y,points[i].z-points[i-1].z));
export const EAST_STAIR_WALK_LENGTH=distances[distances.length-1];
export function eastStairWalkPoint(distance:number):CameraPosition {
  const d=Math.max(0,Math.min(EAST_STAIR_WALK_LENGTH,distance));
  const i=Math.max(1,distances.findIndex(value=>value>=d)),a=points[i-1],b=points[i];
  const t=(d-distances[i-1])/(distances[i]-distances[i-1]);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:LONG_ROOM.length/2+a.z+(b.z-a.z)*t};
}
