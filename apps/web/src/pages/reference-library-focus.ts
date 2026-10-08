import * as THREE from 'three';
import type { ShelfCategoryInfo } from './virtual-library-scene';
import { REFERENCE_LIBRARY } from './virtual-library-model/hogwartsLibraryLayout';

type ShelfFrame = Pick<ShelfCategoryInfo, 'centerX' | 'centerZ' | 'angle' | 'targetY' | 'height' | 'width'>;

/** The actual shelf front, including upper-floor elevation and either face. */
export function getReferenceShelfFrame(info: ShelfFrame) {
  if (info.centerX === undefined || info.centerZ === undefined) return [];
  const {centerX, centerZ, angle, width, height, targetY} = info;
  const front = REFERENCE_LIBRARY.shelfFrontOffset;
  return [-1, 1].flatMap(side => [-1, 1].map(vertical => new THREE.Vector3(
    centerX - Math.cos(angle) * front + Math.sin(angle) * side * width / 2,
    targetY + vertical * height / 2,
    centerZ - Math.sin(angle) * front - Math.cos(angle) * side * width / 2,
  )));
}

/** Fit after collision resolution; end walls can shorten the nominal radius. */
export function getReferenceShelfFocusFov(camera: THREE.PerspectiveCamera, info: ShelfFrame) {
  camera.updateMatrixWorld(true);
  const points = getReferenceShelfFrame(info);
  if (!points.length) return camera.fov;
  let tangent = 0;
  for (const point of points) {
    point.applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(camera.near, -point.z);
    tangent = Math.max(tangent, Math.abs(point.y) / depth, Math.abs(point.x) / (depth * camera.aspect));
  }
  return THREE.MathUtils.radToDeg(2 * Math.atan(tangent * 1.12));
}
