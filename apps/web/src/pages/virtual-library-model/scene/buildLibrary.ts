import * as THREE from 'three';
import {
  EXTERIOR_PRESETS,
  LIBRARY,
  PALETTE,
  type ExteriorPresetId,
} from '../config';
import {
  getHallColumnSectionIndices,
  markCameraCollider,
} from '../../virtual-library-collision';
import { createLibraryMaterials, type LibraryMaterials } from './materials';
import {
  createDirectorOfficePortal,
  createFireplaceFeature,
  createGrandEntrancePortal,
  createHorseshoeReception,
  type FireplaceFeature,
} from './focalFeatures';
import {
  BookBatch,
  type BookShelfSlot,
  createChandelier,
  createGothicWindow,
  createRestrictedPortalGate,
  makeBox,
} from './parts';
import { VIRTUAL_LIBRARY_LAYOUT } from '../../virtual-library-layout';

export interface BuiltLibrary {
  root: THREE.Group;
  materials: LibraryMaterials;
  bookSlots: BookShelfSlot[];
  shelfSections: ExpandableShelfSection[];
  interactiveObjects: THREE.Object3D[];
  restrictedGlow: THREE.PointLight;
  animateEnvironment: (elapsed: number) => void;
  setExteriorPreset: (preset: ExteriorPresetId) => void;
}

export interface ExpandableShelfSection {
  id: number;
  angle: number;
  radius: number;
  width: number;
  height: number;
  baseY: number;
  depth: number;
  shelfCount: number;
}

export const SHELF_FRONT_RAIL = {
  shelfBottomOffset: 0.42,
  shelfHeightInset: 0.72,
  boardHeight: 0.115,
  boardDepthExtension: 0.08,
  fasciaHeight: 0.07,
  fasciaDepth: 0.05,
  fasciaCenterYOffset: 0.03,
  fasciaFrontOffset: 0.07,
} as const;

export interface ShelfFrontPlacement {
  shelfIndex: number;
  shelfY: number;
  localShelfY: number;
  centerY: number;
  localCenterY: number;
  frontSurfaceZ: number;
}

type ShelfFrontLayout = Pick<
  ExpandableShelfSection,
  'baseY' | 'height' | 'depth' | 'shelfCount'
>;

export function getShelfFrontPlacement(
  section: ShelfFrontLayout,
  shelfIndex: number,
): ShelfFrontPlacement {
  const safeShelfIndex = Math.max(0, Math.min(section.shelfCount, shelfIndex));
  const shelfStep = (section.height - SHELF_FRONT_RAIL.shelfHeightInset) / section.shelfCount;
  const shelfY = section.baseY
    + SHELF_FRONT_RAIL.shelfBottomOffset
    + safeShelfIndex * shelfStep;
  const localShelfY = shelfY - (section.baseY + section.height / 2);

  return {
    shelfIndex: safeShelfIndex,
    shelfY,
    localShelfY,
    centerY: shelfY + SHELF_FRONT_RAIL.fasciaCenterYOffset,
    localCenterY: localShelfY + SHELF_FRONT_RAIL.fasciaCenterYOffset,
    frontSurfaceZ: -section.depth / 2 - SHELF_FRONT_RAIL.fasciaFrontOffset,
  };
}

interface ExteriorWindowRig {
  materials: THREE.MeshStandardMaterial[];
  textures: THREE.Texture[];
}

interface LightingRig {
  moon: THREE.DirectionalLight;
  windowLight: THREE.SpotLight;
}

const ENTRANCE_LEFT_SIDE_ANGLE = Math.PI;
const ENTRANCE_RIGHT_SIDE_ANGLE = 0;
const STAIR_CENTER = new THREE.Vector3(6.25, 0, 5.45);

export const SPIRAL_STAIR_GALLERY_CONNECTION = {
  stepCenterRadius: 0.78,
  stepRadialLength: 1.28,
  stepTangentialDepth: 0.44,
  landingTangentialWidth: 1.55,
  landingThickness: 0.16,
  landingStepOverlap: 0.1,
  landingGalleryOverlap: 0.12,
  openingSideClearance: 0.08,
} as const;

function hashRandom(value: number) {
  const x = Math.sin(value * 91.913 + 47.77) * 43758.5453;
  return x - Math.floor(x);
}

function yawForAngle(angle: number) {
  return Math.PI / 2 - angle;
}

function positionFromPolar(
  radius: number,
  angle: number,
  y: number,
  tangentOffset = 0,
  radialOffset = 0,
) {
  const radial = radius + radialOffset;
  return new THREE.Vector3(
    Math.cos(angle) * radial + Math.sin(angle) * tangentOffset,
    y,
    Math.sin(angle) * radial - Math.cos(angle) * tangentOffset,
  );
}

export function calculateSpiralStairGalleryConnection() {
  const galleryInnerRadius = LIBRARY.tower.innerRadius - LIBRARY.tower.galleryDepth;
  const railRadius = galleryInnerRadius - 0.08;
  const stairAxisAngle = Math.atan2(STAIR_CENTER.z, STAIR_CENTER.x);
  const stairCenterRadius = Math.hypot(STAIR_CENTER.x, STAIR_CENTER.z);
  // The final tread must be perpendicular to the route into the gallery. The
  // stair rises with increasing angle, so its forward tangent points radially
  // outward when the final tread sits a quarter-turn behind the tower axis.
  const exitStepAngle = stairAxisAngle - Math.PI / 2;
  const landingTangentialCenterOffset = SPIRAL_STAIR_GALLERY_CONNECTION.stepCenterRadius;
  const lastStepForwardRadius = stairCenterRadius
    + SPIRAL_STAIR_GALLERY_CONNECTION.stepTangentialDepth / 2;
  const landingInnerRadius = lastStepForwardRadius
    - SPIRAL_STAIR_GALLERY_CONNECTION.landingStepOverlap;
  const landingOuterRadius = galleryInnerRadius
    + SPIRAL_STAIR_GALLERY_CONNECTION.landingGalleryOverlap;
  const landingCenterRadius = (landingInnerRadius + landingOuterRadius) / 2;
  const landingRadialLength = landingOuterRadius - landingInnerRadius;
  const openingHalfWidth = SPIRAL_STAIR_GALLERY_CONNECTION.landingTangentialWidth / 2
    + SPIRAL_STAIR_GALLERY_CONNECTION.openingSideClearance;
  const openingInnerTangentOffset = landingTangentialCenterOffset - openingHalfWidth;
  const openingOuterTangentOffset = landingTangentialCenterOffset + openingHalfWidth;
  const angleAtTangentOffset = (offset: number) => stairAxisAngle - Math.asin(
    THREE.MathUtils.clamp(offset / railRadius, -0.98, 0.98),
  );
  const openingStartAngle = angleAtTangentOffset(openingOuterTangentOffset);
  const openingEndAngle = angleAtTangentOffset(openingInnerTangentOffset);

  return {
    exitStepAngle,
    galleryInnerRadius,
    landingCenterRadius,
    landingInnerRadius,
    landingOuterRadius,
    landingRadialLength,
    landingTangentialCenterOffset,
    lastStepForwardRadius,
    openingEndAngle,
    openingInnerTangentOffset,
    openingOuterTangentOffset,
    openingStartAngle,
    openingWidth: openingOuterTangentOffset - openingInnerTangentOffset,
    railRadius,
    stairAxisAngle,
    stairCenterRadius,
  };
}

function placePolar(
  object: THREE.Object3D,
  radius: number,
  angle: number,
  y = 0,
  tangentOffset = 0,
  radialOffset = 0,
) {
  object.position.copy(positionFromPolar(radius, angle, y, tangentOffset, radialOffset));
  object.rotation.y = yawForAngle(angle);
  return object;
}

function makeRing(radius: number, tube: number, material: THREE.Material, y: number) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 112), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = true;
  return ring;
}

class CircularArcCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly radius: number,
    private readonly startAngle: number,
    private readonly endAngle: number,
    private readonly y: number,
  ) {
    super();
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = THREE.MathUtils.lerp(this.startAngle, this.endAngle, t);
    return target.set(
      Math.cos(angle) * this.radius,
      this.y,
      Math.sin(angle) * this.radius,
    );
  }
}

function makeSmoothArcRail(
  radius: number,
  startAngle: number,
  endAngle: number,
  y: number,
  tube: number,
  material: THREE.Material,
) {
  const arcLength = Math.abs(endAngle - startAngle);
  const curve = new CircularArcCurve(radius, startAngle, endAngle, y);
  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(32, Math.ceil(arcLength * 48)), tube, 12, false),
    material,
  );
  rail.castShadow = true;
  return rail;
}

function createPointedArch(width: number, height: number, material: THREE.Material, tube = 0.105) {
  const shoulder = height * 0.56;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-width / 2, 0, 0),
    new THREE.Vector3(-width / 2, shoulder, 0),
    new THREE.Vector3(-width * 0.31, height * 0.84, 0),
    new THREE.Vector3(0, height, 0),
    new THREE.Vector3(width * 0.31, height * 0.84, 0),
    new THREE.Vector3(width / 2, shoulder, 0),
    new THREE.Vector3(width / 2, 0, 0),
  ]);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(curve, 34, tube, 7, false), material);
  arch.castShadow = true;
  return arch;
}

