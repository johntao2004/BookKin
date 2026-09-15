import * as THREE from 'three';

/** Starting column visible in Tierney's existing-stair photograph (fig.11.8).
 * Profile proportions are estimates, not a copy of the unexecuted volute design. */
export function createWestStartingNewel(height: number, material: THREE.Material) {
  const root = new THREE.Group();
  root.name = 'West stair starting column newel';
  root.userData.fidelity = 'existing-photo-profile-estimate';
  const baseHeight = 0.17, neckY = height - 0.15;
  const profile = [
    [0.072, baseHeight], [0.072, baseHeight + 0.014],
    [0.082, baseHeight + 0.026], [0.082, baseHeight + 0.036],
    [0.065, baseHeight + 0.055], [0.059, baseHeight + 0.065],
    [0.064, baseHeight + 0.076], [0.063, baseHeight + 0.089],
    [0.054, baseHeight + 0.108],
    [0.055, baseHeight + (neckY - baseHeight) * 0.38],
    [0.049, neckY], [0.059, neckY + 0.012],
    [0.061, neckY + 0.025], [0.055, neckY + 0.035],
    [0.056, neckY + 0.055], [0.07, neckY + 0.08],
    [0.077, neckY + 0.10], [0.078, height - 0.034],
  ];
  const rounded: THREE.Vector2[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
    for (let j = 0; j < 5; j++) {
      const t = j / 5, blend = t * t * (3 - 2 * t);
      rounded.push(new THREE.Vector2(r0 + (r1 - r0) * blend, y0 + (y1 - y0) * t));
    }
  }
  rounded.push(new THREE.Vector2(...profile[profile.length - 1] as [number, number]));
  const shaft = new THREE.Mesh(new THREE.LatheGeometry(rounded, 48), material);
  shaft.name = 'West newel turned column and collars'; root.add(shaft);
  const block = (name: string, width: number, depth: number, y: number) => {
    const half = width / 2, corner = 0.008, outline = new THREE.Shape();
    outline.moveTo(-half + corner, -half); outline.lineTo(half - corner, -half);
    outline.quadraticCurveTo(half, -half, half, -half + corner);
    outline.lineTo(half, half - corner); outline.quadraticCurveTo(half, half, half - corner, half);
    outline.lineTo(-half + corner, half); outline.quadraticCurveTo(-half, half, -half, half - corner);
    outline.lineTo(-half, -half + corner); outline.quadraticCurveTo(-half, -half, -half + corner, -half);
    const geometry = new THREE.ExtrudeGeometry(outline, {depth, bevelEnabled: false, curveSegments: 5});
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.y = y; root.add(mesh);
  };
  block('West newel square plinth with softened corners', 0.15, baseHeight, 0);
  block('West newel handrail abacus', 0.16, 0.042, height - 0.042);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object.receiveShadow = true;
    const positions = object.geometry.getAttribute('position'), uv = object.geometry.getAttribute('uv');
    for (let i = 0; i < positions.count; i++) {
      uv.setXY(i, (positions.getX(i) + positions.getZ(i)) / 0.6,
        (positions.getY(i) + object.position.y) / 2.8);
    }
  });
  return root;
}
