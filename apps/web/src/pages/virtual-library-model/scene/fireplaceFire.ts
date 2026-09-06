import * as THREE from 'three';
import { PALETTE } from '../config';

/** A bounded volume: the fire keeps its depth as the viewer orbits the hearth. */
export function createFireplaceFire() {
  const group = new THREE.Group();
  group.name = 'Fireplace living fire';
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uAmber: {value: new THREE.Color(PALETTE.brass).multiplyScalar(1.65)},
      uCore: {value: new THREE.Color(PALETTE.parchment)},
    },
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    vertexShader: /* glsl */`
      varying vec3 vPosition;
      varying vec3 vCamera;
      void main() {
        vPosition = position;
        vCamera = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uAmber;
      uniform vec3 uCore;
      varying vec3 vPosition;
      varying vec3 vCamera;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.13, 0.27, 0.43));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float density(vec3 p) {
        float h = p.y + 0.5;
        vec3 flow = vec3(p.x * 7.0, h * 5.0 - uTime * 1.8, p.z * 4.0);
        float n = noise(flow) * 0.65 + noise(flow * 2.3 - uTime * 0.4) * 0.35;
        float flame = 0.0;
        for (int i = 0; i < 5; i++) {
          float id = float(i);
          float height = 0.64 + 0.15 * sin(id * 2.4 + uTime * 1.7) + 0.13 * (1.0 - abs(id - 2.0) / 2.0);
          float taper = max(0.0, 1.0 - h / height);
          float radius = 0.135 * pow(taper, 0.75);
          float drift = sin(h * 9.0 - uTime * 2.8 + id * 1.8) * h * 0.12;
          vec2 crossSection = vec2(p.x - (id - 2.0) * 0.165 - drift, p.z * 0.42);
          float edge = length(crossSection) + (n - 0.5) * 0.23 * h;
          float tongue = 1.0 - smoothstep(max(0.0, radius - 0.055), radius + 0.055, edge);
          tongue *= 1.0 - smoothstep(height - 0.1, height, h);
          flame = max(flame, tongue);
        }
        float turbulent = smoothstep(0.18 + h * 0.32, 0.62 + h * 0.2, n);
        return flame * turbulent * smoothstep(0.0, 0.075, h)
          * (1.0 - smoothstep(0.32, 0.49, abs(p.z)));
      }
      void main() {
        vec3 ray = normalize(vPosition - vCamera);
        vec3 invRay = 1.0 / (ray + vec3(0.00001));
        vec3 nearBounds = (-vec3(0.5) - vCamera) * invRay;
        vec3 farBounds = (vec3(0.5) - vCamera) * invRay;
        vec3 lo = min(nearBounds, farBounds), hi = max(nearBounds, farBounds);
        float start = max(0.0, max(lo.x, max(lo.y, lo.z)));
        float end = min(hi.x, min(hi.y, hi.z));
        if (end <= start) discard;
        float stepSize = (end - start) / 32.0;
        vec4 accumulated = vec4(0.0);
        for (int i = 0; i < 32; i++) {
          vec3 p = vCamera + ray * (start + (float(i) + 0.5) * stepSize);
          float d = density(p);
          float heat = clamp(d * 0.55 + (0.5 - p.y) * 0.25, 0.0, 1.0);
          vec3 color = mix(uAmber, uCore, pow(heat, 3.0));
          float alpha = 1.0 - exp(-d * stepSize * 3.4);
          accumulated.rgb += (1.0 - accumulated.a) * color * alpha;
          accumulated.a += (1.0 - accumulated.a) * alpha;
        }
        if (accumulated.a < 0.01) discard;
        gl_FragColor = vec4(accumulated.rgb / accumulated.a, accumulated.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const volume = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  volume.name = 'Volumetric hearth flames';
  // Entire volume stays behind the grate and inside the masonry opening.
  volume.scale.set(1.66, 1.32, 0.4);
  volume.position.set(0, 1.08, -0.61);
  group.add(volume);

  const coalMaterial = new THREE.MeshStandardMaterial({color: PALETTE.oakEdge,
    emissive: PALETTE.brass, emissiveIntensity: 1.4, roughness: 1});
  const coalGeometry = new THREE.IcosahedronGeometry(0.095, 1);
  coalGeometry.computeBoundingBox();
  const coals = new THREE.InstancedMesh(coalGeometry, coalMaterial, 21);
  coals.name = 'Grounded glowing coals';
  const transform = new THREE.Object3D();
  for (let index = 0; index < coals.count; index++) {
    transform.position.set((index % 7 - 3) * 0.21, 0.22 - coalGeometry.boundingBox!.min.y * 0.48,
      -0.49 - Math.floor(index / 7) * 0.12);
    transform.rotation.set(0, index * 1.13, 0);
    transform.scale.set(1, 0.48, 0.8);
    transform.updateMatrix();
    coals.setMatrixAt(index, transform.matrix);
  }
  group.add(coals);
  return {
    group,
    animate(elapsed: number) {
      material.uniforms.uTime.value = elapsed;
      coalMaterial.emissiveIntensity = 1.3 + Math.sin(elapsed * 1.4) * 0.1;
    },
  };
}
