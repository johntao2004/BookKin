import {
  cameraRelativeWalkDelta,
  isShelfMovementLocked,
  virtualLibraryMovementKey,
  type VirtualLibraryMovementKey,
} from "./virtual-library-navigation";

describe("virtual library continuous keyboard navigation", () => {
  it("maps WASD and arrow keys to all four movement directions", () => {
    expect(virtualLibraryMovementKey("KeyW", "w")).toBe("forward");
    expect(virtualLibraryMovementKey("KeyA", "a")).toBe("left");
    expect(virtualLibraryMovementKey("KeyS", "s")).toBe("backward");
    expect(virtualLibraryMovementKey("KeyD", "d")).toBe("right");
    expect(virtualLibraryMovementKey("ArrowLeft", "ArrowLeft")).toBe("left");
    expect(virtualLibraryMovementKey("Escape", "Escape")).toBeNull();
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
