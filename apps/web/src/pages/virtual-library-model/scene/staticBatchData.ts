import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface AttributeData { array: THREE.TypedArray; itemSize: number; normalized: boolean }
export interface GeometryData {
  attributes: Record<string, AttributeData>; index: AttributeData | null;
  bounds?: {min: number[]; max: number[]; center: number[]; radius: number};
}
export interface StaticBatchInput { geometry: GeometryData; matrix: number[] }
export function packGeometry(geometry: THREE.BufferGeometry): GeometryData {
  const pack = (attribute: THREE.BufferAttribute): AttributeData =>
    ({array: attribute.array, itemSize: attribute.itemSize, normalized: attribute.normalized});
  return {attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) =>
    [name, pack(attribute as THREE.BufferAttribute)])), index: geometry.index ? pack(geometry.index) : null};
}
export function unpackGeometry(data: GeometryData, copyBuffers = false) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(data.attributes))
    geometry.setAttribute(name, new THREE.BufferAttribute(copyBuffers ? attribute.array.slice() : attribute.array, attribute.itemSize, attribute.normalized));
  if (data.index) geometry.setIndex(new THREE.BufferAttribute(copyBuffers ? data.index.array.slice() : data.index.array, data.index.itemSize, data.index.normalized));
  if (data.bounds) {
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3().fromArray(data.bounds.min), new THREE.Vector3().fromArray(data.bounds.max));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3().fromArray(data.bounds.center), data.bounds.radius);
  }
  return geometry;
}
/** Input must own its buffers: postMessage structured-clones the sources first. */
export function bakeStaticBatch(input: StaticBatchInput[]): GeometryData | null {
  const geometries: THREE.BufferGeometry[] = [];
  let merged: THREE.BufferGeometry | null = null;
  try {
    for (const item of input) {
      // Structured clone preserves shared array references between template
      // instances. Each transform must own a copy rather than rebake a neighbour.
      const geometry = unpackGeometry(item.geometry, true); geometries.push(geometry);
      geometry.applyMatrix4(new THREE.Matrix4().fromArray(item.matrix));
    }
    merged = mergeGeometries(geometries, false);
    if (!merged) return null;
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    return {...packGeometry(merged), bounds: {min: merged.boundingBox!.min.toArray(), max: merged.boundingBox!.max.toArray(),
      center: merged.boundingSphere!.center.toArray(), radius: merged.boundingSphere!.radius}};
  } finally {
    geometries.forEach(geometry => geometry.dispose()); merged?.dispose();
  }
}
