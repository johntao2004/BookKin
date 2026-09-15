import * as THREE from 'three';
import {markCameraCollider} from '../../virtual-library-collision';
import { optimizeStaticMeshes } from './optimizeScene';

export interface LongRoomStairOptions {
  height?: number;
  diameter?: number;
  entryAngle?: number;
}

/** Independent reconstruction from Skyden67's alcove photograph. Dimensions are
 * adjustable working estimates; this is not the west pavilion's oak staircase. */
export function createLongRoomSpiralStair(material: THREE.Material, options: LongRoomStairOptions = {}) {
  const height = options.height ?? 5.8;
  const diameter = options.diameter ?? 1.8;
  const entryAngle = options.entryAngle ?? 0;
  if (!Number.isFinite(height) || height < 2.4 || !Number.isFinite(diameter) || diameter < 1.4
    || !Number.isFinite(entryAngle)) throw new RangeError('Invalid Long Room stair dimensions');
  const root = new THREE.Group();
  root.name = 'Long Room pierced iron alcove stair study';
  const count = Math.ceil(height / 0.185);
  const rise = height / count;
  const turn = Math.PI * 2 / 14;
  const radius = diameter / 2;
  const inner = 0.085;
  root.userData = {
    source: 'https://commons.wikimedia.org/wiki/File:Staircase_in_Trinity_College_Library.jpg',
    fidelity: 'photo-derived-form-estimated-dimensions',
    placement: 'unassigned-alcove', height, diameter, stepCount: count, rise,
    headroomPerTurn: rise * 14 - 0.035, railedStepCount: count - 1,
  };
  const add = (geometry: THREE.BufferGeometry, name: string, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  add(new THREE.CylinderGeometry(0.065, 0.085, height + 1.02, 16), 'Continuous iron central column', 0, (height + 1.02) / 2);
  markCameraCollider(root,{id:'historic-spiral-column',shape:'cylinder',center:{x:0,y:height/2,z:0},radius:0.085,height:height});
  const tread = new THREE.Shape();
  tread.absarc(0, 0, radius, 0, turn, false);
  tread.absarc(0, 0, inner, turn, 0, true); tread.closePath();
  const treadGeometry = new THREE.ExtrudeGeometry(tread, { depth: 0.035, bevelEnabled: false, curveSegments: 8 });
  // Local XY sector becomes an XZ tread with its top exactly on the step datum.
  treadGeometry.rotateX(Math.PI / 2);
  const riser = new THREE.Shape();
  riser.moveTo(inner, 0); riser.lineTo(radius, 0); riser.lineTo(radius, rise - 0.04);
  riser.lineTo(inner, rise - 0.04); riser.closePath();
  for (let j = 0; j < 5; j++) {
    const hole = new THREE.Path();
    hole.absarc(inner + (radius - inner) * (j + 0.5) / 5, (rise - 0.04) / 2,
      Math.min(0.052, (rise - 0.05) / 2), 0, Math.PI * 2, true);
    riser.holes.push(hole);
  }
  const riserGeometry = new THREE.ExtrudeGeometry(riser, {depth: 0.015, bevelEnabled: false, curveSegments: 6});
  const tube = (points: THREE.Vector3[], r: number, segments = 16) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, r, 6, false);
  const onCircle = (a: number, y: number, r = radius) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  for (let i = 0; i < count; i++) {
    const a = entryAngle + i * turn;
    const y = (i + 1) * rise;
    if(i>1&&i<count-2)markCameraCollider(root,{id:`historic-spiral-guard-${i}`,shape:'arc',center:{x:0,y:y+0.8,z:0},radius,radialDepth:0.03,height:1.6,startAngle:a,endAngle:a+turn,segments:6});
    const step = add(treadGeometry, 'Fan-shaped iron tread', 0, y, 0); step.rotation.y = -a;
    const plate = add(riserGeometry, 'Pierced circular riser', 0, y - rise, 0); plate.rotation.y = -a;
    add(new THREE.CylinderGeometry(0.086, 0.086, 0.05, 12), 'Column tread socket', 0, y - 0.025);
    if(i<count-1) {
      const railBase = onCircle(a, y);
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.92, 6), 'Outer upright', railBase.x, y + 0.46, railBase.z);
      // Paired scrolls lie in the tangential railing plane, not as floating balls.
      for (const direction of [-1, 1]) {
        const points = Array.from({length: 25}, (_, j) => {
          const t = j / 24;
          const theta = t * Math.PI * 2.1;
          const curl = 0.115 * (1 - t * 0.82);
          const offset = direction * (0.105 + Math.cos(theta) * curl);
          return new THREE.Vector3(railBase.x - Math.sin(a) * offset,
            y + 0.43 + Math.sin(theta) * curl * 1.8, railBase.z + Math.cos(a) * offset);
        });
        add(tube(points, 0.009, 24), 'Paired iron scroll');
      }
    }
  }
  const railPoints = Array.from({length: count * 5 + 1}, (_, i) => {
    const t = i / (count * 5);
    const step=t*(count-2);
    return onCircle(entryAngle+step*turn,Math.min(height,(step+1)*rise)+0.92);
  });
  add(tube(railPoints, 0.026, count * 5), 'Continuous helical handrail');
  const stats = optimizeStaticMeshes(root, []);
  root.userData.staticOptimization = stats;
  // Batching has copied the reusable step buffers into its final geometry.
  treadGeometry.dispose(); riserGeometry.dispose();
  return root;
}
