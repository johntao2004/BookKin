import * as THREE from 'three';

/** Carved eyelid study. Outer margins conform to the current portrait mesh;
 * the opening and lid fullness remain photograph-derived estimates. */
export function addSwiftEyes(root: THREE.Group, head: THREE.BufferGeometry, material: THREE.Material) {
  const surfaceGeometry = head.clone().scale(0.17, 0.218, 0.16).translate(0, 2.08, 0);
  const surfaceMaterial = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, 0, -1);
  const depth = (x: number, y: number) => {
    ray.set(new THREE.Vector3(x, y, 1), direction);
    return ray.intersectObject(surface, false)[0]?.point.z ?? 0.116;
  };
  const segments = 48, rings = 4;
  for (const side of [-1, 1]) {
    const cx = side * 0.055, cy = 2.115;
    const positions: number[] = [], indices: number[] = [];
    const centerDepth = depth(cx, cy);
    for (let ring = 0; ring <= rings; ring++) for (let index = 0; index <= segments; index++) {
      const t = ring / rings, angle = index / segments * Math.PI * 2;
      const upper = Math.sin(angle) >= 0;
      const rx = 0.022 + t * 0.009, ry = (upper ? 0.012 : 0.007) + t * (upper ? 0.009 : 0.006);
      const x = cx + Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry + side * (x - cx) * 0.055;
      const skin = depth(x, y);
      const rim = centerDepth + 0.002 - 0.001 * Math.abs(Math.cos(angle));
      const blend = t * t * (3 - 2 * t);
      const z = THREE.MathUtils.lerp(rim, skin + 0.0001, blend)
        + Math.sin(Math.PI * t) * (upper ? 0.0009 : 0.0005);
      positions.push(x, y, z);
      if (ring && index) {
        const q = ring * (segments + 1) + index;
        indices.push(q, q - segments - 2, q - 1, q, q - segments - 1, q - segments - 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const lids = new THREE.Mesh(geometry, material); lids.name = 'Swift continuous upper and lower eyelids';
    lids.castShadow = lids.receiveShadow = true; root.add(lids);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), material);
    eye.name = 'Swift recessed carved eye surface';
    eye.position.set(cx, cy, centerDepth - 0.001);
    eye.scale.set(0.024, 0.013, 0.003);
    eye.castShadow = eye.receiveShadow = true; root.add(eye);
  }
  surfaceGeometry.dispose(); surfaceMaterial.dispose();
}
