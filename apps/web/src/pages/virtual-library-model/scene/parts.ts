import * as THREE from 'three';
import type { LibraryMaterials } from './materials';

type MaterialLike = THREE.Material | THREE.Material[];

export interface BookShelfSlot {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotationY: number;
  lean: number;
  spineFace: -1 | 1;
}

export function makeBox(
  width: number,
  height: number,
  depth: number,
  material: MaterialLike,
  x = 0,
  y = 0,
  z = 0,
  castShadow = true,
  receiveShadow = true,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

export class BookBatch {
  private readonly slots: BookShelfSlot[] = [];

  add(
    position: THREE.Vector3,
    scale: THREE.Vector3,
    rotationY: number,
    _colorIndex: number,
    lean = 0,
    spineFace: -1 | 1 = 1,
    _ornamentLevel = 0,
  ) {
    this.slots.push({
      position: position.clone(),
      scale: scale.clone(),
      rotationY,
      lean,
      spineFace,
    });
  }

  getSlots() {
    return this.slots.map((slot) => ({
      position: slot.position.clone(),
      scale: slot.scale.clone(),
      rotationY: slot.rotationY,
      lean: slot.lean,
      spineFace: slot.spineFace,
    }));
  }
}

function hashRandom(value: number) {
  const x = Math.sin(value * 91.913 + 47.77) * 43758.5453;
  return x - Math.floor(x);
}

export function createBookcase(
  xCenter: number,
  zCenter: number,
  projection: number,
  height: number,
  thickness: number,
  shelfCount: number,
  materials: LibraryMaterials,
  books: BookBatch,
  seed: number,
) {
  const group = new THREE.Group();
  group.name = `Perpendicular bookcase ${seed}`;
  const baseHeight = 0.32;
  const shelfBottom = 0.55;
  const shelfStep = (height - 0.86) / shelfCount;
  const shelfFront = thickness / 2 + 0.11;

  group.add(makeBox(projection + 0.16, baseHeight, thickness + 0.18, materials.woodDark, xCenter, baseHeight / 2, zCenter));
  group.add(makeBox(projection + 0.25, 0.24, thickness + 0.22, materials.woodWarm, xCenter, height + 0.08, zCenter));
  group.add(makeBox(projection + 0.08, height - 0.2, 0.14, materials.woodDark, xCenter, height / 2, zCenter));

  const xMin = xCenter - projection / 2;
  const xMax = xCenter + projection / 2;
  [xMin, xMax].forEach((x) => {
    group.add(makeBox(0.24, height, thickness + 0.12, materials.woodWarm, x, height / 2, zCenter));
    group.add(makeBox(0.36, 0.18, thickness + 0.24, materials.woodDark, x, height - 0.16, zCenter));
  });

  const dividerPositions = [xCenter - projection / 3, xCenter + projection / 3];
  dividerPositions.forEach((x) => {
    group.add(makeBox(0.13, height - 0.48, thickness + 0.13, materials.woodDark, x, height / 2, zCenter));
    group.add(makeBox(0.21, 0.19, thickness + 0.2, materials.woodWarm, x, height - 0.2, zCenter));
  });

  for (let shelf = 0; shelf <= shelfCount; shelf += 1) {
    const y = shelfBottom + shelf * shelfStep;
    group.add(makeBox(projection, 0.13, thickness + 0.22, materials.woodWarm, xCenter, y, zCenter));
    for (const face of [-1, 1] as const) {
      group.add(
        makeBox(
          projection,
          0.075,
          0.055,
          materials.woodDark,
          xCenter,
          y + 0.035,
          zCenter + face * (shelfFront + 0.008),
        ),
      );
      if (shelf < shelfCount) {
        group.add(
          makeBox(
            0.42,
            0.105,
            0.025,
            materials.brass,
            xCenter,
            y + 0.035,
            zCenter + face * (shelfFront + 0.04),
            false,
          ),
        );
      }
    }
    if (shelf === shelfCount) continue;

    for (const face of [-1, 1] as const) {
      const rowBase = y + 0.068;
      const rowMaxHeight = Math.min(0.72, shelfStep - 0.24);
      let cursor = xMin + 0.22;
      let bookIndex = 0;
      while (cursor < xMax - 0.22) {
        const random = hashRandom(seed * 1000 + shelf * 89 + face * 17 + bookIndex * 13);
        const width = 0.12 + random * 0.1;
        const divider = dividerPositions.find(
          (position) => cursor < position + 0.12 && cursor + width > position - 0.12,
        );
        if (divider !== undefined) {
          cursor = divider + 0.15;
          continue;
        }
        const bookDepth = 0.25 + hashRandom(seed * 71 + shelf * 19 + bookIndex * 7) * 0.055;
        const heightVariation = 0.78 + hashRandom(seed + bookIndex * 31 + shelf) * 0.22;
        const bookHeight = rowMaxHeight * heightVariation;
        if (cursor + width > xMax - 0.22) break;
        const lean = bookIndex % 11 === 0 ? (face * Math.PI) / 65 : 0;
        const ornamentCycle = (bookIndex + shelf * 3 + seed) % 9;
        books.add(
          new THREE.Vector3(
            cursor + width / 2,
            rowBase + bookHeight / 2,
            zCenter + face * (shelfFront - bookDepth / 2 - 0.025),
          ),
          new THREE.Vector3(width, bookHeight, bookDepth),
          0,
          Math.floor(random * 7),
          lean,
          face,
          ornamentCycle === 0 ? 2 : ornamentCycle < 4 ? 1 : 0,
        );
        cursor += width + 0.026 + hashRandom(bookIndex + seed) * 0.025;
        bookIndex += 1;
      }
    }
  }

  const endCapX = Math.abs(xMin) < Math.abs(xMax) ? xMin : xMax;
  const aisleDirection = -Math.sign(endCapX);
  const panelX = endCapX + aisleDirection * 0.08;
  group.add(makeBox(0.16, height - 0.58, thickness + 0.18, materials.woodDark, panelX, height / 2, zCenter));
  for (const zOffset of [-thickness * 0.34, thickness * 0.34]) {
    group.add(makeBox(0.035, height - 1.02, 0.045, materials.brass, panelX + aisleDirection * 0.09, height / 2, zCenter + zOffset));
  }
  for (const y of [1.08, height / 2, height - 1.02]) {
    const rosette = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.026, 7, 20), materials.brass);
    rosette.rotation.y = Math.PI / 2;
    rosette.position.set(panelX + aisleDirection * 0.1, y, zCenter);
    group.add(rosette);
  }
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.18, 0.24);
  shieldShape.lineTo(0.18, 0.24);
  shieldShape.lineTo(0.15, -0.06);
  shieldShape.quadraticCurveTo(0, -0.34, -0.15, -0.06);
  shieldShape.closePath();
  const shield = new THREE.Mesh(new THREE.ShapeGeometry(shieldShape), materials.brass);
  shield.rotation.y = aisleDirection > 0 ? Math.PI / 2 : -Math.PI / 2;
  shield.position.set(panelX + aisleDirection * 0.105, height * 0.72, zCenter);
  group.add(shield);
  for (const zOffset of [-0.19, 0.19]) {
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), materials.woodWarm);
    finial.position.set(endCapX, height + 0.31, zCenter + zOffset);
    finial.castShadow = true;
    group.add(finial);
  }
  return group;
}

