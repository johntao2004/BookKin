import * as THREE from "three";
import type { Book } from "../domain/types";
import { classifyCatalogBook, sortCatalogBooksByClassification } from "./virtual-library-catalog";
import {
  CAMERA_COLLISION_CLEARANCE,
  collectCameraColliders,
  createHallColumnColliders,
  getHallColumnSectionIndices,
  markCameraCollider,
  resolveCameraCollision,
} from "./virtual-library-collision";
import { VIRTUAL_LIBRARY_LAYOUT } from "./virtual-library-layout";
import {
  calculateGalleryRailLayout,
  calculateSpiralStairGalleryConnection,
  getShelfFrontPlacement,
  SHELF_FRONT_RAIL,
  SPIRAL_STAIR_GALLERY_CONNECTION,
  shouldPlaceLowerBookcase,
  shouldPlaceUpperBookcase,
} from "./virtual-library-model/scene/buildLibrary";
import {
  createHorseshoeReception,
  createDirectorOfficePortal,
  DIRECTOR_OFFICE_DOOR_LAYOUT,
  createPointedPortalLeafGeometry,
  createReceptionArcPrismGeometry,
} from "./virtual-library-model/scene/focalFeatures";
import type { LibraryMaterials } from "./virtual-library-model/scene/materials";
import {
  createRestrictedPortalGate,
  RESTRICTED_PORTAL_GATE_LAYOUT,
} from "./virtual-library-model/scene/parts";
import {
  BOOK_INSPECTION_LAYOUT,
  assignBooksToRotundaBays,
  assignBooksToShelfSlots,
  findPortalRoom,
  findShelfSectionId,
  getBookInspectionTransform,
  getCenteredShelfBookOffsets,
  getShelfPlaquePlacement,
  getShelfPlaqueRows,
  getShelvedBookTransform,
  placeSceneBookOnShelf,
  SHELF_PLAQUE_MOUNT,
} from "./virtual-library-scene";
import {
  createRoomShellCameraDescriptors,
  createDirectorOfficeStainedGlassWindow,
  DIRECTOR_OFFICE_ARTWORK_ASSET,
  DIRECTOR_OFFICE_ARTWORK_LAYOUT,
  DIRECTOR_OFFICE_FURNITURE_LAYOUT,
  DIRECTOR_OFFICE_GLOBE_TEXTURE_ASSET,
  DIRECTOR_OFFICE_ROOM_LAYOUT,
  getDirectorOfficeBackgroundBookPlacements,
  getDirectorOfficeBookcaseZs,
  LIBRARY_ROOM_CAMERA_VIEW,
  LIBRARY_ROOM_SHELL_LAYOUT,
  RESTRICTED_ARCHIVE_ROOM_LAYOUT,
} from "./virtual-library-rooms";

