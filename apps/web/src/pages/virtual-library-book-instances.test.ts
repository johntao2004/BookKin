import * as THREE from 'three';
import { createCatalogBookInstances } from './virtual-library-book-instances';

function book(x: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({color: 'red', roughness: 0.76});
  const source = new THREE.Mesh(new THREE.BoxGeometry(), material);
  source.userData.catalogInstanceRole = 'shell';
  source.castShadow = source.receiveShadow = true;
  group.position.set(x, 2, -3);
  group.rotation.y = Math.PI / 3;
  group.scale.set(0.3, 0.7, 0.1);
  group.add(source);
  return {group, source};
}

it('preserves full source geometry, material surface properties, world transforms and per-book colors', () => {
  const parent = new THREE.Group();
  parent.position.set(5, 0, 0);
  const first = book(1), second = book(2);
  second.source.material.color.set('blue');
  parent.add(first.group, second.group);
  const instances = createCatalogBookInstances(parent);
  instances.rebuild([first, second]);
  const batch = instances.root.children[0] as THREE.InstancedMesh;
  expect(batch.count).toBe(2);
  expect(batch.geometry.attributes.position.array).toEqual(first.source.geometry.attributes.position.array);
  expect(batch.geometry.index!.array).toEqual(first.source.geometry.index!.array);
  expect((batch.material as THREE.MeshStandardMaterial).roughness).toBe(first.source.material.roughness);
  expect(batch.castShadow && batch.receiveShadow).toBe(true);
  const matrix = new THREE.Matrix4();
  batch.getMatrixAt(0, matrix);
  matrix.elements.forEach((value, index) => expect(value).toBeCloseTo(first.group.matrix.elements[index], 5));
  const color = new THREE.Color();
  batch.getColorAt(1, color);
  expect(color.equals(second.source.material.color)).toBe(true);
  expect(first.source.visible).toBe(false);
  instances.dispose();
});

it('restores the original full-detail mesh for inspection and reuses allocations on unchanged catalog refresh', () => {
  const parent = new THREE.Group(), first = book(1);
  parent.add(first.group);
  const instances = createCatalogBookInstances(parent);
  instances.rebuild([first]);
  const batch = instances.root.children[0] as THREE.InstancedMesh;
  instances.rebuild([first]);
  expect(instances.root.children[0]).toBe(batch);
  first.group.userData.bookPresentation = 'inspection';
  first.group.layers.set(1);
  instances.update();
  const matrix = new THREE.Matrix4();
  batch.getMatrixAt(0, matrix);
  expect(matrix.determinant()).toBe(0);
  expect(first.source.visible).toBe(true);
  first.group.userData.bookPresentation = 'shelved';
  first.group.layers.set(0);
  first.source.material.color.set('green');
  instances.update();
  batch.getMatrixAt(0, matrix);
  expect(matrix.determinant()).toBeGreaterThan(0);
  const color = new THREE.Color();
  batch.getColorAt(0, color);
  color.toArray().forEach((value, index) => expect(value).toBeCloseTo(first.source.material.color.toArray()[index]));
  expect(first.source.visible).toBe(false);
  instances.dispose();
});

it('releases owned batches on replacement and disposal without disposing source geometry or textures', () => {
  const parent = new THREE.Group(), first = book(1), second = book(2);
  parent.add(first.group, second.group);
  const sourceDisposed = vi.spyOn(first.source.geometry, 'dispose');
  const instances = createCatalogBookInstances(parent);
  instances.rebuild([first]);
  const batch = instances.root.children[0] as THREE.InstancedMesh;
  const geometryDisposed = vi.spyOn(batch.geometry, 'dispose');
  const instanceDisposed = vi.spyOn(batch, 'dispose');
  instances.rebuild([second]);
  expect(geometryDisposed).toHaveBeenCalledOnce();
  expect(instanceDisposed).toHaveBeenCalledOnce();
  expect(first.source.visible).toBe(true);
  expect(sourceDisposed).not.toHaveBeenCalled();
  instances.dispose(); instances.dispose();
  expect(second.source.visible).toBe(true);
  expect(instances.root.parent).toBeNull();
});
