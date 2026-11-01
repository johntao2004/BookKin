import * as THREE from 'three';

export interface InstancedCatalogBook { group: THREE.Group }
interface Part { source: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; book: InstancedCatalogBook }
interface Batch { mesh: THREE.InstancedMesh; parts: Part[]; matrices: THREE.Matrix4[]; colors: THREE.Color[] }

// 只实例化几何完全相同的纸页、封壳、饰边、堵头；封面和题名仍保留原纹理。
// Instance identical paper, shell, trim and headband geometry; keep original cover/title textures.
export function createCatalogBookInstances(parent: THREE.Group) {
  const root = new THREE.Group();
  root.name = 'Instanced catalog binding details';
  parent.add(root);
  const batches: Batch[] = [];
  const matrix = new THREE.Matrix4();
  const inverse = new THREE.Matrix4();
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  let disposed = false;
  let previousGroups: THREE.Group[] = [];

  function clear() {
    for (const batch of batches) {
      batch.parts.forEach(({source}) => {source.visible = true;});
      batch.mesh.removeFromParent();
      batch.mesh.geometry.dispose();
      (batch.mesh.material as THREE.Material).dispose();
      batch.mesh.dispose();
    }
    batches.length = 0;
  }

  function update() {
    if (disposed) return;
    parent.updateWorldMatrix(true, false);
    inverse.copy(parent.matrixWorld).invert();
    for (const batch of batches) {
      let moved = false, recolored = false;
      for (let i = 0; i < batch.parts.length; i++) {
        const {book, source} = batch.parts[i];
        const shelved = book.group.visible && book.group.layers.isEnabled(0)
          && book.group.userData.bookPresentation !== 'inspection';
        source.visible = !shelved;
        if (shelved) {
          source.updateWorldMatrix(true, false);
          matrix.multiplyMatrices(inverse, source.matrixWorld);
        } else matrix.copy(hiddenMatrix);
        if (!batch.matrices[i].equals(matrix)) {
          batch.matrices[i].copy(matrix);
          batch.mesh.setMatrixAt(i, matrix);
          moved = true;
        }
        if (!batch.colors[i].equals(source.material.color)) {
          batch.colors[i].copy(source.material.color);
          batch.mesh.setColorAt(i, source.material.color);
          recolored = true;
        }
      }
      if (moved) {
        batch.mesh.instanceMatrix.needsUpdate = true;
        batch.mesh.computeBoundingSphere();
      }
      if (recolored && batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    }
  }

  return {
    root,
    rebuild(books: readonly InstancedCatalogBook[]) {
      if (disposed) return;
      if (books.length === previousGroups.length && books.every((book, i) => book.group === previousGroups[i])) {
        update(); return;
      }
      clear();
      previousGroups = books.map(book => book.group);
      const groups = new Map<string, Part[]>();
      for (const book of books) book.group.children.forEach(source => {
        if (!(source instanceof THREE.Mesh) || !(source.material instanceof THREE.MeshStandardMaterial)
          || typeof source.userData.catalogInstanceRole !== 'string') return;
        const role = source.userData.catalogInstanceRole as string;
        const parts = groups.get(role) ?? [];
        parts.push({book, source: source as Part['source']});
        groups.set(role, parts);
      });
      for (const [role, parts] of groups) {
        const first = parts[0].source;
        const geometry = new THREE.BufferGeometry().copy(first.geometry);
        const material = first.material.clone();
        material.color.setRGB(1, 1, 1);
        const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
        mesh.name = `Catalog ${role} instances`;
        mesh.castShadow = first.castShadow;
        mesh.receiveShadow = first.receiveShadow;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        parts.forEach(({source}, i) => mesh.setColorAt(i, source.material.color));
        batches.push({mesh, parts, matrices: parts.map(() => new THREE.Matrix4().makeScale(-1, -1, -1)),
          colors: parts.map(({source}) => source.material.color.clone())});
        root.add(mesh);
      }
      update();
    },
    update,
    diagnostics: () => ({batches: batches.length, parts: batches.reduce((sum, batch) => sum + batch.parts.length, 0)}),
    dispose() { if (disposed) return; clear(); disposed = true; root.removeFromParent(); },
  };
}
