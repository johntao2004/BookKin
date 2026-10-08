import { REFERENCE_LIBRARY } from './virtual-library-model/hogwartsLibraryLayout';

export interface ReferenceCameraPose {x: number; y: number; z: number; yaw: number; pitch: number}
export interface ReferenceReaderState {returnTo: '/virtual-library'; libraryView: ReferenceCameraPose | null}

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