function createPointedWindowShape(width: number, height: number) {
  const archStart = height * 0.58;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, archStart);
  shape.quadraticCurveTo(-width * 0.42, height * 0.91, 0, height);
  shape.quadraticCurveTo(width * 0.42, height * 0.91, width / 2, archStart);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}

function createExteriorWindowBackdrop(
  width: number,
  height: number,
  sector: number,
  rig: ExteriorWindowRig,
) {
  const geometry = new THREE.ShapeGeometry(createPointedWindowShape(width, height), 18);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const position = geometry.getAttribute('position');
  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    uv[index * 2] = (position.getX(index) - bounds.min.x) / (bounds.max.x - bounds.min.x);
    uv[index * 2 + 1] = (position.getY(index) - bounds.min.y) / (bounds.max.y - bounds.min.y);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(0.22, 0.82);
  texture.offset.set((sector * 0.137) % 1, 0.02);
  texture.anisotropy = 4;
  texture.userData.baseOffset = (sector * 0.137) % 1;

  const material = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xd6e7ff,
    emissiveMap: texture,
    emissiveIntensity: 2.65,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const backdrop = new THREE.Mesh(geometry, material);
  backdrop.position.z = 0.025;
  backdrop.name = 'Exterior panorama through Gothic window';
  rig.materials.push(material);
  rig.textures.push(texture);
  return backdrop;
}

function addFloorAndShell(root: THREE.Group, materials: LibraryMaterials) {
  const {
    innerRadius,
    wallThickness,
    mainHeight,
    entranceAngle,
    roofHeight,
  } = LIBRARY.tower;
  markCameraCollider(root, [
    {
      id: 'hall-shell',
      shape: 'radial-boundary',
      center: { x: 0, y: 0, z: 0 },
      maxRadius: innerRadius - 0.12,
      minY: 0,
      maxY: mainHeight + roofHeight,
    },
    {
      id: 'hall-floor',
      shape: 'box',
      center: { x: 0, y: -0.2, z: 0 },
      size: { x: innerRadius * 2.2, y: 0.4, z: innerRadius * 2.2 },
    },
    {
      id: 'hall-roof',
      shape: 'box',
      center: { x: 0, y: mainHeight + roofHeight / 2, z: 0 },
      size: {
        x: (innerRadius + 1.2) * 2,
        y: roofHeight,
        z: (innerRadius + 1.2) * 2,
      },
    },
  ]);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x221f1b,
    roughness: 0.94,
    metalness: 0.01,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(innerRadius - 0.22, 112), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  floor.name = 'Circular stone reading floor';
  root.add(floor);

  for (const [inner, outer] of [
    [1.55, 1.68],
    [4.1, 4.18],
    [8.15, 8.24],
    [13.75, 13.86],
  ]) {
    const inlay = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 112), materials.brass);
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.y = 0.045;
    root.add(inlay);
  }

  const medallion = new THREE.Group();
  medallion.name = 'Central brass floor medallion';
  const medallionField = new THREE.Mesh(
    new THREE.CircleGeometry(1.48, 64),
    materials.stoneDark,
  );
  medallionField.rotation.x = -Math.PI / 2;
  medallionField.position.y = 0.052;
  medallionField.receiveShadow = true;
  medallion.add(medallionField);
  for (const [inner, outer] of [[0.42, 0.5], [1.39, 1.48]] as const) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 64), materials.brass);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.061;
    medallion.add(ring);
  }
  for (let spoke = 0; spoke < 12; spoke += 1) {
    const angle = (spoke / 12) * Math.PI * 2;
    const inlay = makeBox(0.026, 0.014, 0.78, materials.brass, 0, 0.068, 0, false, false);
    inlay.rotation.y = angle;
    inlay.position.x = Math.sin(angle) * 0.94;
    inlay.position.z = Math.cos(angle) * 0.94;
    medallion.add(inlay);
  }
  const medallionBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.035, 16),
    materials.brass,
  );
  medallionBoss.position.y = 0.076;
  medallion.add(medallionBoss);
  root.add(medallion);

  for (let spoke = 0; spoke < 16; spoke += 1) {
    const angle = entranceAngle + (spoke / 16) * Math.PI * 2;
    const strip = makeBox(0.035, 0.018, 6.25, materials.brass, 0, 0, 0, false, false);
    placePolar(strip, 5.15, angle, 0.055);
    root.add(strip);
  }

  const wallMaterial = materials.stone.clone();
  // The hall is normally viewed from inside, but the wall still needs a real
  // exterior face so an extreme orbit never exposes a culled, hollow shell.
  wallMaterial.side = THREE.DoubleSide;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(
      innerRadius + wallThickness * 0.36,
      innerRadius + wallThickness * 0.36,
      mainHeight,
      112,
      1,
      true,
    ),
    wallMaterial,
  );
  wall.position.y = mainHeight / 2;
  wall.receiveShadow = true;
  wall.name = 'Circular tower shell';
  root.add(wall);

  root.add(makeRing(innerRadius - 0.08, 0.16, materials.stoneDark, 0.26));
  root.add(makeRing(innerRadius - 0.06, 0.17, materials.woodDark, LIBRARY.tower.galleryY));
  root.add(makeRing(innerRadius - 0.08, 0.2, materials.stoneDark, mainHeight - 0.22));

  const entrance = createGrandEntrancePortal(materials);
  entrance.add(createPointedArch(4.7, 5.65, materials.stoneDark, 0.16));
  placePolar(entrance, innerRadius - 0.32, entranceAngle, 0.1);
  markCameraCollider(entrance, {
    id: 'hall-main-entrance',
    shape: 'box',
    center: { x: 0, y: 2.8, z: 0 },
    size: { x: 4.8, y: 5.65, z: 0.82 },
  });
  root.add(entrance);
  return entrance;
}

interface TangentialBookcaseOptions {
  radius: number;
  angle: number;
  width: number;
  height: number;
  baseY: number;
  depth: number;
  shelfCount: number;
  seed: number;
  faces: Array<-1 | 1>;
  tangentOffset?: number;
  backPanel?: boolean;
  bookWidthScale?: number;
}

