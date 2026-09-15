import * as THREE from 'three';
import { makeBox } from './parts';

/** Leaf-and-scroll silhouette observed in public Long Room photographs.
 * Local +Z faces the aisle. Dimensions and carving details are estimates. */
export function createLongRoomCapital(material: THREE.Material) {
  const root = new THREE.Group(); root.name = 'Photo-derived foliate oak capital';
  root.userData.fidelity = 'photographic-silhouette-estimated-carving';
  const add = (mesh: THREE.Mesh, name: string) => {
    mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  for (const [y, width, depth, height] of [[0.025, 0.39, 0.31, 0.05], [0.09, 0.42, 0.34, 0.045],
    [0.43, 0.54, 0.39, 0.065], [0.49, 0.62, 0.44, 0.055]]) {
    add(makeBox(width, height, depth, material, 0, y, 0), 'Capital neck and layered abacus');
  }
  add(makeBox(0.36, 0.32, 0.25, material, 0, 0.25, 0), 'Capital carving core');
  // Closed relief shells: scalloped margins, raised midrib and curled leaf tips.
  const rows = 24, columns = 10, positions: number[] = [], indices: number[] = [];
  const layerSize = (rows + 1) * (columns + 1);
  for (let back = 0; back < 2; back++) for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const width = 0.004 + 0.055 * Math.pow(Math.sin(Math.PI * t), 0.65) * (0.74 + 0.26 * Math.cos(t * Math.PI * 10));
    for (let col = 0; col <= columns; col++) {
      const u = col / columns * 2 - 1;
      const curl = 0.06 * t * t + 0.065 * Math.sin(t * Math.PI * 0.85);
      const veins = 0.007 * Math.cos(t * Math.PI * 10 - Math.abs(u) * 3) * Math.abs(u) * Math.sin(Math.PI * t);
      positions.push(u * width, t * 0.29 - 0.065 * Math.pow(t, 8),
        curl + 0.024 * (1 - Math.abs(u)) * Math.sin(Math.PI * t) + veins - back * 0.009);
    }
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(a, b, c, b, d, c, a + layerSize, c + layerSize, b + layerSize, b + layerSize, c + layerSize, d + layerSize);
  }
  const perimeter = [...Array.from({length: columns + 1}, (_, i) => i),
    ...Array.from({length: rows}, (_, i) => (i + 1) * (columns + 1) + columns),
    ...Array.from({length: columns}, (_, i) => rows * (columns + 1) + columns - 1 - i),
    ...Array.from({length: rows - 1}, (_, i) => (rows - 1 - i) * (columns + 1))];
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
    indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
  }
  const leafGeometry = new THREE.BufferGeometry(); leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const uv: number[] = [];
  for (let i = 0; i < positions.length; i += 3) uv.push(positions[i] * 4 + 0.5, positions[i + 1] * 3);
  leafGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  leafGeometry.setIndex(indices); leafGeometry.computeVertexNormals();
  for (const [y, count, scale] of [[0.10, 5, 0.85], [0.21, 4, 0.72]]) {
    for (let i = 0; i < count; i++) {
      const leaf = add(new THREE.Mesh(leafGeometry, material), 'Carved scalloped leaf relief');
      leaf.position.set((i - (count - 1) / 2) * 0.085, y, 0.135);
      leaf.scale.setScalar(scale); leaf.rotation.z = -(i - (count - 1) / 2) * 0.14;
    }
  }
  // Return the leaf relief around the exposed sides, rather than stopping
  // abruptly at the front of the rectangular carving core.
  for (const side of [-1, 1]) for (let row = 0; row < 2; row++) {
    const leaf = add(new THREE.Mesh(leafGeometry, material), 'Capital side-return curled leaf');
    leaf.position.set(side * 0.18, 0.10 + row * 0.105, 0.035);
    leaf.rotation.y = side * Math.PI / 2;
    leaf.scale.setScalar(row === 0 ? 0.8 : 0.66);
  }
  for (const side of [-1, 1]) {
    const points = Array.from({length: 65}, (_, i) => {
      const t = i / 64, radius = 0.085 * (1 - t * 0.9), angle = Math.PI / 2 + t * Math.PI * 3.5;
      return new THREE.Vector3(side * (0.205 + Math.cos(angle) * radius), 0.335 + Math.sin(angle) * radius, 0.195);
    });
    const curve = new THREE.CatmullRomCurve3(points);
    const segments = 64, radialSegments = 12, radius = 0.016;
    const scroll = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
    const vertices = scroll.getAttribute('position');
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments, center = curve.getPointAt(t);
      const taper = 1 - t * 0.73;
      for (let edge = 0; edge <= radialSegments; edge++) {
        const index = ring * (radialSegments + 1) + edge;
        vertices.setXYZ(index, center.x + (vertices.getX(index) - center.x) * taper,
          center.y + (vertices.getY(index) - center.y) * taper,
          center.z + (vertices.getZ(index) - center.z) * taper);
      }
    }
    scroll.computeVertexNormals();
    add(new THREE.Mesh(scroll, material), 'Tapering carved capital volute');
    for (const t of [0, 1]) {
      const cap = add(new THREE.Mesh(new THREE.SphereGeometry(radius * (1 - t * 0.73), 12, 8), material), 'Rounded volute termination');
      cap.position.copy(curve.getPointAt(t));
    }
  }
  return root;
}
