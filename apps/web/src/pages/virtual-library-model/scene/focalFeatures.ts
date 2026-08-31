import * as THREE from 'three';
import { tokens } from '../../../theme/generated-tokens';
import { VIRTUAL_LIBRARY_LAYOUT } from '../../virtual-library-layout';
import { PALETTE } from '../config';
import type { LibraryMaterials } from './materials';
import { createPlaqueTexture, makeBox } from './parts';
import {
  createMoonlitLibraryStainedGlassMaterial,
  createPointedTransomShape,
  createStainedGlassCame,
  createStainedGlassPaneGeometry,
} from './stainedGlass';

export interface FireplaceFeature {
  group: THREE.Group;
  animate: (elapsed: number) => void;
}

export function createPointedPortalLeafGeometry(
  width: number,
  height: number,
  depth: number,
) {
  const shoulder = height * 0.58;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, shoulder);
  shape.quadraticCurveTo(width * 0.42, height * 0.9, 0, height);
  shape.quadraticCurveTo(-width * 0.42, height * 0.9, -width / 2, shoulder);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 18,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

class ReceptionArcCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly radius: number,
    private readonly y: number,
  ) {
    super();
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = THREE.MathUtils.lerp(0, Math.PI, t);
    return target.set(
      Math.cos(angle) * this.radius,
      this.y,
      Math.sin(angle) * this.radius,
    );
  }
}

function receptionArc(
  radius: number,
  y: number,
  tube: number,
  material: THREE.Material,
) {
  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(new ReceptionArcCurve(radius, y), 64, tube, 10, false),
    material,
  );
  rail.castShadow = true;
  return rail;
}

const RECEPTION_CURVE_SEGMENTS = 96;

/**
 * Builds one continuous half-annulus with rounded plan-view ends. The rounded
 * caps keep the countertop, apron and plinth from exposing rectangular cut
 * faces when the desk is viewed from above or from either side.
 */
export function createReceptionArcPrismGeometry(
  radius: number,
  radialDepth: number,
  height: number,
  segments = RECEPTION_CURVE_SEGMENTS,
) {
  const segmentCount = Math.max(8, Math.floor(segments));
  const capSegmentCount = Math.max(6, Math.ceil(segmentCount / 8));
  const halfDepth = radialDepth / 2;
  const innerRadius = Math.max(0.01, radius - radialDepth / 2);
  const outerRadius = radius + radialDepth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(outerRadius, 0);

  for (let index = 1; index <= segmentCount; index += 1) {
    const angle = (index / segmentCount) * Math.PI;
    shape.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
  }
  for (let index = 1; index <= capSegmentCount; index += 1) {
    const angle = Math.PI + (index / capSegmentCount) * Math.PI;
    shape.lineTo(-radius + Math.cos(angle) * halfDepth, Math.sin(angle) * halfDepth);
  }
  for (let index = 1; index <= segmentCount; index += 1) {
    const angle = Math.PI - (index / segmentCount) * Math.PI;
    shape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
  }
  for (let index = 1; index <= capSegmentCount; index += 1) {
    const angle = Math.PI + (index / capSegmentCount) * Math.PI;
    shape.lineTo(radius + Math.cos(angle) * halfDepth, Math.sin(angle) * halfDepth);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    bevelEnabled: false,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, height / 2, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createReceptionArcPrism(
  radius: number,
  radialDepth: number,
  height: number,
  y: number,
  material: THREE.Material,
  name: string,
) {
  const mesh = new THREE.Mesh(
    createReceptionArcPrismGeometry(radius, radialDepth, height),
    material,
  );
  mesh.name = name;
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createReturnBookStack(materials: LibraryMaterials, direction: -1 | 1) {
  const stack = new THREE.Group();
  stack.name = direction < 0 ? 'Left reception return books' : 'Right reception return books';
  const widths = [0.52, 0.46, 0.55];
  widths.forEach((width, index) => {
    const cover = makeBox(
      width,
      0.055,
      0.38,
      index % 2 === 0 ? materials.leather : materials.woodWarm,
      0,
      index * 0.075,
      0,
    );
    cover.rotation.y = direction * (index - 1) * 0.045;
    stack.add(cover);
    const pages = makeBox(
      width - 0.045,
      0.035,
      0.34,
      materials.parchment,
      0,
      index * 0.075 + 0.038,
      0,
      false,
    );
    pages.rotation.y = cover.rotation.y;
    stack.add(pages);
  });
  const { countertop, radius } = VIRTUAL_LIBRARY_LAYOUT.reception;
  const angle = direction < 0
    ? Math.PI - countertop.bookStackAngle
    : countertop.bookStackAngle;
  stack.position.set(
    Math.cos(angle) * radius,
    countertop.surfaceY + 0.0275,
    Math.sin(angle) * radius,
  );
  stack.rotation.y = -angle - Math.PI / 2;
  return stack;
}

function createReceptionLamp(materials: LibraryMaterials) {
  const lamp = new THREE.Group();
  lamp.name = 'Reception banker lamp';
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.23, 0.08, 18),
    materials.brass,
  );
  base.position.y = 0.04;
  lamp.add(base);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.034, 0.46, 12),
    materials.brass,
  );
  stem.position.y = 0.29;
  lamp.add(stem);
  const reservoir = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 16, 12),
    materials.lampGlass,
  );
  reservoir.scale.set(1, 0.78, 1);
  reservoir.position.y = 0.48;
  lamp.add(reservoir);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.32, 0.19, 20, 1, true),
    materials.woodWarm,
  );
  shade.position.y = 0.69;
  lamp.add(shade);
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 12, 8),
    materials.brass,
  );
  finial.position.y = 0.82;
  lamp.add(finial);
  const glow = new THREE.PointLight(PALETTE.gold, 5.5, 3.6, 2);
  glow.position.y = 0.64;
  lamp.add(glow);
  return lamp;
}

