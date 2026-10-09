import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Book } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import {
  defaultCategoryForShelf,
  sortCatalogBooksByClassification,
  longRoomCatalogSectionCounts,
  type CatalogClassification,
  type LibraryCategory,
} from "./virtual-library-catalog";
import {
  collectCameraColliders,
  type CameraCollider,
} from "./virtual-library-collision";
import { LIBRARY, PALETTE } from "./virtual-library-model/config";
import { createHistoricalBindingMaterial } from './virtual-library-model/scene/longRoomBindings';
import {
  getShelfFrontPlacement,
  type ExpandableShelfSection,
} from "./virtual-library-model/scene/buildLibrary";
import { optimizeStaticMeshes } from "./virtual-library-model/scene/optimizeScene";
import type { BookShelfSlot } from "./virtual-library-model/scene/parts";
import {
  createVirtualLibraryRooms,
  type LibraryRoomId,
} from "./virtual-library-rooms";

import {
  buildLongRoom,
  LONG_ROOM_BOOK_CENTER_OFFSET,
  LONG_ROOM_CATALOG_SECTION_CAPACITY,
  LONG_ROOM_SHELF_FRONT_OFFSET,
  type LongRoomBuilt,
} from "./virtual-library-model/scene/longRoom";
import { LONG_ROOM_PILASTER_SHAFT_DEPTH } from "./virtual-library-model/scene/longRoomPilaster";
import { LONG_ROOM } from "./virtual-library-model/longRoomLayout";

export const ROTUNDA_CENTER = new THREE.Vector3(0, LONG_ROOM.camera.targetY, LONG_ROOM.camera.targetZ);
export const ROTUNDA_CAMERA_RADIUS = LONG_ROOM.camera.radius;
export const VIRTUAL_LIBRARY_SCENE_MODEL_VERSION = "reference-modular-library-2026-10-09-r4";

export const SHELF_PLAQUE_MOUNT = {
  gap: 0.012,
  backingDepth: 0.026,
  textureFaceOffset: 0.002,
} as const;

const SHELF_SELECTION_FRAME_GAP = 0.04;

export const LONG_ROOM_AISLE_CATEGORY_PLAQUE = {
  lowerCenterY: LONG_ROOM.lowerCaseHeight / 2,
  upperCenterY: LONG_ROOM.galleryY + 0.08 + LONG_ROOM.upperCaseHeight / 2,
  height: 0.26,
  maxWidth: 0.82,
  widthInset: 0.22,
} as const;

export function getLongRoomAisleCategoryPlaqueLayout(
  section: ExpandableShelfSection,
  level: 0 | 1 = 0,
) {
  if (section.centerX === undefined || section.centerZ === undefined) return null;
  const side = Math.sign(section.centerX) || 1;
  return {
    width: Math.min(LONG_ROOM_AISLE_CATEGORY_PLAQUE.maxWidth,
      section.depth - LONG_ROOM_AISLE_CATEGORY_PLAQUE.widthInset),
    height: LONG_ROOM_AISLE_CATEGORY_PLAQUE.height,
    worldPosition: new THREE.Vector3(
      side * (LONG_ROOM.aisleHalfWidth - LONG_ROOM_PILASTER_SHAFT_DEPTH / 2
        - SHELF_PLAQUE_MOUNT.gap - SHELF_PLAQUE_MOUNT.backingDepth / 2),
      level === 0
        ? LONG_ROOM_AISLE_CATEGORY_PLAQUE.lowerCenterY
        : LONG_ROOM_AISLE_CATEGORY_PLAQUE.upperCenterY,
      section.centerZ,
    ),
    worldRotationY: side * Math.PI / 2,
  };
}

export interface ShelfPlaquePlacement {
  shelfIndex: number;
  shelfY: number;
  centerY: number;
  railFrontZ: number;
  backingRearZ: number;
  backingCenterZ: number;
  backingFrontZ: number;
  textureFaceZ: number;
}

export interface ShelfPlaqueRows {
  primary: number;
  secondary: number[];
}

export function getShelfPlaquePlacement(
  section: ExpandableShelfSection,
  shelfIndex: number,
): ShelfPlaquePlacement {
  const shelf = getShelfFrontPlacement(section, shelfIndex);
  const backingRearZ = shelf.frontSurfaceZ - SHELF_PLAQUE_MOUNT.gap;
  const backingCenterZ = backingRearZ - SHELF_PLAQUE_MOUNT.backingDepth / 2;
  const backingFrontZ = backingCenterZ - SHELF_PLAQUE_MOUNT.backingDepth / 2;

  return {
    shelfIndex: shelf.shelfIndex,
    shelfY: shelf.localShelfY,
    centerY: shelf.localCenterY,
    railFrontZ: shelf.frontSurfaceZ,
    backingRearZ,
    backingCenterZ,
    backingFrontZ,
    textureFaceZ: backingFrontZ - SHELF_PLAQUE_MOUNT.textureFaceOffset,
  };
}

export function getShelfPlaqueRows(
  section: Pick<ExpandableShelfSection, "shelfCount">,
  secondaryCount: number,
): ShelfPlaqueRows {
  return {
    primary: section.shelfCount,
    secondary: Array.from(
      { length: secondaryCount },
      (_, index) => Math.max(1, section.shelfCount - 2 - index),
    ),
  };
}

const ROTUNDA_BAY_COUNT = 12;
const ROTUNDA_PRIMARY_BAY_ORDER = [0, 3, 9, 6, 1, 11, 4, 8, 2, 10, 5, 7] as const;
const BOOKS_PER_SHELF_ROW = 5;
const OUTER_SHELF_MIN_RADIUS = LIBRARY.tower.innerRadius - 2;
const LOWER_SHELF_MAX_Y = LIBRARY.tower.galleryY - 0.05;

export const BOOK_INSPECTION_LAYOUT = {
  mobileBreakpoint: 720,
  desktopForwardOffset: 1.02,
  desktopSideOffset: 0.98,
  desktopPreviewScale: 1.8,
  mobileForwardOffset: 0.82,
  mobileSideOffset: 0.4,
  mobileVerticalOffset: 0.72,
  mobilePreviewScale: 1.15,
  minimumZoom: 0.78,
  maximumZoom: 1.38,
} as const;

export const VIRTUAL_LIBRARY_WORLD_LAYER = 0;
export const VIRTUAL_LIBRARY_BOOK_PREVIEW_LAYER = 1;

export const SHELF_BOOK_CLUSTER_GAP = 0.004;
export const SHELF_BOOK_MIN_HIT_WIDTH = 0.16;
export const BOOK_SPINE_TEXTURE_SIZE = { width: 256, height: 1024 } as const;
export const CATALOG_BOOK_MODEL_SIZE = { width: 0.66, height: 1, depth: 0.1 } as const;
export const CATALOG_BOOK_DETAIL_LAYOUT = {
  pageBlockInset: { width: 0.038, height: 0.044, depth: 0.02 },
  pageBlockOffsetX: 0.006,
  coverBoardThickness: 0.008,
  coverArtInset: { width: 0.018, height: 0.018 },
  spineBodyWidth: 0.026,
  spineBodyOffsetX: 0.006,
  spineLabelWidthRatio: 0.84,
  spineLabelHeightRatio: 0.88,
  spineLabelSurfaceGap: 0.0008,
  spineEdgeWidth: 0.008,
  spineEdgeHeightInset: 0.04,
  spineCapHeight: 0.016,
  spineCapWidth: 0.012,
  hingeWidth: 0.008,
  hingeHeightInset: 0.034,
  surfaceGap: 0.0006,
  foreEdgeCurve: 0.0025,
  headbandWidth: 0.03,
  headbandHeight: 0.012,
  headbandDepthInset: 0.024,
} as const;

export function getShelfBookInteractionWidth(renderedSpineWidth: number) {
  return Math.max(renderedSpineWidth, SHELF_BOOK_MIN_HIT_WIDTH);
}

export function getSpineTitleGlyphs(title: string) {
  const glyphs = Array.from(title);
  return glyphs.length > 5 ? [...glyphs.slice(0, 4), "…"] : glyphs;
}

export function getCenteredShelfBookOffsets(
  widths: number[],
  gap = SHELF_BOOK_CLUSTER_GAP,
) {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0)
    + Math.max(0, widths.length - 1) * gap;
  let cursor = -totalWidth / 2;
  return widths.map((width) => {
    const offset = cursor + width / 2;
    cursor += width + gap;
    return offset;
  });
}

const BOOK_COLORS = [
  PALETTE.oxblood, PALETTE.oakWarm, PALETTE.green,
  PALETTE.glassBlue, PALETTE.oak, PALETTE.stone,
].map(color => new THREE.Color(color).getStyle());

export interface SceneBook {
  book: Book;
  classification: CatalogClassification;
  group: THREE.Group;
  hitTarget: THREE.Mesh;
  shelfPosition: THREE.Vector3;
  shelfRotation: THREE.Euler;
  shelfScale: THREE.Vector3;
  modelSize: ShelfBookModelSize;
  shelfSectionId: number;
  shelfRowIndex: number;
  renderSignature: string;
  resources: SceneBookResources;
}

interface SceneBookResources {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
  coverMaterial: THREE.MeshStandardMaterial;
  coverTexture: THREE.Texture;
  coverUrl: string;
}

