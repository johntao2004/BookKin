import * as THREE from "three";
import { addScholasticRoomCeiling } from "./virtual-library-model/scene/scholasticArchitecture";
import { tokens } from "../theme/generated-tokens";
import { PALETTE } from "./virtual-library-model/config";
import {
  markCameraCollider,
  type LocalCameraColliderDescriptor,
} from "./virtual-library-collision";
import { createLibraryMaterials, type LibraryMaterials } from "./virtual-library-model/scene/materials";
import {
  createChandelier,
  createPlaqueTexture,
  createRestrictedLectern,
  makeBox,
} from "./virtual-library-model/scene/parts";
import {
  createMoonlitLibraryStainedGlassMaterial,
  createPointedWindowShape,
  createStainedGlassCame,
  createStainedGlassPaneGeometry,
} from "./virtual-library-model/scene/stainedGlass";

export type LibraryRoomId = "hall" | "restricted" | "director";

export const LIBRARY_ROOM_CAMERA_VIEW = {
  targetX: 0,
  targetZ: -0.5,
  mobileBreakpoint: 720,
  desktop: {
    radius: 5.3,
    fov: 72,
    targetY: 2.65,
  },
  mobile: {
    radius: 5.1,
    fov: 78,
    targetY: 2.35,
  },
} as const;

export const LIBRARY_ROOM_SHELL_LAYOUT = {
  centerZ: -0.5,
  width: 11.8,
  depth: 13.2,
  wallHeight: 6.5,
  wallCenterY: 3.25,
  wallThickness: 0.42,
  sideWallX: 5.9,
  rearWallZ: -6.45,
  frontBoundaryZ: 6.31,
  floorCenterY: -0.11,
  floorHeight: 0.22,
  ceilingCenterY: 6.42,
  ceilingHeight: 0.34,
} as const;

type IndependentLibraryRoomId = Exclude<LibraryRoomId, "hall">;

export function createRoomShellCameraDescriptors(
  room: IndependentLibraryRoomId,
): LocalCameraColliderDescriptor[] {
  const layout = LIBRARY_ROOM_SHELL_LAYOUT;
  return [
    {
      id: `${room}-floor`,
      shape: "box",
      center: { x: 0, y: layout.floorCenterY, z: layout.centerZ },
      size: { x: layout.width, y: layout.floorHeight, z: layout.depth },
    },
    {
      id: `${room}-rear-wall`,
      shape: "box",
      center: { x: 0, y: layout.wallCenterY, z: layout.rearWallZ },
      size: { x: layout.width, y: layout.wallHeight, z: layout.wallThickness },
    },
    {
      id: `${room}-left-wall`,
      shape: "box",
      center: { x: -layout.sideWallX, y: layout.wallCenterY, z: layout.centerZ },
      size: { x: layout.wallThickness, y: layout.wallHeight, z: layout.depth },
    },
    {
      id: `${room}-right-wall`,
      shape: "box",
      center: { x: layout.sideWallX, y: layout.wallCenterY, z: layout.centerZ },
      size: { x: layout.wallThickness, y: layout.wallHeight, z: layout.depth },
    },
    {
      id: `${room}-ceiling`,
      shape: "box",
      center: { x: 0, y: layout.ceilingCenterY, z: layout.centerZ },
      size: { x: layout.width, y: layout.ceilingHeight, z: layout.depth },
    },
    {
      id: `${room}-front-boundary`,
      shape: "box",
      center: { x: 0, y: layout.wallCenterY, z: layout.frontBoundaryZ },
      size: { x: layout.width, y: layout.wallHeight, z: layout.wallThickness },
    },
  ];
}

export interface VirtualLibraryRooms {
  restricted: THREE.Group;
  director: THREE.Group;
  animate: (elapsed: number) => void;
}

export const DIRECTOR_OFFICE_ARTWORK_ASSET =
  "/assets/virtual-library/director-office-moonlit-study-v1.jpg";
export const DIRECTOR_OFFICE_GLOBE_TEXTURE_ASSET =
  "/assets/virtual-library/earth-no-clouds-nasa-svs.jpg";
export const DIRECTOR_OFFICE_FURNITURE_LAYOUT = {
  desk: {
    x: 0,
    z: -0.55,
    rotationY: Math.PI,
  },
  chair: {
    x: 0,
    z: -2.15,
    rotationY: 0,
  },
} as const;
export const DIRECTOR_OFFICE_ROOM_LAYOUT = {
  showPlaque: false,
  sideBookcaseZs: [-4.2, -1.3, 1.6, 4.5],
  bookcaseWidth: 2.25,
  moonWindow: {
    side: -1,
    z: 1.6,
    bottomY: 1.36,
    width: 2.15,
    height: 3.65,
    interiorFacingRotationY: Math.PI / 2,
  },
} as const;
export const RESTRICTED_ARCHIVE_ROOM_LAYOUT = {
  showRearArch: false,
  showPlaque: false,
  focalFeature: "sealed-vault",
} as const;
export const DIRECTOR_OFFICE_ARTWORK_LAYOUT = {
  x: 0,
  y: 3.07,
  width: 1.78,
  height: 2.67,
} as const;

export function getDirectorOfficeBookcaseZs(side: -1 | 1) {
  const { moonWindow, sideBookcaseZs } = DIRECTOR_OFFICE_ROOM_LAYOUT;
  return side === moonWindow.side
    ? sideBookcaseZs.filter((z) => z !== moonWindow.z)
    : [...sideBookcaseZs];
}

interface RoomShellOptions {
  showRearArch?: boolean;
  showPlaque?: boolean;
  chandelierY?: number;
  chandelierZ?: number;
  chandelierScale?: number;
}

function createPointedArch(width: number, height: number, material: THREE.Material, z: number) {
  const shoulder = height * 0.57;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-width / 2, 0, z),
    new THREE.Vector3(-width / 2, shoulder, z),
    new THREE.Vector3(-width * 0.3, height * 0.84, z),
    new THREE.Vector3(0, height, z),
    new THREE.Vector3(width * 0.3, height * 0.84, z),
    new THREE.Vector3(width / 2, shoulder, z),
    new THREE.Vector3(width / 2, 0, z),
  ]);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, 0.12, 9, false), material);
  arch.castShadow = true;
  return arch;
}