function createDeskBell(materials: LibraryMaterials) {
  const bell = new THREE.Group();
  bell.name = 'Reception desk bell';
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 0.04, 18),
    materials.woodDark,
  );
  base.position.y = 0.02;
  bell.add(base);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.brass,
  );
  dome.position.y = 0.045;
  bell.add(dome);
  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.055, 12),
    materials.brass,
  );
  button.position.y = 0.17;
  bell.add(button);
  return bell;
}

export function createHorseshoeReception(materials: LibraryMaterials) {
  const group = new THREE.Group();
  group.name = 'Horseshoe reception desk';
  group.position.z = VIRTUAL_LIBRARY_LAYOUT.reception.centerZ;
  const radius = VIRTUAL_LIBRARY_LAYOUT.reception.radius;

  group.add(createReceptionArcPrism(
    radius,
    0.38,
    0.2,
    0.12,
    materials.woodDark,
    'Continuous reception plinth',
  ));
  group.add(createReceptionArcPrism(
    radius,
    0.34,
    0.82,
    0.62,
    materials.woodWarm,
    'Continuous reception curved apron',
  ));
  group.add(createReceptionArcPrism(
    radius,
    0.72,
    0.15,
    1.13,
    materials.woodDark,
    'Continuous reception countertop',
  ));

  for (const direction of [-1, 1] as const) {
    group.add(createReturnBookStack(materials, direction));
    const { countertop } = VIRTUAL_LIBRARY_LAYOUT.reception;
    const angle = direction < 0
      ? Math.PI - countertop.lampAngle
      : countertop.lampAngle;
    const lamp = createReceptionLamp(materials);
    lamp.position.set(
      Math.cos(angle) * radius,
      countertop.surfaceY,
      Math.sin(angle) * radius,
    );
    group.add(lamp);
  }

  group.add(receptionArc(radius + 0.145, 0.35, 0.026, materials.brass));
  group.add(receptionArc(radius + 0.145, 0.88, 0.026, materials.brass));
  group.add(receptionArc(radius + 0.03, 1.24, 0.035, materials.brass));

  const deskBell = createDeskBell(materials);
  deskBell.position.set(0.82, 1.22, radius - 0.16);
  group.add(deskBell);

  return group;
}

function addDoorPanel(
  parent: THREE.Group,
  materials: LibraryMaterials,
  x: number,
  y: number,
  width: number,
  height: number,
  name?: string,
  surfaceZ = -0.155,
) {
  const panel = makeBox(width, height, 0.045, materials.woodDark, x, y, surfaceZ);
  if (name) panel.name = name;
  parent.add(panel);
  const insetWidth = width - 0.18;
  const insetHeight = height - 0.18;
  const trimZ = surfaceZ - 0.03;
  parent.add(makeBox(insetWidth, 0.045, 0.035, materials.brass, x, y - insetHeight / 2, trimZ, false));
  parent.add(makeBox(insetWidth, 0.045, 0.035, materials.brass, x, y + insetHeight / 2, trimZ, false));
  parent.add(makeBox(0.045, insetHeight, 0.035, materials.brass, x - insetWidth / 2, y, trimZ, false));
  parent.add(makeBox(0.045, insetHeight, 0.035, materials.brass, x + insetWidth / 2, y, trimZ, false));
}

