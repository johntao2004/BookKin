import * as THREE from 'three';

/** Swift portrait study from Bridgwater's 2016 side/three-quarter photographs.
 * Normalized sections are visual estimates, not photogrammetric measurements. */
export function createSwiftHeadGeometry() {
  // y, half-width, anterior facial plane, posterior skull extent.
  const sections = [
    [-1, 0, 0, 0], [-0.88, 0.43, 0.56, -0.35],
    [-0.68, 0.66, 0.73, -0.52], [-0.42, 0.79, 0.78, -0.69],
    [-0.12, 0.87, 0.82, -0.84], [0.17, 0.87, 0.81, -0.94],
    [0.43, 0.88, 0.83, -0.96], [0.68, 0.82, 0.72, -0.86],
    [0.9, 0.52, 0.44, -0.53], [1, 0, 0, 0],
  ];
  const geometry = new THREE.SphereGeometry(1, 96, 80);
  const position = geometry.getAttribute('position');
  const bump = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
    Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), angle = Math.atan2(position.getX(i), position.getZ(i));
    const index = Math.min(sections.length - 2, Math.max(0, sections.findIndex(section => section[0] >= y) - 1));
    const low = sections[index], high = sections[index + 1];
    const span = high[0] - low[0], t = THREE.MathUtils.clamp((y - low[0]) / span, 0, 1);
    const previous = sections[Math.max(0, index - 1)], next = sections[Math.min(sections.length - 1, index + 2)];
    const values = low.map((value, axis) => {
      const slopeA = (high[axis] - previous[axis]) / (high[0] - previous[0]);
      const slopeB = (next[axis] - low[axis]) / (next[0] - low[0]);
      return (2 * t ** 3 - 3 * t ** 2 + 1) * value + (t ** 3 - 2 * t ** 2 + t) * span * slopeA
        + (-2 * t ** 3 + 3 * t ** 2) * high[axis] + (t ** 3 - t ** 2) * span * slopeB;
    });
    const x = Math.sin(angle) * values[1], front = Math.cos(angle) >= 0;
    let z = front ? values[2] * Math.pow(Math.max(0, 1 - Math.sin(angle) ** 4), 0.5) : -Math.cos(angle) * values[3];
    if (front) {
      const relief = 0.22 * bump(x, y, 0, 0.12, 0.105, 0.38)
        + 0.33 * bump(x, y, 0, -0.15, 0.13, 0.15)
        + 0.07 * bump(x, y, 0, -0.28, 0.20, 0.07)
        - 0.08 * bump(x, y, 0, -0.31, 0.105, 0.035)
        + 0.055 * bump(x, y, 0, -0.43, 0.28, 0.05)
        - 0.045 * bump(x, y, 0, -0.49, 0.29, 0.022)
        + 0.055 * bump(x, y, 0, -0.54, 0.27, 0.055)
        + 0.06 * bump(x, y, 0, -0.76, 0.36, 0.12);
      z += relief;
      for (const side of [-1, 1]) {
        z -= 0.06 * bump(x, y, side * 0.34, 0.16, 0.23, 0.10);
        z += 0.035 * bump(x, y, side * 0.34, 0.28, 0.26, 0.06);
        z += 0.04 * bump(x, y, side * 0.47, -0.08, 0.25, 0.13);
        z -= 0.028 * bump(x, y, side * 0.3, -0.36, 0.06, 0.15);
      }
    }
    position.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}