export function createDirectorOfficeStainedGlassWindow(
  materials: LibraryMaterials,
  width: number,
  height: number,
) {
  const window = new THREE.Group();
  window.name = "Director office moonlit library stained-glass window";
  window.userData.motif = "moonlit-library";

  const glass = new THREE.Mesh(
    createStainedGlassPaneGeometry(
      createPointedWindowShape(width, height),
      width,
      height,
    ),
    createMoonlitLibraryStainedGlassMaterial("window"),
  );
  glass.name = "Director office moonlit library stained-glass pane";
  glass.position.z = 0.04;
  glass.userData.motif = "moonlit-library";
  window.add(glass);

  const frame = createPointedArch(width + 0.2, height + 0.14, materials.stone, 0.15);
  frame.name = "Director office single pointed stone window frame";
  window.add(frame);

  const archStart = height * 0.58;
  const cameZ = 0.19;
  for (const direction of [-1, 1] as const) {
    const x = direction * width * 0.18;
    window.add(createStainedGlassCame(
      new THREE.Vector2(x, 0.1),
      new THREE.Vector2(x, height * 0.56),
      materials.iron,
      `Director office stained-glass ${direction < 0 ? "left" : "right"} vertical lead came`,
      cameZ,
      0.045,
    ));
    window.add(createStainedGlassCame(
      new THREE.Vector2(x, height * 0.56),
      new THREE.Vector2(direction * width * 0.42, archStart + height * 0.12),
      materials.iron,
      `Director office stained-glass ${direction < 0 ? "left" : "right"} outer Y branch`,
      cameZ,
      0.04,
    ));
    window.add(createStainedGlassCame(
      new THREE.Vector2(x, height * 0.56),
      new THREE.Vector2(0, height * 0.95),
      materials.iron,
      `Director office stained-glass ${direction < 0 ? "left" : "right"} inner Y branch`,
      cameZ,
      0.04,
    ));
  }
  window.add(createStainedGlassCame(
    new THREE.Vector2(-width * 0.44, height * 0.4),
    new THREE.Vector2(width * 0.44, height * 0.4),
    materials.iron,
    "Director office stained-glass horizontal lead came",
    cameZ,
    0.045,
  ));

  return window;
}

function createRoomPlaque(title: string, subtitle: string) {
  const material = new THREE.MeshStandardMaterial({
    map: createPlaqueTexture(title, subtitle),
    transparent: true,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 1.05), material);
  plaque.position.set(0, 5.25, -6.03);
  plaque.name = `${title} room plaque`;
  return plaque;
}

function createRoomShell(
  group: THREE.Group,
  materials: LibraryMaterials,
  title: string,
  subtitle: string,
  options: RoomShellOptions = {},
) {
  const roomPrefix = title === "禁书档案室" ? "restricted" : "director";
  const shell = LIBRARY_ROOM_SHELL_LAYOUT;
  markCameraCollider(group, createRoomShellCameraDescriptors(roomPrefix));
  const floor = makeBox(
    shell.width,
    shell.floorHeight,
    shell.depth,
    materials.floor,
    0,
    shell.floorCenterY,
    shell.centerZ,
    false,
  );
  floor.name = `${title} timber floor`;
  group.add(floor);
  group.add(makeBox(
    shell.width,
    shell.wallHeight,
    shell.wallThickness,
    materials.stoneDark,
    0,
    shell.wallCenterY,
    shell.rearWallZ,
  ));
  group.add(makeBox(
    shell.wallThickness,
    shell.wallHeight,
    shell.depth,
    materials.stoneDark,
    -shell.sideWallX,
    shell.wallCenterY,
    shell.centerZ,
  ));
  group.add(makeBox(
    shell.wallThickness,
    shell.wallHeight,
    shell.depth,
    materials.stoneDark,
    shell.sideWallX,
    shell.wallCenterY,
    shell.centerZ,
  ));
  group.add(makeBox(
    shell.width,
    shell.ceilingHeight,
    shell.depth,
    materials.woodDark,
    0,
    shell.ceilingCenterY,
    shell.centerZ,
  ));

  for (const x of [-5.55, -3.7, -1.85, 0, 1.85, 3.7, 5.55]) {
    group.add(makeBox(0.16, 5.82, 0.18, materials.woodWarm, x, 2.91, -6.16));
  }
  for (const y of [0.35, 2.05, 3.75, 5.72]) {
    group.add(makeBox(11.3, 0.13, 0.2, materials.brass, 0, y, -6.14, false));
  }
  for (const z of [-4.85, -2.35, 0.15, 2.65, 5.15]) {
    const beam = makeBox(11.45, 0.26, 0.32, materials.woodWarm, 0, 6.18, z);
    beam.name = `${title} ceiling beam`;
    group.add(beam);
    for (const x of [-5.4, 5.4]) {
      const corbel = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.78, 8), materials.woodDark);
      corbel.rotation.z = x < 0 ? -Math.PI / 2 : Math.PI / 2;
      corbel.position.set(x, 5.78, z);
      group.add(corbel);
    }
  }

  if (options.showRearArch !== false) {
    group.add(createPointedArch(4.25, 5.15, materials.stone, -6.08));
    const innerArch = createPointedArch(3.82, 4.85, materials.brass, -6.0);
    innerArch.scale.set(0.98, 0.98, 0.98);
    group.add(innerArch);
  }
  if (options.showPlaque !== false) group.add(createRoomPlaque(title, subtitle));

  const ceilingBottom = LIBRARY_ROOM_SHELL_LAYOUT.ceilingCenterY - LIBRARY_ROOM_SHELL_LAYOUT.ceilingHeight / 2;
  const chandelier = createChandelier(materials, true,
    (ceilingBottom - (options.chandelierY ?? 4.2)) / (options.chandelierScale ?? 0.78));
  chandelier.position.set(0, options.chandelierY ?? 4.2, options.chandelierZ ?? -0.7);
  chandelier.scale.setScalar(options.chandelierScale ?? 0.78);
  markCameraCollider(chandelier, {
    id: `${roomPrefix}-chandelier`,
    shape: "cylinder",
    center: { x: 0, y: 1, z: 0 },
    radius: 1.02,
    height: 3,
  });
  group.add(chandelier);

  const ambient = new THREE.HemisphereLight(
    tokens.color.primitive.cream200,
    tokens.color.primitive.ink900,
    1.08,
  );
  ambient.position.y = 6;
  group.add(ambient);
  group.add(new THREE.AmbientLight(tokens.color.primitive.amber600, 0.22));
  const roomWashTarget = new THREE.Object3D();
  roomWashTarget.position.set(0, 2.25, -1.6);
  const roomWash = new THREE.SpotLight(
    tokens.color.primitive.cream100,
    145,
    22,
    Math.PI / 3.15,
    0.76,
    1.5,
  );
  roomWash.name = `${title} ceiling wash`;
  roomWash.position.set(0, 5.85, 3.4);
  roomWash.target = roomWashTarget;
  group.add(roomWash, roomWashTarget);
}