function createPointedArchCurve(width: number, height: number, z = 0) {
  const archStart = height * 0.58;
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-width / 2, archStart, z),
      new THREE.Vector3(-width * 0.34, height * 0.84, z),
      new THREE.Vector3(0, height, z),
      new THREE.Vector3(width * 0.34, height * 0.84, z),
      new THREE.Vector3(width / 2, archStart, z),
    ],
    false,
    'catmullrom',
    0.2,
  );
}

export function createGothicWindow(
  width: number,
  height: number,
  materials: LibraryMaterials,
  side: -1 | 1,
) {
  const group = new THREE.Group();
  group.name = 'Gothic window';
  const archStart = height * 0.58;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, archStart);
  shape.quadraticCurveTo(-width * 0.42, height * 0.91, 0, height);
  shape.quadraticCurveTo(width * 0.42, height * 0.91, width / 2, archStart);
  shape.lineTo(width / 2, 0);
  shape.closePath();

  const glass = new THREE.Mesh(new THREE.ShapeGeometry(shape, 18), materials.glass);
  glass.position.z = -0.03;
  group.add(glass);

  const borderMaterial = materials.stoneDark;
  const border = new THREE.Mesh(
    new THREE.TubeGeometry(createPointedArchCurve(width + 0.18, height + 0.12, 0.04), 30, 0.115, 7, false),
    borderMaterial,
  );
  border.castShadow = true;
  group.add(border);

  const sideHeight = archStart + 0.08;
  group.add(makeBox(0.23, sideHeight, 0.2, borderMaterial, -width / 2 - 0.02, sideHeight / 2, 0.04));
  group.add(makeBox(0.23, sideHeight, 0.2, borderMaterial, width / 2 + 0.02, sideHeight / 2, 0.04));
  group.add(makeBox(0.09, height * 0.84, 0.14, materials.iron, 0, height * 0.42, 0.1, false));
  group.add(makeBox(width * 0.88, 0.08, 0.14, materials.iron, 0, height * 0.38, 0.1, false));
  group.add(makeBox(width * 0.76, 0.07, 0.14, materials.iron, 0, height * 0.61, 0.1, false));

  const rose = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 7, 28), materials.iron);
  rose.position.set(0, height * 0.76, 0.1);
  group.add(rose);
  for (let spoke = 0; spoke < 8; spoke += 1) {
    const angle = (spoke / 8) * Math.PI * 2;
    const bar = makeBox(0.035, 0.24, 0.08, materials.iron, 0, height * 0.76, 0.11, false);
    bar.rotation.z = angle;
    group.add(bar);
  }
  group.rotation.y = side * Math.PI * 0.5;
  return group;
}

