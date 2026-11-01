import * as THREE from 'three';

/** One unbroken painted face, with a physically scaled, repeating UV field. */
export function prepareContinuousFriezeTexture(source) {
  if (!source) return null;
  const map = source.clone();
  map.name = 'ArchitecturalDetail_Continuous_Palace_Frieze';
  map.wrapS = THREE.MirroredRepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.repeat.set(1, 1);
  map.offset.set(0, 0);
  map.anisotropy = 16;
  map.magFilter = THREE.LinearFilter;
  map.userData = { ...source.userData, architecturalDetail: true, detailPriority: true, preserveResolution: true, continuousFrieze: true };
  map.needsUpdate = true;
  return map;
}

/**
 * Returns a unit plane; scale it by [width,height,1]. `phase` is the U at its
 * local left edge. Matching phase at real beam/node joints keeps the ornament
 * continuous. Mirrored wrapping joins each tile at identical source pixels.
 */
export function continuousFriezeGeometry(width, height, { aspect = 3, phase = null } = {}) {
  if (!(width > 0 && height > 0 && aspect > 0)) throw new Error('Invalid continuous frieze dimensions');
  const repeatU = width / (height * aspect);
  const start = phase ?? (.5 - repeatU / 2);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, start + uv.getX(i) * repeatU);
  uv.needsUpdate = true;
  geometry.name = `Continuous_Frieze_${width.toFixed(5)}_${height.toFixed(5)}_${start.toFixed(5)}`;
  geometry.userData = { type: 'continuous-painted-beam-face', width, height, sourceAspect: aspect, uvStart: start, uvEnd: start + repeatU, repeatU };
  return geometry;
}