function addTangentialBookcase(
  root: THREE.Group,
  materials: LibraryMaterials,
  books: BookBatch,
  options: TangentialBookcaseOptions,
) {
  const {
    radius,
    angle,
    width,
    height,
    baseY,
    depth,
    shelfCount,
    seed,
    faces,
    tangentOffset = 0,
    backPanel = true,
    bookWidthScale = 1,
  } = options;
  const group = new THREE.Group();
  group.name = `Circular bookcase ${seed}`;
  group.position.copy(positionFromPolar(radius, angle, 0, tangentOffset));
  group.rotation.y = yawForAngle(angle);
  markCameraCollider(group, {
    id: `hall-bookcase-${seed}`,
    shape: 'box',
    center: { x: 0, y: baseY + height / 2, z: 0 },
    size: { x: width + 0.2, y: height + 0.3, z: depth + 0.16 },
  });

  group.add(makeBox(width + 0.12, 0.3, depth + 0.12, materials.woodDark, 0, baseY + 0.15, 0));
  group.add(makeBox(width + 0.2, 0.22, depth + 0.16, materials.woodWarm, 0, baseY + height + 0.07, 0));
  const bayCenters = [-width / 3, 0, width / 3];
  const outerPostPositions = [-width / 2, width / 2];
  if (backPanel) {
    const backZ = faces.length === 1 ? -faces[0] * (depth / 2 - 0.055) : 0;
    group.add(makeBox(width, height - 0.32, 0.11, materials.woodDark, 0, baseY + height / 2, backZ));
    const insetZ = backZ + faces[0] * 0.066;
    const insetWidth = width - 0.18;
    group.add(
      makeBox(
        insetWidth,
        height - 0.68,
        0.025,
        materials.wood,
        0,
        baseY + height / 2,
        insetZ,
        false,
      ),
    );
    for (const edgeX of [-insetWidth / 2, insetWidth / 2]) {
      group.add(
        makeBox(
          0.034,
          height - 0.82,
          0.032,
          materials.woodWarm,
          edgeX,
          baseY + height / 2,
          insetZ + faces[0] * 0.018,
        ),
      );
    }
  }

  const isLowBookcase = height < 3;
  for (const x of outerPostPositions) {
    group.add(makeBox(0.2, height, depth + 0.12, materials.woodWarm, x, baseY + height / 2, 0));
    const finialBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.066, 0.12, 10),
      materials.woodWarm,
    );
    finialBase.position.set(x, baseY + height + 0.3, 0);
    finialBase.castShadow = true;
    group.add(finialBase);

    const finialCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.038, 0.095, 8),
      isLowBookcase ? materials.woodDark : materials.brass,
    );
    finialCap.position.set(x, baseY + height + 0.395, 0);
    finialCap.castShadow = true;
    group.add(finialCap);
  }
  group.add(
    makeBox(width + 0.34, 0.085, depth + 0.25, materials.woodDark, 0, baseY + height + 0.22, 0),
  );
  const dentilCount = 7;
  for (let dentil = 0; dentil < dentilCount; dentil += 1) {
    const x = THREE.MathUtils.lerp(-width * 0.43, width * 0.43, dentil / (dentilCount - 1));
    group.add(
      makeBox(0.16, 0.13, depth + 0.29, materials.woodWarm, x, baseY + height + 0.135, 0),
    );
  }

  for (const face of faces) {
    const frontZ = face * (depth / 2 + 0.072);
    for (const x of outerPostPositions) {
      group.add(
        makeBox(
          0.035,
          height - 0.72,
          0.032,
          materials.brass,
          x,
          baseY + height / 2,
          frontZ + face * 0.008,
          false,
        ),
      );
    }
    for (const x of bayCenters) {
      const drawerWidth = Math.min(0.78, width / 3 - 0.09);
      group.add(
        makeBox(drawerWidth, 0.18, 0.035, materials.woodWarm, x, baseY + 0.25, frontZ, true),
      );
      const pull = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 6, 14, Math.PI), materials.brass);
      pull.position.set(x, baseY + 0.25, frontZ + face * 0.028);
      pull.rotation.x = Math.PI / 2;
      pull.rotation.z = face > 0 ? 0 : Math.PI;
      group.add(pull);
    }

    const crestShape = new THREE.Shape();
    crestShape.moveTo(-0.5, 0);
    crestShape.lineTo(-0.34, 0.15);
    crestShape.lineTo(-0.12, 0.2);
    crestShape.lineTo(0, 0.48);
    crestShape.lineTo(0.12, 0.2);
    crestShape.lineTo(0.34, 0.15);
    crestShape.lineTo(0.5, 0);
    crestShape.closePath();
    const crest = new THREE.Mesh(new THREE.ShapeGeometry(crestShape), materials.woodWarm);
    crest.position.set(0, baseY + height + 0.23, frontZ + face * 0.02);
    crest.rotation.y = face < 0 ? Math.PI : 0;
    crest.castShadow = true;
    group.add(crest);
    const crestBoss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.057, 0.057, 0.026, 12),
      materials.brass,
    );
    crestBoss.rotation.x = Math.PI / 2;
    crestBoss.position.set(0, baseY + height + 0.42, frontZ + face * 0.034);
    crestBoss.castShadow = true;
    group.add(crestBoss);
  }

  const shelfStep = (height - SHELF_FRONT_RAIL.shelfHeightInset) / shelfCount;
  for (let shelf = 0; shelf <= shelfCount; shelf += 1) {
    const placement = getShelfFrontPlacement({ baseY, height, depth, shelfCount }, shelf);
    group.add(makeBox(
      width,
      SHELF_FRONT_RAIL.boardHeight,
      depth + SHELF_FRONT_RAIL.boardDepthExtension,
      materials.woodWarm,
      0,
      placement.shelfY,
      0,
    ));
    for (const face of faces) {
      const fasciaCenterZ = face === -1
        ? placement.frontSurfaceZ + SHELF_FRONT_RAIL.fasciaDepth / 2
        : -placement.frontSurfaceZ - SHELF_FRONT_RAIL.fasciaDepth / 2;
      group.add(
        makeBox(
          width,
          SHELF_FRONT_RAIL.fasciaHeight,
          SHELF_FRONT_RAIL.fasciaDepth,
          materials.woodDark,
          0,
          placement.centerY,
          fasciaCenterZ,
        ),
      );
      if (shelf < shelfCount) {
        for (const x of [-width / 2 + 0.16, width / 2 - 0.16]) {
          group.add(
            makeBox(
              0.07,
              0.16,
              0.14,
              materials.woodDark,
              x,
              placement.shelfY - 0.075,
              face * (depth / 2 + 0.01),
            ),
          );
        }
      }
    }

    if (shelf === shelfCount) continue;
    const rowMaxHeight = Math.max(0.35, Math.min(0.67, shelfStep - 0.19));
    for (const face of faces) {
      let cursor = -width / 2 + 0.19;
      let bookIndex = 0;
      while (cursor < width / 2 - 0.2) {
        const random = hashRandom(seed * 1000 + shelf * 89 + face * 17 + bookIndex * 13);
        const bookWidth = (0.06 + random * 0.058) * bookWidthScale;
        if (cursor + bookWidth > width / 2 - 0.19) break;
        const bookDepth = 0.245 + hashRandom(seed * 71 + shelf * 19 + bookIndex * 7) * 0.05;
        const bookHeight = rowMaxHeight * (0.77 + hashRandom(seed + bookIndex * 31 + shelf) * 0.23);
        const localTangent = tangentOffset + cursor + bookWidth / 2;
        const localRadial = face * (depth / 2 - bookDepth / 2 - 0.05);
        const position = positionFromPolar(
          radius,
          angle,
          placement.shelfY + 0.06 + bookHeight / 2,
          localTangent,
          localRadial,
        );
        const ornamentCycle = (bookIndex + shelf * 3 + seed) % 11;
        books.add(
          position,
          new THREE.Vector3(bookWidth, bookHeight, bookDepth),
          yawForAngle(angle),
          Math.floor(random * 7),
          bookIndex % 17 === 0 ? (face * Math.PI) / 30 : 0,
          face,
          ornamentCycle === 0 ? 2 : ornamentCycle < 4 ? 1 : 0,
        );
        cursor +=
          bookWidth
          + (0.007 + hashRandom(bookIndex + seed) * 0.011) * bookWidthScale;
        bookIndex += 1;
      }
    }
  }

  root.add(group);
  return group;
}

export function shouldPlaceUpperBookcase(
  sector: number,
  hiddenIndex: number,
  windowIndices: ReadonlySet<number>,
) {
  return sector !== hiddenIndex && !windowIndices.has(sector);
}

export function shouldPlaceLowerBookcase(
  sector: number,
  fireplaceIndex: number,
  sidePortalIndices: ReadonlySet<number>,
) {
  return sector !== 0
    && sector !== fireplaceIndex
    && !sidePortalIndices.has(sector);
}

function addOuterBookWalls(
  root: THREE.Group,
  materials: LibraryMaterials,
  books: BookBatch,
  interactiveObjects: THREE.Object3D[],
  exteriorRig: ExteriorWindowRig,
  shelfSections: ExpandableShelfSection[],
) {
  const { innerRadius, segmentCount, entranceAngle, galleryY, mainHeight } = LIBRARY.tower;
  const { depth, lowerHeight, upperHeight, shelfCount } = LIBRARY.bookcase;
  const step = (Math.PI * 2) / segmentCount;
  const caseRadius = innerRadius - depth / 2 - 0.34;
  const caseWidth = caseRadius * step * 0.855;
  const hiddenIndex = -1;
  const fireplaceIndex = segmentCount / 2;
  const sidePortalIndices = new Set([4, 12]);
  const windowIndices = new Set([7, 8, 9]);

  for (let sector = 0; sector < segmentCount; sector += 1) {
    const angle = entranceAngle + sector * step;
    if (shouldPlaceLowerBookcase(sector, fireplaceIndex, sidePortalIndices)) {
      addTangentialBookcase(root, materials, books, {
        radius: caseRadius,
        angle,
        width: caseWidth,
        height: lowerHeight,
        baseY: 0.16,
        depth,
        shelfCount,
        seed: sector,
        faces: [-1],
      });
      shelfSections.push({
        id: sector,
        angle,
        radius: caseRadius,
        width: caseWidth,
        height: lowerHeight,
        baseY: 0.16,
        depth,
        shelfCount,
      });
    }

    if (shouldPlaceUpperBookcase(sector, hiddenIndex, windowIndices)) {
      addTangentialBookcase(root, materials, books, {
        radius: caseRadius,
        angle,
        width: caseWidth,
        height: upperHeight,
        baseY: galleryY + 0.18,
        depth,
        shelfCount: shelfCount - 1,
        seed: 100 + sector,
        faces: [-1],
      });
      shelfSections.push({
        id: 100 + sector,
        angle,
        radius: caseRadius,
        width: caseWidth,
        height: upperHeight,
        baseY: galleryY + 0.18,
        depth,
        shelfCount: shelfCount - 1,
      });
    }

    if (windowIndices.has(sector)) {
      const isCentral = sector === 8;
      const windowWidth = isCentral ? LIBRARY.window.width * 1.2 : LIBRARY.window.width;
      const windowHeight = isCentral ? LIBRARY.window.height * 1.08 : LIBRARY.window.height;
      const window = createGothicWindow(
        windowWidth,
        windowHeight,
        materials,
        1,
      );
      window.add(
        createExteriorWindowBackdrop(
          windowWidth * 0.94,
          windowHeight * 0.97,
          sector,
          exteriorRig,
        ),
      );
      const outerReveal = createPointedArch(
        windowWidth + 0.42,
        windowHeight + 0.3,
        materials.stone,
        0.065,
      );
      outerReveal.position.set(0, -0.05, 0.13);
      window.add(outerReveal);
      window.add(
        makeBox(windowWidth + 0.58, 0.18, 0.38, materials.stoneDark, 0, -0.07, 0.08),
      );
      window.add(
        makeBox(windowWidth + 0.32, 0.1, 0.48, materials.stone, 0, 0.04, 0.12),
      );
      for (const x of [-windowWidth * 0.2, 0, windowWidth * 0.2]) {
        window.add(
          makeBox(0.065, windowHeight * 0.78, 0.065, materials.iron, x, windowHeight * 0.39, -0.16),
        );
        const lancet = createPointedArch(
          windowWidth * 0.22,
          windowHeight * 0.28,
          materials.iron,
          0.026,
        );
        lancet.position.set(x, windowHeight * 0.49, -0.165);
        window.add(lancet);
      }
      for (const y of [windowHeight * 0.34, windowHeight * 0.57]) {
        window.add(
          makeBox(windowWidth * 0.78, 0.06, 0.065, materials.iron, 0, y, -0.16),
        );
      }
      const roseY = windowHeight * 0.76;
      const rose = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.032, 7, 24), materials.iron);
      rose.position.set(0, roseY, -0.17);
      window.add(rose);
      for (let spoke = 0; spoke < 6; spoke += 1) {
        const bar = makeBox(0.025, 0.18, 0.045, materials.iron, 0, roseY, -0.18, false);
        bar.rotation.z = (spoke / 6) * Math.PI;
        window.add(bar);
      }
      placePolar(window, innerRadius - 0.26, angle, LIBRARY.window.sillHeight);
      window.userData.view = 'gallery';
      root.add(window);
      if (isCentral) interactiveObjects.push(window);
    }
  }

  for (const boundary of getHallColumnSectionIndices(segmentCount)) {
    const angle = entranceAngle + (boundary + 0.5) * step;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.38, mainHeight - 0.45, 10),
      materials.stoneDark,
    );
    shaft.position.copy(positionFromPolar(innerRadius - 0.5, angle, mainHeight / 2));
    shaft.castShadow = true;
    root.add(shaft);
    for (const y of [5.62, galleryY + 0.14, mainHeight - 0.65]) {
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.36, 0.24, 10), materials.stone);
      capital.position.copy(positionFromPolar(innerRadius - 0.5, angle, y));
      root.add(capital);
    }
    const galleryCorbel = new THREE.Mesh(
      new THREE.ConeGeometry(0.36, 0.82, 8),
      materials.stoneDark,
    );
    galleryCorbel.rotation.z = Math.PI;
    galleryCorbel.position.copy(
      positionFromPolar(innerRadius - 0.7, angle, galleryY - 0.55),
    );
    root.add(galleryCorbel);
  }
}

