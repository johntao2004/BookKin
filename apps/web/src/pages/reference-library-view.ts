import { REFERENCE_LIBRARY } from './virtual-library-model/hogwartsLibraryLayout';
import type { ReferencePoint } from './virtual-library-model/hogwartsLibraryLayout';

export interface ReferenceCameraPose {x: number; y: number; z: number; yaw: number; pitch: number}
export interface ReferenceReaderState {returnTo: '/virtual-library'; libraryView: ReferenceCameraPose | null}
export type ReferenceStairSide = 'left' | 'right';
export interface ReferenceViewDirection { yaw: number; pitch: number }

export function readReferenceReaderState(value: unknown): ReferenceReaderState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<ReferenceReaderState>;
  if (state.returnTo !== '/virtual-library') return null;
  const pose = state.libraryView;
  if (!pose) return {returnTo: '/virtual-library', libraryView: null};
  if (![pose.x, pose.y, pose.z, pose.yaw, pose.pitch].every(Number.isFinite)
    || Math.abs(pose.x) > REFERENCE_LIBRARY.width / 2
    || Math.abs(pose.z) > REFERENCE_LIBRARY.length / 2
    || pose.y < 1 || pose.y > REFERENCE_LIBRARY.height) return null;
  return {returnTo: '/virtual-library', libraryView: {...pose}};
}

// 沿导引楼梯终点延续的通道朝向放置视线，两端使用最终受支撑切线，不强制转四分之一圈。
/**
 * Face along the passage that continues from a guided stair route's next end.
 * Both exits follow the final supported tangent without a forced quarter-turn.
 */
export function getReferenceStairExitView(
  route: readonly ReferencePoint[],
  _side: ReferenceStairSide,
  _galleryY = REFERENCE_LIBRARY.galleryY,
): ReferenceViewDirection {
  if (route.length < 2) throw new Error('The stair route is too short');
  const end = route[route.length - 1];
  const previous = [...route].reverse().find(point => (
    Math.hypot(point.x - end.x, point.y - end.y, point.z - end.z) > 0.0001
  ));
  if (!previous) throw new Error('The stair route has no exit direction');
  return {
    yaw: Math.atan2(previous.x - end.x, previous.z - end.z),
    pitch: 0,
  };
}
