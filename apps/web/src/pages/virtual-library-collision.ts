import * as THREE from "three";
import type { LibraryRoomId } from "./virtual-library-rooms";
import { LIBRARY } from "./virtual-library-model/config";

export interface CameraPosition {
  x: number;
  y: number;
  z: number;
}

interface CameraColliderBase {
  id: string;
  room: LibraryRoomId;
}

export interface BoxCameraCollider extends CameraColliderBase {
  shape: "box";
  x: number;
  y: number;
  z: number;
  halfX: number;
  halfY: number;
  halfZ: number;
  rotationY: number;
}

export interface CylinderCameraCollider extends CameraColliderBase {
  shape: "cylinder";
  x: number;
  z: number;
  radius: number;
  minY: number;
  maxY: number;
}

export interface RadialBoundaryCameraCollider extends CameraColliderBase {
  shape: "radial-boundary";
  x: number;
  z: number;
  maxRadius: number;
  minY: number;
  maxY: number;
}

export type CameraCollider =
  | BoxCameraCollider
  | CylinderCameraCollider
  | RadialBoundaryCameraCollider;

interface LocalCameraColliderDescriptorBase {
  id: string;
}

export interface LocalBoxCameraColliderDescriptor extends LocalCameraColliderDescriptorBase {
  shape: "box";
  center: CameraPosition;
  size: CameraPosition;
  rotationY?: number;
}

export interface LocalCylinderCameraColliderDescriptor extends LocalCameraColliderDescriptorBase {
  shape: "cylinder";
  center: CameraPosition;
  radius: number;
  height: number;
}

export interface LocalRadialBoundaryCameraColliderDescriptor
  extends LocalCameraColliderDescriptorBase {
  shape: "radial-boundary";
  center: CameraPosition;
  maxRadius: number;
  minY: number;
  maxY: number;
}

export interface LocalArcCameraColliderDescriptor extends LocalCameraColliderDescriptorBase {
  shape: "arc";
  center: CameraPosition;
  radius: number;
  radialDepth: number;
  height: number;
  startAngle: number;
  endAngle: number;
  segments?: number;
}

export type LocalCameraColliderDescriptor =
  | LocalBoxCameraColliderDescriptor
  | LocalCylinderCameraColliderDescriptor
  | LocalRadialBoundaryCameraColliderDescriptor
  | LocalArcCameraColliderDescriptor;

export interface CameraCollisionResult extends CameraPosition {
  blocked: boolean;
  blockedBy: string | null;
}

interface CollisionHit {
  collider: CameraCollider;
  normal: CameraPosition;
  time: number;
}

interface Penetration {
  depth: number;
  normal: CameraPosition;
}

export const HALL_MAJOR_FEATURE_COUNT = 4;
export const CAMERA_COLLISION_CLEARANCE = 0.3;
export const CAMERA_COLUMN_CLEARANCE = CAMERA_COLLISION_CLEARANCE;

const COLLIDER_USER_DATA_KEY = "cameraColliderDescriptors";
const COLLISION_EPSILON = 0.000001;
const COLLISION_SKIN = 0.002;
const MAX_COLLISION_ITERATIONS = 4;
const MAX_DEPENETRATION_ITERATIONS = 8;

export function getHallColumnSectionIndices(
  segmentCount = LIBRARY.tower.segmentCount,
) {
  const safeSegmentCount = Math.max(HALL_MAJOR_FEATURE_COUNT, Math.floor(segmentCount));
  const sections = new Set<number>();

  for (let feature = 0; feature < HALL_MAJOR_FEATURE_COUNT; feature += 1) {
    const featureSector = Math.round(
      (feature / HALL_MAJOR_FEATURE_COUNT) * safeSegmentCount,
    ) % safeSegmentCount;
    sections.add((featureSector - 1 + safeSegmentCount) % safeSegmentCount);
    sections.add(featureSector);
  }

  return [...sections].sort((left, right) => left - right);
}