export const DIRECTOR_OFFICE_DOOR_LAYOUT = {
  transomStartRatio: 0.72,
  thresholdClearance: 0.14,
  leafGap: 0.06,
  leafTopClearance: 0.06,
  handleOffset: 0.2,
  handleHeightRatio: 0.52,
  panelLayouts: [
    { key: 'lower', centerRatio: 0.2, heightRatio: 0.24 },
    { key: 'upper', centerRatio: 0.66, heightRatio: 0.46 },
  ],
  hingeHeightRatios: [0.2, 0.52, 0.84],
} as const;

export function createGrandEntrancePortal(materials: LibraryMaterials) {
  const entrance = new THREE.Group();
  entrance.name = 'Grand double-door entrance';
  entrance.userData.view = 'hall';

  for (const direction of [-1, 1] as const) {
    const leafCenter = direction * 0.95;
    entrance.add(makeBox(1.84, 4.34, 0.24, materials.woodWarm, leafCenter, 2.24, 0));
    for (const [y, width, height] of [
      [0.9, 1.38, 1.08],
      [2.12, 1.38, 1.08],
      [3.48, 1.38, 1.28],
    ] as const) {
      addDoorPanel(entrance, materials, leafCenter, y, width, height);
    }
    for (const y of [0.56, 1.66, 2.78, 3.92]) {
      for (const offsetX of [-0.68, 0.68]) {
        const stud = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 10, 8),
          materials.brass,
        );
        stud.position.set(leafCenter + offsetX, y, -0.22);
        entrance.add(stud);
      }
    }
    for (const y of [1.08, 2.36, 3.68]) {
      entrance.add(
        makeBox(
          0.48,
          0.07,
          0.055,
          materials.brass,
          leafCenter + direction * 0.57,
          y,
          -0.23,
          false,
        ),
      );
    }

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 10, 24), materials.brass);
    handle.name = direction < 0 ? 'Left entrance handle' : 'Right entrance handle';
    handle.position.set(direction * 0.18, 2.05, -0.24);
    entrance.add(handle);
  }

  entrance.add(makeBox(0.11, 4.38, 0.08, materials.brass, 0, 2.25, -0.18, false));
  entrance.add(makeBox(4.32, 0.26, 0.48, materials.stoneDark, 0, 0.13, -0.08));
  entrance.add(makeBox(4.64, 0.18, 0.82, materials.stone, 0, 0.06, -0.42));

  for (const x of [-2.06, 2.06]) {
    entrance.add(makeBox(0.32, 4.78, 0.48, materials.stoneDark, x, 2.42, 0));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.28, 10), materials.stone);
    base.position.set(x, 0.18, -0.04);
    entrance.add(base);
  }

  for (const x of [-2.48, 2.48]) {
    const sconce = new THREE.Group();
    sconce.name = x < 0 ? 'Left entrance sconce' : 'Right entrance sconce';
    sconce.add(makeBox(0.08, 0.08, 0.46, materials.brass, 0, 0, -0.16));
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.09, 0.14, 12), materials.brass);
    cup.position.set(0, 0.09, -0.37);
    sconce.add(cup);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), materials.lampGlass);
    lamp.scale.set(0.78, 1.55, 0.78);
    lamp.position.set(0, 0.32, -0.37);
    sconce.add(lamp);
    const light = new THREE.PointLight(PALETTE.gold, 16, 5.4, 2);
    light.position.set(0, 0.38, -0.72);
    sconce.add(light);
    sconce.position.set(x, 3.02, -0.08);
    entrance.add(sconce);
  }
  return entrance;
}

