import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as THREE from 'three';
import { StrictMode } from 'react';
import { TestProviders } from '../test/TestProviders';
import { VirtualLibraryExperience } from './VirtualLibraryExperience';
import type { ReferenceLibraryBuilt } from './virtual-library-model/scene/referenceLibrary';

const lifecycle = vi.hoisted(() => ({lostCanvases: new WeakSet<object>(), build: vi.fn(), world: vi.fn(), compile: vi.fn(), render: vi.fn(), created: vi.fn(), disposed: vi.fn(), lost: vi.fn()}));
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>();
  return {...actual, WebGLRenderer: class {
    shadowMap = {};
    info = {reset: () => undefined, render: {calls: 0, triangles: 0}, memory: {geometries: 0, textures: 0}};
    capabilities = {getMaxAnisotropy: () => 1};
    compileAsync = lifecycle.compile;
    render = lifecycle.render;
    setPixelRatio() {return undefined;}
    setSize() {return undefined;}
    extensions = {has: () => false};
    canvas: HTMLCanvasElement;
    constructor({canvas}: {canvas: HTMLCanvasElement}) {
      if (lifecycle.lostCanvases.has(canvas)) throw new Error('Cannot reuse a lost WebGL context');
      this.canvas = canvas;
      lifecycle.created();
    }
    dispose = lifecycle.disposed;
    forceContextLoss = () => {lifecycle.lostCanvases.add(this.canvas); lifecycle.lost();};
  }};
});
vi.mock('./virtual-library-model/scene/referenceLibrary', async original => ({
  ...await original<typeof import('./virtual-library-model/scene/referenceLibrary')>(),
  buildReferenceLibraryProgressively: lifecycle.build,
}));

vi.mock('./virtual-library-scene', async original => ({
  ...await original<typeof import('./virtual-library-scene')>(),
  createVirtualLibraryWorld: lifecycle.world,
}));

function readyHall() {
  const hall = {root: new THREE.Group(), disposeArchitecture: vi.fn().mockResolvedValue(undefined),
    referenceConfig: {lighting: {exposure: 1}, stairRoutes: {left: [], right: []}}} as unknown as ReferenceLibraryBuilt;
  lifecycle.build.mockResolvedValue(hall);
  lifecycle.world.mockImplementation((scene: THREE.Scene) => {
    scene.add(hall.root);
    return {sceneBooks: [], shelfHitMeshes: [], getCameraColliders: () => [], setActiveRoom: () => undefined,
      getExpandedShelfSectionId: () => null,
      syncCatalogBooks: () => ({addedBookIds: [], removedBookIds: [], replacedBookIds: []})};
  });
  return hall;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('WebGLRenderingContext', class {});
});
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});

it('cancels construction and releases the renderer immediately when leaving during initialization', async () => {
  let signal!: AbortSignal;
  lifecycle.build.mockImplementation((_loader, input: AbortSignal) => {
    signal = input;
    return new Promise((_resolve, reject) => input.addEventListener('abort', () => reject(input.reason)));
  });
  const view = render(<TestProviders initialPath="/virtual-library"><VirtualLibraryExperience /></TestProviders>);
  await waitFor(() => expect(lifecycle.build).toHaveBeenCalledOnce());
  view.unmount();
  expect(signal.aborted).toBe(true);
  expect(lifecycle.disposed).toHaveBeenCalledOnce();
  await act(async () => {await Promise.resolve();});
  expect(lifecycle.lost).toHaveBeenCalledOnce();
  expect(lifecycle.disposed).toHaveBeenCalledOnce();
});

it('disposes a late architecture result without reviving its scene or disposing the renderer twice', async () => {
  let resolve!: (hall: ReferenceLibraryBuilt) => void;
  lifecycle.build.mockReturnValue(new Promise<ReferenceLibraryBuilt>(done => {resolve = done;}));
  const view = render(<TestProviders initialPath="/virtual-library"><VirtualLibraryExperience /></TestProviders>);
  await waitFor(() => expect(lifecycle.build).toHaveBeenCalledOnce());
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  root.add(new THREE.Mesh(geometry, material));
  const disposeGeometry = vi.spyOn(geometry, 'dispose');
  const disposeMaterial = vi.spyOn(material, 'dispose');
  const disposeArchitecture = vi.fn().mockResolvedValue(undefined);
  view.unmount();
  await act(async () => resolve({root, disposeArchitecture} as unknown as ReferenceLibraryBuilt));
  expect(disposeArchitecture).toHaveBeenCalledOnce();
  expect(disposeGeometry).toHaveBeenCalledOnce();
  expect(disposeMaterial).toHaveBeenCalledOnce();
  expect(lifecycle.disposed).toHaveBeenCalledOnce();
  expect(lifecycle.lost).toHaveBeenCalledOnce();
});