export function createHallColumnColliders(): CylinderCameraCollider[] {
  const {
    entranceAngle,
    galleryDepth,
    galleryY,
    innerRadius,
    mainHeight,
    segmentCount,
  } = LIBRARY.tower;
  const step = (Math.PI * 2) / segmentCount;
  const galleryColumnRadius = innerRadius - galleryDepth - 0.12;
  const wallColumnRadius = innerRadius - 0.5;

  return getHallColumnSectionIndices(segmentCount).flatMap((section) => {
    const angle = entranceAngle + (section + 0.5) * step;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [
      {
        id: `gallery-column-${section}`,
        room: "hall",
        shape: "cylinder",
        x: cosine * galleryColumnRadius,
        z: sine * galleryColumnRadius,
        radius: 0.4,
        minY: 0,
        maxY: galleryY,
      },
      {
        id: `wall-column-${section}`,
        room: "hall",
        shape: "cylinder",
        x: cosine * wallColumnRadius,
        z: sine * wallColumnRadius,
        radius: 0.45,
        minY: 0,
        maxY: mainHeight,
      },
    ];
  });
}

export const HALL_COLUMN_COLLIDERS = createHallColumnColliders();

export function markCameraCollider(
  object: THREE.Object3D,
  descriptor: LocalCameraColliderDescriptor | readonly LocalCameraColliderDescriptor[],
) {
  const descriptors = object.userData[COLLIDER_USER_DATA_KEY] as
    | LocalCameraColliderDescriptor[]
    | undefined;
  const nextDescriptors = Array.isArray(descriptor) ? descriptor : [descriptor];
  object.userData[COLLIDER_USER_DATA_KEY] = [
    ...(descriptors ?? []),
    ...nextDescriptors,
  ];
  return object;
}

function worldYawForObject(object: THREE.Object3D) {
  const quaternion = new THREE.Quaternion();
  object.getWorldQuaternion(quaternion);
  return new THREE.Euler().setFromQuaternion(quaternion, "YXZ").y;
}

function collectArcBoxes(
  object: THREE.Object3D,
  room: LibraryRoomId,
  descriptor: LocalArcCameraColliderDescriptor,
  worldScale: THREE.Vector3,
  objectYaw: number,
) {
  const span = descriptor.endAngle - descriptor.startAngle;
  const segmentCount = Math.max(
    1,
    Math.floor(descriptor.segments ?? Math.ceil(Math.abs(span) / (Math.PI / 16))),
  );
  const step = span / segmentCount;
  const radialScale = Math.max(Math.abs(worldScale.x), Math.abs(worldScale.z));
  const radius = descriptor.radius * radialScale;
  const radialDepth = descriptor.radialDepth * radialScale;
  const height = descriptor.height * Math.abs(worldScale.y);
  const boxes: BoxCameraCollider[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const angle = descriptor.startAngle + (index + 0.5) * step;
    const localCenter = new THREE.Vector3(
      descriptor.center.x + Math.cos(angle) * descriptor.radius,
      descriptor.center.y,
      descriptor.center.z + Math.sin(angle) * descriptor.radius,
    ).applyMatrix4(object.matrixWorld);
    const tangentLength = 2 * radius * Math.sin(Math.abs(step) / 2) + 0.035;
    boxes.push({
      id: `${descriptor.id}-${index}`,
      room,
      shape: "box",
      x: localCenter.x,
      y: localCenter.y,
      z: localCenter.z,
      halfX: tangentLength / 2,
      halfY: height / 2,
      halfZ: radialDepth / 2,
      rotationY: objectYaw + Math.PI / 2 - angle,
    });
  }
  return boxes;
}

