import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  collectCameraColliders,
  markCameraCollider,
  resolveCameraCollision,
  type BoxCameraCollider,
  type CameraPosition,
} from './virtual-library-collision';
import {
  isGuidedStairSupport,
  resolveReferenceWalkingCollision,
  WALKING_CAMERA_CLEARANCE,
  WALKING_EYE_HEIGHT,
} from './virtual-library-navigation';
import {
  referenceCameraColliderDescriptors,
  validateReferenceConfig,
  type ReferenceSceneConfig,
} from './virtual-library-model/scene/referenceLibrary';
import { REFERENCE_LIBRARY as R } from './virtual-library-model/hogwartsLibraryLayout';

const rawConfig: unknown = JSON.parse(
  readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'),
);
validateReferenceConfig(rawConfig);
const config: ReferenceSceneConfig = rawConfig;
const colliderRoot = new THREE.Group();
for (const collider of referenceCameraColliderDescriptors(config)) {
  markCameraCollider(colliderRoot, collider);
}
const colliders = collectCameraColliders(colliderRoot, 'hall');
const obstacles = colliders.filter(collider => !isGuidedStairSupport(collider));
const galleryEyeY = R.galleryY + WALKING_EYE_HEIGHT;

function planarLength(route: readonly CameraPosition[]) {
  return route.slice(1).reduce((total, point, index) => total
    + Math.hypot(point.x - route[index].x, point.z - route[index].z), 0);
}

function planarRoutePoint(route: readonly CameraPosition[], distance: number) {
  let remaining = Math.max(0, distance);
  for (let index = 1; index < route.length; index++) {
    const start = route[index - 1];
    const end = route[index];
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    if (length < 0.000001) continue;
    if (remaining <= length) {
      const ratio = remaining / length;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
        z: start.z + (end.z - start.z) * ratio,
      };
    }
    remaining -= length;
  }
  return {...route[route.length - 1]};
}

function offsetRouteLane(route: readonly CameraPosition[], lateralOffset: number) {
  if (lateralOffset === 0) return route.map(point => ({...point}));
  const normals: ({x: number; z: number} | null)[] = [];
  for (let index = 1; index < route.length; index++) {
    const start = route[index - 1];
    const end = route[index];
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    normals.push(length < 0.000001
      ? null
      : {x: -(end.z - start.z) / length, z: (end.x - start.x) / length});
  }
  return route.map((point, index) => {
    let previous: {x: number; z: number} | undefined;
    for (let cursor = index - 1; cursor >= 0; cursor--) {
      const candidate = normals[cursor];
      if (candidate) {
        previous = candidate;
        break;
      }
    }
    const next = normals.slice(index).find(normal => normal !== null);
    const first = previous ?? next;
    const second = next ?? previous;
    if (!first || !second) throw new Error('Route has no planar direction');
    const normalX = first.x + second.x;
    const normalZ = first.z + second.z;
    const normalLength = Math.hypot(normalX, normalZ);
    return {
      x: point.x + normalX / normalLength * lateralOffset,
      y: point.y,
      z: point.z + normalZ / normalLength * lateralOffset,
    };
  });
}

function walkRouteLane(
  lane: readonly CameraPosition[],
  side: 'left' | 'right',
  descending: boolean,
  label: string,
) {
  const failures: Record<string, unknown>[] = [];
  const total = planarLength(lane);
  const stepCount = Math.ceil(total / 0.05);
  const stepLength = total / stepCount;
  let previous = {...lane[0], y: lane[0].y + WALKING_EYE_HEIGHT};

  for (let step = 1; step <= stepCount; step++) {
    const target = planarRoutePoint(lane, step * stepLength);
    const desired = {x: target.x, y: previous.y, z: target.z};
    const safe = resolveReferenceWalkingCollision(
      previous,
      desired,
      colliders,
      obstacles,
      config.stairRoutes,
    );
    const evidence = {
      label,
      side,
      direction: descending ? 'down' : 'up',
      step,
      requestedStep: Math.hypot(desired.x - previous.x, desired.z - previous.z),
      expectedY: target.y + WALKING_EYE_HEIGHT,
      previous,
      desired,
      safe,
      blockedBy: safe.blockedBy,
    };
    if (safe.blocked) {
      failures.push({reason: 'blocked', ...evidence});
      break;
    }
    if (evidence.requestedStep < 0.035 || evidence.requestedStep > 0.061) {
      failures.push({reason: 'requested-step', ...evidence});
    }
    if (Math.hypot(safe.x - target.x, safe.z - target.z) > 0.03) {
      failures.push({reason: 'planar-drift', ...evidence});
    }
    if (Math.abs(safe.y - evidence.expectedY) > 0.22) {
      failures.push({reason: 'height-drift', ...evidence});
    }
    if (Math.abs(safe.y - previous.y) > 0.3) {
      failures.push({reason: 'height-jump', ...evidence});
    }
    previous = safe;
  }

  const end = lane[lane.length - 1];
  if (Math.hypot(previous.x - end.x, previous.z - end.z) > 0.03
    || Math.abs(previous.y - (end.y + WALKING_EYE_HEIGHT)) > 0.03) {
    failures.push({
      reason: 'endpoint',
      label,
      side,
      direction: descending ? 'down' : 'up',
      end,
      actual: previous,
    });
  }
  return failures;
}