export function calculateGalleryRailLayout(galleryY: number, windowSillY: number) {
  const lowerRailY = galleryY + 0.16;
  const upperRailY = Math.min(galleryY + 0.82, windowSillY - 0.7);
  const balusterHeight = Math.max(0.3, upperRailY - lowerRailY - 0.04);
  return {
    lowerRailY,
    upperRailY,
    balusterHeight,
    balusterCenterY: (lowerRailY + upperRailY) / 2,
  };
}

function addGallery(
  root: THREE.Group,
  materials: LibraryMaterials,
  interactiveObjects: THREE.Object3D[],
) {
  const { innerRadius, galleryY, galleryDepth, segmentCount, entranceAngle } = LIBRARY.tower;
  const galleryInner = innerRadius - galleryDepth;
  const galleryOuter = innerRadius - 0.26;
  const floorMaterial = materials.woodWarm.clone();
  floorMaterial.side = THREE.DoubleSide;
  floorMaterial.color.setHex(0x4a2d1c);
  const galleryFloor = new THREE.Mesh(
    new THREE.RingGeometry(galleryInner, galleryOuter, 112),
    floorMaterial,
  );
  galleryFloor.rotation.x = -Math.PI / 2;
  galleryFloor.position.y = galleryY;
  galleryFloor.receiveShadow = true;
  galleryFloor.name = 'Upper circular gallery';
  root.add(galleryFloor);
  markCameraCollider(root, {
    id: 'hall-gallery-floor',
    shape: 'arc',
    center: { x: 0, y: galleryY - 0.09, z: 0 },
    radius: (galleryInner + galleryOuter) / 2,
    radialDepth: galleryOuter - galleryInner,
    height: 0.24,
    startAngle: 0,
    endAngle: Math.PI * 2,
    segments: 48,
  });

  const underside = new THREE.Mesh(
    new THREE.RingGeometry(galleryInner - 0.12, galleryOuter + 0.08, 112),
    materials.woodWarm,
  );
  underside.rotation.x = Math.PI / 2;
  underside.position.y = galleryY - 0.18;
  root.add(underside);
  root.add(makeRing(galleryInner + 0.08, 0.055, materials.brass, galleryY - 0.09));
  root.add(makeRing(galleryOuter - 0.08, 0.06, materials.woodWarm, galleryY - 0.11));

  const gallerySpan = galleryOuter - galleryInner - 0.34;
  const galleryMidRadius = (galleryOuter + galleryInner) / 2;
  for (let seam = 0; seam < segmentCount; seam += 1) {
    const angle = entranceAngle + (seam / segmentCount) * Math.PI * 2;
    const inlay = makeBox(0.035, 0.018, gallerySpan, materials.brass, 0, 0, 0, false, false);
    placePolar(inlay, galleryMidRadius, angle, galleryY + 0.02);
    root.add(inlay);
  }

  const rail = new THREE.Group();
  rail.name = 'Gallery balustrade';
  rail.userData.view = 'gallery';
  const railSegments = 56;
  const stairConnection = calculateSpiralStairGalleryConnection();
  const railRadius = stairConnection.railRadius;
  const railLayout = calculateGalleryRailLayout(galleryY, LIBRARY.window.sillHeight);
  const railStart = entranceAngle;
  const railEnd = entranceAngle + Math.PI * 2;
  const unwrapRailAngle = (angle: number) => {
    let unwrappedAngle = angle;
    while (unwrappedAngle < railStart) unwrappedAngle += Math.PI * 2;
    return unwrappedAngle;
  };
  const unwrappedOpeningStart = unwrapRailAngle(stairConnection.openingStartAngle);
  let unwrappedOpeningEnd = unwrapRailAngle(stairConnection.openingEndAngle);
  while (unwrappedOpeningEnd <= unwrappedOpeningStart) {
    unwrappedOpeningEnd += Math.PI * 2;
  }
  const continuousRailArcs: Array<[number, number]> = [
    [railStart, unwrappedOpeningStart],
    [unwrappedOpeningEnd, railEnd],
  ];
  markCameraCollider(rail, continuousRailArcs.map(([startAngle, endAngle], index) => ({
    id: `hall-gallery-rail-${index + 1}`,
    shape: 'arc' as const,
    center: {
      x: 0,
      y: (railLayout.lowerRailY + railLayout.upperRailY) / 2,
      z: 0,
    },
    radius: railRadius,
    radialDepth: 0.18,
    height: railLayout.upperRailY - railLayout.lowerRailY + 0.14,
    startAngle,
    endAngle,
    segments: 28,
  })));
  for (const y of [railLayout.lowerRailY, railLayout.upperRailY]) {
    for (const [startAngle, endAngle] of continuousRailArcs) {
      if (endAngle <= startAngle) continue;
      rail.add(
        makeSmoothArcRail(
          railRadius,
          startAngle,
          endAngle,
          y,
          0.046,
          materials.brass,
        ),
      );
    }
  }
  const terminalPostHeight = railLayout.upperRailY - galleryY + 0.18;
  for (const [index, terminalAngle] of [
    stairConnection.openingStartAngle,
    stairConnection.openingEndAngle,
  ].entries()) {
    const terminalPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.07, terminalPostHeight, 12),
      materials.iron,
    );
    terminalPost.position.copy(positionFromPolar(
      railRadius,
      terminalAngle,
      galleryY + terminalPostHeight / 2,
    ));
    terminalPost.name = index === 0
      ? 'Gallery stair opening outer terminal post'
      : 'Gallery stair opening inner terminal post';
    rail.add(terminalPost);

    const terminalCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 14, 10),
      materials.brass,
    );
    terminalCap.position.copy(positionFromPolar(
      railRadius,
      terminalAngle,
      galleryY + terminalPostHeight + 0.025,
    ));
    rail.add(terminalCap);
  }
  for (let index = 0; index < railSegments; index += 1) {
    const angle = entranceAngle + (index / railSegments) * Math.PI * 2;
    const unwrappedAngle = unwrapRailAngle(angle);
    if (
      unwrappedAngle > unwrappedOpeningStart
      && unwrappedAngle < unwrappedOpeningEnd
    ) continue;
    const baluster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.045, railLayout.balusterHeight, 12),
      materials.iron,
    );
    baluster.position.copy(positionFromPolar(
      railRadius,
      angle,
      railLayout.balusterCenterY,
    ));
    rail.add(baluster);
    const segmentWidth = galleryInner * ((Math.PI * 2) / railSegments) * 0.92;
    if (index % 2 === 0) {
      for (const direction of [-1, 1] as const) {
        const brace = makeBox(segmentWidth * 0.92, 0.04, 0.045, materials.iron);
        placePolar(brace, galleryInner - 0.09, angle, railLayout.balusterCenterY);
        brace.rotation.z = direction * 0.58;
        rail.add(brace);
      }
    }
    if (index % 4 === 0) {
      const ornament = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.022, 12, 32),
        materials.brass,
      );
      ornament.position.copy(positionFromPolar(
        galleryInner - 0.105,
        angle,
        railLayout.balusterCenterY,
      ));
      ornament.rotation.y = yawForAngle(angle);
      rail.add(ornament);
    }
  }
  root.add(rail);
  interactiveObjects.push(rail);

  const step = (Math.PI * 2) / segmentCount;
  for (const section of getHallColumnSectionIndices(segmentCount)) {
    const columnAngle = entranceAngle + (section + 0.5) * step;
    const columnCenter = positionFromPolar(galleryInner - 0.12, columnAngle, 0);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.28, galleryY - 0.36, 9),
      materials.stoneDark,
    );
    column.position.copy(
      positionFromPolar(galleryInner - 0.12, columnAngle, (galleryY - 0.36) / 2),
    );
    column.castShadow = true;
    root.add(column);
    for (let flute = 0; flute < 6; flute += 1) {
      const fluteAngle = (flute / 6) * Math.PI * 2;
      const rib = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.028, galleryY - 1.02, 6),
        materials.stone,
      );
      rib.position.set(
        columnCenter.x + Math.cos(fluteAngle) * 0.205,
        (galleryY - 1.02) / 2 + 0.34,
        columnCenter.z + Math.sin(fluteAngle) * 0.205,
      );
      rib.castShadow = true;
      root.add(rib);
    }
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.4, 0.2, 9),
      materials.stone,
    );
    base.position.copy(positionFromPolar(galleryInner - 0.12, columnAngle, 0.12));
    root.add(base);
    for (const y of [0.28, galleryY - 0.62]) {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.27, 0.045, 8, 20),
        materials.brass,
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.copy(positionFromPolar(galleryInner - 0.12, columnAngle, y));
      root.add(collar);
    }
    const galleryCapital = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.25, 0.24, 9),
      materials.stone,
    );
    galleryCapital.position.copy(
      positionFromPolar(galleryInner - 0.12, columnAngle, galleryY - 0.39),
    );
    root.add(galleryCapital);

    const abacus = makeBox(0.62, 0.13, 0.62, materials.stoneDark, columnCenter.x, galleryY - 0.2, columnCenter.z);
    abacus.rotation.y = yawForAngle(columnAngle);
    root.add(abacus);

  }
}

