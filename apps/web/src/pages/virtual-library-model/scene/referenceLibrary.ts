import * as THREE from 'three';
import { markCameraCollider, type LocalCameraColliderDescriptor } from '../../virtual-library-collision';
import { disposeScene } from '../../virtual-library-scene';
import type { ExpandableShelfSection } from './buildLibrary';
import type { LongRoomBuilt, LongRoomSlot } from './longRoom';
import type { LibraryMaterials } from './materials';
import { createReferenceLibraryStreaming, type ReferenceLibraryStreaming } from './referenceLibraryStreaming';
import { PALETTE } from '../config';
import {
  REFERENCE_LIBRARY as R, REFERENCE_BAY_BOUNDARIES, REFERENCE_BOOK_CENTER_OFFSET,
  REFERENCE_SECTION_CAPACITY, type ReferencePoint,
} from '../hogwartsLibraryLayout';

type VectorTuple = [number, number, number];
interface ReferenceLight { color: string; intensity: number }
export interface ReferenceSceneConfig {
  version: 1;
  scaleNote: string;
  dimensions: {width: number; length: number; galleryY: number; vaultCrownY: number};
  colliders: LocalCameraColliderDescriptor[];
  stairRoutes: {left: ReferencePoint[]; right: ReferencePoint[]};
  cameras: {id: string; position: VectorTuple; target: VectorTuple; fov: number}[];
  lighting: {
    exposure: number;
    hemisphere: {sky: string; ground: string; intensity: number};
    ambient: ReferenceLight;
    directional: (ReferenceLight & {position: VectorTuple; target: VectorTuple})[];
    points: (ReferenceLight & {position: VectorTuple; distance: number})[];
  };
  omissions: string[];
}

export interface ReferenceLibraryBuilt extends LongRoomBuilt {
  referenceConfig: ReferenceSceneConfig;
  streaming: ReferenceLibraryStreaming;
  disposeArchitecture: () => Promise<void>;
}

/** Keep explicit architectural section identities separate from book IDs. */
export function createReferenceCatalogAnchors() {
  const shelfSections: ExpandableShelfSection[] = [];
  const catalogSlots: LongRoomSlot[] = [];
  // Put accessible ground-floor bays before upper gallery cases in allocation.
  for (const level of [0, 1]) for (const side of [-1, 1]) {
    for (const [bay, z] of REFERENCE_BAY_BOUNDARIES.entries()) for (const face of [1, -1] as const) {
      const inner = level === 0 ? R.lowerCaseInnerX : R.upperCaseInnerX;
      const outer = level === 0 ? R.caseOuterX : R.upperCaseOuterX;
      const width = outer - inner;
      const centerX = side * (inner + width / 2);
      const id = shelfSections.length;
      const baseY = level === 0 ? 0 : R.galleryY;
      const height = level === 0 ? R.lowerCaseHeight : R.upperCaseHeight;
      const slotPrefix = `gallery-${level === 0 ? 'ground' : 'upper'}-${side < 0 ? 'west' : 'east'}-${bay}-${face}`;
      const section: ExpandableShelfSection = {
        id, centerX, centerZ: z, angle: -face * Math.PI / 2,
        radius: Math.hypot(centerX, z), width, height, baseY, depth: R.caseDepth,
        shelfCount: R.shelfRows, frontOffset: R.shelfFrontOffset,
        bookCenterOffset: REFERENCE_BOOK_CENTER_OFFSET,
        plaquePlacement: 'shelf-front', plaqueFrontOffset: R.categoryPlaqueFrontOffset, slotPrefix,
      };
      shelfSections.push(section);
      for (let index = 0; index < REFERENCE_SECTION_CAPACITY; index++) {
        const row = Math.floor(index / R.booksPerRow);
        const boardY = (level === 0 ? R.lowerShelfBase : R.upperShelfBase)
          + row * (level === 0 ? R.lowerShelfPitch : R.upperShelfPitch);
        const slot: LongRoomSlot = {
          slotId: `${slotPrefix}-r${row}-s${index % R.booksPerRow}`,
          sectionId: id, catalogSectionIndex: id, rowIndex: row,
          position: new THREE.Vector3(centerX,
            boardY + R.shelfBoardThickness / 2 + R.book.height / 2,
            z + face * REFERENCE_BOOK_CENTER_OFFSET),
          scale: new THREE.Vector3(R.book.spineWidth, R.book.height, R.book.coverWidth),
          rotationY: 0, lean: 0, spineFace: face,
        };
        catalogSlots.push(slot);
      }
    }
  }
  return {shelfSections, catalogSlots};
}