interface DisposableCatalogResources {
  geometries: readonly THREE.BufferGeometry[];
  materials: readonly THREE.Material[];
}

export interface ShelfBookModelSize {
  width: number;
  height: number;
  depth: number;
}

export interface ShelfCategoryInfo {
  centerX?: number;
  centerZ?: number;
  sectionId: number;
  angle: number;
  radius: number;
  depth: number;
  targetY: number;
  height: number;
  width: number;
  category: LibraryCategory;
  bookCount: number;
}

export interface LibraryWorld {
  catalogTerminal: THREE.Group;
  sceneBooks: SceneBook[];
  interactiveMeshes: THREE.Object3D[];
  shelfHitMeshes: THREE.Object3D[];
  portalHitMeshes: THREE.Object3D[];
  syncCatalogBooks: (books: readonly Book[]) => CatalogSyncResult;
  toggleShelfSection: (sectionId: number) => number | null;
  collapseShelfSections: () => void;
  setHoveredShelfSection: (sectionId: number | null) => void;
  getExpandedShelfSectionId: () => number | null;
  getShelfInfo: (sectionId: number) => ShelfCategoryInfo | null;
  getCameraColliders: (room: LibraryRoomId) => readonly CameraCollider[];
  setActiveRoom: (room: LibraryRoomId) => void;
  getActiveRoom: () => LibraryRoomId;
  animateEnvironment: (elapsed: number) => void;
}

export interface CatalogSyncResult {
  addedBookIds: string[];
  removedBookIds: string[];
  replacedBookIds: string[];
}

interface ShelfSectionController {
  sectionId: number;
  root: THREE.Group;
  hitArea: THREE.Mesh;
  frameMaterial: THREE.MeshBasicMaterial;
  selectionFillMaterial: THREE.MeshBasicMaterial;
  labelMaterials: THREE.MeshBasicMaterial[];
  labelPlates: THREE.Object3D[];
  labelTextureCache: Map<string, THREE.CanvasTexture>;
  plaqueBackingMaterial: THREE.Material;
  info: ShelfCategoryInfo;
  homePosition: THREE.Vector3;
}

interface BookMaterials {
  pages: THREE.MeshStandardMaterial;
  spines: THREE.MeshStandardMaterial[];
  spineTrims: THREE.MeshStandardMaterial[];
  headband: THREE.MeshStandardMaterial;
  foreEdgeGeometry: THREE.PlaneGeometry;
  pageHeadGeometry: THREE.PlaneGeometry;
  covers: Map<string, THREE.MeshStandardMaterial>;
  coverTextures: Map<string, THREE.Texture>;
  coverReferences: Map<string, number>;
  hitTargetGeometry: THREE.BoxGeometry;
  hitTargetMaterial: THREE.MeshBasicMaterial;
  sharedGeometries: Set<THREE.BufferGeometry>;
  sharedMaterials: Set<THREE.Material>;
}

interface AssignedBook<T> {
  book: T;
  index: number;
}

export interface AssignedShelfBook<T> extends AssignedBook<T> {
  bayIndex: number;
  shelfRowIndex: number;
  slot: BookShelfSlot;
}

export function assignBooksToRotundaBays<T>(books: T[]) {
  const assignments = Array.from({ length: ROTUNDA_BAY_COUNT }, () => [] as AssignedBook<T>[]);
  if (books.length === 0) return assignments;

  const activeBayCount = Math.min(
    ROTUNDA_BAY_COUNT,
    Math.max(Math.min(3, books.length), Math.ceil(books.length / BOOKS_PER_SHELF_ROW)),
  );
  const activeBays = ROTUNDA_PRIMARY_BAY_ORDER.slice(0, activeBayCount);
  const booksPerActiveBay = Math.ceil(books.length / activeBayCount);
  books.forEach((book, index) => {
    const bayIndex = activeBays[Math.min(activeBayCount - 1, Math.floor(index / booksPerActiveBay))] ?? 0;
    assignments[bayIndex]?.push({ book, index });
  });
  return assignments;
}

function angleDistance(left: number, right: number) {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)));
}

interface IndexedShelfSlot {
  slot: BookShelfSlot;
  slotIndex: number;
  radius: number;
  angle: number;
}

function shelfTangentOffset(position: THREE.Vector3, angle: number) {
  return position.x * -Math.sin(angle) + position.z * Math.cos(angle);
}

function selectCompactShelfSlotRun(
  candidates: IndexedShelfSlot[],
  targetAngle: number,
  preferredY: number,
  count: number,
) {
  if (count <= 0 || candidates.length < count) return [];
  const targetRadius = LIBRARY.tower.innerRadius - 0.72;
  let bestSlots: IndexedShelfSlot[] = [];
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((anchor) => {
    const anchorRowBase = anchor.slot.position.y - anchor.slot.scale.y / 2;
    const cohort = candidates
      .filter((candidate) => (
        angleDistance(candidate.angle, anchor.angle) < 0.075
        && Math.abs((candidate.slot.position.y - candidate.slot.scale.y / 2) - anchorRowBase) < 0.08
        && Math.abs(candidate.radius - anchor.radius) < 0.18
      ))
      .map((candidate) => ({
        ...candidate,
        tangentOffset: shelfTangentOffset(candidate.slot.position, targetAngle),
      }))
      .sort((left, right) => left.tangentOffset - right.tangentOffset);

    for (let start = 0; start <= cohort.length - count; start += 1) {
      const window = cohort.slice(start, start + count);
      const first = window[0];
      const last = window[window.length - 1];
      if (!first || !last) continue;
      const leftEdge = first.tangentOffset - first.slot.scale.x / 2;
      const rightEdge = last.tangentOffset + last.slot.scale.x / 2;
      const centerOffset = (leftEdge + rightEdge) / 2;
      let gapPenalty = 0;
      for (let index = 1; index < window.length; index += 1) {
        const previous = window[index - 1];
        const current = window[index];
        if (!previous || !current) continue;
        const gap = current.tangentOffset - previous.tangentOffset
          - (previous.slot.scale.x + current.slot.scale.x) / 2;
        gapPenalty += Math.max(0, gap - 0.07) * 70 + Math.max(0, -gap) * 120;
      }
      const score = window.reduce((total, candidate) => (
        total
        + angleDistance(candidate.angle, targetAngle) * 80
        + Math.abs(candidate.slot.position.y - preferredY) * 4
        + Math.abs(candidate.radius - targetRadius) * 2
      ), 0) / window.length
        + Math.abs(centerOffset) * 14
        + gapPenalty;
      if (score < bestScore) {
        bestSlots = window;
        bestScore = score;
      }
    }
  });

  return bestSlots;
}

function fallbackShelfSlot(
  bayIndex: number,
  shelfRowIndex: number,
  rowEntryIndex: number,
  rowEntryCount: number,
): BookShelfSlot {
  const angle = (bayIndex / ROTUNDA_BAY_COUNT) * Math.PI * 2 - Math.PI / 2;
  const tangentOffset = (rowEntryIndex - (rowEntryCount - 1) / 2) * 0.16;
  const radius = LIBRARY.tower.innerRadius - 0.72;
  return {
    position: new THREE.Vector3(
      Math.cos(angle) * radius + Math.sin(angle) * tangentOffset,
      1.73 + shelfRowIndex * 0.79,
      Math.sin(angle) * radius - Math.cos(angle) * tangentOffset,
    ),
    scale: new THREE.Vector3(0.11, 0.62, 0.28),
    rotationY: Math.PI / 2 - angle,
    lean: 0,
    spineFace: -1,
  };
}

export function assignBooksToShelfSlots<T>(books: T[], slots: BookShelfSlot[]) {
  const outerSlots = slots
    .map((slot, slotIndex) => ({
      slot,
      slotIndex,
      radius: Math.hypot(slot.position.x, slot.position.z),
      angle: Math.atan2(slot.position.z, slot.position.x),
    }))
    .filter(({ slot, radius }) => (
      radius >= OUTER_SHELF_MIN_RADIUS
      && slot.position.y < LOWER_SHELF_MAX_Y
      && slot.spineFace === -1
    ));
  const usedSlotIndices = new Set<number>();
  const result: AssignedShelfBook<T>[] = [];

  assignBooksToRotundaBays(books).forEach((entries, bayIndex) => {
    const targetAngle = (bayIndex / ROTUNDA_BAY_COUNT) * Math.PI * 2 - Math.PI / 2;
    const shelfRowCount = Math.ceil(entries.length / BOOKS_PER_SHELF_ROW);
    for (let shelfRowIndex = 0; shelfRowIndex < shelfRowCount; shelfRowIndex += 1) {
      const rowEntries = entries.slice(
        shelfRowIndex * BOOKS_PER_SHELF_ROW,
        (shelfRowIndex + 1) * BOOKS_PER_SHELF_ROW,
      );
      const preferredY = 1.73 + shelfRowIndex * 0.79;
      const availableSlots = outerSlots
        .filter(({ slotIndex }) => !usedSlotIndices.has(slotIndex));
      const selectedRun = selectCompactShelfSlotRun(
        availableSlots,
        targetAngle,
        preferredY,
        rowEntries.length,
      );

      rowEntries.forEach((entry, rowEntryIndex) => {
        const selected = selectedRun[rowEntryIndex];
        if (selected) usedSlotIndices.add(selected.slotIndex);
        const slot = selected?.slot ?? fallbackShelfSlot(
          bayIndex,
          shelfRowIndex,
          rowEntryIndex,
          rowEntries.length,
        );
        result.push({ ...entry, bayIndex, shelfRowIndex, slot });
      });
    }
  });

  return result.sort((left, right) => left.index - right.index);
}

