import { LONG_ROOM } from '../longRoomLayout';
import type { CameraPosition } from '../../virtual-library-collision';
import { FAGEL } from './longRoomFagel';
const entryZ=LONG_ROOM.length/2-1.5;
const turnZ=LONG_ROOM.length/2+FAGEL.doorZ;
const approach=turnZ-entryZ;
export const FAGEL_WALK_LENGTH=approach+8.4;
/** Central portal and both aligned partition gaps; distance is metres along floor. */
export function fagelWalkPoint(distance:number):CameraPosition {
  const d=Math.max(0,Math.min(FAGEL_WALK_LENGTH,distance));
  return {x:Math.max(0,d-approach),y:0,z:entryZ+Math.min(approach,d)};
}
