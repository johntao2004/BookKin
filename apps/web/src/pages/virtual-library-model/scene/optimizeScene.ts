import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

interface GeometryBatch {
  container: THREE.Object3D;
  material: THREE.Material;
  meshes: THREE.Mesh[];
  geometries: THREE.BufferGeometry[];
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface SceneOptimizationResult {
  sourceMeshes: number;
  batchMeshes: number;
  untouchedMeshes: number;
}

/**
 * Collapses static opaque geometry by material after the library is built.
 * The environment never moves, so hundreds of shelf/furniture meshes can be
 * submitted as a handful of large buffers without losing editable builders.
 */
export function optimizeStaticMeshes(
  root: THREE.Group,
  interactiveRoots: THREE.Object3D[],
): SceneOptimizationResult {
  root.updateMatrixWorld(true);

  const interactionOwners = new Map<THREE.Object3D, THREE.Object3D>();
  interactiveRoots.forEach((interactiveRoot) => {
    interactiveRoot.traverse((object) => interactionOwners.set(object, interactiveRoot));
  });

  const batches = new Map<string, GeometryBatch>();
  let untouchedMeshes = 0;

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh) {
      untouchedMeshes += 1;
      return;
    }
    if (
      Array.isArray(object.material) ||
      (object.material.transparent && object.material.userData.batchTransparent !== true)
    ) {
      untouchedMeshes += 1;
      return;
    }

    const material = object.material;
    const container = interactionOwners.get(object) ?? root;
    const attributeSignature = Object.keys(object.geometry.attributes).sort().join(',');
    const key = `${container.uuid}:${material.uuid}:${attributeSignature}:${object.geometry.index ? 'indexed' : 'plain'}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        container,
        material,
        meshes: [],
        geometries: [],
        castShadow: false,
        receiveShadow: false,
      };
      batches.set(key, batch);
    }
    const geometry = object.geometry.clone();
    const toContainer = container.matrixWorld.clone().invert().multiply(object.matrixWorld);
    geometry.applyMatrix4(toContainer);
    batch.meshes.push(object);
    batch.geometries.push(geometry);
    batch.castShadow ||= object.castShadow;
    batch.receiveShadow ||= object.receiveShadow;
  });

  let sourceMeshes = 0;
  let batchMeshes = 0;
  batches.forEach((batch) => {
    if (batch.meshes.length < 2) {
      batch.geometries.forEach((geometry) => geometry.dispose());
      untouchedMeshes += batch.meshes.length;
      return;
    }

    const mergedGeometry = mergeGeometries(batch.geometries, false);
    batch.geometries.forEach((geometry) => geometry.dispose());
    if (!mergedGeometry) {
      untouchedMeshes += batch.meshes.length;
      return;
    }

    batch.meshes.forEach((mesh) => {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
    });
    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();
    const mergedMesh = new THREE.Mesh(mergedGeometry, batch.material);
    mergedMesh.name = `Static geometry batch ${batchMeshes + 1}`;
    mergedMesh.castShadow = batch.castShadow;
    mergedMesh.receiveShadow = batch.receiveShadow;
    batch.container.add(mergedMesh);
    sourceMeshes += batch.meshes.length;
    batchMeshes += 1;
  });

  return { sourceMeshes, batchMeshes, untouchedMeshes };
}