export function collectCameraColliders(
  root: THREE.Object3D,
  room: LibraryRoomId,
): CameraCollider[] {
  root.updateWorldMatrix(true, true);
  const colliders: CameraCollider[] = [];
  const worldScale = new THREE.Vector3();

  root.traverse((object) => {
    const descriptors = object.userData[COLLIDER_USER_DATA_KEY] as
      | LocalCameraColliderDescriptor[]
      | undefined;
    if (!descriptors?.length) return;
    object.getWorldScale(worldScale);
    const objectYaw = worldYawForObject(object);

    for (const descriptor of descriptors) {
      if (descriptor.shape === "arc") {
        colliders.push(...collectArcBoxes(
          object,
          room,
          descriptor,
          worldScale,
          objectYaw,
        ));
        continue;
      }

      const center = new THREE.Vector3(
        descriptor.center.x,
        descriptor.center.y,
        descriptor.center.z,
      ).applyMatrix4(object.matrixWorld);
      if (descriptor.shape === "box") {
        colliders.push({
          id: descriptor.id,
          room,
          shape: "box",
          x: center.x,
          y: center.y,
          z: center.z,
          halfX: Math.abs(descriptor.size.x * worldScale.x) / 2,
          halfY: Math.abs(descriptor.size.y * worldScale.y) / 2,
          halfZ: Math.abs(descriptor.size.z * worldScale.z) / 2,
          rotationY: objectYaw + (descriptor.rotationY ?? 0),
        });
        continue;
      }
      if (descriptor.shape === "cylinder") {
        const halfHeight = Math.abs(descriptor.height * worldScale.y) / 2;
        colliders.push({
          id: descriptor.id,
          room,
          shape: "cylinder",
          x: center.x,
          z: center.z,
          radius: descriptor.radius * Math.max(Math.abs(worldScale.x), Math.abs(worldScale.z)),
          minY: center.y - halfHeight,
          maxY: center.y + halfHeight,
        });
        continue;
      }

      const minPoint = new THREE.Vector3(
        descriptor.center.x,
        descriptor.minY,
        descriptor.center.z,
      ).applyMatrix4(object.matrixWorld);
      const maxPoint = new THREE.Vector3(
        descriptor.center.x,
        descriptor.maxY,
        descriptor.center.z,
      ).applyMatrix4(object.matrixWorld);
      colliders.push({
        id: descriptor.id,
        room,
        shape: "radial-boundary",
        x: center.x,
        z: center.z,
        maxRadius: descriptor.maxRadius
          * Math.max(Math.abs(worldScale.x), Math.abs(worldScale.z)),
        minY: Math.min(minPoint.y, maxPoint.y),
        maxY: Math.max(minPoint.y, maxPoint.y),
      });
    }
  });

  return colliders;
}

function rotateIntoBox(position: CameraPosition, collider: BoxCameraCollider) {
  const cosine = Math.cos(collider.rotationY);
  const sine = Math.sin(collider.rotationY);
  const offsetX = position.x - collider.x;
  const offsetZ = position.z - collider.z;
  return {
    x: cosine * offsetX - sine * offsetZ,
    y: position.y - collider.y,
    z: sine * offsetX + cosine * offsetZ,
  };
}

function rotateBoxNormalToWorld(normal: CameraPosition, rotationY: number) {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return {
    x: cosine * normal.x + sine * normal.z,
    y: normal.y,
    z: -sine * normal.x + cosine * normal.z,
  };
}

function sweepBox(
  start: CameraPosition,
  end: CameraPosition,
  collider: BoxCameraCollider,
  clearance: number,
): CollisionHit | null {
  const localStart = rotateIntoBox(start, collider);
  const localEnd = rotateIntoBox(end, collider);
  const delta = {
    x: localEnd.x - localStart.x,
    y: localEnd.y - localStart.y,
    z: localEnd.z - localStart.z,
  };
  const half = {
    x: collider.halfX + clearance,
    y: collider.halfY + clearance,
    z: collider.halfZ + clearance,
  };
  if (
    Math.abs(localStart.x) < half.x
    && Math.abs(localStart.y) < half.y
    && Math.abs(localStart.z) < half.z
  ) return null;

  let enterTime = 0;
  let exitTime = 1;
  let enterNormal: CameraPosition = { x: 0, y: 0, z: 0 };
  for (const axis of ["x", "y", "z"] as const) {
    const startValue = localStart[axis];
    const deltaValue = delta[axis];
    const extent = half[axis];
    if (Math.abs(deltaValue) < COLLISION_EPSILON) {
      if (startValue < -extent || startValue > extent) return null;
      continue;
    }
    let nearTime = (-extent - startValue) / deltaValue;
    let farTime = (extent - startValue) / deltaValue;
    let nearSign = -1;
    if (nearTime > farTime) {
      [nearTime, farTime] = [farTime, nearTime];
      nearSign = 1;
    }
    if (nearTime > enterTime) {
      enterTime = nearTime;
      enterNormal = {
        x: axis === "x" ? nearSign : 0,
        y: axis === "y" ? nearSign : 0,
        z: axis === "z" ? nearSign : 0,
      };
    }
    exitTime = Math.min(exitTime, farTime);
    if (enterTime > exitTime) return null;
  }
  if (enterTime < 0 || enterTime > 1) return null;
  return {
    collider,
    normal: rotateBoxNormalToWorld(enterNormal, collider.rotationY),
    time: enterTime,
  };
}

