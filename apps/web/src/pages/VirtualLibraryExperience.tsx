import { EmptyState } from "../ui/empty-state";
import { ArrowBackRounded } from "@/ui/icons";
import { KeyboardReturnRounded } from "@/ui/icons";
import { Button, RefreshButton } from "@/ui/buttons";
import { CircularProgress } from "@/ui/feedback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  getReferenceStairExitView,
  readReferenceReaderState,
  type ReferenceCameraPose,
} from './reference-library-view';
import { getReferenceShelfFrame, getReferenceShelfFocusFov } from './reference-library-focus';
import { tokens } from "../theme/generated-tokens";
import { EMPTY_CATALOG_TITLE } from "../ui/empty-state-copy";
import type { Book } from "../domain/types";
import { resolveCameraCollision } from "./virtual-library-collision";
import { createVirtualLibraryTextureLoader } from "./virtual-library-texture-loader";
import {
  cameraRelativeWalkDelta,
  resolveGuidedStairCollision,
  resolveReferenceWalkingCollision,
  isGuidedStairSupport,
  WALKING_EYE_HEIGHT,
  WALKING_CAMERA_CLEARANCE,
  clampVirtualLibraryFlightHeight,
  isShelfMovementLocked,
  virtualLibraryMovementKey,
  virtualLibraryVerticalFlightDelta,
  VIRTUAL_LIBRARY_KEYBOARD_FLIGHT_SPEED,
  VIRTUAL_LIBRARY_KEYBOARD_WALK_SPEED,
  type VirtualLibraryMovementKey,
} from "./virtual-library-navigation";
import { isFocusedShelfTarget, shouldOpenInspectedBook } from "./virtual-library-interaction";
import { isSceneObjectVisible, isUnoccludedSceneHit } from './virtual-library-picking';
import {
  BOOK_INSPECTION_LAYOUT,
  createVirtualLibraryWorld,
  disposeScene,
  findSceneBook,
  findPortalRoom,
  findShelfSectionId,
  getBookInspectionTransform,
  placeSceneBookOnShelf,
  setSceneBookRenderLayer,
  VIRTUAL_LIBRARY_BOOK_PREVIEW_LAYER,
  VIRTUAL_LIBRARY_SCENE_MODEL_VERSION,
  VIRTUAL_LIBRARY_WORLD_LAYER,
  type SceneBook,
  type ShelfCategoryInfo,
} from "./virtual-library-scene";
import { REFERENCE_LIBRARY as ACTIVE_HALL, referenceLibraryRoofY, referenceRouteLength, referenceRoutePoint, type ReferencePoint } from "./virtual-library-model/hogwartsLibraryLayout";
import { buildReferenceLibraryProgressively } from "./virtual-library-model/scene/referenceLibrary";
import { LIBRARY } from "./virtual-library-model/config";
import {
  refreshVirtualLibraryBooks,
  VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
  VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
  VIRTUAL_LIBRARY_BOOKS_REFRESH_INTERVAL,
} from "./virtual-library-query";
import {
  LIBRARY_ROOM_CAMERA_VIEW,
  type LibraryRoomId,
} from "./virtual-library-rooms";
import "./virtual-library.css";
import { VirtualLibrarySearch } from "./VirtualLibrarySearch";

import { createDeferredSceneAction } from "./virtual-library-deferred-action";

type ViewPreset = "front" | "free";
type PointerMode = "inspect" | "orbit" | "portal" | "select" | "shelf" | "terminal" | null;

const MIN_SCENE_ZOOM = 0.72;
const MAX_SCENE_ZOOM = 1.55;
const SCENE_ZOOM_STEP = 0.12;
const BOOK_INSPECTION_ZOOM_STEP = 0.1;
const HALL_FLIGHT_CEILING_CLEARANCE = 0.4;
const ROTUNDA_CENTER = new THREE.Vector3(0, ACTIVE_HALL.camera.targetY, ACTIVE_HALL.camera.targetZ);
const ROTUNDA_CAMERA_RADIUS = ACTIVE_HALL.camera.radius;
const MOBILE_ROTUNDA_CENTER_Y = ROTUNDA_CENTER.y * 0.64;
const TABLET_ROTUNDA_CENTER_Y = ROTUNDA_CENTER.y * 0.87;
const VIRTUAL_LIBRARY_PIXEL_RATIO_CEILING = 1.5;
const VIRTUAL_LIBRARY_RENDER_PIXEL_BUDGET =
  tokens.layout.wideScreenReferenceWidth * tokens.layout.breakpointDesktop * 3;
const VIEWPORT_BOUND_PAGE_STYLE = {
  height: "calc(100dvh - var(--layout-nav-height))",
  minHeight: "calc(100dvh - var(--layout-nav-height))",
} as const;
const VIEWPORT_BOUND_CONTROLS_STYLE = {
  maxHeight: "calc(100dvh - var(--layout-nav-height) - var(--layout-touch-target) - var(--spacing-6))",
  overflowY: "auto",
  overscrollBehavior: "contain",
} as const;

export function virtualLibraryUsesCompactViewport(width: number, height: number) {
  return width < tokens.layout.breakpointMobile
    || (width > height && height < tokens.layout.breakpointMobile);
}

export function virtualLibraryBookPreviewViewportWidth(width: number, height: number) {
  return virtualLibraryUsesCompactViewport(width, height)
    ? Math.min(width, BOOK_INSPECTION_LAYOUT.mobileBreakpoint)
    : width;
}

// 整书架需要较宽视角时，仍保持紧凑预览的可读性。
/** Keep compact previews readable even when a whole bookcase needs a wide FOV. */
export function virtualLibraryCompactPreviewMultiplier({
  width, height, bookWidth, bookHeight, depth, fov, zoom,
}: { width: number; height: number; bookWidth: number; bookHeight: number; depth: number; fov: number; zoom: number }) {
  if (bookWidth <= 0 || bookHeight <= 0 || width <= 0 || height <= 0 || depth <= 0) return 1;
  const viewportFraction = Math.min(1 / 3, width * bookHeight / (height * bookWidth * 3));
  const visibleWorldHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  return visibleWorldHeight * viewportFraction * zoom / bookHeight;
}

export function virtualLibraryDevicePixelRatio(
  devicePixelRatio: number,
  width: number,
  height: number,
) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const requested = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;
  const budgetRatio = Math.sqrt(VIRTUAL_LIBRARY_RENDER_PIXEL_BUDGET / (safeWidth * safeHeight));
  return Math.max(
    0.5,
    Math.min(requested, VIRTUAL_LIBRARY_PIXEL_RATIO_CEILING, budgetRatio),
  );
}

export function virtualLibraryPinchZoom(
  startZoom: number,
  startDistance: number,
  distance: number,
  minimum: number,
  maximum: number,
) {
  if (!Number.isFinite(startZoom) || !Number.isFinite(startDistance)
    || !Number.isFinite(distance) || startDistance <= 0 || distance <= 0) {
    return THREE.MathUtils.clamp(startZoom, minimum, maximum);
  }
  return THREE.MathUtils.clamp(startZoom * (distance / startDistance), minimum, maximum);
}

function clampHallFlightHeight(x: number, z: number, desiredHeight: number) {
  return clampVirtualLibraryFlightHeight(
    desiredHeight,
    WALKING_EYE_HEIGHT,
    referenceLibraryRoofY(x, z) - HALL_FLIGHT_CEILING_CLEARANCE,
  );
}

interface PointerState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  pointerId: number;
  book: SceneBook | null;
  shelfSectionId: number | null;
  portalRoom: LibraryRoomId | null;
  mode: PointerMode;
}

const ROOM_DETAILS: Record<Exclude<LibraryRoomId, "hall">, { title: string; label: string; description: string }> = {
  restricted: {
    title: "禁书档案室",
    label: "独立封存空间",
    description: "铁栅档案柜、封存链与中央查阅台共同组成受控专藏空间。",
  },
  director: {
    title: "馆长办公室",
    label: "馆务研究空间",
    description: "馆务书桌、档案柜、月窗与公共领域名画组成安静的馆长工作室。",
  },
};

