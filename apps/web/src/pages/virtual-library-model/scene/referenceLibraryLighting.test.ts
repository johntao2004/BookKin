// 验证两侧两层 24 处窗光和吊灯局部阴影，兼容缺少面光源字段的旧配置。
// Checks 24 window lights and local chandelier shadows while retaining compatibility with older lighting configuration.
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { addReferenceLighting, validateReferenceConfig } from './referenceLibrary';

const value: unknown = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));
validateReferenceConfig(value);
const config = value;
const windows = (config as typeof config & {windows: {
  width: number; bottomY: number; springY: number; glassX: number;
  storeys: {id: string; sides: number[]; bottomY: number; springY: number; crownY: number}[];
}}).windows;

function illuminatedRoot() {
  const root = new THREE.Group();
  addReferenceLighting(root, config);
  root.updateMatrixWorld(true);
  return root;
}

describe('reference-library bilateral window daylight', () => {
  it('mounts equal inward-facing diffuse sources inside all twenty-four real windows across both storeys and sides', () => {
    const root = illuminatedRoot();
    const areas = root.children.filter((light): light is THREE.RectAreaLight => light instanceof THREE.RectAreaLight);
    expect(areas).toHaveLength(24);
    expect(windows.storeys.map(storey => [storey.id, storey.sides])).toEqual([['lower', [-1, 1]], ['upper', [-1, 1]]]);
    for (const storey of windows.storeys) {
    const centerY = (storey.bottomY + storey.springY) / 2;
    for (const side of storey.sides) for (const z of [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]) {
      const light = areas.find(light => Math.sign(light.position.x) === side && light.position.z === z && Math.abs(light.position.y - centerY) < 0.001)!;
      expect(light, `window ${side}/${z}`).toBeDefined();
      expect(light.position.x).toBeCloseTo(side * (windows.glassX - 0.24));
      expect(light.position.y).toBeCloseTo(centerY);
      expect(light.width).toBeCloseTo(windows.width - 0.20);
      expect(light.height).toBeCloseTo(storey.springY - storey.bottomY);
      expect(light.position.y - light.height / 2).toBeCloseTo(storey.bottomY);
      expect(light.position.y + light.height / 2).toBeCloseTo(storey.springY);
      // Object3D's +Z points away from an area light's emitting -Z face.
      const emittingNormal = new THREE.Vector3(0, 0, -1).applyQuaternion(light.quaternion);
      expect(emittingNormal.x).toBeCloseTo(-side);
      expect(emittingNormal.y).toBeCloseTo(0);
      expect(emittingNormal.z).toBeCloseTo(0);
      const opposite = areas.find(other => other.position.x === -light.position.x && other.position.z === z && other.position.y === light.position.y)!;
      expect(light.intensity).toBeGreaterThan(0);
      expect(opposite).toBeDefined();
      expect(light.intensity).toBe(opposite.intensity);
      expect(light.color.equals(opposite.color)).toBe(true);
    }
    }
    expect(root.children.filter(light => light instanceof THREE.DirectionalLight)).toHaveLength(0);
  });

  it('keeps warm fixture lights at the existing chandeliers with one local shadow source', () => {
    const root = illuminatedRoot();
    const points = root.children.filter((light): light is THREE.PointLight => light instanceof THREE.PointLight);
    expect(points.map(light => [light.position.x, light.position.z])).toEqual([[0, -8], [0, 1], [0, 10]]);
    for (const light of points) expect(light.position.y).toBeCloseTo(14.4);
    expect(points.every(light => light.color.r > light.color.b && light.intensity > 0 && light.distance === 21)).toBe(true);
    const shadows = root.children.filter(object => object.castShadow);
    expect(shadows).toHaveLength(1);
    expect(shadows[0]).toBe(points[1]);
    expect(points[1].shadow.mapSize.toArray()).toEqual([1024, 1024]);
    const lights = root.children.filter(object => object instanceof THREE.Light);
    expect(lights).toHaveLength(29); // 24 windows, 3 fixtures, hemisphere, ambient.
    expect(config.lighting.hemisphere.intensity).toBeLessThanOrEqual(1);
    expect(config.lighting.ambient.intensity).toBeLessThanOrEqual(0.25);
  });

  it('retains legacy lighting configuration without window-area entries', () => {
    const root = new THREE.Group();
    const legacy = {...config, lighting: {...config.lighting, areas: undefined}};
    addReferenceLighting(root, legacy);
    expect(root.children.filter(light => light instanceof THREE.RectAreaLight)).toHaveLength(0);
    expect(root.children.filter(light => light instanceof THREE.PointLight)).toHaveLength(3);
  });
});
