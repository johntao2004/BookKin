import { LONG_ROOM } from '../longRoomLayout';
import { WEST_CONNECTION } from './longRoomWestConnection';
import type { CameraPosition } from '../../virtual-library-collision';

const local=(x:number,y:number,z:number):CameraPosition=>({
  x:x+WEST_CONNECTION.offsetX,y:y+WEST_CONNECTION.offsetY,z:z+WEST_CONNECTION.offsetZ,
});

// From Long Room ground reference down to the foot of the original-stair study.
// Landings retain both approach and departure legs instead of cutting the well diagonally.
const points:CameraPosition[]=[
  {x:0,y:0,z:-LONG_ROOM.length/2+1.5},local(2.08,5.4,5.72),local(2.08,5.4,3.84),
  local(2.08,3.375,0),local(2.08,3.375,-0.8),local(1.28,3.375,-0.8),
  local(-1.28,2.025,-0.8),local(-2.08,2.025,-0.8),local(-2.08,2.025,0),
  local(-2.08,0,3.84),local(-2.08,0,4.6),
];
const cumulative=[0];
for(let i=1;i<points.length;i++) {
  const a=points[i-1],b=points[i];
  cumulative.push(cumulative[i-1]+Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z));
}
export const WEST_STAIR_WALK_LENGTH=cumulative[cumulative.length-1];

/** A slope-following eye path; physical tread heights differ by at most one riser. */
export function westStairWalkPoint(distance:number):CameraPosition {
  const d=Math.max(0,Math.min(WEST_STAIR_WALK_LENGTH,distance));
  const index=Math.max(1,cumulative.findIndex(value=>value>=d));
  const a=points[index-1],b=points[index],span=cumulative[index]-cumulative[index-1];
  const t=(d-cumulative[index-1])/span;
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
}

const henryPoints:CameraPosition[]=[points[0],local(2.08,5.4,5.72),local(2.08,5.4,4.64),
  local(6.8,5.4,4.64),local(6.8,5.4,1.775)];
const henryDistances=[0];
for(let i=1;i<henryPoints.length;i++) {
  const a=henryPoints[i-1],b=henryPoints[i];
  henryDistances.push(henryDistances[i-1]+Math.hypot(b.x-a.x,b.z-a.z));
}
// Direct room switching starts just inside the room-facing threshold, beyond
// the live hall's sealed west wall and its hidden service passage.
export const HENRY_JONES_ROOM_START_DISTANCE=henryDistances[3];
export const HENRY_JONES_WALK_LENGTH=henryDistances[henryDistances.length-1];
export function henryJonesWalkPoint(distance:number):CameraPosition {
  const d=Math.max(0,Math.min(HENRY_JONES_WALK_LENGTH,distance));
  const i=Math.max(1,henryDistances.findIndex(value=>value>=d));
  const a=henryPoints[i-1],b=henryPoints[i],t=(d-henryDistances[i-1])/(henryDistances[i]-henryDistances[i-1]);
  return {x:a.x+(b.x-a.x)*t,y:0,z:a.z+(b.z-a.z)*t};
}