function addReceptionAndChandelier(root: THREE.Group, materials: LibraryMaterials) {
  const reception = createHorseshoeReception(materials);
  markCameraCollider(reception, {
    id: 'hall-reception-desk',
    shape: 'arc',
    center: { x: 0, y: 0.63, z: VIRTUAL_LIBRARY_LAYOUT.reception.centerZ },
    radius: VIRTUAL_LIBRARY_LAYOUT.reception.radius,
    radialDepth: 0.72,
    height: 1.26,
    startAngle: 0,
    endAngle: Math.PI,
    segments: 24,
  });
  root.add(reception);
  const chandelier = createChandelier(materials, false);
  chandelier.position.set(0, 9.15, 0);
  chandelier.scale.setScalar(1.45);
  markCameraCollider(chandelier, {
    id: 'hall-chandelier',
    shape: 'cylinder',
    center: { x: 0, y: 1, z: 0 },
    radius: 1.02,
    height: 3,
  });
  root.add(chandelier);
}

function addOppositeFireplace(root: THREE.Group, materials: LibraryMaterials): FireplaceFeature {
  const fireplace = createFireplaceFeature(materials);
  const oppositeEntranceAngle = LIBRARY.tower.entranceAngle + Math.PI;
  placePolar(
    fireplace.group,
    LIBRARY.tower.innerRadius - 0.74,
    oppositeEntranceAngle,
    0.08,
  );
  markCameraCollider(fireplace.group, {
    id: 'hall-fireplace',
    shape: 'box',
    center: { x: 0, y: 2.8, z: 0 },
    size: { x: 5.1, y: 5.7, z: 1.16 },
  });
  root.add(fireplace.group);
  return fireplace;
}

function addSpiralStair(
  root: THREE.Group,
  materials: LibraryMaterials,
  interactiveObjects: THREE.Object3D[],
) {
  const stair = new THREE.Group();
  stair.name = 'Entrance spiral staircase';
  stair.userData.view = 'stair';
  stair.position.copy(STAIR_CENTER);
  markCameraCollider(stair, {
    id: 'hall-spiral-stair',
    shape: 'cylinder',
    center: { x: 0, y: (LIBRARY.tower.galleryY + 0.7) / 2, z: 0 },
    radius: 1.74,
    height: LIBRARY.tower.galleryY + 0.7,
  });
  const stepCount = 38;
  const turns = 1.72;
  const rise = (LIBRARY.tower.galleryY - 0.22) / (stepCount - 1);
  const stairConnection = calculateSpiralStairGalleryConnection();
  const stairAxisAngle = stairConnection.stairAxisAngle;
  const exitStepAngle = stairConnection.exitStepAngle;
  const startAngle = exitStepAngle - Math.PI * 2 * turns;
  const stepCenterRadius = SPIRAL_STAIR_GALLERY_CONNECTION.stepCenterRadius;
  const stepRadialLength = SPIRAL_STAIR_GALLERY_CONNECTION.stepRadialLength;
  const outerRailRadius = stepCenterRadius + stepRadialLength / 2 - 0.06;
  const innerRailRadius = stepCenterRadius - stepRadialLength / 2 + 0.2;
  const railPoints: THREE.Vector3[] = [];
  const innerRailPoints: THREE.Vector3[] = [];
  const stringerPoints: THREE.Vector3[] = [];

  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, LIBRARY.tower.galleryY + 0.55, 12),
    materials.iron,
  );
  spindle.position.y = (LIBRARY.tower.galleryY + 0.55) / 2;
  stair.add(spindle);

  for (let index = 0; index < stepCount; index += 1) {
    const angle = startAngle + (index / (stepCount - 1)) * Math.PI * 2 * turns;
    const y = 0.16 + index * rise;
    const step = makeBox(
      stepRadialLength,
      0.12,
      SPIRAL_STAIR_GALLERY_CONNECTION.stepTangentialDepth,
      materials.woodWarm,
      0,
      0,
      0,
    );
    step.position.set(
      Math.cos(angle) * stepCenterRadius,
      y,
      Math.sin(angle) * stepCenterRadius,
    );
    step.rotation.y = -angle;
    const nosing = makeBox(1.27, 0.035, 0.055, materials.brass, 0, 0.075, -0.205, false);
    step.add(nosing);
    stair.add(step);

    if (index % 2 === 0 || index === stepCount - 1) {
      const outerBaluster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.035, 0.82, 12),
        materials.brass,
      );
      outerBaluster.position.set(
        Math.cos(angle) * outerRailRadius,
        y + 0.47,
        Math.sin(angle) * outerRailRadius,
      );
      outerBaluster.castShadow = true;
      outerBaluster.name = `Outer stair baluster ${index + 1}`;
      stair.add(outerBaluster);

      const innerBaluster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.032, 0.66, 12),
        materials.brass,
      );
      innerBaluster.position.set(
        Math.cos(angle) * innerRailRadius,
        y + 0.39,
        Math.sin(angle) * innerRailRadius,
      );
      innerBaluster.castShadow = true;
      innerBaluster.name = `Inner stair baluster ${index + 1}`;
      stair.add(innerBaluster);
    }
    railPoints.push(
      new THREE.Vector3(
        Math.cos(angle) * outerRailRadius,
        y + 0.86,
        Math.sin(angle) * outerRailRadius,
      ),
    );
    innerRailPoints.push(
      new THREE.Vector3(
        Math.cos(angle) * innerRailRadius,
        y + 0.72,
        Math.sin(angle) * innerRailRadius,
      ),
    );
    stringerPoints.push(
      new THREE.Vector3(
        Math.cos(angle) * 1.12,
        y - 0.01,
        Math.sin(angle) * 1.12,
      ),
    );
  }

  const galleryRailLayout = calculateGalleryRailLayout(
    LIBRARY.tower.galleryY,
    LIBRARY.window.sillHeight,
  );
  const toStairLocal = (point: THREE.Vector3) => point.sub(STAIR_CENTER);
  const landingHalfWidth = SPIRAL_STAIR_GALLERY_CONNECTION.landingTangentialWidth / 2;
  const addRailConnection = (points: THREE.Vector3[], side: 'inner' | 'outer') => {
    const sideDirection = side === 'outer' ? 1 : -1;
    const landingSideTangentOffset = stairConnection.landingTangentialCenterOffset
      + sideDirection * (landingHalfWidth - 0.055);
    const terminalAngle = side === 'outer'
      ? stairConnection.openingStartAngle
      : stairConnection.openingEndAngle;
    points.push(
      toStairLocal(positionFromPolar(
        stairConnection.landingInnerRadius + 0.16,
        stairAxisAngle,
        galleryRailLayout.upperRailY - 0.045,
        landingSideTangentOffset,
      )),
      toStairLocal(positionFromPolar(
        stairConnection.landingOuterRadius - 0.16,
        stairAxisAngle,
        galleryRailLayout.upperRailY - 0.015,
        landingSideTangentOffset,
      )),
      toStairLocal(positionFromPolar(
        stairConnection.railRadius,
        terminalAngle,
        galleryRailLayout.upperRailY,
      )),
    );
  };
  addRailConnection(railPoints, 'outer');
  addRailConnection(innerRailPoints, 'inner');
  stringerPoints.push(
    toStairLocal(positionFromPolar(
      stairConnection.landingInnerRadius + 0.16,
      stairAxisAngle,
      LIBRARY.tower.galleryY - 0.17,
      stairConnection.landingTangentialCenterOffset,
    )),
    toStairLocal(positionFromPolar(
      stairConnection.landingOuterRadius - 0.12,
      stairAxisAngle,
      LIBRARY.tower.galleryY - 0.17,
      stairConnection.landingTangentialCenterOffset,
    )),
  );

  const topLanding = new THREE.Group();
  topLanding.position.copy(toStairLocal(positionFromPolar(
    stairConnection.landingCenterRadius,
    stairAxisAngle,
    LIBRARY.tower.galleryY - SPIRAL_STAIR_GALLERY_CONNECTION.landingThickness / 2,
    stairConnection.landingTangentialCenterOffset,
  )));
  topLanding.rotation.y = -stairAxisAngle;
  topLanding.name = 'Spiral stair top landing';
  const landingDeck = makeBox(
    stairConnection.landingRadialLength,
    SPIRAL_STAIR_GALLERY_CONNECTION.landingThickness,
    SPIRAL_STAIR_GALLERY_CONNECTION.landingTangentialWidth,
    materials.woodWarm,
    0,
    0,
    0,
  );
  landingDeck.name = 'Spiral stair top landing deck';
  topLanding.add(landingDeck);
  const landingTrimY = SPIRAL_STAIR_GALLERY_CONNECTION.landingThickness / 2 + 0.02;
  for (const direction of [-1, 1] as const) {
    const sideTrim = makeBox(
      stairConnection.landingRadialLength - 0.08,
      0.035,
      0.05,
      materials.brass,
      0,
      landingTrimY,
      direction * (SPIRAL_STAIR_GALLERY_CONNECTION.landingTangentialWidth / 2 - 0.04),
      false,
    );
    topLanding.add(sideTrim);
  }
  for (const direction of [-1, 1] as const) {
    const threshold = makeBox(
      0.07,
      0.035,
      SPIRAL_STAIR_GALLERY_CONNECTION.landingTangentialWidth - 0.08,
      materials.brass,
      direction * (stairConnection.landingRadialLength / 2 - 0.045),
      landingTrimY,
      0,
      false,
    );
    topLanding.add(threshold);
  }
  stair.add(topLanding);

  const landingSupportHeight = galleryRailLayout.upperRailY - LIBRARY.tower.galleryY - 0.02;
  for (const direction of [-1, 1] as const) {
    const transitionPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, landingSupportHeight, 12),
      materials.brass,
    );
    transitionPost.position.copy(toStairLocal(positionFromPolar(
      stairConnection.landingCenterRadius,
      stairAxisAngle,
      LIBRARY.tower.galleryY + landingSupportHeight / 2,
      stairConnection.landingTangentialCenterOffset
        + direction * (landingHalfWidth - 0.055),
    )));
    transitionPost.name = direction < 0
      ? 'Spiral stair landing inner support post'
      : 'Spiral stair landing outer support post';
    stair.add(transitionPost);
  }

  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints), 128, 0.045, 12, false),
    materials.brass,
  );
  rail.castShadow = true;
  stair.add(rail);
  const innerRail = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(innerRailPoints), 128, 0.032, 12, false),
    materials.brass,
  );
  innerRail.castShadow = true;
  stair.add(innerRail);
  const stringer = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stringerPoints), 128, 0.095, 12, false),
    materials.woodDark,
  );
  stringer.castShadow = true;
  stair.add(stringer);
  for (let collar = 0; collar <= 6; collar += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 12, 32), materials.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.32 + collar * 0.93;
    stair.add(ring);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.7, 0.13, 36), materials.stoneDark);
  base.position.y = 0.065;
  stair.add(base);
  root.add(stair);
  interactiveObjects.push(stair);
}

