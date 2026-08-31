import {
  ArrowBackRounded,
  KeyboardReturnRounded,
  LockRounded,
  MeetingRoomRounded,
  RefreshRounded,
} from "@mui/icons-material";
import { Button, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { tokens } from "../theme/generated-tokens";
import { resolveCameraCollision } from "./virtual-library-collision";
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
  ROTUNDA_CAMERA_RADIUS,
  ROTUNDA_CENTER,
  VIRTUAL_LIBRARY_SCENE_MODEL_VERSION,
  type SceneBook,
  type ShelfCategoryInfo,
} from "./virtual-library-scene";
import { LIBRARY } from "./virtual-library-model/config";
import {
  fetchVirtualLibraryBooks,
  VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
  VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
} from "./virtual-library-query";
import {
  LIBRARY_ROOM_CAMERA_VIEW,
  type LibraryRoomId,
} from "./virtual-library-rooms";
import "./virtual-library.css";

type ViewPreset = "front" | "free";
type PointerMode = "inspect" | "orbit" | "portal" | "select" | "shelf" | null;

const MIN_SCENE_ZOOM = 0.72;
const MAX_SCENE_ZOOM = 1.55;
const SCENE_ZOOM_STEP = 0.12;
const BOOK_INSPECTION_ZOOM_STEP = 0.1;
const MOBILE_ROTUNDA_CENTER_Y = 3.45;
const TABLET_ROTUNDA_CENTER_Y = 4.7;

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
  const cameraPitchTargetRef = useRef(-0.1);
  const cameraTargetYRef = useRef(ROTUNDA_CENTER.y);
  const cameraTargetXZRef = useRef({ x: ROTUNDA_CENTER.x, z: ROTUNDA_CENTER.z });
  const roomNavigationRef = useRef<(room: LibraryRoomId) => void>(() => undefined);
  const readerNavigationRef = useRef<(bookId: string) => void>(() => undefined);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [sceneZoom, setSceneZoom] = useState(1);
  const [expandedShelfSectionId, setExpandedShelfSectionId] = useState<number | null>(null);
  const [selectedShelfInfo, setSelectedShelfInfo] = useState<ShelfCategoryInfo | null>(null);
  const [activeRoom, setActiveRoom] = useState<LibraryRoomId>("hall");
  const [viewPreset, setViewPreset] = useState<ViewPreset>("front");
  const [sceneError, setSceneError] = useState(false);
  const booksQuery = useQuery({
    queryKey: VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
    queryFn: ({ signal }) => fetchVirtualLibraryBooks(signal),
    staleTime: VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
    refetchInterval: 60_000,
  });
  const books = booksQuery.data?.items ?? [];
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

    const initializeScene = (): (() => void) | undefined => {
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = LIBRARY.atmosphere.exposure;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(tokens.color.primitive.ink900);
      scene.fog = new THREE.FogExp2(tokens.color.primitive.ink900, 0.012);
      const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 120);
      const composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        LIBRARY.atmosphere.bloomStrength,
        LIBRARY.atmosphere.bloomRadius,
        LIBRARY.atmosphere.bloomThreshold,
      ));
      composer.addPass(new OutputPass());
      const cameraTarget = ROTUNDA_CENTER.clone();
      let cameraBaseRadius = ROTUNDA_CAMERA_RADIUS;
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

      const world = createVirtualLibraryWorld(
        scene,
        books,
        new THREE.TextureLoader(),
        Math.min(12, renderer.capabilities.getMaxAnisotropy()),
      );
      let selectedSceneBook = world.sceneBooks.find(
        (sceneBook) => sceneBook.book.id === selectedBookIdRef.current,
      ) ?? null;
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
          cameraBaseRadius = viewportWidth <= 720 ? 8.8 : 6.9;
          cameraFovTarget = viewportWidth <= 720 ? 58 : 52;
          cameraTargetYBase = viewportWidth <= 720 ? 3.2 : ROTUNDA_CENTER.y;
        } else if (viewportWidth <= 720) {
          cameraBaseRadius = 11.2;
          cameraFovTarget = 62;
          cameraTargetYBase = MOBILE_ROTUNDA_CENTER_Y;
        } else if (viewportWidth <= 1060) {
          cameraBaseRadius = 11.45;
          cameraFovTarget = 58;
          cameraTargetYBase = TABLET_ROTUNDA_CENTER_Y;
        } else {
          cameraBaseRadius = ROTUNDA_CAMERA_RADIUS;
          cameraFovTarget = 58;
          cameraTargetYBase = ROTUNDA_CENTER.y;
        }
        if (expandedShelfSectionIdRef.current === null) cameraTargetYRef.current = cameraTargetYBase;
      };

      const positionCamera = () => {
        cameraTarget.x = cameraTargetXCurrent;
        cameraTarget.y = cameraTargetYCurrent;
        cameraTarget.z = cameraTargetZCurrent;
        const planarRadius = Math.cos(cameraPitchCurrent) * cameraRadiusCurrent;
        const desiredX = cameraTarget.x + Math.sin(cameraYawCurrent) * planarRadius;
        const desiredY = cameraTarget.y + Math.sin(cameraPitchCurrent) * cameraRadiusCurrent;
        const desiredZ = cameraTarget.z + Math.cos(cameraYawCurrent) * planarRadius;
        const activeCameraRoom = activeRoomRef.current;
        const colliders = world.getCameraColliders(activeCameraRoom);
        const desiredPosition = { x: desiredX, y: desiredY, z: desiredZ };
        const collision = resolveCameraCollision(
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
        composer.setSize(width, height);
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
          return { book: null, shelfSectionId: null, portalRoom: null };
        }
        const bookHit = raycaster.intersectObjects(world.interactiveMeshes, false)[0];
        const book = bookHit ? findSceneBook(bookHit.object) : null;
        if (book) {
          if (world.getExpandedShelfSectionId() === book.shelfSectionId) {
            return { book, shelfSectionId: null, portalRoom: null };
          }
          return { book: null, shelfSectionId: book.shelfSectionId, portalRoom: null };
        }
        const portalHit = raycaster.intersectObjects(world.portalHitMeshes, false)[0];
        const portalRoom = portalHit ? findPortalRoom(portalHit.object) : null;
        if (portalRoom) return { book: null, shelfSectionId: null, portalRoom };
        const shelfHit = raycaster.intersectObjects(world.shelfHitMeshes, false)[0];
        return {
          book: null,
          shelfSectionId: shelfHit ? findShelfSectionId(shelfHit.object) : null,
          portalRoom: null,
        };
      };
      const resetShelfFocus = () => {
        cameraTargetXZRef.current = { x: ROTUNDA_CENTER.x, z: ROTUNDA_CENTER.z };
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
        const info = world.getShelfInfo(sectionId);
        if (!info) return;
        const requestedYaw = -info.angle - Math.PI / 2;
        const currentYaw = cameraYawTargetRef.current;
        const shortestTurn = Math.atan2(
          Math.sin(requestedYaw - currentYaw),
          Math.cos(requestedYaw - currentYaw),
        );
        cameraYawTargetRef.current = currentYaw + shortestTurn;
        cameraPitchTargetRef.current = info.targetY > LIBRARY.tower.galleryY ? 0.035 : -0.045;
        const shelfFaceRadius = info.radius - info.depth * 0.56;
        cameraTargetXZRef.current = {
          x: Math.cos(info.angle) * shelfFaceRadius,
          z: Math.sin(info.angle) * shelfFaceRadius,
        };
        cameraTargetYRef.current = viewportWidth <= 720 ? info.targetY - 0.82 : info.targetY;
        updateCameraSettings();
        sceneZoomRef.current = viewportWidth <= 720 ? 1.06 : 1.12;
        setSceneZoom(sceneZoomRef.current);
        setSelectedShelfInfo(info);
        setViewPreset("free");
      };
      const selectBook = (sceneBook: SceneBook) => {
        if (selectedSceneBook && selectedSceneBook !== sceneBook) {
          selectedSceneBook.group.userData.bookPresentation = "shelved";
          placeSceneBookOnShelf(selectedSceneBook);
        }
        selectedSceneBook = sceneBook;
        sceneBook.group.userData.bookPresentation = "inspection";
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
        cameraPitchTargetRef.current = room === "hall" ? -0.1 : -0.055;
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
        pointerState.mode = sceneBook
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
          const nextYaw = cameraYawTargetRef.current - deltaX * 0.008;
          cameraYawTargetRef.current = activeRoomRef.current === "hall"
            ? nextYaw
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
        canvas.style.cursor = target.book || target.portalRoom || target.shelfSectionId !== null ? "pointer" : "grab";
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
      const onKeyDown = (event: KeyboardEvent) => {
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
          selectedSceneBook.modelSize,
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
          delete canvas.dataset.focusedShelfBookCount;
          delete canvas.dataset.focusedShelfBookScreenPoints;
          return;
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

      const animate = (time: number) => {
        if (disposed) return;
        const elapsed = time * 0.001;
        const cameraEase = reducedMotion ? 1 : 0.085;
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
        positionCamera();
        world.animateEnvironment(reducedMotion ? 0 : elapsed);
        updateBookInspection();
        updateFocusedShelfDiagnostics();
        composer.render();
        frame = window.requestAnimationFrame(animate);
      };

      resize();
      window.addEventListener("resize", resize);
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", endPointer);
      canvas.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("pointerup", endPointer);
      window.addEventListener("keydown", onKeyDown);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      frame = window.requestAnimationFrame(animate);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", endPointer);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("pointerup", endPointer);
        window.removeEventListener("keydown", onKeyDown);
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
        disposeScene(scene);
        composer.dispose();
        renderer.dispose();
      };
    };

    const initializationFrame = window.requestAnimationFrame(() => {
      cleanupScene = initializeScene();
    });

    return () => {
      window.cancelAnimationFrame(initializationFrame);
      cleanupScene?.();
    };
  }, [books]);

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
      <div className="virtual-library-overlay">
        {activeRoom === "hall" ? (
          <Button component={Link} to="/library" startIcon={<ArrowBackRounded />} className="virtual-library-back" aria-label="返回书库">
            返回书库
          </Button>
        ) : (
          <Button startIcon={<KeyboardReturnRounded />} className="virtual-library-back" aria-label="返回大厅" onClick={() => requestRoom("hall")}>
            返回大厅
          </Button>
        )}
        {activeRoom === "hall" && (
          <nav className="virtual-library-view-controls" aria-label="图书馆区域切换">
            <div className="virtual-library-space-shortcuts" aria-label="独立空间入口">
              <Button startIcon={<LockRounded />} onClick={() => requestRoom("restricted")}>禁书区</Button>
              <Button startIcon={<MeetingRoomRounded />} onClick={() => requestRoom("director")}>馆长办公室</Button>
            </div>
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
        {booksQuery.isPending && (
          <div className="virtual-library-status" role="status">
            <CircularProgress size={24} sx={{ color: tokens.color.semantic.textOnDark }} />
            <span>正在点亮藏阁…</span>
          </div>
        )}
        {booksQuery.isError && (
          <div className="virtual-library-status" role="alert">
            <span>藏书数据暂时未连接，书架无法展开。</span>
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
