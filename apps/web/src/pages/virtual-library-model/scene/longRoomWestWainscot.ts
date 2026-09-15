import * as THREE from 'three';
import { mapWestPanelGrain } from './longRoomWestOak';

/** Raking timber dado visible in Casey 2018, p.26. Panel count and profiles are estimates. */
export function createWestRakingWainscot(run: number, rise: number, depth: number,
  wood: THREE.MeshStandardMaterial, trim: THREE.MeshStandardMaterial) {
  const group = new THREE.Group(); group.name = 'West stair raking paneled wainscot';
  const slope = rise / run;
  const outline = (x: number, width: number, base: number, height: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(x, slope * x + base);
    shape.lineTo(x + width, slope * (x + width) + base);
    shape.lineTo(x + width, slope * (x + width) + base + height);
    shape.lineTo(x, slope * x + base + height); shape.closePath();
    return shape;
  };
  const add = (shape: THREE.Shape, thickness: number, z: number, name: string,
    material: THREE.MeshStandardMaterial, bevel = false, raking = false) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: thickness, bevelEnabled: bevel,
      bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 3});
    mapWestPanelGrain(geometry, slope, raking);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.z = z;
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  };
  add(outline(0, run, -0.12, 1.04), depth, 0, 'Solid wall-side timber lining', wood);
  const count = Math.ceil(run / 0.8), pitch = run / count;
  for (let panel = 0; panel < count; panel++) {
    const x = panel * pitch + 0.07, width = pitch - 0.14;
    // Separate rails and stiles preserve grain direction at the timber joints.
    for (const edgeX of [x, x + width - 0.035])
      add(outline(edgeX, 0.035, 0.14, 0.58), 0.025, depth, 'West panel vertical stile', trim, true);
    for (const base of [0.14, 0.685])
      add(outline(x + 0.035, width - 0.07, base, 0.035), 0.025, depth, 'West panel raking rail', trim, true, true);
  }
  for (const [base, height, projection] of [[0.015,0.075,0.028],[0.79,0.065,0.035],[0.86,0.06,0.055]])
    add(outline(0,run,base,height), projection, depth, 'Continuous raking dado molding', trim, true, true);
  return group;
}