function sweepCylinder(
  start: CameraPosition,
  end: CameraPosition,
  collider: CylinderCameraCollider,
  clearance: number,
): CollisionHit | null {
  const radius = collider.radius + clearance;
  const minY = collider.minY - clearance;
  const maxY = collider.maxY + clearance;
  const startX = start.x - collider.x;
  const startZ = start.z - collider.z;
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const deltaZ = end.z - start.z;
  if (
    startX * startX + startZ * startZ < radius * radius
    && start.y > minY
    && start.y < maxY
  ) return null;

  const candidates: CollisionHit[] = [];
  const quadratic = deltaX * deltaX + deltaZ * deltaZ;
  if (quadratic > COLLISION_EPSILON) {
    const linear = 2 * (startX * deltaX + startZ * deltaZ);
    const constant = startX * startX + startZ * startZ - radius * radius;
    const discriminant = linear * linear - 4 * quadratic * constant;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      const times = [
        (-linear - root) / (2 * quadratic),
        (-linear + root) / (2 * quadratic),
      ];
      for (const time of times) {
        if (time < 0 || time > 1) continue;
        const y = start.y + deltaY * time;
        if (y < minY || y > maxY) continue;
        const x = startX + deltaX * time;
        const z = startZ + deltaZ * time;
        const length = Math.max(Math.hypot(x, z), COLLISION_EPSILON);
        candidates.push({
          collider,
          normal: { x: x / length, y: 0, z: z / length },
          time,
        });
      }
    }
  }

  if (Math.abs(deltaY) > COLLISION_EPSILON) {
    for (const [planeY, normalY] of [[minY, -1], [maxY, 1]] as const) {
      const time = (planeY - start.y) / deltaY;
      if (time < 0 || time > 1) continue;
      const x = startX + deltaX * time;
      const z = startZ + deltaZ * time;
      if (x * x + z * z > radius * radius) continue;
      candidates.push({
        collider,
        normal: { x: 0, y: normalY, z: 0 },
        time,
      });
    }
  }

  return candidates.sort((left, right) => left.time - right.time)[0] ?? null;
}

function sweepRadialBoundary(
  start: CameraPosition,
  end: CameraPosition,
  collider: RadialBoundaryCameraCollider,
  clearance: number,
): CollisionHit | null {
  const allowedRadius = Math.max(0.01, collider.maxRadius - clearance);
  const startX = start.x - collider.x;
  const startZ = start.z - collider.z;
  if (startX * startX + startZ * startZ > allowedRadius * allowedRadius) return null;
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const deltaZ = end.z - start.z;
  const quadratic = deltaX * deltaX + deltaZ * deltaZ;
  if (quadratic < COLLISION_EPSILON) return null;
  const linear = 2 * (startX * deltaX + startZ * deltaZ);
  const constant = startX * startX + startZ * startZ - allowedRadius * allowedRadius;
  const discriminant = linear * linear - 4 * quadratic * constant;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const times = [
    (-linear - root) / (2 * quadratic),
    (-linear + root) / (2 * quadratic),
  ].sort((left, right) => left - right);
  for (const time of times) {
    if (time < 0 || time > 1) continue;
    const x = startX + deltaX * time;
    const z = startZ + deltaZ * time;
    if (x * deltaX + z * deltaZ <= 0) continue;
    const y = start.y + deltaY * time;
    if (y + clearance < collider.minY || y - clearance > collider.maxY) continue;
    const length = Math.max(Math.hypot(x, z), COLLISION_EPSILON);
    return {
      collider,
      normal: { x: -x / length, y: 0, z: -z / length },
      time,
    };
  }
  return null;
}

