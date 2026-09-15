import * as THREE from 'three';
import { instanceBounds } from './instanceBounds';
import { createHistoricalBindingGeometry, createDistantHistoricalBindingGeometry, createHistoricalPageEdges } from './longRoomBindings';

it('contains every binding LOD and paper vertex under varied affine transforms', () => {
  const pages = createHistoricalPageEdges();
  const geometries = [createHistoricalBindingGeometry(), createDistantHistoricalBindingGeometry(), pages.geometry];
  const source = new THREE.Box3();
  for (const geometry of geometries) {
    geometry.computeBoundingBox(); source.union(geometry.boundingBox!);
  }
  const transforms = Array.from({length: 32}, (_, i) => new THREE.Matrix4().compose(
    new THREE.Vector3(i - 16, i % 7, 40 - i * 2),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 0.13, i * 0.29, i * 0.07)),
    new THREE.Vector3(i % 2 ? -0.06 : 0.05, 0.25 + i * 0.01, 0.22),
  ));
  transforms.push(new THREE.Matrix4().makeShear(0.1, 0.2, -0.3, 0.4, 0.5, -0.6));
  const matrices = new Float32Array((transforms.length + 1) * 16);
  transforms.forEach((matrix, index) => matrix.toArray(matrices, index * 16));
  // Unused allocated capacity must not contribute an instance at the origin.
  new THREE.Matrix4().makeTranslation(1000, 1000, 1000).toArray(matrices, transforms.length * 16);
  const bounds = instanceBounds(source, matrices, transforms.length);
  const expected = new THREE.Box3();
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  for (let i = 0; i < transforms.length; i++) {
    const matrix = new THREE.Matrix4().fromArray(matrices, i * 16);
    expected.union(source.clone().applyMatrix4(matrix));
    for (const geometry of geometries) {
      const positions = geometry.getAttribute('position');
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(matrix);
        expect(sphere.distanceToPoint(point)).toBeLessThanOrEqual(1e-10);
      }
    }
  }
  expect(bounds.min.distanceTo(expected.min)).toBeLessThan(1e-10);
  expect(bounds.max.distanceTo(expected.max)).toBeLessThan(1e-10);
  expect(instanceBounds(source, matrices, 0).isEmpty()).toBe(true);
  geometries.forEach(geometry => geometry.dispose());
  pages.material.map!.dispose(); pages.material.dispose();
});