export function createReadingDesk(materials: LibraryMaterials, side: -1 | 1) {
  const group = new THREE.Group();
  group.name = 'Reading desk and chair';
  const top = makeBox(1.05, 0.16, 2.15, materials.woodWarm, 0, 1.08, 0);
  group.add(top);
  for (const x of [-0.42, 0.42]) {
    for (const z of [-0.86, 0.86]) {
      group.add(makeBox(0.11, 1.02, 0.11, materials.woodDark, x, 0.52, z));
    }
  }
  group.add(makeBox(0.62, 0.08, 1.7, materials.leather, 0, 1.18, 0, false));
  group.add(makeBox(0.78, 0.24, 0.06, materials.woodDark, 0, 0.94, -1.02));
  const drawerHandle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16, Math.PI), materials.brass);
  drawerHandle.rotation.x = Math.PI / 2;
  drawerHandle.position.set(0, 0.93, -1.058);
  group.add(drawerHandle);

  const chair = new THREE.Group();
  chair.add(makeBox(0.62, 0.12, 0.58, materials.woodWarm, 0, 0.62, 0));
  chair.add(makeBox(0.52, 0.08, 0.5, materials.leather, 0, 0.71, 0, false));
  for (const x of [-0.24, 0.24]) {
    for (const z of [-0.21, 0.21]) {
      chair.add(makeBox(0.08, 0.62, 0.08, materials.woodDark, x, 0.31, z));
    }
  }
  chair.add(makeBox(0.62, 1.02, 0.11, materials.woodDark, 0, 1.22, 0.25));
  chair.add(makeBox(0.45, 0.68, 0.07, materials.leather, 0, 1.24, 0.18, false));
  for (const x of [-0.25, 0.25]) {
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.105, 8), materials.woodWarm);
    finial.position.set(x, 1.78, 0.25);
    finial.castShadow = true;
    chair.add(finial);
  }
  chair.position.x = -side * 1.04;
  chair.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  group.add(chair);

  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.62, 10), materials.brass);
  lampStem.position.set(0, 1.48, -0.42);
  lampStem.castShadow = true;
  group.add(lampStem);
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.26, 0.18, 16, 1, true),
    materials.lampGlass,
  );
  lampShade.position.set(0, 1.77, -0.42);
  group.add(lampShade);
  const cover = makeBox(0.7, 0.045, 0.56, materials.leather, 0.16, 1.245, 0.28, false);
  cover.rotation.y = 0.08;
  group.add(cover);
  for (const pageSide of [-1, 1] as const) {
    const page = makeBox(0.33, 0.025, 0.5, materials.parchment, 0.16 + pageSide * 0.17, 1.278, 0.28, false);
    page.rotation.y = 0.08;
    page.rotation.z = pageSide * -0.055;
    group.add(page);
  }

  const loosePage = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.5), materials.parchment);
  loosePage.rotation.x = -Math.PI / 2;
  loosePage.rotation.z = -0.12;
  loosePage.position.set(-0.22, 1.226, -0.12);
  group.add(loosePage);

  const inkWell = new THREE.Group();
  const inkBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.11, 10), materials.iron);
  inkBody.position.y = 0.055;
  inkWell.add(inkBody);
  const inkRim = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 6, 14), materials.brass);
  inkRim.rotation.x = Math.PI / 2;
  inkRim.position.y = 0.115;
  inkWell.add(inkRim);
  inkWell.position.set(-0.28, 1.226, 0.54);
  group.add(inkWell);

  const quillShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.014, 0.64, 7), materials.brass);
  quillShaft.rotation.x = Math.PI / 2;
  quillShaft.rotation.z = -0.34;
  quillShaft.position.set(-0.2, 1.315, 0.29);
  group.add(quillShaft);
  const feather = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.36, 8), materials.parchment);
  feather.rotation.x = Math.PI / 2;
  feather.rotation.z = -0.34;
  feather.position.set(-0.1, 1.33, 0.02);
  feather.scale.x = 0.52;
  group.add(feather);
  return group;
}