function boxCollider(id: string) {
  const collider = colliders.find(candidate => candidate.id === id);
  if (collider?.shape !== 'box') throw new Error(`Missing box collider ${id}`);
  return collider as BoxCameraCollider;
}

describe('reference-library manual walking on the real stair geometry', () => {
  it('keeps real tread supports out of the walking obstacle set but in full collision', () => {
    expect(colliders.some(collider => isGuidedStairSupport(collider))).toBe(true);
    expect(obstacles.some(collider => isGuidedStairSupport(collider))).toBe(false);
  });

  it('walks all four authored centerlines through to their real endpoints', () => {
    const failures: Record<string, unknown>[] = [];
    for (const side of ['left', 'right'] as const) {
      for (const descending of [false, true]) {
        const source = config.stairRoutes[side];
        const route = descending ? [...source].reverse() : source;
        failures.push(...walkRouteLane(route, side, descending, 'centerline'));
      }
    }
    expect(failures).toEqual([]);
  });

  it('walks a symmetric 5 cm lateral lane through every endpoint without swallowing blocks', () => {
    const failures: Record<string, unknown>[] = [];
    for (const side of ['left', 'right'] as const) {
      for (const descending of [false, true]) {
        const source = config.stairRoutes[side];
        const route = descending ? [...source].reverse() : source;
        for (const lateralOffset of [-0.05, 0.05]) {
          failures.push(...walkRouteLane(
            offsetRouteLane(route, lateralOffset),
            side,
            descending,
            `offset-${lateralOffset}`,
          ));
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('walks across the enlarged landing and rejoins the gallery in both directions', () => {
    for (const side of [-1, 1]) for (const reverse of [false, true]) {
      const path = [
        {x: side * 5.5, y: galleryEyeY, z: -14.0},
        {x: side * 7.85, y: galleryEyeY, z: -15.3},
        {x: side * 7.85, y: galleryEyeY, z: -16.2},
        {x: side * 6.5, y: galleryEyeY, z: -16.2},
        {x: side * 8.65, y: galleryEyeY, z: -16.2},
        {x: side * 10.1, y: galleryEyeY, z: -16.2},
        {x: side * 10.1, y: galleryEyeY, z: -14.1},
      ];
      if (reverse) path.reverse();
      let previous = path[0];
      for (const target of path.slice(1)) {
        const start = previous;
        const count = Math.ceil(Math.hypot(target.x - start.x, target.z - start.z) / 0.14);
        for (let step = 1; step <= count; step++) {
          const desired = {x: start.x + (target.x - start.x) * step / count,
            y: galleryEyeY, z: start.z + (target.z - start.z) * step / count};
          const safe = resolveReferenceWalkingCollision(previous, desired, colliders, obstacles, config.stairRoutes);
          expect(Math.hypot(safe.x - desired.x, safe.z - desired.z),
            JSON.stringify({side, reverse, desired, safe})).toBeLessThan(0.005);
          expect(safe.y).toBeCloseTo(galleryEyeY, 4);
          previous = safe;
        }
      }
    }
  });

  it('keeps a body-wide northbound outlet free on both mirrored landings', () => {
    for (const sign of [-1, 1]) for (const offset of [-0.2, 0, 0.2]) {
      let previous = {x: sign * 4.6 + offset, y: galleryEyeY, z: -13.55};
      for (let i = 1; i <= 55; i++) {
        const desired = {...previous, z: -13.55 - i * 0.055};
        const actual = resolveReferenceWalkingCollision(previous, desired,
          colliders, obstacles, config.stairRoutes);
        expect(Math.hypot(actual.x - desired.x, actual.z - desired.z),
          JSON.stringify({sign, offset, desired, actual})).toBeLessThan(0.005);
        expect(actual.y).toBeCloseTo(galleryEyeY, 3);
        previous = actual;
      }
    }
  });

  it('reaches both route endpoints with alternating 0.14/0.28 m cardinal keyboard steps', () => {
    const failures: Record<string, unknown>[] = [];
    for (const side of ['left', 'right'] as const) {
      for (const descending of [false, true]) {
        const source = config.stairRoutes[side];
        const route = descending ? [...source].reverse() : source;
        const targets = Array.from({length: route.length - 1}, (_, index) => index + 1);
        let previous = {x: route[0].x, y: route[0].y + WALKING_EYE_HEIGHT, z: route[0].z};
        let iteration = 0;
        let stopped = false;

        for (const targetIndex of targets) {
          const target = route[targetIndex];
          let targetIteration = 0;
          while (Math.hypot(target.x - previous.x, target.z - previous.z) > 0.005) {
            if (iteration >= 300) {
              failures.push({
                reason: 'iteration-limit',
                side,
                direction: descending ? 'down' : 'up',
                targetIndex,
                target,
                actual: previous,
                iteration,
              });
              stopped = true;
              break;
            }
            const preferredAxis = targetIteration % 2 === 0 ? 'x' : 'z';
            const otherAxis = preferredAxis === 'x' ? 'z' : 'x';
            const axis = Math.abs(target[preferredAxis] - previous[preferredAxis]) > 0.000001
              ? preferredAxis
              : otherAxis;
            const requestedStep = targetIteration % 2 === 0 ? 0.14 : 0.28;
            const remaining = target[axis] - previous[axis];
            const amount = Math.sign(remaining) * Math.min(Math.abs(remaining), requestedStep);
            const desired: CameraPosition = axis === 'x'
              ? {...previous, x: previous.x + amount}
              : {...previous, z: previous.z + amount};
            const safe = resolveReferenceWalkingCollision(
              previous,
              desired,
              colliders,
              obstacles,
              config.stairRoutes,
            );
            const evidence = {
              side,
              direction: descending ? 'down' : 'up',
              targetIndex,
              target,
              iteration,
              targetIteration,
              axis,
              requestedStep,
              previous,
              desired,
              safe,
              blockedBy: safe.blockedBy,
            };
            if (safe.blocked) {
              failures.push({reason: 'blocked', ...evidence});
              stopped = true;
              break;
            }
            if (Math.hypot(safe.x - previous.x, safe.z - previous.z) < 0.001) {
              failures.push({reason: 'stalled', ...evidence});
              stopped = true;
              break;
            }
            if (Math.abs(safe.y - previous.y) > 0.4) {
              failures.push({reason: 'height-jump', ...evidence});
              stopped = true;
              break;
            }
            previous = safe;
            iteration++;
            targetIteration++;
          }
          if (stopped) break;
        }

        const end = route[route.length - 1];
        if (!stopped && (Math.hypot(previous.x - end.x, previous.z - end.z) > 0.005
          || Math.abs(previous.y - (end.y + WALKING_EYE_HEIGHT)) > 0.03)) {
          failures.push({
            reason: 'endpoint',
            side,
            direction: descending ? 'down' : 'up',
            target: end,
            actual: previous,
            iteration,
          });
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('gates the overlapping top and bottom spiral plan positions by current foot height', () => {
    const failures: Record<string, unknown>[] = [];
    for (const side of ['left', 'right'] as const) {
      const route = config.stairRoutes[side];
      const bottom = route[5];
      const top = route[37];
      expect(Math.hypot(top.x - bottom.x, top.z - bottom.z)).toBeLessThan(0.32);

      const fromGround = {x: bottom.x, y: bottom.y + WALKING_EYE_HEIGHT, z: bottom.z};
      const atTopPlan = resolveReferenceWalkingCollision(
        fromGround,
        {x: top.x, y: fromGround.y, z: top.z},
        colliders,
        obstacles,
        config.stairRoutes,
      );
      if (Math.abs(atTopPlan.y - fromGround.y) > 0.24) {
        failures.push({reason: 'ground-snapped-up', side, fromGround, target: top, actual: atTopPlan});
      }

      const fromTop = {x: bottom.x, y: top.y + WALKING_EYE_HEIGHT, z: bottom.z};
      const atGroundPlan = resolveReferenceWalkingCollision(
        fromTop,
        {x: top.x, y: fromTop.y, z: top.z},
        colliders,
        obstacles,
        config.stairRoutes,
      );
      if (Math.abs(atGroundPlan.y - fromTop.y) > 0.24) {
        failures.push({reason: 'top-snapped-down', side, fromTop, target: top, actual: atGroundPlan});
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps the outer guard and central column solid without changing levels', () => {
    const failures: Record<string, unknown>[] = [];
    for (const side of ['left', 'right'] as const) {
      const route = config.stairRoutes[side];
      const center = config.colliders.find(collider => collider.id === `stair-center-${side === 'left' ? -1 : 1}`);
      if (!center || center.shape !== 'cylinder') throw new Error(`Missing stair center ${side}`);
      const point = planarRoutePoint(route, planarLength(route) / 2);
      const previous = {...point, y: point.y + WALKING_EYE_HEIGHT};
      const radial = {x: point.x - center.center.x, z: point.z - center.center.z};
      const radius = Math.hypot(radial.x, radial.z);
      const outward = {x: radial.x / radius, z: radial.z / radius};

      const outside = resolveReferenceWalkingCollision(
        previous,
        {x: point.x + outward.x * 1.2, y: previous.y, z: point.z + outward.z * 1.2},
        colliders,
        obstacles,
        config.stairRoutes,
      );
      const outsideRadius = Math.hypot(outside.x - center.center.x, outside.z - center.center.z);
      if (!outside.blocked || outsideRadius > 1.85 || Math.abs(outside.y - previous.y) > 0.24) {
        failures.push({reason: 'outer-guard', side, point, center: center.center, radial: outsideRadius, actual: outside});
      }

      const inside = resolveReferenceWalkingCollision(
        previous,
        {x: point.x - outward.x * 1.2, y: previous.y, z: point.z - outward.z * 1.2},
        colliders,
        obstacles,
        config.stairRoutes,
      );
      const insideRadius = Math.hypot(inside.x - center.center.x, inside.z - center.center.z);
      if (!inside.blocked || insideRadius < 0.69 || Math.abs(inside.y - previous.y) > 0.24) {
        failures.push({reason: 'center-column', side, point, center: center.center, radial: insideRadius, actual: inside});
      }
    }
    expect(failures).toEqual([]);
  });

  it('uses every solid for Shift flight instead of applying stair support', () => {
    const failures: Record<string, unknown>[] = [];
    for (const side of ['left', 'right'] as const) {
      const route = config.stairRoutes[side];
      const point = planarRoutePoint(route, planarLength(route) / 2);
      const target = planarRoutePoint(route, planarLength(route) / 2 + 0.6);
      const previous = {...point, y: point.y + WALKING_EYE_HEIGHT};
      const desired = {x: target.x, y: previous.y, z: target.z};
      const actual = resolveReferenceWalkingCollision(
        previous,
        desired,
        colliders,
        obstacles,
        config.stairRoutes,
        false,
      );
      const expected = resolveCameraCollision(previous, desired, colliders, WALKING_CAMERA_CLEARANCE);
      if (JSON.stringify(actual) !== JSON.stringify(expected) || !actual.blockedBy?.startsWith('stair-tread-')) {
        failures.push({side, previous, desired, actual, expected});
      }
    }
    expect(failures).toEqual([]);
  });

  it('sweeps the 1.5-unit button step against the real end wall', () => {
    const wall = boxCollider('end-a-wall');
    const x = 6.5;
    const previous = {
      x,
      y: wall.y + wall.halfY - WALKING_EYE_HEIGHT,
      z: wall.z + wall.halfZ + 0.55,
    };
    const desired = {x, y: previous.y, z: wall.z - wall.halfZ - 0.55};
    expect(Math.hypot(desired.x - previous.x, desired.z - previous.z)).toBeCloseTo(1.5, 6);
    const actual = resolveReferenceWalkingCollision(
      previous,
      desired,
      colliders,
      obstacles,
      config.stairRoutes,
    );
    expect({
      blocked: actual.blocked,
      blockedBy: actual.blockedBy,
      previous,
      desired,
      actual,
    }).toMatchObject({blocked: true});
    expect(actual.z, JSON.stringify({previous, desired, actual})).toBeGreaterThan(
      wall.z + wall.halfZ + WALKING_CAMERA_CLEARANCE.horizontal - 0.002,
    );
  });
});
