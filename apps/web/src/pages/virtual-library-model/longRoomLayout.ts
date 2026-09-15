/** Metres. Historical dimensions are retained separately from the requested enlarged experience.
 * Detail dimensions remain photographic estimates; see docs/verification/trinity-long-room/reference.md.
 */
export const TRINITY_MEASURED_DIMENSIONS = { length: 63.7, width: 12.2, height: 14.2 } as const;

/** User requested a materially larger hall after reviewing the measured-scale version. */
export const LONG_ROOM = {
  length: 90,
  width: 22.3,
  height: 18.45,
  alcovesPerSide: 20,
  endMargin: 1.65,
  galleryY: 5.95,
  aisleHalfWidth: 7.1,
  galleryInnerX: 5.8,
  lowerCaseHeight: 5.4,
  upperCaseHeight: 4.95,
  caseThickness: 0.48,
  shelfRows: 6,
  vaultSpring: 11.2,
  vaultRadius: 7.25,
  camera: { targetY: 6.8, targetZ: 21.3, radius: 20.8, pitch: -0.22 },
} as const;

/** Adapted east end circulation; floor datum follows Y1.003/Y2.001.
 * Bridge depth and the three transition treads are estimates for the enlarged hall. */
export const EAST_SERVICE_ACCESS={x:-6.9,width:1.05,height:2.35} as const;
export const EAST_GALLERY_CONNECTION={front:42.5,back:43.9,center:43.2,upperFloor:5.49,steps:3,going:0.35,width:1.6} as const;

export const LONG_ROOM_BAY_PITCH = (LONG_ROOM.length - LONG_ROOM.endMargin * 2) / LONG_ROOM.alcovesPerSide;
export const longRoomBayZ = (bay: number) => LONG_ROOM.length / 2 - LONG_ROOM.endMargin
  - (bay + 0.5) * LONG_ROOM_BAY_PITCH;

export function longRoomShelfSectionId(side: number, bay: number) {
  return ((bay + LONG_ROOM.alcovesPerSide - 2) % LONG_ROOM.alcovesPerSide) * 2
    + (side === -1 ? 0 : 1);
}

/** The one live alcove reserved for the historic spiral has no bookcase. */
export const LONG_ROOM_STAIR_ALCOVE = {
  side: -1,
  bay: 0,
  sectionId: longRoomShelfSectionId(-1, 0),
} as const;

/** The next transverse case remains useful from the following alcove, while
 * its +z face borders the cleared stair bay and reads as a finished back. */
export const LONG_ROOM_STAIR_ADJACENT_CASE = {
  side: LONG_ROOM_STAIR_ALCOVE.side,
  bay: LONG_ROOM_STAIR_ALCOVE.bay + 1,
  stairFace: 1 as const,
  sectionId: longRoomShelfSectionId(LONG_ROOM_STAIR_ALCOVE.side, LONG_ROOM_STAIR_ALCOVE.bay + 1),
} as const;

/** The entrance-end north case selected in the live review is intentionally
 * open so the first window bay and gallery rail are not hidden behind casework. */
export const LONG_ROOM_FRONTMOST_CASE = {
  side: 1,
  bay: 0,
  sectionId: longRoomShelfSectionId(1, 0),
} as const;

export const LONG_ROOM_OMITTED_LIVE_CASES = [
  LONG_ROOM_STAIR_ALCOVE,
  LONG_ROOM_FRONTMOST_CASE,
] as const;

export function isLongRoomLiveCaseOmitted(side: number, bay: number) {
  return LONG_ROOM_OMITTED_LIVE_CASES.some((item) => item.side === side && item.bay === bay);
}

export function isLongRoomLiveShelfFaceOmitted(side: number, bay: number, face: number) {
  return side === LONG_ROOM_STAIR_ADJACENT_CASE.side
    && bay === LONG_ROOM_STAIR_ADJACENT_CASE.bay
    && face === LONG_ROOM_STAIR_ADJACENT_CASE.stairFace;
}

