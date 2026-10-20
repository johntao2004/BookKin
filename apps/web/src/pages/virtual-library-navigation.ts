import { resolveCameraCollision, type CameraPosition, type CameraCollider, type CameraCollisionClearance } from "./virtual-library-collision";

export type VirtualLibraryMovementKey = "forward" | "backward" | "left" | "right" | "up" | "down";

export const WALKING_EYE_HEIGHT = 1.78;
// 人体下方保留 25 厘米跨步余量；40 级梯的踏步高约 18.6 厘米，单个眼球碰撞会漏过栏杆、桌椅。
// Keep a 25 cm step allowance under the body. The taller 40-tread stair has
// 18.6 cm risers; a spherical eye alone misses rails, desks and chair backs.
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

// 返回相机相对的平面位移，并把斜向速度归一化。
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

// 只有预设踏步与出口支撑面允许由路径控制脚部落点。
/** Only authored tread/exit support surfaces may use route-owned foot placement. */
export function isGuidedStairSupport(collider: CameraCollider) {
  return collider.id.startsWith("stair-tread-") || collider.id.startsWith("stair-exit-infill-");
}

// 楼梯路径控制踏步落点，人体检测栏杆和建筑、眼睛检测全部几何，避免保守盒状人体被后续台阶卡住，同时保持头侧净距及平台支撑。
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
  // 脚部例外仅用于已知路径上的小步；大跳跃、侧向偏离和竖直飞行仍检查全部实体。
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

type StairRoutes = Readonly<Record<'left' | 'right', readonly CameraPosition[]>>;

// 根据平面位置及当前脚高选择局部踏步支撑，防止底层和顶层重叠转弯把地面访客直接吸附到二楼。
/** Local tread support, selected by both plan position and current foot height.
 * Height gating prevents the nearly overlapping bottom/top turns from snapping
 * a ground-floor visitor directly onto the gallery. */
function stairWalkingHeight(previous: CameraPosition, desired: CameraPosition, routes: StairRoutes) {
  let closest: {distance: number; height: number} | null = null;
  const footY = previous.y - WALKING_EYE_HEIGHT;
  for (const route of Object.values(routes)) for (let index = 1; index < route.length; index++) {
    const start = route[index - 1], end = route[index];
    const dx = end.x - start.x, dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared < 0.000001) continue;
    const t = Math.max(0, Math.min(1,
      ((desired.x - start.x) * dx + (desired.z - start.z) * dz) / lengthSquared));
    const distance = Math.hypot(desired.x - start.x - dx * t, desired.z - start.z - dz * t);
    const height = start.y + (end.y - start.y) * t;
    if (distance > 0.32 || Math.abs(height - footY) > 0.25) continue;
    if (!closest || distance < closest.distance) closest = {distance, height};
  }
  return closest?.height ?? null;
}

// 把真实键盘、滚轮或按钮步行拆成短且受支撑的步长；不启动导引动画、不修改偏航或移除栏杆碰撞。
/** Resolve real keyboard/wheel/button walking in short supported steps. This
 * never starts the guided animation, changes yaw, or removes guard collision. */
export function resolveReferenceWalkingCollision(
  previous: CameraPosition,
  desired: CameraPosition,
  colliders: readonly CameraCollider[],
  obstacles: readonly CameraCollider[],
  routes: StairRoutes,
  followStairs = true,
) {
  if (!followStairs) return resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
  const distance = Math.hypot(desired.x - previous.x, desired.z - previous.z);
  const steps = Math.max(1, Math.ceil(distance / 0.055));
  // 每小段从上次接受位置扫掠，避免大幅按钮或滚轮移动穿过柱、栏杆及建筑。
  // Sweep each slice from the last accepted point; a large button/wheel move
  // cannot tunnel through the pillar, rails or intervening architecture.
  let resolved = resolveCameraCollision(previous, previous, [], WALKING_CAMERA_CLEARANCE);
  for (let index = 1; index <= steps; index++) {
    const t = index / steps;
    const next = {x: previous.x + (desired.x - previous.x) * t,
      y: resolved.y, z: previous.z + (desired.z - previous.z) * t};
    const floor = stairWalkingHeight(resolved, next, routes);
    if (floor === null) {
      resolved = resolveCameraCollision(resolved, next, colliders, WALKING_CAMERA_CLEARANCE);
      continue;
    }
    next.y = floor + WALKING_EYE_HEIGHT;
    const body = resolveCameraCollision(resolved, next, obstacles, WALKING_CAMERA_CLEARANCE);
    // 沿栏杆滑动后仍有踏步支撑即可接受；拒绝所有侧向微调会把键盘用户卡在可通行的平台。
    // Sliding along a rail is valid if the resolved position still has tread
    // support. Rejecting every small sideways correction traps keyboard users
    // at the landing even though the authored centre line is traversable.
    const actualFloor = stairWalkingHeight(resolved, body, routes);
    if (actualFloor === null || Math.abs(body.y - actualFloor - WALKING_EYE_HEIGHT) > 0.05) {
      resolved = {...resolved, blocked: true, blockedBy: body.blockedBy};
      break;
    }
    const eye = resolveCameraCollision(resolved, body, colliders);
    resolved = {...eye, blocked: body.blocked || eye.blocked, blockedBy: body.blockedBy ?? eye.blockedBy};
  }
  return resolved;
}
