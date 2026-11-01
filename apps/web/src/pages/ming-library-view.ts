const views = new Set(['gate', 'door', 'connection', 'hall', 'throne', 'objects', 'dragon', 'upper', 'shelf', 'stairs', 'ceiling', 'roof', 'plaque', 'beasts', 'terrace', 'overview', 'courtyard', 'dais', 'chiwen', 'carpet', 'windows', 'passages', 'terracepassage', 'entrycolumns']);
export interface MingLibraryView {
  view: string; mode: 'orbit' | 'walk' | 'seated'; position: number[]; target: number[];
  yaw: number; pitch: number; cutaway: boolean; night: boolean; gateOpen: boolean;
}
export function readMingLibraryView(value: unknown): MingLibraryView | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as MingLibraryView;
  const point = (p: unknown) => Array.isArray(p) && p.length === 3 && p.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 650);
  if (!views.has(v.view) || !['orbit', 'walk', 'seated'].includes(v.mode) || !point(v.position) || !point(v.target)
    || !Number.isFinite(v.yaw) || !Number.isFinite(v.pitch)
    || ![v.cutaway, v.night, v.gateOpen].every(n => typeof n === 'boolean')) return null;
  return {view: v.view, mode: v.mode, position: [...v.position], target: [...v.target], yaw: v.yaw,
    pitch: v.pitch, cutaway: v.cutaway, night: v.night, gateOpen: v.gateOpen};
}
export function readMingLibraryReaderState(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const state = value as {returnTo?: unknown; mingLibraryView?: unknown};
  const view = readMingLibraryView(state.mingLibraryView);
  return state.returnTo === '/virtual-library' && view
    ? {returnTo: '/virtual-library' as const, libraryView: null, mingLibraryView: view} : null;
}