function createArchiveBay(materials: LibraryMaterials, side: -1 | 1, z: number, index: number) {
  const group = new THREE.Group();
  group.name = `Restricted archive cabinet ${index + 1}`;
  const width = 2.18;
  const height = 4.72;
  const depth = 0.68;
  markCameraCollider(group, {
    id: `restricted-cabinet-${side < 0 ? "left" : "right"}-${index + 1}`,
    shape: "box",
    center: { x: 0, y: (height + 0.2) / 2, z: 0 },
    size: { x: width + 0.24, y: height + 0.2, z: depth + 0.2 },
  });
  group.add(makeBox(width + 0.18, 0.24, depth + 0.18, materials.woodDark, 0, 0.12, 0));
  group.add(makeBox(width + 0.24, 0.2, depth + 0.2, materials.woodWarm, 0, height + 0.1, 0));
  for (const x of [-width / 2, width / 2]) {
    group.add(makeBox(0.18, height, depth + 0.12, materials.woodWarm, x, height / 2, 0));
  }
  group.add(makeBox(width, height - 0.24, 0.12, materials.woodDark, 0, height / 2, -depth / 2));
  for (let shelf = 0; shelf <= 5; shelf += 1) {
    const y = 0.42 + shelf * 0.78;
    group.add(makeBox(width, 0.11, depth + 0.08, materials.woodWarm, 0, y, 0));
    if (shelf < 5) {
      const bookMaterials = [materials.leather, materials.woodDark, materials.woodWarm] as const;
      for (let book = 0; book < 6; book += 1) {
        const bookWidth = 0.24 + ((book + shelf + index) % 3) * 0.035;
        const bookHeight = 0.5 + ((book * 2 + shelf + index) % 3) * 0.055;
        const x = -0.82 + book * 0.325;
        const centerY = y + 0.07 + bookHeight / 2;
        group.add(makeBox(
          bookWidth,
          bookHeight,
          0.46,
          bookMaterials[(book + shelf + index) % bookMaterials.length],
          x,
          centerY,
          0.01,
        ));
        if ((book + shelf) % 2 === 0) {
          group.add(makeBox(
            bookWidth + 0.014,
            0.026,
            0.48,
            materials.brass,
            x,
            centerY + bookHeight * 0.26,
            0.018,
            false,
          ));
        }
      }
      const seal = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 20), materials.brass);
      seal.position.set(0, y + 0.12, depth / 2 + 0.08);
      group.add(seal);
    }
  }
  for (const x of [-0.78, -0.39, 0, 0.39, 0.78]) {
    group.add(makeBox(0.045, height - 0.6, 0.05, materials.iron, x, height / 2, depth / 2 + 0.11));
  }
  for (const y of [1.35, 3.05]) {
    group.add(makeBox(width, 0.055, 0.06, materials.iron, 0, y, depth / 2 + 0.12));
  }
  const chainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.92, 2.6, depth / 2 + 0.18),
    new THREE.Vector3(-0.42, 2.25, depth / 2 + 0.24),
    new THREE.Vector3(0, 2.12, depth / 2 + 0.25),
    new THREE.Vector3(0.42, 2.25, depth / 2 + 0.24),
    new THREE.Vector3(0.92, 2.6, depth / 2 + 0.18),
  ]);
  const chain = new THREE.Mesh(new THREE.TubeGeometry(chainCurve, 28, 0.035, 8, false), materials.brass);
  group.add(chain);
  group.position.set(side * 5.32, 0.04, z);
  group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  return group;
}

function createVaultChain(
  points: THREE.Vector3[],
  material: THREE.Material,
  name: string,
) {
  const chain = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, 0.055, 9, false),
    material,
  );
  chain.name = name;
  chain.castShadow = true;
  return chain;
}