function sweepCollider(
  start: CameraPosition,
  end: CameraPosition,
  collider: CameraCollider,
  clearance: number,
) {
  if (collider.shape === "box") return sweepBox(start, end, collider, clearance);
  if (collider.shape === "cylinder") return sweepCylinder(start, end, collider, clearance);
  return sweepRadialBoundary(start, end, collider, clearance);
}

function boxPenetration(
  position: CameraPosition,
  collider: BoxCameraCollider,
  clearance: number,
): Penetration | null {
  const local = rotateIntoBox(position, collider);
  const half = {
    x: collider.halfX + clearance,
    y: collider.halfY + clearance,
    z: collider.halfZ + clearance,
  };
  if (
    Math.abs(local.x) >= half.x
    || Math.abs(local.y) >= half.y
    || Math.abs(local.z) >= half.z
  ) return null;
  const distances = [
    { axis: "x" as const, depth: half.x - Math.abs(local.x) },
    { axis: "y" as const, depth: half.y - Math.abs(local.y) },
    { axis: "z" as const, depth: half.z - Math.abs(local.z) },
  ].sort((left, right) => left.depth - right.depth);
  const closest = distances[0];
  const normal = {
    x: closest.axis === "x" ? (local.x < 0 ? -1 : 1) : 0,
    y: closest.axis === "y" ? (local.y < 0 ? -1 : 1) : 0,
    z: closest.axis === "z" ? (local.z < 0 ? -1 : 1) : 0,
  };
  return {
    depth: closest.depth,
    normal: rotateBoxNormalToWorld(normal, collider.rotationY),
  };
}

function cylinderPenetration(
  position: CameraPosition,
  collider: CylinderCameraCollider,
  clearance: number,
): Penetration | null {
  const radius = collider.radius + clearance;
  const minY = collider.minY - clearance;
  const maxY = collider.maxY + clearance;
  const offsetX = position.x - collider.x;
  const offsetZ = position.z - collider.z;
  const radialDistance = Math.hypot(offsetX, offsetZ);
  if (radialDistance >= radius || position.y <= minY || position.y >= maxY) return null;
  const candidates = [
    {
      depth: radius - radialDistance,
      normal: radialDistance > COLLISION_EPSILON
        ? { x: offsetX / radialDistance, y: 0, z: offsetZ / radialDistance }
        : { x: 1, y: 0, z: 0 },
    },
    { depth: position.y - minY, normal: { x: 0, y: -1, z: 0 } },
    { depth: maxY - position.y, normal: { x: 0, y: 1, z: 0 } },
  ].sort((left, right) => left.depth - right.depth);
  return candidates[0];
}

function radialBoundaryPenetration(
  position: CameraPosition,
  collider: RadialBoundaryCameraCollider,
  clearance: number,
): Penetration | null {
  if (position.y + clearance < collider.minY || position.y - clearance > collider.maxY) return null;
  const allowedRadius = Math.max(0.01, collider.maxRadius - clearance);
  const offsetX = position.x - collider.x;
  const offsetZ = position.z - collider.z;
  const distance = Math.hypot(offsetX, offsetZ);
  if (distance <= allowedRadius) return null;
  return {
    depth: distance - allowedRadius,
    normal: distance > COLLISION_EPSILON
      ? { x: -offsetX / distance, y: 0, z: -offsetZ / distance }
      : { x: -1, y: 0, z: 0 },
  };
}

