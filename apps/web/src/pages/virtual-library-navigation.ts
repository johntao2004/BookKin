export type VirtualLibraryMovementKey = "forward" | "backward" | "left" | "right";

export const VIRTUAL_LIBRARY_KEYBOARD_WALK_SPEED = 4.2;

const MOVEMENT_CODE_MAP: Record<string, VirtualLibraryMovementKey> = {
  KeyW: "forward",
  KeyS: "backward",
  KeyA: "left",
  KeyD: "right",
  ArrowUp: "forward",
  ArrowDown: "backward",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function virtualLibraryMovementKey(code: string, key: string) {
  return MOVEMENT_CODE_MAP[code] ?? MOVEMENT_CODE_MAP[key] ?? null;
}

export function isShelfMovementLocked(expandedShelfSectionId: number | null) {
  return expandedShelfSectionId !== null;
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
