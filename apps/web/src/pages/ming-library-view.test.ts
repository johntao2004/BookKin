import { readMingLibraryReaderState, readMingLibraryView } from './ming-library-view';

const view = {view: 'shelf', mode: 'orbit', position: [12, 2, -20], target: [10, 1, -20],
  yaw: 0, pitch: 0, cutaway: false, night: false, gateOpen: true};
it('retains the Ming camera pose across the reader return route', () => {
  expect(readMingLibraryReaderState({returnTo: '/virtual-library', mingLibraryView: view}))
    .toEqual({returnTo: '/virtual-library', libraryView: null, mingLibraryView: view});
});
it('rejects non-finite, out-of-scene or unknown view state', () => {
  for (const patch of [{position: [Infinity, 1, 2]}, {target: [9999, 1, 2]}, {view: 'unknown'}, {mode: 'unknown'}, {night: 'false'}]) {
    expect(readMingLibraryView({...view, ...patch})).toBeNull();
  }
  expect(readMingLibraryReaderState({returnTo: '/other', mingLibraryView: view})).toBeNull();
});