function createOfficeDoorSconce(
  materials: LibraryMaterials,
  name: string,
) {
  const sconce = new THREE.Group();
  sconce.name = name;
  sconce.add(makeBox(0.08, 0.08, 0.44, materials.brass, 0, 0, -0.16));
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.08, 0.14, 12),
    materials.brass,
  );
  cup.position.set(0, 0.09, -0.36);
  sconce.add(cup);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 14, 10),
    materials.lampGlass,
  );
  lamp.scale.set(0.78, 1.62, 0.78);
  lamp.position.set(0, 0.32, -0.36);
  sconce.add(lamp);
  const hood = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.18, 10, 1, true),
    materials.iron,
  );
  hood.position.set(0, 0.49, -0.36);
  sconce.add(hood);
  const light = new THREE.PointLight(PALETTE.gold, 12, 4.8, 2);
  light.position.set(0, 0.35, -0.65);
  sconce.add(light);
  return sconce;
}

function addDirectorOfficeDoorPanel(
  parent: THREE.Group,
  materials: LibraryMaterials,
  x: number,
  y: number,
  width: number,
  height: number,
  name: string,
) {
  const panel = makeBox(width, height, 0.045, materials.woodDark, x, y, -0.195);
  panel.name = name;
  parent.add(panel);
  const insetWidth = width - 0.16;
  const insetHeight = height - 0.16;
  for (const edgeY of [y - insetHeight / 2, y + insetHeight / 2]) {
    const edge = makeBox(insetWidth, 0.055, 0.04, materials.woodDark, x, edgeY, -0.225, false);
    edge.name = `${name} horizontal wood moulding`;
    parent.add(edge);
  }
  for (const edgeX of [x - insetWidth / 2, x + insetWidth / 2]) {
    const edge = makeBox(0.055, insetHeight, 0.04, materials.woodDark, edgeX, y, -0.225, false);
    edge.name = `${name} vertical wood moulding`;
    parent.add(edge);
  }
}