function withMockCanvas<T>(run: () => T) {
  const gradient = { addColorStop: () => undefined };
  const context = new Proxy<Record<string, unknown>>({}, {
    get: (_target, property) => {
      if (property === "createLinearGradient" || property === "createRadialGradient") {
        return () => gradient;
      }
      return () => undefined;
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(() => context);
  try {
    return run();
  } finally {
    contextSpy.mockRestore();
  }
}

describe("virtual library shelf layout", () => {
  it("centers the reception desk on the circular floor inlay", () => {
    expect(VIRTUAL_LIBRARY_LAYOUT.reception.centerZ).toBe(0);
  });

  it("supports decorative reception stacks on one continuous physical tabletop", () => {
    const { countertop } = VIRTUAL_LIBRARY_LAYOUT.reception;

    expect(countertop.bookStackAngle).toBeGreaterThan(0);
    expect(countertop.bookStackAngle).toBeLessThan(countertop.inspectionAngle);
    expect(countertop.lampAngle).toBeGreaterThan(0);
    expect(countertop.lampAngle).toBeLessThan(countertop.bookStackAngle);
  });

  it("keeps catalog book geometry inside its native shelf slot", () => {
    const slot = {
      position: new THREE.Vector3(4.2, 1.7, -12.8),
      scale: new THREE.Vector3(0.08, 0.61, 0.28),
      rotationY: Math.PI / 3,
      lean: 0,
      spineFace: -1 as const,
    };
    const modelSize = { width: 0.92, height: 1.24, depth: 0.3 };
    const transform = getShelvedBookTransform(slot, modelSize);
    const group = new THREE.Group();

    group.position.set(0, 0, 0);
    group.rotation.set(1, 1, 1);
    group.scale.setScalar(3);
    placeSceneBookOnShelf({
      group,
      shelfPosition: transform.position,
      shelfRotation: transform.rotation,
      shelfScale: transform.scale,
    });

    expect(group.position.toArray()).toEqual(slot.position.toArray());
    expect(modelSize.width * group.scale.x).toBeCloseTo(slot.scale.z * 0.96);
    expect(modelSize.height * group.scale.y).toBeCloseTo(slot.scale.y);
    expect(modelSize.depth * group.scale.z).toBeCloseTo(slot.scale.x * 0.94);

    const actualSpineNormal = new THREE.Vector3(-1, 0, 0).applyEuler(group.rotation);
    const expectedSpineNormal = new THREE.Vector3(0, 0, slot.spineFace)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotationY);
    expect(actualSpineNormal.distanceTo(expectedSpineNormal)).toBeLessThan(0.00001);
  });

  it("pulls the original book toward the current shelf camera with its cover facing forward", () => {
    const modelSize = { width: 0.92, height: 1.24, depth: 0.3 };
    const cameraTarget = new THREE.Vector3(0, 3.4, -12);
    const cameraPosition = new THREE.Vector3(0, 3.4, -5.8);
    const transform = getBookInspectionTransform(
      modelSize,
      cameraPosition,
      cameraTarget,
      877,
      0,
      0,
      1,
    );
    const cameraDirection = cameraPosition.clone().sub(transform.position).normalize();
    const coverNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(transform.quaternion);
    const shelfToInspection = transform.position.clone().sub(cameraTarget);
    const shelfCameraDirection = cameraPosition.clone().sub(cameraTarget).normalize();
    const cameraRight = new THREE.Vector3(0, 1, 0).cross(shelfCameraDirection).normalize();

    expect(shelfToInspection.dot(shelfCameraDirection)).toBeCloseTo(
      BOOK_INSPECTION_LAYOUT.forwardOffset,
    );
    expect(shelfToInspection.dot(cameraRight)).toBeCloseTo(-BOOK_INSPECTION_LAYOUT.desktopSideOffset);
    expect(coverNormal.distanceTo(cameraDirection)).toBeLessThan(0.00001);
    expect(transform.scale.x).toBeCloseTo(BOOK_INSPECTION_LAYOUT.desktopHeight / modelSize.height);
    expect(transform.scale.x).toBe(transform.scale.y);
    expect(transform.scale.y).toBe(transform.scale.z);
  });

  it("keeps the mobile inspection book above the shelf selection row", () => {
    const modelSize = { width: 0.92, height: 1.24, depth: 0.3 };
    const cameraTarget = new THREE.Vector3(0, 3.4, -12);
    const cameraPosition = new THREE.Vector3(0, 3.4, -5.8);
    const transform = getBookInspectionTransform(
      modelSize,
      cameraPosition,
      cameraTarget,
      390,
      0,
      0,
      1,
    );

    expect(transform.position.x).toBeCloseTo(cameraTarget.x);
    expect(transform.position.y - cameraTarget.y).toBeCloseTo(BOOK_INSPECTION_LAYOUT.mobileVerticalOffset);
    expect(transform.position.z - cameraTarget.z).toBeCloseTo(BOOK_INSPECTION_LAYOUT.forwardOffset);
    expect(transform.scale.x).toBeCloseTo(BOOK_INSPECTION_LAYOUT.mobileHeight / modelSize.height);
    expect(
      transform.position.y - cameraTarget.y - BOOK_INSPECTION_LAYOUT.mobileHeight / 2,
    ).toBeGreaterThan(0.8);
  });

  it("builds the curved reception body as one continuous half-annulus with rounded ends", () => {
    const radius = VIRTUAL_LIBRARY_LAYOUT.reception.radius;
    const depth = 0.72;
    const height = 0.15;
    const segments = 32;
    const geometry = createReceptionArcPrismGeometry(radius, depth, height, segments);
    const positions = geometry.getAttribute("position");
    const outerRadius = radius + depth / 2;
    geometry.computeBoundingBox();

    expect(geometry.boundingBox?.min.x).toBeCloseTo(-outerRadius);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(outerRadius);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(-height / 2);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(height / 2);
    expect(geometry.boundingBox?.min.z).toBeCloseTo(-depth / 2);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(outerRadius);

    const hasRoundedRightEnd = Array.from({ length: positions.count }, (_, index) => index)
      .some((index) => (
        Math.abs(positions.getX(index) - radius) < 0.00001
        && Math.abs(positions.getZ(index) + depth / 2) < 0.00001
      ));
    const hasRoundedLeftEnd = Array.from({ length: positions.count }, (_, index) => index)
      .some((index) => (
        Math.abs(positions.getX(index) + radius) < 0.00001
        && Math.abs(positions.getZ(index) + depth / 2) < 0.00001
      ));
    expect(hasRoundedRightEnd).toBe(true);
    expect(hasRoundedLeftEnd).toBe(true);

    geometry.dispose();
  });

  it("keeps the reception rear as one clean curve without cabinet panels or a plaque", () => {
    const material = new THREE.MeshStandardMaterial();
    const reception = createHorseshoeReception({
      woodDark: material,
      woodWarm: material,
      brass: material,
      parchment: material,
      lampGlass: material,
    } as LibraryMaterials);

    expect(reception.getObjectByName("Continuous reception curved apron")).toBeDefined();
    expect(reception.getObjectByName("Reception information plaque")).toBeUndefined();
    expect(reception.children.filter((child) => (
      child instanceof THREE.Mesh && child.geometry.type === "BoxGeometry"
    ))).toHaveLength(0);

    reception.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    material.dispose();
  });

  it("keeps upper bookcases above the entrance and side doors while preserving windows", () => {
    const windowIndices = new Set([7, 8, 9]);

    expect(shouldPlaceUpperBookcase(0, -1, windowIndices)).toBe(true);
    expect(shouldPlaceUpperBookcase(4, -1, windowIndices)).toBe(true);
    expect(shouldPlaceUpperBookcase(6, -1, windowIndices)).toBe(true);
    expect(shouldPlaceUpperBookcase(8, -1, windowIndices)).toBe(false);
  });

  it("reserves mirrored lower-wall openings for the restricted archive and director office", () => {
    const sidePortalIndices = new Set([4, 12]);

    expect(shouldPlaceLowerBookcase(4, 8, sidePortalIndices)).toBe(false);
    expect(shouldPlaceLowerBookcase(12, 8, sidePortalIndices)).toBe(false);
    expect(shouldPlaceLowerBookcase(6, 8, sidePortalIndices)).toBe(true);
  });

  it("keeps the side-portal opening inside the matched pointed-arch frame", () => {
    const portal = VIRTUAL_LIBRARY_LAYOUT.sidePortals;
    const geometry = createPointedPortalLeafGeometry(
      portal.openingWidth,
      portal.openingHeight,
      0.24,
    );
    geometry.computeBoundingBox();

    expect(portal.openingWidth).toBeLessThan(portal.innerWidth);
    expect(portal.innerWidth).toBeLessThan(portal.outerWidth);
    expect(portal.openingHeight).toBeLessThan(portal.innerHeight);
    expect(portal.innerHeight).toBeLessThan(portal.outerHeight);
    expect(geometry.boundingBox?.min.x).toBeCloseTo(-portal.openingWidth / 2);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(portal.openingWidth / 2);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(0);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(portal.openingHeight);
    expect(geometry.boundingBox?.min.z).toBeCloseTo(-0.12);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(0.12);

    geometry.dispose();
  });

  it("builds the director office entrance as tall double doors beneath a moonlit transom", () => {
    const material = new THREE.MeshStandardMaterial();
    const portal = withMockCanvas(() => createDirectorOfficePortal({
      woodDark: material,
      woodWarm: material,
      brass: material,
      iron: material,
      stone: material,
      lampGlass: material,
    } as LibraryMaterials));
    const leftLeaf = portal.getObjectByName("Director office left door leaf") as THREE.Mesh;
    const rightLeaf = portal.getObjectByName("Director office right door leaf") as THREE.Mesh;
    const leftHandle = portal.getObjectByName("Director office left handle") as THREE.Mesh;
    const rightHandle = portal.getObjectByName("Director office right handle") as THREE.Mesh;
    const shoulderY = VIRTUAL_LIBRARY_LAYOUT.sidePortals.openingHeight
      * DIRECTOR_OFFICE_DOOR_LAYOUT.transomStartRatio;
    const leafHeight = (leftLeaf.geometry as THREE.BoxGeometry).parameters.height;
    const transom = portal.getObjectByName(
      "Director office moonlit library stained-glass transom",
    ) as THREE.Mesh;

    expect(leftLeaf.position.x).toBeCloseTo(-rightLeaf.position.x);
    expect(leftLeaf.position.y).toBeCloseTo(rightLeaf.position.y);
    expect(leftLeaf.position.y + leafHeight / 2).toBeCloseTo(
      shoulderY - DIRECTOR_OFFICE_DOOR_LAYOUT.leafTopClearance,
    );
    expect(leftHandle.position.x).toBeCloseTo(-rightHandle.position.x);
    expect(leftHandle.position.y).toBeCloseTo(rightHandle.position.y);
    expect(portal.getObjectByName("Director office double-door center seam")).toBeDefined();
    expect(portal.getObjectByName("Director office left upper panel")).toBeDefined();
    expect(portal.getObjectByName("Director office left lower panel")).toBeDefined();
    expect(portal.getObjectByName("Director office stained-glass transom dark backing")).toBeDefined();
    expect(portal.getObjectByName("Director office pointed tympanum backing")).toBeUndefined();
    expect(portal.getObjectByName("Director office tympanum center mullion")).toBeUndefined();
    expect(portal.getObjectByName("Director office pointed tympanum trim")).toBeUndefined();
    expect(transom.userData.motif).toBe("moonlit-library");
    expect((transom.material as THREE.MeshStandardMaterial).depthWrite).toBe(true);
    expect(portal.children.filter(
      (child) => child instanceof THREE.Mesh && child.geometry.type === "TubeGeometry",
    )).toHaveLength(0);
    expect(portal.children.filter((child) => child.name.includes("hinge strap"))).toHaveLength(6);
    expect(portal.children.filter((child) => child.name.includes("hinge pin"))).toHaveLength(6);

    portal.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    material.dispose();
  });

  it("builds the restricted entrance as a closed gothic double-leaf iron gate", () => {
    const material = new THREE.MeshStandardMaterial();
    const width = VIRTUAL_LIBRARY_LAYOUT.sidePortals.openingWidth - 0.18;
    const height = VIRTUAL_LIBRARY_LAYOUT.sidePortals.openingHeight - 0.14;
    const portal = createRestrictedPortalGate(width, height, {
      woodDark: material,
      woodWarm: material,
      brass: material,
      iron: material,
      stone: material,
    } as LibraryMaterials);
    const bars = portal.children.filter((child) => (
      child.name.includes("gate vertical bar")
      || child.name === "Restricted archive gate center meeting stile"
    ));

    expect(portal.name).toBe("Restricted archive gothic double-leaf iron gate");
    expect(portal.userData.view).toBe("restricted");
    expect(RESTRICTED_PORTAL_GATE_LAYOUT.barCount).toBe(7);
    expect(portal.getObjectByName("Restricted archive deep pointed shadow recess")).toBeDefined();
    expect(portal.getObjectByName("Restricted archive left portal door leaf")).toBeUndefined();
    expect(portal.getObjectByName("Restricted archive portal center seam")).toBeUndefined();
    expect(portal.getObjectByName("Restricted archive gate center seam")).toBeDefined();
    expect(portal.getObjectByName("Restricted archive centered gate slide bolt")).toBeDefined();
    expect(portal.getObjectByName("Restricted archive centered mechanical lock")).toBeDefined();
    expect(bars).toHaveLength(7);
    expect(portal.children.filter((child) => child.name.includes("horizontal rail"))).toHaveLength(6);
    expect(portal.children.filter((child) => child.name.includes("gate hinge"))).toHaveLength(6);
    expect(portal.children.filter(
      (child) => child instanceof THREE.Mesh && child.geometry.type === "ConeGeometry",
    )).toHaveLength(7);
    expect(portal.children.filter((child) => child.name.includes("portal rivet"))).toHaveLength(0);
    expect(portal.children.filter((child) => child.name.includes("vertical pull"))).toHaveLength(0);

    portal.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    material.dispose();
  });

  it("uses one physical frame and one lead-came system for the director office window", () => {
    const material = new THREE.MeshStandardMaterial();
    const window = withMockCanvas(() => createDirectorOfficeStainedGlassWindow(
      {
        woodDark: material,
        woodWarm: material,
        brass: material,
        iron: material,
        stone: material,
        lampGlass: material,
      } as LibraryMaterials,
      DIRECTOR_OFFICE_ROOM_LAYOUT.moonWindow.width,
      DIRECTOR_OFFICE_ROOM_LAYOUT.moonWindow.height,
    ));
    const pane = window.getObjectByName(
      "Director office moonlit library stained-glass pane",
    ) as THREE.Mesh;

    expect(window.userData.motif).toBe("moonlit-library");
    expect(window.getObjectByName("Director office single pointed stone window frame")).toBeDefined();
    expect(window.children.filter((child) => child.name.includes("vertical lead came"))).toHaveLength(2);
    expect(window.children.filter((child) => child.name.includes("horizontal lead came"))).toHaveLength(1);
    expect(window.children.filter((child) => child.name.includes("Y branch"))).toHaveLength(4);
    expect(window.children.filter(
      (child) => child instanceof THREE.Mesh && child.geometry.type === "TubeGeometry",
    )).toHaveLength(1);
    expect(window.children.filter(
      (child) => child instanceof THREE.Mesh && child.geometry.type === "CircleGeometry",
    )).toHaveLength(0);
    expect(window.children.filter(
      (child) => child instanceof THREE.Mesh && child.geometry.type === "TorusGeometry",
    )).toHaveLength(0);
    expect(pane.userData.motif).toBe("moonlit-library");
    expect((pane.material as THREE.MeshStandardMaterial).depthWrite).toBe(true);

    window.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    material.dispose();
  });

  it("uses dedicated artwork in the director office instead of repeating the hall painting", () => {
    expect(DIRECTOR_OFFICE_ARTWORK_ASSET).toContain("director-office");
    expect(DIRECTOR_OFFICE_ARTWORK_ASSET).not.toContain("death-of-socrates");
    expect(DIRECTOR_OFFICE_ARTWORK_LAYOUT.x).toBe(0);
  });

  it("uses a detailed Earth texture for the director office globe", () => {
    expect(DIRECTOR_OFFICE_GLOBE_TEXTURE_ASSET).toContain("earth-no-clouds-nasa-svs");
  });

  it("faces the director desk drawers toward the chair rather than visitors", () => {
    expect(DIRECTOR_OFFICE_FURNITURE_LAYOUT.desk.rotationY).toBeCloseTo(Math.PI);
    expect(DIRECTOR_OFFICE_FURNITURE_LAYOUT.chair.rotationY).toBe(0);
    expect(DIRECTOR_OFFICE_FURNITURE_LAYOUT.chair.z).toBeLessThan(
      DIRECTOR_OFFICE_FURNITURE_LAYOUT.desk.z,
    );
  });

  it("reserves a dedicated left-wall window bay between open office bookcases", () => {
    expect(DIRECTOR_OFFICE_ROOM_LAYOUT.sideBookcaseZs).toHaveLength(4);
    expect(getDirectorOfficeBookcaseZs(-1)).toEqual([-4.2, -1.3, 4.5]);
    expect(getDirectorOfficeBookcaseZs(1)).toEqual([-4.2, -1.3, 1.6, 4.5]);
    for (const bookcaseZ of getDirectorOfficeBookcaseZs(-1)) {
      expect(Math.abs(bookcaseZ - DIRECTOR_OFFICE_ROOM_LAYOUT.moonWindow.z)).toBeGreaterThan(
        (DIRECTOR_OFFICE_ROOM_LAYOUT.bookcaseWidth + DIRECTOR_OFFICE_ROOM_LAYOUT.moonWindow.width) / 2,
      );
    }
    expect(DIRECTOR_OFFICE_ROOM_LAYOUT.moonWindow.interiorFacingRotationY).toBeCloseTo(
      Math.PI / 2,
    );
    expect(DIRECTOR_OFFICE_ROOM_LAYOUT.showPlaque).toBe(false);
  });

  it("fills every visible director office bookcase shelf on both walls", () => {
    for (const side of [-1, 1] as const) {
      getDirectorOfficeBookcaseZs(side).forEach((_, bookcaseIndex) => {
        const placements = getDirectorOfficeBackgroundBookPlacements(side, bookcaseIndex);
        expect(new Set(placements.map((placement) => placement.shelfIndex))).toEqual(
          new Set([0, 1, 2, 3, 4]),
        );
        for (let shelfIndex = 0; shelfIndex < 5; shelfIndex += 1) {
          const shelfBooks = placements.filter((placement) => placement.shelfIndex === shelfIndex);
          expect(shelfBooks.length).toBeGreaterThanOrEqual(18);
          expect(Math.min(...shelfBooks.map((book) => book.x - book.width / 2))).toBeLessThanOrEqual(
            -DIRECTOR_OFFICE_ROOM_LAYOUT.bookcaseWidth / 2 + 0.15,
          );
          expect(Math.max(...shelfBooks.map((book) => book.x + book.width / 2))).toBeGreaterThanOrEqual(
            DIRECTOR_OFFICE_ROOM_LAYOUT.bookcaseWidth / 2 - 0.15,
          );
        }
      });
    }
  });

  it("uses a sealed rear vault instead of a pointed iron gate in the restricted archive", () => {
    expect(RESTRICTED_ARCHIVE_ROOM_LAYOUT.focalFeature).toBe("sealed-vault");
    expect(RESTRICTED_ARCHIVE_ROOM_LAYOUT.showRearArch).toBe(false);
    expect(RESTRICTED_ARCHIVE_ROOM_LAYOUT.showPlaque).toBe(false);
  });

  it("keeps every gallery rail component below the window sill", () => {
    const windowSillY = 8.1;
    const layout = calculateGalleryRailLayout(6.2, windowSillY);

    expect(layout.upperRailY).toBeLessThanOrEqual(windowSillY - 0.7);
    expect(layout.balusterCenterY + layout.balusterHeight / 2).toBeLessThanOrEqual(windowSillY - 0.7);
    expect(layout.lowerRailY).toBeLessThan(layout.upperRailY);
  });

  it("joins the spiral stair landing to both the final tread and gallery floor", () => {
    const layout = calculateSpiralStairGalleryConnection();
    const landingHalfWidth = SPIRAL_STAIR_GALLERY_CONNECTION.landingTangentialWidth / 2;
    const finalTreadInnerOffset = SPIRAL_STAIR_GALLERY_CONNECTION.stepCenterRadius
      - SPIRAL_STAIR_GALLERY_CONNECTION.stepRadialLength / 2;
    const finalTreadOuterOffset = SPIRAL_STAIR_GALLERY_CONNECTION.stepCenterRadius
      + SPIRAL_STAIR_GALLERY_CONNECTION.stepRadialLength / 2;
    const exitForwardAlignment = -Math.sin(layout.exitStepAngle) * Math.cos(layout.stairAxisAngle)
      + Math.cos(layout.exitStepAngle) * Math.sin(layout.stairAxisAngle);

    expect(exitForwardAlignment).toBeCloseTo(1);
    expect(layout.landingInnerRadius).toBeLessThan(layout.lastStepForwardRadius);
    expect(layout.landingOuterRadius).toBeGreaterThan(layout.galleryInnerRadius);
    expect(layout.landingTangentialCenterOffset - landingHalfWidth)
      .toBeLessThan(finalTreadInnerOffset);
    expect(layout.landingTangentialCenterOffset + landingHalfWidth)
      .toBeGreaterThan(finalTreadOuterOffset);
    expect(layout.openingWidth).toBeCloseTo(
      SPIRAL_STAIR_GALLERY_CONNECTION.landingTangentialWidth
        + SPIRAL_STAIR_GALLERY_CONNECTION.openingSideClearance * 2,
    );
    expect(layout.openingEndAngle - layout.openingStartAngle).toBeGreaterThan(0);
    expect(layout.openingEndAngle - layout.openingStartAngle).toBeLessThan(0.2);
  });

  it("mounts every classification plaque outside the shelf-front fascia", () => {
    const section = {
      id: 10,
      angle: Math.PI / 4,
      radius: 13.2,
      width: 4.2,
      height: 4.9,
      baseY: 0.16,
      depth: 0.72,
      shelfCount: 6,
    };

    for (const shelfIndex of [section.shelfCount, 4, 3, 2]) {
      const rail = getShelfFrontPlacement(section, shelfIndex);
      const plaque = getShelfPlaquePlacement(section, shelfIndex);

      expect(rail.frontSurfaceZ).toBeCloseTo(-section.depth / 2 - 0.07);
      expect(rail.centerY - rail.shelfY).toBeCloseTo(
        SHELF_FRONT_RAIL.fasciaCenterYOffset,
      );
      expect(plaque.centerY - plaque.shelfY).toBeCloseTo(
        SHELF_FRONT_RAIL.fasciaCenterYOffset,
      );
      expect(plaque.railFrontZ - plaque.backingRearZ).toBeGreaterThanOrEqual(
        SHELF_PLAQUE_MOUNT.gap,
      );
      expect(plaque.backingRearZ - plaque.backingFrontZ).toBeCloseTo(
        SHELF_PLAQUE_MOUNT.backingDepth,
      );
      expect(plaque.backingFrontZ - plaque.textureFaceZ).toBeCloseTo(
        SHELF_PLAQUE_MOUNT.textureFaceOffset,
      );
    }
  });

  it("keeps one primary and three secondary plaques on their intended shelf rows", () => {
    const rows = getShelfPlaqueRows({ shelfCount: 6 }, 3);

    expect(rows.primary).toBe(6);
    expect(rows.secondary).toEqual([4, 3, 2]);
    expect(1 + rows.secondary.length).toBe(4);
  });

  it("uses the approved fully-interior camera framing for both independent rooms", () => {
    expect(LIBRARY_ROOM_CAMERA_VIEW.targetZ).toBe(-0.5);
    expect(LIBRARY_ROOM_CAMERA_VIEW.desktop).toMatchObject({ radius: 5.3, fov: 72 });
    expect(LIBRARY_ROOM_CAMERA_VIEW.mobile).toMatchObject({ radius: 5.1, fov: 78 });
  });

  it("encloses each independent room with all six camera boundaries", () => {
    const descriptors = createRoomShellCameraDescriptors("director");
    const root = new THREE.Group();
    markCameraCollider(root, descriptors);
    const colliders = collectCameraColliders(root, "director");

    expect(colliders.map(({ id }) => id)).toEqual([
      "director-floor",
      "director-rear-wall",
      "director-left-wall",
      "director-right-wall",
      "director-ceiling",
      "director-front-boundary",
    ]);
    const front = colliders.find(({ id }) => id === "director-front-boundary");
    expect(front?.shape).toBe("box");
    if (!front || front.shape !== "box") throw new Error("Missing room front boundary");
    expect(front.z - front.halfZ).toBeCloseTo(
      LIBRARY_ROOM_SHELL_LAYOUT.centerZ + LIBRARY_ROOM_SHELL_LAYOUT.depth / 2,
    );
  });

  it("slides along a room boundary and recovers a camera embedded during room entry", () => {
    const root = new THREE.Group();
    markCameraCollider(root, createRoomShellCameraDescriptors("restricted"));
    const colliders = collectCameraColliders(root, "restricted");
    const insideLimit = LIBRARY_ROOM_SHELL_LAYOUT.frontBoundaryZ
      - LIBRARY_ROOM_SHELL_LAYOUT.wallThickness / 2
      - CAMERA_COLLISION_CLEARANCE;
    const slide = resolveCameraCollision(
      { x: 0, y: 2.5, z: 5 },
      { x: 3.4, y: 2.5, z: 7 },
      colliders,
    );
    const recovered = resolveCameraCollision(
      { x: 0, y: 2.5, z: 6.05 },
      { x: 0, y: 2.5, z: 6.05 },
      colliders,
    );

    expect(slide.blockedBy).toBe("restricted-front-boundary");
    expect(slide.z).toBeLessThanOrEqual(insideLimit + 0.00001);
    expect(slide.x).toBeGreaterThan(2.5);
    expect(recovered.blockedBy).toBe("restricted-front-boundary");
    expect(recovered.z).toBeLessThanOrEqual(insideLimit + 0.00001);
  });

  it("keeps the hall camera inside its radial wall at extreme zoom", () => {
    const maxRadius = 14.28;
    const result = resolveCameraCollision(
      { x: 0, y: 5.4, z: 13 },
      { x: 0, y: 5.4, z: 16 },
      [{
        id: "hall-shell-test",
        room: "hall",
        shape: "radial-boundary",
        x: 0,
        z: 0,
        maxRadius,
        minY: 0,
        maxY: 14,
      }],
    );

    expect(result.blockedBy).toBe("hall-shell-test");
    expect(Math.hypot(result.x, result.z)).toBeLessThanOrEqual(
      maxRadius - CAMERA_COLLISION_CLEARANCE + 0.00001,
    );
  });

  it("slides past solid room furniture without entering it", () => {
    const desk = {
      id: "director-desk-test",
      room: "director" as const,
      shape: "box" as const,
      x: 0,
      y: 1.1,
      z: -0.55,
      halfX: 1.6,
      halfY: 0.8,
      halfZ: 0.65,
      rotationY: Math.PI,
    };
    const result = resolveCameraCollision(
      { x: -3, y: 1.3, z: 0.8 },
      { x: 3, y: 1.3, z: 0.25 },
      [desk],
    );

    expect(result.blockedBy).toBe("director-desk-test");
    expect(result.x).toBeGreaterThan(1.5);
    expect(result.z).toBeGreaterThanOrEqual(
      desk.z + desk.halfZ + CAMERA_COLLISION_CLEARANCE - 0.00001,
    );
  });

  it("frames every major hall feature with a symmetric pair of structural columns", () => {
    expect(getHallColumnSectionIndices(16)).toEqual([0, 3, 4, 7, 8, 11, 12, 15]);
    const colliders = createHallColumnColliders();

    expect(colliders.filter(({ id }) => id.startsWith("gallery-column"))).toHaveLength(8);
    expect(colliders.filter(({ id }) => id.startsWith("wall-column"))).toHaveLength(8);
  });

  it("stops the camera before it can cross a column", () => {
    const column = {
      id: "test-column",
      room: "hall" as const,
      shape: "cylinder" as const,
      x: 0,
      z: 0,
      radius: 0.4,
      minY: 0,
      maxY: 6.2,
    };
    const result = resolveCameraCollision(
      { x: 0, y: 3, z: 2 },
      { x: 0, y: 3, z: -2 },
      [column],
    );

    expect(result.blocked).toBe(true);
    expect(result.blockedBy).toBe("test-column");
    expect(Math.hypot(result.x - column.x, result.z - column.z)).toBeGreaterThanOrEqual(
      column.radius + CAMERA_COLLISION_CLEARANCE - 0.00001,
    );
    expect(result.z).toBeGreaterThan(0);
  });

  it("does not apply a ground-floor column collision above the column", () => {
    const result = resolveCameraCollision(
      { x: 0, y: 7, z: 2 },
      { x: 0, y: 7, z: -2 },
      [{
        id: "short-column",
        room: "hall",
        shape: "cylinder",
        x: 0,
        z: 0,
        radius: 0.4,
        minY: 0,
        maxY: 6.2,
      }],
    );

    expect(result).toMatchObject({ x: 0, y: 7, z: -2, blocked: false, blockedBy: null });
  });

  it("keeps one model per book and groups adjacent classified books into the same shelf bays", () => {
    const books = Array.from({ length: 9 }, (_, index) => index);
    const assignments = assignBooksToRotundaBays(books);

    expect(assignments.flat().map(({ book }) => book).sort((left, right) => left - right)).toEqual(books);
    expect(assignments[0]?.map(({ book }) => book)).toEqual([0, 1, 2]);
    expect(assignments[3]?.map(({ book }) => book)).toEqual([3, 4, 5]);
    expect(assignments[9]?.map(({ book }) => book)).toEqual([6, 7, 8]);
    expect(assignments.filter((bay) => bay.length > 0)).toHaveLength(3);
  });

  it("does not create decorative filler books", () => {
    const books = ["only-book"];
    const slots = Array.from({ length: 8 }, (_, index) => ({
      position: new THREE.Vector3(index * 0.12, 0.94, -13.68),
      scale: new THREE.Vector3(0.1, 0.62, 0.28),
      rotationY: Math.PI,
      lean: 0,
      spineFace: -1 as const,
    }));
    const assignments = assignBooksToShelfSlots(books, slots);

    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({ book: "only-book", index: 0, bayIndex: 0 });
  });

  it("uses one centered contiguous slot run for books sharing a shelf row", () => {
    const radius = 13.7;
    const slots = [-0.62, -0.44, -0.08, 0.08, 0.44, 0.62].map((x) => ({
      position: new THREE.Vector3(x, 1.73, -radius),
      scale: new THREE.Vector3(0.12, 0.62, 0.28),
      rotationY: Math.PI,
      lean: 0,
      spineFace: -1 as const,
    }));
    const assignments = assignBooksToShelfSlots(["a", "b", "c", "d"], slots);
    const firstBay = assignments
      .filter(({ bayIndex }) => bayIndex === 0)
      .sort((left, right) => left.slot.position.x - right.slot.position.x);

    expect(firstBay).toHaveLength(2);
    expect(firstBay.map(({ slot }) => slot.position.x)).toEqual([-0.08, 0.08]);
    const centerGap = firstBay[1]!.slot.position.x - firstBay[0]!.slot.position.x
      - firstBay[0]!.slot.scale.x / 2
      - firstBay[1]!.slot.scale.x / 2;
    expect(centerGap).toBeCloseTo(0.04);
  });

  it("centers a compact run using each real book's rendered spine width", () => {
    const widths = [0.12, 0.18, 0.14];
    const offsets = getCenteredShelfBookOffsets(widths, 0.035);
    const leftEdge = offsets[0]! - widths[0]! / 2;
    const rightEdge = offsets[2]! + widths[2]! / 2;

    expect((leftEdge + rightEdge) / 2).toBeCloseTo(0);
    expect(offsets[1]! - widths[1]! / 2 - (offsets[0]! + widths[0]! / 2)).toBeCloseTo(0.035);
    expect(offsets[2]! - widths[2]! / 2 - (offsets[1]! + widths[1]! / 2)).toBeCloseTo(0.035);
  });

  it("keeps every catalog book assigned even while the architecture is still loading slots", () => {
    const books = ["first", "second", "third"];
    const assignments = assignBooksToShelfSlots(books, []);

    expect(assignments.map(({ book }) => book)).toEqual(books);
    expect(new Set(assignments.map(({ slot }) => slot.position.toArray().join(","))).size).toBe(3);
  });

  it("resolves a clickable shelf section from nested scene objects", () => {
    const shelf = new THREE.Group();
    const clickTarget = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const nestedTrim = new THREE.Object3D();
    shelf.userData.shelfSectionId = 7;
    clickTarget.add(nestedTrim);
    shelf.add(clickTarget);

    expect(findShelfSectionId(nestedTrim)).toBe(7);
    expect(findShelfSectionId(new THREE.Object3D())).toBeNull();
  });

  it("resolves a clickable portal room from nested door geometry", () => {
    const portal = new THREE.Group();
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    portal.userData.portalRoom = "restricted";
    portal.add(doorPanel);

    expect(findPortalRoom(doorPanel)).toBe("restricted");
    expect(findPortalRoom(new THREE.Object3D())).toBeNull();
  });

  it("classifies and groups catalog books by primary and secondary category", () => {
    const book = (overrides: Partial<Book>): Book => ({
      id: "book",
      title: "未分类藏书",
      author: "作者",
      description: "",
      format: "EPUB",
      coverUrl: "/cover.jpg",
      progress: 0,
      addedAt: "2026-08-24T00:00:00Z",
      libraryRoot: "主书库",
      relativePath: "未分类藏书.epub",
      fingerprint: "sha256:test",
      status: "AVAILABLE",
      tags: [],
      ...overrides,
    });
    const naturalBook = book({ id: "nature", title: "夏日植物学", description: "叶片与自然观察", format: "PDF" });
    const fictionBook = book({ id: "fiction", title: "雾港信使", description: "一部长篇幻想小说", tags: ["文学"] });
    const historyBook = book({ id: "history", title: "纸上群山", description: "从旧地图与家书拼出历史", tags: ["随笔"] });

    expect(classifyCatalogBook(naturalBook)).toMatchObject({
      category: { id: "nature" },
      subcategory: { id: "life" },
    });
    expect(sortCatalogBooksByClassification([naturalBook, historyBook, fictionBook]).map(({ book: item }) => item.id)).toEqual([
      "fiction",
      "history",
      "nature",
    ]);
  });
});