function material(color: string, options: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04, ...options });
}

function roundedBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  meshMaterial: THREE.Material | THREE.Material[],
  options: { radius?: number; segments?: number; castShadow?: boolean; receiveShadow?: boolean } = {},
) {
  const radius = Math.min(options.radius ?? 0.045, Math.min(...size) / 2 - 0.001);
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(...size, options.segments ?? 3, Math.max(0.002, radius)),
    meshMaterial,
  );
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

export function createCatalogBookForeEdgeGeometry(
  width: number,
  height: number,
  curveDepth: number,
) {
  const geometry = new THREE.PlaneGeometry(width, height, 6, 1);
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const normalizedX = position.getX(index) / (width / 2);
    position.setZ(index, curveDepth * (1 - normalizedX * normalizedX));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function mergeBookMeshesForMaterial(
  parent: THREE.Group,
  meshMaterial: THREE.Material,
  name: string,
  ownedGeometries: Set<THREE.BufferGeometry>,
  sharedGeometries: Set<THREE.BufferGeometry>,
) {
  const meshes = parent.children.filter((child): child is THREE.Mesh => (
    child instanceof THREE.Mesh && child.material === meshMaterial
  ));
  if (meshes.length < 2) return;
  const geometries = meshes.map((mesh) => {
    mesh.updateMatrix();
    if (!sharedGeometries.has(mesh.geometry)) ownedGeometries.add(mesh.geometry);
    // RoundedBoxGeometry and PlaneGeometry do not consistently share index
    // topology. Normalize the small per-book detail batch before merging so
    // the refined binding never emits BufferGeometryUtils errors at runtime.
    const geometry = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    return geometry.applyMatrix4(mesh.matrix);
  });
  const geometry = mergeGeometries(geometries, false);
  geometries.forEach(item => item.dispose());
  if (!geometry) return;
  ownedGeometries.add(geometry);
  const mergedMesh = new THREE.Mesh(geometry, meshMaterial);
  mergedMesh.name = name;
  mergedMesh.castShadow = meshes.some(mesh => mesh.castShadow);
  mergedMesh.receiveShadow = meshes.some(mesh => mesh.receiveShadow);
  parent.remove(...meshes);
  parent.add(mergedMesh);
}

function createBookMaterials(anisotropy: number): BookMaterials {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 512;
  const context = canvas.getContext("2d");
  let paperTexture: THREE.CanvasTexture | undefined;
  if (context) {
    const paperGradient = context.createLinearGradient(0, 0, canvas.width, 0);
    paperGradient.addColorStop(0, tokens.color.primitive.cream300);
    paperGradient.addColorStop(0.18, tokens.color.primitive.cream200);
    paperGradient.addColorStop(0.5, tokens.color.primitive.cream100);
    paperGradient.addColorStop(0.82, tokens.color.primitive.cream200);
    paperGradient.addColorStop(1, tokens.color.primitive.cream300);
    context.fillStyle = paperGradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = tokens.color.primitive.cream200;
    context.globalAlpha = 0.7;
    for (let y = 4; y < canvas.height; y += 8) context.fillRect(0, y, canvas.width, 1);
    context.fillStyle = tokens.color.primitive.ink400;
    context.globalAlpha = 0.18;
    for (let y = 17; y < canvas.height; y += 32) context.fillRect(0, y, canvas.width, 1);
    context.globalAlpha = 1;
    paperTexture = new THREE.CanvasTexture(canvas);
    paperTexture.colorSpace = THREE.SRGBColorSpace;
    paperTexture.anisotropy = anisotropy;
    paperTexture.minFilter = THREE.LinearMipmapLinearFilter;
    paperTexture.magFilter = THREE.LinearFilter;
  }
  // Reuse the existing procedural binding surface on real catalog models only.
  // Six shared material variants add fine leather/tooling relief without any
  // anonymous book instance or dependency on the position of the catalog row.
  const spines = BOOK_COLORS.map((color, variant) => {
    const binding = createHistoricalBindingMaterial(variant);
    binding.color.set(color);
    binding.roughness = 0.73 + (variant % 4) * 0.055;
    binding.metalness = 0.015;
    binding.bumpScale = 0.0013;
    return binding;
  });
  const spineTrims = BOOK_COLORS.map((color) => material(
    new THREE.Color(color)
      .lerp(new THREE.Color(tokens.color.primitive.ink900), 0.34)
      .getStyle(),
    { roughness: 0.76, metalness: 0.02 },
  ));
  const pages = material(tokens.color.primitive.cream100, { map: paperTexture, roughness: 0.98 });
  const headband = material(tokens.color.primitive.cream300, { roughness: 0.9, metalness: 0 });
  const foreEdgeGeometry = createCatalogBookForeEdgeGeometry(
    CATALOG_BOOK_MODEL_SIZE.depth - CATALOG_BOOK_DETAIL_LAYOUT.pageBlockInset.depth,
    CATALOG_BOOK_MODEL_SIZE.height - CATALOG_BOOK_DETAIL_LAYOUT.pageBlockInset.height,
    CATALOG_BOOK_DETAIL_LAYOUT.foreEdgeCurve,
  );
  const pageHeadGeometry = new THREE.PlaneGeometry(
    CATALOG_BOOK_MODEL_SIZE.width - CATALOG_BOOK_DETAIL_LAYOUT.pageBlockInset.width,
    CATALOG_BOOK_MODEL_SIZE.depth - CATALOG_BOOK_DETAIL_LAYOUT.pageBlockInset.depth,
  );
  const hitTargetGeometry = new THREE.BoxGeometry(1, 1, 1);
  const hitTargetMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  return {
    pages,
    spines,
    spineTrims,
    headband,
    foreEdgeGeometry,
    pageHeadGeometry,
    covers: new Map<string, THREE.MeshStandardMaterial>(),
    coverTextures: new Map<string, THREE.Texture>(),
    coverReferences: new Map<string, number>(),
    hitTargetGeometry,
    // Three.js still raycasts a mesh whose material is hidden, so this adds no
    // rendered geometry or draw call while giving thin shelf spines a humane target.
    hitTargetMaterial,
    sharedGeometries: new Set([foreEdgeGeometry, pageHeadGeometry, hitTargetGeometry]),
    sharedMaterials: new Set([pages, ...spines, ...spineTrims, headband, hitTargetMaterial]),
  };
}

function getCoverMaterial(
  book: Book,
  loader: THREE.TextureLoader,
  anisotropy: number,
  bookMaterials: BookMaterials,
) {
  const existing = bookMaterials.covers.get(book.coverUrl);
  if (existing) {
    bookMaterials.coverReferences.set(
      book.coverUrl,
      (bookMaterials.coverReferences.get(book.coverUrl) ?? 0) + 1,
    );
    return existing;
  }
  const texture = loader.load(book.coverUrl, undefined, undefined, () => undefined);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  const cover = material(tokens.color.primitive.white, {
    map: texture,
    roughness: 0.82,
    metalness: 0.01,
  });
  bookMaterials.covers.set(book.coverUrl, cover);
  bookMaterials.coverTextures.set(book.coverUrl, texture);
  bookMaterials.coverReferences.set(book.coverUrl, 1);
  return cover;
}

function releaseCoverMaterial(bookMaterials: BookMaterials, coverUrl: string) {
  const references = (bookMaterials.coverReferences.get(coverUrl) ?? 0) - 1;
  if (references > 0) {
    bookMaterials.coverReferences.set(coverUrl, references);
    return;
  }
  bookMaterials.coverReferences.delete(coverUrl);
  const material = bookMaterials.covers.get(coverUrl);
  const texture = bookMaterials.coverTextures.get(coverUrl);
  material?.dispose();
  texture?.dispose();
  bookMaterials.covers.delete(coverUrl);
  bookMaterials.coverTextures.delete(coverUrl);
}

function shelfRotationForSlot(slot: BookShelfSlot) {
  const desiredSpineNormal = new THREE.Vector3(0, 0, slot.spineFace)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotationY);
  return new THREE.Euler(
    0,
    Math.atan2(desiredSpineNormal.z, -desiredSpineNormal.x),
    slot.lean,
  );
}

export function getShelvedBookTransform(
  slot: BookShelfSlot,
  modelSize: ShelfBookModelSize,
) {
  return {
    position: slot.position.clone(),
    rotation: shelfRotationForSlot(slot),
    scale: new THREE.Vector3(
      (slot.scale.z * 0.96) / modelSize.width,
      slot.scale.y / modelSize.height,
      (slot.scale.x * 0.94) / modelSize.depth,
    ),
  };
}