function addSidePortalFlankingBookcases(
  root: THREE.Group,
  materials: LibraryMaterials,
  books: BookBatch,
  angle: number,
  seedBase: number,
) {
  const radius = LIBRARY.tower.innerRadius - 1.0;
  for (const offset of [-2.28, 2.28]) {
    addTangentialBookcase(root, materials, books, {
      radius,
      angle,
      width: 1.35,
      height: LIBRARY.bookcase.lowerHeight,
      baseY: 0.16,
      depth: LIBRARY.bookcase.depth,
      shelfCount: LIBRARY.bookcase.shelfCount,
      seed: seedBase + Math.round(offset * 10),
      faces: [-1],
      tangentOffset: offset,
      bookWidthScale: 0.7,
    });
  }
}

function addRestrictedEntrance(
  root: THREE.Group,
  materials: LibraryMaterials,
  books: BookBatch,
  interactiveObjects: THREE.Object3D[],
) {
  const radius = LIBRARY.tower.innerRadius - 1.0;
  const portal = VIRTUAL_LIBRARY_LAYOUT.sidePortals;
  addSidePortalFlankingBookcases(
    root,
    materials,
    books,
    ENTRANCE_LEFT_SIDE_ANGLE,
    330,
  );

  const door = createRestrictedPortalGate(
    portal.openingWidth - 0.18,
    portal.openingHeight - 0.14,
    materials,
  );
  placePolar(door, radius - 0.12, ENTRANCE_LEFT_SIDE_ANGLE, 0.12);
  markCameraCollider(door, {
    id: 'hall-restricted-door',
    shape: 'box',
    center: { x: 0, y: portal.openingHeight / 2, z: 0 },
    size: { x: portal.openingWidth, y: portal.openingHeight, z: 0.62 },
  });
  door.userData.view = 'restricted';
  root.add(door);
  interactiveObjects.push(door);

  const arch = createPointedArch(portal.outerWidth, portal.outerHeight, materials.stone, 0.15);
  placePolar(arch, radius + 0.08, ENTRANCE_LEFT_SIDE_ANGLE, 0.12);
  root.add(arch);
  for (const tangentOffset of [-portal.sconceOffset, portal.sconceOffset]) {
    const sconce = new THREE.Group();
    const arm = makeBox(0.06, 0.06, 0.34, materials.brass, 0, 0, -0.12);
    sconce.add(arm);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.075, 0.12, 10), materials.brass);
    cup.position.set(0, 0.08, -0.27);
    sconce.add(cup);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 7), materials.lampGlass);
    flame.scale.set(0.72, 1.7, 0.72);
    flame.position.set(0, 0.28, -0.27);
    sconce.add(flame);
    const sconceLight = new THREE.PointLight(PALETTE.gold, 8.5, 4.2, 2);
    sconceLight.position.set(0, 0.34, -0.56);
    sconce.add(sconceLight);
    placePolar(
      sconce,
      radius - 0.16,
      ENTRANCE_LEFT_SIDE_ANGLE,
      portal.sconceY,
      tangentOffset,
    );
    root.add(sconce);
  }

  const restrictedGlow = new THREE.PointLight(PALETTE.oxblood, 9, 7.5, 2.15);
  restrictedGlow.position.copy(
    positionFromPolar(radius - 1.65, ENTRANCE_LEFT_SIDE_ANGLE, 2.25),
  );
  root.add(restrictedGlow);
  return restrictedGlow;
}

function addDirectorOfficeEntrance(
  root: THREE.Group,
  materials: LibraryMaterials,
  books: BookBatch,
  interactiveObjects: THREE.Object3D[],
) {
  const radius = LIBRARY.tower.innerRadius - 1.0;
  addSidePortalFlankingBookcases(
    root,
    materials,
    books,
    ENTRANCE_RIGHT_SIDE_ANGLE,
    430,
  );

  const office = createDirectorOfficePortal(materials);
  placePolar(office, radius - 0.12, ENTRANCE_RIGHT_SIDE_ANGLE, 0.12);
  markCameraCollider(office, {
    id: 'hall-director-door',
    shape: 'box',
    center: { x: 0, y: VIRTUAL_LIBRARY_LAYOUT.sidePortals.openingHeight / 2, z: 0 },
    size: {
      x: VIRTUAL_LIBRARY_LAYOUT.sidePortals.openingWidth,
      y: VIRTUAL_LIBRARY_LAYOUT.sidePortals.openingHeight,
      z: 0.68,
    },
  });
  root.add(office);
  interactiveObjects.push(office);

  const officeGlow = new THREE.PointLight(PALETTE.gold, 16, 7.2, 2.1);
  officeGlow.name = 'Director office doorway glow';
  officeGlow.position.copy(
    positionFromPolar(radius - 1.45, ENTRANCE_RIGHT_SIDE_ANGLE, 2.45),
  );
  root.add(officeGlow);
}