function colliderPenetration(
  position: CameraPosition,
  collider: CameraCollider,
  clearance: number,
) {
  if (collider.shape === "box") return boxPenetration(position, collider, clearance);
  if (collider.shape === "cylinder") {
    return cylinderPenetration(position, collider, clearance);
  }
  return radialBoundaryPenetration(position, collider, clearance);
}

function recoverFromPenetration(
  position: CameraPosition,
  colliders: readonly CameraCollider[],
  clearance: number,
) {
  const recovered = { ...position };
  let blockedBy: string | null = null;
  for (let iteration = 0; iteration < MAX_DEPENETRATION_ITERATIONS; iteration += 1) {
    let deepest: { collider: CameraCollider; penetration: Penetration } | null = null;
    for (const collider of colliders) {
      const penetration = colliderPenetration(recovered, collider, clearance);
      if (!penetration) continue;
      if (!deepest || penetration.depth > deepest.penetration.depth) {
        deepest = { collider, penetration };
      }
    }
    if (!deepest) break;
    blockedBy ??= deepest.collider.id;
    const correction = deepest.penetration.depth + COLLISION_SKIN;
    recovered.x += deepest.penetration.normal.x * correction;
    recovered.y += deepest.penetration.normal.y * correction;
    recovered.z += deepest.penetration.normal.z * correction;
  }
  return { position: recovered, blockedBy };
}

function earliestCollision(
  start: CameraPosition,
  end: CameraPosition,
  colliders: readonly CameraCollider[],
  clearance: number,
) {
  let earliest: CollisionHit | null = null;
  for (const collider of colliders) {
    const hit = sweepCollider(start, end, collider, clearance);
    if (hit && (!earliest || hit.time < earliest.time)) earliest = hit;
  }
  return earliest;
}

export function resolveCameraCollision(
  previous: CameraPosition,
  desired: CameraPosition,
  colliders: readonly CameraCollider[],
  clearance = CAMERA_COLLISION_CLEARANCE,
): CameraCollisionResult {
  const recoveredStart = recoverFromPenetration(previous, colliders, clearance);
  let current = recoveredStart.position;
  let remaining = {
    x: desired.x - current.x,
    y: desired.y - current.y,
    z: desired.z - current.z,
  };
  let blockedBy = recoveredStart.blockedBy;

  for (let iteration = 0; iteration < MAX_COLLISION_ITERATIONS; iteration += 1) {
    const end = {
      x: current.x + remaining.x,
      y: current.y + remaining.y,
      z: current.z + remaining.z,
    };
    const hit = earliestCollision(current, end, colliders, clearance);
    if (!hit) {
      current = end;
      break;
    }
    blockedBy ??= hit.collider.id;
    const travel = Math.max(0, hit.time - COLLISION_SKIN);
    current = {
      x: current.x + remaining.x * travel + hit.normal.x * COLLISION_SKIN,
      y: current.y + remaining.y * travel + hit.normal.y * COLLISION_SKIN,
      z: current.z + remaining.z * travel + hit.normal.z * COLLISION_SKIN,
    };
    const leftoverScale = 1 - travel;
    const leftover = {
      x: remaining.x * leftoverScale,
      y: remaining.y * leftoverScale,
      z: remaining.z * leftoverScale,
    };
    const inwardDistance = Math.min(
      0,
      leftover.x * hit.normal.x
        + leftover.y * hit.normal.y
        + leftover.z * hit.normal.z,
    );
    remaining = {
      x: leftover.x - hit.normal.x * inwardDistance,
      y: leftover.y - hit.normal.y * inwardDistance,
      z: leftover.z - hit.normal.z * inwardDistance,
    };
    if (Math.hypot(remaining.x, remaining.y, remaining.z) < COLLISION_EPSILON) break;
  }

  const recoveredEnd = recoverFromPenetration(current, colliders, clearance);
  blockedBy ??= recoveredEnd.blockedBy;
  return {
    ...recoveredEnd.position,
    blocked: blockedBy !== null,
    blockedBy,
  };
}