export function placeSceneBookOnShelf(
  sceneBook: Pick<SceneBook, "group" | "shelfPosition" | "shelfRotation" | "shelfScale">,
) {
  sceneBook.group.position.copy(sceneBook.shelfPosition);
  sceneBook.group.rotation.copy(sceneBook.shelfRotation);
  sceneBook.group.scale.copy(sceneBook.shelfScale);
}

export function setSceneBookRenderLayer(
  sceneBook: Pick<SceneBook, "group">,
  layer: number,
) {
  sceneBook.group.traverse((object) => object.layers.set(layer));
}

export interface BookInspectionTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

export function getBookInspectionTransform(
  shelfScale: THREE.Vector3,
  cameraPosition: THREE.Vector3,
  cameraTarget: THREE.Vector3,
  viewportWidth: number,
  yaw: number,
  pitch: number,
  zoom: number,
  target: BookInspectionTransform = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
  },
) {
  const isMobile = viewportWidth <= BOOK_INSPECTION_LAYOUT.mobileBreakpoint;
  const cameraDirection = cameraPosition.clone().sub(cameraTarget).normalize();
  const cameraRight = new THREE.Vector3(0, 1, 0).cross(cameraDirection).normalize();
  target.position.copy(cameraTarget)
    .addScaledVector(
      cameraDirection,
      isMobile ? BOOK_INSPECTION_LAYOUT.mobileForwardOffset : BOOK_INSPECTION_LAYOUT.desktopForwardOffset,
    )
    .addScaledVector(
      cameraRight,
      -(isMobile ? BOOK_INSPECTION_LAYOUT.mobileSideOffset : BOOK_INSPECTION_LAYOUT.desktopSideOffset),
    );
  if (isMobile) target.position.y += BOOK_INSPECTION_LAYOUT.mobileVerticalOffset;
  const lookAtMatrix = new THREE.Matrix4().lookAt(
    cameraPosition,
    target.position,
    new THREE.Vector3(0, 1, 0),
  );
  target.quaternion.setFromRotationMatrix(lookAtMatrix);
  target.quaternion.multiply(new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pitch, yaw, 0, "YXZ"),
  ));
  const clampedZoom = THREE.MathUtils.clamp(
    zoom,
    BOOK_INSPECTION_LAYOUT.minimumZoom,
    BOOK_INSPECTION_LAYOUT.maximumZoom,
  );
  target.scale.copy(shelfScale).multiplyScalar(
    (isMobile ? BOOK_INSPECTION_LAYOUT.mobilePreviewScale : BOOK_INSPECTION_LAYOUT.desktopPreviewScale)
      * clampedZoom,
  );
  return target;
}

function nearestShelfSection(
  position: THREE.Vector3,
  shelfSections: ExpandableShelfSection[],
) {
  const angle = Math.atan2(position.z, position.x);
  return shelfSections
    .map((section) => ({
      section,
      distance:
        angleDistance(section.angle, angle) * 10
        + Math.abs(position.y - (section.baseY + section.height / 2)),
    }))
    .sort((left, right) => left.distance - right.distance)[0]?.section;
}

function catalogBookRenderSignature(book: Book, classification: CatalogClassification) {
  return JSON.stringify([
    book.title,
    book.coverUrl,
    classification.category.id,
    classification.subcategory.id,
  ]);
}

function trackBookResources(
  group: THREE.Group,
  bookMaterials: BookMaterials,
  ownedGeometries: Set<THREE.BufferGeometry>,
  ownedMaterials: Set<THREE.Material>,
) {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!bookMaterials.sharedGeometries.has(object.geometry)) ownedGeometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((objectMaterial) => {
      if (!bookMaterials.sharedMaterials.has(objectMaterial)) ownedMaterials.add(objectMaterial);
    });
  });
}