export function createDirectorOfficePortal(materials: LibraryMaterials) {
  const office = new THREE.Group();
  office.name = 'Director office tall double door with stained-glass transom';
  office.userData.view = 'director-office';

  const portal = VIRTUAL_LIBRARY_LAYOUT.sidePortals;
  const shoulderY = portal.openingHeight * DIRECTOR_OFFICE_DOOR_LAYOUT.transomStartRatio;
  const leafHeight = shoulderY
    - DIRECTOR_OFFICE_DOOR_LAYOUT.thresholdClearance
    - DIRECTOR_OFFICE_DOOR_LAYOUT.leafTopClearance;
  const leafWidth = (portal.openingWidth - DIRECTOR_OFFICE_DOOR_LAYOUT.leafGap) / 2;
  const leafCenterY = DIRECTOR_OFFICE_DOOR_LAYOUT.thresholdClearance + leafHeight / 2;
  const panelWidth = leafWidth - 0.3;
  const handleY = DIRECTOR_OFFICE_DOOR_LAYOUT.thresholdClearance
    + leafHeight * DIRECTOR_OFFICE_DOOR_LAYOUT.handleHeightRatio;

  for (const direction of [-1, 1] as const) {
    const side = direction < 0 ? 'left' : 'right';
    const leafCenterX = direction * (DIRECTOR_OFFICE_DOOR_LAYOUT.leafGap / 2 + leafWidth / 2);
    const leaf = makeBox(leafWidth, leafHeight, 0.18, materials.woodWarm, leafCenterX, leafCenterY, -0.09);
    leaf.name = `Director office ${side} door leaf`;
    office.add(leaf);

    for (const panelLayout of DIRECTOR_OFFICE_DOOR_LAYOUT.panelLayouts) {
      addDirectorOfficeDoorPanel(
        office,
        materials,
        leafCenterX,
        DIRECTOR_OFFICE_DOOR_LAYOUT.thresholdClearance + leafHeight * panelLayout.centerRatio,
        panelWidth,
        leafHeight * panelLayout.heightRatio,
        `Director office ${side} ${panelLayout.key} panel`,
      );
    }

    for (const [hingeIndex, heightRatio] of DIRECTOR_OFFICE_DOOR_LAYOUT.hingeHeightRatios.entries()) {
      const hingeY = DIRECTOR_OFFICE_DOOR_LAYOUT.thresholdClearance + leafHeight * heightRatio;
      const strap = makeBox(
        0.52,
        0.07,
        0.055,
        materials.iron,
        direction * (portal.openingWidth / 2 - 0.28),
        hingeY,
        -0.225,
      );
      strap.name = `Director office ${side} hinge strap ${hingeIndex + 1}`;
      office.add(strap);
      const hingePin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.28, 10),
        materials.brass,
      );
      hingePin.name = `Director office ${side} hinge pin ${hingeIndex + 1}`;
      hingePin.position.set(direction * (portal.openingWidth / 2 - 0.035), hingeY, -0.245);
      office.add(hingePin);
    }

    const handleX = direction * DIRECTOR_OFFICE_DOOR_LAYOUT.handleOffset;
    const handlePlate = makeBox(0.16, 0.46, 0.055, materials.iron, handleX, handleY, -0.23, false);
    handlePlate.name = `Director office ${side} handle plate`;
    office.add(handlePlate);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.023, 10, 24),
      materials.brass,
    );
    handle.name = `Director office ${side} handle`;
    handle.position.set(handleX, handleY, -0.285);
    office.add(handle);
  }

  const centerSeam = makeBox(
    0.055,
    leafHeight - 0.08,
    0.035,
    materials.woodDark,
    0,
    leafCenterY,
    -0.205,
    false,
  );
  centerSeam.name = 'Director office double-door center seam';
  office.add(centerSeam);

  const transomHeight = portal.openingHeight - shoulderY;
  const transomShape = createPointedTransomShape(portal.openingWidth, transomHeight);
  const transomBacking = new THREE.Mesh(
    createStainedGlassPaneGeometry(transomShape, portal.openingWidth, transomHeight),
    materials.woodDark,
  );
  transomBacking.name = 'Director office stained-glass transom dark backing';
  transomBacking.position.set(0, shoulderY, 0.02);
  transomBacking.receiveShadow = true;
  office.add(transomBacking);

  const transomGlass = new THREE.Mesh(
    createStainedGlassPaneGeometry(
      createPointedTransomShape(portal.openingWidth, transomHeight),
      portal.openingWidth,
      transomHeight,
    ),
    createMoonlitLibraryStainedGlassMaterial('transom'),
  );
  transomGlass.name = 'Director office moonlit library stained-glass transom';
  transomGlass.position.set(0, shoulderY, -0.13);
  transomGlass.userData.motif = 'moonlit-library';
  office.add(transomGlass);

  const transomRail = makeBox(
    portal.openingWidth - 0.08,
    0.12,
    0.14,
    materials.woodDark,
    0,
    shoulderY,
    -0.17,
  );
  transomRail.name = 'Director office internal transom base rail';
  office.add(transomRail);

  const branchY = shoulderY + transomHeight * 0.38;
  office.add(createStainedGlassCame(
    new THREE.Vector2(0, shoulderY + 0.08),
    new THREE.Vector2(0, portal.openingHeight - 0.12),
    materials.iron,
    'Director office transom center lead came',
    -0.2,
    0.05,
  ));
  for (const direction of [-1, 1] as const) {
    office.add(createStainedGlassCame(
      new THREE.Vector2(0, branchY),
      new THREE.Vector2(direction * portal.openingWidth * 0.36, shoulderY + transomHeight * 0.18),
      materials.iron,
      `Director office transom ${direction < 0 ? 'left' : 'right'} lead branch`,
      -0.2,
      0.045,
    ));
  }

  const threshold = makeBox(portal.thresholdWidth, 0.2, 0.62, materials.stone, 0, 0.1, -0.02);
  threshold.name = 'Director office doorway threshold';
  office.add(threshold);

  for (const direction of [-1, 1] as const) {
    const sconce = createOfficeDoorSconce(
      materials,
      direction < 0 ? 'Left director office sconce' : 'Right director office sconce',
    );
    sconce.position.set(direction * portal.sconceOffset, portal.sconceY, -0.05);
    office.add(sconce);
  }

  return office;
}

function pointedArch(width: number, height: number, material: THREE.Material, tube: number) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-width / 2, 0, 0),
    new THREE.Vector3(-width / 2, height * 0.56, 0),
    new THREE.Vector3(-width * 0.3, height * 0.84, 0),
    new THREE.Vector3(0, height, 0),
    new THREE.Vector3(width * 0.3, height * 0.84, 0),
    new THREE.Vector3(width / 2, height * 0.56, 0),
    new THREE.Vector3(width / 2, 0, 0),
  ]);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, tube, 8, false), material);
  arch.castShadow = true;
  return arch;
}

