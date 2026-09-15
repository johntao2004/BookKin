import * as THREE from 'three';

/** Photo-estimated three-field window return; no operable shutter mechanism is implied. */
export function createLongRoomWindowReveal(height: number, material: THREE.Material) {
  const group = new THREE.Group();
  group.name = 'Paneled lower window return';
  const width = 0.52, border = 0.055;
  const frame = new THREE.Shape();
  frame.moveTo(-width / 2, 0); frame.lineTo(width / 2, 0);
  frame.lineTo(width / 2, height); frame.lineTo(-width / 2, height); frame.closePath();
  for (let row = 0; row < 3; row++) {
    const bottom = row * height / 3 + border, top = (row + 1) * height / 3 - border;
    const hole = new THREE.Path();
    hole.moveTo(-width / 2 + border, bottom); hole.lineTo(-width / 2 + border, top);
    hole.lineTo(width / 2 - border, top); hole.lineTo(width / 2 - border, bottom); hole.closePath();
    frame.holes.push(hole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width - border, top - bottom + border, 0.016), material);
    panel.name = 'Recessed window return field'; panel.position.y = (bottom + top) / 2;
    panel.castShadow = panel.receiveShadow = true; group.add(panel);

    // A narrow rounded rebate steps down from the frame to the recessed field.
    // The profile is a photo estimate, not a measured historic joinery section.
    const halfOpening = width / 2 - border;
    const rebate = new THREE.Shape();
    rebate.moveTo(-halfOpening - 0.006, bottom - 0.006);
    rebate.lineTo(halfOpening + 0.006, bottom - 0.006);
    rebate.lineTo(halfOpening + 0.006, top + 0.006);
    rebate.lineTo(-halfOpening - 0.006, top + 0.006); rebate.closePath();
    const rebateOpening = new THREE.Path();
    rebateOpening.moveTo(-halfOpening + 0.01, bottom + 0.01);
    rebateOpening.lineTo(-halfOpening + 0.01, top - 0.01);
    rebateOpening.lineTo(halfOpening - 0.01, top - 0.01);
    rebateOpening.lineTo(halfOpening - 0.01, bottom + 0.01); rebateOpening.closePath();
    rebate.holes.push(rebateOpening);
    const rebateGeometry = new THREE.ExtrudeGeometry(rebate, {
      depth: 0.006, bevelEnabled: true, bevelThickness: 0.005,
      bevelSize: 0.005, bevelSegments: 5, steps: 1,
    });
    rebateGeometry.translate(0, 0, 0.013);
    // Returns are viewed from opposite sides on either edge of each window.
    for (const side of [-1, 1]) {
      const moulding = new THREE.Mesh(rebateGeometry, material);
      moulding.name = 'Rounded window panel rebate';
      if (side < 0) { moulding.rotation.y = Math.PI; }
      moulding.castShadow = moulding.receiveShadow = true; group.add(moulding);
    }
  }
  const geometry = new THREE.ExtrudeGeometry(frame, {
    depth: 0.054, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003,
    bevelSegments: 3, steps: 1, curveSegments: 1,
  });
  geometry.translate(0, 0, -0.027);
  const surround = new THREE.Mesh(geometry, material);
  surround.name = 'Beveled window return frame';
  surround.castShadow = surround.receiveShadow = true; group.add(surround);
  return group;
}
