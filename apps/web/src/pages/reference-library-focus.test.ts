import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { getReferenceShelfFocusFov, getReferenceShelfFrame } from './reference-library-focus';
import { collectCameraColliders, markCameraCollider, resolveCameraCollision } from './virtual-library-collision';
import { createReferenceCatalogAnchors, referenceCameraColliderDescriptors, type ReferenceSceneConfig } from './virtual-library-model/scene/referenceLibrary';
import { REFERENCE_LIBRARY as R } from './virtual-library-model/hogwartsLibraryLayout';

it('uses the correct elevation and face for every shelf frame', () => {
  for (const section of createReferenceCatalogAnchors().shelfSections) {
    const info = {...section, targetY: section.baseY + section.height / 2};
    const points = getReferenceShelfFrame(info);
    expect(points).toHaveLength(4);
    expect(Math.min(...points.map(point => point.y))).toBeCloseTo(section.baseY);
    expect(Math.max(...points.map(point => point.y))).toBeCloseTo(section.baseY + section.height);
    expect(points.every(point => Math.abs(point.z - (section.centerZ! - Math.sin(section.angle) * R.shelfFrontOffset)) < 0.00001)).toBe(true);
  }
});

it('keeps all 56 focused cases inside desktop and portrait frames after wall collision', () => {
  const config: ReferenceSceneConfig = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
  const root = new THREE.Group();
  referenceCameraColliderDescriptors(config).forEach(collider => markCameraCollider(root, collider));
  const colliders = collectCameraColliders(root, 'hall');
  for (const aspect of [16 / 9, 9 / 16]) for (const section of createReferenceCatalogAnchors().shelfSections) {
    const info = {...section, targetY: section.baseY + section.height / 2};
    const yaw = -section.angle - Math.PI / 2;
    const pitch = section.baseY > 0 ? 0.035 : -0.045;
    const target = new THREE.Vector3(section.centerX! - Math.cos(section.angle) * section.depth * 0.56,
      info.targetY, section.centerZ! - Math.sin(section.angle) * section.depth * 0.56);
    const desired = {
      x: target.x + Math.sin(yaw) * Math.cos(pitch) * 2.8,
      y: target.y + Math.sin(pitch) * 2.8,
      z: THREE.MathUtils.clamp(target.z + Math.cos(yaw) * Math.cos(pitch) * 2.8, -R.length / 2 + 0.38, R.length / 2 - 0.38),
    };
    const safe = resolveCameraCollision(desired, desired, colliders);
    const camera = new THREE.PerspectiveCamera(58, aspect, 0.08, 120);
    camera.position.set(safe.x, safe.y, safe.z);
    camera.lookAt(target);
    camera.fov = getReferenceShelfFocusFov(camera, info);
    camera.updateProjectionMatrix();
    expect(camera.fov).toBeGreaterThan(0);
    expect(camera.fov).toBeLessThan(150);
    // A correct eye position is insufficient if its near-plane corners clip
    // through the wall. Check all corners after the focus FOV adjustment.
    camera.updateMatrixWorld(true);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const corner = new THREE.Vector3(x, y, -1).unproject(camera);
      const safeCorner = resolveCameraCollision(corner, corner, colliders, 0);
      expect(Math.hypot(safeCorner.x - corner.x, safeCorner.y - corner.y, safeCorner.z - corner.z)).toBeLessThan(0.000001);
    }
    for (const corner of getReferenceShelfFrame(info)) {
      const projected = corner.project(camera);
      expect(Math.abs(projected.x)).toBeLessThanOrEqual(1 / 1.12 + 0.00001);
      expect(Math.abs(projected.y)).toBeLessThanOrEqual(1 / 1.12 + 0.00001);
      expect(projected.z).toBeGreaterThan(-1);
      expect(projected.z).toBeLessThan(1);
    }
  }
});
