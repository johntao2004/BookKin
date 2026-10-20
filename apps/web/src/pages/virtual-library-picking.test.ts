// 验证楼板和墙体遮挡目标，隐藏或不渲染的祖先/材质不应错误阻挡点击。
// Checks wall/floor occlusion while hidden or non-rendered ancestors/materials do not falsely block picking.
import * as THREE from "three";
import { isUnoccludedSceneHit } from "./virtual-library-picking";

type Vec = [number, number, number];

// Picking targets are interaction proxies: invisible materials still raycast,
// so the hit must come from a real Mesh, not a fake object.
function invisibleHitbox(position: Vec, size: Vec = [0.4, 0.4, 0.4]): THREE.Mesh {
  return boxMesh(new THREE.MeshBasicMaterial({ visible: false }), position, size, "target-hitbox");
}

function boxMesh(material: THREE.Material, position: Vec, size: Vec, name = "occluder"): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.name = name;
  return mesh;
}

function opaque(): THREE.Material {
  return new THREE.MeshStandardMaterial({ color: 0x8a6a4a });
}

/** Cast a real ray at the target hitbox and return its first intersection. */
function aimAt(
  scene: THREE.Scene,
  raycaster: THREE.Raycaster,
  target: THREE.Mesh,
  origin: Vec,
  direction: Vec,
): THREE.Intersection {
  scene.updateMatrixWorld(true);
  raycaster.set(
    new THREE.Vector3(origin[0], origin[1], origin[2]),
    new THREE.Vector3(direction[0], direction[1], direction[2]).normalize(),
  );
  const hit = raycaster.intersectObject(target, false)[0];
  if (!hit) throw new Error("test setup failed: the ray missed the target hitbox");
  return hit;
}

function batchedBeam(position: Vec, size: Vec = [0.4, 4, 4]): THREE.BatchedMesh {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new THREE.BatchedMesh(1, 256, 512, opaque());
  const geometryId = mesh.addGeometry(geometry);
  const instanceId = mesh.addInstance(geometryId);
  mesh.setMatrixAt(instanceId, new THREE.Matrix4().makeTranslation(position[0], position[1], position[2]));
  return mesh;
}