export function createFireplaceFeature(materials: LibraryMaterials): FireplaceFeature {
  const group = new THREE.Group();
  group.name = 'Fireplace and public-domain masterwork';
  group.userData.artwork = 'The Death of Socrates, Jacques-Louis David, 1787';

  const backing = makeBox(5.15, 5.7, 0.34, materials.stoneDark, 0, 2.87, 0.05);
  group.add(backing);
  for (let course = 0; course < 9; course += 1) {
    const y = 0.38 + course * 0.62;
    group.add(makeBox(4.92, 0.035, 0.035, materials.stone, 0, y, -0.14, false));
    const jointOffset = course % 2 === 0 ? 0.78 : 0;
    for (const x of [-1.56, 0, 1.56]) {
      const jointX = x + jointOffset;
      if (Math.abs(jointX) > 2.28) continue;
      group.add(makeBox(0.035, 0.52, 0.035, materials.stone, jointX, y + 0.28, -0.14, false));
    }
  }

  const fireboxMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.nearBlack,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const firebox = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.62), fireboxMaterial);
  firebox.name = 'Fireplace opening';
  firebox.position.set(0, 1.03, -0.37);
  firebox.rotation.y = Math.PI;
  group.add(firebox);

  const fireArch = pointedArch(2.48, 2.28, materials.stone, 0.16);
  fireArch.position.set(0, 0.2, -0.48);
  group.add(fireArch);
  for (const x of [-1.22, 1.22]) {
    group.add(makeBox(0.42, 1.85, 0.58, materials.stone, x, 1.05, -0.26));
    const corbel = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.58, 8), materials.stoneDark);
    corbel.position.set(x, 2.18, -0.5);
    corbel.rotation.z = Math.PI;
    group.add(corbel);
  }
  group.add(makeBox(3.6, 0.34, 0.78, materials.stone, 0, 2.22, -0.28));
  group.add(makeBox(4.2, 0.22, 0.9, materials.woodDark, 0, 2.47, -0.35));
  group.add(makeBox(3.3, 0.2, 1.0, materials.stone, 0, 0.12, -0.5));

  for (const x of [-0.62, 0, 0.62]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.15, 12), materials.woodDark);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = x * 0.2;
    log.position.set(x * 0.28, 0.48, -0.63);
    group.add(log);
  }
  for (const x of [-0.72, -0.36, 0, 0.36, 0.72]) {
    group.add(makeBox(0.045, 1.05, 0.055, materials.iron, x, 0.92, -0.84));
  }
  group.add(makeBox(1.7, 0.055, 0.075, materials.iron, 0, 0.48, -0.86));
  group.add(makeBox(1.7, 0.055, 0.075, materials.iron, 0, 1.34, -0.86));
  for (const x of [-0.72, 0.72]) {
    const andiron = new THREE.Group();
    andiron.add(makeBox(0.12, 0.54, 0.12, materials.brass, 0, 0.27, 0));
    andiron.add(makeBox(0.5, 0.08, 0.12, materials.iron, 0, 0.04, 0.08));
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), materials.brass);
    finial.position.y = 0.57;
    andiron.add(finial);
    andiron.position.set(x, 0.2, -0.96);
    group.add(andiron);
  }

  const flameTexture = new THREE.TextureLoader().load(
    '/assets/virtual-library/fireplace-flame-v1-512.png',
  );
  flameTexture.colorSpace = THREE.SRGBColorSpace;
  flameTexture.anisotropy = 8;
  const flameSettings = [
    { x: -0.32, y: 0.45, width: 1.2, height: 1.22, opacity: 0.5, phase: 0.4 },
    { x: 0.28, y: 0.43, width: 1.14, height: 1.12, opacity: 0.46, phase: 2.1 },
    { x: 0, y: 0.46, width: 1.48, height: 1.42, opacity: 0.7, phase: 3.7 },
  ];
  const flames = flameSettings.map((settings, index) => {
    const flameMaterial = new THREE.SpriteMaterial({
      map: flameTexture,
      color: tokens.color.primitive.cream100,
      transparent: true,
      opacity: settings.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const flame = new THREE.Sprite(flameMaterial);
    flame.name = `Layered fireplace flame ${index + 1}`;
    flame.center.set(0.5, 0.08);
    flame.position.set(settings.x, settings.y, -0.76 + index * 0.012);
    flame.scale.set(settings.width, settings.height, 1);
    flame.userData.baseX = settings.x;
    flame.userData.baseY = settings.y;
    flame.userData.baseWidth = settings.width;
    flame.userData.baseHeight = settings.height;
    flame.userData.baseOpacity = settings.opacity;
    flame.userData.phase = settings.phase;
    group.add(flame);
    return flame;
  });

  const emberMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.gold,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.78, 32), emberMaterial);
  embers.name = 'Fireplace ember glow';
  embers.scale.set(1.35, 0.33, 1);
  embers.position.set(0, 0.5, -0.79);
  group.add(embers);

  const fireLight = new THREE.PointLight(PALETTE.gold, 25, 6.8, 2.2);
  fireLight.name = 'Fireplace warm light';
  fireLight.position.set(0, 1.15, -1.55);
  group.add(fireLight);

  const paintingTexture = new THREE.TextureLoader().load(
    '/assets/virtual-library/death-of-socrates-met-open-access.jpg',
  );
  paintingTexture.colorSpace = THREE.SRGBColorSpace;
  paintingTexture.anisotropy = 8;
  const paintingMaterial = new THREE.MeshStandardMaterial({
    map: paintingTexture,
    roughness: 0.76,
    side: THREE.DoubleSide,
  });
  const painting = new THREE.Mesh(new THREE.PlaneGeometry(4.25, 2.82), paintingMaterial);
  painting.name = 'The Death of Socrates painting';
  painting.position.set(0, 4.08, -0.43);
  painting.rotation.y = Math.PI;
  group.add(painting);

  const frameDepth = -0.5;
  group.add(makeBox(4.6, 0.2, 0.18, materials.woodDark, 0, 2.58, frameDepth));
  group.add(makeBox(4.6, 0.2, 0.18, materials.woodDark, 0, 5.58, frameDepth));
  group.add(makeBox(0.2, 3.08, 0.18, materials.woodDark, -2.2, 4.08, frameDepth));
  group.add(makeBox(0.2, 3.08, 0.18, materials.woodDark, 2.2, 4.08, frameDepth));
  group.add(makeBox(4.36, 0.045, 0.2, materials.brass, 0, 2.72, -0.58, false));
  group.add(makeBox(4.36, 0.045, 0.2, materials.brass, 0, 5.44, -0.58, false));
  group.add(makeBox(0.045, 2.72, 0.2, materials.brass, -2.07, 4.08, -0.58, false));
  group.add(makeBox(0.045, 2.72, 0.2, materials.brass, 2.07, 4.08, -0.58, false));
  for (const x of [-2.07, 2.07]) {
    for (const y of [2.72, 5.44]) {
      const rosette = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.025, 10, 24),
        materials.brass,
      );
      rosette.position.set(x, y, -0.7);
      group.add(rosette);
    }
  }

  const artLabelMaterial = new THREE.MeshStandardMaterial({
    map: createPlaqueTexture('苏格拉底之死', 'JACQUES-LOUIS DAVID · 1787'),
    transparent: true,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const artLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 0.32), artLabelMaterial);
  artLabel.name = 'Painting attribution plaque';
  artLabel.position.set(0, 2.42, -0.81);
  artLabel.rotation.y = Math.PI;
  group.add(artLabel);

  const artLight = new THREE.PointLight(PALETTE.parchment, 16, 5.5, 2);
  artLight.name = 'Painting light';
  artLight.position.set(0, 4.72, -1.35);
  group.add(artLight);

  return {
    group,
    animate(elapsed) {
      flames.forEach((flame) => {
        const phase = Number(flame.userData.phase);
        const slowPulse = Math.sin(elapsed * 2.45 + phase);
        const finePulse = Math.sin(elapsed * 5.1 + phase * 1.7);
        flame.position.x = Number(flame.userData.baseX) + slowPulse * 0.026;
        flame.position.y = Number(flame.userData.baseY) + finePulse * 0.018;
        flame.scale.x = Number(flame.userData.baseWidth) * (1 + slowPulse * 0.025);
        flame.scale.y = Number(flame.userData.baseHeight) * (1 + finePulse * 0.055);
        flame.material.opacity = Number(flame.userData.baseOpacity) * (0.94 + slowPulse * 0.06);
      });
      emberMaterial.opacity = 0.3 + Math.sin(elapsed * 2.1) * 0.035;
      fireLight.intensity = 24 + Math.sin(elapsed * 3.2) * 1.8 + Math.sin(elapsed * 1.4) * 1.2;
    },
  };
}
