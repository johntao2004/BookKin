import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Book } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import {
  classifyCatalogBook,
  defaultCategoryForShelf,
  sortCatalogBooksByClassification,
  type CatalogClassification,
  type LibraryCategory,
} from "./virtual-library-catalog";
import {
  collectCameraColliders,
  HALL_COLUMN_COLLIDERS,
  type CameraCollider,
} from "./virtual-library-collision";
import { LIBRARY } from "./virtual-library-model/config";
import {
  buildLibraryScene,
  getShelfFrontPlacement,
  type ExpandableShelfSection,
} from "./virtual-library-model/scene/buildLibrary";
import { optimizeStaticMeshes } from "./virtual-library-model/scene/optimizeScene";
import type { BookShelfSlot } from "./virtual-library-model/scene/parts";
import {
  createVirtualLibraryRooms,
  type LibraryRoomId,
} from "./virtual-library-rooms";

export const ROTUNDA_CENTER = new THREE.Vector3(0, 5.4, 0);
export const ROTUNDA_CAMERA_RADIUS = 11.7;
export const VIRTUAL_LIBRARY_SCENE_MODEL_VERSION = "gothic-gate-stained-glass-office-reader-entry-2026-08-27";

export const SHELF_PLAQUE_MOUNT = {
  gap: 0.012,
  backingDepth: 0.026,
  textureFaceOffset: 0.002,
} as const;

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
const BOOK_HEIGHT_BASE = 1.18;
const BOOK_HEIGHT_STEP = 0.027;
const OUTER_SHELF_MIN_RADIUS = LIBRARY.tower.innerRadius - 2;
const LOWER_SHELF_MAX_Y = LIBRARY.tower.galleryY - 0.05;

export const BOOK_INSPECTION_LAYOUT = {
  mobileBreakpoint: 720,
  desktopHeight: 2.15,
  mobileHeight: 1.55,
  forwardOffset: 1.25,
  desktopSideOffset: 1.25,
  mobileVerticalOffset: 1.7,
  minimumZoom: 0.78,
  maximumZoom: 1.38,
} as const;

export const SHELF_BOOK_CLUSTER_GAP = 0.035;

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
  tokens.color.primitive.coral600,
  tokens.color.primitive.teal500,
  tokens.color.primitive.amber600,
  tokens.color.primitive.green600,
  tokens.color.primitive.coral700,
  tokens.color.primitive.ink500,
];

export interface SceneBook {
  book: Book;
  classification: CatalogClassification;
  group: THREE.Group;
  shelfPosition: THREE.Vector3;
  shelfRotation: THREE.Euler;
  shelfScale: THREE.Vector3;
  modelSize: ShelfBookModelSize;
  shelfSectionId: number;
  shelfRowIndex: number;
}

export interface ShelfBookModelSize {
  width: number;
  height: number;
  depth: number;
}

export interface ShelfCategoryInfo {
  sectionId: number;
  angle: number;
  radius: number;
  depth: number;
  targetY: number;
  category: LibraryCategory;
  bookCount: number;
}