export function createRestrictedLectern(materials: LibraryMaterials) {
  const group = new THREE.Group();
  group.name = 'Restricted section lectern';
  group.add(makeBox(0.9, 0.16, 0.72, materials.woodDark, 0, 0.08, 0));
  group.add(makeBox(0.34, 1.3, 0.34, materials.woodWarm, 0, 0.76, 0));
  group.add(makeBox(0.62, 0.14, 0.52, materials.woodDark, 0, 1.42, 0));
  for (const direction of [-1, 1] as const) {
    const brace = makeBox(0.11, 0.78, 0.11, materials.woodDark, direction * 0.34, 0.83, 0);
    brace.rotation.z = direction * -0.28;
    group.add(brace);
  }

  const readingTop = new THREE.Group();
  const top = makeBox(1.2, 0.12, 0.82, materials.woodWarm, 0, 0, 0);
  readingTop.add(top);
  const bookCover = makeBox(0.86, 0.055, 0.6, materials.leather, 0, 0.09, 0, false);
  readingTop.add(bookCover);
  for (const pageSide of [-1, 1] as const) {
    const page = makeBox(0.4, 0.035, 0.54, materials.parchment, pageSide * 0.205, 0.135, 0, false);
    page.rotation.z = pageSide * -0.07;
    readingTop.add(page);
  }
  readingTop.rotation.x = -0.2;
  readingTop.position.y = 1.55;
  group.add(readingTop);

  const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 7, 20), materials.brass);
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(0, 1.12, -0.19);
  group.add(emblem);
  return group;
}

