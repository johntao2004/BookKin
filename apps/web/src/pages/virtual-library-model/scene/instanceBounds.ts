import * as THREE from 'three';

/** Conservative bounds for affine instance transforms, without temporary matrices
 * or repeated sphere unions. The source box may cover several LOD geometries. */
export function instanceBounds(source: THREE.Box3, matrices: ArrayLike<number>, count: number) {
  const center = source.getCenter(new THREE.Vector3());
  const half = source.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const result = new THREE.Box3();
  for (let i = 0; i < count * 16; i += 16) {
    for (let axis = 0; axis < 3; axis++) {
      const a = matrices[i + axis], b = matrices[i + 4 + axis], c = matrices[i + 8 + axis];
      const position = a * center.x + b * center.y + c * center.z + matrices[i + 12 + axis];
      const extent = Math.abs(a) * half.x + Math.abs(b) * half.y + Math.abs(c) * half.z;
      result.min.setComponent(axis, Math.min(result.min.getComponent(axis), position - extent));
      result.max.setComponent(axis, Math.max(result.max.getComponent(axis), position + extent));
    }
  }
  return result;
}