export function longRoomLiveCatalogFace(side: number, bay: number): -1 | 1 {
  return isLongRoomLiveShelfFaceOmitted(side, bay, 1) ? -1 : 1;
}

export function longRoomLiveCatalogSectionIndex(sectionId: number) {
  return sectionId - LONG_ROOM_OMITTED_LIVE_CASES.filter((item) => item.sectionId < sectionId).length;
}

export const LONG_ROOM_LIVE_SHELF_SECTION_COUNT = LONG_ROOM.alcovesPerSide * 2
  - LONG_ROOM_OMITTED_LIVE_CASES.length;

/** South entry alcove observed in the public tour; all dimensions/anchors estimated.
 * World axes: +z east, +x north. Keep the clear gallery walking strip outside this opening.
 * The stair's aisle-side edge aligns with the lower-case line instead of sitting against the rear wall. */
const HISTORIC_SPIRAL_DIAMETER = 1.8;
export const HISTORIC_SPIRAL = {
  x: -LONG_ROOM.aisleHalfWidth - HISTORIC_SPIRAL_DIAMETER / 2,
  z: longRoomBayZ(LONG_ROOM_STAIR_ALCOVE.bay),
  diameter: HISTORIC_SPIRAL_DIAMETER,
  opening: 2.2,
  landingWidth: 0.9,
} as const;

/** Guided ascent follows the photo-derived iron stair; dimensions remain estimates. */
const spiralSteps=Math.ceil(LONG_ROOM.galleryY/0.185),spiralTurn=Math.PI*2/14;
export const HISTORIC_SPIRAL_ENTRY=-(spiralSteps-0.5)*spiralTurn;
const entryCenter=HISTORIC_SPIRAL_ENTRY+spiralTurn/2;
// The landing guard ends at x=-6.75. Keep the route far enough toward the
// gallery rail to preserve the camera's 0.3 m body clearance around that end.
const WEST_GALLERY_ROUTE_X = -6.35;
const spiralPoint=(radius:number,angle:number,y:number)=>({x:HISTORIC_SPIRAL.x+radius*Math.cos(angle),y,z:HISTORIC_SPIRAL.z+radius*Math.sin(angle)});
export const GALLERY_WALK = [
  spiralPoint(1.35,entryCenter,0),
  ...Array.from({length:(spiralSteps-1)*8+1},(_,i)=>{
    const step=i/8;
    return spiralPoint(0.52,entryCenter+Math.min(step,spiralSteps-1)*spiralTurn,
      Math.min(LONG_ROOM.galleryY,(step+1)*LONG_ROOM.galleryY/spiralSteps));
  }),
  {x:HISTORIC_SPIRAL.x+1.3,y:LONG_ROOM.galleryY,z:HISTORIC_SPIRAL.z},
  {x:WEST_GALLERY_ROUTE_X,y:LONG_ROOM.galleryY,z:HISTORIC_SPIRAL.z},
  {x:WEST_GALLERY_ROUTE_X,y:LONG_ROOM.galleryY,z:-43},
  {x:6.55,y:LONG_ROOM.galleryY,z:-43},
  {x:6.55,y:LONG_ROOM.galleryY,z:EAST_GALLERY_CONNECTION.center},
  {x:0,y:LONG_ROOM.galleryY,z:EAST_GALLERY_CONNECTION.center},
  {x:0,y:LONG_ROOM.galleryY,z:EAST_GALLERY_CONNECTION.back},
  ...Array.from({length:EAST_GALLERY_CONNECTION.steps},(_,i)=>({x:0,
    y:LONG_ROOM.galleryY-(LONG_ROOM.galleryY-EAST_GALLERY_CONNECTION.upperFloor)*(i+1)/EAST_GALLERY_CONNECTION.steps,
    z:EAST_GALLERY_CONNECTION.back+(i+1)*EAST_GALLERY_CONNECTION.going})),
  {x:0,y:EAST_GALLERY_CONNECTION.upperFloor,z:49},
];
export const GALLERY_WALK_LENGTHS = GALLERY_WALK.slice(1).map((point, index) =>
  Math.hypot(point.x - GALLERY_WALK[index].x, point.y - GALLERY_WALK[index].y, point.z - GALLERY_WALK[index].z));
