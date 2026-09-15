import * as THREE from 'three';
import { createWestStairStudy, WEST_STAIR_STUDY, westStairLandingLift } from './longRoomWestStairStudy';

it('supports every baluster and keeps the three flights connected through landings', () => {
  const material = new THREE.MeshStandardMaterial();
  const materials = {floor: material, woodWarm: material, wood: material, woodDark: material, parchment: material};
  const root = createWestStairStudy(materials);
  root.updateMatrixWorld(true);
  const surfaces = root.getObjectByName('West stair walking surfaces')!;
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0,-1,0));
  const heightAt = (x: number, z: number) => {
    ray.ray.origin.set(x,10,z);
    const hit = ray.intersectObject(surfaces)[0];
    expect(hit, `missing support at ${x}, ${z}`).toBeDefined();
    return hit.point.y;
  };
  const balusters = root.getObjectByName('West stair supported fluted balusters') as THREE.InstancedMesh;
  for (let index = 0; index < balusters.count; index++) {
    const matrix = new THREE.Matrix4(); balusters.getMatrixAt(index,matrix);
    const foot = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(heightAt(foot.x,foot.z)).toBeCloseTo(foot.y,5);
    {
      const top = foot.y + matrix.elements[5] * 1.05;
      const joinRay = new THREE.Raycaster(new THREE.Vector3(foot.x,top-0.2,foot.z),new THREE.Vector3(0,1,0));
      const flightIndex = index < 23 ? 0 : index < 39 ? 1 : 2;
      const name = flightIndex === 0 ? 'West stair outward swept ramp handrail' : `West stair swan-neck ramp handrail ${flightIndex}`;
      const join = joinRay.intersectObject(root.getObjectByName(name)!)[0];
      expect(join, `baluster ${index} misses swept handrail`).toBeDefined();
      joinRay.ray.origin.y = top + 0.2; joinRay.ray.direction.y = -1;
      const crown = joinRay.intersectObject(root.getObjectByName(name)!)[0];
      expect(crown, `baluster ${index} has no handrail crown`).toBeDefined();
      // A steep sweep has greater vertical thickness than its normal section.
      // The supported column head must terminate inside the actual rail volume.
      expect(join.point.y).toBeLessThanOrEqual(top + 0.001);
      expect(crown.point.y).toBeGreaterThanOrEqual(top - 0.001);
    }
  }
  const startingNewel = root.getObjectByName('West stair starting column newel')!;
  expect(startingNewel).toBeDefined();
  for (const dx of [-0.075, 0.075]) for (const dz of [-0.075, 0.075]) {
    expect(heightAt(startingNewel.position.x + dx, startingNewel.position.z + dz))
      .toBeCloseTo(startingNewel.position.y, 5);
  }
  const newelBounds = new THREE.Box3().setFromObject(startingNewel);
  const joinRay = new THREE.Raycaster(new THREE.Vector3(startingNewel.position.x,
    newelBounds.max.y - 0.15, startingNewel.position.z), new THREE.Vector3(0,1,0));
  const join = joinRay.intersectObject(root.getObjectByName('West stair outward swept ramp handrail')!)[0];
  expect(join).toBeDefined();
  expect(Math.abs(join.point.y - newelBounds.max.y)).toBeLessThan(0.08);
  const guards = root.getObjectByName('West stair platform guards')!;
  guards.traverse(object => {
    if (object.name === 'West platform supported baluster' || object.name === 'West stair turning newel study')
      expect(heightAt(object.position.x, object.position.z)).toBeCloseTo(object.position.y, 5);
  });
  const exitRay = new THREE.Raycaster(new THREE.Vector3(2.08,6,4.64), new THREE.Vector3(0,0,1), 0, 1);
  expect(exitRay.intersectObject(guards)).toHaveLength(0);
  const wellRay = new THREE.Raycaster(new THREE.Vector3(2.08,6.45,4.64), new THREE.Vector3(-1,0,0), 0, 1);
  expect(wellRay.intersectObject(guards).length).toBeGreaterThan(0);
  const route = [[-2.08,4.1],[-2.08,0],[-2.08,-0.8],[2.08,-0.8],[2.08,0],[2.08,4.64]];
  let previous = 0;
  for (let leg = 0; leg < route.length - 1; leg++) {
    const [a,b] = [route[leg],route[leg+1]];
    const count = Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/0.05);
    for (let i = 0; i <= count; i++) {
      const height = heightAt(a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count);
      expect(height-previous).toBeGreaterThanOrEqual(-0.001);
      expect(height-previous).toBeLessThan(0.18);
      previous = height;
    }
  }
  expect(previous).toBeCloseTo(5.4,5);
});

it('meets each landing with level handrail tangents without a downward kink', () => {
  const slope = WEST_STAIR_STUDY.rise / WEST_STAIR_STUDY.going, delta = 0.00001;
  for (let index = 0; index < 3; index++) {
    const run = WEST_STAIR_STUDY.flights[index].steps * WEST_STAIR_STUDY.going;
    const height = (distance: number) => distance * slope + westStairLandingLift(index, distance);
    expect(Math.abs((height(run) - height(run - delta)) / delta)).toBeLessThan(0.001);
    if (index > 0) expect(Math.abs((height(delta) - height(0)) / delta)).toBeLessThan(0.001);
    for (let distance = delta; distance <= run; distance += 0.01)
      expect(height(distance) - height(distance - delta)).toBeGreaterThanOrEqual(-0.000001);
  }
});

it('keeps both estimated door apertures open and connects the upper threshold', () => {
  const material = new THREE.MeshStandardMaterial();
  const root = createWestStairStudy({floor:material,woodWarm:material,wood:material,woodDark:material,parchment:material},false);
  root.updateMatrixWorld(true);
  const enclosure = root.getObjectByName('West stair estimated enclosure')!;
  // G_E-2 places the lower door toward the second-flight landing (x=1.9);
  // keep this assertion aligned with the source-derived shifted opening.
  const ray = new THREE.Raycaster(new THREE.Vector3(1.9,1.1,0),new THREE.Vector3(0,0,-1),0,3);
  expect(ray.intersectObject(enclosure)).toHaveLength(0);
  ray.ray.origin.x = 1;
  expect(ray.intersectObject(enclosure).length).toBeGreaterThan(0);
  ray.ray.origin.set(2.08,6.4,4.8); ray.ray.direction.set(0,0,1); ray.far=1.3;
  expect(ray.intersectObject(enclosure)).toHaveLength(0);
  ray.ray.origin.x=1.3;
  expect(ray.intersectObject(enclosure).length).toBeGreaterThan(0);
  ray.ray.direction.set(0,-1,0); ray.far=10;
  for(let z=5.3;z<=5.72;z+=0.02) {
    ray.ray.origin.set(2.08,7,z);
    const hit=ray.intersectObject(root.getObjectByName('West stair walking surfaces')!)[0];
    expect(hit).toBeDefined(); expect(hit.point.y).toBeCloseTo(5.4,5);
  }
});