export function createChandelier(materials: LibraryMaterials, lightEnabled: boolean, mountHeight = 2.45) {
  const group = new THREE.Group();
  group.name = 'Candle chandelier';
  const mainRadius = 0.88;
  const innerRadius = 0.58;
  const candleCount = 12;
  const yAxis = new THREE.Vector3(0, 1, 0);

  const addHorizontalRing = (
    radius: number,
    tube: number,
    material: MaterialLike,
    y: number,
    name: string,
  ) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 9, 64), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    ring.castShadow = true;
    ring.name = name;
    group.add(ring);
    return ring;
  };

  const addRod = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    material: MaterialLike,
    name: string,
  ) => {
    const direction = end.clone().sub(start);
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
      material,
    );
    rod.position.copy(start).add(end).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(yAxis, direction.normalize());
    rod.castShadow = true;
    rod.name = name;
    group.add(rod);
    return rod;
  };

  addHorizontalRing(mainRadius, 0.052, materials.iron, 0, 'Chandelier outer iron ring');
  addHorizontalRing(mainRadius + 0.008, 0.012, materials.brass, 0.035, 'Chandelier brass rim');
  addHorizontalRing(innerRadius, 0.026, materials.iron, -0.015, 'Chandelier inner iron ring');
  addHorizontalRing(innerRadius - 0.006, 0.01, materials.brass, 0.018, 'Chandelier inner brass rim');

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.22, 12),
    materials.iron,
  );
  hub.position.y = 0.015;
  hub.castShadow = true;
  hub.name = 'Chandelier central hub';
  group.add(hub);
  addHorizontalRing(0.16, 0.022, materials.brass, 0.12, 'Chandelier upper hub collar');
  addHorizontalRing(0.135, 0.018, materials.brass, -0.105, 'Chandelier lower hub collar');

  const lowerBoss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 0), materials.brass);
  lowerBoss.position.y = -0.19;
  lowerBoss.castShadow = true;
  lowerBoss.name = 'Chandelier lower boss';
  group.add(lowerBoss);
  const lowerFinial = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 8), materials.iron);
  lowerFinial.rotation.z = Math.PI;
  lowerFinial.position.y = -0.34;
  lowerFinial.castShadow = true;
  lowerFinial.name = 'Chandelier lower finial';
  group.add(lowerFinial);

  const suspensionCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.13, 0.16, 12),
    materials.brass,
  );
  suspensionCollar.position.y = 0.69;
  suspensionCollar.castShadow = true;
  suspensionCollar.name = 'Chandelier suspension collar';
  group.add(suspensionCollar);

  for (let supportIndex = 0; supportIndex < 3; supportIndex += 1) {
    const angle = (supportIndex / 3) * Math.PI * 2 + Math.PI / 6;
    addRod(
      new THREE.Vector3(0, 0.62, 0),
      new THREE.Vector3(Math.cos(angle) * mainRadius, 0.035, Math.sin(angle) * mainRadius),
      0.018,
      materials.iron,
      `Chandelier suspension brace ${supportIndex + 1}`,
    );
  }

  const chainStart = 0.78;
  const chainEnd = mountHeight - 0.14;
  const linkCount = Math.max(2, Math.ceil((chainEnd - chainStart) / 0.09) + 1);
  for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
    const link = new THREE.Mesh(
      new THREE.TorusGeometry(0.047, 0.011, 6, 14),
      materials.iron,
    );
    link.position.y = THREE.MathUtils.lerp(chainStart, chainEnd, linkIndex / (linkCount - 1));
    if (linkIndex % 2 === 1) link.rotation.y = Math.PI / 2;
    link.castShadow = true;
    link.name = `Chandelier chain link ${linkIndex + 1}`;
    group.add(link);
  }
  const ceilingShackle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.095, 0.12, 10),
    materials.brass,
  );
  ceilingShackle.position.y = mountHeight - 0.06;
  ceilingShackle.castShadow = true;
  ceilingShackle.name = 'Chandelier ceiling shackle';
  group.add(ceilingShackle);
  const mountingPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.06, 32), materials.iron);
  mountingPlate.position.y = mountHeight - 0.03;
  mountingPlate.name = 'Chandelier ceiling mounting plate';
  group.add(mountingPlate);

  for (let candleIndex = 0; candleIndex < candleCount; candleIndex += 1) {
    const angle = (candleIndex / candleCount) * Math.PI * 2;
    const directionX = Math.cos(angle);
    const directionZ = Math.sin(angle);
    const x = directionX * mainRadius;
    const z = directionZ * mainRadius;

    addRod(
      new THREE.Vector3(directionX * 0.17, 0.03, directionZ * 0.17),
      new THREE.Vector3(directionX * (mainRadius - 0.07), 0.035, directionZ * (mainRadius - 0.07)),
      0.016,
      materials.iron,
      `Chandelier radial spoke ${candleIndex + 1}`,
    );

    const tray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.085, 0.035, 12),
      materials.iron,
    );
    tray.position.set(x, 0.075, z);
    tray.castShadow = true;
    tray.name = `Chandelier drip tray ${candleIndex + 1}`;
    group.add(tray);

    const candleCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.074, 0.055, 0.09, 12),
      materials.brass,
    );
    candleCup.position.set(x, 0.13, z);
    candleCup.castShadow = true;
    candleCup.name = `Chandelier candle cup ${candleIndex + 1}`;
    group.add(candleCup);

    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.041, 0.047, 0.34, 10),
      materials.parchment,
    );
    candle.position.set(x, 0.32, z);
    candle.name = `Chandelier candle ${candleIndex + 1}`;
    group.add(candle);

    const waxRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.0065, 6, 14),
      materials.parchment,
    );
    waxRim.rotation.x = Math.PI / 2;
    waxRim.position.set(x, 0.49, z);
    waxRim.name = `Chandelier wax rim ${candleIndex + 1}`;
    group.add(waxRim);

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 8, 8),
      materials.lampGlass,
    );
    flame.scale.set(0.7, 1.8, 0.7);
    flame.position.set(x, 0.57, z);
    flame.name = `Chandelier flame ${candleIndex + 1}`;
    group.add(flame);

    if (candleIndex % 2 === 0) {
      const ringFinial = new THREE.Mesh(
        new THREE.ConeGeometry(0.038, 0.16, 6),
        materials.iron,
      );
      ringFinial.rotation.z = Math.PI;
      ringFinial.position.set(x, -0.11, z);
      ringFinial.castShadow = true;
      ringFinial.name = `Chandelier ring finial ${candleIndex / 2 + 1}`;
      group.add(ringFinial);
    }
  }
  if (lightEnabled) {
    const light = new THREE.PointLight(0xff9f54, 18, 11, 1.9);
    light.position.y = 0.25;
    group.add(light);
  }
  return group;
}

