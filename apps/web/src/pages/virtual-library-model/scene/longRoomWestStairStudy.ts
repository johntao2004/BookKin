import { createWestRakingWainscot } from './longRoomWestWainscot';
import { createWestTreadMaterial, mapWestTreadGrain } from './longRoomWestTread';
import { createWestStairEnclosureSteps } from './longRoomWestEnclosure';
import { createWestStartingNewel } from './longRoomWestNewel';
import { createWestOakFinish, mapWestPanelGrain } from './longRoomWestOak';
import { alignLongRoomBoardGrain } from './longRoomTimber';
import * as THREE from 'three';
import { createAccessBalusterGeometry, createAccessHandrail, createAccessHandrailProfile } from './longRoomAccessJoinery';
import type { LibraryMaterials } from './materials';
import { markCameraCollider } from '../../virtual-library-collision';

/** Working topology from Abbott's perspective illustrations, not a measured plan.
 * Local axes deliberately have no claimed compass orientation. */
export const WEST_STAIR_STUDY = {
  width: 1.6, rise: 5.4 / 32, going: 0.32,
  flights: [
    { start: [-2.08, 0, 3.84], direction: [0, -1], steps: 12 },
    { start: [-1.28, 2.025, -0.8], direction: [1, 0], steps: 8 },
    { start: [2.08, 3.375, 0], direction: [0, 1], steps: 12 },
  ],
  landings: [[-2.08, 2.025, -0.8], [2.08, 3.375, -0.8], [2.08, 5.4, 4.64]],
} as const;

/** Smooth outward sweep and level-to-raking transition; all amplitudes estimated. */
export function westStairStartSweep(distance: number) {
  const transition = 4 * WEST_STAIR_STUDY.going;
  const remaining = Math.max(0, 1 - distance / transition);
  return { outward: 0.26 * remaining ** 3,
    lift: WEST_STAIR_STUDY.rise / WEST_STAIR_STUDY.going * transition / 3 * remaining ** 3 };
}

/** Existing swan-neck ramp: rise into the landing and leave with a level tangent.
 * Transition lengths and lift are photographic estimates. */
export function westStairLandingLift(flightIndex: number, distance: number) {
  const transition = 0.8, lift = 0.28, slope = WEST_STAIR_STUDY.rise / WEST_STAIR_STUDY.going;
  const run = WEST_STAIR_STUDY.flights[flightIndex].steps * WEST_STAIR_STUDY.going;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  let result = 0;
  if (flightIndex > 0 && distance < transition) {
    const t = THREE.MathUtils.clamp(distance / transition, 0, 1);
    result += lift * (1 - smooth(t)) + slope * transition * (2 * t * t - t ** 3 - t);
  }
  const t = THREE.MathUtils.clamp((distance - run + transition) / transition, 0, 1);
  result += slope * transition * (t * t - t ** 3) + (flightIndex < 2 ? lift * smooth(t) : 0);
  return result;
}

class WestStartHandrailPath extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly flightIndex = 0) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) {
    const flight = WEST_STAIR_STUDY.flights[this.flightIndex];
    const distance = t * flight.steps * WEST_STAIR_STUDY.going;
    const sweep = this.flightIndex === 0 ? westStairStartSweep(distance) : {outward: 0, lift: 0};
    const [dx, dz] = flight.direction, side = -WEST_STAIR_STUDY.width / 2 + 0.04 - sweep.outward;
    return target.set(flight.start[0] + dx * distance + dz * side,
      flight.start[1] + 1.05 + distance * WEST_STAIR_STUDY.rise / WEST_STAIR_STUDY.going
        + sweep.lift + westStairLandingLift(this.flightIndex, distance),
      flight.start[2] + dz * distance - dx * side);
  }
}