function createBook(
  assignment: AssignedShelfBook<Book>,
  classification: CatalogClassification,
  loader: THREE.TextureLoader,
  anisotropy: number,
  bookMaterials: BookMaterials,
  shelfSections: ExpandableShelfSection[],
) {
  const { book, slot } = assignment;
  // Binding dimensions and color stay with the book when its shelf order changes.
  const index = Array.from(book.id).reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 0);
  const { width, height, depth } = CATALOG_BOOK_MODEL_SIZE;
  const details = CATALOG_BOOK_DETAIL_LAYOUT;
  const bindingColor = BOOK_COLORS[index % BOOK_COLORS.length];
  const spineMaterial = bookMaterials.spines[index % bookMaterials.spines.length];
  const spineTrimMaterial = bookMaterials.spineTrims[index % bookMaterials.spineTrims.length];
  const coverMaterial = getCoverMaterial(book, loader, anisotropy, bookMaterials);
  const coverTexture = bookMaterials.coverTextures.get(book.coverUrl);
  if (!coverTexture) throw new Error(`Cover texture was not created for ${book.id}`);
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const ownedTextures = new Set<THREE.Texture>();
  const group = new THREE.Group();

  // Keep the paper block inset on all exposed edges so the cover reads as a
  // thin binding rather than a single slab.
  const pageBlockWidth = width - details.pageBlockInset.width;
  const pageBlockHeight = height - details.pageBlockInset.height;
  const pageBlockDepth = depth - details.pageBlockInset.depth;
  const pageBlock = roundedBox(group, [pageBlockWidth, pageBlockHeight, pageBlockDepth],
    [details.pageBlockOffsetX, 0, 0], bookMaterials.pages, {
      radius: 0.006, segments: 2,
    });
  pageBlock.name = `Catalog page block: ${book.title}`;

  const foreEdge = new THREE.Mesh(
    bookMaterials.foreEdgeGeometry,
    bookMaterials.pages,
  );
  foreEdge.name = `Catalog fore edge: ${book.title}`;
  foreEdge.position.set(
    details.pageBlockOffsetX + pageBlockWidth / 2 + details.surfaceGap,
    0,
    0,
  );
  foreEdge.rotation.y = Math.PI / 2;
  group.add(foreEdge);

  const pageHead = new THREE.Mesh(
    bookMaterials.pageHeadGeometry,
    bookMaterials.pages,
  );
  pageHead.name = `Catalog page head: ${book.title}`;
  pageHead.position.set(
    details.pageBlockOffsetX,
    pageBlockHeight / 2 + details.surfaceGap,
    0,
  );
  pageHead.rotation.x = -Math.PI / 2;
  group.add(pageHead);

  // Separate front and back boards leave a restrained binding lip around the
  // real catalog cover. Fine hinge grooves remain visible when the book turns.
  for (const side of [-1, 1] as const) {
    const board = roundedBox(group, [width, height, details.coverBoardThickness], [
      0,
      0,
      side * (depth / 2 - details.coverBoardThickness / 2),
    ], spineMaterial, { radius: 0.003, segments: 2 });
    board.name = `${side === 1 ? "Front" : "Back"} catalog cover board: ${book.title}`;

    const hinge = new THREE.Mesh(
      new THREE.PlaneGeometry(details.hingeWidth, height - details.hingeHeightInset * 2),
      spineTrimMaterial,
    );
    hinge.name = `${side === 1 ? "Front" : "Back"} catalog cover hinge: ${book.title}`;
    hinge.position.set(
      -width / 2 + details.spineBodyWidth + details.hingeWidth,
      0,
      side * (depth / 2 + details.surfaceGap * (side === 1 ? 2 : 1)),
    );
    if (side === -1) hinge.rotation.y = Math.PI;
    group.add(hinge);
  }

  const coverFace = new THREE.Mesh(
    new THREE.PlaneGeometry(
      width - details.coverArtInset.width,
      height - details.coverArtInset.height,
    ),
    coverMaterial,
  );
  coverFace.name = `Catalog cover: ${book.title}`;
  coverFace.position.z = depth / 2 + details.surfaceGap;
  group.add(coverFace);

  const spineBody = roundedBox(group, [details.spineBodyWidth, height, depth], [
    -width / 2 + details.spineBodyOffsetX,
    0,
    0,
  ], spineMaterial, { radius: 0.011, segments: 3 });
  spineBody.name = `Catalog rounded spine: ${book.title}`;
  const spineSurfaceX = -width / 2 + details.spineBodyOffsetX - details.spineBodyWidth / 2;

  for (const side of [-1, 1] as const) {
    const edge = roundedBox(group, [
      details.spineEdgeWidth,
      height - details.spineEdgeHeightInset * 2,
      details.spineEdgeWidth,
    ], [
      spineSurfaceX + details.spineEdgeWidth / 2,
      0,
      side * (depth / 2 - details.spineEdgeWidth / 2),
    ], spineTrimMaterial, { radius: 0.003, segments: 2 });
    edge.name = `Catalog spine shoulder: ${book.title}`;
  }

  for (const side of [-1, 1] as const) {
    const cap = roundedBox(group, [
      details.spineCapWidth,
      details.spineCapHeight,
      depth - details.spineEdgeWidth,
    ], [
      spineSurfaceX + details.spineCapWidth / 2,
      side * (height / 2 - details.spineCapHeight / 2),
      0,
    ], spineTrimMaterial, { radius: 0.004, segments: 2 });
    cap.name = `Catalog spine cap: ${book.title}`;

    const headband = roundedBox(group, [
      details.headbandWidth,
      details.headbandHeight,
      depth - details.headbandDepthInset,
    ], [
      -width / 2 + details.spineBodyOffsetX + details.headbandWidth / 2,
      side * (pageBlockHeight / 2 - details.headbandHeight / 2),
      0,
    ], bookMaterials.headband, { radius: 0.003, segments: 2 });
    headband.name = `Catalog headband: ${book.title}`;
  }

  const spineCanvas = document.createElement("canvas");
  spineCanvas.width = BOOK_SPINE_TEXTURE_SIZE.width;
  spineCanvas.height = BOOK_SPINE_TEXTURE_SIZE.height;
  const context = spineCanvas.getContext("2d");
  if (context) {
    const bindingEdgeColor = new THREE.Color(bindingColor)
      .lerp(new THREE.Color(tokens.color.primitive.ink900), 0.3)
      .getStyle();
    const bindingHighlightColor = new THREE.Color(bindingColor)
      .lerp(new THREE.Color(tokens.color.primitive.cream100), 0.1)
      .getStyle();
    const bindingGradient = context.createLinearGradient(0, 0, BOOK_SPINE_TEXTURE_SIZE.width, 0);
    bindingGradient.addColorStop(0, bindingEdgeColor);
    bindingGradient.addColorStop(0.18, bindingColor);
    bindingGradient.addColorStop(0.5, bindingHighlightColor);
    bindingGradient.addColorStop(0.82, bindingColor);
    bindingGradient.addColorStop(1, bindingEdgeColor);
    context.fillStyle = bindingGradient;
    context.fillRect(0, 0, BOOK_SPINE_TEXTURE_SIZE.width, BOOK_SPINE_TEXTURE_SIZE.height);

    context.save();
    context.globalAlpha = 0.12;
    context.strokeStyle = tokens.color.primitive.cream100;
    context.lineWidth = 1;
    for (let x = 8; x < BOOK_SPINE_TEXTURE_SIZE.width; x += 8) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, BOOK_SPINE_TEXTURE_SIZE.height);
      context.stroke();
    }
    context.restore();

    context.fillStyle = tokens.color.primitive.cream300;
    context.globalAlpha = 0.78;
    for (const y of [76, BOOK_SPINE_TEXTURE_SIZE.height - 80]) {
      context.fillRect(18, y, BOOK_SPINE_TEXTURE_SIZE.width - 36, 4);
      context.fillRect(28, y + 9, BOOK_SPINE_TEXTURE_SIZE.width - 56, 2);
    }
    context.globalAlpha = 1;
    context.fillStyle = tokens.color.primitive.cream100;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `600 168px ${tokens.typography.fontFamily.readerSerif}`;
    context.lineWidth = 7;
    context.strokeStyle = tokens.color.primitive.ink900;
    const visibleTitle = getSpineTitleGlyphs(book.title);
    const lineHeight = 184;
    const firstLineY = BOOK_SPINE_TEXTURE_SIZE.height / 2 - (visibleTitle.length - 1) * lineHeight / 2;
    visibleTitle.forEach((character, line) => {
      const y = firstLineY + line * lineHeight;
      context.strokeText(character, BOOK_SPINE_TEXTURE_SIZE.width / 2, y, 218);
      context.fillText(character, BOOK_SPINE_TEXTURE_SIZE.width / 2, y, 218);
    });
    const texture = new THREE.CanvasTexture(spineCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const spineLabelMaterial = material(tokens.color.primitive.white, {
      map: texture,
      emissive: tokens.color.primitive.white,
      emissiveMap: texture,
      emissiveIntensity: 0.06,
      roughness: 0.72,
      metalness: 0,
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(
      depth * details.spineLabelWidthRatio,
      height * details.spineLabelHeightRatio,
    ), spineLabelMaterial);
    ownedMaterials.add(spineLabelMaterial);
    ownedTextures.add(texture);
    label.name = `Catalog spine: ${book.title}`;
    label.position.x = spineSurfaceX - details.spineLabelSurfaceGap;
    label.rotation.y = -Math.PI / 2;
    group.add(label);
  }

  mergeBookMeshesForMaterial(group, bookMaterials.pages, `Catalog page block detail: ${book.title}`,
    ownedGeometries, bookMaterials.sharedGeometries);
  mergeBookMeshesForMaterial(group, spineMaterial, `Catalog binding shell: ${book.title}`,
    ownedGeometries, bookMaterials.sharedGeometries);
  mergeBookMeshesForMaterial(group, spineTrimMaterial, `Catalog binding trim: ${book.title}`,
    ownedGeometries, bookMaterials.sharedGeometries);
  mergeBookMeshesForMaterial(group, bookMaterials.headband, `Catalog headbands: ${book.title}`,
    ownedGeometries, bookMaterials.sharedGeometries);
  trackBookResources(group, bookMaterials, ownedGeometries, ownedMaterials);

  const shelfTransform = getShelvedBookTransform(slot, { width, height, depth });
  const shelfPosition = shelfTransform.position;
  const shelfRotation = shelfTransform.rotation;
  const shelfScale = shelfTransform.scale;
  const hitTarget = new THREE.Mesh(bookMaterials.hitTargetGeometry, bookMaterials.hitTargetMaterial);
  hitTarget.name = `Catalog book hit target: ${book.title}`;
  hitTarget.userData.isVirtualBookHitTarget = true;
  hitTarget.scale.set(
    width * 1.03,
    height * 1.1,
    getShelfBookInteractionWidth(depth * Math.abs(shelfScale.z)) / Math.max(Math.abs(shelfScale.z), 0.0001),
  );
  group.add(hitTarget);
  const shelfSectionId = shelfSections.find(section => section.centerX !== undefined && section.id === assignment.bayIndex)?.id
    ?? nearestShelfSection(shelfPosition, shelfSections)?.id
    ?? assignment.bayIndex;
  group.userData.bookId = book.id;
  group.userData.slotId = slot.slotId;
  group.userData.isVirtualBook = true;
  group.userData.shelfBayIndex = assignment.bayIndex;
  group.userData.shelfSectionId = shelfSectionId;
  group.userData.shelfRowIndex = assignment.shelfRowIndex;

  const sceneBook: SceneBook = {
    book,
    classification,
    group,
    hitTarget,
    shelfPosition,
    shelfRotation,
    shelfScale,
    modelSize: { width, height, depth },
    shelfSectionId,
    shelfRowIndex: assignment.shelfRowIndex,
    renderSignature: catalogBookRenderSignature(book, classification),
    resources: {
      geometries: ownedGeometries,
      materials: ownedMaterials,
      textures: ownedTextures,
      coverMaterial,
      coverTexture,
      coverUrl: book.coverUrl,
    },
  };
  placeSceneBookOnShelf(sceneBook);
  group.userData.sceneBook = sceneBook;
  return sceneBook;
}

function updateSceneBookAssignment(
  sceneBook: SceneBook,
  assignment: AssignedShelfBook<Book>,
  classification: CatalogClassification,
  shelfSections: ExpandableShelfSection[],
) {
  const shelfTransform = getShelvedBookTransform(assignment.slot, sceneBook.modelSize);
  const shelfSectionId = shelfSections.find(section => (
    section.centerX !== undefined && section.id === assignment.bayIndex
  ))?.id
    ?? nearestShelfSection(shelfTransform.position, shelfSections)?.id
    ?? assignment.bayIndex;

  sceneBook.book = assignment.book;
  sceneBook.classification = classification;
  sceneBook.shelfPosition.copy(shelfTransform.position);
  sceneBook.shelfRotation.copy(shelfTransform.rotation);
  sceneBook.shelfScale.copy(shelfTransform.scale);
  sceneBook.shelfSectionId = shelfSectionId;
  sceneBook.shelfRowIndex = assignment.shelfRowIndex;
  sceneBook.renderSignature = catalogBookRenderSignature(assignment.book, classification);
  sceneBook.hitTarget.name = `Catalog book hit target: ${assignment.book.title}`;
  sceneBook.hitTarget.scale.set(
    sceneBook.modelSize.width * 1.03,
    sceneBook.modelSize.height * 1.1,
    getShelfBookInteractionWidth(sceneBook.modelSize.depth * Math.abs(sceneBook.shelfScale.z))
      / Math.max(Math.abs(sceneBook.shelfScale.z), 0.0001),
  );
  sceneBook.group.userData.bookId = assignment.book.id;
  sceneBook.group.userData.slotId = assignment.slot.slotId;
  sceneBook.group.userData.shelfBayIndex = assignment.bayIndex;
  sceneBook.group.userData.shelfSectionId = shelfSectionId;
  sceneBook.group.userData.shelfRowIndex = assignment.shelfRowIndex;
  if (sceneBook.group.userData.bookPresentation !== "inspection") placeSceneBookOnShelf(sceneBook);
}

function releaseSceneBook(sceneBook: SceneBook, bookMaterials: BookMaterials) {
  sceneBook.group.removeFromParent();
  sceneBook.resources.geometries.forEach((geometry) => geometry.dispose());
  sceneBook.resources.materials.forEach((bookMaterial) => {
    if (bookMaterial !== sceneBook.resources.coverMaterial) bookMaterial.dispose();
  });
  sceneBook.resources.textures.forEach((texture) => texture.dispose());
  releaseCoverMaterial(bookMaterials, sceneBook.resources.coverUrl);
}