export const RESTRICTED_PORTAL_GATE_LAYOUT = {
  shoulderRatio: 0.58,
  thresholdClearance: 0.12,
  leafGap: 0.07,
  barCount: 7,
  sideInset: 0.2,
  barThickness: 0.09,
  railHeightRatios: [0.24, 0.5, 0.76],
  hingeHeightRatios: [0.24, 0.5, 0.76],
  boltHeightRatio: 0.48,
  recessDepth: 0.3,
} as const;

function createRestrictedPointedGateGeometry(
  width: number,
  height: number,
  depth: number,
) {
  const shoulder = height * RESTRICTED_PORTAL_GATE_LAYOUT.shoulderRatio;
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

function restrictedGateBarTopY(x: number, width: number, height: number) {
  const shoulder = height * RESTRICTED_PORTAL_GATE_LAYOUT.shoulderRatio;
  const normalizedX = THREE.MathUtils.clamp(Math.abs(x) / (width / 2), 0, 1);
  return height - (height - shoulder) * normalizedX ** 1.65;
}

export function createRestrictedPortalGate(
  width: number,
  height: number,
  materials: LibraryMaterials,
) {
  const group = new THREE.Group();
  group.name = 'Restricted archive gothic double-leaf iron gate';

  const recess = new THREE.Mesh(
    createRestrictedPointedGateGeometry(width, height, 0.08),
    materials.woodDark,
  );
  recess.name = 'Restricted archive deep pointed shadow recess';
  recess.position.z = RESTRICTED_PORTAL_GATE_LAYOUT.recessDepth;
  recess.receiveShadow = true;
  group.add(recess);

  const shoulderY = height * RESTRICTED_PORTAL_GATE_LAYOUT.shoulderRatio;
  const usableWidth = width - RESTRICTED_PORTAL_GATE_LAYOUT.sideInset * 2;
  for (let index = 0; index < RESTRICTED_PORTAL_GATE_LAYOUT.barCount; index += 1) {
    const progress = index / (RESTRICTED_PORTAL_GATE_LAYOUT.barCount - 1);
    const x = -usableWidth / 2 + usableWidth * progress;
    const topY = restrictedGateBarTopY(x, width, height) - 0.24;
    const barHeight = topY - RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance;
    const bar = makeBox(
      index === Math.floor(RESTRICTED_PORTAL_GATE_LAYOUT.barCount / 2)
        ? RESTRICTED_PORTAL_GATE_LAYOUT.barThickness * 1.35
        : RESTRICTED_PORTAL_GATE_LAYOUT.barThickness,
      barHeight,
      0.1,
      materials.iron,
      x,
      RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance + barHeight / 2,
      -0.16,
    );
    bar.name = index === Math.floor(RESTRICTED_PORTAL_GATE_LAYOUT.barCount / 2)
      ? 'Restricted archive gate center meeting stile'
      : `Restricted archive gate vertical bar ${index + 1}`;
    group.add(bar);

    const spear = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.2, 6),
      materials.iron,
    );
    spear.name = `Restricted archive restrained spear finial ${index + 1}`;
    spear.position.set(x, topY + 0.1, -0.16);
    spear.castShadow = true;
    group.add(spear);
  }

  const leafWidth = (width - RESTRICTED_PORTAL_GATE_LAYOUT.leafGap) / 2;
  const railWidth = leafWidth - 0.12;
  for (const direction of [-1, 1] as const) {
    const side = direction < 0 ? 'left' : 'right';
    const leafCenterX = direction * (RESTRICTED_PORTAL_GATE_LAYOUT.leafGap / 2 + leafWidth / 2);
    RESTRICTED_PORTAL_GATE_LAYOUT.railHeightRatios.forEach((heightRatio, railIndex) => {
      const railY = RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance
        + (shoulderY - RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance) * heightRatio;
      const rail = makeBox(railWidth, 0.1, 0.11, materials.iron, leafCenterX, railY, -0.19);
      rail.name = `Restricted archive ${side} gate horizontal rail ${railIndex + 1}`;
      group.add(rail);
    });
    RESTRICTED_PORTAL_GATE_LAYOUT.hingeHeightRatios.forEach((heightRatio, hingeIndex) => {
      const hingeY = RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance
        + (shoulderY - RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance) * heightRatio;
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.28, 12),
        materials.brass,
      );
      hinge.name = `Restricted archive ${side} gate hinge ${hingeIndex + 1}`;
      hinge.position.set(direction * (width / 2 - 0.08), hingeY, -0.235);
      group.add(hinge);
    });
  }

  const seamHeight = shoulderY - RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance;
  const seam = makeBox(
    0.022,
    seamHeight,
    0.04,
    materials.woodDark,
    0,
    RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance + seamHeight / 2,
    -0.225,
    false,
  );
  seam.name = 'Restricted archive gate center seam';
  group.add(seam);

  const boltY = RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance
    + (shoulderY - RESTRICTED_PORTAL_GATE_LAYOUT.thresholdClearance)
      * RESTRICTED_PORTAL_GATE_LAYOUT.boltHeightRatio;
  const bolt = makeBox(0.88, 0.11, 0.11, materials.iron, 0, boltY, -0.285);
  bolt.name = 'Restricted archive centered gate slide bolt';
  group.add(bolt);
  for (const x of [-0.32, 0.32]) {
    const guide = makeBox(0.16, 0.22, 0.12, materials.iron, x, boltY, -0.27);
    guide.name = 'Restricted archive gate bolt guide';
    group.add(guide);
  }
  const lockPlate = makeBox(0.3, 0.36, 0.12, materials.iron, 0, boltY - 0.29, -0.285);
  lockPlate.name = 'Restricted archive centered mechanical lock';
  group.add(lockPlate);
  const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), materials.woodDark);
  keyhole.name = 'Restricted archive gate keyhole';
  keyhole.position.set(0, boltY - 0.27, -0.35);
  group.add(keyhole);

  const threshold = makeBox(width + 0.16, 0.16, 0.46, materials.stone, 0, 0.08, -0.01);
  threshold.name = 'Restricted archive gate threshold';
  group.add(threshold);
  group.userData.view = 'restricted';
  return group;
}

export function createPlaqueTexture(title: string, subtitle: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 420;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  context.clearRect(0, 0, 1024, 420);
  context.fillStyle = '#180b08';
  context.fillRect(18, 18, 988, 384);
  context.strokeStyle = '#ab8142';
  context.lineWidth = 10;
  context.strokeRect(32, 32, 960, 356);
  context.strokeStyle = '#5c3a20';
  context.lineWidth = 3;
  context.strokeRect(52, 52, 920, 316);
  context.textAlign = 'center';
  context.fillStyle = '#d8b86f';
  context.font = '700 86px Georgia, serif';
  context.fillText(title, 512, 195);
  context.font = '400 34px Georgia, serif';
  context.letterSpacing = '8px';
  context.fillText(subtitle, 512, 273);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