describe("virtual library scene picking occlusion", () => {
  it("blocks a target under the floor when picking from the gallery above", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.add(boxMesh(opaque(), [0, 0, 0], [10, 0.2, 10], "floor"), invisibleHitbox([0, -2, 0]));
    scene.add(root);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 100;
    const hit = aimAt(scene, raycaster, root.children[1] as THREE.Mesh, [0, 3, 0], [0, -1, 0]);

    expect(isUnoccludedSceneHit(raycaster, hit, [root])).toBe(false);
    expect(raycaster.far).toBe(100);
  });

  it("blocks a target hidden behind a wall", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.add(boxMesh(opaque(), [3, 1, 0], [0.4, 4, 4], "wall"), invisibleHitbox([6, 1, 0]));
    scene.add(root);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 100;
    const hit = aimAt(scene, raycaster, root.children[1] as THREE.Mesh, [0, 1, 0], [1, 0, 0]);

    expect(isUnoccludedSceneHit(raycaster, hit, [root])).toBe(false);
  });

  it("allows a target with a clear same-level line of sight", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.add(boxMesh(opaque(), [0, -0.5, 0], [10, 0.2, 10], "floor"), invisibleHitbox([6, 1, 0]));
    scene.add(root);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 100;
    const hit = aimAt(scene, raycaster, root.children[1] as THREE.Mesh, [0, 1, 0], [1, 0, 0]);

    // The target is an invisible-material hitbox whose raycast still resolves.
    const targetMaterial = (hit.object as THREE.Mesh).material as THREE.Material;
    expect(targetMaterial).toBeInstanceOf(THREE.Material);
    expect(targetMaterial.visible).toBe(false);
    expect(isUnoccludedSceneHit(raycaster, hit, [root])).toBe(true);
    expect(raycaster.far).toBe(100);
  });

  it("does not block when the only opaque geometry is farther than the target", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.add(boxMesh(opaque(), [4, 1, 0], [0.4, 4, 4], "wall"), invisibleHitbox([2, 1, 0]));
    scene.add(root);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 100;
    const hit = aimAt(scene, raycaster, root.children[1] as THREE.Mesh, [0, 1, 0], [1, 0, 0]);

    expect(isUnoccludedSceneHit(raycaster, hit, [root])).toBe(true);
  });

  it("ignores occluders whose ancestor group is hidden", () => {
    const scene = new THREE.Scene();
    const hiddenGroup = new THREE.Group();
    hiddenGroup.visible = false;
    hiddenGroup.add(boxMesh(opaque(), [3, 1, 0], [0.4, 4, 4], "wall"));
    const root = new THREE.Group();
    root.add(hiddenGroup, invisibleHitbox([6, 1, 0]));
    scene.add(root);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 100;
    const hit = aimAt(scene, raycaster, root.children[1] as THREE.Mesh, [0, 1, 0], [1, 0, 0]);

    expect(isUnoccludedSceneHit(raycaster, hit, [root])).toBe(true);
  });

  it("ignores occluders whose material is not rendered", () => {
    const notRendered: Array<[string, THREE.Material]> = [
      ["material.visible=false", new THREE.MeshStandardMaterial({ visible: false })],
      ["opacity=0", new THREE.MeshStandardMaterial({ opacity: 0 })],
      ["colorWrite=false", new THREE.MeshStandardMaterial({ colorWrite: false })],
      ["semitransparent glass", new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.35 })],
    ];

    for (const [label, material] of notRendered) {
      const scene = new THREE.Scene();
      const root = new THREE.Group();
      root.add(boxMesh(material, [3, 1, 0], [0.4, 4, 4], "wall"), invisibleHitbox([6, 1, 0]));
      scene.add(root);
      const raycaster = new THREE.Raycaster();
      raycaster.far = 100;
      const hit = aimAt(scene, raycaster, root.children[1] as THREE.Mesh, [0, 1, 0], [1, 0, 0]);

      expect(isUnoccludedSceneHit(raycaster, hit, [root]), label).toBe(true);
    }
  });

  it("allows picking through an actual opening between two solid beams", () => {
    const scene = new THREE.Scene();
    const frame = new THREE.Group();
    // The frame bounding box encloses the ray at z=0, but real geometry does not.
    frame.add(
      boxMesh(opaque(), [3, 1, -0.5], [0.4, 4, 0.6], "beam-near"),
      boxMesh(opaque(), [3, 1, 0.5], [0.4, 4, 0.6], "beam-far"),
    );
    const target = invisibleHitbox([6, 1, 0], [0.4, 0.4, 2]);
    const root = new THREE.Group();
    root.add(frame, target);
    scene.add(root);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 100;

    const throughGap = aimAt(scene, raycaster, target, [0, 1, 0], [1, 0, 0]);
    expect(isUnoccludedSceneHit(raycaster, throughGap, [root])).toBe(true);

    const throughBeam = aimAt(scene, raycaster, target, [0, 1, 0.5], [1, 0, 0]);
    expect(isUnoccludedSceneHit(raycaster, throughBeam, [root])).toBe(false);
    expect(raycaster.far).toBe(100);
  });

  it("restores raycaster.far after blocked, allowed, and near-clamped evaluations", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.add(boxMesh(opaque(), [3, 1, 0], [0.4, 4, 4], "wall"), invisibleHitbox([6, 1, 0]));
    scene.add(root);

    const raycaster = new THREE.Raycaster();
    raycaster.far = 50;
    const nearTarget = aimAt(scene, raycaster, root.children[1] as THREE.Mesh, [0, 1, 0], [1, 0, 0]);
    expect(isUnoccludedSceneHit(raycaster, nearTarget, [root])).toBe(false);
    expect(raycaster.far).toBe(50);

    const clearScene = new THREE.Scene();
    const clearRoot = new THREE.Group();
    const clearTarget = invisibleHitbox([6, 1, 0]);
    clearRoot.add(clearTarget);
    clearScene.add(clearRoot);
    const clearHit = aimAt(clearScene, raycaster, clearTarget, [0, 1, 0], [1, 0, 0]);
    expect(isUnoccludedSceneHit(raycaster, clearHit, [clearRoot])).toBe(true);
    expect(raycaster.far).toBe(50);

    // hit.distance - epsilon <= near makes the helper return before scanning.
    raycaster.near = nearTarget.distance;
    expect(isUnoccludedSceneHit(raycaster, nearTarget, [root])).toBe(true);
    expect(raycaster.far).toBe(50);

    const infinite = new THREE.Raycaster();
    const infiniteHit = aimAt(scene, infinite, root.children[1] as THREE.Mesh, [0, 1, 0], [1, 0, 0]);
    expect(isUnoccludedSceneHit(infinite, infiniteHit, [root])).toBe(false);
    expect(infinite.far).toBe(Infinity);
  });

  it("treats a visible batched-mesh instance as an opaque occluder", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const beam = batchedBeam([3, 1, 0]);
    root.add(beam, invisibleHitbox([6, 1, 0]));
    scene.add(root);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 100;
    const hit = aimAt(scene, raycaster, root.children[1] as THREE.Mesh, [0, 1, 0], [1, 0, 0]);

    expect(isUnoccludedSceneHit(raycaster, hit, [root])).toBe(false);
  });

  it("ignores a hidden batched-mesh instance", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const beam = batchedBeam([3, 1, 0]);
    beam.setVisibleAt(0, false);
    root.add(beam, invisibleHitbox([6, 1, 0]));
    scene.add(root);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 100;
    const hit = aimAt(scene, raycaster, root.children[1] as THREE.Mesh, [0, 1, 0], [1, 0, 0]);

    expect(isUnoccludedSceneHit(raycaster, hit, [root])).toBe(true);
    expect(raycaster.far).toBe(100);
  });
});
