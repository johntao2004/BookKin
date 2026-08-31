import * as THREE from "three";
import { vi } from "vitest";
import {
  CAMERA_COLLISION_CLEARANCE,
  collectCameraColliders,
  HALL_COLUMN_COLLIDERS,
  markCameraCollider,
  resolveCameraCollision,
  type BoxCameraCollider,
  type CylinderCameraCollider,
  type RadialBoundaryCameraCollider,
} from "./virtual-library-collision";
import { buildLibraryScene } from "./virtual-library-model/scene/buildLibrary";
import { createVirtualLibraryRooms } from "./virtual-library-rooms";

const hallBox: BoxCameraCollider = {
  id: "test-box",
  room: "hall",
  shape: "box",
  x: 0,
  y: 1,
  z: 0,
  halfX: 0.5,
  halfY: 1,
  halfZ: 0.5,
  rotationY: 0,
};

function withMockCanvas<T>(run: () => T) {
  const gradient = { addColorStop: () => undefined };
  const context = new Proxy<Record<string, unknown>>({}, {
    get: (_target, property) => {
      if (property === "createLinearGradient" || property === "createRadialGradient") {
        return () => gradient;
      }
      if (property === "getImageData") {
        return () => ({ data: new Uint8ClampedArray() });
      }
      return () => undefined;
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(() => context);
  const textureSpy = vi.spyOn(THREE.TextureLoader.prototype, "load")
    .mockImplementation(() => new THREE.Texture());
  try {
    return run();
  } finally {
    textureSpy.mockRestore();
    contextSpy.mockRestore();
  }
}

describe("virtual library camera collision", () => {
  it("sweeps the complete movement segment so a fast jump cannot tunnel through a solid", () => {
    const column: CylinderCameraCollider = {
      id: "fast-column",
      room: "hall",
      shape: "cylinder",
      x: 0,
      z: 0,
      radius: 0.45,
      minY: 0,
      maxY: 6.2,
    };

    const result = resolveCameraCollision(
      { x: 0, y: 3, z: 4 },
      { x: 0, y: 3, z: -4 },
      [column],
    );

    expect(result.blockedBy).toBe("fast-column");
    expect(result.z).toBeGreaterThan(column.radius + CAMERA_COLLISION_CLEARANCE);
  });

  it("keeps tangential motion when the camera meets a box", () => {
    const result = resolveCameraCollision(
      { x: -2, y: 1, z: 0.5 },
      { x: 2, y: 1, z: 1.5 },
      [hallBox],
    );

    expect(result.blockedBy).toBe("test-box");
    expect(result.x).toBeLessThanOrEqual(-hallBox.halfX - CAMERA_COLLISION_CLEARANCE);
    expect(result.z).toBeGreaterThan(1.1);
  });

  it("keeps the camera inside a radial room boundary at maximum pull-back", () => {
    const shell: RadialBoundaryCameraCollider = {
      id: "hall-shell",
      room: "hall",
      shape: "radial-boundary",
      x: 0,
      z: 0,
      maxRadius: 14.28,
      minY: 0,
      maxY: 19,
    };

    const result = resolveCameraCollision(
      { x: 0, y: 4.2, z: 11.7 },
      { x: 0, y: 4.2, z: 15.94 },
      [shell],
    );

    expect(result.blockedBy).toBe("hall-shell");
    expect(Math.hypot(result.x, result.z)).toBeLessThanOrEqual(
      shell.maxRadius - CAMERA_COLLISION_CLEARANCE + 0.0001,
    );
  });

  it("blocks vertical movement through a solid floor slab", () => {
    const floor: BoxCameraCollider = {
      ...hallBox,
      id: "test-floor",
      y: -0.1,
      halfX: 8,
      halfY: 0.1,
      halfZ: 8,
    };
    const result = resolveCameraCollision(
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      [floor],
    );

    expect(result.blockedBy).toBe("test-floor");
    expect(result.y).toBeGreaterThanOrEqual(
      floor.y + floor.halfY + CAMERA_COLLISION_CLEARANCE,
    );
  });

  it("recovers a camera that starts inside a collider after a resize or room switch", () => {
    const column: CylinderCameraCollider = {
      id: "overlap-column",
      room: "hall",
      shape: "cylinder",
      x: 0,
      z: 0,
      radius: 0.5,
      minY: 0,
      maxY: 4,
    };
    const result = resolveCameraCollision(
      { x: 0.2, y: 2, z: 0 },
      { x: 0.2, y: 2, z: 0 },
      [column],
    );

    expect(result.blockedBy).toBe("overlap-column");
    expect(Math.hypot(result.x, result.z)).toBeGreaterThanOrEqual(
      column.radius + CAMERA_COLLISION_CLEARANCE,
    );
  });

  it("resolves multiple contacts without NaN or crossing either side of a corner", () => {
    const wallX: BoxCameraCollider = {
      ...hallBox,
      id: "wall-x",
      x: 0.5,
      halfX: 0.1,
      halfZ: 3,
    };
    const wallZ: BoxCameraCollider = {
      ...hallBox,
      id: "wall-z",
      z: 0.5,
      halfX: 3,
      halfZ: 0.1,
    };
    const result = resolveCameraCollision(
      { x: -1, y: 1, z: -1 },
      { x: 2, y: 1, z: 2 },
      [wallX, wallZ],
    );

    expect(result.blocked).toBe(true);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    expect(Number.isFinite(result.z)).toBe(true);
    expect(result.x).toBeLessThanOrEqual(0.1);
    expect(result.z).toBeLessThanOrEqual(0.1);
  });

  it("inherits translation and rotation from the model node and expands an arc into solid segments", () => {
    const root = new THREE.Group();
    root.position.set(3, 0, -2);
    root.rotation.y = Math.PI / 2;
    markCameraCollider(root, {
      id: "curved-desk",
      shape: "arc",
      center: { x: 0, y: 0.6, z: 0 },
      radius: 2,
      radialDepth: 0.7,
      height: 1.2,
      startAngle: 0,
      endAngle: Math.PI,
      segments: 8,
    });

    const colliders = collectCameraColliders(root, "director");

    expect(colliders).toHaveLength(8);
    expect(colliders.every(({ room }) => room === "director")).toBe(true);
    expect(colliders.every(({ id }) => id.startsWith("curved-desk-"))).toBe(true);
    expect(colliders.every((collider) => collider.shape === "box")).toBe(true);
  });

  it("registers the hall shell, architecture, furniture, gallery, and columns", () => {
    withMockCanvas(() => {
      const built = buildLibraryScene();
      const colliders = [
        ...collectCameraColliders(built.root, "hall"),
        ...HALL_COLUMN_COLLIDERS,
      ];
      const ids = colliders.map(({ id }) => id);

      expect(ids).toContain("hall-shell");
      expect(ids).toContain("hall-main-entrance");
      expect(ids).toContain("hall-fireplace");
      expect(ids).toContain("hall-spiral-stair");
      expect(ids).toContain("hall-restricted-door");
      expect(ids).toContain("hall-director-door");
      expect(ids).toContain("hall-chandelier");
      expect(ids.some((id) => id.startsWith("hall-bookcase-"))).toBe(true);
      expect(ids.some((id) => id.startsWith("hall-gallery-floor-"))).toBe(true);
      expect(ids.filter((id) => id.startsWith("gallery-column-"))).toHaveLength(8);
      expect(ids.filter((id) => id.startsWith("wall-column-"))).toHaveLength(8);
    });
  });

  it("registers room-specific shells and large furniture without leaking room ids", () => {
    withMockCanvas(() => {
      const scene = new THREE.Scene();
      const loader = {
        load: () => new THREE.Texture(),
      } as unknown as THREE.TextureLoader;
      const rooms = createVirtualLibraryRooms(scene, loader);
      const restricted = collectCameraColliders(rooms.restricted, "restricted");
      const director = collectCameraColliders(rooms.director, "director");
      const restrictedIds = restricted.map(({ id }) => id);
      const directorIds = director.map(({ id }) => id);

      expect(restricted.every(({ room }) => room === "restricted")).toBe(true);
      expect(restrictedIds).toContain("restricted-floor");
      expect(restrictedIds).toContain("restricted-vault");
      expect(restrictedIds).toContain("restricted-lectern");
      expect(restrictedIds.filter((id) => id.startsWith("restricted-cabinet-"))).toHaveLength(8);
      expect(director.every(({ room }) => room === "director")).toBe(true);
      expect(directorIds).toContain("director-floor");
      expect(directorIds).toContain("director-desk");
      expect(directorIds).toContain("director-chair");
      expect(directorIds).toContain("director-globe");
      expect(directorIds.filter((id) => id.startsWith("director-bookcase-"))).toHaveLength(7);
    });
  });
});
