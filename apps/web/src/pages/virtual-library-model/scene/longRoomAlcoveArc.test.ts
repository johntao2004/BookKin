import * as THREE from 'three';
import { LongRoomAlcoveArc } from './longRoomAlcoveArc';

it('keeps a circular intrados, exact spring endpoints and a horizontal crown tangent', () => {
  const span = 4.335, rise = 0.48;
  const arc = new LongRoomAlcoveArc(span, rise);
  for (let i = 0; i <= 64; i++) {
    const point = arc.getPoint(i / 64);
    expect(Math.hypot(point.z, point.y - rise + arc.radius)).toBeCloseTo(arc.radius, 12);
    expect(point.y).toBeGreaterThanOrEqual(-1e-12);
    const mirrored = arc.getPoint(1 - i / 64);
    expect(point.y).toBeCloseTo(mirrored.y, 12);
    expect(point.z).toBeCloseTo(-mirrored.z, 12);
  }
  expect(arc.getPoint(0).z).toBeCloseTo(-span / 2, 12);
  expect(arc.getPoint(1).z).toBeCloseTo(span / 2, 12);
  expect(arc.getPoint(0).y).toBeCloseTo(0, 12);
  expect(arc.getPoint(0.5).y).toBeCloseTo(rise, 12);
  expect(arc.getTangent(0.5).distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-12);
});