function centerSceneBookClusters(
  sceneBooks: SceneBook[],
  shelfSections: ExpandableShelfSection[],
) {
  const sectionsById = new Map(shelfSections.map((section) => [section.id, section]));
  const clusters = new Map<string, SceneBook[]>();
  sceneBooks.forEach((sceneBook) => {
    const key = `${sceneBook.shelfSectionId}:${sceneBook.shelfRowIndex}`;
    const cluster = clusters.get(key) ?? [];
    cluster.push(sceneBook);
    clusters.set(key, cluster);
  });

  clusters.forEach((cluster) => {
    const section = sectionsById.get(cluster[0]?.shelfSectionId ?? -1);
    if (!section) return;
    const tangentX = -Math.sin(section.angle);
    const tangentZ = Math.cos(section.angle);
    cluster.sort((left, right) => (
      shelfTangentOffset(left.shelfPosition, section.angle)
      - shelfTangentOffset(right.shelfPosition, section.angle)
    ));
    const widths = cluster.map((sceneBook) => getShelfBookInteractionWidth(
      sceneBook.modelSize.depth * Math.abs(sceneBook.shelfScale.z),
    ));
    const offsets = getCenteredShelfBookOffsets(widths);
    cluster.forEach((sceneBook, index) => {
      const radius = Math.hypot(sceneBook.shelfPosition.x, sceneBook.shelfPosition.z);
      if (section.centerX !== undefined && section.centerZ !== undefined) {
        const normalX = Math.cos(section.angle);
        const normalZ = Math.sin(section.angle);
        const bookCenterOffset = section.bookCenterOffset ?? LONG_ROOM_BOOK_CENTER_OFFSET;
        sceneBook.shelfPosition.set(section.centerX - normalX * bookCenterOffset + tangentX * (offsets[index] ?? 0),
          sceneBook.shelfPosition.y, section.centerZ - normalZ * bookCenterOffset + tangentZ * (offsets[index] ?? 0));
        if (sceneBook.group.userData.bookPresentation !== "inspection") {
          placeSceneBookOnShelf(sceneBook);
        }
        return;
      }
      const offset = offsets[index] ?? 0;
      sceneBook.shelfPosition.set(
        Math.cos(section.angle) * radius + tangentX * offset,
        sceneBook.shelfPosition.y,
        Math.sin(section.angle) * radius + tangentZ * offset,
      );
      if (sceneBook.group.userData.bookPresentation !== "inspection") {
        placeSceneBookOnShelf(sceneBook);
      }
    });
  });
}

function shelfCategoryInfo(
  section: ExpandableShelfSection,
  sceneBooks: SceneBook[],
): ShelfCategoryInfo {
  const sectionBooks = sceneBooks.filter((sceneBook) => sceneBook.shelfSectionId === section.id);
  const categoryCounts = new Map<string, { category: LibraryCategory; count: number }>();
  sectionBooks.forEach((sceneBook) => {
    const category = sceneBook.classification.category;
    const current = categoryCounts.get(category.id);
    categoryCounts.set(category.id, { category, count: (current?.count ?? 0) + 1 });
  });
  const category = [...categoryCounts.values()]
    .sort((left, right) => right.count - left.count)[0]?.category
    ?? defaultCategoryForShelf(section.id);
  return {
    sectionId: section.id,
    centerX: section.centerX,
    centerZ: section.centerZ,
    angle: section.angle,
    radius: section.radius,
    depth: section.depth,
    targetY: section.baseY + section.height / 2,
    height: section.height,
    width: section.width,
    category,
    bookCount: sectionBooks.length,
  };
}