it('aborts outstanding scene texture requests when initialization fails', async () => {
  let requestSignal!: AbortSignal;
  const failed = vi.fn();
  vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
    requestSignal = init?.signal as AbortSignal;
    return new Promise((_resolve, reject) => requestSignal.addEventListener('abort', () => reject(requestSignal.reason)));
  });
  lifecycle.build.mockImplementation((loader: THREE.TextureLoader) => {
    loader.load('/pending-scene-image.png', undefined, undefined, failed);
    return Promise.reject(new Error('Test initialization failure'));
  });
  const view = render(<TestProviders initialPath="/virtual-library"><VirtualLibraryExperience /></TestProviders>);
  await waitFor(() => expect(lifecycle.disposed).toHaveBeenCalledOnce());
  expect(requestSignal.aborted).toBe(true);
  expect(failed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({name: 'AbortError'}));
  expect(lifecycle.lost).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => {await Promise.resolve();});
  expect(lifecycle.disposed).toHaveBeenCalledOnce();
  expect(lifecycle.lost).toHaveBeenCalledOnce();
});


it('tears down event listeners and graphics after shader compilation fails', async () => {
  const hall = readyHall();
  lifecycle.compile.mockRejectedValue(new Error('Test shader failure'));
  const added = vi.spyOn(window, 'addEventListener');
  const removed = vi.spyOn(window, 'removeEventListener');
  const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
  const view = render(<TestProviders initialPath="/virtual-library"><VirtualLibraryExperience /></TestProviders>);
  await waitFor(() => expect(lifecycle.compile).toHaveBeenCalledOnce());
  await waitFor(() => expect(lifecycle.disposed).toHaveBeenCalledOnce());
  for (const event of ['resize', 'pointerup', 'pointercancel', 'keydown', 'keyup', 'blur']) {
    const call = added.mock.calls.find(([name]) => name === event);
    expect(call).toBeDefined();
    expect(removed).toHaveBeenCalledWith(event, call![1]);
  }
  expect(disconnect).toHaveBeenCalled();
  expect(hall.disposeArchitecture).toHaveBeenCalledOnce();
  expect(lifecycle.render).not.toHaveBeenCalled();
  view.unmount();
  expect(lifecycle.disposed).toHaveBeenCalledOnce();
});

it('ignores a late shader completion after leaving the page', async () => {
  const hall = readyHall();
  let resolve!: () => void;
  lifecycle.compile.mockReturnValue(new Promise<void>(done => {resolve = done;}));
  const view = render(<TestProviders initialPath="/virtual-library"><VirtualLibraryExperience /></TestProviders>);
  await waitFor(() => expect(lifecycle.compile).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => resolve());
  expect(hall.disposeArchitecture).toHaveBeenCalledOnce();
  expect(lifecycle.disposed).toHaveBeenCalledOnce();
  expect(lifecycle.lost).toHaveBeenCalledOnce();
  expect(lifecycle.render).not.toHaveBeenCalled();
});


it('retries on the same connected canvas without reusing a permanently lost context', async () => {
  readyHall();
  lifecycle.compile.mockRejectedValueOnce(new Error('Test transient shader failure'))
    .mockImplementation(() => new Promise<void>(() => undefined));
  const view = render(<TestProviders initialPath="/virtual-library"><VirtualLibraryExperience /></TestProviders>);
  const canvas = screen.getByRole('img', {name: '可 360 度环视的虚拟图书馆 3D 场景'});
  fireEvent.click(await screen.findByRole('button', {name: '重新加载场景'}));
  await waitFor(() => expect(lifecycle.compile).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('img', {name: '可 360 度环视的虚拟图书馆 3D 场景'})).toBe(canvas);
  expect(lifecycle.created).toHaveBeenCalledTimes(2);
  expect(lifecycle.disposed).toHaveBeenCalledOnce();
  expect(lifecycle.lost).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => {await Promise.resolve();});
  expect(lifecycle.disposed).toHaveBeenCalledTimes(2);
  expect(lifecycle.lost).toHaveBeenCalledOnce();
});

it('keeps the canvas usable through StrictMode effect replay and retires it on unmount', async () => {
  readyHall();
  lifecycle.compile.mockImplementation(() => new Promise<void>(() => undefined));
  const view = render(<StrictMode><TestProviders initialPath="/virtual-library"><VirtualLibraryExperience /></TestProviders></StrictMode>);
  await waitFor(() => expect(lifecycle.compile).toHaveBeenCalledOnce());
  expect(lifecycle.created).toHaveBeenCalledOnce();
  expect(lifecycle.lost).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => {await Promise.resolve();});
  expect(lifecycle.disposed).toHaveBeenCalledOnce();
  expect(lifecycle.lost).toHaveBeenCalledOnce();
});