export function* createWestStairStudySteps(materials: Pick<LibraryMaterials, 'floor' | 'woodWarm' | 'wood' | 'woodDark' | 'parchment'>, cutaway = true): Generator<string, THREE.Group> {
  materials = {...materials, ...createWestOakFinish(materials.wood)};
  const root = new THREE.Group();
  root.name = 'West pavilion stair topology study';
  root.userData.fidelity = 'historical-perspective-based-unmeasured-study';
  const surfaces = new THREE.Group(); surfaces.name = 'West stair walking surfaces'; root.add(surfaces);
  const box = (parent: THREE.Group, name: string, size: number[], position: number[], material: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    if (material === materials.wood || material === materials.woodWarm || material === materials.woodDark)
      alignLongRoomBoardGrain(mesh);
    mesh.name = name; mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  box(surfaces, 'Study entrance floor', [8, 0.18, 9], [0, -0.09, 1.1], materials.floor);
  const treadMaterial = createWestTreadMaterial(materials.woodWarm);
  yield 'construction-west-materials';
  const { width, rise, going } = WEST_STAIR_STUDY;
  const balusterGeometry = createAccessBalusterGeometry();
  const balusterMatrices: THREE.Matrix4[] = [];
  const rail = (a: THREE.Vector3, b: THREE.Vector3) => {
    const beam = createAccessHandrail(a.distanceTo(b), materials.woodWarm);
    beam.position.copy(a);
    const forward = b.clone().sub(a).normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
    const up = new THREE.Vector3().crossVectors(forward, right);
    beam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward));
    root.add(beam); return beam;
  };
  const addWainscot = (start: THREE.Vector3, direction: THREE.Vector3, run: number, height: number) => {
    const right = new THREE.Vector3(direction.z, 0, -direction.x);
    const depth = direction.x === 0 ? 0.4 : 0.33;
    const lining = createWestRakingWainscot(run, height, depth, materials.wood, materials.woodWarm);
    lining.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      direction, new THREE.Vector3(0, 1, 0), right.clone().negate()));
    lining.position.copy(start).addScaledVector(right, width / 2 + depth);
    root.add(lining);
    const center = start.clone().addScaledVector(direction, run / 2).addScaledVector(right, width / 2 + depth / 2);
    markCameraCollider(root, {id: `west-wainscot-${start.x}-${start.y}-${start.z}`,
      shape: 'box', center: {x: center.x, y: start.y + height / 2 + 0.4, z: center.z},
      size: {x: depth + 0.12, y: height + 1.1, z: run}, rotationY: Math.atan2(direction.x, direction.z)});
  };
  for (const flight of WEST_STAIR_STUDY.flights) {
    const start = new THREE.Vector3(...flight.start);
    const direction = new THREE.Vector3(flight.direction[0], 0, flight.direction[1]);
    const right = new THREE.Vector3(direction.z, 0, -direction.x);
    const run = flight.steps * going, height = flight.steps * rise;
    const firstFlight = flight === WEST_STAIR_STUDY.flights[0];
    const flightIndex = WEST_STAIR_STUDY.flights.indexOf(flight);
    // Fill the wall-side gap behind the timber lining, keeping the tread width clear.
    addWainscot(start, direction, run, height);
    for (let step = 0; step < flight.steps; step++) {
      const center = start.clone().addScaledVector(direction, (step + 0.5) * going);
      const top = start.y + (step + 1) * rise;
      const guardCenter=start.clone().addScaledVector(direction,(step+0.5)*going)
        .addScaledVector(right,-width/2+0.04);
      if(firstFlight) guardCenter.addScaledVector(right,-westStairStartSweep((step+0.5)*going).outward);
      // Eye-based collision uses a standing-body barrier above the low physical rail.
      markCameraCollider(root,{id:`west-flight-guard-${WEST_STAIR_STUDY.flights.indexOf(flight)}-${step}`,shape:'box',
        center:{x:guardCenter.x,y:top+1,z:guardCenter.z},size:{x:0.12,y:2.25,z:going+0.025},
        rotationY:Math.atan2(direction.x,direction.z)});
      const widening = firstFlight ? westStairStartSweep(step * going).outward : 0;
      center.addScaledVector(right, -widening / 2);
      const tread = box(surfaces, 'West stair tread', [width + widening, 0.065, going + 0.018],
        [center.x, top - 0.0325, center.z], treadMaterial);
      const halfWidth = (width + widening) / 2, halfDepth = (going + 0.018) / 2, corner = 0.035;
      const outline = new THREE.Shape();
      outline.moveTo(-halfWidth + corner, -halfDepth);
      outline.lineTo(halfWidth - corner, -halfDepth);
      outline.quadraticCurveTo(halfWidth, -halfDepth, halfWidth, -halfDepth + corner);
      outline.lineTo(halfWidth, halfDepth); outline.lineTo(-halfWidth, halfDepth);
      outline.lineTo(-halfWidth, -halfDepth + corner);
      outline.quadraticCurveTo(-halfWidth, -halfDepth, -halfWidth + corner, -halfDepth);
      outline.closePath();
      tread.geometry.dispose();
      tread.geometry = new THREE.ExtrudeGeometry(outline, {depth: 0.065, bevelEnabled: false, curveSegments: 6});
      tread.geometry.rotateX(Math.PI / 2); tread.geometry.translate(0, 0.0325, 0);
      mapWestTreadGrain(tread.geometry, step * 0.173);
      tread.rotation.y = Math.atan2(direction.x, direction.z);
      const riserCenter = start.clone().addScaledVector(direction, step * going).addScaledVector(right, -widening / 2);
      const riser = box(root, 'West stair closed riser', [width + widening, rise, 0.028],
        [riserCenter.x, top - rise / 2, riserCenter.z], materials.wood);
      riser.rotation.y = tread.rotation.y;
      // Inner-well guard: all feet are supported by an individual tread.
      for (const fraction of [0.25, 0.75]) {
        if (firstFlight && step === 0 && fraction === 0.25) continue;
        const point = start.clone().addScaledVector(direction, (step + fraction) * going)
          .addScaledVector(right, -width / 2 + 0.04);
        const sweep = firstFlight ? westStairStartSweep((step + fraction) * going) : {outward: 0, lift: 0};
        point.addScaledVector(right, -sweep.outward);
        const railHeight = 1.05 + (fraction - 1) * rise + sweep.lift
          + westStairLandingLift(flightIndex, (step + fraction) * going);
        balusterMatrices.push(new THREE.Matrix4().compose(new THREE.Vector3(point.x, top, point.z),
          new THREE.Quaternion(), new THREE.Vector3(1, railHeight / 1.05, 1)));
      }
    }
    if (firstFlight) {
      // The photograph has a substantial column at the start, not another thin baluster.
      const distance = going * 0.375, sweep = westStairStartSweep(distance);
      const railY = 1.05 + distance * rise / going + sweep.lift;
      const newel = createWestStartingNewel(railY - rise, materials.woodWarm);
      newel.position.copy(start).addScaledVector(direction, distance)
        .addScaledVector(right, -width / 2 + 0.04 - sweep.outward);
      newel.position.y = start.y + rise; root.add(newel);
    }
    {
      const handrail = new THREE.Mesh(new THREE.ExtrudeGeometry(createAccessHandrailProfile(), {
        steps: 96, bevelEnabled: false, curveSegments: 8, extrudePath: new WestStartHandrailPath(flightIndex),
      }), materials.woodWarm);
      handrail.name = firstFlight ? 'West stair outward swept ramp handrail' : `West stair swan-neck ramp handrail ${flightIndex}`;
      const p = handrail.geometry.getAttribute('position'), n = handrail.geometry.getAttribute('normal');
      const uv = handrail.geometry.getAttribute('uv');
      const grainPath = new WestStartHandrailPath(flightIndex), grainCenter = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        const distance = (p.getX(i) - start.x) * direction.x + (p.getZ(i) - start.z) * direction.z;
        const center = grainPath.getPoint(distance / run, grainCenter);
        const lateral = (p.getX(i) - center.x) * right.x + (p.getZ(i) - center.z) * right.z;
        const across = Math.abs(n.getY(i)) > 0.7 ? lateral : p.getY(i) - center.y;
        if (Math.abs(n.getX(i) * direction.x + n.getZ(i) * direction.z) > 0.9)
          uv.setXY(i, lateral / 0.6, (p.getY(i) - center.y) / 0.6);
        else uv.setXY(i, across / 0.6, distance / 2.8);
      }
      handrail.castShadow = handrail.receiveShadow = true; root.add(handrail);
    }
    // Continuous underside supports the risers, instead of floating thin treads.
    const section = new THREE.Shape();
    section.moveTo(0, -0.24); section.lineTo(run, height - 0.24);
    section.lineTo(run, height); section.lineTo(0, 0); section.closePath();
    const soffit = new THREE.Mesh(new THREE.ExtrudeGeometry(section, {depth: width, bevelEnabled: false}), materials.woodDark);
    mapWestPanelGrain(soffit.geometry, height / run, true);
    soffit.name = 'West stair continuous timber soffit';
    const matrix = new THREE.Matrix4().makeBasis(direction, new THREE.Vector3(0, 1, 0), right.clone().negate());
    soffit.quaternion.setFromRotationMatrix(matrix);
    soffit.position.copy(start).addScaledVector(right, width / 2);
    soffit.castShadow = soffit.receiveShadow = true; root.add(soffit);
    yield `construction-west-flight-${flightIndex}`;
  }
  // Level returns carry the dado continuously around the two turning platforms.
  for (const [x, y, z, dx, dz, length] of [
    [-2.08, 2.025, 0, 0, -1, 1.6], [-2.88, 2.025, -0.8, 1, 0, 1.6],
    [1.28, 3.375, -0.8, 1, 0, 1.6], [2.08, 3.375, -1.6, 0, 1, 1.6],
    [2.08, 5.4, 3.84, 0, 1, 0.28], [2.08, 5.4, 5.16, 0, 1, 0.28],
  ]) {
    addWainscot(new THREE.Vector3(x,y,z), new THREE.Vector3(dx,0,dz), length, 0);
    yield 'construction-west-landing-wainscot';
  }
  for (const landing of WEST_STAIR_STUDY.landings) {
    const platform = box(surfaces, 'West stair turning or arrival landing', [width, 0.24, width],
      [landing[0], landing[1] - 0.12, landing[2]], treadMaterial);
    mapWestTreadGrain(platform.geometry, landing[1] * 0.173);
  }
  const platformGuards = new THREE.Group(); platformGuards.name = 'West stair platform guards'; root.add(platformGuards);
  const levelGuard = (a: THREE.Vector3, b: THREE.Vector3) => {
    const length = a.distanceTo(b), count = Math.ceil(length / 0.16);
    markCameraCollider(platformGuards,{id:`west-platform-guard-${a.x}-${a.z}-${b.x}-${b.z}`,shape:'box',
      center:{x:(a.x+b.x)/2,y:a.y+1,z:(a.z+b.z)/2},size:{x:0.12,y:2.25,z:length},
      rotationY:Math.atan2(b.x-a.x,b.z-a.z)});
    platformGuards.add(rail(a.clone().add(new THREE.Vector3(0, 1.05, 0)), b.clone().add(new THREE.Vector3(0, 1.05, 0))));
    for (let i = 0; i <= count; i++) {
      const point = a.clone().lerp(b, i / count);
      const baluster = new THREE.Mesh(balusterGeometry, materials.woodWarm);
      baluster.name = 'West platform supported baluster'; baluster.position.copy(point);
      baluster.castShadow = baluster.receiveShadow = true; platformGuards.add(baluster);
    }
  };
  // Guard the exposed well-side edge; far-side wall/door geometry is unresolved.
  levelGuard(new THREE.Vector3(1.32, 5.4, 3.84), new THREE.Vector3(1.32, 5.4, 5.38));
  levelGuard(new THREE.Vector3(1.32, 5.4, 5.38), new THREE.Vector3(1.56, 5.4, 5.38));
  // A metre-wide arrival opening is a provisional connection, not a historic door measurement.
  levelGuard(new THREE.Vector3(2.6, 5.4, 5.38), new THREE.Vector3(2.84, 5.4, 5.38));
  for (const [x, y, z] of [[-1.34, 2.025, -0.06], [1.34, 3.375, -0.06]]) {
    const post = new THREE.Mesh(balusterGeometry, materials.woodWarm);
    post.name = 'West stair turning newel study'; post.position.set(x, y, z); post.scale.set(1.25, 1.33 / 1.05, 1.25);
    post.castShadow = post.receiveShadow = true; platformGuards.add(post);
  }
  // Rounded landing junctions cover the intersecting horizontal rail ends.
  // The exact carved turn profile remains a photograph-based approximation.
  for (const [x, y, z] of [[-1.34, 3.355, -0.06], [1.34, 4.705, -0.06]]) {
    const geometry = new THREE.LatheGeometry([
      new THREE.Vector2(0,-0.05), new THREE.Vector2(0.08,-0.05),
      new THREE.Vector2(0.1,-0.035), new THREE.Vector2(0.12,-0.015),
      new THREE.Vector2(0.12,0.015), new THREE.Vector2(0.1,0.035), new THREE.Vector2(0,0.04),
    ],48);
    const cap = new THREE.Mesh(geometry, materials.woodWarm);
    cap.name = 'West stair rounded landing junction'; cap.position.set(x, y, z);
    cap.castShadow = cap.receiveShadow = true; platformGuards.add(cap);
  }
  const balusters = new THREE.InstancedMesh(balusterGeometry, materials.woodWarm, balusterMatrices.length);
  balusters.name = 'West stair supported fluted balusters';
  balusterMatrices.forEach((matrix, index) => balusters.setMatrixAt(index, matrix));
  balusters.castShadow = balusters.receiveShadow = true; root.add(balusters);
  box(surfaces, 'West study upper threshold bridge', [1.04, 0.12, 0.4], [2.08, 5.34, 5.56], materials.woodWarm);
  yield 'construction-west-landing-guards';
  root.add(yield* createWestStairEnclosureSteps(materials.parchment, materials.woodWarm, cutaway));
  return root;
}

/** Synchronous component/offline entry shares exactly the progressive geometry. */
export function createWestStairStudy(materials: Pick<LibraryMaterials, 'floor' | 'woodWarm' | 'wood' | 'woodDark' | 'parchment'>, cutaway = true) {
  const steps = createWestStairStudySteps(materials, cutaway);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}
