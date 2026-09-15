import { ArrowBackRounded } from "@/ui/icons";
import { KeyboardReturnRounded } from "@/ui/icons";
import { RefreshRounded } from "@/ui/icons";
import { Button } from "@/ui/buttons";
import { CircularProgress } from "@/ui/feedback";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { tokens } from "../theme/generated-tokens";
import { classifyCatalogBook, longRoomCatalogSectionCounts, LIBRARY_CATEGORIES } from "./virtual-library-catalog";
import { resolveCameraCollision } from "./virtual-library-collision";
import {
  cameraRelativeWalkDelta,
  isShelfMovementLocked,
  virtualLibraryMovementKey,
  VIRTUAL_LIBRARY_KEYBOARD_WALK_SPEED,
  type VirtualLibraryMovementKey,
} from "./virtual-library-navigation";
import { shouldOpenInspectedBook } from "./virtual-library-interaction";
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
  ROTUNDA_CAMERA_RADIUS,
  ROTUNDA_CENTER,
  VIRTUAL_LIBRARY_BOOK_PREVIEW_LAYER,
  VIRTUAL_LIBRARY_SCENE_MODEL_VERSION,
  VIRTUAL_LIBRARY_WORLD_LAYER,
  type SceneBook,
  type ShelfCategoryInfo,
} from "./virtual-library-scene";
import { LONG_ROOM, HISTORIC_SPIRAL, EAST_GALLERY_CONNECTION } from "./virtual-library-model/longRoomLayout";
import { buildLongRoomProgressively } from "./virtual-library-model/scene/longRoom";
import { LIBRARY } from "./virtual-library-model/config";
import {
  fetchVirtualLibraryBooks,
  VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
  VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
  VIRTUAL_LIBRARY_BOOKS_REFRESH_INTERVAL,
} from "./virtual-library-query";
import {
  LIBRARY_ROOM_CAMERA_VIEW,
  type LibraryRoomId,
} from "./virtual-library-rooms";
import "./virtual-library.css";
import { henryJonesWalkPoint, HENRY_JONES_ROOM_START_DISTANCE, HENRY_JONES_WALK_LENGTH } from "./virtual-library-model/scene/longRoomWestWalk";
import { VirtualLibrarySearch } from "./VirtualLibrarySearch";

import { createDeferredSceneAction } from "./virtual-library-deferred-action";

type ViewPreset = "front" | "free";
type PointerMode = "inspect" | "orbit" | "portal" | "select" | "shelf" | "terminal" | null;

