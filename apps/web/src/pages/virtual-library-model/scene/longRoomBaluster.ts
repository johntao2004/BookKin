import * as THREE from 'three';

/** Turned gallery baluster reconstructed from the 2021 gallery photograph.
 * Preserve the existing height and maximum radius while replacing straight tapers. */
export function createLongRoomBaluster() {
  const knots = [[0.05, 0], [0.07, 0.05], [0.038, 0.1], [0.034, 0.24], [0.065, 0.32],
    [0.045, 0.46], [0.026, 0.62], [0.05, 0.72], [0.062, 0.78]];
  const secants = knots.slice(1).map(([r, y], i) => (r - knots[i][0]) / (y - knots[i][1]));
  // Monotone tangents avoid over-wide lobes or pinched negative radii.
  const slopes = knots.map((_, i) => {
    if (i === 0 || i === knots.length - 1) return 0;
    if (secants[i - 1] * secants[i] <= 0) return 0;
    return 2 / (1 / secants[i - 1] + 1 / secants[i]);
  });
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i < knots.length - 1; i++) {
    const [r0, y0] = knots[i], [r1, y1] = knots[i + 1], h = y1 - y0;
    for (let step = 0; step < 3; step++) {
      const t = step / 3, t2 = t * t, t3 = t2 * t;
      const radius = (2 * t3 - 3 * t2 + 1) * r0 + (t3 - 2 * t2 + t) * h * slopes[i]
        + (-2 * t3 + 3 * t2) * r1 + (t3 - t2) * h * slopes[i + 1];
      profile.push(new THREE.Vector2(radius, y0 + t * h));
    }
  }
  profile.push(new THREE.Vector2(...knots[knots.length - 1] as [number, number]));
  const geometry = new THREE.LatheGeometry(profile, 20);
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * Math.PI * 0.10 / 0.6, position.getY(i) / 2.8);
  }
  return geometry;
}

/** Fit the turned member between the shared lower rail top (+0.17) and
 * handrail underside (+0.985), instead of leaving unsupported end gaps. */
export function galleryBalusterPlacement(x:number,floor:number,z:number) {
  return new THREE.Matrix4().makeScale(1,(0.985-0.17)/0.78,1).setPosition(x,floor+0.17,z);
}
