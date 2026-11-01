/**
 * One set of physical datums for the palace envelope and the library frame.
 * Values are metres. The lower aisle ceiling is not an upstairs walk surface.
 */
export const PALACE_FRAME_V10 = Object.freeze({
  version: 13,
  groundY: 0,
  upperY: 6.3,
  groundBeam: Object.freeze({ centerY: 5.62, height: .64, bottomY: 5.30, topY: 5.94 }),
  lower: Object.freeze({
    wallX: 21.85, wallZ: 30.85, headerOffset: .02, headerDepth: .30,
    innerX: 21.72, innerZ: 30.72, outerColumnX: 23.1, outerColumnZ: 32.1,
    postStationsLong: Object.freeze([-32.1,-25.73,-17.05,-7.35,-4.9,4.9,7.35,17.05,25.73,32.1]),
    postStationsShort: Object.freeze([-23.1,-17.73,-10.2,0,10.2,17.73,23.1]),
  }),
  upper: Object.freeze({ wallX: 18.15, wallZ: 26.15, innerX: 17.885, innerZ: 25.885, ceilingInnerX: 17.985, ceilingInnerZ: 25.985 }),
  gallery: Object.freeze({ halfX: 18, halfZ: 26, bottomY: 6.08, thickness: .22 }),
  lowerAisleCeiling: Object.freeze({ bottomY: 6.08, thickness: .04, joistBottomY: 5.94, joistHeight: .11, lathHeight: .03 }),
  columns: Object.freeze({
    x: Object.freeze([-17.73, -10.2, 0, 10.2, 17.73]),
    z: Object.freeze([-25.73, -17.05, -7.35, 7.35, 17.05, 25.73]),
    shaftRadius: .42,
    baseRadius: .56,
  }),
  atrium: Object.freeze({ halfX:14.68, railZ:7.35, openingHalfX:14.50, openingHalfZ:7.17 }),
  ceremonial: Object.freeze({ halfX:4.9, halfZ:4.9, centerX:0, centerZ:0 }),
  stairs: Object.freeze({ centerZ:21.5, width:4.4, clearWidth:4.12, holeMinX:-1, holeMaxX:12.96, holeHalfZ:2.35, protectedHalfZ:2.95, protectedMinX:-4.5, protectedMaxX:18 }),
  walkways: Object.freeze({ crossMinX:15.5, crossMaxX:16.9, transverseMinZ:17.64, transverseMaxZ:18.85, shortWallMinZ:24.13, shortWallMaxZ:25.29, atriumMinZ:8.05, atriumMaxZ:9.15 }),
  timber: Object.freeze({ bracketMaxPitch:1.65, cofferMaxPitch:4.5 }),
  groundTransfers: Object.freeze({
    mainWidth: .54, mainHeight: .64,
    xNormalStations: Object.freeze([-25.73, -17.05, -7.35, -4.9, 4.9, 7.35, 17.05, 25.73]),
    zNormalStations: Object.freeze([-17.73, -10.2, 0, 10.2, 17.73]),
  }),
});

/** Every pillar is a bay boundary; intermediate members subdivide that bay.
 * The same stations drive facade bracket sets, internal ceiling and rafters. */
export function palaceBayStations(stations, maxPitch = PALACE_FRAME_V10.timber.bracketMaxPitch) {
  const sorted=[...new Set(stations)].sort((a,b)=>a-b),out=[];
  for(let i=0;i<sorted.length-1;i++){
    const a=sorted[i],b=sorted[i+1],n=Math.max(1,Math.ceil((b-a)/maxPitch));
    for(let j=0;j<n;j++)out.push(Number((a+(b-a)*j/n).toFixed(7)));
  }
  if(sorted.length)out.push(sorted.at(-1));
  return out;
}