export interface LibraryWorld {
  sceneBooks: SceneBook[];
  interactiveMeshes: THREE.Object3D[];
  shelfHitMeshes: THREE.Object3D[];
  portalHitMeshes: THREE.Object3D[];
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

interface ShelfSectionController {
  sectionId: number;
  root: THREE.Group;
  hitArea: THREE.Mesh;
  frameMaterial: THREE.MeshBasicMaterial;
  selectionFillMaterial: THREE.MeshBasicMaterial;
  labelMaterials: THREE.MeshBasicMaterial[];
  info: ShelfCategoryInfo;
  homePosition: THREE.Vector3;
}

interface BookMaterials {
  pages: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  spines: THREE.MeshStandardMaterial[];
  covers: Map<string, THREE.MeshStandardMaterial>;
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

function createBookMaterials(): BookMaterials {
  return {
    pages: material(tokens.color.primitive.cream100, { roughness: 0.94 }),
    gold: material(tokens.color.primitive.amber600, { roughness: 0.38, metalness: 0.72 }),
    spines: BOOK_COLORS.map((color) => material(color, { roughness: 0.78, metalness: 0.02 })),
    covers: new Map<string, THREE.MeshStandardMaterial>(),
  };
}

function getCoverMaterial(
  book: Book,
  loader: THREE.TextureLoader,
  anisotropy: number,
  bookMaterials: BookMaterials,
) {
  const existing = bookMaterials.covers.get(book.coverUrl);
  if (existing) return existing;
  const texture = loader.load(book.coverUrl, undefined, undefined, () => undefined);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  const cover = material(tokens.color.primitive.ink300, {
    map: texture,
    roughness: 0.82,
    metalness: 0.01,
  });
  bookMaterials.covers.set(book.coverUrl, cover);
  return cover;
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

export interface BookInspectionTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

export function getBookInspectionTransform(
  modelSize: ShelfBookModelSize,
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
  const cameraDirection = cameraPosition.clone().sub(cameraTarget).normalize();
  target.position.copy(cameraTarget).addScaledVector(
    cameraDirection,
    BOOK_INSPECTION_LAYOUT.forwardOffset,
  );
  if (viewportWidth <= BOOK_INSPECTION_LAYOUT.mobileBreakpoint) {
    target.position.y += BOOK_INSPECTION_LAYOUT.mobileVerticalOffset;
  } else {
    const cameraRight = new THREE.Vector3(0, 1, 0)
      .cross(cameraDirection)
      .normalize();
    target.position.addScaledVector(cameraRight, -BOOK_INSPECTION_LAYOUT.desktopSideOffset);
  }
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
  const displayHeight = viewportWidth <= BOOK_INSPECTION_LAYOUT.mobileBreakpoint
    ? BOOK_INSPECTION_LAYOUT.mobileHeight
    : BOOK_INSPECTION_LAYOUT.desktopHeight;
  target.scale.setScalar((displayHeight / modelSize.height) * clampedZoom);
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

function createBook(
  assignment: AssignedShelfBook<Book>,
  classification: CatalogClassification,
  loader: THREE.TextureLoader,
  anisotropy: number,
  bookMaterials: BookMaterials,
  shelfSections: ExpandableShelfSection[],
) {
  const { book, index, slot } = assignment;
  const width = 0.82 + (index % 5) * 0.055;
  const height = BOOK_HEIGHT_BASE + (index % 7) * BOOK_HEIGHT_STEP;
  const depth = 0.27 + (index % 4) * 0.025;
  const spineMaterial = bookMaterials.spines[index % bookMaterials.spines.length];
  const coverMaterial = getCoverMaterial(book, loader, anisotropy, bookMaterials);
  const group = new THREE.Group();

  roundedBox(group, [width * 0.93, height * 0.93, depth * 0.78], [0.025, 0, 0], bookMaterials.pages, {
    radius: 0.035,
    segments: 4,
  });
  roundedBox(group, [width, height, 0.035], [0, 0, depth / 2], coverMaterial, { radius: 0.025, segments: 4 });
  roundedBox(group, [width, height, 0.035], [0, 0, -depth / 2], spineMaterial, { radius: 0.025, segments: 4 });
  roundedBox(group, [0.052, height, depth], [-width / 2, 0, 0], spineMaterial, { radius: 0.018, segments: 3 });

  for (const y of [-height * 0.34, height * 0.34]) {
    roundedBox(group, [0.026, 0.026, depth * 0.86], [-width / 2 - 0.024, y, 0], bookMaterials.gold, {
      radius: 0.008,
      segments: 2,
      castShadow: false,
    });
  }
  roundedBox(group, [0.028, height * 0.18, depth * 0.78], [-width / 2 - 0.026, 0.02, 0], bookMaterials.gold, {
    radius: 0.008,
    segments: 2,
    castShadow: false,
  });

  const shelfTransform = getShelvedBookTransform(slot, { width, height, depth });
  const shelfPosition = shelfTransform.position;
  const shelfRotation = shelfTransform.rotation;
  const shelfScale = shelfTransform.scale;
  const shelfSectionId = nearestShelfSection(shelfPosition, shelfSections)?.id
    ?? assignment.bayIndex;
  group.userData.bookId = book.id;
  group.userData.isVirtualBook = true;
  group.userData.shelfBayIndex = assignment.bayIndex;
  group.userData.shelfSectionId = shelfSectionId;
  group.userData.shelfRowIndex = assignment.shelfRowIndex;

  const sceneBook: SceneBook = {
    book,
    classification,
    group,
    shelfPosition,
    shelfRotation,
    shelfScale,
    modelSize: { width, height, depth },
    shelfSectionId,
    shelfRowIndex: assignment.shelfRowIndex,
  };
  placeSceneBookOnShelf(sceneBook);
  group.userData.sceneBook = sceneBook;
  return sceneBook;
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
    const widths = cluster.map((sceneBook) => (
      sceneBook.modelSize.depth * sceneBook.shelfScale.z
    ));
    const offsets = getCenteredShelfBookOffsets(widths);
    cluster.forEach((sceneBook, index) => {
      const radius = Math.hypot(sceneBook.shelfPosition.x, sceneBook.shelfPosition.z);
      const offset = offsets[index] ?? 0;
      sceneBook.shelfPosition.set(
        Math.cos(section.angle) * radius + tangentX * offset,
        sceneBook.shelfPosition.y,
        Math.sin(section.angle) * radius + tangentZ * offset,
      );
      placeSceneBookOnShelf(sceneBook);
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
    angle: section.angle,
    radius: section.radius,
    depth: section.depth,
    targetY: section.baseY + section.height / 2,
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
      Math.cos(section.angle) * section.radius,
      section.baseY + section.height / 2,
      Math.sin(section.angle) * section.radius,
    );
    root.position.copy(homePosition);
    root.rotation.y = Math.PI / 2 - section.angle;

    const hitMaterial = new THREE.MeshBasicMaterial({
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
      color: tokens.color.primitive.amber600,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const frameZ = -section.depth / 2 - 0.24;
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
    });
    scene.add(root);
    return {
      sectionId: section.id,
      root,
      hitArea,
      frameMaterial,
      selectionFillMaterial,
      labelMaterials,
      info,
      homePosition,
    };
  });
}

function createPortalHitMeshes(scene: THREE.Scene) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
    side: THREE.DoubleSide,
  });
  return ([
    { room: "restricted", angle: Math.PI, name: "Restricted archive doorway hit area" },
    { room: "director", angle: 0, name: "Director office doorway hit area" },
  ] as const).map(({ room, angle, name }) => {
    const hitArea = new THREE.Mesh(new THREE.BoxGeometry(3.8, 5.15, 0.92), material);
    const radius = LIBRARY.tower.innerRadius - 1.1;
    hitArea.position.set(Math.cos(angle) * radius, 2.62, Math.sin(angle) * radius);
    hitArea.rotation.y = Math.PI / 2 - angle;
    hitArea.name = name;
    hitArea.userData.portalRoom = room;
    scene.add(hitArea);
    return hitArea;
  });
}

