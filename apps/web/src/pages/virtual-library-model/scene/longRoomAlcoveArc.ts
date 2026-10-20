import * as THREE from 'three';

// 内衬与封口共享同一圆弧段，拱高由照片估计。坐标表示横向偏移及起拱线以上高度，并非测绘数据。
/** Circular segment with a photo-estimated rise, shared by lining and closure.
 * Coordinates are lateral offset and height above the spring, not surveyed data. */
export class LongRoomAlcoveArc extends THREE.Curve<THREE.Vector3> {
  readonly radius: number;
  readonly halfAngle: number;
  constructor(readonly span: number, readonly rise: number) {
    super();
    this.radius = span * span / (8 * rise) + rise / 2;
    this.halfAngle = Math.asin(span / (2 * this.radius));
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = (2 * t - 1) * this.halfAngle;
    return target.set(0, this.rise - this.radius + this.radius * Math.cos(angle), this.radius * Math.sin(angle));
  }
  getTangent(t: number, target = new THREE.Vector3()) {
    const angle = (2 * t - 1) * this.halfAngle;
    return target.set(0, -Math.sin(angle), Math.cos(angle));
  }
}