/** The catalog cases contain boards and books in front of their thin back panel.
 * Keep the full occupied cabinet core solid, without widening either aisle. */
export function referenceCameraColliderDescriptors(config: ReferenceSceneConfig) {
  return config.colliders.map(collider => collider.shape === 'box' && collider.id.startsWith('case-back-')
    ? {...collider, size: {...collider.size, z: Math.max(collider.size.z, R.shelfFrontOffset * 2)}}
    : collider);
}

/** Reject malformed generated config rather than installing broken collision. */
export function validateReferenceConfig(value: unknown): asserts value is ReferenceSceneConfig {
  if (!value || typeof value !== 'object') throw new Error('建筑配置不可读取');
  const config = value as ReferenceSceneConfig;
  if (config.version !== 1 || !Array.isArray(config.colliders) || !config.colliders.length
    || !config.stairRoutes || !config.lighting || !Array.isArray(config.cameras)) {
    throw new Error('建筑配置版本或结构无效');
  }
  if (!config.dimensions || config.dimensions.width !== R.width || config.dimensions.length !== R.length
    || config.dimensions.galleryY !== R.galleryY || config.dimensions.vaultCrownY !== R.height) {
    throw new Error('建筑尺寸配置尚未同步，请重新加载场景');
  }
  const ids = new Set<string>();
  const finitePoint = (point: ReferencePoint) => point && [point.x, point.y, point.z].every(Number.isFinite);
  for (const collider of config.colliders) {
    if (!collider || !collider.id || ids.has(collider.id) || !finitePoint(collider.center)) {
      throw new Error('建筑碰撞体标识或坐标无效');
    }
    ids.add(collider.id);
    if (collider.shape === 'box') {
      if (!finitePoint(collider.size) || Object.values(collider.size).some(n => n <= 0)) throw new Error('建筑碰撞体尺寸无效');
    } else if (collider.shape === 'cylinder') {
      if (![collider.radius, collider.height].every(n => Number.isFinite(n) && n > 0)) throw new Error('建筑碰撞体尺寸无效');
    } else if (collider.shape === 'arc') {
      if (![collider.radius, collider.height, collider.radialDepth].every(n => Number.isFinite(n) && n > 0)
        || ![collider.startAngle, collider.endAngle].every(Number.isFinite)) throw new Error('楼梯护栏尺寸无效');
    } else throw new Error('不支持的建筑碰撞体');
  }
  for (const route of [config.stairRoutes.left, config.stairRoutes.right]) {
    if (!Array.isArray(route) || route.length < 2 || !route.every(finitePoint)) throw new Error('楼梯路径无效');
  }
  if (!Number.isFinite(config.lighting.exposure) || config.lighting.exposure <= 0) throw new Error('建筑曝光配置无效');
}

function createReferenceMaterials(): LibraryMaterials {
  const make = (color: THREE.ColorRepresentation, metalness = 0) => new THREE.MeshStandardMaterial({color, metalness, roughness: 0.68});
  return {
    wood: make(PALETTE.oak), woodDark: make(PALETTE.oakEdge), woodWarm: make(PALETTE.oakWarm),
    stone: make(PALETTE.stone), stoneDark: make(PALETTE.stoneDark), floor: make(PALETTE.stone),
    rug: make(PALETTE.oakEdge), brass: make(PALETTE.brass, 0.7), iron: make(PALETTE.stoneDark, 0.65),
    leather: make(PALETTE.oakEdge), parchment: make(PALETTE.parchment), glass: make(PALETTE.glassBlue),
    lampGlass: make(PALETTE.glassBlue),
  };
}