function createRestrictedVault(materials: LibraryMaterials) {
  const vault = new THREE.Group();
  vault.name = "Restricted archive sealed double-door vault";
  markCameraCollider(vault, {
    id: "restricted-vault",
    shape: "box",
    center: { x: 0, y: 2.5, z: 0.12 },
    size: { x: 4.76, y: 5, z: 0.74 },
  });

  vault.add(makeBox(4.76, 0.28, 0.56, materials.stone, 0, 0.14, 0));
  vault.add(makeBox(4.76, 0.34, 0.56, materials.stone, 0, 4.82, 0));
  for (const x of [-2.2, 2.2]) {
    vault.add(makeBox(0.36, 4.62, 0.54, materials.stone, x, 2.45, 0));
    vault.add(makeBox(0.17, 4.34, 0.64, materials.brass, x, 2.43, 0.07));
  }

  for (const side of [-1, 1] as const) {
    const leafX = side * 0.96;
    const door = makeBox(1.86, 4.34, 0.28, materials.woodDark, leafX, 2.38, 0.08);
    door.name = `Restricted archive ${side < 0 ? "left" : "right"} vault door`;
    vault.add(door);

    for (const y of [1.32, 3.43]) {
      const inset = makeBox(1.5, 1.64, 0.1, materials.woodWarm, leafX, y, 0.25);
      inset.name = "Restricted archive recessed timber door panel";
      vault.add(inset);
      for (const edgeY of [y - 0.74, y + 0.74]) {
        vault.add(makeBox(1.58, 0.08, 0.08, materials.brass, leafX, edgeY, 0.32));
      }
      for (const edgeX of [leafX - 0.71, leafX + 0.71]) {
        vault.add(makeBox(0.08, 1.56, 0.08, materials.brass, edgeX, y, 0.32));
      }
    }

    vault.add(makeBox(0.16, 4.18, 0.1, materials.iron, leafX, 2.38, 0.31));
    for (const y of [0.72, 2.38, 4.04]) {
      vault.add(makeBox(1.74, 0.15, 0.11, materials.iron, leafX, y, 0.32));
      for (const rivetX of [leafX - 0.67, leafX, leafX + 0.67]) {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 7), materials.brass);
        rivet.name = "Restricted archive vault rivet";
        rivet.position.set(rivetX, y, 0.41);
        vault.add(rivet);
      }
    }

    const hingeX = side * 1.78;
    for (const y of [1.08, 3.68]) {
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.42, 12),
        materials.brass,
      );
      hinge.name = "Restricted archive vault hinge barrel";
      hinge.position.set(hingeX, y, 0.39);
      vault.add(hinge);
    }
  }

  vault.add(makeBox(0.14, 4.36, 0.13, materials.iron, 0, 2.38, 0.36));
  const chainDepth = 0.47;
  vault.add(createVaultChain(
    [
      new THREE.Vector3(-1.62, 3.72, chainDepth),
      new THREE.Vector3(-0.82, 3.08, chainDepth + 0.03),
      new THREE.Vector3(0, 2.38, chainDepth + 0.05),
      new THREE.Vector3(0.82, 1.63, chainDepth + 0.03),
      new THREE.Vector3(1.62, 0.98, chainDepth),
    ],
    materials.iron,
    "Restricted archive descending cross-chain",
  ));
  vault.add(createVaultChain(
    [
      new THREE.Vector3(1.62, 3.72, chainDepth),
      new THREE.Vector3(0.82, 3.08, chainDepth + 0.03),
      new THREE.Vector3(0, 2.38, chainDepth + 0.05),
      new THREE.Vector3(-0.82, 1.63, chainDepth + 0.03),
      new THREE.Vector3(-1.62, 0.98, chainDepth),
    ],
    materials.iron,
    "Restricted archive ascending cross-chain",
  ));

  for (const [x, y] of [[-1.62, 3.72], [1.62, 3.72], [-1.62, 0.98], [1.62, 0.98]] as const) {
    const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 9, 24), materials.brass);
    anchor.name = "Restricted archive chain anchor";
    anchor.position.set(x, y, chainDepth + 0.03);
    vault.add(anchor);
  }

  const lockPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.13, 16),
    materials.iron,
  );
  lockPlate.name = "Restricted archive central lock plate";
  lockPlate.rotation.x = Math.PI / 2;
  lockPlate.position.set(0, 2.38, 0.56);
  vault.add(lockPlate);
  const lockRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 10, 32), materials.brass);
  lockRim.name = "Restricted archive central lock rim";
  lockRim.position.set(0, 2.38, 0.64);
  vault.add(lockRim);
  const keyhole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.06, 12),
    materials.brass,
  );
  keyhole.name = "Restricted archive keyhole";
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(0, 2.43, 0.66);
  vault.add(keyhole);
  vault.add(makeBox(0.075, 0.2, 0.06, materials.brass, 0, 2.29, 0.66));

  vault.position.set(0, 0.12, -5.72);
  return vault;
}

function addRestrictedRoomDetails(group: THREE.Group, materials: LibraryMaterials) {
  for (const side of [-1, 1] as const) {
    [-4.55, -1.95, 0.65, 3.25].forEach((z, index) => {
      group.add(createArchiveBay(materials, side, z, index));
    });
  }

  const lectern = createRestrictedLectern(materials);
  lectern.position.set(0, 0.06, -1.4);
  lectern.scale.setScalar(1.18);
  lectern.name = "Restricted archive central lectern";
  markCameraCollider(lectern, {
    id: "restricted-lectern",
    shape: "box",
    center: { x: 0, y: 0.84, z: 0 },
    size: { x: 1.2, y: 1.68, z: 0.82 },
  });
  group.add(lectern);

  const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 10.6), materials.rug);
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.025, -0.55);
  runner.receiveShadow = true;
  group.add(runner);

  group.add(createRestrictedVault(materials));

  const restrictedLight = new THREE.PointLight(tokens.color.primitive.red600, 42, 9, 2.1);
  restrictedLight.name = "Restricted archive warning glow";
  restrictedLight.position.set(-2.4, 2.8, -4.2);
  group.add(restrictedLight);
  const aisleLight = new THREE.PointLight(tokens.color.primitive.amber600, 72, 10, 2);
  aisleLight.position.set(0, 3.2, 1.8);
  group.add(aisleLight);
  group.userData.animatedLight = restrictedLight;
}

