import * as THREE from 'three';

// Match rendered surfaces rather than camera collision boxes: a guard or arch
// may have openings through which a bookcase really is visible.
const PICK_SURFACE_EPSILON = 0.001;

export function isSceneObjectVisible(object: THREE.Object3D) {
  for (let owner: THREE.Object3D | null = object; owner; owner = owner.parent) {
    if (!owner.visible) return false;
  }
  return true;
}

function isOpaqueSurface(hit: THREE.Intersection) {
  if (!(hit.object instanceof THREE.Mesh)) return false;
  const bank = hit.object.material;
  const material = Array.isArray(bank) ? bank[hit.face?.materialIndex ?? 0] : bank;
  return material?.visible && material.colorWrite && material.opacity > 0
    && !(material.transparent && material.opacity < 1);
}

/** A hidden interaction proxy never makes an opaque wall/floor clickable. */
export function isUnoccludedSceneHit(
  raycaster: THREE.Raycaster,
  hit: THREE.Intersection,
  occluderRoots: THREE.Object3D[],
) {
  if (!isSceneObjectVisible(hit.object)) return false;
  const originalFar = raycaster.far;
  try {
    raycaster.far = Math.min(originalFar, hit.distance - PICK_SURFACE_EPSILON);
    if (raycaster.far <= raycaster.near) return true;
    // traverseVisible also skips invisible parent groups; Raycaster alone does
    // not. Resolve the live tree each time so streaming/batching cannot leave
    // stale geometry in the occlusion set.
    for (const root of occluderRoots) {
      if (!isSceneObjectVisible(root)) continue;
      let blocked = false;
      root.traverseVisible(object => {
        if (blocked || !(object instanceof THREE.Mesh) || !object.layers.test(raycaster.layers)) return;
        const surfaces: THREE.Intersection[] = [];
        object.raycast(raycaster, surfaces);
        blocked = surfaces.some(isOpaqueSurface);
      });
      if (blocked) return false;
    }
    return true;
  } finally {
    raycaster.far = originalFar;
  }
}
