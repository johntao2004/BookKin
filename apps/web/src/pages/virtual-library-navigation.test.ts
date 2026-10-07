import {
  cameraRelativeWalkDelta,
  clampVirtualLibraryFlightHeight,
  isShelfMovementLocked,
  virtualLibraryVerticalFlightDelta,
  virtualLibraryMovementKey,
  VIRTUAL_LIBRARY_KEYBOARD_FLIGHT_SPEED,
  type VirtualLibraryMovementKey,
} from "./virtual-library-navigation";

describe("virtual library continuous keyboard navigation", () => {
  it("maps WASD and arrow keys to all four movement directions", () => {
    expect(virtualLibraryMovementKey("KeyW", "w")).toBe("forward");
    expect(virtualLibraryMovementKey("KeyA", "a")).toBe("left");
    expect(virtualLibraryMovementKey("KeyS", "s")).toBe("backward");
    expect(virtualLibraryMovementKey("KeyD", "d")).toBe("right");
    expect(virtualLibraryMovementKey("ArrowLeft", "ArrowLeft")).toBe("left");
    expect(virtualLibraryMovementKey("ShiftLeft", "Shift")).toBe("up");
    expect(virtualLibraryMovementKey("ShiftRight", "Shift")).toBe("up");
    expect(virtualLibraryMovementKey("ControlLeft", "Control")).toBe("down");
    expect(virtualLibraryMovementKey("ControlRight", "Control")).toBe("down");
    expect(virtualLibraryMovementKey("Escape", "Escape")).toBeNull();
  });

  it("moves vertically at the dedicated flight speed and cancels opposite controls", () => {
    expect(virtualLibraryVerticalFlightDelta(
      new Set<VirtualLibraryMovementKey>(["up"]),
      VIRTUAL_LIBRARY_KEYBOARD_FLIGHT_SPEED,
    )).toBe(VIRTUAL_LIBRARY_KEYBOARD_FLIGHT_SPEED);
    expect(virtualLibraryVerticalFlightDelta(
      new Set<VirtualLibraryMovementKey>(["down"]),
      VIRTUAL_LIBRARY_KEYBOARD_FLIGHT_SPEED,
    )).toBe(-VIRTUAL_LIBRARY_KEYBOARD_FLIGHT_SPEED);
    expect(virtualLibraryVerticalFlightDelta(
      new Set<VirtualLibraryMovementKey>(["up", "down"]),
      VIRTUAL_LIBRARY_KEYBOARD_FLIGHT_SPEED,
    )).toBe(0);
  });

  it("keeps flight between the walking eye line and the local roof clearance", () => {
    expect(clampVirtualLibraryFlightHeight(0, 1.78, 18.05)).toBe(1.78);
    expect(clampVirtualLibraryFlightHeight(7.4, 1.78, 18.05)).toBe(7.4);
    expect(clampVirtualLibraryFlightHeight(30, 1.78, 18.05)).toBe(18.05);
    expect(clampVirtualLibraryFlightHeight(5, 1.78, 1.2)).toBe(1.78);
  });

  it("moves relative to view direction and keeps diagonal speed normalized", () => {
    const forward = cameraRelativeWalkDelta(0, new Set<VirtualLibraryMovementKey>(["forward"]), 4);
    expect(forward?.x).toBeCloseTo(0, 8);
    expect(forward?.z).toBeCloseTo(-4, 8);

    const rightAfterQuarterTurn = cameraRelativeWalkDelta(
      Math.PI / 2,
      new Set<VirtualLibraryMovementKey>(["right"]),
      4,
    )!;
    expect(rightAfterQuarterTurn.x).toBeCloseTo(0, 8);
    expect(rightAfterQuarterTurn.z).toBeCloseTo(-4, 8);

    const diagonal = cameraRelativeWalkDelta(
      0,
      new Set<VirtualLibraryMovementKey>(["forward", "right"]),
      4,
    )!;
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(4, 8);

    const forwardWhileFlying = cameraRelativeWalkDelta(
      0,
      new Set<VirtualLibraryMovementKey>(["forward", "up"]),
      4,
    )!;
    expect(forwardWhileFlying.x).toBeCloseTo(0, 8);
    expect(forwardWhileFlying.z).toBeCloseTo(-4, 8);
  });

  it("cancels opposite keys without drifting", () => {
    expect(cameraRelativeWalkDelta(
      0,
      new Set<VirtualLibraryMovementKey>(["forward", "backward", "left", "right"]),
      4,
    )).toBeNull();
  });

  it("locks walking while the camera is facing a focused shelf", () => {
    expect(isShelfMovementLocked(0)).toBe(true);
    expect(isShelfMovementLocked(18)).toBe(true);
    expect(isShelfMovementLocked(null)).toBe(false);
  });
});
