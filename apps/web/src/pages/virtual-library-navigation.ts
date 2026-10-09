import { resolveCameraCollision, type CameraPosition, type CameraCollider, type CameraCollisionClearance } from "./virtual-library-collision";

export type VirtualLibraryMovementKey = "forward" | "backward" | "left" | "right" | "up" | "down";

export const WALKING_EYE_HEIGHT = 1.78;
// Keep a 25 cm step allowance under the body. The exported stair risers are
// 19.375 cm high; a spherical eye alone misses rails, desks and chair backs.
export const WALKING_CAMERA_CLEARANCE: Readonly<CameraCollisionClearance> = {
  horizontal: 0.3,
  above: 0.3,
  below: WALKING_EYE_HEIGHT - 0.25,
};

export const VIRTUAL_LIBRARY_KEYBOARD_WALK_SPEED = 4.2;
export const VIRTUAL_LIBRARY_KEYBOARD_FLIGHT_SPEED = 3.2;

const MOVEMENT_CODE_MAP: Record<string, VirtualLibraryMovementKey> = {
  KeyW: "forward",
  KeyS: "backward",
  KeyA: "left",
  KeyD: "right",
  ArrowUp: "forward",
  ArrowDown: "backward",
  ArrowLeft: "left",
  ArrowRight: "right",
  ShiftLeft: "up",
  ShiftRight: "up",
  Shift: "up",
  ControlLeft: "down",
  ControlRight: "down",
  Control: "down",
};

export function virtualLibraryMovementKey(code: string, key: string) {
  return MOVEMENT_CODE_MAP[code] ?? MOVEMENT_CODE_MAP[key] ?? null;
}

export function isShelfMovementLocked(expandedShelfSectionId: number | null) {
  return expandedShelfSectionId !== null;
}

export function virtualLibraryVerticalFlightDelta(
  pressed: ReadonlySet<VirtualLibraryMovementKey>,
  distance: number,
) {
  if (distance <= 0) return 0;
  return (Number(pressed.has("up")) - Number(pressed.has("down"))) * distance;
}

export function clampVirtualLibraryFlightHeight(
  desiredHeight: number,
  minimumHeight: number,
  maximumHeight: number,
) {
  return Math.min(Math.max(desiredHeight, minimumHeight), Math.max(minimumHeight, maximumHeight));
}

/** Returns a camera-relative planar displacement with normalized diagonal speed. */
export function cameraRelativeWalkDelta(
  yaw: number,
  pressed: ReadonlySet<VirtualLibraryMovementKey>,
  distance: number,
) {
  const forward = Number(pressed.has("forward")) - Number(pressed.has("backward"));
  const strafe = Number(pressed.has("right")) - Number(pressed.has("left"));
  const magnitude = Math.hypot(forward, strafe);
  if (magnitude === 0 || distance <= 0) return null;

  const normalizedForward = forward / magnitude;
  const normalizedStrafe = strafe / magnitude;
  return {
    x: (-Math.sin(yaw) * normalizedForward + Math.cos(yaw) * normalizedStrafe) * distance,
    z: (-Math.cos(yaw) * normalizedForward - Math.sin(yaw) * normalizedStrafe) * distance,
  };
}

/** Only authored tread/exit support surfaces may use route-owned foot placement. */
export function isGuidedStairSupport(collider: CameraCollider) {
  return collider.id.startsWith("stair-tread-") || collider.id.startsWith("stair-exit-infill-");
}

/** The exported stair route owns foot placement on the treads. Test the whole
 * body against its guards/architecture, and the eye against all geometry.
 * This prevents the conservative box-shaped body from snagging on the next
 * two risers while preserving head/side collision and landing support. */
export function resolveGuidedStairCollision(
  previous: CameraPosition,
  desired: CameraPosition,
  colliders: readonly CameraCollider[],
  obstacles: readonly CameraCollider[],
  supportedEye: CameraPosition,
) {
  const onSupportedPath = Math.hypot(desired.x - supportedEye.x, desired.z - supportedEye.z) <= 0.12
    && Math.abs(desired.y - supportedEye.y) < 0.000001
    && Math.hypot(desired.x - previous.x, desired.y - previous.y, desired.z - previous.z) <= 0.12;
  // The foot-placement exception belongs only to small steps along the known
  // route. Large jumps, lateral departures and vertical flight use every solid.
  if (!onSupportedPath) return resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
  const body = resolveCameraCollision(previous, desired, obstacles, WALKING_CAMERA_CLEARANCE);
  if (Math.hypot(body.x - supportedEye.x, body.z - supportedEye.z) > 0.12
    || Math.abs(body.y - supportedEye.y) > 0.001) {
    return resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
  }
  const eye = resolveCameraCollision(previous, body, colliders);
  return {...eye, blocked: body.blocked || eye.blocked, blockedBy: body.blockedBy ?? eye.blockedBy};
}
