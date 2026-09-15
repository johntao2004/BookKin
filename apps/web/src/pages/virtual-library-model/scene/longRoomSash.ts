import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Photographic reconstruction estimate: two closed, staggered nine-light sashes.
 * Local XY is the opening, +Z faces the room. No opening mechanism is simulated.
 */
export function createLongRoomSashes(height: number, wood: THREE.Material, glass: THREE.Material) {
  const root = new THREE.Group(); root.name = 'Staggered double-hung window sashes';
  const width = 1.6, stile = 0.055, rail = 0.0475, bar = 0.035;
  const sashHeight = height / 2 + rail;
  for (let level = 0; level < 2; level++) {
    const sash = new THREE.Group(); sash.name = level ? 'Upper exterior sash' : 'Lower interior sash';
    sash.position.set(0, level ? height / 2 - rail : 0, level ? 0 : 0.075);
    const timber: THREE.BufferGeometry[] = [], panes: THREE.BufferGeometry[] = [];
    const box = (target: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z = 0) => {
      const geometry = target === timber ? createSashTimber(w,h,d) : new THREE.BoxGeometry(w,h,d);
      target.push(geometry.translate(x,y,z));
    };
    for (const side of [-1, 1]) box(timber, stile, sashHeight, 0.06, side * (width - stile) / 2, sashHeight / 2);
    for (const y of [rail / 2, sashHeight - rail / 2]) box(timber, width - stile * 2, rail, 0.06, 0, y);
    const clearWidth = width - 2 * stile, clearHeight = sashHeight - 2 * rail;
    for (const fraction of [1 / 3, 2 / 3]) {
      box(timber, bar, clearHeight, 0.05, -clearWidth / 2 + clearWidth * fraction, sashHeight / 2);
      box(timber, clearWidth, bar, 0.05, 0, rail + clearHeight * fraction);
    }
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
      // Panes tuck behind the glazing bars; shared edges do not leave light leaks.
      box(panes, clearWidth / 3, clearHeight / 3, 0.012,
        -clearWidth / 2 + clearWidth * (column + 0.5) / 3,
        rail + clearHeight * (row + 0.5) / 3, -0.006);
    }
    const frame = new THREE.Mesh(mergeGeometries(timber)!, wood);
    frame.name = 'Sash frame and glazing bars'; frame.castShadow = frame.receiveShadow = true;
    const glazing = new THREE.Mesh(mergeGeometries(panes)!, glass);
    glazing.name = 'Nine individually recessed sash panes'; glazing.receiveShadow = true;
    timber.forEach(geometry => geometry.dispose()); panes.forEach(geometry => geometry.dispose());
    sash.add(frame, glazing); root.add(sash);
  }
  return root;
}

/** Small eased edges, estimated from the photographed joinery rather than a
 * surveyed section. The bevel stays inside the existing sash/pane envelope. */
function createSashTimber(width:number,height:number,depth:number) {
  const bevel=Math.min(0.003,width/6,height/6,depth/6);
  const x=width/2-bevel,y=height/2-bevel;
  const shape=new THREE.Shape();
  shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:depth-2*bevel,bevelEnabled:true,
    bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,steps:1,curveSegments:1});
  geometry.translate(0,0,-depth/2+bevel);
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
  const along=height>=width ? 1 : 0;
  const coordinate=(i:number,axis:number)=>axis===0?position.getX(i):axis===1?position.getY(i):position.getZ(i);
  for(let i=0;i<position.count;i++) {
    const normals=[Math.abs(normal.getX(i)),Math.abs(normal.getY(i)),Math.abs(normal.getZ(i))];
    const face=normals.indexOf(Math.max(...normals)),axes=[0,1,2].filter(axis=>axis!==face);
    const grain=face===along?axes[1]:along,across=axes.find(axis=>axis!==grain)!;
    uv.setXY(i,coordinate(i,across)/0.6,coordinate(i,grain)/(face===along?0.6:2.8));
  }
  return geometry;
}