function addRoof(root: THREE.Group, materials: LibraryMaterials) {
  const { innerRadius, mainHeight, roofHeight, segmentCount, entranceAngle } = LIBRARY.tower;
  const roofBaseY = mainHeight - 0.02;
  const roofInteriorRadius = innerRadius + 0.3;
  const roofExteriorRadius = innerRadius + 1.05;

  const interiorLinerMaterial = new THREE.MeshStandardMaterial({
    color: 0x292621,
    roughness: 0.9,
    metalness: 0.03,
    side: THREE.BackSide,
  });
  const interiorLiner = new THREE.Mesh(
    new THREE.ConeGeometry(roofInteriorRadius, roofHeight, 96, 6, true),
    interiorLinerMaterial,
  );
  interiorLiner.position.y = roofBaseY + roofHeight / 2;
  interiorLiner.receiveShadow = true;
  interiorLiner.name = 'Continuous interior roof liner';
  root.add(interiorLiner);

  const exteriorRoofMaterial = new THREE.MeshStandardMaterial({
    color: 0x171d22,
    emissive: 0x05080a,
    emissiveIntensity: 0.08,
    roughness: 0.88,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const exteriorRoofHeight = roofHeight + 0.48;
  const exteriorRoofBaseY = roofBaseY - 0.22;
  const exteriorRoofTopY = exteriorRoofBaseY + exteriorRoofHeight;
  const exteriorRoofRadiusAt = (heightFraction: number) =>
    0.18 + (roofExteriorRadius - 0.18) * (1 - heightFraction);
  const exteriorRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, roofExteriorRadius, exteriorRoofHeight, 96, 8, true),
    exteriorRoofMaterial,
  );
  exteriorRoof.position.y = exteriorRoofBaseY + exteriorRoofHeight / 2;
  exteriorRoof.castShadow = true;
  exteriorRoof.receiveShadow = true;
  exteriorRoof.frustumCulled = false;
  exteriorRoof.name = 'Continuous exterior slate roof';
  root.add(exteriorRoof);

  const fasciaMaterial = materials.stoneDark.clone();
  fasciaMaterial.side = THREE.DoubleSide;
  const eaveFascia = new THREE.Mesh(
    new THREE.CylinderGeometry(
      roofExteriorRadius + 0.02,
      roofExteriorRadius + 0.08,
      0.42,
      96,
      1,
      true,
    ),
    fasciaMaterial,
  );
  eaveFascia.position.y = roofBaseY + 0.04;
  eaveFascia.castShadow = true;
  eaveFascia.name = 'Closed roof eave fascia';
  root.add(eaveFascia);

  const soffitMaterial = materials.woodDark.clone();
  soffitMaterial.side = THREE.DoubleSide;
  const eaveSoffit = new THREE.Mesh(
    new THREE.RingGeometry(innerRadius - 0.12, roofExteriorRadius + 0.08, 96),
    soffitMaterial,
  );
  eaveSoffit.rotation.x = -Math.PI / 2;
  eaveSoffit.position.y = roofBaseY - 0.16;
  eaveSoffit.receiveShadow = true;
  eaveSoffit.name = 'Closed roof eave soffit';
  root.add(eaveSoffit);

  const roofStep = (Math.PI * 2) / segmentCount;
  const panelHeight = roofHeight - 0.08;
  const panelRadius = roofInteriorRadius - 0.16;
  const interiorRoofRadiusAt = (heightFraction: number) =>
    Math.max(0.08, roofInteriorRadius * (1 - heightFraction) - 0.2);
  const interiorRoofPath = (angle: number, radialInset = 0) =>
    new THREE.CatmullRomCurve3(
      [0.02, 0.34, 0.76, 0.98].map((heightFraction) =>
        positionFromPolar(
          Math.max(0.05, interiorRoofRadiusAt(heightFraction) - radialInset),
          angle,
          roofBaseY + roofHeight * heightFraction,
        ),
      ),
      false,
      'centripetal',
    );
  for (let panelIndex = 0; panelIndex < segmentCount; panelIndex += 1) {
    const panel = new THREE.Mesh(
      new THREE.ConeGeometry(
        panelRadius,
        panelHeight,
        10,
        4,
        true,
        entranceAngle + panelIndex * roofStep - 0.002,
        roofStep + 0.004,
      ),
      materials.ceilingPanels[panelIndex % materials.ceilingPanels.length],
    );
    panel.position.y = roofBaseY + panelHeight / 2 + 0.035;
    panel.receiveShadow = true;
    panel.name = `Painted ceiling panel ${panelIndex + 1}`;
    root.add(panel);
  }

  const roofNodeGeometry = new THREE.SphereGeometry(0.1, 12, 9);
  const panelBossGeometry = new THREE.SphereGeometry(0.075, 10, 8);
  for (let ribIndex = 0; ribIndex < segmentCount; ribIndex += 1) {
    const angle = entranceAngle + (ribIndex / segmentCount) * Math.PI * 2;
    const rib = new THREE.Mesh(
      new THREE.TubeGeometry(interiorRoofPath(angle), 48, 0.105, 12, false),
      materials.woodDark,
    );
    rib.castShadow = true;
    rib.name = `Interior roof rib ${ribIndex + 1}`;
    root.add(rib);

    for (const trimOffset of [-0.028, 0.028]) {
      const trim = new THREE.Mesh(
        new THREE.TubeGeometry(
          interiorRoofPath(angle + trimOffset, 0.035),
          42,
          0.024,
          8,
          false,
        ),
        materials.brass,
      );
      trim.name = `Gilded rib trim ${ribIndex + 1}`;
      root.add(trim);
    }

    for (const heightFraction of [0.36, 0.67]) {
      const node = new THREE.Mesh(roofNodeGeometry, materials.brass);
      node.position.copy(
        positionFromPolar(
          interiorRoofRadiusAt(heightFraction) - 0.04,
          angle,
          roofBaseY + roofHeight * heightFraction,
        ),
      );
      node.scale.set(1, 0.78, 1);
      node.name = `Roof rib intersection boss ${ribIndex + 1}`;
      root.add(node);
    }

    const panelAngle = angle + roofStep / 2;
    const panelBoss = new THREE.Mesh(panelBossGeometry, materials.brass);
    panelBoss.position.copy(
      positionFromPolar(
        interiorRoofRadiusAt(0.52) - 0.035,
        panelAngle,
        roofBaseY + roofHeight * 0.52,
      ),
    );
    panelBoss.name = `Painted panel boss ${ribIndex + 1}`;
    root.add(panelBoss);

    const exteriorPoints = [
      positionFromPolar(
        exteriorRoofRadiusAt(0.02) + 0.07,
        angle,
        exteriorRoofBaseY + exteriorRoofHeight * 0.02,
      ),
      positionFromPolar(
        exteriorRoofRadiusAt(0.34) + 0.07,
        angle,
        exteriorRoofBaseY + exteriorRoofHeight * 0.34,
      ),
      positionFromPolar(
        exteriorRoofRadiusAt(0.76) + 0.07,
        angle,
        exteriorRoofBaseY + exteriorRoofHeight * 0.76,
      ),
      positionFromPolar(
        exteriorRoofRadiusAt(0.98) + 0.05,
        angle,
        exteriorRoofBaseY + exteriorRoofHeight * 0.98,
      ),
    ];
    const exteriorSeam = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(exteriorPoints, false, 'centripetal'),
        34,
        0.055,
        8,
        false,
      ),
      materials.iron,
    );
    exteriorSeam.castShadow = true;
    exteriorSeam.name = `Exterior standing seam ${ribIndex + 1}`;
    root.add(exteriorSeam);
  }

  const dentilGeometry = new THREE.BoxGeometry(0.25, 0.17, 0.28);
  for (let dentilIndex = 0; dentilIndex < segmentCount * 4; dentilIndex += 1) {
    const angle = entranceAngle + (dentilIndex / (segmentCount * 4)) * Math.PI * 2;
    const dentil = new THREE.Mesh(dentilGeometry, materials.woodWarm);
    placePolar(dentil, innerRadius - 0.24, angle, roofBaseY - 0.17);
    dentil.castShadow = true;
    dentil.name = `Ceiling cornice dentil ${dentilIndex + 1}`;
    root.add(dentil);
  }

  for (const heightFraction of [0.25, 0.5, 0.75]) {
    root.add(
      makeRing(
        exteriorRoofRadiusAt(heightFraction) + 0.075,
        0.038,
        materials.iron,
        exteriorRoofBaseY + exteriorRoofHeight * heightFraction,
      ),
    );
  }
  root.add(makeRing(roofExteriorRadius + 0.09, 0.13, materials.iron, roofBaseY - 0.06));
  root.add(makeRing(roofExteriorRadius + 0.07, 0.055, materials.brass, roofBaseY + 0.16));
  root.add(makeRing(innerRadius - 0.12, 0.18, materials.woodDark, mainHeight + 0.06));
  root.add(makeRing(innerRadius - 0.42, 0.085, materials.brass, roofBaseY - 0.11));
  root.add(
    makeRing(
      interiorRoofRadiusAt(0.12),
      0.065,
      materials.woodWarm,
      roofBaseY + roofHeight * 0.12,
    ),
  );
  root.add(
    makeRing(
      interiorRoofRadiusAt(0.36),
      0.11,
      materials.brass,
      roofBaseY + roofHeight * 0.36,
    ),
  );
  root.add(
    makeRing(
      interiorRoofRadiusAt(0.67),
      0.09,
      materials.woodWarm,
      roofBaseY + roofHeight * 0.67,
    ),
  );
  root.add(
    makeRing(
      interiorRoofRadiusAt(0.7),
      0.035,
      materials.brass,
      roofBaseY + roofHeight * 0.7,
    ),
  );
  root.add(
    makeRing(
      interiorRoofRadiusAt(0.86),
      0.055,
      materials.brass,
      roofBaseY + roofHeight * 0.86,
    ),
  );
  root.add(
    makeRing(
      interiorRoofRadiusAt(0.92),
      0.045,
      materials.woodDark,
      roofBaseY + roofHeight * 0.92,
    ),
  );
  const canopyY = roofBaseY + roofHeight - 0.36;
  const centralCanopy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.96, 0.2, 16, 2),
    materials.woodDark,
  );
  centralCanopy.position.y = canopyY;
  centralCanopy.castShadow = true;
  centralCanopy.name = 'Layered ceiling crown';
  root.add(centralCanopy);
  const canopyInset = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.67, 0.1, 16, 1),
    materials.woodWarm,
  );
  canopyInset.position.y = canopyY - 0.13;
  canopyInset.name = 'Ceiling crown inset';
  root.add(canopyInset);
  root.add(makeRing(0.82, 0.075, materials.brass, canopyY - 0.12));
  root.add(makeRing(0.58, 0.045, materials.brass, canopyY - 0.2));
  const crownPetalGeometry = new THREE.SphereGeometry(0.105, 10, 8);
  for (let petalIndex = 0; petalIndex < 8; petalIndex += 1) {
    const angle = (petalIndex / 8) * Math.PI * 2;
    const petal = new THREE.Mesh(crownPetalGeometry, materials.brass);
    petal.position.set(Math.cos(angle) * 0.45, canopyY - 0.19, Math.sin(angle) * 0.45);
    petal.scale.set(1.25, 0.5, 0.85);
    petal.rotation.y = -angle;
    petal.name = `Ceiling crown petal ${petalIndex + 1}`;
    root.add(petal);
  }
  const pendantChain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.35, 8),
    materials.iron,
  );
  pendantChain.position.y = mainHeight + roofHeight - 1.0;
  root.add(pendantChain);
  const pendantCrown = new THREE.Mesh(
    new THREE.ConeGeometry(0.38, 0.62, 10, 1, true),
    materials.brass,
  );
  pendantCrown.position.y = mainHeight + roofHeight - 1.72;
  pendantCrown.rotation.x = Math.PI;
  root.add(pendantCrown);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), materials.brass);
  boss.position.y = canopyY - 0.26;
  boss.userData.view = 'gallery';
  root.add(boss);

  const exteriorFinialBase = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 12),
    materials.iron,
  );
  exteriorFinialBase.position.y = exteriorRoofTopY + 0.06;
  root.add(exteriorFinialBase);
  const exteriorFinial = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.72, 12),
    materials.brass,
  );
  exteriorFinial.position.y = exteriorRoofTopY + 0.48;
  exteriorFinial.castShadow = true;
  root.add(exteriorFinial);
  const finialCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.035, 10, 24),
    materials.brass,
  );
  finialCollar.rotation.x = Math.PI / 2;
  finialCollar.position.y = exteriorRoofTopY + 0.82;
  root.add(finialCollar);
  const finialPearl = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 14, 10),
    materials.brass,
  );
  finialPearl.position.y = exteriorRoofTopY + 0.9;
  root.add(finialPearl);
  const finialNeedle = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.42, 10),
    materials.iron,
  );
  finialNeedle.position.y = exteriorRoofTopY + 1.14;
  finialNeedle.castShadow = true;
  root.add(finialNeedle);
}