const MIN_SCENE_ZOOM = 0.72;
const MAX_SCENE_ZOOM = 1.55;
const SCENE_ZOOM_STEP = 0.12;
const BOOK_INSPECTION_ZOOM_STEP = 0.1;
const WALKING_EYE_HEIGHT = 1.78;
const MOBILE_ROTUNDA_CENTER_Y = ROTUNDA_CENTER.y * 0.64;
const TABLET_ROTUNDA_CENTER_Y = ROTUNDA_CENTER.y * 0.87;

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneHostRef = useRef<HTMLDivElement | null>(null);
  const selectedBookTitleRef = useRef<HTMLDivElement | null>(null);
  const selectedBookIdRef = useRef<string | null>(null);
  const sceneZoomRef = useRef(1);
  const expandedShelfSectionIdRef = useRef<number | null>(null);
  const activeRoomRef = useRef<LibraryRoomId>("hall");
  const cameraYawTargetRef = useRef(0);
  const cameraPitchTargetRef = useRef<number>(LONG_ROOM.camera.pitch);
  const cameraTargetYRef = useRef(ROTUNDA_CENTER.y);
  const cameraTargetXZRef = useRef({ x: ROTUNDA_CENTER.x, z: ROTUNDA_CENTER.z });
  const roomNavigationRef = useRef<(room: LibraryRoomId) => void>(() => undefined);
  const readerNavigationRef = useRef<(bookId: string) => void>(() => undefined);
  const henryAccessRef = useRef<() => void>(() => undefined);
  const [henryWalking, setHenryWalking] = useState(false);
  const walkRef = useRef<(direction: number) => void>(() => undefined);
  const [categoryNavigation] = useState(() => createDeferredSceneAction<string>());
  const catalogShelfRef = useRef<() => void>(() => undefined);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [sceneZoom, setSceneZoom] = useState(1);
  const [expandedShelfSectionId, setExpandedShelfSectionId] = useState<number | null>(null);
  const shelfMovementLocked = isShelfMovementLocked(expandedShelfSectionId);
  const [selectedShelfInfo, setSelectedShelfInfo] = useState<ShelfCategoryInfo | null>(null);
  const [activeRoom, setActiveRoom] = useState<LibraryRoomId>("hall");
  const [viewPreset, setViewPreset] = useState<ViewPreset>("front");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchOpenRef = useRef(false);
  searchOpenRef.current = searchOpen;
  const [sceneError, setSceneError] = useState(false);
  const [sceneLoading, setSceneLoading] = useState(true);
  const booksQuery = useQuery({
    queryKey: VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
    queryFn: ({ signal }) => fetchVirtualLibraryBooks(signal),
    staleTime: VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
    refetchInterval: VIRTUAL_LIBRARY_BOOKS_REFRESH_INTERVAL,
    refetchOnMount: "always",
  });
  const books = useMemo(() => booksQuery.data?.pages.flatMap(page => page.items) ?? [], [booksQuery.data]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    books.forEach(book => {const id = classifyCatalogBook(book).category.id; counts.set(id, (counts.get(id) ?? 0) + 1);});
    return counts;
  }, [books]);
  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId],
  );
  readerNavigationRef.current = (bookId) => {
    navigate(`/reader/${encodeURIComponent(bookId)}`);
  };

  useEffect(() => {
    if (selectedBookId && !selectedBook) setSelectedBookId(null);
    selectedBookIdRef.current = selectedBook?.id ?? null;
  }, [selectedBook, selectedBookId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = sceneHostRef.current;
    if (!canvas || !host || books.length === 0) return undefined;
    let cleanupScene: (() => void) | undefined;
    const construction = new AbortController();

    const initializeScene = async (): Promise<(() => void) | undefined> => {
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

      setSceneError(false);
      setHenryWalking(false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = LIBRARY.atmosphere.exposure;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.info.autoReset = false;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(tokens.color.primitive.ink900);
      scene.fog = new THREE.FogExp2(tokens.color.primitive.ink900, 0.0025);
      const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 120);
      let renderUntil = performance.now() + 1800;
      const invalidateScene = () => { renderUntil = performance.now() + 1800; };
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

      const worldBuildStarted = performance.now();
      const textureLoader = new THREE.TextureLoader(loadingManager);
      let longestBuildSlice = 0, westBuildMaxSlice = 0, westBuildCpuMs = 0;
      const batchPhases: Record<string, {count: number; totalMs: number; maxMs: number}> = {};
      let preparedHall;
      try {
        preparedHall = await buildLongRoomProgressively(longRoomCatalogSectionCounts(books), textureLoader, construction.signal,
          (milliseconds, stage) => {
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
          });
      } catch {
        renderer.dispose();
        if (!construction.signal.aborted) setSceneError(true);
        return undefined;
      }
      const finalizeStarted = performance.now();
      const world = createVirtualLibraryWorld(
        scene,
        books,
        textureLoader,
        Math.min(12, renderer.capabilities.getMaxAnisotropy()),
        preparedHall,
      );
      canvas.dataset.worldFinalizeMs = (performance.now() - finalizeStarted).toFixed(1);
      canvas.dataset.longestBuildSliceMs = longestBuildSlice.toFixed(1);
      canvas.dataset.westBuildMaxSliceMs = westBuildMaxSlice.toFixed(1);
      canvas.dataset.westBuildCpuMs = westBuildCpuMs.toFixed(1);
      canvas.dataset.batchPhaseTimings = JSON.stringify(batchPhases);
      canvas.dataset.worldBuildMs = (performance.now() - worldBuildStarted).toFixed(1);
      let selectedSceneBook = world.sceneBooks.find(
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
      canvas.dataset.renderedBookModelCount = String(world.sceneBooks.length);
      canvas.dataset.shelvedBookModelCount = String(world.sceneBooks.length - (selectedSceneBook ? 1 : 0));
      canvas.dataset.sceneModel = VIRTUAL_LIBRARY_SCENE_MODEL_VERSION;
      canvas.dataset.occupiedShelfBayCount = String(new Set(
        world.sceneBooks.map((sceneBook) => sceneBook.group.userData.shelfBayIndex as number),
      ).size);
      canvas.dataset.expandableShelfSectionCount = String(world.shelfHitMeshes.length);
      canvas.dataset.activeRoom = activeRoomRef.current;
      canvas.dataset.bookPresentation = selectedSceneBook ? "inspection" : "shelved";

      const raycaster = new THREE.Raycaster();
      raycaster.layers.enable(VIRTUAL_LIBRARY_BOOK_PREVIEW_LAYER);
      const pointer = new THREE.Vector2();
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
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let frame = 0;
      let disposed = false;

      const updateCameraSettings = () => {
        if (activeRoomRef.current !== "hall") {
          const roomView = viewportWidth <= LIBRARY_ROOM_CAMERA_VIEW.mobileBreakpoint
            ? LIBRARY_ROOM_CAMERA_VIEW.mobile
            : LIBRARY_ROOM_CAMERA_VIEW.desktop;
          cameraBaseRadius = roomView.radius;
          cameraFovTarget = roomView.fov;
          cameraTargetYBase = roomView.targetY;
        } else if (expandedShelfSectionIdRef.current !== null) {
          cameraBaseRadius = 2.8;
          const info = world.getShelfInfo(expandedShelfSectionIdRef.current);
          const span = Math.max(info?.height ?? LONG_ROOM.lowerCaseHeight,
            (info?.width ?? 3.76) / (viewportWidth / viewportHeight));
          cameraFovTarget = THREE.MathUtils.radToDeg(2 * Math.atan(span * 1.12 / (2 * (cameraBaseRadius / sceneZoomRef.current))));
          cameraTargetYBase = LONG_ROOM.lowerCaseHeight / 2;
        } else if (viewportWidth <= 720) {
          cameraBaseRadius = ROTUNDA_CAMERA_RADIUS - 0.5;
          cameraFovTarget = 62;
          cameraTargetYBase = MOBILE_ROTUNDA_CENTER_Y;
        } else if (viewportWidth <= 1060) {
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
      let shelfFacingYaw = 0;
      let galleryDistance: number | null = null;
      const walkingRoute = 'henry';
      const walkLength = () => HENRY_JONES_WALK_LENGTH;
      const walkMinimum = () => HENRY_JONES_ROOM_START_DISTANCE;
      const walkPoint = henryJonesWalkPoint;
      let galleryDistanceCurrent = 0;
      let galleryPreviousEye: {x: number; y: number; z: number} | null = null;
      const galleryWalkOffset = new THREE.Vector3();
      let galleryLookYaw = 0, galleryLookPitch = 0;
      const walkingLook = new THREE.Vector3();
      const walkingUp = new THREE.Vector3(0, 1, 0);
      const movementLook = new THREE.Vector3();
      const pressedMovementKeys = new Set<VirtualLibraryMovementKey>();
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
        const desiredPosition = activeCameraRoom === "hall" ? {
          x: THREE.MathUtils.clamp(desiredX, -LONG_ROOM.width / 2 + 0.38, LONG_ROOM.width / 2 - 0.38),
          y: THREE.MathUtils.clamp(desiredY, WALKING_EYE_HEIGHT, LONG_ROOM.height - 0.4),
          z: THREE.MathUtils.clamp(desiredZ, -LONG_ROOM.length / 2 + 0.38, LONG_ROOM.length / 2 - 0.38),
        } : { x: desiredX, y: desiredY, z: desiredZ };
        let collision = resolveCameraCollision(
          hasPositionedCamera && previousCameraRoom === activeCameraRoom
            ? { x: camera.position.x, y: camera.position.y, z: camera.position.z }
            : desiredPosition,
          desiredPosition,
          colliders,
        );
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
          // Sweep from the previous eye, not from the ground or the orbit camera.
          const safe = resolveCameraCollision(galleryPreviousEye ?? resolved, resolved, colliders);
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
          canvas.dataset.walkFloor = point.y >= EAST_GALLERY_CONNECTION.upperFloor - 0.05 ? "2" : "1";
        } else {
          delete canvas.dataset.walkDistance; delete canvas.dataset.walkFloor;
          delete canvas.dataset.walkRoute; delete canvas.dataset.walkLength;
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
        const width = host.clientWidth || window.innerWidth;
        const height = host.clientHeight || window.innerHeight;
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
        renderer.setSize(width, height, false);
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
        const terminalHit = raycaster.intersectObject(world.catalogTerminal, true)[0];
        if (terminalHit && world.catalogTerminal.parent) {
          const surface = raycaster.intersectObject(world.catalogTerminal.parent, true)[0];
          if (!surface || surface.distance >= terminalHit.distance - 0.001) {
            return { book: null, shelfSectionId: null, portalRoom: null, terminal: true };
          }
        }
        const bookHit = raycaster.intersectObjects(world.interactiveMeshes, false)[0];
        const book = bookHit ? findSceneBook(bookHit.object) : null;
        if (book) {
          if (world.getExpandedShelfSectionId() === book.shelfSectionId) {
            return { book, shelfSectionId: null, portalRoom: null, terminal: false };
          }
          return { book: null, shelfSectionId: book.shelfSectionId, portalRoom: null, terminal: false };
        }
        const portalHit = raycaster.intersectObjects(world.portalHitMeshes, false)[0];
        const portalRoom = portalHit ? findPortalRoom(portalHit.object) : null;
        if (portalRoom) return { book: null, shelfSectionId: null, portalRoom, terminal: false };
        const shelfHit = raycaster.intersectObjects(world.shelfHitMeshes, false)[0];
        return {
          terminal: false,
          book: null,
          shelfSectionId: shelfHit ? findShelfSectionId(shelfHit.object) : null,
          portalRoom: null,
        };
      };
      const resetShelfFocus = () => {
        freeEye = null;
        cameraTargetXZRef.current = { x: ROTUNDA_CENTER.x, z: ROTUNDA_CENTER.z };
        cameraPitchTargetRef.current = LONG_ROOM.camera.pitch;
        sceneZoomRef.current = 1;
        setSceneZoom(1);
        setSelectedShelfInfo(null);
        updateCameraSettings();
        cameraTargetYRef.current = cameraTargetYBase;
      };
      const collapseFocusedShelf = () => {
        world.collapseShelfSections();
        expandedShelfSectionIdRef.current = null;
        setExpandedShelfSectionId(null);
        resetShelfFocus();
      };
      const focusShelf = (sectionId: number) => {
        pressedMovementKeys.clear();
        canvas.dataset.movementKeys = "";
        freeEye = null;
        galleryDistance = null; setHenryWalking(false);
        const info = world.getShelfInfo(sectionId);
        if (!info) return;
        const besideHistoricStair = info.centerX !== undefined && info.centerZ !== undefined
          && Math.abs(info.centerX - HISTORIC_SPIRAL.x) < 1
          && Math.abs(info.centerZ - HISTORIC_SPIRAL.z) < 3;
        const requestedYaw = -info.angle - Math.PI / 2 + (besideHistoricStair ? 0.65 : 0);
        const currentYaw = cameraYawTargetRef.current;
        const shortestTurn = Math.atan2(
          Math.sin(requestedYaw - currentYaw),
          Math.cos(requestedYaw - currentYaw),
        );
        cameraYawTargetRef.current = currentYaw + shortestTurn;
        cameraPitchTargetRef.current = info.targetY > LONG_ROOM.galleryY ? 0.035 : -0.045;
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
      catalogShelfRef.current = () => {
        galleryDistance = null; setHenryWalking(false);
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
      const selectBook = (sceneBook: SceneBook) => {
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
        cameraPitchTargetRef.current = room === "hall" ? LONG_ROOM.camera.pitch : -0.055;
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
        const target = hitTestTargets(event);
        world.setHoveredShelfSection(target.shelfSectionId);
        if (target.shelfSectionId !== null) canvas.dataset.hoveredShelfSection = String(target.shelfSectionId);
        else delete canvas.dataset.hoveredShelfSection;
        if (target.book) canvas.dataset.hoveredBookId = target.book.book.id;
        else delete canvas.dataset.hoveredBookId;
        canvas.style.cursor = target.terminal || target.book || target.portalRoom || target.shelfSectionId !== null ? "pointer" : "grab";
      };
      const endPointer = (event: PointerEvent) => {
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
      henryAccessRef.current = () => {
        if(galleryDistance !== null && walkingRoute === 'henry') {
          const entrance=henryJonesWalkPoint(0);
          freeEye=new THREE.Vector3(entrance.x,entrance.y+WALKING_EYE_HEIGHT,entrance.z);
          cameraYawCurrent=cameraYawTargetRef.current=Math.PI;
          cameraPitchCurrent=cameraPitchTargetRef.current=0;
          galleryDistance=null; galleryPreviousEye=null; hasPositionedCamera=false;
          galleryWalkOffset.set(0, 0, 0);
          setHenryWalking(false);
        } else {
          clearSelectedBook(); collapseFocusedShelf();
          freeEye=null; galleryPreviousEye=null;
          galleryDistance=walkMinimum(); galleryDistanceCurrent=walkMinimum();
          galleryWalkOffset.set(0, 0, 0);
          galleryLookYaw=cameraYawCurrent; galleryLookPitch=cameraPitchCurrent;
          setHenryWalking(true);
        }
        invalidateScene();
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
        const safe = resolveCameraCollision(freeEye, desired, world.getCameraColliders("hall"));
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
        && !selectedSceneBook
        && !isShelfMovementLocked(expandedShelfSectionIdRef.current)
        && !searchOpenRef.current;
      const moveContinuously = (deltaSeconds: number) => {
        if (pressedMovementKeys.size === 0 || !canMoveContinuously()) return false;
        camera.getWorldDirection(movementLook);
        movementLook.y = 0;
        if (movementLook.lengthSq() < 0.0001) return false;
        movementLook.normalize();
        const movementYaw = Math.atan2(-movementLook.x, -movementLook.z);
        const delta = cameraRelativeWalkDelta(
          movementYaw,
          pressedMovementKeys,
          VIRTUAL_LIBRARY_KEYBOARD_WALK_SPEED * Math.min(deltaSeconds, 0.05),
        );
        if (!delta) return false;

        const colliders = world.getCameraColliders("hall");
        if (galleryDistance !== null) {
          const point = walkPoint(galleryDistanceCurrent);
          const previous = galleryPreviousEye ?? {
            x: point.x + galleryWalkOffset.x,
            y: point.y + WALKING_EYE_HEIGHT,
            z: point.z + galleryWalkOffset.z,
          };
          const safe = resolveCameraCollision(previous, {
            x: previous.x + delta.x,
            y: previous.y,
            z: previous.z + delta.z,
          }, colliders);
          galleryWalkOffset.x += safe.x - previous.x;
          galleryWalkOffset.z += safe.z - previous.z;
          galleryPreviousEye = {x: safe.x, y: safe.y, z: safe.z};
        } else {
          freeEye ??= camera.position.clone();
          const safe = resolveCameraCollision(freeEye, {
            x: freeEye.x + delta.x,
            y: freeEye.y,
            z: freeEye.z + delta.z,
          }, colliders);
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
          viewportWidth,
          bookInspectionYawTarget,
          bookInspectionPitchTarget,
          bookInspectionZoomTarget,
          bookInspectionTransform,
        );
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
        title.style.left = `${THREE.MathUtils.clamp(
          (projectedBookPosition.x * 0.5 + 0.5) * viewportWidth,
          72,
          viewportWidth - 72,
        )}px`;
        title.style.top = `${THREE.MathUtils.clamp(
          (-projectedBookPosition.y * 0.5 + 0.5) * viewportHeight + 10,
          72,
          viewportHeight - 56,
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
          canvas.dataset.focusedShelfFrame = JSON.stringify([-1, 1].flatMap(side => [0, info.height].map(y => {
            const point = new THREE.Vector3(info.centerX! + side * info.width / 2, y, info.centerZ! + info.depth / 2).project(camera);
            return {x: point.x, y: point.y, z: point.z};
          })));
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
        world.animateEnvironment(reducedMotion ? 0 : elapsed);
        updateBookInspection();
        updateFocusedShelfDiagnostics();
        const renderStarted = performance.now();
        renderer.info.reset();
        camera.layers.set(VIRTUAL_LIBRARY_WORLD_LAYER);
        renderer.render(scene, camera);
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

      resize();
      window.addEventListener("resize", resize);
      document.addEventListener("visibilitychange", onVisibilityChange);
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", endPointer);
      canvas.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("pointerup", endPointer);
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
        if (document.activeElement === document.body) canvas.focus({ preventScroll: true });
        invalidateScene();
        frame = window.requestAnimationFrame(animate);
      }).catch(() => {
        if (!disposed) setSceneError(true);
      });

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        loadingManager.onLoad = () => undefined;
        loadingManager.onProgress = () => undefined;
        loadingManager.onError = () => undefined;
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", endPointer);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("pointerup", endPointer);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", clearMovementKeys);
        canvas.removeEventListener("blur", clearMovementKeys);
        canvas.removeEventListener("wheel", onWheel);
        delete canvas.dataset.renderedBookModelCount;
        delete canvas.dataset.shelvedBookModelCount;
        delete canvas.dataset.occupiedShelfBayCount;
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
        henryAccessRef.current = () => undefined;
        walkRef.current = () => undefined;
        catalogShelfRef.current = () => undefined;
        disposeScene(scene);

        renderer.dispose();
      };
    };

    const initializationFrame = window.requestAnimationFrame(() => {
      setSceneLoading(true);
      setSceneError(false);
      setSelectedShelfInfo(null);
      setExpandedShelfSectionId(null);
      expandedShelfSectionIdRef.current = null;
      void initializeScene().then(cleanup => {
        if (construction.signal.aborted) cleanup?.();
        else cleanupScene = cleanup;
      }).catch(() => {
        if (!construction.signal.aborted) setSceneError(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(initializationFrame);
      construction.abort();
      categoryNavigation.detach();
      cleanupScene?.();
    };
  }, [books, categoryNavigation]);

  const requestRoom = (room: LibraryRoomId) => {
    activeRoomRef.current = room;
    setActiveRoom(room);
    roomNavigationRef.current(room);
  };

  const activeRoomDetails = activeRoom === "hall" ? null : ROOM_DETAILS[activeRoom];

  return (
    <div className={`virtual-library-page is-rotunda${activeRoomDetails ? " is-room" : ""}${expandedShelfSectionId !== null ? " is-shelf-focused" : ""}${selectedBook ? " is-book-inspecting" : ""}`} role="region" aria-label="虚拟 3D 图书馆">
      <div ref={sceneHostRef} className="virtual-library-scene">
        <canvas
          tabIndex={0}
          ref={canvasRef}
          className="virtual-library-canvas"
          role="img"
          aria-label={activeRoomDetails ? `${activeRoomDetails.title} 3D 场景` : "可 360 度环视的虚拟图书馆 3D 场景"}
          data-book-model-count={books.length}
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
      <VirtualLibrarySearch open={searchOpen} books={books} onClose={() => setSearchOpen(false)} />
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
        {activeRoom === "hall" && (
          <nav className="virtual-library-view-controls" aria-label="图书馆区域切换">
            <div className="virtual-library-space-shortcuts" aria-label="步行与藏书">
              <Button disabled={shelfMovementLocked} onClick={() => walkRef.current(-1)} aria-label="沿长厅后退">后退</Button>
              <Button disabled={shelfMovementLocked} onClick={() => walkRef.current(1)} aria-label="沿长厅前行">前行</Button>
              <Button onClick={() => catalogShelfRef.current()}>我的藏书</Button>
              <Button onClick={() => setSearchOpen(true)} aria-label="搜索私人藏书">搜索藏书</Button>
            </div>
            <div className="virtual-library-space-shortcuts" aria-label="藏书分区">
              {LIBRARY_CATEGORIES.filter(category => categoryCounts.has(category.id)).map(category => (
                <Button key={category.id} aria-pressed={selectedShelfInfo?.category.id === category.id}
                  onClick={() => categoryNavigation.request(category.id)}>{category.label} · {categoryCounts.get(category.id)}</Button>
              ))}
            </div>
            <p id="gallery-walk-help" className="virtual-library-walk-help">
              {shelfMovementLocked
                ? "当前面向书架，前行与后退已锁定；可拖动环顾、选择书籍，按 Esc 退出书架。"
                : henryWalking
                ? "已切换至 Henry Jones 室；按住 W/A/S/D 可连续前后与左右平移，拖动环顾，点击返回长厅。"
                : "按住 W/A/S/D 可沿视角连续前后与左右平移，滚轮也可前后移动，拖动环顾。"}
            </p>
          </nav>
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
              aria-label={`阅读《${selectedBook.title}》`}
            >
              {selectedBook.title}
            </Link>
          </div>
        )}
        {(booksQuery.isPending || (sceneLoading && books.length > 0 && !sceneError)) && (
          <div className="virtual-library-status" role="status">
            <CircularProgress size={24} sx={{ color: tokens.color.semantic.textOnDark }} />
            <span>正在点亮藏阁…</span>
          </div>
        )}
        {booksQuery.isError && (
          <div className="virtual-library-status" role="alert">
            <span>{booksQuery.data ? "藏书同步暂时失败，当前显示上次同步的书目。" : "藏书数据暂时未连接，书架无法展开。"}</span>
            <Button
              className="virtual-library-status-action"
              size="small"
              startIcon={<RefreshRounded />}
              onClick={() => void booksQuery.refetch()}
            >
              重新加载藏书
            </Button>
          </div>
        )}
        {sceneError && <div className="virtual-library-status" role="alert"><span>当前浏览器无法加载 3D 场景，请启用硬件加速后重试。</span></div>}
        {!booksQuery.isPending && !booksQuery.isError && books.length === 0 && (
          <div className="virtual-library-status" role="status"><span>书库里还没有可展示的 EPUB 或 PDF。</span></div>
        )}
      </div>
    </div>
  );
}