function createDirectorDesk(materials: LibraryMaterials) {
  const desk = new THREE.Group();
  desk.name = "Director office writing desk";
  markCameraCollider(desk, {
    id: "director-desk",
    shape: "box",
    center: { x: 0, y: 0.82, z: 0 },
    size: { x: 4.45, y: 1.64, z: 1.82 },
  });
  desk.add(makeBox(4.45, 0.18, 1.82, materials.woodDark, 0, 1.38, 0));
  desk.add(makeBox(4.18, 0.06, 1.58, materials.leather, 0, 1.5, 0, false));
  desk.add(makeBox(3.8, 0.88, 0.18, materials.woodWarm, 0, 0.86, -0.72));
  for (const x of [-1.82, 1.82]) {
    desk.add(makeBox(0.62, 1.28, 1.48, materials.woodWarm, x, 0.68, 0));
    for (const y of [0.38, 0.74, 1.1]) {
      desk.add(makeBox(0.48, 0.24, 0.04, materials.woodDark, x, y, 0.76));
      const pull = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 7, 16, Math.PI), materials.brass);
      pull.rotation.x = Math.PI / 2;
      pull.position.set(x, y, 0.79);
      desk.add(pull);
    }
  }
  for (const x of [-1.96, 1.96]) {
    for (const z of [-0.72, 0.72]) {
      desk.add(makeBox(0.12, 1.3, 0.12, materials.woodDark, x, 0.65, z));
    }
  }
  const blotter = makeBox(1.72, 0.035, 0.88, materials.leather, 0, 1.52, 0.08, false);
  desk.add(blotter);
  const inkwell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.14, 12), materials.iron);
  inkwell.position.set(0.95, 1.6, 0.18);
  desk.add(inkwell);
  const stackHeights = [0.1, 0.11, 0.09];
  stackHeights.forEach((bookHeight, index) => {
    const volume = makeBox(
      0.72 - index * 0.05,
      bookHeight,
      0.48 + index * 0.04,
      index % 2 === 0 ? materials.leather : materials.woodWarm,
      -1.06,
      1.56 + stackHeights.slice(0, index).reduce((sum, height) => sum + height, 0) + bookHeight / 2,
      0.14,
    );
    volume.rotation.y = (index - 1) * 0.035;
    desk.add(volume);
  });
  const letter = makeBox(0.78, 0.018, 0.54, materials.parchment, 0.1, 1.55, 0.08, false);
  letter.rotation.y = -0.08;
  desk.add(letter);
  return desk;
}

function createDirectorChair(materials: LibraryMaterials) {
  const chair = new THREE.Group();
  chair.name = "Director office high-backed chair";
  markCameraCollider(chair, {
    id: "director-chair",
    shape: "box",
    center: { x: 0, y: 1.5, z: -0.08 },
    size: { x: 1.16, y: 3, z: 1.08 },
  });
  chair.add(makeBox(1.08, 0.16, 1.02, materials.woodWarm, 0, 0.76, 0));
  chair.add(makeBox(0.9, 0.08, 0.84, materials.leather, 0, 0.88, 0, false));
  chair.add(makeBox(1.12, 2.12, 0.16, materials.woodDark, 0, 1.78, -0.38));
  chair.add(makeBox(0.84, 1.62, 0.08, materials.leather, 0, 1.72, -0.27, false));
  for (const x of [-0.46, 0.46]) {
    chair.add(makeBox(0.1, 0.8, 0.1, materials.woodDark, x, 0.4, 0));
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 9), materials.brass);
    finial.position.set(x, 2.9, -0.38);
    chair.add(finial);
  }
  return chair;
}

function createGlobe(materials: LibraryMaterials, loader: THREE.TextureLoader) {
  const globe = new THREE.Group();
  globe.name = "Director office detailed terrestrial globe";
  markCameraCollider(globe, {
    id: "director-globe",
    shape: "cylinder",
    center: { x: 0, y: 1.28, z: 0 },
    radius: 0.86,
    height: 2.56,
  });

  const earthTexture = loader.load(DIRECTOR_OFFICE_GLOBE_TEXTURE_ASSET);
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  earthTexture.anisotropy = 8;
  earthTexture.wrapS = THREE.RepeatWrapping;

  const earthMaterial = new THREE.MeshStandardMaterial({
    map: earthTexture,
    bumpMap: earthTexture,
    bumpScale: 0.018,
    roughness: 0.72,
    metalness: 0.02,
  });
  const sphereAssembly = new THREE.Group();
  sphereAssembly.name = "Tilted terrestrial globe assembly";
  sphereAssembly.position.y = 2.05;
  sphereAssembly.rotation.z = THREE.MathUtils.degToRad(-23.4);
  globe.add(sphereAssembly);

  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.68, 64, 40), earthMaterial);
  earth.name = "NASA Blue Marble globe surface";
  earth.rotation.y = -0.72;
  earth.castShadow = true;
  earth.receiveShadow = true;
  sphereAssembly.add(earth);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.695, 48, 30),
    new THREE.MeshPhysicalMaterial({
      color: tokens.color.primitive.teal500,
      transparent: true,
      opacity: 0.1,
      roughness: 0.22,
      metalness: 0,
      depthWrite: false,
    }),
  );
  atmosphere.name = "Subtle globe atmosphere shell";
  sphereAssembly.add(atmosphere);

  const gridMaterial = new THREE.MeshBasicMaterial({
    color: tokens.color.primitive.amber600,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    toneMapped: false,
  });
  for (const latitude of [-60, -30, 0, 30, 60]) {
    const latitudeRadians = THREE.MathUtils.degToRad(latitude);
    const latitudeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.687 * Math.cos(latitudeRadians), 0.0045, 6, 72),
      gridMaterial,
    );
    latitudeRing.name = `${latitude} degree latitude ring`;
    latitudeRing.position.y = 0.687 * Math.sin(latitudeRadians);
    latitudeRing.rotation.x = Math.PI / 2;
    sphereAssembly.add(latitudeRing);
  }
  for (let longitude = 0; longitude < 6; longitude += 1) {
    const longitudeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.688, 0.004, 6, 88),
      gridMaterial,
    );
    longitudeRing.name = `Longitude ring ${longitude + 1}`;
    longitudeRing.rotation.y = (longitude / 6) * Math.PI;
    sphereAssembly.add(longitudeRing);
  }

  const meridianRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.79, 0.03, 12, 96),
    materials.brass,
  );
  meridianRing.name = "Engraved globe meridian ring";
  sphereAssembly.add(meridianRing);
  const innerMeridian = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.009, 8, 96),
    materials.iron,
  );
  innerMeridian.name = "Inner globe meridian guide";
  sphereAssembly.add(innerMeridian);

  const axis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.78, 12),
    materials.brass,
  );
  axis.name = "Tilted globe axis";
  sphereAssembly.add(axis);
  for (const pole of [-0.9, 0.9]) {
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), materials.brass);
    finial.position.y = pole;
    sphereAssembly.add(finial);
  }

  const horizonRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.034, 12, 96),
    materials.woodWarm,
  );
  horizonRing.name = "Globe horizon ring";
  horizonRing.position.y = 2.05;
  horizonRing.rotation.x = Math.PI / 2;
  globe.add(horizonRing);
  const horizonTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.862, 0.012, 8, 96),
    materials.brass,
  );
  horizonTrim.position.y = 2.075;
  horizonTrim.rotation.x = Math.PI / 2;
  globe.add(horizonTrim);
  const tickGeometry = new THREE.BoxGeometry(0.018, 0.024, 0.1);
  for (let tickIndex = 0; tickIndex < 24; tickIndex += 1) {
    const angle = (tickIndex / 24) * Math.PI * 2;
    const tick = new THREE.Mesh(tickGeometry, materials.brass);
    tick.name = `Globe horizon tick ${tickIndex + 1}`;
    tick.position.set(Math.cos(angle) * 0.86, 2.09, Math.sin(angle) * 0.86);
    tick.rotation.y = -angle;
    globe.add(tick);
  }

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.78, 0.16, 32), materials.woodDark);
  base.name = "Globe stepped lower base";
  base.position.y = 0.08;
  globe.add(base);
  const upperBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 0.16, 32), materials.woodWarm);
  upperBase.name = "Globe stepped upper base";
  upperBase.position.y = 0.22;
  globe.add(upperBase);
  const baseCollar = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.025, 9, 48), materials.brass);
  baseCollar.position.y = 0.31;
  baseCollar.rotation.x = Math.PI / 2;
  globe.add(baseCollar);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.02, 20), materials.woodDark);
  pedestal.name = "Globe carved pedestal";
  pedestal.position.y = 0.78;
  globe.add(pedestal);
  const cradle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.2, 20), materials.brass);
  cradle.name = "Globe brass cradle";
  cradle.position.y = 1.34;
  globe.add(cradle);

  for (const side of [-1, 1] as const) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.18, 1.3, 0),
      new THREE.Vector3(side * 0.48, 1.42, 0),
      new THREE.Vector3(side * 0.75, 1.7, 0),
      new THREE.Vector3(side * 0.86, 2.04, 0),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 28, 0.035, 9, false), materials.brass);
    arm.name = `${side < 0 ? "Left" : "Right"} globe cradle arm`;
    globe.add(arm);
  }

  globe.userData.rotatingSurface = earth;
  return globe;
}