function addLighting(root: THREE.Group): LightingRig {
  const ambient = new THREE.HemisphereLight(0x8999aa, 0x24150e, 0.84);
  root.add(ambient);
  root.add(new THREE.AmbientLight(0x8b725d, 0.4));

  const moon = new THREE.DirectionalLight(0xb8cee0, 1.55);
  moon.position.set(-8, 16, -10);
  moon.target.position.set(0, 2.5, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1536, 1536);
  moon.shadow.camera.left = -18;
  moon.shadow.camera.right = 18;
  moon.shadow.camera.top = 18;
  moon.shadow.camera.bottom = -18;
  moon.shadow.camera.near = 2;
  moon.shadow.camera.far = 52;
  moon.shadow.bias = -0.0012;
  root.add(moon, moon.target);

  const centralWarmth = new THREE.SpotLight(0xffaa64, 310, 38, Math.PI / 3.1, 0.75, 1.45);
  centralWarmth.position.set(0, 11.8, 2.5);
  centralWarmth.target.position.set(0, 0.8, -1.8);
  root.add(centralWarmth, centralWarmth.target);

  const windowLight = new THREE.SpotLight(0xbcd6ec, 260, 34, Math.PI / 4.3, 0.68, 1.5);
  windowLight.position.set(0, 10.5, -13.4);
  windowLight.target.position.set(0, 1.2, 0.8);
  root.add(windowLight, windowLight.target);

  const receptionGlow = new THREE.PointLight(0xffa058, 24, 13, 2.0);
  receptionGlow.position.set(0, 3.8, 0.6);
  root.add(receptionGlow);

  const galleryGlow = new THREE.PointLight(0xffb36e, 88, 20, 2.0);
  galleryGlow.position.set(0, 9.15, 0);
  root.add(galleryGlow);

  const galleryAccent = new THREE.PointLight(0xffa668, 26, 11, 2.0);
  galleryAccent.position.set(-9.8, 8.0, 1.8);
  root.add(galleryAccent);

  for (let index = 0; index < 8; index += 1) {
    const angle = LIBRARY.tower.entranceAngle + (index / 8) * Math.PI * 2;
    const shelfWash = new THREE.SpotLight(0xffb277, 42, 10, Math.PI / 4.8, 0.82, 1.7);
    shelfWash.name = `Shelf wash light ${index + 1}`;
    shelfWash.position.copy(positionFromPolar(8.1, angle, 6.4));
    shelfWash.target.position.copy(positionFromPolar(13.25, angle, 4.9));
    root.add(shelfWash, shelfWash.target);
  }
  return { moon, windowLight };
}

function addWindowLightShafts(root: THREE.Group) {
  const shaftMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.glassBlue,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  shaftMaterial.forceSinglePass = true;
  shaftMaterial.userData.batchTransparent = true;
  for (const angle of [-Math.PI / 2, Math.PI, 0]) {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 5.8), shaftMaterial);
    placePolar(shaft, 8.4, angle, 6.2);
    shaft.rotation.x = -0.32;
    root.add(shaft);
  }
}

export function buildLibraryScene(): BuiltLibrary {
  const root = new THREE.Group();
  root.name = "BookKin circular tower library";
  const interactiveObjects: THREE.Object3D[] = [];
  const shelfSections: ExpandableShelfSection[] = [];
  const materials = createLibraryMaterials();
  const books = new BookBatch();
  const exteriorRig: ExteriorWindowRig = { materials: [], textures: [] };

  const entrance = addFloorAndShell(root, materials);
  interactiveObjects.push(entrance);
  addOuterBookWalls(
    root,
    materials,
    books,
    interactiveObjects,
    exteriorRig,
    shelfSections,
  );
  new THREE.TextureLoader().load('/assets/virtual-library/circular-library-night-panorama-optimized.jpg', (loadedTexture) => {
    exteriorRig.textures.forEach((texture) => {
      texture.image = loadedTexture.image;
      texture.needsUpdate = true;
    });
  });
  addGallery(root, materials, interactiveObjects);
  addReceptionAndChandelier(root, materials);
  const fireplace = addOppositeFireplace(root, materials);
  addSpiralStair(root, materials, interactiveObjects);
  const restrictedGlow = addRestrictedEntrance(root, materials, books, interactiveObjects);
  addDirectorOfficeEntrance(root, materials, books, interactiveObjects);
  addRoof(root, materials);
  const lighting = addLighting(root);
  addWindowLightShafts(root);

  const setExteriorPreset = (presetId: ExteriorPresetId) => {
    const preset = EXTERIOR_PRESETS.find((candidate) => candidate.id === presetId)
      ?? EXTERIOR_PRESETS[0];
    exteriorRig.materials.forEach((material) => {
      material.emissive.setHex(preset.backdropTint);
      material.emissiveIntensity = preset.backdropIntensity;
    });
    exteriorRig.textures.forEach((texture) => {
      texture.offset.x = Number(texture.userData.baseOffset ?? 0) + preset.textureShift;
      texture.offset.y = preset.textureY;
    });
    materials.glass.color.setHex(preset.glassTint);
    materials.glass.emissive.setHex(preset.glassEmissive);
    materials.glass.emissiveIntensity = preset.glassEmissiveIntensity;
    lighting.windowLight.color.setHex(preset.windowLightColor);
    lighting.windowLight.intensity = preset.windowLightIntensity;
    lighting.moon.color.setHex(preset.moonColor);
    lighting.moon.intensity = preset.moonIntensity;
  };
  setExteriorPreset('moonlit');

  return {
    root,
    materials,
    bookSlots: books.getSlots(),
    shelfSections,
    interactiveObjects,
    restrictedGlow,
    animateEnvironment(elapsed) {
      restrictedGlow.intensity = 17 + Math.sin(elapsed * 1.8) * 1.2;
      fireplace.animate(elapsed);
    },
    setExteriorPreset,
  };
}