function createShelfLabelTexture(
  cache: Map<string, THREE.CanvasTexture>,
  title: string,
  subtitle: string,
  compact: boolean,
) {
  const cacheKey = `${compact ? "compact" : "primary"}:${title}:${subtitle}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = compact ? 1024 : 640;
  canvas.height = compact ? 132 : 210;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  context.fillStyle = tokens.color.primitive.ink900;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  const hasSubtitle = subtitle.trim().length > 0;
  if (compact) {
    context.strokeStyle = tokens.color.primitive.amber600;
    context.lineWidth = 8;
    context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    context.fillStyle = tokens.color.primitive.cream100;
    context.font = `700 76px ${tokens.typography.fontFamily.body}`;
    context.fillText(title, canvas.width / 2, hasSubtitle ? 48 : 67, canvas.width - 72);
    if (hasSubtitle) {
      context.fillStyle = tokens.color.primitive.amber600;
      context.font = `600 21px ${tokens.typography.fontFamily.body}`;
      context.fillText(subtitle, canvas.width / 2, 103, canvas.width - 72);
    }
  } else {
    context.strokeStyle = tokens.color.primitive.amber600;
    context.lineWidth = 11;
    context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    context.strokeStyle = tokens.color.primitive.coral700;
    context.lineWidth = 3;
    context.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
    context.fillStyle = tokens.color.primitive.cream200;
    context.font = `600 54px ${tokens.typography.fontFamily.display}`;
    context.fillText(title, canvas.width / 2, 82);
    if (hasSubtitle) {
      context.fillStyle = tokens.color.primitive.amber600;
      context.font = `500 24px ${tokens.typography.fontFamily.body}`;
      context.fillText(subtitle, canvas.width / 2, 151);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  cache.set(cacheKey, texture);
  return texture;
}

function createShelfLabel(
  textureCache: Map<string, THREE.CanvasTexture>,
  backingMaterial: THREE.Material,
  title: string,
  subtitle: string,
  width: number,
  height: number,
  compact: boolean,
) {
  const material = new THREE.MeshBasicMaterial({
    map: createShelfLabelTexture(textureCache, title, subtitle, compact),
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const plaque = new THREE.Group();
  plaque.name = `${title} shelf plaque`;
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, SHELF_PLAQUE_MOUNT.backingDepth),
    backingMaterial,
  );
  backing.name = `${title} shelf plaque solid backing`;
  backing.castShadow = true;
  backing.receiveShadow = true;
  plaque.add(backing);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  label.name = `${title} shelf plaque texture face`;
  label.position.z = -SHELF_PLAQUE_MOUNT.backingDepth / 2
    - SHELF_PLAQUE_MOUNT.textureFaceOffset;
  label.rotation.y = Math.PI;
  plaque.add(label);
  return { plaque, material };
}

function createShelfSectionControllers(
  scene: THREE.Scene,
  shelfSections: ExpandableShelfSection[],
  sceneBooks: SceneBook[],
  plaqueBackingMaterial: THREE.Material,
) {
  const labelTextureCache = new Map<string, THREE.CanvasTexture>();
  return shelfSections.map((section): ShelfSectionController => {
    const info = shelfCategoryInfo(section, sceneBooks);
    const root = new THREE.Group();
    root.name = `Expandable shelf section ${section.id}`;
    root.userData.shelfSectionId = section.id;
    const homePosition = new THREE.Vector3(
      section.centerX ?? Math.cos(section.angle) * section.radius,
      section.baseY + section.height / 2,
      section.centerZ ?? Math.sin(section.angle) * section.radius,
    );
    root.position.copy(homePosition);
    root.rotation.y = Math.PI / 2 - section.angle;

    const hitMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
    });
    const hitArea = new THREE.Mesh(
      new THREE.BoxGeometry(section.width * 0.96, section.height * 0.94, section.depth + 0.7),
      hitMaterial,
    );
    hitArea.name = `Shelf section ${section.id} click target`;
    hitArea.position.z = -section.depth * 0.34;
    hitArea.userData.shelfSectionId = section.id;
    root.add(hitArea);

    const frameMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      color: tokens.color.primitive.amber600,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    // Keep the selection frame on the same front plane as the shelf boards.
    // The old extra offset made the outline read as a floating acrylic frame
    // in front of the case instead of an in-place shelf highlight.
    const frameZ = -(section.frontOffset ?? LONG_ROOM_SHELF_FRONT_OFFSET) - SHELF_SELECTION_FRAME_GAP;
    const frameWidth = section.width * 0.92;
    const frameHeight = section.height * 0.9;
    const verticalGeometry = new THREE.BoxGeometry(0.055, frameHeight, 0.025);
    const horizontalGeometry = new THREE.BoxGeometry(frameWidth, 0.055, 0.025);
    for (const x of [-frameWidth / 2, frameWidth / 2]) {
      const bar = new THREE.Mesh(verticalGeometry, frameMaterial);
      bar.position.set(x, 0, frameZ);
      bar.renderOrder = 7;
      root.add(bar);
    }
    for (const y of [-frameHeight / 2, frameHeight / 2]) {
      const bar = new THREE.Mesh(horizontalGeometry, frameMaterial);
      bar.position.set(0, y, frameZ);
      bar.renderOrder = 7;
      root.add(bar);
    }

    const selectionFillMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      color: tokens.color.primitive.amber600,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const selectionFill = new THREE.Mesh(
      new THREE.PlaneGeometry(frameWidth * 0.985, frameHeight * 0.985),
      selectionFillMaterial,
    );
    selectionFill.position.z = frameZ - 0.012;
    selectionFill.rotation.y = Math.PI;
    selectionFill.renderOrder = 6;
    root.add(selectionFill);

    const labelMaterials: THREE.MeshBasicMaterial[] = [];
    const labelPlates: THREE.Object3D[] = [];
    if (section.plaquePlacement === 'shelf-front') {
      const categoryLabel = createShelfLabel(labelTextureCache, plaqueBackingMaterial,
        info.category.label, info.category.subtitle, Math.min(1.2, section.width * 0.4), 0.2, false);
      categoryLabel.plaque.position.set(0, section.height / 2 + 0.12,
        -(section.plaqueFrontOffset ?? section.frontOffset ?? section.depth / 2) - SHELF_PLAQUE_MOUNT.gap - SHELF_PLAQUE_MOUNT.backingDepth / 2);
      categoryLabel.plaque.userData = {isShelfCategoryPlaque: true, sectionId: section.id, placement: 'shelf-front'};
      root.add(categoryLabel.plaque);
      labelMaterials.push(categoryLabel.material);
      labelPlates.push(categoryLabel.plaque);
    } else if (section.centerX !== undefined && section.centerZ !== undefined) {
      for (const level of [0, 1] as const) {
        const layout = getLongRoomAisleCategoryPlaqueLayout(section, level);
        if (!layout) continue;
        const categoryLabel = createShelfLabel(
          labelTextureCache,
          plaqueBackingMaterial,
          info.category.label,
          info.category.subtitle,
          layout.width,
          layout.height,
          false,
        );
        root.updateMatrixWorld(true);
        categoryLabel.plaque.position.copy(root.worldToLocal(layout.worldPosition.clone()));
        categoryLabel.plaque.rotation.y = layout.worldRotationY - root.rotation.y;
        categoryLabel.plaque.userData = {
          isShelfCategoryPlaque: true,
          categoryId: info.category.id,
          sectionId: section.id,
          level,
          placement: "long-room-aisle-end",
        };
        root.add(categoryLabel.plaque);
        labelMaterials.push(categoryLabel.material);
        labelPlates.push(categoryLabel.plaque);
      }
    } else if (section.centerX === undefined || section.centerZ === undefined) {
      const plaqueRows = getShelfPlaqueRows(section, info.category.subcategories.length);
      const primaryPlacement = getShelfPlaquePlacement(section, plaqueRows.primary);
      const primaryLabel = createShelfLabel(
        labelTextureCache,
        plaqueBackingMaterial,
        info.category.label,
        "",
        Math.min(1.16, section.width * 0.26),
        0.15,
        true,
      );
      primaryLabel.plaque.position.set(
        0,
        primaryPlacement.centerY,
        primaryPlacement.backingCenterZ,
      );
      root.add(primaryLabel.plaque);
      labelMaterials.push(primaryLabel.material);
      labelPlates.push(primaryLabel.plaque);

      info.category.subcategories.forEach((subcategory, index) => {
        const placement = getShelfPlaquePlacement(section, plaqueRows.secondary[index] ?? 1);
        const secondaryLabel = createShelfLabel(
          labelTextureCache,
          plaqueBackingMaterial,
          subcategory.label,
          "",
          Math.min(0.92, section.width * 0.2),
          0.12,
          true,
        );
        secondaryLabel.plaque.position.set(
          0,
          placement.centerY,
          placement.backingCenterZ,
        );
        root.add(secondaryLabel.plaque);
        labelMaterials.push(secondaryLabel.material);
        labelPlates.push(secondaryLabel.plaque);
      });
    }
    scene.add(root);
    return {
      sectionId: section.id,
      root,
      hitArea,
      frameMaterial,
      selectionFillMaterial,
      labelMaterials,
      labelPlates,
      labelTextureCache,
      plaqueBackingMaterial,
      info,
      homePosition,
    };
  });
}

function updateShelfSectionControllers(
  shelfControllers: ShelfSectionController[],
  shelfSections: ExpandableShelfSection[],
  sceneBooks: SceneBook[],
) {
  const sectionsById = new Map(shelfSections.map((section) => [section.id, section]));
  shelfControllers.forEach((controller) => {
    const section = sectionsById.get(controller.sectionId);
    if (!section) return;
    const info = shelfCategoryInfo(section, sceneBooks);
    controller.info = info;
    const labels = section.centerX !== undefined && section.centerZ !== undefined
      ? [
        { title: info.category.label, subtitle: info.category.subtitle, compact: false },
        { title: info.category.label, subtitle: info.category.subtitle, compact: false },
      ]
      : [
        { title: info.category.label, subtitle: "", compact: true },
        ...info.category.subcategories.map((subcategory) => ({
          title: subcategory.label,
          subtitle: "",
          compact: true,
        })),
      ];
    controller.labelMaterials.forEach((labelMaterial, index) => {
      const label = labels[index];
      if (!label) return;
      labelMaterial.map = createShelfLabelTexture(
        controller.labelTextureCache,
        label.title,
        label.subtitle,
        label.compact,
      );
      labelMaterial.needsUpdate = true;
    });
    controller.labelPlates.forEach((plate, index) => {
      plate.userData.categoryId = info.category.id;
      plate.name = `${info.category.label} shelf plaque`;
      const level = plate.userData.level as 0 | 1 | undefined;
      if (level !== undefined) plate.userData.categoryId = info.category.id;
      if (index >= labels.length) plate.visible = false;
    });
  });
}

export function createVirtualLibraryWorld(
  scene: THREE.Scene,
  loader: THREE.TextureLoader,
  anisotropy: number,
  preparedHall?: LongRoomBuilt,
): LibraryWorld {
  const built = preparedHall ?? buildLongRoom({}, loader);
  // Streaming owns its chunk geometry and material batches across async loads.
  if (!built.root.userData.staticOptimization && !built.root.userData.streamingArchitecture)
    optimizeStaticMeshes(built.root, built.interactiveObjects);
  built.root.userData.modelVersion = VIRTUAL_LIBRARY_SCENE_MODEL_VERSION;
  const hallCameraColliders = [
    ...collectCameraColliders(built.root, "hall"),
  ];
  scene.add(built.root);

  const bookMaterials = createBookMaterials(anisotropy);
  const catalogRoot = new THREE.Group();
  catalogRoot.name = "Live catalog book models";
  catalogRoot.userData.isLiveCatalogRoot = true;
  // Shared catalog resources are not necessarily referenced by a mesh when
  // the authorized library is empty. Keep them discoverable by disposeScene
  // without adding a rendered placeholder object to the live hall.
  catalogRoot.userData.disposableCatalogResources = {
    geometries: [...bookMaterials.sharedGeometries],
    materials: [...bookMaterials.sharedMaterials],
  } satisfies DisposableCatalogResources;
  scene.add(catalogRoot);
  const sceneBooks: SceneBook[] = [];
  const interactiveMeshes: THREE.Object3D[] = [];
  const shelfControllers = createShelfSectionControllers(
    scene,
    built.shelfSections,
    sceneBooks,
    built.materials.woodDark,
  );
  const portalHitMeshes: THREE.Object3D[] = [];
  let rooms: ReturnType<typeof createVirtualLibraryRooms> | null = null;
  const ensureRooms = () => {
    rooms ??= createVirtualLibraryRooms(scene, loader, built.materials);
    return rooms;
  };
  const roomCameraColliders = new Map<Exclude<LibraryRoomId, "hall">, CameraCollider[]>();
  const getCameraColliders = (room: LibraryRoomId) => {
    if (room === "hall") return hallCameraColliders;
    const cached = roomCameraColliders.get(room);
    if (cached) return cached;
    const activeRooms = ensureRooms();
    const colliders = collectCameraColliders(activeRooms[room], room);
    roomCameraColliders.set(room, colliders);
    return colliders;
  };
  let expandedShelfSectionId: number | null = null;
  let hoveredShelfSectionId: number | null = null;
  let activeRoom: LibraryRoomId = "hall";
  const catalogBooksById = new Map<string, SceneBook>();
  let catalogSyncRevision = 0;

  const syncCatalogBooks = (books: readonly Book[]): CatalogSyncResult => {
    const nextBooks = Array.from(books);
    const seenBookIds = new Set<string>();
    nextBooks.forEach((book) => {
      if (seenBookIds.has(book.id)) throw new Error(`Duplicate catalog book id: ${book.id}`);
      seenBookIds.add(book.id);
    });
    // Validate category capacity before creating or removing any GPU-backed
    // catalog model. The authoritative query remains an all-pages snapshot.
    longRoomCatalogSectionCounts(nextBooks, built.shelfSections.length);
    const sortedBooks = sortCatalogBooksByClassification(nextBooks);
    const staged: SceneBook[] = [];
    const plans: Array<{
      assignment: AssignedShelfBook<Book>;
      classification: CatalogClassification;
      existing: SceneBook | undefined;
      replacement?: SceneBook;
    }> = [];
    let catalogSectionOffset = 0;
    let booksInCatalogSection = 0;
    let previousCategoryId = "";

    try {
      sortedBooks.forEach(({ book, classification }, index) => {
        if (classification.category.id !== previousCategoryId
          || booksInCatalogSection === LONG_ROOM_CATALOG_SECTION_CAPACITY) {
          if (previousCategoryId) catalogSectionOffset += LONG_ROOM_CATALOG_SECTION_CAPACITY;
          previousCategoryId = classification.category.id;
          booksInCatalogSection = 0;
        }
        const slot = built.catalogSlots[catalogSectionOffset + booksInCatalogSection];
        if (!slot) throw new Error("Long Room catalog capacity exceeded");
        booksInCatalogSection += 1;
        const assignment: AssignedShelfBook<Book> = {
          book,
          index,
          slot,
          bayIndex: slot.sectionId,
          shelfRowIndex: slot.rowIndex,
        };
        const existing = catalogBooksById.get(book.id);
        if (existing && existing.renderSignature === catalogBookRenderSignature(book, classification)) {
          plans.push({ assignment, classification, existing });
          return;
        }
        const replacement = createBook(
          assignment,
          classification,
          loader,
          anisotropy,
          bookMaterials,
          built.shelfSections,
        );
        staged.push(replacement);
        plans.push({ assignment, classification, existing, replacement });
      });
    } catch (error) {
      staged.forEach((sceneBook) => releaseSceneBook(sceneBook, bookMaterials));
      throw error;
    }

    const nextSceneBooks: SceneBook[] = [];
    const nextInteractiveMeshes: THREE.Object3D[] = [];
    const nextIds = new Set(plans.map(({ assignment }) => assignment.book.id));
    const removedBookIds: string[] = [];
    catalogBooksById.forEach((sceneBook, id) => {
      if (nextIds.has(id)) return;
      releaseSceneBook(sceneBook, bookMaterials);
      removedBookIds.push(id);
    });

    const addedBookIds: string[] = [];
    const replacedBookIds: string[] = [];
    plans.forEach(({ assignment, classification, existing, replacement }) => {
      if (!replacement) {
        if (!existing) throw new Error(`Missing live catalog model for ${assignment.book.id}`);
        updateSceneBookAssignment(existing, assignment, classification, built.shelfSections);
        nextSceneBooks.push(existing);
        nextInteractiveMeshes.push(existing.hitTarget);
        return;
      }

      if (!existing) {
        catalogRoot.add(replacement.group);
        replacement.group.visible = activeRoom === "hall";
        nextSceneBooks.push(replacement);
        nextInteractiveMeshes.push(replacement.hitTarget);
        addedBookIds.push(assignment.book.id);
        return;
      }

      const wasInspection = existing.group.userData.bookPresentation === "inspection";
      const previousPosition = existing.group.position.clone();
      const previousQuaternion = existing.group.quaternion.clone();
      const previousScale = existing.group.scale.clone();
      const previousLayerMask = existing.group.layers.mask;
      releaseSceneBook(existing, bookMaterials);
      Object.assign(existing, replacement);
      existing.group.userData.sceneBook = existing;
      existing.group.visible = activeRoom === "hall";
      if (wasInspection) {
        existing.group.userData.bookPresentation = "inspection";
        existing.group.position.copy(previousPosition);
        existing.group.quaternion.copy(previousQuaternion);
        existing.group.scale.copy(previousScale);
        existing.group.traverse((object) => { object.layers.mask = previousLayerMask; });
      }
      catalogRoot.add(existing.group);
      nextSceneBooks.push(existing);
      nextInteractiveMeshes.push(existing.hitTarget);
      replacedBookIds.push(assignment.book.id);
    });

    sceneBooks.splice(0, sceneBooks.length, ...nextSceneBooks);
    interactiveMeshes.splice(0, interactiveMeshes.length, ...nextInteractiveMeshes);
    catalogBooksById.clear();
    sceneBooks.forEach((sceneBook) => catalogBooksById.set(sceneBook.book.id, sceneBook));
    centerSceneBookClusters(sceneBooks, built.shelfSections);
    updateShelfSectionControllers(shelfControllers, built.shelfSections, sceneBooks);
    catalogSyncRevision += 1;
    built.root.userData.catalogSyncRevision = catalogSyncRevision;
    return { addedBookIds, removedBookIds, replacedBookIds };
  };

  return {
    sceneBooks,
    interactiveMeshes,
    catalogTerminal: built.catalogTerminal,
    shelfHitMeshes: shelfControllers.map(({ hitArea }) => hitArea),
    portalHitMeshes,
    syncCatalogBooks,
    toggleShelfSection: (sectionId) => {
      sceneBooks.forEach(placeSceneBookOnShelf);
      expandedShelfSectionId = expandedShelfSectionId === sectionId ? null : sectionId;
      return expandedShelfSectionId;
    },
    collapseShelfSections: () => {
      sceneBooks.forEach(placeSceneBookOnShelf);
      expandedShelfSectionId = null;
    },
    setHoveredShelfSection: (sectionId) => {
      hoveredShelfSectionId = sectionId;
    },
    getExpandedShelfSectionId: () => expandedShelfSectionId,
    getShelfInfo: (sectionId) => (
      shelfControllers.find((controller) => controller.sectionId === sectionId)?.info ?? null
    ),
    getCameraColliders,
    setActiveRoom: (room) => {
      activeRoom = room;
      const isHall = room === "hall";
      built.root.visible = isHall;
      catalogRoot.visible = isHall;
      sceneBooks.forEach((sceneBook) => {
        sceneBook.group.visible = isHall;
      });
      shelfControllers.forEach((controller) => {
        controller.root.visible = isHall;
      });
      portalHitMeshes.forEach((hitArea) => {
        hitArea.visible = isHall;
      });
      if (!isHall) {
        const activeRooms = ensureRooms();
        activeRooms.restricted.visible = room === "restricted";
        activeRooms.director.visible = room === "director";
      } else if (rooms) {
        rooms.restricted.visible = false;
        rooms.director.visible = false;
      }
      if (!isHall) {
        expandedShelfSectionId = null;
        hoveredShelfSectionId = null;
      }
    },
    getActiveRoom: () => activeRoom,
    animateEnvironment: (elapsed) => {
      built.animateEnvironment(elapsed);
      rooms?.animate(elapsed);
      shelfControllers.forEach((controller) => {
        const isSelected = controller.sectionId === expandedShelfSectionId;
        const isHovered = controller.sectionId === hoveredShelfSectionId;
        controller.root.position.copy(controller.homePosition);
        controller.frameMaterial.opacity = THREE.MathUtils.lerp(
          controller.frameMaterial.opacity,
          isSelected ? 0.92 : isHovered ? 0.42 : 0,
          0.18,
        );
        controller.selectionFillMaterial.opacity = THREE.MathUtils.lerp(
          controller.selectionFillMaterial.opacity,
          isSelected ? 0.075 : isHovered ? 0.025 : 0,
          0.18,
        );
        controller.frameMaterial.visible = controller.frameMaterial.opacity > 0.002;
        controller.selectionFillMaterial.visible = controller.selectionFillMaterial.opacity > 0.002;
        controller.labelMaterials.forEach((labelMaterial, index) => {
          const baseOpacity = index === 0 ? 0.96 : 0.92;
          labelMaterial.opacity = THREE.MathUtils.lerp(
            labelMaterial.opacity,
            isSelected ? baseOpacity : isHovered ? 0.98 : 0,
            0.16,
          );
        });
      });
    },
  };
}

export function findSceneBook(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object;
  while (current) {
    const sceneBook = current.userData.sceneBook as SceneBook | undefined;
    if (sceneBook) return sceneBook;
    current = current.parent;
  }
  return null;
}

export function findShelfSectionId(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object;
  while (current) {
    const shelfSectionId = current.userData.shelfSectionId as number | undefined;
    if (typeof shelfSectionId === "number") return shelfSectionId;
    current = current.parent;
  }
  return null;
}

export function findPortalRoom(object: THREE.Object3D): LibraryRoomId | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const portalRoom = current.userData.portalRoom as LibraryRoomId | undefined;
    if (portalRoom === "restricted" || portalRoom === "director") return portalRoom;
    current = current.parent;
  }
  return null;
}

export function disposeScene(scene: THREE.Scene) {
  scene.userData.isDisposed = true;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    const catalogResources = object.userData.disposableCatalogResources as DisposableCatalogResources | undefined;
    catalogResources?.geometries.forEach((geometry) => geometries.add(geometry));
    catalogResources?.materials.forEach((material) => materials.add(material));
    if (object instanceof THREE.SpotLight || object instanceof THREE.DirectionalLight || object instanceof THREE.PointLight)
      object.shadow.dispose();
    if (
      !(object instanceof THREE.Mesh)
      && !(object instanceof THREE.Points)
      && !(object instanceof THREE.Line)
    ) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((entry) => materials.add(entry));
  });
  materials.forEach((entry) => {
    const textured = entry as THREE.Material & {
      map?: THREE.Texture | null;
      normalMap?: THREE.Texture | null;
      bumpMap?: THREE.Texture | null;
      roughnessMap?: THREE.Texture | null;
      metalnessMap?: THREE.Texture | null;
      alphaMap?: THREE.Texture | null;
      emissiveMap?: THREE.Texture | null;
      aoMap?: THREE.Texture | null;
    };
    for (const texture of [
      textured.map,
      textured.normalMap,
      textured.bumpMap,
      textured.roughnessMap,
      textured.metalnessMap,
      textured.alphaMap,
      textured.emissiveMap,
      textured.aoMap,
    ]) {
      if (texture) textures.add(texture);
    }
    entry.dispose();
  });
  textures.forEach((texture) => texture.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}