export function VirtualLibraryExperience() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredView = useRef(readReferenceReaderState(location.state)?.libraryView ?? null);
  const cameraPose = useRef<ReferenceCameraPose | null>(null);
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneHostRef = useRef<HTMLDivElement | null>(null);
  const selectedBookTitleRef = useRef<HTMLDivElement | null>(null);
  const selectedBookIdRef = useRef<string | null>(null);
  const sceneZoomRef = useRef(1);
  const expandedShelfSectionIdRef = useRef<number | null>(null);
  const activeRoomRef = useRef<LibraryRoomId>("hall");
  const cameraYawTargetRef = useRef(0);
  const cameraPitchTargetRef = useRef<number>(ACTIVE_HALL.camera.pitch);
  const cameraTargetYRef = useRef(ROTUNDA_CENTER.y);
  const cameraTargetXZRef = useRef({ x: ROTUNDA_CENTER.x, z: ROTUNDA_CENTER.z });
  const roomNavigationRef = useRef<(room: LibraryRoomId) => void>(() => undefined);
  const readerNavigationRef = useRef<(bookId: string) => void>(() => undefined);
  const stairAccessRef = useRef<(side: "left" | "right") => void>(() => undefined);
  const [stairWalking, setStairWalking] = useState(false);
  const walkRef = useRef<(direction: number) => void>(() => undefined);
  const [categoryNavigation] = useState(() => createDeferredSceneAction<string>());
  const [bookNavigation] = useState(() => createDeferredSceneAction<string>());
  const catalogShelfRef = useRef<() => void>(() => undefined);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [sceneZoom, setSceneZoom] = useState(1);
  const [expandedShelfSectionId, setExpandedShelfSectionId] = useState<number | null>(null);
  const shelfMovementLocked = isShelfMovementLocked(expandedShelfSectionId);
  const [selectedShelfInfo, setSelectedShelfInfo] = useState<ShelfCategoryInfo | null>(null);
  const [activeRoom, setActiveRoom] = useState<LibraryRoomId>("hall");
  const [viewPreset, setViewPreset] = useState<ViewPreset>("front");
  const [searchOpen, setSearchOpen] = useState(false);
  const [walkHelpVisible, setWalkHelpVisible] = useState(true);
  const searchOpenRef = useRef(false);
  searchOpenRef.current = searchOpen;
  const [sceneError, setSceneError] = useState(false);
  const [sceneErrorMessage, setSceneErrorMessage] = useState("当前浏览器无法加载 3D 场景，请启用硬件加速后重试。");
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const [architectureError, setArchitectureError] = useState<string | null>(null);
  const [architectureProgress, setArchitectureProgress] = useState<string | null>(null);
  const [spatialLoading, setSpatialLoading] = useState(false);
  const architectureRetryRef = useRef<() => void>(() => undefined);
  const [catalogSyncError, setCatalogSyncError] = useState<string | null>(null);
  const [sceneLoading, setSceneLoading] = useState(true);
  const staticSceneBuildCountRef = useRef(0);
  const catalogBooksRef = useRef<readonly Book[]>([]);
  const catalogSyncRef = useRef<(books: readonly Book[]) => void>(() => undefined);
  const booksQuery = useQuery({
    queryKey: VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
    queryFn: ({ signal }) => refreshVirtualLibraryBooks(queryClient, signal),
    staleTime: VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
    refetchInterval: VIRTUAL_LIBRARY_BOOKS_REFRESH_INTERVAL,
    refetchOnMount: "always",
  });
  const books = useMemo(() => booksQuery.data?.pages.flatMap(page => page.items) ?? [], [booksQuery.data]);
  catalogBooksRef.current = books;
  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId],
  );
  readerNavigationRef.current = (bookId) => {
    navigate(`/reader/${encodeURIComponent(bookId)}`, {state: {returnTo: '/virtual-library', libraryView: cameraPose.current}});
  };

  useEffect(() => {
    if (selectedBookId && !selectedBook) setSelectedBookId(null);
    selectedBookIdRef.current = selectedBook?.id ?? null;
  }, [selectedBook, selectedBookId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = sceneHostRef.current;
    if (!canvas || !host) return undefined;
    let cleanupScene: (() => void) | undefined;
    let releaseDetachedContext: (() => void) | undefined;
    let disposed = false;
    const construction = new AbortController();
    catalogSyncRef.current = () => undefined;
    const detachSceneActions = () => {
      categoryNavigation.detach();
      bookNavigation.detach();
      roomNavigationRef.current = () => undefined;
      stairAccessRef.current = () => undefined;
      walkRef.current = () => undefined;
      catalogShelfRef.current = () => undefined;
      catalogSyncRef.current = () => undefined;
      architectureRetryRef.current = () => undefined;
    };

    const initializeScene = async (): Promise<(() => void) | undefined> => {
      if (construction.signal.aborted) return undefined;
      if (typeof WebGLRenderingContext === "undefined" && typeof WebGL2RenderingContext === "undefined") {
        setSceneError(true);
        return undefined;
      }

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        });
      } catch {
        setSceneError(true);
        return undefined;
      }

      // 重试及严格模式复用画布；Retries and StrictMode reuse the connected canvas.
      releaseDetachedContext = () => queueMicrotask(() => {
        if (!canvas.isConnected) renderer.forceContextLoss();
      });
      setSceneError(false);
      setStairWalking(false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = LIBRARY.atmosphere.exposure;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      // 静态建筑和灯光的阴影图可在仅相机移动时复用。
      // Architecture and lights are static. Camera-only navigation reuses the map.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      renderer.info.autoReset = false;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(tokens.color.primitive.ink900);
      scene.fog = new THREE.FogExp2(tokens.color.primitive.ink900, 0.0025);
      const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 120);
      let renderUntil = performance.now() + 1800;
      const invalidateScene = () => {
        if (!disposed && !construction.signal.aborted) renderUntil = performance.now() + 1800;
      };
      const invalidateShadows = () => { renderer.shadowMap.needsUpdate = true; invalidateScene(); };
      let architectureSignature = '';
      let revealDeferredBooks = () => undefined;
      let shadowUpdateCount = 0;
      const loadingManager = new THREE.LoadingManager(invalidateScene, invalidateScene, invalidateScene);
      const cameraTarget = ROTUNDA_CENTER.clone();
      let cameraBaseRadius: number = ROTUNDA_CAMERA_RADIUS;
      let cameraRadiusCurrent = ROTUNDA_CAMERA_RADIUS / sceneZoomRef.current;
      let cameraFovTarget = 58;
      let cameraYawCurrent = cameraYawTargetRef.current;
      let cameraPitchCurrent = cameraPitchTargetRef.current;
      let cameraTargetYBase = ROTUNDA_CENTER.y;
      let cameraTargetYCurrent = cameraTargetYRef.current;
      let cameraTargetXCurrent = cameraTargetXZRef.current.x;
      let cameraTargetZCurrent = cameraTargetXZRef.current.z;
      let viewportWidth = host.clientWidth || window.innerWidth;
      let viewportHeight = host.clientHeight || window.innerHeight;
      let hasPositionedCamera = false;
      let previousCameraRoom = activeRoomRef.current;
      let rendererPixelRatio = 0;

      const worldBuildStarted = performance.now();
      const textureLoader = createVirtualLibraryTextureLoader(loadingManager, construction.signal);
      loadingManager.addHandler(/\.(?:png|jpe?g|webp)(?:\?|$)/i, textureLoader);
      let longestBuildSlice = 0, westBuildMaxSlice = 0, westBuildCpuMs = 0;
      const batchPhases: Record<string, {count: number; totalMs: number; maxMs: number}> = {};
      let preparedHall!: Awaited<ReturnType<typeof buildReferenceLibraryProgressively>>;
      let releasedHall: THREE.Group | undefined;
      let rendererReleased = false;
      let sceneReleased = false;
      const releaseGraphics = () => {
        loadingManager.onLoad = () => undefined;
        loadingManager.onProgress = () => undefined;
        loadingManager.onError = () => undefined;
        loadingManager.abort();
        if (preparedHall && releasedHall !== preparedHall.root) {
          releasedHall = preparedHall.root;
          void preparedHall.disposeArchitecture();
          scene.add(preparedHall.root);
        }
        if (!sceneReleased || scene.children.length) {
          sceneReleased = true;
          disposeScene(scene);
          scene.clear();
        }
        if (!rendererReleased) {
          rendererReleased = true;
          renderer.dispose();
        }
      };
      // 初始化等待中也立即释放；Release resources even while initialization awaits data.
      construction.signal.addEventListener('abort', releaseGraphics, {once: true});
      const failScene = (error?: unknown) => {
        const active = !disposed && !construction.signal.aborted;
        disposed = true;
        construction.abort();
        if (active) detachSceneActions();
        cleanupScene?.();
        // 延迟完成的建筑也归还资源；Release architecture returned after an earlier abort.
        releaseGraphics();
        if (active) {
          if (error instanceof Error) setSceneErrorMessage(error.message);
          setSceneError(true);
        }
      };
      try {
        preparedHall = await buildReferenceLibraryProgressively(textureLoader, construction.signal,
          (milliseconds, stage) => {
            if (construction.signal.aborted) return;
            if (stage.endsWith('-wall') || stage.endsWith('-elapsed')) {
              canvas.dataset.lastModuleWallStage = stage;
              canvas.dataset.lastModuleWallMs = milliseconds.toFixed(1);
              return;
            }
            if (stage.startsWith('static-')) {
              const phase = batchPhases[stage] ??= {count: 0, totalMs: 0, maxMs: 0};
              phase.count++; phase.totalMs += milliseconds; phase.maxMs = Math.max(phase.maxMs, milliseconds);
            }
            if (stage.startsWith('construction-west-')) {
              westBuildMaxSlice = Math.max(westBuildMaxSlice, milliseconds);
              westBuildCpuMs += milliseconds;
            }
            if (milliseconds > longestBuildSlice) {
              longestBuildSlice = milliseconds;
              canvas.dataset.longestBuildStage = stage;
            }
          }, {multiDraw: renderer.extensions.has('WEBGL_multi_draw'),
            onChange: () => {
              if (construction.signal.aborted) return;
              invalidateScene();
              const d = preparedHall?.streaming.diagnostics();
              if (!d) return;
              const signature = [d.residentModules, d.residentBytes,
                d.batching.batchCount, d.batching.allocatedGeometryBytes].join('|');
              if (signature !== architectureSignature) {architectureSignature = signature; invalidateShadows(); revealDeferredBooks();}
              setArchitectureProgress(d.loadingModules || d.queuedModules || d.phase === 'consolidating'
                ? `建筑细节加载中（${d.residentModules}/${d.totalModules}）` : null);
              if (!d.failedModules && !d.consolidationError) setArchitectureError(null);
              canvas.dataset.architectureDiagnostics = JSON.stringify(d);
            }, onError: error => {
              if (!construction.signal.aborted) setArchitectureError(error.message);
            }});
        construction.signal.throwIfAborted();
        // 从阅读器返回的位置必须由对应完整模型模块支持。
        // Reader-return destinations must be fully backed by their exact modules.
        if (restoredView.current) await preparedHall.streaming.ensurePoint(restoredView.current);
        construction.signal.throwIfAborted();
      } catch (error) {
        failScene(error);
        return undefined;
      }
      renderer.toneMappingExposure = preparedHall.referenceConfig.lighting.exposure;
      canvas.dataset.lightingDiagnostics = JSON.stringify(preparedHall.referenceConfig.lighting);
      architectureRetryRef.current = () => {
        if (preparedHall.streaming.diagnostics().consolidationError) {
          setSceneAttempt(attempt => attempt + 1); return;
        }
        void preparedHall.streaming.retryFailed().catch(error => {
          if (!construction.signal.aborted) setArchitectureError(error instanceof Error ? error.message : '建筑细节重试失败');
        });
      };
      const finalizeStarted = performance.now();
      let world: ReturnType<typeof createVirtualLibraryWorld>;
      try {
        world = createVirtualLibraryWorld(
          scene,
          textureLoader,
          Math.min(12, renderer.capabilities.getMaxAnisotropy()),
          preparedHall,
        );
      } catch (error) {
        failScene(error);
        return undefined;
      }
      let selectedSceneBook: SceneBook | null = null;
      const architectureWaitingBooks = new Map<SceneBook, boolean>();
      revealDeferredBooks = () => {
        for (const [book, pending] of architectureWaitingBooks) {
          if (pending) continue;
          if (!world.sceneBooks.includes(book)) {architectureWaitingBooks.delete(book); continue;}
          const info = world.getShelfInfo(book.shelfSectionId);
          if (info?.centerX === undefined || info.centerZ === undefined) continue;
          architectureWaitingBooks.set(book, true);
          void preparedHall.streaming.ensurePoint({x: info.centerX, y: info.targetY, z: info.centerZ}).then(() => {
            if (construction.signal.aborted || !world.sceneBooks.includes(book)) return;
            book.group.visible = true; architectureWaitingBooks.delete(book); updateCatalogDiagnostics(); invalidateShadows();
          }).catch(error => {
            if (!construction.signal.aborted) setArchitectureError(error instanceof Error ? error.message : '书架区域暂未加载');
          }).finally(() => {
            if (architectureWaitingBooks.has(book)) architectureWaitingBooks.set(book, false);
          });
        }
      };
      const updateCatalogDiagnostics = () => {
        canvas.dataset.renderedBookModelCount = String(world.sceneBooks.filter(book => book.group.visible).length);
        canvas.dataset.pendingArchitecturalBooks = String(architectureWaitingBooks.size);
        canvas.dataset.shelvedBookModelCount = String(
          world.sceneBooks.length - (selectedSceneBook ? 1 : 0),
        );
        canvas.dataset.occupiedShelfBayCount = String(new Set(
          world.sceneBooks.map((sceneBook) => sceneBook.group.userData.shelfBayIndex as number),
        ).size);
        canvas.dataset.catalogSyncRevision = String(preparedHall.root.userData.catalogSyncRevision ?? 0);
        canvas.dataset.bookPresentation = selectedSceneBook ? "inspection" : "shelved";
      };
      const syncSceneCatalog = (nextBooks: readonly Book[]) => {
        if (disposed || construction.signal.aborted) return;
        let result;
        try {
          result = world.syncCatalogBooks(nextBooks);
        } catch (error) {
          setCatalogSyncError(error instanceof Error ? error.message : "藏书同步失败，请重试。");
          return;
        }
        setCatalogSyncError(null);
        const changedBooks = new Set([...result.addedBookIds, ...result.replacedBookIds]);
        for (const book of world.sceneBooks) if (changedBooks.has(book.book.id)) {
          book.group.visible = false; architectureWaitingBooks.set(book, false);
        }
        revealDeferredBooks();
        if (result.addedBookIds.length || result.removedBookIds.length || result.replacedBookIds.length) invalidateShadows();
        if (selectedSceneBook && result.removedBookIds.includes(selectedSceneBook.book.id)) {
          selectedSceneBook = null;
          selectedBookIdRef.current = null;
          setSelectedBookId(null);
          delete canvas.dataset.inspectedBookId;
          delete canvas.dataset.inspectedBookYaw;
          delete canvas.dataset.inspectedBookPitch;
          delete canvas.dataset.inspectedBookZoom;
        } else if (selectedSceneBook) {
          selectedSceneBook = world.sceneBooks.find(
            (sceneBook) => sceneBook.book.id === selectedSceneBook?.book.id,
          ) ?? null;
        }
        updateCatalogDiagnostics();
        invalidateScene();
      };
      syncSceneCatalog(catalogBooksRef.current);
      catalogSyncRef.current = syncSceneCatalog;
      staticSceneBuildCountRef.current += 1;
      canvas.dataset.staticSceneBuildCount = String(staticSceneBuildCountRef.current);
      canvas.dataset.worldFinalizeMs = (performance.now() - finalizeStarted).toFixed(1);
      canvas.dataset.longestBuildSliceMs = longestBuildSlice.toFixed(1);
      canvas.dataset.westBuildMaxSliceMs = westBuildMaxSlice.toFixed(1);
      canvas.dataset.westBuildCpuMs = westBuildCpuMs.toFixed(1);
      canvas.dataset.batchPhaseTimings = JSON.stringify(batchPhases);
      canvas.dataset.worldBuildMs = (performance.now() - worldBuildStarted).toFixed(1);
      selectedSceneBook = world.sceneBooks.find(
        (sceneBook) => sceneBook.book.id === selectedBookIdRef.current,
      ) ?? null;
      if (selectedSceneBook) {
        setSceneBookRenderLayer(selectedSceneBook, VIRTUAL_LIBRARY_BOOK_PREVIEW_LAYER);
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Light) object.layers.enable(VIRTUAL_LIBRARY_BOOK_PREVIEW_LAYER);
      });
      let bookInspectionYawTarget = 0;
      let bookInspectionPitchTarget = 0;
      let bookInspectionZoomTarget = 1;
      const bookInspectionTransform = {
        position: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        scale: new THREE.Vector3(),
      };
      const bookCaptionAnchor = new THREE.Vector3();
      const projectedBookPosition = new THREE.Vector3();
      if (expandedShelfSectionIdRef.current !== null) {
        world.toggleShelfSection(expandedShelfSectionIdRef.current);
        setSelectedShelfInfo(world.getShelfInfo(expandedShelfSectionIdRef.current));
      }
      world.setActiveRoom(activeRoomRef.current);
      const hallColumnCount = world.getCameraColliders("hall")
        .filter(({ id }) => id.startsWith("gallery-column") || id.startsWith("wall-column"))
        .length / 2;
      canvas.dataset.sceneModel = VIRTUAL_LIBRARY_SCENE_MODEL_VERSION;
      canvas.dataset.expandableShelfSectionCount = String(world.shelfHitMeshes.length);
      canvas.dataset.activeRoom = activeRoomRef.current;
      updateCatalogDiagnostics();

      const raycaster = new THREE.Raycaster();
      raycaster.layers.enable(VIRTUAL_LIBRARY_BOOK_PREVIEW_LAYER);
      const pointer = new THREE.Vector2();
      const touchPoints = new Map<number, {x: number; y: number}>();
      const pointerState: PointerState = {
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        pointerId: -1,
        book: null,
        shelfSectionId: null,
        portalRoom: null,
        mode: null,
      };
      let pinchGesture: {
        pointerIds: [number, number];
        startDistance: number;
        startZoom: number;
      } | null = null;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let frame = 0;

      const updateCameraSettings = () => {
        const compactViewport = virtualLibraryUsesCompactViewport(viewportWidth, viewportHeight);
        if (activeRoomRef.current !== "hall") {
          const roomView = viewportWidth <= LIBRARY_ROOM_CAMERA_VIEW.mobileBreakpoint || compactViewport
            ? LIBRARY_ROOM_CAMERA_VIEW.mobile
            : LIBRARY_ROOM_CAMERA_VIEW.desktop;
          cameraBaseRadius = roomView.radius;
          cameraFovTarget = roomView.fov;
          cameraTargetYBase = roomView.targetY;
        } else if (expandedShelfSectionIdRef.current !== null) {
          cameraBaseRadius = 2.8;
          const info = world.getShelfInfo(expandedShelfSectionIdRef.current);
          const span = Math.max(info?.height ?? ACTIVE_HALL.lowerCaseHeight,
            (info?.width ?? 3.76) / (viewportWidth / viewportHeight));
          cameraFovTarget = THREE.MathUtils.radToDeg(2 * Math.atan(span * 1.12 / (2 * (cameraBaseRadius / sceneZoomRef.current))));
          cameraTargetYBase = ACTIVE_HALL.lowerCaseHeight / 2;
        } else if (compactViewport) {
          cameraBaseRadius = ROTUNDA_CAMERA_RADIUS - 0.5;
          cameraFovTarget = 62;
          cameraTargetYBase = MOBILE_ROTUNDA_CENTER_Y;
        } else if (viewportWidth <= tokens.layout.breakpointTablet) {
          cameraBaseRadius = ROTUNDA_CAMERA_RADIUS - 0.25;
          cameraFovTarget = 58;
          cameraTargetYBase = TABLET_ROTUNDA_CENTER_Y;
        } else {
          cameraBaseRadius = ROTUNDA_CAMERA_RADIUS;
          cameraFovTarget = 58;
          cameraTargetYBase = ROTUNDA_CENTER.y;
        }
        if (expandedShelfSectionIdRef.current === null) cameraTargetYRef.current = cameraTargetYBase;
      };

      let freeEye: THREE.Vector3 | null = null;
      if (restoredView.current) {
        const pose = restoredView.current;
        freeEye = new THREE.Vector3(pose.x, pose.y, pose.z);
        cameraYawCurrent = cameraYawTargetRef.current = pose.yaw;
        cameraPitchCurrent = cameraPitchTargetRef.current = pose.pitch;
        restoredView.current = null;
      }
      let shelfFacingYaw = 0;
      let galleryDistance: number | null = null;
      let walkingRoute: 'left-stair' | 'right-stair' = 'left-stair';
      let stairRoute: ReferencePoint[] = preparedHall.referenceConfig.stairRoutes.left;
      let freeWalkFollowsStairs = true;
      let shelfReturnPose: {
        position: THREE.Vector3;
        yaw: number;
        pitch: number;
        zoom: number;
      } | null = null;
      const walkLength = () => referenceRouteLength(stairRoute);
      const walkMinimum = () => 0;
      const walkPoint = (distance: number) => referenceRoutePoint(stairRoute, distance);
      let galleryDistanceCurrent = 0;
      let galleryPreviousEye: {x: number; y: number; z: number} | null = null;
      const galleryWalkOffset = new THREE.Vector3();
      let galleryLookYaw = 0, galleryLookPitch = 0;
      const walkingLook = new THREE.Vector3();
      const walkingUp = new THREE.Vector3(0, 1, 0);
      const movementLook = new THREE.Vector3();
      const pressedMovementKeys = new Set<VirtualLibraryMovementKey>();
      const stairObstacles = world.getCameraColliders("hall")
        .filter(collider => !isGuidedStairSupport(collider));
      const positionCamera = () => {
        cameraTarget.x = cameraTargetXCurrent;
        cameraTarget.y = cameraTargetYCurrent;
        cameraTarget.z = cameraTargetZCurrent;
        const planarRadius = Math.cos(cameraPitchCurrent) * cameraRadiusCurrent;
        const desiredX = freeEye?.x ?? cameraTarget.x + Math.sin(cameraYawCurrent) * planarRadius;
        const desiredY = freeEye?.y ?? cameraTarget.y + Math.sin(cameraPitchCurrent) * cameraRadiusCurrent;
        const desiredZ = freeEye?.z ?? cameraTarget.z + Math.cos(cameraYawCurrent) * planarRadius;
        const activeCameraRoom = activeRoomRef.current;
        const colliders = world.getCameraColliders(activeCameraRoom);
        const hallX = THREE.MathUtils.clamp(desiredX, -ACTIVE_HALL.width / 2 + 0.38, ACTIVE_HALL.width / 2 - 0.38);
        const hallZ = THREE.MathUtils.clamp(desiredZ, -ACTIVE_HALL.length / 2 + 0.38, ACTIVE_HALL.length / 2 - 0.38);
        const desiredPosition = activeCameraRoom === "hall" ? {
          x: hallX,
          y: clampHallFlightHeight(hallX, hallZ, desiredY),
          z: hallZ,
        } : { x: desiredX, y: desiredY, z: desiredZ };
        const previousPosition = hasPositionedCamera && previousCameraRoom === activeCameraRoom
            ? { x: camera.position.x, y: camera.position.y, z: camera.position.z }
            : desiredPosition;
        let collision = activeCameraRoom === 'hall' && freeEye
          ? resolveReferenceWalkingCollision(previousPosition, desiredPosition, colliders, stairObstacles,
            preparedHall.referenceConfig.stairRoutes, freeWalkFollowsStairs)
          : resolveCameraCollision(previousPosition, desiredPosition, colliders);
        camera.position.set(collision.x, collision.y, collision.z);
        hasPositionedCamera = true;
        previousCameraRoom = activeCameraRoom;
        camera.lookAt(cameraTarget);
        if (freeEye) {
          freeEye.copy(camera.position);
          camera.lookAt(camera.position.x - Math.sin(cameraYawCurrent),
            camera.position.y - Math.tan(cameraPitchCurrent), camera.position.z - Math.cos(cameraYawCurrent));
        }
        if (galleryDistance !== null && expandedShelfSectionIdRef.current === null && !selectedSceneBook) {
          const point = walkPoint(galleryDistanceCurrent);
          const ahead = walkPoint(Math.min(walkLength(), galleryDistanceCurrent + 0.5));
          const resolved = {
            x: point.x + galleryWalkOffset.x,
            y: point.y + WALKING_EYE_HEIGHT,
            z: point.z + galleryWalkOffset.z,
          };
          // 从上一帧眼睛位置做扫掠，不从地面或环绕相机起点检测。
          // Sweep from the previous eye, not from the ground or the orbit camera.
          const safe = resolveGuidedStairCollision(galleryPreviousEye ?? resolved, resolved, colliders, stairObstacles,
            {x: point.x, y: point.y + WALKING_EYE_HEIGHT, z: point.z});
          collision = safe;
          camera.position.set(safe.x, safe.y, safe.z);
          galleryPreviousEye = {x: safe.x, y: safe.y, z: safe.z};
          galleryWalkOffset.set(safe.x - point.x, 0, safe.z - point.z);
          walkingLook.set(ahead.x - point.x, ahead.y - point.y, ahead.z - point.z);
          if (walkingLook.lengthSq() < 0.0001) {
            const behind = walkPoint(Math.max(0, galleryDistanceCurrent - 0.5));
            walkingLook.set(point.x - behind.x, point.y - behind.y, point.z - behind.z);
          }
          walkingLook.y = 0;
          walkingLook.normalize().applyAxisAngle(walkingUp, cameraYawCurrent - galleryLookYaw);
          walkingLook.y += Math.tan(cameraPitchCurrent - galleryLookPitch);
          camera.lookAt(camera.position.x + walkingLook.x, camera.position.y + walkingLook.y, camera.position.z + walkingLook.z);
          canvas.dataset.walkDistance = galleryDistanceCurrent.toFixed(2);
          canvas.dataset.walkRoute = walkingRoute;
          canvas.dataset.walkLength = walkLength().toFixed(2);
          canvas.dataset.walkFloor = point.y >= ACTIVE_HALL.galleryY - 0.05 ? "2" : "1";
        } else {
          delete canvas.dataset.walkDistance; delete canvas.dataset.walkFloor;
          delete canvas.dataset.walkRoute; delete canvas.dataset.walkLength;
        }
        const focusedShelfId = expandedShelfSectionIdRef.current;
        const focusedShelf = focusedShelfId === null ? null : world.getShelfInfo(focusedShelfId);
        if (activeCameraRoom === 'hall' && focusedShelf) {
          cameraFovTarget = getReferenceShelfFocusFov(camera, focusedShelf);
          if (Math.abs(camera.fov - cameraFovTarget) > 0.001) {
            camera.fov = cameraFovTarget;
            camera.updateProjectionMatrix();
          }
        }
        canvas.dataset.cameraYaw = cameraYawCurrent.toFixed(4);
        canvas.dataset.cameraPitch = cameraPitchCurrent.toFixed(4);
        canvas.dataset.cameraRadius = cameraRadiusCurrent.toFixed(3);
        canvas.dataset.cameraResolvedRadius = camera.position.distanceTo(cameraTarget).toFixed(3);
        canvas.dataset.sceneZoom = sceneZoomRef.current.toFixed(2);
        canvas.dataset.cameraTargetY = cameraTargetYCurrent.toFixed(3);
        canvas.dataset.cameraTargetX = cameraTargetXCurrent.toFixed(3);
        canvas.dataset.cameraTargetZ = cameraTargetZCurrent.toFixed(3);
        canvas.dataset.cameraPositionX = camera.position.x.toFixed(3);
        canvas.dataset.cameraPositionY = camera.position.y.toFixed(3);
        canvas.dataset.cameraPositionZ = camera.position.z.toFixed(3);
        canvas.dataset.cameraFov = camera.fov.toFixed(2);
        canvas.dataset.activeRoom = activeRoomRef.current;
        canvas.dataset.cameraCollision = collision.blocked ? collision.blockedBy ?? "solid" : "clear";
        canvas.dataset.cameraColliderCount = String(colliders.length);
        canvas.dataset.hallColumnCount = String(hallColumnCount);
      };

      const resize = () => {
        const width = Math.max(1, host.clientWidth || window.innerWidth);
        const height = Math.max(1, host.clientHeight || window.innerHeight);
        viewportWidth = width;
        viewportHeight = height;
        updateCameraSettings();
        cameraTargetYCurrent = cameraTargetYRef.current;
        cameraTargetXCurrent = cameraTargetXZRef.current.x;
        cameraTargetZCurrent = cameraTargetXZRef.current.z;
        cameraRadiusCurrent = cameraBaseRadius / sceneZoomRef.current;
        camera.fov = cameraFovTarget;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        positionCamera();
        const nextPixelRatio = virtualLibraryDevicePixelRatio(window.devicePixelRatio, width, height);
        if (Math.abs(nextPixelRatio - rendererPixelRatio) > 0.001) {
          renderer.setPixelRatio(nextPixelRatio);
          rendererPixelRatio = nextPixelRatio;
        }
        renderer.setSize(width, height, false);
        canvas.dataset.viewportWidth = String(width);
        canvas.dataset.viewportHeight = String(height);
        canvas.dataset.renderPixelRatio = nextPixelRatio.toFixed(2);
        invalidateScene();
      };

      const updatePointer = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      };
      const hitTestTargets = (event: PointerEvent) => {
        updatePointer(event);
        raycaster.setFromCamera(pointer, camera);
        if (activeRoomRef.current !== "hall") {
          return { book: null, shelfSectionId: null, portalRoom: null, terminal: false };
        }
        const focusedShelfSectionId = world.getExpandedShelfSectionId();
        let clearThrough = 0, blockedFrom = Infinity;
        const visibleHit = (hit: THREE.Intersection) => {
          if (!isSceneObjectVisible(hit.object)) return false;
          // 所有目标共用一条射线，复用已验证的遮挡距离，避免对每个代理重复遍历整栋建筑。
          // All targets share this ray. Reuse its proven clear/blocked range
          // instead of testing the complete architecture for every proxy.
          if (hit.distance <= clearThrough) return true;
          if (hit.distance >= blockedFrom) return false;
          const clear = isUnoccludedSceneHit(raycaster, hit, [preparedHall.root]);
          if (clear) clearThrough = hit.distance;
          else blockedFrom = hit.distance;
          return clear;
        };
        const terminalHit = raycaster.intersectObject(world.catalogTerminal, true)[0];
        // 共享可见性检测已拒绝不透明建筑，再检测父节点会碰到不可见目录代理而误遮挡指针下的水晶球。
        // The shared visibility check already rejects opaque architecture.
        // Recasting the parent also sees non-visible catalog proxies and can
        // incorrectly hide the crystal that is visibly under the pointer.
        if (terminalHit && visibleHit(terminalHit)) {
          return { book: null, shelfSectionId: null, portalRoom: null, terminal: true };
        }
        const bookHit = raycaster.intersectObjects(world.interactiveMeshes, false)
          .find(hit => {
            const target = findSceneBook(hit.object);
            // 被检查的书在独立前景通道渲染，室内建筑不应禁用它的旋转或打开交互。
            // The inspected book renders in its own foreground pass, so room
            // architecture must not disable its rotate/open interaction.
            return target && isSceneObjectVisible(target.group)
              && (target === selectedSceneBook || visibleHit(hit));
          });
        const book = bookHit ? findSceneBook(bookHit.object) : null;
        if (book) {
          if (isFocusedShelfTarget(focusedShelfSectionId, book.shelfSectionId)) {
            return { book, shelfSectionId: null, portalRoom: null, terminal: false };
          }
          if (focusedShelfSectionId !== null) {
            return { book: null, shelfSectionId: null, portalRoom: null, terminal: false };
          }
          return { book: null, shelfSectionId: book.shelfSectionId, portalRoom: null, terminal: false };
        }
        const portalHit = raycaster.intersectObjects(world.portalHitMeshes, false).find(visibleHit);
        const portalRoom = portalHit ? findPortalRoom(portalHit.object) : null;
        if (portalRoom) return { book: null, shelfSectionId: null, portalRoom, terminal: false };
        const shelfHit = raycaster.intersectObjects(world.shelfHitMeshes, false).find(hit =>
          isFocusedShelfTarget(focusedShelfSectionId, findShelfSectionId(hit.object)) && visibleHit(hit));
        return {
          terminal: false,
          book: null,
          shelfSectionId: shelfHit ? findShelfSectionId(shelfHit.object) : null,
          portalRoom: null,
        };
      };
      let spatialRequest = 0;
      const runAtReadyPoint = (point: {x: number; y: number; z: number}, action: () => void) => {
        const request = ++spatialRequest;
        setSpatialLoading(true);
        void preparedHall.streaming.ensurePoint(point).then(() => {
          if (!construction.signal.aborted && request === spatialRequest) {action(); invalidateScene();}
        }).catch(error => {
          if (!construction.signal.aborted && request === spatialRequest)
            setArchitectureError(error instanceof Error ? error.message : '目标区域暂未加载');
        }).finally(() => {
          if (!construction.signal.aborted && request === spatialRequest) setSpatialLoading(false);
        });
      };
      const resetShelfFocus = () => {
        spatialRequest++; setSpatialLoading(false);
        const returnPose = shelfReturnPose;
        shelfReturnPose = null;
        if (returnPose) {
          freeEye = returnPose.position.clone();
          cameraYawTargetRef.current = returnPose.yaw;
          cameraPitchTargetRef.current = returnPose.pitch;
          cameraYawCurrent = returnPose.yaw;
          cameraPitchCurrent = returnPose.pitch;
          sceneZoomRef.current = returnPose.zoom;
          setSceneZoom(returnPose.zoom);
        } else {
          freeEye = null;
          cameraTargetXZRef.current = { x: ROTUNDA_CENTER.x, z: ROTUNDA_CENTER.z };
          cameraPitchTargetRef.current = ACTIVE_HALL.camera.pitch;
          sceneZoomRef.current = 1;
          setSceneZoom(1);
        }
        updateCameraSettings();
        cameraTargetXCurrent = cameraTargetXZRef.current.x;
        cameraTargetZCurrent = cameraTargetXZRef.current.z;
        cameraTargetYRef.current = cameraTargetYBase;
        cameraTargetYCurrent = cameraTargetYRef.current;
        cameraPitchCurrent = cameraPitchTargetRef.current;
        cameraRadiusCurrent = cameraBaseRadius / sceneZoomRef.current;
        // 关闭书架后按新放置恢复大厅姿态；从近景扫掠会撞上刚关闭的书架。
        // Restore the hall pose as a fresh placement. Sweeping from the
        // close-up shelf position would collide with the shelf we just closed.
        hasPositionedCamera = false;
        setSelectedShelfInfo(null);
      };
      const collapseFocusedShelf = () => {
        world.collapseShelfSections();
        expandedShelfSectionIdRef.current = null;
        setExpandedShelfSectionId(null);
        resetShelfFocus();
      };
      const focusShelfNow = (sectionId: number) => {
        pressedMovementKeys.clear();
        canvas.dataset.movementKeys = "";
        const info = world.getShelfInfo(sectionId);
        if (!info) return;
        shelfReturnPose ??= {
          position: camera.position.clone(),
          yaw: cameraYawCurrent,
          pitch: cameraPitchCurrent,
          zoom: sceneZoomRef.current,
        };
        freeEye = null;
        galleryDistance = null; setStairWalking(false);
        const requestedYaw = -info.angle - Math.PI / 2;
        const currentYaw = cameraYawTargetRef.current;
        const shortestTurn = Math.atan2(
          Math.sin(requestedYaw - currentYaw),
          Math.cos(requestedYaw - currentYaw),
        );
        cameraYawTargetRef.current = currentYaw + shortestTurn;
        cameraPitchTargetRef.current = info.targetY > ACTIVE_HALL.galleryY ? 0.035 : -0.045;
        const shelfFaceRadius = info.radius - info.depth * 0.56;
        cameraTargetXZRef.current = {
          x: info.centerX !== undefined ? info.centerX - Math.cos(info.angle) * info.depth * 0.56 : Math.cos(info.angle) * shelfFaceRadius,
          z: info.centerZ !== undefined ? info.centerZ - Math.sin(info.angle) * info.depth * 0.56 : Math.sin(info.angle) * shelfFaceRadius,
        };
        cameraTargetYRef.current = info.targetY;
        updateCameraSettings();
        sceneZoomRef.current = 1;
        updateCameraSettings();
        setSceneZoom(sceneZoomRef.current);
        shelfFacingYaw = cameraYawTargetRef.current;
        cameraYawCurrent = cameraYawTargetRef.current;
        cameraPitchCurrent = cameraPitchTargetRef.current;
        cameraTargetXCurrent = cameraTargetXZRef.current.x;
        cameraTargetZCurrent = cameraTargetXZRef.current.z;
        cameraTargetYCurrent = cameraTargetYRef.current;
        cameraRadiusCurrent = Math.min(cameraBaseRadius / sceneZoomRef.current, 2.8);
        hasPositionedCamera = false;
        setSelectedShelfInfo(info);
        setViewPreset("free");
      };
      const focusShelf = (sectionId: number) => {
        const info = world.getShelfInfo(sectionId);
        if (!info || info.centerX === undefined || info.centerZ === undefined) return;
        runAtReadyPoint({x: info.centerX, y: info.targetY, z: info.centerZ}, () => {
          if (expandedShelfSectionIdRef.current === sectionId) focusShelfNow(sectionId);
        });
      };
      catalogShelfRef.current = () => {
        galleryDistance = null; setStairWalking(false);
        const first = world.sceneBooks[0];
        if (!first) { setSearchOpen(true); return; }
        if (world.getExpandedShelfSectionId() !== first.shelfSectionId) world.toggleShelfSection(first.shelfSectionId);
        expandedShelfSectionIdRef.current = first.shelfSectionId;
        setExpandedShelfSectionId(first.shelfSectionId);
        focusShelf(first.shelfSectionId);
      };
      const focusCategory = (categoryId: string) => {
        const first = world.sceneBooks.find(book => book.classification.category.id === categoryId);
        if (!first) return;
        clearSelectedBook();
        if (world.getExpandedShelfSectionId() !== first.shelfSectionId) world.toggleShelfSection(first.shelfSectionId);
        expandedShelfSectionIdRef.current = first.shelfSectionId; setExpandedShelfSectionId(first.shelfSectionId);
        focusShelf(first.shelfSectionId);
      };
      const focusBook = (bookId: string) => {
        const book = world.sceneBooks.find(item => item.book.id === bookId);
        if (!book) {setCatalogSyncError('这本书尚未入架，可从搜索结果直接阅读。'); return;}
        clearSelectedBook();
        if (world.getExpandedShelfSectionId() !== book.shelfSectionId) world.toggleShelfSection(book.shelfSectionId);
        expandedShelfSectionIdRef.current = book.shelfSectionId;
        setExpandedShelfSectionId(book.shelfSectionId);
        focusShelf(book.shelfSectionId);
      };
      const selectBook = (sceneBook: SceneBook) => {
        invalidateShadows();
        if (selectedSceneBook && selectedSceneBook !== sceneBook) {
          selectedSceneBook.group.userData.bookPresentation = "shelved";
          setSceneBookRenderLayer(selectedSceneBook, VIRTUAL_LIBRARY_WORLD_LAYER);
          placeSceneBookOnShelf(selectedSceneBook);
        }
        selectedSceneBook = sceneBook;
        sceneBook.group.userData.bookPresentation = "inspection";
        setSceneBookRenderLayer(sceneBook, VIRTUAL_LIBRARY_BOOK_PREVIEW_LAYER);
        bookInspectionYawTarget = 0;
        bookInspectionPitchTarget = 0;
        bookInspectionZoomTarget = 1;
        selectedBookIdRef.current = sceneBook.book.id;
        setSelectedBookId(sceneBook.book.id);
        canvas.dataset.bookPresentation = "inspection";
        canvas.dataset.shelvedBookModelCount = String(Math.max(0, world.sceneBooks.length - 1));
        canvas.dataset.inspectedBookId = sceneBook.book.id;
        canvas.dataset.inspectedBookYaw = "0.000";
        canvas.dataset.inspectedBookPitch = "0.000";
        canvas.dataset.inspectedBookZoom = "1.00";
      };
      const clearSelectedBook = () => {
        invalidateShadows();
        if (selectedSceneBook) {
          selectedSceneBook.group.userData.bookPresentation = "shelved";
          setSceneBookRenderLayer(selectedSceneBook, VIRTUAL_LIBRARY_WORLD_LAYER);
          placeSceneBookOnShelf(selectedSceneBook);
        }
        selectedSceneBook = null;
        selectedBookIdRef.current = null;
        setSelectedBookId(null);
        canvas.dataset.bookPresentation = "shelved";
        canvas.dataset.shelvedBookModelCount = String(world.sceneBooks.length);
        delete canvas.dataset.inspectedBookId;
        delete canvas.dataset.inspectedBookYaw;
        delete canvas.dataset.inspectedBookPitch;
        delete canvas.dataset.inspectedBookZoom;
      };
      const navigateRoom = (room: LibraryRoomId) => {
        if (selectedBookIdRef.current) clearSelectedBook();
        shelfReturnPose = null;
        world.collapseShelfSections();
        world.setHoveredShelfSection(null);
        expandedShelfSectionIdRef.current = null;
        setExpandedShelfSectionId(null);
        setSelectedShelfInfo(null);
        activeRoomRef.current = room;
        setActiveRoom(room);
        world.setActiveRoom(room);
        canvas.dataset.activeRoom = room;
        cameraTargetXZRef.current = room === "hall"
          ? { x: ROTUNDA_CENTER.x, z: ROTUNDA_CENTER.z }
          : {
              x: LIBRARY_ROOM_CAMERA_VIEW.targetX,
              z: LIBRARY_ROOM_CAMERA_VIEW.targetZ,
            };
        sceneZoomRef.current = 1;
        setSceneZoom(1);
        cameraYawTargetRef.current += Math.atan2(
          Math.sin(-cameraYawTargetRef.current),
          Math.cos(-cameraYawTargetRef.current),
        );
        cameraPitchTargetRef.current = room === "hall" ? ACTIVE_HALL.camera.pitch : -0.055;
        updateCameraSettings();
        cameraTargetYRef.current = cameraTargetYBase;
        cameraYawCurrent = cameraYawTargetRef.current;
        cameraPitchCurrent = cameraPitchTargetRef.current;
        cameraTargetXCurrent = cameraTargetXZRef.current.x;
        cameraTargetYCurrent = cameraTargetYRef.current;
        cameraTargetZCurrent = cameraTargetXZRef.current.z;
        cameraRadiusCurrent = cameraBaseRadius / sceneZoomRef.current;
        hasPositionedCamera = false;
        previousCameraRoom = room;
        setViewPreset(room === "hall" ? "front" : "free");
      };
      roomNavigationRef.current = navigateRoom;

      const onPointerDown = (event: PointerEvent) => {
        canvas.focus({ preventScroll: true });
        if (event.pointerType === "touch") {
          touchPoints.set(event.pointerId, {x: event.clientX, y: event.clientY});
          if (touchPoints.size >= 2) {
            const entries = [...touchPoints.entries()].slice(0, 2);
            const [first, second] = entries;
            pinchGesture = {
              pointerIds: [first[0], second[0]],
              startDistance: Math.max(1, Math.hypot(
                second[1].x - first[1].x,
                second[1].y - first[1].y,
              )),
              startZoom: selectedSceneBook ? bookInspectionZoomTarget : sceneZoomRef.current,
            };
            pointerState.pointerId = -1;
            pointerState.mode = null;
            canvas.setPointerCapture(event.pointerId);
            canvas.style.cursor = "grabbing";
            return;
          }
        }
        const target = hitTestTargets(event);
        const sceneBook = target.book;
        pointerState.startX = event.clientX;
        pointerState.startY = event.clientY;
        pointerState.lastX = event.clientX;
        pointerState.lastY = event.clientY;
        pointerState.pointerId = event.pointerId;
        pointerState.book = sceneBook;
        pointerState.shelfSectionId = target.shelfSectionId;
        pointerState.portalRoom = target.portalRoom;
        pointerState.mode = target.terminal ? "terminal" : sceneBook
          ? selectedBookIdRef.current === sceneBook.book.id
            ? "inspect"
            : "select"
          : target.portalRoom
            ? "portal"
            : target.shelfSectionId !== null
              ? "shelf"
              : "orbit";
        if (pointerState.mode === "orbit" || pointerState.mode === "inspect") {
          canvas.setPointerCapture(event.pointerId);
          canvas.style.cursor = "grabbing";
        }
      };
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch" && touchPoints.has(event.pointerId)) {
          touchPoints.set(event.pointerId, {x: event.clientX, y: event.clientY});
          if (pinchGesture && pinchGesture.pointerIds.includes(event.pointerId)) {
            const first = touchPoints.get(pinchGesture.pointerIds[0]);
            const second = touchPoints.get(pinchGesture.pointerIds[1]);
            if (first && second) {
              const distance = Math.hypot(second.x - first.x, second.y - first.y);
              if (selectedSceneBook) {
                bookInspectionZoomTarget = virtualLibraryPinchZoom(
                  pinchGesture.startZoom,
                  pinchGesture.startDistance,
                  distance,
                  BOOK_INSPECTION_LAYOUT.minimumZoom,
                  BOOK_INSPECTION_LAYOUT.maximumZoom,
                );
                canvas.dataset.inspectedBookZoom = bookInspectionZoomTarget.toFixed(2);
              } else {
                sceneZoomRef.current = virtualLibraryPinchZoom(
                  pinchGesture.startZoom,
                  pinchGesture.startDistance,
                  distance,
                  MIN_SCENE_ZOOM,
                  MAX_SCENE_ZOOM,
                );
                setSceneZoom(sceneZoomRef.current);
              }
              invalidateScene();
            }
            return;
          }
        }
        if (pointerState.pointerId === event.pointerId && pointerState.mode === "inspect") {
          const deltaX = event.clientX - pointerState.lastX;
          const deltaY = event.clientY - pointerState.lastY;
          pointerState.lastX = event.clientX;
          pointerState.lastY = event.clientY;
          bookInspectionYawTarget += deltaX * 0.012;
          bookInspectionPitchTarget = THREE.MathUtils.clamp(
            bookInspectionPitchTarget + deltaY * 0.008,
            -0.42,
            0.42,
          );
          canvas.dataset.inspectedBookYaw = bookInspectionYawTarget.toFixed(3);
          canvas.dataset.inspectedBookPitch = bookInspectionPitchTarget.toFixed(3);
          return;
        }
        if (pointerState.pointerId === event.pointerId && pointerState.mode === "orbit") {
          const deltaX = event.clientX - pointerState.lastX;
          const deltaY = event.clientY - pointerState.lastY;
          pointerState.lastX = event.clientX;
          pointerState.lastY = event.clientY;
          // 大厅探索在当前眼睛位置转向；绕大厅中心旋转会改变高度并把视点带进构件。
          // Hall exploration turns at the current eye position. Orbiting around
          // the hall centre also changes elevation and carries the eye into joinery.
          if (activeRoomRef.current === "hall" && expandedShelfSectionIdRef.current === null
            && galleryDistance === null) freeEye ??= camera.position.clone();
          const nextYaw = cameraYawTargetRef.current - deltaX * 0.008;
          cameraYawTargetRef.current = activeRoomRef.current === "hall"
            ? expandedShelfSectionIdRef.current !== null
              ? THREE.MathUtils.clamp(nextYaw, shelfFacingYaw - 0.35, shelfFacingYaw + 0.35) : nextYaw
            : THREE.MathUtils.clamp(nextYaw, -0.52, 0.52);
          cameraPitchTargetRef.current = THREE.MathUtils.clamp(
            cameraPitchTargetRef.current + deltaY * 0.0045,
            activeRoomRef.current === "hall" ? -0.28 : -0.18,
            activeRoomRef.current === "hall" ? 0.38 : 0.24,
          );
          setViewPreset("free");
          return;
        }
        if (event.pointerType !== "mouse") return;
        const target = hitTestTargets(event);
        world.setHoveredShelfSection(target.shelfSectionId);
        if (target.shelfSectionId !== null) canvas.dataset.hoveredShelfSection = String(target.shelfSectionId);
        else delete canvas.dataset.hoveredShelfSection;
        if (target.book) canvas.dataset.hoveredBookId = target.book.book.id;
        else delete canvas.dataset.hoveredBookId;
        canvas.style.cursor = target.terminal || target.book || target.portalRoom || target.shelfSectionId !== null ? "pointer" : "grab";
      };
      const endPointer = (event: PointerEvent) => {
        if (event.type === "pointercancel") {
          touchPoints.delete(event.pointerId);
          pinchGesture = null;
          pointerState.pointerId = -1;
          pointerState.mode = null;
          pointerState.book = null;
          pointerState.shelfSectionId = null;
          pointerState.portalRoom = null;
          canvas.style.cursor = "grab";
          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
          return;
        }
        if (event.pointerType === "touch") {
          touchPoints.delete(event.pointerId);
          if (pinchGesture) {
            if (touchPoints.size < 2) pinchGesture = null;
            pointerState.pointerId = -1;
            pointerState.mode = null;
            pointerState.book = null;
            pointerState.shelfSectionId = null;
            pointerState.portalRoom = null;
            canvas.style.cursor = "grab";
            if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            return;
          }
        }
        if (pointerState.pointerId !== event.pointerId) return;
        const moved = Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY);
        const releasedBook = pointerState.mode === "inspect"
          ? hitTestTargets(event).book
          : null;
        const readerBookId = shouldOpenInspectedBook({
          selectedBookId: selectedBookIdRef.current,
          pressedBookId: pointerState.book?.book.id ?? null,
          releasedBookId: releasedBook?.book.id ?? null,
          moved,
        })
          ? pointerState.book?.book.id ?? null
          : null;
        if (pointerState.mode === "terminal" && moved < 8 && hitTestTargets(event).terminal) setSearchOpen(true);
        if (pointerState.mode === "select" && pointerState.book && moved < 8) selectBook(pointerState.book);
        if (pointerState.mode === "portal" && pointerState.portalRoom && moved < 8) {
          navigateRoom(pointerState.portalRoom);
        }
        if (pointerState.mode === "shelf" && pointerState.shelfSectionId !== null && moved < 8) {
          if (selectedBookIdRef.current) clearSelectedBook();
          const nextSectionId = world.toggleShelfSection(pointerState.shelfSectionId);
          expandedShelfSectionIdRef.current = nextSectionId;
          setExpandedShelfSectionId(nextSectionId);
          if (nextSectionId !== null) focusShelf(nextSectionId);
          else resetShelfFocus();
        }
        if (pointerState.mode === "orbit" && moved < 8) {
          if (selectedBookIdRef.current) {
            clearSelectedBook();
          } else if (world.getExpandedShelfSectionId() !== null) {
            collapseFocusedShelf();
          }
        }
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        pointerState.book = null;
        pointerState.shelfSectionId = null;
        pointerState.portalRoom = null;
        pointerState.pointerId = -1;
        pointerState.mode = null;
        canvas.style.cursor = "grab";
        if (readerBookId) readerNavigationRef.current(readerBookId);
      };
      const onPointerLeave = () => {
        world.setHoveredShelfSection(null);
        delete canvas.dataset.hoveredShelfSection;
        delete canvas.dataset.hoveredBookId;
        if (pointerState.mode === null) canvas.style.cursor = "grab";
      };
      const startStair = (side: "left" | "right") => {
        if (selectedSceneBook || isShelfMovementLocked(expandedShelfSectionIdRef.current) || searchOpenRef.current) return;
        pressedMovementKeys.clear();
        const descending = camera.position.y > ACTIVE_HALL.galleryY;
        const sourceRoute = preparedHall.referenceConfig.stairRoutes[side];
        stairRoute = descending ? [...sourceRoute].reverse() : sourceRoute;
        walkingRoute = side === 'left' ? 'left-stair' : 'right-stair';
        freeEye = null;
        galleryPreviousEye = null;
        galleryDistanceCurrent = 0;
        galleryDistance = walkLength();
        galleryWalkOffset.set(0, 0, 0);
        galleryLookYaw = cameraYawCurrent; galleryLookPitch = cameraPitchCurrent;
        hasPositionedCamera = false;
        setStairWalking(true);
        invalidateScene();
      };
      stairAccessRef.current = side => {
        if (selectedSceneBook || isShelfMovementLocked(expandedShelfSectionIdRef.current) || searchOpenRef.current) return;
        const route = preparedHall.referenceConfig.stairRoutes[side];
        const point = camera.position.y > ACTIVE_HALL.galleryY ? route[route.length - 1] : route[0];
        runAtReadyPoint(point, () => startStair(side));
      };
      const walk = (direction: number) => {
        if (isShelfMovementLocked(expandedShelfSectionIdRef.current)) return;
        if (galleryDistance !== null) {
          galleryDistance = THREE.MathUtils.clamp(galleryDistance + direction * 2, walkMinimum(), walkLength());
          invalidateScene(); return;
        }
        if (activeRoomRef.current !== "hall" || selectedSceneBook) return;
        freeEye ??= camera.position.clone();
        const desired = {
          x: freeEye.x - Math.sin(cameraYawCurrent) * direction * 1.5,
          y: freeEye.y,
          z: freeEye.z - Math.cos(cameraYawCurrent) * direction * 1.5,
        };
        freeWalkFollowsStairs = true;
        const safe = resolveReferenceWalkingCollision(freeEye, desired, world.getCameraColliders("hall"),
          stairObstacles, preparedHall.referenceConfig.stairRoutes);
        freeEye.set(safe.x, safe.y, safe.z);
        invalidateScene();
      };
      walkRef.current = walk;

      const updateMovementDiagnostics = () => {
        canvas.dataset.movementKeys = [...pressedMovementKeys].sort().join(",");
      };
      const clearMovementKeys = () => {
        if (pressedMovementKeys.size === 0) return;
        pressedMovementKeys.clear();
        updateMovementDiagnostics();
        invalidateScene();
      };
      const canMoveContinuously = () => activeRoomRef.current === "hall"
        && galleryDistance === null
        && !selectedSceneBook
        && !isShelfMovementLocked(expandedShelfSectionIdRef.current)
        && !searchOpenRef.current;
      const moveContinuously = (deltaSeconds: number) => {
        if (pressedMovementKeys.size === 0 || !canMoveContinuously()) return false;
        camera.getWorldDirection(movementLook);
        movementLook.y = 0;
        let movementYaw = cameraYawCurrent;
        if (movementLook.lengthSq() >= 0.0001) {
          movementLook.normalize();
          movementYaw = Math.atan2(-movementLook.x, -movementLook.z);
        }
        const frameSeconds = Math.min(deltaSeconds, 0.05);
        const planarDelta = cameraRelativeWalkDelta(
          movementYaw,
          pressedMovementKeys,
          VIRTUAL_LIBRARY_KEYBOARD_WALK_SPEED * frameSeconds,
        );
        const verticalDelta = galleryDistance === null
          ? virtualLibraryVerticalFlightDelta(
            pressedMovementKeys,
            VIRTUAL_LIBRARY_KEYBOARD_FLIGHT_SPEED * frameSeconds,
          )
          : 0;
        if (!planarDelta && verticalDelta === 0) return false;

        const colliders = world.getCameraColliders("hall");
        if (galleryDistance !== null) {
          const point = walkPoint(galleryDistanceCurrent);
          const previous = galleryPreviousEye ?? {
            x: point.x + galleryWalkOffset.x,
            y: point.y + WALKING_EYE_HEIGHT,
            z: point.z + galleryWalkOffset.z,
          };
          const safe = resolveCameraCollision(previous, {
            x: previous.x + (planarDelta?.x ?? 0),
            y: previous.y,
            z: previous.z + (planarDelta?.z ?? 0),
          }, colliders, WALKING_CAMERA_CLEARANCE);
          galleryWalkOffset.x += safe.x - previous.x;
          galleryWalkOffset.z += safe.z - previous.z;
          galleryPreviousEye = {x: safe.x, y: safe.y, z: safe.z};
        } else {
          freeEye ??= camera.position.clone();
          const desiredX = freeEye.x + (planarDelta?.x ?? 0);
          const desiredZ = freeEye.z + (planarDelta?.z ?? 0);
          freeWalkFollowsStairs = verticalDelta === 0;
          const safe = resolveReferenceWalkingCollision(freeEye, {
            x: desiredX,
            y: clampHallFlightHeight(desiredX, desiredZ, freeEye.y + verticalDelta),
            z: desiredZ,
          }, colliders, stairObstacles, preparedHall.referenceConfig.stairRoutes, freeWalkFollowsStairs);
          freeEye.set(safe.x, safe.y, safe.z);
        }
        invalidateScene();
        return true;
      };
      const onKeyDown = (event: KeyboardEvent) => {
        const movementKey = virtualLibraryMovementKey(event.code, event.key);
        if (movementKey && event.target === canvas && !searchOpenRef.current) {
          event.preventDefault();
          if (isShelfMovementLocked(expandedShelfSectionIdRef.current)) return;
          const startingDirection = !pressedMovementKeys.has(movementKey);
          pressedMovementKeys.add(movementKey);
          updateMovementDiagnostics();
          if (startingDirection) moveContinuously(1 / 60);
          invalidateScene();
          return;
        }
        if (searchOpenRef.current) return;
        if (event.key !== "Escape") return;
        spatialRequest++; setSpatialLoading(false);
        if (galleryDistance !== null) {
          // 停止时保持已通过碰撞检查的踏步位置，不把访客重置到建筑中心。
          // Stop on the already collision-resolved tread instead of resetting
          // the visitor into the centre of the building.
          freeEye = camera.position.clone();
          camera.getWorldDirection(movementLook);
          cameraYawCurrent = cameraYawTargetRef.current = Math.atan2(-movementLook.x, -movementLook.z);
          cameraPitchCurrent = cameraPitchTargetRef.current = Math.atan2(-movementLook.y, Math.hypot(movementLook.x, movementLook.z));
          galleryDistance = null; galleryPreviousEye = null;
          pressedMovementKeys.clear();
          setStairWalking(false);
          invalidateScene();
          return;
        }
        if (activeRoomRef.current !== "hall") {
          navigateRoom("hall");
          return;
        }
        if (selectedBookIdRef.current) {
          clearSelectedBook();
          return;
        }
        if (world.getExpandedShelfSectionId() !== null) {
          collapseFocusedShelf();
        }
      };
      const onKeyUp = (event: KeyboardEvent) => {
        const movementKey = virtualLibraryMovementKey(event.code, event.key);
        if (!movementKey || !pressedMovementKeys.delete(movementKey)) return;
        event.preventDefault();
        updateMovementDiagnostics();
        invalidateScene();
      };
      const onVisibilityChange = () => {
        if (document.hidden) clearMovementKeys();
        invalidateScene();
      };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        if (galleryDistance !== null) return;
        const sensitivity = event.ctrlKey ? 0.004 : 0.0015;
        if (selectedSceneBook) {
          const zoomDelta = THREE.MathUtils.clamp(
            -event.deltaY * sensitivity,
            -BOOK_INSPECTION_ZOOM_STEP,
            BOOK_INSPECTION_ZOOM_STEP,
          );
          bookInspectionZoomTarget = THREE.MathUtils.clamp(
            bookInspectionZoomTarget + zoomDelta,
            BOOK_INSPECTION_LAYOUT.minimumZoom,
            BOOK_INSPECTION_LAYOUT.maximumZoom,
          );
          canvas.dataset.inspectedBookZoom = bookInspectionZoomTarget.toFixed(2);
          return;
        }
        if (activeRoomRef.current === "hall" && expandedShelfSectionIdRef.current === null) {
          walk(THREE.MathUtils.clamp(-event.deltaY * (event.ctrlKey ? 0.04 : 0.012), -1.5, 1.5));
          return;
        }
        const zoomDelta = THREE.MathUtils.clamp(
          -event.deltaY * sensitivity,
          -SCENE_ZOOM_STEP,
          SCENE_ZOOM_STEP,
        );
        const nextZoom = THREE.MathUtils.clamp(
          sceneZoomRef.current + zoomDelta,
          MIN_SCENE_ZOOM,
          MAX_SCENE_ZOOM,
        );
        sceneZoomRef.current = nextZoom;
        setSceneZoom(nextZoom);
      };

      const updateBookInspection = () => {
        if (!selectedSceneBook) return;
        getBookInspectionTransform(
          selectedSceneBook.shelfScale,
          camera.position,
          cameraTarget,
          virtualLibraryBookPreviewViewportWidth(viewportWidth, viewportHeight),
          bookInspectionYawTarget,
          bookInspectionPitchTarget,
          bookInspectionZoomTarget,
          bookInspectionTransform,
        );
        if (virtualLibraryUsesCompactViewport(viewportWidth, viewportHeight)) {
          projectedBookPosition.copy(bookInspectionTransform.position).applyMatrix4(camera.matrixWorldInverse);
          bookInspectionTransform.scale.multiplyScalar(virtualLibraryCompactPreviewMultiplier({
            width: viewportWidth,
            height: viewportHeight,
            bookWidth: selectedSceneBook.modelSize.width * bookInspectionTransform.scale.x,
            bookHeight: selectedSceneBook.modelSize.height * bookInspectionTransform.scale.y,
            depth: Math.max(camera.near, -projectedBookPosition.z),
            fov: camera.fov,
            zoom: bookInspectionZoomTarget,
          }));
        }
        const inspectionEase = reducedMotion ? 1 : 0.16;
        selectedSceneBook.group.position.lerp(bookInspectionTransform.position, inspectionEase);
        selectedSceneBook.group.quaternion.slerp(bookInspectionTransform.quaternion, inspectionEase);
        selectedSceneBook.group.scale.lerp(bookInspectionTransform.scale, inspectionEase);
        selectedSceneBook.group.updateMatrixWorld(true);

        const title = selectedBookTitleRef.current;
        if (!title) return;
        bookCaptionAnchor
          .set(0, -selectedSceneBook.modelSize.height / 2 - 0.08, 0)
          .applyMatrix4(selectedSceneBook.group.matrixWorld);
        projectedBookPosition.copy(bookCaptionAnchor).project(camera);
        const horizontalInset = tokens.spacing[3];
        const verticalInset = tokens.spacing[6];
        const titleWidth = Math.min(
          title.offsetWidth || 0,
          Math.max(0, viewportWidth - horizontalInset * 2),
        );
        const titleHeight = title.offsetHeight || 0;
        const minimumLeft = titleWidth / 2 + horizontalInset;
        const maximumLeft = viewportWidth - titleWidth / 2 - horizontalInset;
        const projectedLeft = (projectedBookPosition.x * 0.5 + 0.5) * viewportWidth;
        title.style.left = `${
          maximumLeft < minimumLeft
            ? viewportWidth / 2
            : THREE.MathUtils.clamp(projectedLeft, minimumLeft, maximumLeft)
        }px`;
        title.style.top = `${THREE.MathUtils.clamp(
          (-projectedBookPosition.y * 0.5 + 0.5) * viewportHeight + tokens.spacing[1],
          verticalInset,
          Math.max(verticalInset, viewportHeight - titleHeight - verticalInset),
        )}px`;
      };

      const updateFocusedShelfDiagnostics = () => {
        const sectionId = world.getExpandedShelfSectionId();
        if (sectionId === null) {
          delete canvas.dataset.focusedShelfFrame;
          delete canvas.dataset.focusedShelfBookCount;
          delete canvas.dataset.focusedShelfBookScreenPoints;
          return;
        }
        const info = world.getShelfInfo(sectionId);
        if (info?.centerX !== undefined && info.centerZ !== undefined) {
          canvas.dataset.focusedShelfFrame = JSON.stringify(getReferenceShelfFrame(info).map(corner => {
            const point = corner.project(camera);
            return {x: point.x, y: point.y, z: point.z};
          }));
        }
        const screenPoints = world.sceneBooks
          .filter((sceneBook) => sceneBook.shelfSectionId === sectionId)
          .map((sceneBook) => {
            projectedBookPosition.copy(sceneBook.group.position).project(camera);
            return {
              id: sceneBook.book.id,
              x: Math.round((projectedBookPosition.x * 0.5 + 0.5) * viewportWidth),
              y: Math.round((-projectedBookPosition.y * 0.5 + 0.5) * viewportHeight),
            };
          });
        canvas.dataset.focusedShelfBookCount = String(screenPoints.length);
        canvas.dataset.focusedShelfBookScreenPoints = JSON.stringify(screenPoints);
      };

      let previousRenderTime = 0;
      let previousMovementTime = performance.now();
      let renderedFrameCount = 0;
      let previousRenderState = "";
      const animate = (time: number) => {
        if (disposed) return;
        if (document.hidden || time - previousRenderTime < 1000 / 30) {
          frame = window.requestAnimationFrame(animate);
          return;
        }
        const renderState = [walkingRoute, galleryDistance, cameraYawTargetRef.current, cameraPitchTargetRef.current,
          cameraTargetYRef.current, cameraTargetXZRef.current.x, cameraTargetXZRef.current.z,
          cameraBaseRadius, sceneZoomRef.current, cameraFovTarget, activeRoomRef.current,
          selectedSceneBook?.book.id, world.getExpandedShelfSectionId(), canvas.dataset.hoveredShelfSection,
          bookInspectionYawTarget, bookInspectionPitchTarget, bookInspectionZoomTarget].join("|");
        if (renderState !== previousRenderState) {
          previousRenderState = renderState;
          invalidateScene();
        }
        const cameraSettled = (galleryDistance === null || Math.abs(galleryDistanceCurrent - galleryDistance) < 0.002) && Math.abs(cameraYawCurrent - cameraYawTargetRef.current)
          + Math.abs(cameraPitchCurrent - cameraPitchTargetRef.current)
          + Math.abs(cameraTargetYCurrent - cameraTargetYRef.current)
          + Math.abs(cameraTargetXCurrent - cameraTargetXZRef.current.x)
          + Math.abs(cameraTargetZCurrent - cameraTargetXZRef.current.z)
          + Math.abs(cameraRadiusCurrent - cameraBaseRadius / sceneZoomRef.current) < 0.003
          && Math.abs(camera.fov - cameraFovTarget) < 0.01;
        const bookSettled = !selectedSceneBook || (
          selectedSceneBook.group.position.distanceToSquared(bookInspectionTransform.position) < 0.000001
          && selectedSceneBook.group.scale.distanceToSquared(bookInspectionTransform.scale) < 0.000001
          && selectedSceneBook.group.quaternion.angleTo(bookInspectionTransform.quaternion) < 0.001
        );
        if (time > renderUntil && cameraSettled && bookSettled && activeRoomRef.current === "hall") {
          canvas.dataset.renderState = "idle";
          frame = window.requestAnimationFrame(animate);
          return;
        }
        canvas.dataset.renderState = "active";
        previousRenderTime = time;
        const movementActive = moveContinuously((time - previousMovementTime) * 0.001);
        previousMovementTime = time;
        canvas.dataset.cameraMotion = movementActive ? "continuous" : "idle";
        const elapsed = time * 0.001;
        const cameraEase = reducedMotion ? 1 : 0.16;
        cameraYawCurrent = THREE.MathUtils.lerp(cameraYawCurrent, cameraYawTargetRef.current, cameraEase);
        cameraPitchCurrent = THREE.MathUtils.lerp(cameraPitchCurrent, cameraPitchTargetRef.current, cameraEase);
        cameraTargetYCurrent = THREE.MathUtils.lerp(
          cameraTargetYCurrent,
          cameraTargetYRef.current,
          cameraEase,
        );
        cameraTargetXCurrent = THREE.MathUtils.lerp(
          cameraTargetXCurrent,
          cameraTargetXZRef.current.x,
          cameraEase,
        );
        cameraTargetZCurrent = THREE.MathUtils.lerp(
          cameraTargetZCurrent,
          cameraTargetXZRef.current.z,
          cameraEase,
        );
        cameraRadiusCurrent = THREE.MathUtils.lerp(
          cameraRadiusCurrent,
          cameraBaseRadius / sceneZoomRef.current,
          cameraEase,
        );
        const nextFov = THREE.MathUtils.lerp(camera.fov, cameraFovTarget, cameraEase);
        if (Math.abs(nextFov - camera.fov) > 0.001) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }
        if (galleryDistance !== null) {
          const next=THREE.MathUtils.lerp(galleryDistanceCurrent,galleryDistance,cameraEase);
          galleryDistanceCurrent=galleryDistanceCurrent+THREE.MathUtils.clamp(next-galleryDistanceCurrent,-0.08,0.08);
        }
        positionCamera();
        cameraPose.current = {x: camera.position.x, y: camera.position.y, z: camera.position.z,
          yaw: cameraYawCurrent, pitch: cameraPitchCurrent};
        if (galleryDistance !== null && Math.abs(galleryDistanceCurrent - galleryDistance) < 0.02) {
          freeEye = camera.position.clone();
          const exitView = getReferenceStairExitView(
            stairRoute,
            walkingRoute === 'left-stair' ? 'left' : 'right',
            ACTIVE_HALL.galleryY,
          );
          cameraYawCurrent = cameraYawTargetRef.current = exitView.yaw;
          cameraPitchCurrent = cameraPitchTargetRef.current = exitView.pitch;
          galleryDistance = null; galleryPreviousEye = null;
          setStairWalking(false);
          invalidateScene();
        }
        scene.updateMatrixWorld(true);
        const shadowCameras: THREE.Camera[] = [];
        scene.traverse(object => {
          if (object instanceof THREE.DirectionalLight && object.castShadow) {
            object.shadow.updateMatrices(object);
            shadowCameras.push(object.shadow.camera);
          }
        });
        preparedHall.streaming.updateView(camera, shadowCameras);
        if (activeRoomRef.current !== 'hall') renderer.shadowMap.needsUpdate = true;
        world.animateEnvironment(reducedMotion ? 0 : elapsed);
        updateBookInspection();
        updateFocusedShelfDiagnostics();
        const renderStarted = performance.now();
        renderer.info.reset();
        camera.layers.set(VIRTUAL_LIBRARY_WORLD_LAYER);
        const shadowPassRequested = renderer.shadowMap.needsUpdate;
        renderer.render(scene, camera);
        if (shadowPassRequested) shadowUpdateCount++;
        canvas.dataset.shadowUpdates = String(shadowUpdateCount);
        canvas.dataset.shadowPassRequested = String(shadowPassRequested);
        canvas.dataset.renderFpsLimit = '30';
        if (selectedSceneBook) {
          const autoClear = renderer.autoClear;
          const shadowsEnabled = renderer.shadowMap.enabled;
          const sceneBackground = scene.background;
          const sceneFog = scene.fog;
          renderer.autoClear = false;
          renderer.shadowMap.enabled = false;
          scene.background = null;
          scene.fog = null;
          renderer.clearDepth();
          camera.layers.set(VIRTUAL_LIBRARY_BOOK_PREVIEW_LAYER);
          renderer.render(scene, camera);
          camera.layers.set(VIRTUAL_LIBRARY_WORLD_LAYER);
          scene.background = sceneBackground;
          scene.fog = sceneFog;
          renderer.shadowMap.enabled = shadowsEnabled;
          renderer.autoClear = autoClear;
        }
        if (renderedFrameCount === 0) setSceneLoading(false);
        canvas.dataset.drawCalls = String(renderer.info.render.calls);
        canvas.dataset.triangles = String(renderer.info.render.triangles);
        canvas.dataset.renderCpuMs = (performance.now() - renderStarted).toFixed(1);
        canvas.dataset.renderedFrames = String(++renderedFrameCount);
        canvas.dataset.geometryCount = String(renderer.info.memory.geometries);
        canvas.dataset.textureCount = String(renderer.info.memory.textures);
        frame = window.requestAnimationFrame(animate);
      };

      let resizeFrame = 0;
      const scheduleResize = () => {
        if (disposed || resizeFrame) return;
        resizeFrame = window.requestAnimationFrame(() => {
          resizeFrame = 0;
          if (!disposed) resize();
        });
      };
      const resizeObserver = typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleResize);
      let sceneStopped = false;
      const stopScene = () => {
        if (sceneStopped) return;
        sceneStopped = true;
        disposed = true;
        construction.abort();
        detachSceneActions();
        window.cancelAnimationFrame(frame);
        window.cancelAnimationFrame(resizeFrame);
        resizeObserver?.disconnect();
        window.removeEventListener("resize", scheduleResize);
        window.visualViewport?.removeEventListener("resize", scheduleResize);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        loadingManager.onLoad = () => undefined;
        loadingManager.onProgress = () => undefined;
        loadingManager.onError = () => undefined;
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", endPointer);
        canvas.removeEventListener("pointercancel", endPointer);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("pointerup", endPointer);
        window.removeEventListener("pointercancel", endPointer);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", clearMovementKeys);
        canvas.removeEventListener("blur", clearMovementKeys);
        canvas.removeEventListener("wheel", onWheel);
        delete canvas.dataset.renderedBookModelCount;
        delete canvas.dataset.pendingArchitecturalBooks;
        delete canvas.dataset.shelvedBookModelCount;
        delete canvas.dataset.occupiedShelfBayCount;
        delete canvas.dataset.catalogSyncRevision;
        delete canvas.dataset.staticSceneBuildCount;
        delete canvas.dataset.expandableShelfSectionCount;
        delete canvas.dataset.sceneModel;
        delete canvas.dataset.cameraYaw;
        delete canvas.dataset.cameraPitch;
        delete canvas.dataset.cameraRadius;
        delete canvas.dataset.cameraResolvedRadius;
        delete canvas.dataset.cameraTargetY;
        delete canvas.dataset.cameraTargetX;
        delete canvas.dataset.cameraTargetZ;
        delete canvas.dataset.cameraPositionX;
        delete canvas.dataset.cameraPositionY;
        delete canvas.dataset.cameraPositionZ;
        delete canvas.dataset.cameraFov;
        delete canvas.dataset.cameraCollision;
        delete canvas.dataset.cameraMotion;
        delete canvas.dataset.movementKeys;
        delete canvas.dataset.cameraColliderCount;
        delete canvas.dataset.hallColumnCount;
        delete canvas.dataset.sceneZoom;
        delete canvas.dataset.activeRoom;
        delete canvas.dataset.hoveredShelfSection;
        delete canvas.dataset.hoveredBookId;
        delete canvas.dataset.bookPresentation;
        delete canvas.dataset.inspectedBookId;
        delete canvas.dataset.inspectedBookYaw;
        delete canvas.dataset.inspectedBookPitch;
        delete canvas.dataset.inspectedBookZoom;
        delete canvas.dataset.focusedShelfBookCount;
        delete canvas.dataset.focusedShelfBookScreenPoints;
        roomNavigationRef.current = () => undefined;
        stairAccessRef.current = () => undefined;
        walkRef.current = () => undefined;
        catalogShelfRef.current = () => undefined;
        catalogSyncRef.current = () => undefined;
        architectureRetryRef.current = () => undefined;
        architectureWaitingBooks.clear(); revealDeferredBooks = () => undefined;
        // 通用目录资源清理之前先分离控制器拥有的几何和材质。
        // Detach controller-owned geometry/materials before generic catalog cleanup.
        releaseGraphics();
        delete canvas.dataset.architectureDiagnostics;
        delete canvas.dataset.lightingDiagnostics;
        delete canvas.dataset.shadowUpdates;
        delete canvas.dataset.shadowPassRequested;
        delete canvas.dataset.renderFpsLimit;
        delete canvas.dataset.viewportWidth;
        delete canvas.dataset.viewportHeight;
        delete canvas.dataset.renderPixelRatio;
      };
      cleanupScene = stopScene;
      resizeObserver?.observe(host);
      resize();
      window.addEventListener("resize", scheduleResize);
      window.visualViewport?.addEventListener("resize", scheduleResize);
      document.addEventListener("visibilitychange", onVisibilityChange);
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", endPointer);
      canvas.addEventListener("pointercancel", endPointer);
      canvas.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("pointerup", endPointer);
      window.addEventListener("pointercancel", endPointer);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", clearMovementKeys);
      canvas.addEventListener("blur", clearMovementKeys);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      const shaderCompileStarted = performance.now();
      void renderer.compileAsync(scene, camera).then(() => {
        if (disposed) return;
        canvas.dataset.shaderCompileMs = (performance.now() - shaderCompileStarted).toFixed(1);
        categoryNavigation.attach(focusCategory);
        bookNavigation.attach(focusBook);
        if (document.activeElement === document.body) canvas.focus({ preventScroll: true });
        invalidateScene();
        frame = window.requestAnimationFrame(animate);
      }).catch(failScene);

      return stopScene;
    };

    const initializationFrame = window.requestAnimationFrame(() => {
      setSceneLoading(true);
      setSceneError(false);
      setArchitectureError(null);
      setArchitectureProgress(null);
      setSpatialLoading(false);
      setSelectedShelfInfo(null);
      setExpandedShelfSectionId(null);
      expandedShelfSectionIdRef.current = null;
      void initializeScene().then(cleanup => {
        if (construction.signal.aborted) cleanup?.();
        else cleanupScene = cleanup;
      }).catch(() => {
        const active = !disposed && !construction.signal.aborted;
        disposed = true;
        construction.abort();
        if (active) detachSceneActions();
        cleanupScene?.();
        if (active) setSceneError(true);
      });
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(initializationFrame);
      construction.abort();
      detachSceneActions();
      cleanupScene?.();
      releaseDetachedContext?.();
    };
  }, [categoryNavigation, bookNavigation, sceneAttempt]);

  useEffect(() => {
    catalogBooksRef.current = books;
    catalogSyncRef.current(books);
  }, [books]);

  const requestRoom = (room: LibraryRoomId) => {
    activeRoomRef.current = room;
    setActiveRoom(room);
    roomNavigationRef.current(room);
  };

  const activeRoomDetails = activeRoom === "hall" ? null : ROOM_DETAILS[activeRoom];

  return (
    <div
      className={`virtual-library-page is-rotunda${activeRoomDetails ? " is-room" : ""}${expandedShelfSectionId !== null ? " is-shelf-focused" : ""}${selectedBook ? " is-book-inspecting" : ""}`}
      role="region"
      aria-label="虚拟 3D 图书馆"
      style={VIEWPORT_BOUND_PAGE_STYLE}
    >
      <div ref={sceneHostRef} className="virtual-library-scene">
        <canvas
          tabIndex={0}
          ref={canvasRef}
          className="virtual-library-canvas"
          role="img"
          aria-label={activeRoomDetails ? `${activeRoomDetails.title} 3D 场景` : "可 360 度环视的虚拟图书馆 3D 场景"}
          data-book-model-count={books.length}
          data-static-scene-build-count={staticSceneBuildCountRef.current}
          data-view-preset={viewPreset}
          data-expanded-shelf-section={expandedShelfSectionId ?? ""}
          data-scene-model={VIRTUAL_LIBRARY_SCENE_MODEL_VERSION}
          data-scene-zoom={sceneZoom.toFixed(2)}
          data-active-room={activeRoom}
          data-shelf-primary-category={selectedShelfInfo?.category.id ?? ""}
          data-selected-book-id={selectedBookId ?? ""}
          data-book-presentation={selectedBook ? "inspection" : "shelved"}
        />
      </div>
      <VirtualLibrarySearch open={searchOpen} books={books} onClose={() => setSearchOpen(false)}
        onLocateBook={bookId => bookNavigation.request(bookId)}
        onReadBook={bookId => readerNavigationRef.current(bookId)} />
      <div className="virtual-library-overlay">
        {activeRoom === "hall" ? (
          <Button component={Link} to="/library/all" startIcon={<ArrowBackRounded />} className="virtual-library-back" aria-label="返回书库">
            返回书库
          </Button>
        ) : (
          <Button startIcon={<KeyboardReturnRounded />} className="virtual-library-back" aria-label="返回大厅" onClick={() => requestRoom("hall")}>
            返回大厅
          </Button>
        )}
        {activeRoom === "hall" && walkHelpVisible && (
          <aside className="virtual-library-view-controls" aria-label="操作提示" style={VIEWPORT_BOUND_CONTROLS_STYLE}>
            <div className="virtual-library-help-heading">
              <strong>操作提示</strong>
              <Button variant="text" aria-label="关闭操作提示" onClick={() => setWalkHelpVisible(false)}>×</Button>
            </div>
            <p id="gallery-walk-help" className="virtual-library-walk-help">
              {shelfMovementLocked
                ? "拖动环顾，点击选书；按 Esc 退出书架。"
                : stairWalking
                ? "正在上下楼梯，拖动可环顾。"
                : "W/A/S/D 移动 · Shift 上升 · Ctrl 下降。拖动环顾，滚轮前后移动，双指捏合缩放。"}
            </p>
          </aside>
        )}
        {activeRoomDetails && (
          <div className="virtual-library-heading">
            <h1>{activeRoomDetails.title}</h1>
          </div>
        )}
        {activeRoomDetails && (
          <aside className="virtual-library-inspector is-summary is-room-summary" aria-live="polite">
            <div className="virtual-library-room-summary">
              <span>{activeRoomDetails.label}</span>
              <h2>{activeRoomDetails.title}</h2>
              <p>{activeRoomDetails.description}</p>
            </div>
          </aside>
        )}
        {selectedBook && (
          <div ref={selectedBookTitleRef} className="virtual-library-book-title" role="status" aria-live="polite">
            <Link
              to={`/reader/${encodeURIComponent(selectedBook.id)}`}
              onClick={event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault(); readerNavigationRef.current(selectedBook.id);
              }}
              aria-label={`阅读《${selectedBook.title}》`}
            >
              {selectedBook.title}
            </Link>
          </div>
        )}
        {(booksQuery.isPending || (sceneLoading && !sceneError)) && (
          <div className="virtual-library-status" role="status">
            <CircularProgress size={24} sx={{ color: tokens.color.semantic.textOnDark }} />
            <span>正在点亮藏阁…</span>
          </div>
        )}
        {booksQuery.isError && (
          <div className="virtual-library-status" role="alert">
            <span>{booksQuery.data ? "藏书同步暂时失败，当前显示上次同步的书目。" : "藏书数据暂时未连接，书架无法展开。"}</span>
            <RefreshButton
              className="virtual-library-status-action"
              onClick={() => void booksQuery.refetch()}
            >
              重新加载藏书
            </RefreshButton>
          </div>
        )}
        {catalogSyncError && (
          <div className="virtual-library-status" role="alert">
            <span>{catalogSyncError}</span>
            <RefreshButton
              className="virtual-library-status-action"
              onClick={() => catalogSyncRef.current(catalogBooksRef.current)}
            >
              重新同步藏书
            </RefreshButton>
          </div>
        )}
        {!sceneError && !sceneLoading && architectureError && (
          <div className="virtual-library-status" role="alert">
            <span>{architectureError}</span>
            <Button size="small" onClick={() => architectureRetryRef.current()}>重新加载建筑细节</Button>
          </div>
        )}
        {!sceneError && !sceneLoading && !architectureError && !catalogSyncError && !booksQuery.isError
          && (spatialLoading || architectureProgress) && (
          <div className="virtual-library-status" role="status">
            <span>{spatialLoading ? '正在加载目标区域…' : architectureProgress}</span>
          </div>
        )}
        {sceneError && <div className="virtual-library-status" role="alert"><span>{sceneErrorMessage}</span><Button size="small" onClick={() => setSceneAttempt(attempt => attempt + 1)}>重新加载场景</Button></div>}
        {!booksQuery.isPending && !booksQuery.isError && books.length === 0 && (
          <div className="virtual-library-status" role="status"><EmptyState compact title={EMPTY_CATALOG_TITLE} /></div>
        )}
      </div>
    </div>
  );
}
