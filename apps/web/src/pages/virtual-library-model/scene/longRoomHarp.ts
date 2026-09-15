import * as THREE from 'three';
import type { LibraryMaterials } from './materials';
import { makeBox } from './parts';
import { markCameraCollider } from '../../virtual-library-collision';

/** Independent reconstruction study from the official photograph and published dimensions.
 * Overall profile and cabinet placement remain estimates; no third-party mesh is embedded.
 */
export function createLongRoomHarp(materials: LibraryMaterials) {
  const exhibit = new THREE.Group(); exhibit.name = 'Trinity medieval harp exhibit';
  exhibit.userData.fidelity = 'measured-soundbox-photo-derived-profile';
  const harp = new THREE.Group(); harp.name = 'Trinity harp with 29 brass strings';
  const profile = (points: number[][], depth: number, name: string) => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(x, y)); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: true,
      bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, steps: 1}), materials.woodDark);
    mesh.position.z = -depth / 2; mesh.name = name; mesh.castShadow = true; harp.add(mesh);
  };
  // Curved forepillar and dipping harmonic neck, matching the photographed silhouette.
  profile([[-0.18,0.025],[-0.255,0.1],[-0.3,0.23],[-0.32,0.4],[-0.31,0.56],[-0.27,0.74],
    [-0.23,0.85],[-0.18,0.83],[-0.22,0.68],[-0.24,0.51],[-0.25,0.35],[-0.23,0.18],[-0.14,0.07]], 0.065, 'Curved carved forepillar');
  profile([[-0.23,0.85],[-0.15,0.79],[-0.07,0.73],[0.01,0.71],[0.07,0.72],[0.12,0.77],
    [0.18,0.79],[0.24,0.77],[0.27,0.72],[0.23,0.69],[0.17,0.72],[0.12,0.69],[0.05,0.66],
    [-0.03,0.66],[-0.12,0.69],[-0.2,0.76]], 0.075, 'Dipping harmonic neck');
  // Soundboard width tapers from 32 cm to 12 cm (Dooley report, p.3).
  const soundbox = new THREE.BufferGeometry();
  const vertices = [-0.2,0,-0.16, -0.1,0,-0.16, 0.28,0.7,-0.06, 0.18,0.7,-0.06,
    -0.2,0,0.16, -0.1,0,0.16, 0.28,0.7,0.06, 0.18,0.7,0.06];
  soundbox.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  soundbox.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
  soundbox.computeVertexNormals();
  const box = new THREE.Mesh(soundbox, materials.woodDark); box.name = 'Tapered hollow-body soundbox'; harp.add(box);
  const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.2,0.785,0),new THREE.Vector3(-0.1,0.718,0),
    new THREE.Vector3(0,0.69,0),new THREE.Vector3(0.1,0.715,0),new THREE.Vector3(0.21,0.746,0)]);
  const stringVertices: number[] = [];
  for (let i=0;i<29;i++) {
    const t=i/28; const top=neck.getPoint(t);
    const bottom=new THREE.Vector3(-0.19+t*0.365,0.025+t*0.65,0);
    stringVertices.push(bottom.x,bottom.y,bottom.z,top.x,top.y,top.z);
    const peg=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.095,8),materials.brass);
    peg.rotation.x=Math.PI/2; peg.position.copy(top); peg.name='Transverse tuning pin'; harp.add(peg);
  }
  const strings = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',
    new THREE.Float32BufferAttribute(stringVertices,3)),new THREE.LineBasicMaterial({color:materials.brass.color}));
  strings.name='29 brass strings'; harp.add(strings);
  harp.position.y=0.88; exhibit.add(harp);
  exhibit.add(makeBox(0.96,0.84,0.64,materials.woodDark,0,0.42,0));
  exhibit.add(makeBox(1.02,0.05,0.7,materials.woodWarm,0,0.865,0));
  const glazing=new THREE.MeshPhysicalMaterial({color:materials.glass.color,transparent:true,opacity:0.1,
    roughness:0.08,depthWrite:false,side:THREE.DoubleSide});
  const cover=makeBox(1,1.05,0.68,glazing,0,1.415,0); cover.name='Protective harp display glazing'; exhibit.add(cover);
  for(const x of [-0.5,0.5]) for(const z of [-0.34,0.34]) exhibit.add(makeBox(0.012,1.05,0.012,materials.iron,x,1.415,z));
  markCameraCollider(exhibit,{id:'long-room-harp',shape:'box',center:{x:0,y:0.97,z:0},size:{x:1.02,y:1.94,z:0.7}});
  return exhibit;
}