export function createVirtualLibraryWorld(
  scene: THREE.Scene,
  books: Book[],
  loader: THREE.TextureLoader,
  anisotropy: number,
): LibraryWorld {
  const built = buildLibraryScene();
  optimizeStaticMeshes(built.root, built.interactiveObjects);
  built.root.userData.modelVersion = VIRTUAL_LIBRARY_SCENE_MODEL_VERSION;
  const hallCameraColliders = [
    ...collectCameraColliders(built.root, "hall"),
    ...HALL_COLUMN_COLLIDERS,
  ];
  scene.add(built.root);

  const bookMaterials = createBookMaterials();
  const sceneBooks: SceneBook[] = [];
  const interactiveMeshes: THREE.Object3D[] = [];
  const sortedBooks = sortCatalogBooksByClassification(books);
  const classifications = new Map(
    sortedBooks.map(({ book, classification }) => [book.id, classification]),
  );
  const assignments = assignBooksToShelfSlots(
    sortedBooks.map(({ book }) => book),
    built.bookSlots,
  );
  assignments.forEach((assignment) => {
    const sceneBook = createBook(
      assignment,
      classifications.get(assignment.book.id)
        ?? classifyCatalogBook(assignment.book),
      loader,
      anisotropy,
      bookMaterials,
      built.shelfSections,
    );
    scene.add(sceneBook.group);
    sceneBooks.push(sceneBook);
    sceneBook.group.traverse((object) => {
      if (object instanceof THREE.Mesh) interactiveMeshes.push(object);
    });
  });
  centerSceneBookClusters(sceneBooks, built.shelfSections);
  const shelfControllers = createShelfSectionControllers(
    scene,
    built.shelfSections,
    sceneBooks,
    built.materials.woodDark,
  );
  const portalHitMeshes = createPortalHitMeshes(scene);
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

  return {
    sceneBooks,
    interactiveMeshes,
    shelfHitMeshes: shelfControllers.map(({ hitArea }) => hitArea),
    portalHitMeshes,
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
          isSelected ? 0.92 : isHovered ? 0.42 : 0.055,
          0.18,
        );
        controller.selectionFillMaterial.opacity = THREE.MathUtils.lerp(
          controller.selectionFillMaterial.opacity,
          isSelected ? 0.075 : isHovered ? 0.025 : 0,
          0.18,
        );
        controller.labelMaterials.forEach((labelMaterial, index) => {
          const baseOpacity = index === 0 ? 0.96 : 0.92;
          labelMaterial.opacity = THREE.MathUtils.lerp(
            labelMaterial.opacity,
            isSelected ? 1 : isHovered ? 0.98 : baseOpacity,
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
      roughnessMap?: THREE.Texture | null;
      metalnessMap?: THREE.Texture | null;
      alphaMap?: THREE.Texture | null;
      emissiveMap?: THREE.Texture | null;
      aoMap?: THREE.Texture | null;
    };
    for (const texture of [
      textured.map,
      textured.normalMap,
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