export function addReferenceLighting(root: THREE.Group, config: ReferenceSceneConfig) {
  const {hemisphere, ambient, directional, points} = config.lighting;
  root.add(new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity));
  root.add(new THREE.AmbientLight(ambient.color, ambient.intensity));
  directional.forEach((entry, index) => {
    const light = new THREE.DirectionalLight(entry.color, entry.intensity);
    light.position.set(...entry.position); light.target.position.set(...entry.target);
    // One bounded shadow map; dense decorative lights are emissive geometry.
    light.castShadow = index === 0;
    if (light.castShadow) {
      light.shadow.mapSize.set(2048, 2048);
      Object.assign(light.shadow.camera, {left: -20, right: 20, top: 22, bottom: -22, near: 0.2, far: 70});
      light.shadow.normalBias = 0.035;
    }
    root.add(light, light.target);
  });
  points.forEach(entry => {
    const light = new THREE.PointLight(entry.color, entry.intensity, entry.distance, 2);
    light.position.set(...entry.position); root.add(light);
  });
}

export async function buildReferenceLibraryProgressively(
  loader: THREE.TextureLoader,
  signal: AbortSignal,
  onSlice: (milliseconds: number, stage: string) => void,
  options: {multiDraw?: boolean; onChange?: () => void; onError?: (error: Error) => void} = {},
): Promise<ReferenceLibraryBuilt> {
  signal.throwIfAborted();
  const configResponse = await fetch(R.configUrl, {signal});
  if (!configResponse.ok) throw new Error('建筑配置加载失败');
  const config: unknown = await configResponse.json();
  validateReferenceConfig(config);
  const root = new THREE.Group();
  root.name = 'Reference two-storey modular library';
  root.userData.streamingArchitecture = true;
  root.userData.staticOptimization = {managedBy: 'reference-library-streaming', sourceMeshes: 0, batchMeshes: 0, untouchedMeshes: 0};
  const architecture = new THREE.Group();
  architecture.name = 'Streamed architecture with scene-owned shared materials';
  root.add(architecture);
  let streaming: ReferenceLibraryStreaming | undefined;
  try {
    for (const collider of referenceCameraColliderDescriptors(config)) markCameraCollider(root, collider);
    const materials = createReferenceMaterials();
    root.userData.disposableCatalogResources = {geometries: [], materials: Object.values(materials)};
    const catalogTerminal = new THREE.Group();
    root.add(catalogTerminal);
    const anchors = createReferenceCatalogAnchors();
    root.userData.referenceScaleNote = config.scaleNote;
    root.userData.referenceCameraCount = config.cameras.length;
    addReferenceLighting(root, config);
    streaming = await createReferenceLibraryStreaming({parent: architecture, manager: loader.manager,
      signal, multiDraw: options.multiDraw ?? false, onSlice,
      onChange: options.onChange, onError: options.onError});
    signal.throwIfAborted();
    const ownedStreaming = streaming;
    return {root, materials, ...anchors, catalogTerminal, interactiveObjects: [],
      animateEnvironment: () => undefined, referenceConfig: config, streaming,
      disposeArchitecture: () => {
        // The controller owns architectural shading resources. Detach immediately
        // so generic scene disposal cannot destroy them before requests settle.
        architecture.removeFromParent();
        return ownedStreaming.dispose();
      }};
  } catch (error) {
    architecture.removeFromParent();
    await streaming?.dispose();
    const disposal = new THREE.Scene(); disposal.add(root); disposeScene(disposal);
    throw error;
  }
}
