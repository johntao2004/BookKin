import { readReferenceReaderState } from './reference-library-view';

it('retains only the expected in-app return route and finite scene pose', () => {
  const valid = {returnTo: '/virtual-library', libraryView: {x: 2, y: 7.98, z: -12, yaw: 0.6, pitch: 0.1}};
  expect(readReferenceReaderState(valid)).toEqual(valid);
  expect(readReferenceReaderState({returnTo: 'https://example.com', libraryView: valid.libraryView})).toBeNull();
  expect(readReferenceReaderState({...valid, libraryView: {...valid.libraryView, y: Infinity}})).toBeNull();
  expect(readReferenceReaderState({...valid, libraryView: {...valid.libraryView, z: 50}})).toBeNull();
  expect(readReferenceReaderState({returnTo: '/virtual-library'})).toEqual({returnTo: '/virtual-library', libraryView: null});
});