export const GALLERY_WALK_LENGTH = GALLERY_WALK_LENGTHS.reduce((sum, length) => sum + length, 0);
export const HISTORIC_SPIRAL_ACCESS_LENGTH = GALLERY_WALK_LENGTHS
  .slice(0, (spiralSteps - 1) * 8 + 3)
  .reduce((sum, length) => sum + length, 0);
export function galleryWalkPoint(distance: number) {
  let remaining = Math.max(0, Math.min(distance, GALLERY_WALK_LENGTH));
  for (let index = 0; index < GALLERY_WALK_LENGTHS.length; index++) {
    const length = GALLERY_WALK_LENGTHS[index];
    if (remaining <= length || index === GALLERY_WALK_LENGTHS.length - 1) {
      const a = GALLERY_WALK[index], b = GALLERY_WALK[index + 1], t = remaining / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
    remaining -= length;
  }
  return { ...GALLERY_WALK[0] };
}

/** Guided route into the west Y1.003 storage rooms. The gallery prefix is
 * shared with the normal second-floor route; the final section crosses the
 * adapted end opening and descends the three estimated transition treads. */
const westCrosswalkEnd=GALLERY_WALK.findIndex(point=>point.x===6.55&&point.z===-43);
const westUpperTail=[
  {x:0,y:LONG_ROOM.galleryY,z:-43},
  {x:0,y:LONG_ROOM.galleryY,z:-44.02},
  {x:0,y:LONG_ROOM.galleryY,z:-44.95},
  ...Array.from({length:3},(_,i)=>({x:0,
    y:LONG_ROOM.galleryY-(LONG_ROOM.galleryY-EAST_GALLERY_CONNECTION.upperFloor)*(i+1)/3,
    z:-45.1-(i+.5)*.35})),
  {x:0,y:EAST_GALLERY_CONNECTION.upperFloor,z:-46.2},
  {x:0,y:EAST_GALLERY_CONNECTION.upperFloor,z:-47.1},
  {x:-3,y:EAST_GALLERY_CONNECTION.upperFloor,z:-47.1},
  {x:-3,y:EAST_GALLERY_CONNECTION.upperFloor,z:-48},
  {x:-6.9,y:EAST_GALLERY_CONNECTION.upperFloor,z:-48},
  {x:-6.9,y:EAST_GALLERY_CONNECTION.upperFloor,z:-48.8},
  {x:-6.9,y:EAST_GALLERY_CONNECTION.upperFloor,z:-48},
  {x:-4.5,y:EAST_GALLERY_CONNECTION.upperFloor,z:-48},
];
export const WEST_UPPER_WALK=westCrosswalkEnd<0?westUpperTail:[...GALLERY_WALK.slice(0,westCrosswalkEnd+1),...westUpperTail];
export const WEST_UPPER_WALK_LENGTHS=WEST_UPPER_WALK.slice(1).map((point,index)=>
  Math.hypot(point.x-WEST_UPPER_WALK[index].x,point.y-WEST_UPPER_WALK[index].y,point.z-WEST_UPPER_WALK[index].z));
export const WEST_UPPER_WALK_LENGTH=WEST_UPPER_WALK_LENGTHS.reduce((sum,length)=>sum+length,0);
export function westUpperWalkPoint(distance:number) {
  let remaining=Math.max(0,Math.min(distance,WEST_UPPER_WALK_LENGTH));
  for(let index=0;index<WEST_UPPER_WALK_LENGTHS.length;index++) {
    const length=WEST_UPPER_WALK_LENGTHS[index];
    if(remaining<=length||index===WEST_UPPER_WALK_LENGTHS.length-1) {
      const a=WEST_UPPER_WALK[index],b=WEST_UPPER_WALK[index+1],t=length?remaining/length:0;
      return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
    }
    remaining-=length;
  }
  return {...WEST_UPPER_WALK[0]};
}