const DIRECTOR_BOOKCASE_SHELF_YS = [0.34, 1.18, 2.02, 2.86, 3.7] as const;

export interface DirectorOfficeBackgroundBookPlacement {
  shelfIndex: number;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotationZ: number;
  materialIndex: 0 | 1 | 2 | 3;
  hasBands: boolean;
}

function deterministicUnit(seed: number) {
  let value = Math.imul(seed ^ (seed >>> 16), 2246822507);
  value = Math.imul(value ^ (value >>> 13), 3266489909);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function getDirectorOfficeBackgroundBookPlacements(
  side: -1 | 1,
  bookcaseIndex: number,
) {
  const placements: DirectorOfficeBackgroundBookPlacement[] = [];
  const width = DIRECTOR_OFFICE_ROOM_LAYOUT.bookcaseWidth;
  const rowStart = -width / 2 + 0.14;
  const rowEnd = width / 2 - 0.14;
  const sideSeed = side < 0 ? 1301 : 2903;

  DIRECTOR_BOOKCASE_SHELF_YS.forEach((shelfY, shelfIndex) => {
    let cursor = rowStart;
    let bookIndex = 0;
    while (cursor < rowEnd - 0.05) {
      const seed = sideSeed + bookcaseIndex * 211 + shelfIndex * 47 + bookIndex * 17;
      const remaining = rowEnd - cursor;
      const naturalWidth = 0.072 + deterministicUnit(seed) * 0.042;
      const bookWidth = remaining < 0.13 ? remaining : Math.min(naturalWidth, remaining);
      const bookHeight = 0.55 + deterministicUnit(seed + 3) * 0.1;
      const bookDepth = 0.46 + deterministicUnit(seed + 7) * 0.09;
      const materialSlot = Math.floor(deterministicUnit(seed + 11) * 10);
      const materialIndex = (materialSlot === 9 ? 3 : materialSlot % 3) as 0 | 1 | 2 | 3;
      placements.push({
        shelfIndex,
        x: cursor + bookWidth / 2,
        y: shelfY + 0.075 + bookHeight / 2,
        z: 0.045 + deterministicUnit(seed + 13) * 0.035,
        width: bookWidth,
        height: bookHeight,
        depth: bookDepth,
        rotationZ: (deterministicUnit(seed + 19) - 0.5) * 0.012,
        materialIndex,
        hasBands: (bookIndex + shelfIndex + bookcaseIndex) % 4 === 0,
      });
      const gap = 0.006 + deterministicUnit(seed + 23) * 0.006;
      cursor += bookWidth + (remaining <= bookWidth ? 0 : gap);
      bookIndex += 1;
    }
    const lastBook = placements.at(-1);
    if (lastBook?.shelfIndex === shelfIndex) {
      const remainingEdge = rowEnd - (lastBook.x + lastBook.width / 2);
      if (remainingEdge > 0) {
        lastBook.x += remainingEdge / 2;
        lastBook.width += remainingEdge;
      }
    }
  });

  return placements;
}

function createDirectorOfficeBackgroundBooks(
  materials: LibraryMaterials,
  side: -1 | 1,
  bookcaseIndex: number,
) {
  const group = new THREE.Group();
  group.name = `${side < 0 ? "Left" : "Right"} director office filled book rows ${bookcaseIndex + 1}`;
  const placements = getDirectorOfficeBackgroundBookPlacements(side, bookcaseIndex);
  const bookMaterials = [
    materials.leather,
    materials.woodWarm,
    materials.woodDark,
    new THREE.MeshStandardMaterial({ color: PALETTE.green, roughness: 0.82 }),
  ] as const;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const transform = new THREE.Object3D();

  bookMaterials.forEach((material, materialIndex) => {
    const instances = placements.filter((placement) => placement.materialIndex === materialIndex);
    if (instances.length === 0) return;
    const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
    mesh.name = `Director office background book spines material ${materialIndex + 1}`;
    mesh.userData.backgroundVolumes = true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    instances.forEach((placement, instanceIndex) => {
      transform.position.set(placement.x, placement.y, placement.z);
      transform.rotation.set(0, 0, placement.rotationZ);
      transform.scale.set(placement.width, placement.height, placement.depth);
      transform.updateMatrix();
      mesh.setMatrixAt(instanceIndex, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  });

  const bandedPlacements = placements.filter((placement) => placement.hasBands);
  const bandMesh = new THREE.InstancedMesh(geometry, materials.brass, bandedPlacements.length * 2);
  bandMesh.name = "Director office background book spine bands";
  bandMesh.userData.backgroundVolumes = true;
  bandMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const bandOffset = new THREE.Vector3();
  const bandCenter = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  bandedPlacements.forEach((placement, placementIndex) => {
    euler.set(0, 0, placement.rotationZ);
    rotation.setFromEuler(euler);
    for (const [bandIndex, direction] of [-1, 1].entries()) {
      bandOffset.set(0, direction * placement.height * 0.25, 0).applyQuaternion(rotation);
      bandCenter.set(placement.x, placement.y, placement.z).add(bandOffset);
      transform.position.copy(bandCenter);
      transform.quaternion.copy(rotation);
      transform.scale.set(placement.width + 0.008, 0.018, placement.depth + 0.012);
      transform.updateMatrix();
      bandMesh.setMatrixAt(placementIndex * 2 + bandIndex, transform.matrix);
    }
  });
  bandMesh.instanceMatrix.needsUpdate = true;
  bandMesh.castShadow = false;
  bandMesh.receiveShadow = true;
  bandMesh.computeBoundingSphere();
  group.add(bandMesh);
  group.userData.backgroundBookCount = placements.length;
  group.userData.interactive = false;
  return group;
}

function createDirectorBookcase(
  materials: LibraryMaterials,
  side: -1 | 1,
  z: number,
  index: number,
) {
  const bookcase = new THREE.Group();
  bookcase.name = `${side < 0 ? "Left" : "Right"} director office bookcase ${index + 1}`;
  bookcase.userData.storageType = "bookcase";
  const width = DIRECTOR_OFFICE_ROOM_LAYOUT.bookcaseWidth;
  const height = 4.78;
  const depth = 0.76;
  const frontZ = depth / 2 + 0.04;
  markCameraCollider(bookcase, {
    id: `director-bookcase-${side < 0 ? "left" : "right"}-${index + 1}`,
    shape: "box",
    center: { x: 0, y: height / 2, z: 0 },
    size: { x: width + 0.28, y: height, z: depth + 0.2 },
  });

  const plinth = makeBox(width + 0.22, 0.24, depth + 0.18, materials.woodDark, 0, 0.12, 0);
  plinth.name = "Director bookcase lower plinth";
  bookcase.add(plinth);
  const cornice = makeBox(
    width + 0.28,
    0.22,
    depth + 0.2,
    materials.woodDark,
    0,
    height - 0.11,
    0,
  );
  cornice.name = "Director bookcase upper cornice";
  bookcase.add(cornice);
  const back = makeBox(
    width - 0.18,
    height - 0.42,
    0.12,
    materials.woodDark,
    0,
    height / 2,
    -depth / 2 + 0.04,
  );
  back.name = "Director bookcase recessed back";
  bookcase.add(back);

  for (const x of [-width / 2, width / 2]) {
    const upright = makeBox(
      0.18,
      height - 0.28,
      depth + 0.08,
      materials.woodWarm,
      x,
      height / 2,
      0,
    );
    upright.name = x < 0 ? "Left director bookcase upright" : "Right director bookcase upright";
    bookcase.add(upright);
    const frontStile = makeBox(
      0.08,
      height - 0.54,
      0.08,
      materials.brass,
      x,
      height / 2,
      frontZ,
      false,
    );
    bookcase.add(frontStile);
  }

  [0.34, 1.18, 2.02, 2.86, 3.7, 4.5].forEach((y, shelfIndex) => {
    const shelf = makeBox(width - 0.12, 0.13, depth + 0.02, materials.woodWarm, 0, y, 0);
    shelf.name = `Director bookcase shelf ${shelfIndex + 1}`;
    bookcase.add(shelf);
    const shelfTrim = makeBox(
      width - 0.18,
      0.035,
      0.045,
      materials.brass,
      0,
      y + 0.075,
      frontZ,
      false,
    );
    shelfTrim.name = `Director bookcase brass shelf edge ${shelfIndex + 1}`;
    bookcase.add(shelfTrim);
  });

  bookcase.add(createDirectorOfficeBackgroundBooks(materials, side, index));

  bookcase.position.set(side * 5.38, 0, z);
  bookcase.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  return bookcase;
}

function addDirectorRoomDetails(group: THREE.Group, materials: LibraryMaterials, loader: THREE.TextureLoader) {
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(7.8, 9.6),
    new THREE.MeshStandardMaterial({
      map: loader.load("/assets/virtual-library/persian-rug.png"),
      roughness: 0.9,
      metalness: 0,
    }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.02, -0.35);
  rug.receiveShadow = true;
  group.add(rug);

  const desk = createDirectorDesk(materials);
  desk.position.set(
    DIRECTOR_OFFICE_FURNITURE_LAYOUT.desk.x,
    0,
    DIRECTOR_OFFICE_FURNITURE_LAYOUT.desk.z,
  );
  desk.rotation.y = DIRECTOR_OFFICE_FURNITURE_LAYOUT.desk.rotationY;
  group.add(desk);
  const chair = createDirectorChair(materials);
  chair.position.set(
    DIRECTOR_OFFICE_FURNITURE_LAYOUT.chair.x,
    0,
    DIRECTOR_OFFICE_FURNITURE_LAYOUT.chair.z,
  );
  chair.rotation.y = DIRECTOR_OFFICE_FURNITURE_LAYOUT.chair.rotationY;
  group.add(chair);

  const globe = createGlobe(materials, loader);
  globe.position.set(3.95, 0, -3.85);
  group.add(globe);
  group.userData.rotatingGlobeSurface = globe.userData.rotatingSurface;

  for (const side of [-1, 1] as const) {
    getDirectorOfficeBookcaseZs(side).forEach((z, index) => {
      group.add(createDirectorBookcase(materials, side, z, index));
    });
  }

  const paintingTexture = loader.load(DIRECTOR_OFFICE_ARTWORK_ASSET);
  paintingTexture.colorSpace = THREE.SRGBColorSpace;
  paintingTexture.anisotropy = 8;
  const painting = new THREE.Mesh(
    new THREE.PlaneGeometry(
      DIRECTOR_OFFICE_ARTWORK_LAYOUT.width,
      DIRECTOR_OFFICE_ARTWORK_LAYOUT.height,
    ),
    new THREE.MeshStandardMaterial({ map: paintingTexture, roughness: 0.78 }),
  );
  const artworkX = DIRECTOR_OFFICE_ARTWORK_LAYOUT.x;
  const artworkY = DIRECTOR_OFFICE_ARTWORK_LAYOUT.y;
  painting.position.set(artworkX, artworkY, -5.995);
  painting.name = "Director office original moonlit study painting";
  painting.userData.asset = DIRECTOR_OFFICE_ARTWORK_ASSET;
  painting.userData.artwork = "Original Moonlit Scholar's Still Life, 2026";
  group.add(makeBox(2.18, 3.05, 0.12, materials.woodDark, artworkX, artworkY, -6.08));
  group.add(painting);
  for (const y of [artworkY - 1.42, artworkY + 1.42]) {
    group.add(makeBox(2.08, 0.12, 0.16, materials.brass, artworkX, y, -5.94));
  }
  for (const x of [artworkX - 1, artworkX + 1]) {
    group.add(makeBox(0.12, 2.96, 0.16, materials.brass, x, artworkY, -5.94));
  }

  const { moonWindow } = DIRECTOR_OFFICE_ROOM_LAYOUT;
  const window = createDirectorOfficeStainedGlassWindow(
    materials,
    moonWindow.width,
    moonWindow.height,
  );
  window.rotation.y = moonWindow.interiorFacingRotationY;
  window.position.set(
    moonWindow.side * 5.64,
    moonWindow.bottomY,
    moonWindow.z,
  );
  window.name = "Director office moonlit library stained-glass window";
  group.add(window);
  const windowSill = makeBox(
    0.5,
    0.18,
    moonWindow.width + 0.4,
    materials.stone,
    moonWindow.side * 5.56,
    moonWindow.bottomY - 0.05,
    moonWindow.z,
  );
  windowSill.name = "Director office moonlit window sill";
  group.add(windowSill);

  const deskLight = new THREE.PointLight(tokens.color.primitive.amber600, 68, 9, 2);
  deskLight.name = "Director office desk glow";
  deskLight.position.set(0, 3.15, 0.2);
  group.add(deskLight);
  const moonLightTarget = new THREE.Object3D();
  moonLightTarget.position.set(-1.1, 1.55, -0.8);
  const moonLight = new THREE.SpotLight(
    tokens.color.primitive.teal500,
    26,
    10,
    Math.PI / 4.5,
    0.86,
    2,
  );
  moonLight.name = "Director office soft window moonlight";
  moonLight.position.set(-5.18, 3.72, moonWindow.z);
  moonLight.target = moonLightTarget;
  group.add(moonLight, moonLightTarget);
  group.userData.animatedLight = deskLight;
}

export function createVirtualLibraryRooms(
  scene: THREE.Scene,
  loader: THREE.TextureLoader,
  materials: LibraryMaterials = createLibraryMaterials(),
): VirtualLibraryRooms {
  const restricted = new THREE.Group();
  restricted.name = "Original Gothic restricted archive room";
  restricted.visible = false;
  createRoomShell(restricted, materials, "禁书档案室", "RESTRICTED ARCHIVE", {
    showRearArch: RESTRICTED_ARCHIVE_ROOM_LAYOUT.showRearArch,
    showPlaque: RESTRICTED_ARCHIVE_ROOM_LAYOUT.showPlaque,
  });
  addRestrictedRoomDetails(restricted, materials);
  addScholasticRoomCeiling(restricted, materials);
  scene.add(restricted);

  const director = new THREE.Group();
  director.name = "Original Gothic director office room";
  director.visible = false;
  createRoomShell(director, materials, "馆长办公室", "DIRECTOR'S OFFICE", {
    showRearArch: false,
    showPlaque: DIRECTOR_OFFICE_ROOM_LAYOUT.showPlaque,
    chandelierY: 4.72,
    chandelierZ: -0.35,
    chandelierScale: 0.68,
  });
  addDirectorRoomDetails(director, materials, loader);
  addScholasticRoomCeiling(director, materials);
  scene.add(director);

  return {
    restricted,
    director,
    animate(elapsed) {
      const restrictedLight = restricted.userData.animatedLight as THREE.PointLight | undefined;
      if (restrictedLight) restrictedLight.intensity = 28 + Math.sin(elapsed * 1.45) * 2.4;
      const directorLight = director.userData.animatedLight as THREE.PointLight | undefined;
      if (directorLight) directorLight.intensity = 28 + Math.sin(elapsed * 0.72) * 1.2;
      const rotatingGlobeSurface = director.userData.rotatingGlobeSurface as THREE.Mesh | undefined;
      if (rotatingGlobeSurface) rotatingGlobeSurface.rotation.y = -0.72 + elapsed * 0.035;
    },
  };
}
