export type VirtualLibraryMovementKey = "forward" | "backward" | "left" | "right" | "up" | "down";

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
