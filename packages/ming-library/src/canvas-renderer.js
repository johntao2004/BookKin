import * as THREE from 'three';

/**
 * CPU compatibility renderer for environments in which WebGL cannot start.
 *
 * It reads the same BufferGeometry, instance matrices, materials and UV atlases
 * as the WebGL renderer. It does not replace the library with a static picture.
 * Visibility uses camera-space bounds and six-plane clipping; retained faces
 * are selected by their visible screen area, never by scene traversal order.
 *
 * Opaque visibility uses a per-pixel depth buffer. Texture coordinates are
 * perspective-correct, including clipped triangles and transformed UV atlases.
 * Smooth vertex lighting follows the real surface normals. Limitations: no
 * shadow maps, skinning, custom shaders or
 * postprocessing. This is intentionally a compatibility path, not a WebGL peer.
 */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
const LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LINEAR[i] = c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
}
function srgb(v) {
  v = clamp(v, 0, 1);
  return Math.round(255 * (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055));
}
function pack(r, g, b) { return (r << 16) | (g << 8) | b; }
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
function pixel(r, g, b, a = 255) {
  return LITTLE_ENDIAN ? ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
    : ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}
const SRGB = new Uint8Array(4097);
for (let i = 0; i <= 4096; i++) SRGB[i] = srgb(i / 4096);
function byte(v) { return SRGB[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096 + .5) | 0]; }
function det3(m) {
  return m[0] * (m[5] * m[10] - m[6] * m[9])
    - m[4] * (m[1] * m[10] - m[2] * m[9])
    + m[8] * (m[1] * m[6] - m[2] * m[5]);
}
function maxScale(m) {
  return Math.sqrt(Math.max(
    m[0] * m[0] + m[1] * m[1] + m[2] * m[2],
    m[4] * m[4] + m[5] * m[5] + m[6] * m[6],
    m[8] * m[8] + m[9] * m[9] + m[10] * m[10]
  ));
}
function attributeArray(a, size) {
  if (!a) return null;
  if (!a.isInterleavedBufferAttribute && !a.normalized && a.itemSize === size) return a.array;
  const values = new Float32Array(a.count * size);
  for (let i = 0; i < a.count; i++) {
    values[i * size] = a.getX(i);
    if (size > 1) values[i * size + 1] = a.getY(i);
    if (size > 2) values[i * size + 2] = a.getZ(i);
  }
  return values;
}
function wrapping(v, mode) {
  if (mode === THREE.RepeatWrapping) return v - Math.floor(v);
  if (mode === THREE.MirroredRepeatWrapping) {
    const cell = Math.floor(v), part = v - cell;
    return (cell & 1) ? 1 - part : part;
  }
  return clamp(v, 0, 1);
}

/* Vertices are [viewX,viewY,viewZ,u,v,screenX,screenY,illumination]. */
function mixVertex(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
    a[4] + (b[4] - a[4]) * t, 0, 0,
    (a[7]??1) + ((b[7]??1) - (a[7]??1)) * t
  ];
}
function clipPolygon(vertices, plane) {
  if (!vertices.length) return vertices;
  const n = plane.normal, constant = plane.constant;
  let previous = vertices[vertices.length - 1];
  let previousD = n.x * previous[0] + n.y * previous[1] + n.z * previous[2] + constant;
  let allInside = previousD >= -1e-7;
  for (const v of vertices) {
    if (n.x * v[0] + n.y * v[1] + n.z * v[2] + constant < -1e-7) { allInside = false; break; }
  }
  if (allInside) return vertices;
  const output = [];
  for (const current of vertices) {
    const currentD = n.x * current[0] + n.y * current[1] + n.z * current[2] + constant;
    const currentInside = currentD >= -1e-7, previousInside = previousD >= -1e-7;
    if (currentInside !== previousInside) {
      const denominator = previousD - currentD;
      if (Math.abs(denominator) > 1e-15) output.push(mixVertex(previous, current, clamp(previousD / denominator, 0, 1)));
    }
    if (currentInside) output.push(current);
    previous = current; previousD = currentD;
  }
  return output;
}

export class CanvasFallbackRenderer {
  constructor({
    alpha = false,
    canvas,
    maxRenderTriangles = 240000,
    maxTextureTriangles = 2200,
    minTriangleArea = .5,
    textureMinArea = 32,
    maxRasterPixels = 1600000,
    maxTextureSize = 4096
  } = {}) {
    this.domElement = canvas || document.createElement('canvas');
    this.context = this.domElement.getContext('2d', { alpha, desynchronized: true });
    if (!this.context) throw new Error('当前浏览器也无法创建 Canvas 2D，请换用支持图形绘制的浏览器。');
    this.isFallback = true;
    this.isCanvasFallbackRenderer = true;
    this.outputColorSpace = THREE.SRGBColorSpace;
    this.toneMapping = THREE.NoToneMapping;
    this.toneMappingExposure = 1;
    this.autoClear = true;
    this.shadowMap = { enabled: false, autoUpdate: false, needsUpdate: false, type: THREE.BasicShadowMap };
    this.info = {
      render: { frame: 0, calls: 0, triangles: 0, lines: 0, points: 0, texturedTriangles: 0, durationMs: 0 },
      memory: { geometries: 0, textures: 0 },
      autoReset: true
    };
    this.maxRenderTriangles = maxRenderTriangles;
    this.maxTextureTriangles = maxTextureTriangles;
    this.minTriangleArea = minTriangleArea;
    this.textureMinArea = textureMinArea;
    this.maxRasterPixels = Math.max(65536, maxRasterPixels);
    this.maxTextureSize = Math.max(256, maxTextureSize);
    this._ratio = 1;
    this._width = 1; this._height = 1;
    this._alpha = alpha;
    this._clearColor = new THREE.Color(0x000000);
    this._clearAlpha = alpha ? 0 : 1;
    this._geometryCache = new WeakMap();
    this._textureCache = new WeakMap();
    this._materialCache = new Map();
    this._colorCache = new Map();
    this._faces = [];
    this._facePool = [];
    this._poolUsed = 0;
    this._stamp = 0;
    this._frustum = new THREE.Frustum();
    this._instance = new THREE.Matrix4();
    this._batchSphere = new Float64Array(4);
    this._baseView = new THREE.Matrix4();
    this._modelView = new THREE.Matrix4();
    this._normalMatrix = new THREE.Matrix3();
    this._lightPosition = new THREE.Vector3();
    this._lightTarget = new THREE.Vector3();
    this._instanceTint = [1, 1, 1];
    this._disposed = false;
    this._frame = null;
    this._depthBuffer = null;
    this.setSize(1, 1);
  }

  setPixelRatio(ratio) {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    this._ratio = clamp(ratio, .25, 3);
    this.setSize(this._width, this._height, false);
  }
  getPixelRatio() { return this._ratio; }
  setSize(width, height, updateStyle = true) {
    this._width = Math.max(1, Number(width) || 1);
    this._height = Math.max(1, Number(height) || 1);
    // Bound pixel work independently of the triangle budget on high-DPI/4K
    // displays. The canvas retains the requested CSS dimensions and aspect.
    const scale = Math.min(this._ratio, Math.sqrt(this.maxRasterPixels / (this._width * this._height)));
    const w = Math.max(1, Math.round(this._width * scale));
    const h = Math.max(1, Math.round(this._height * scale));
    if (this.domElement.width !== w) this.domElement.width = w;
    if (this.domElement.height !== h) this.domElement.height = h;
    if (updateStyle && this.domElement.style) {
      this.domElement.style.width = this._width + 'px';
      this.domElement.style.height = this._height + 'px';
    }
  }
  getSize(target = new THREE.Vector2()) { return target.set(this._width, this._height); }
  getDrawingBufferSize(target = new THREE.Vector2()) { return target.set(this.domElement.width, this.domElement.height); }
  getContext() { return this.context; }
  setClearColor(color, alpha = this._clearAlpha) {
    this._clearColor.set(color);
    this._clearAlpha = clamp(Number(alpha), 0, 1);
    return this;
  }
  getClearColor(target = new THREE.Color()) { return target.copy(this._clearColor); }
  setClearAlpha(alpha) { this._clearAlpha = clamp(Number(alpha), 0, 1); }
  getClearAlpha() { return this._clearAlpha; }

  _css(value) {
    let css = this._colorCache.get(value);
    if (!css) {
      css = 'rgb(' + ((value >>> 16) & 255) + ',' + ((value >>> 8) & 255) + ',' + (value & 255) + ')';
      if (this._colorCache.size < 32768) this._colorCache.set(value, css);
    }
    return css;
  }

  _geometry(geometry) {
    const position = geometry?.attributes?.position;
    if (!position || position.count < 3) return null;
    const index = geometry.index, uv = geometry.attributes.uv, normal = geometry.attributes.normal;
    const pv = position.version ?? position.data?.version ?? 0;
    const iv = index?.version || 0, uvv = uv?.version ?? uv?.data?.version ?? 0;
    let data = this._geometryCache.get(geometry);
    if (data && data.position === position && data.positionVersion === pv && data.index === index
      && data.indexVersion === iv && data.uv === uv && data.uvVersion === uvv && data.normal === normal && data.normalVersion === (normal?.version??0) && data.count === position.count) return data;
    const positions = attributeArray(position, 3);
    const indices = index ? attributeArray(index, 1) : null;
    const total = Math.floor((index ? index.count : position.count) / 3) * 3;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    data = {
      position, positionVersion: pv, index, indexVersion: iv, uv, uvVersion: uvv,
      count: position.count, positions, indices, uvs: attributeArray(uv, 2),
      colors: geometry.attributes.color || null, normal, normalVersion:normal?.version??0, normals:attributeArray(normal,3), total,
      vertices: new Float32Array(position.count * 5),
      stamps: new Uint32Array(position.count),
      sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius],
      chunks: []
    };
    // Large merged book meshes are culled in consecutive, spatially coherent
    // blocks. 216 triangles also keeps whole 18-triangle book casings together.
    if (total > 3072) {
      const stride = 216 * 3;
      for (let first = 0; first < total; first += stride) {
        const end = Math.min(first + stride, total);
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = first; i < end; i++) {
          const vi = (indices ? indices[i] : i) * 3;
          const x = positions[vi], y = positions[vi + 1], z = positions[vi + 2];
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        }
        data.chunks.push({
          first, end,
          sphere: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2,
            Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2]
        });
      }
    } else data.chunks.push({ first: 0, end: total, sphere: data.sphere });
    if (!this._geometryCache.has(geometry)) this.info.memory.geometries++;
    this._geometryCache.set(geometry, data);
    return data;
  }

  _texture(texture) {
    if (!texture) return null;
    const image = texture.image || texture.source?.data;
    const width = image?.naturalWidth || image?.videoWidth || image?.width;
    const height = image?.naturalHeight || image?.videoHeight || image?.height;
    if (!image || !width || !height) return null;
    let data = this._textureCache.get(texture);
    if (!data || data.version !== texture.version || data.image !== image || data.width !== width || data.height !== height) {
      const first = !data;
      data = {
        image, width, height, version: texture.version,
        sample: null, sampleW: 0, sampleH: 0, levels: [], detail: /ArchitecturalDetail/i.test(texture.name || '')
      };
      try {
        // Keep full-size book atlas cells: a 256px sample of a 2048px atlas
        // destroys both cover lettering and the thin spine. Other textures
        // keep architectural detail at up to4096px; ordinary surfaces retain
        // a1024px cap and mipmapping for distant floors.
        const atlas = /atlas/i.test(texture.name || '');
        const limit = Math.min(this.maxTextureSize, data.detail ? 4096 : atlas ? 2048 : 1024);
        if (image.data && texture.type === THREE.UnsignedByteType && texture.format === THREE.RGBAFormat) {
          data.sampleW = width; data.sampleH = height; data.sample = image.data;
          data.levels.push({ width, height, pixels: image.data });
        } else {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, limit / Math.max(width, height));
          canvas.width = data.sampleW = Math.max(1, Math.round(width * scale));
          canvas.height = data.sampleH = Math.max(1, Math.round(height * scale));
          const c = canvas.getContext('2d', { willReadFrequently: true });
          c.drawImage(image, 0, 0, canvas.width, canvas.height);
          data.sample = c.getImageData(0, 0, canvas.width, canvas.height).data;
          data.levels.push({ width: canvas.width, height: canvas.height, pixels: data.sample });
          let previous = canvas;
          while (previous.width > 16 || previous.height > 16) {
            const mip = document.createElement('canvas');
            mip.width = Math.max(1, previous.width >> 1); mip.height = Math.max(1, previous.height >> 1);
            const mc = mip.getContext('2d', { willReadFrequently: true });
            mc.drawImage(previous, 0, 0, mip.width, mip.height);
            data.levels.push({ width: mip.width, height: mip.height, pixels: mc.getImageData(0, 0, mip.width, mip.height).data });
            previous = mip;
          }
        }
      } catch {
        // CORS-protected pixels cannot be read by a software renderer. Keep
        // the actual material color and never fetch an alternate image.
        data.sample = null;
      }
      if (first) this.info.memory.textures++;
      this._textureCache.set(texture, data);
    }
    if (texture.matrixAutoUpdate) texture.updateMatrix();
    const m = texture.matrix.elements;
    data.m0 = m[0]; data.m1 = m[1]; data.m3 = m[3]; data.m4 = m[4]; data.m6 = m[6]; data.m7 = m[7];
    data.flipY = texture.flipY !== false;
    data.wrapS = texture.wrapS; data.wrapT = texture.wrapT;
    data.repeat = texture.wrapS !== THREE.ClampToEdgeWrapping || texture.wrapT !== THREE.ClampToEdgeWrapping;
    return data;
  }

  _material(material) {
    if (!material || material.visible === false || material.opacity <= 0) return null;
    let m = this._materialCache.get(material);
    if (m) return m;
    const c = material.color || { r: 1, g: 1, b: 1 };
    const emissive = material.emissive || { r: 0, g: 0, b: 0 };
    const intensity = material.emissiveIntensity ?? 1;
    m = {
      r: c.r, g: c.g, b: c.b,
      er: emissive.r * intensity, eg: emissive.g * intensity, eb: emissive.b * intensity,
      side: material.side ?? THREE.FrontSide, opacity: clamp(material.opacity ?? 1, 0, 1),
      basic: !!material.isMeshBasicMaterial, wireframe: !!material.wireframe, fog: material.fog !== false,
      flatShading: !!material.flatShading, metalness:material.metalness||0, roughness:material.roughness??.8,
      vertexColors: !!material.vertexColors, texture: this._texture(material.map),
      transparent: !!material.transparent, alphaTest: material.alphaTest || 0,
      depthTest: material.depthTest !== false, depthWrite: material.depthWrite !== false,
      polygonOffset: material.polygonOffset ? (material.polygonOffsetUnits || 0) : 0
    };
    this._materialCache.set(material, m);
    return m;
  }

  _lights(scene, camera) {
    const view = camera.matrixWorldInverse.elements;
    let ambient = .34;
    const lights = [];
    scene.traverseVisible(object => {
      if (object.isAmbientLight) ambient += Math.min(3, object.intensity) * .055;
      if (object.isHemisphereLight) ambient += Math.sqrt(Math.max(0, object.intensity)) * .085;
      if (object.isDirectionalLight && object.intensity > 0) {
        object.getWorldPosition(this._lightPosition);
        object.target?.getWorldPosition(this._lightTarget);
        this._lightPosition.sub(this._lightTarget).normalize().transformDirection(camera.matrixWorldInverse);
        lights.push({
          x: this._lightPosition.x, y: this._lightPosition.y, z: this._lightPosition.z,
          intensity: object.intensity, r: object.color.r, g: object.color.g, b: object.color.b
        });
      }
    });
    if (!lights.length) {
      const x = .35, y = .8, z = .48;
      lights.push({
        x: view[0] * x + view[4] * y + view[8] * z,
        y: view[1] * x + view[5] * y + view[9] * z,
        z: view[2] * x + view[6] * y + view[10] * z,
        intensity: 1.4, r: 1, g: .95, b: .86
      });
    }
    const sum = lights.reduce((s, l) => s + l.intensity, 0);
    for (const l of lights) {
      l.weight = .8 * l.intensity / (sum + 1);
      const inverse=1/Math.max(1e-8,Math.hypot(l.x,l.y,l.z+1));
      l.hx=l.x*inverse;l.hy=l.y*inverse;l.hz=(l.z+1)*inverse;
    }
    this._lightsList = lights;
    this._ambient = clamp(ambient, .32, .8);
  }

  _visibleSphere(sphere, matrix, scale) {
    const x = sphere[0], y = sphere[1], z = sphere[2];
    const cx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const cy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const cz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    const radius = sphere[3] * scale;
    for (const plane of this._frustum.planes) {
      if (plane.normal.x * cx + plane.normal.y * cy + plane.normal.z * cz + plane.constant < -radius) return false;
    }
    const denominator = this._perspective ? Math.max(this._near, -cz - radius) : 1;
    const rw = Math.abs(this._projection[0] * radius / denominator) * this._halfW;
    const rh = Math.abs(this._projection[5] * radius / denominator) * this._halfH;
    return rw * rh * 4 >= this.minTriangleArea;
  }

  _vertex(data, index, stamp, matrix) {
    if (data.stamps[index] === stamp) return;
    const source = index * 3, dest = index * 5, p = data.positions, v = data.vertices;
    const x = p[source], y = p[source + 1], z = p[source + 2];
    const vx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const vy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const vz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    const m = this._projection;
    const w = m[3] * vx + m[7] * vy + m[11] * vz + m[15];
    const invW = Math.abs(w) > 1e-12 ? 1 / w : 0;
    v[dest] = vx; v[dest + 1] = vy; v[dest + 2] = vz;
    v[dest + 3] = (1 + (m[0] * vx + m[4] * vy + m[8] * vz + m[12]) * invW) * this._halfW;
    v[dest + 4] = (1 - (m[1] * vx + m[5] * vy + m[9] * vz + m[13]) * invW) * this._halfH;
    data.stamps[index] = stamp;
  }

  _project(v) {
    const m = this._projection, x = v[0], y = v[1], z = v[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return false;
    const invW = 1 / w;
    v[5] = (1 + (m[0] * x + m[4] * y + m[8] * z + m[12]) * invW) * this._halfW;
    v[6] = (1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) * invW) * this._halfH;
    return Number.isFinite(v[5]) && Number.isFinite(v[6]);
  }

  _lighting(nx, ny, nz, m) {
    let r = m.basic ? 1 : this._ambient, g = r, b = r;
    if (!m.basic) for (const light of this._lightsList) {
      const strength = Math.max(0, nx * light.x + ny * light.y + nz * light.z) * light.weight;
      r += strength * light.r; g += strength * light.g; b += strength * light.b;
      if(m.metalness>.1&&strength>0){
        const shine=Math.pow(Math.max(0,nx*light.hx+ny*light.hy+nz*light.hz),8+(1-m.roughness)*48)*light.weight*m.metalness*.65;
        r+=shine*light.r;g+=shine*light.g;b+=shine*light.b;
      }
    }
    const exposure = Number.isFinite(this.toneMappingExposure) ? Math.max(.1, this.toneMappingExposure) : 1;
    this._shadeR = r * exposure; this._shadeG = g * exposure; this._shadeB = b * exposure;
  }

  _triangle(data, ia, ib, ic, stamp, matrix, material) {
    this._vertex(data, ia, stamp, matrix);
    this._vertex(data, ib, stamp, matrix);
    this._vertex(data, ic, stamp, matrix);
    const v = data.vertices, a = ia * 5, b = ib * 5, c = ic * 5;
    const ax = v[a], ay = v[a + 1], az = v[a + 2];
    const bx = v[b], by = v[b + 1], bz = v[b + 2];
    const cx = v[c], cy = v[c + 1], cz = v[c + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const lengthSquared = nx * nx + ny * ny + nz * nz;
    if (lengthSquared < 1e-20) return;
    const facing = this._perspective ? -(nx * ax + ny * ay + nz * az) : nz;
    const front = facing * this._orientation >= 0;
    const side = material.side;
    if ((side === THREE.FrontSide && !front) || (side === THREE.BackSide && front)) return;
    if (-az < this._near && -bz < this._near && -cz < this._near) return;
    if (-az > this._far && -bz > this._far && -cz > this._far) return;
    const inverse = this._orientation * (front ? 1 : -1) / Math.sqrt(lengthSquared);
    nx *= inverse; ny *= inverse; nz *= inverse;
    const sx0 = v[a + 3], sy0 = v[a + 4], sx1 = v[b + 3], sy1 = v[b + 4], sx2 = v[c + 3], sy2 = v[c + 4];
    const fullyInDepth = -az >= this._near && -bz >= this._near && -cz >= this._near
      && -az <= this._far && -bz <= this._far && -cz <= this._far;
    if (fullyInDepth && (
      (sx0 < 0 && sx1 < 0 && sx2 < 0) || (sx0 > this._width && sx1 > this._width && sx2 > this._width)
      || (sy0 < 0 && sy1 < 0 && sy2 < 0) || (sy0 > this._height && sy1 > this._height && sy2 > this._height)
    )) return;
    const fullyOnScreen = fullyInDepth && sx0 >= 0 && sx0 <= this._width && sx1 >= 0 && sx1 <= this._width
      && sx2 >= 0 && sx2 <= this._width && sy0 >= 0 && sy0 <= this._height && sy1 >= 0
      && sy1 <= this._height && sy2 >= 0 && sy2 <= this._height;
    const area = Math.abs((sx1 - sx0) * (sy2 - sy0) - (sy1 - sy0) * (sx2 - sx0)) * .5;
    if (fullyOnScreen && area < this.minTriangleArea && !this._preserveSurface) return;
    const uvs = data.uvs, hasUV = !!uvs && !!material.texture;
    const u0 = hasUV ? uvs[ia * 2] : 0, t0 = hasUV ? uvs[ia * 2 + 1] : 0;
    const u1 = hasUV ? uvs[ib * 2] : 0, t1 = hasUV ? uvs[ib * 2 + 1] : 0;
    const u2 = hasUV ? uvs[ic * 2] : 0, t2 = hasUV ? uvs[ic * 2 + 1] : 0;
    this._currentMaterial = material;
    this._currentHasUV = hasUV;
    this._vertexTintR = this._vertexTintG = this._vertexTintB = 1;
    if (material.vertexColors && data.colors) {
      const colors = data.colors;
      this._vertexTintR = (colors.getX(ia) + colors.getX(ib) + colors.getX(ic)) / 3;
      this._vertexTintG = (colors.getY(ia) + colors.getY(ib) + colors.getY(ic)) / 3;
      this._vertexTintB = (colors.getZ(ia) + colors.getZ(ib) + colors.getZ(ic)) / 3;
    }
    this._lighting(nx, ny, nz, material);
    // Interpolate vertex illumination only where the authored normals vary.
    // Box faces and cloth stay flat, while lathed bronzes, feathers, carved
    // curves and non-uniformly scaled organic forms retain smooth curvature.
    let l0=1,l1=1,l2=1;
    const normals=data.normals,na=ia*3,nb=ib*3,nc=ic*3;
    this._currentSmooth=false;
    if(normals&&!material.basic&&!material.flatShading&&(
      Math.abs(normals[na]-normals[nb])+Math.abs(normals[na+1]-normals[nb+1])+Math.abs(normals[na+2]-normals[nb+2])+
      Math.abs(normals[na]-normals[nc])+Math.abs(normals[na+1]-normals[nc+1])+Math.abs(normals[na+2]-normals[nc+2])>.0001)){
      const sr=this._shadeR,sg=this._shadeG,sb=this._shadeB,base=Math.max(.001,(sr+sg+sb)/3),nm=this._normalMatrix.elements,sign=front?1:-1;
      const lightAt=offset=>{
        const x=normals[offset],y=normals[offset+1],z=normals[offset+2];
        const xx=nm[0]*x+nm[3]*y+nm[6]*z,yy=nm[1]*x+nm[4]*y+nm[7]*z,zz=nm[2]*x+nm[5]*y+nm[8]*z;
        const inv=sign/Math.max(1e-8,Math.hypot(xx,yy,zz));this._lighting(xx*inv,yy*inv,zz*inv,material);
        return(this._shadeR+this._shadeG+this._shadeB)/(3*base);
      };
      l0=lightAt(na);l1=lightAt(nb);l2=lightAt(nc);
      this._shadeR=sr;this._shadeG=sg;this._shadeB=sb;this._currentSmooth=true;
    }
    if (fullyOnScreen) {
      this._offer(sx0, sy0, sx1, sy1, sx2, sy2, -az, -bz, -cz, u0, t0, u1, t1, u2, t2, area,l0,l1,l2);
      return;
    }
    let polygon = [
      [ax, ay, az, u0, t0, sx0, sy0,l0], [bx, by, bz, u1, t1, sx1, sy1,l1], [cx, cy, cz, u2, t2, sx2, sy2,l2]
    ];
    if (!fullyOnScreen) {
      for (const plane of this._frustum.planes) {
        polygon = clipPolygon(polygon, plane);
        if (polygon.length < 3) return;
      }
      for (const point of polygon) if (!this._project(point)) return;
    }
    for (let i = 1; i + 1 < polygon.length; i++) this._projectedTriangle(polygon[0], polygon[i], polygon[i + 1]);
  }

  _projectedTriangle(a, b, c) {
    const area = Math.abs((b[5] - a[5]) * (c[6] - a[6]) - (b[6] - a[6]) * (c[5] - a[5])) * .5;
    if (!Number.isFinite(area) || (area < this.minTriangleArea && !this._preserveSurface)) return;
    this._offer(a[5], a[6], b[5], b[6], c[5], c[6], -a[2], -b[2], -c[2],
      a[3], a[4], b[3], b[4], c[3], c[4], area,a[7],b[7],c[7]);
  }

  _offer(x0, y0, x1, y1, x2, y2, z0, z1, z2, u0, v0, u1, v1, u2, v2, area,l0=1,l1=1,l2=1) {
    if (!Number.isFinite(area) || area <= 1e-10 || (area < this.minTriangleArea && !this._preserveSurface)) return;
    const heap = this._faces, limit = this._budget;
    // A closed roof must keep its occluding faces when tiny book/detail faces
    // compete for the same bounded budget. Dropping a roof triangle exposes
    // valid timber below it and falsely looks like geometric penetration.
    // Dense continuous bronze castings must also keep subpixel triangles:
    // dropping isolated facets opens pinholes in an otherwise closed skin.
    // Only closed roofs and continuous cast skins need absolute protection.
    // Ordinary structural members get a modest area preference: giving every
    // distant internal beam a whole-screen bonus used to evict visible window
    // bars and paving when the court and trees increased the scene detail.
    // All surfaces remain subject to the same bounded triangle budget.
    const rank = area * (this._latticeSurface ? 24 : this._structuralSolid ? 4 : 1)
      + this._width * this._height * (this._closedRoof ? 2 : this._preserveSurface ? 1.5 : this._referenceArtwork ? 1 : 0);
    this._candidates++;
    if (heap.length >= limit && rank <= heap[0].rank) return;
    let face, replacing = false;
    if (heap.length < limit) {
      face = this._facePool[this._poolUsed];
      if (!face) this._facePool[this._poolUsed] = face = {};
      this._poolUsed++;
    } else { face = heap[0]; replacing = true; }
    const material = this._currentMaterial, texture = this._currentHasUV ? material.texture : null;
    face.x0 = x0; face.y0 = y0; face.x1 = x1; face.y1 = y1; face.x2 = x2; face.y2 = y2;
    face.z0 = z0; face.z1 = z1; face.z2 = z2;
    face.smooth=this._currentSmooth;face.l0=l0;face.l1=l1;face.l2=l2;
    face.depth = (z0 + z1 + z2) / 3; face.score = area; face.rank = rank; face.order = this._order;
    // Preserve continuous roof stripes with the existing mip sampler; a single
    // UV-centroid color per tile triangle creates a visible checkerboard.
    face.texture = texture; face.textured = (this._closedRoof || (texture?.detail && area >= 4)) && !!texture?.sample;
    face.opacity = material.opacity; face.wireframe = material.wireframe;
    face.transparent = material.transparent; face.alphaTest = material.alphaTest;
    face.depthTest = material.depthTest; face.depthWrite = material.depthWrite; face.polygonOffset = material.polygonOffset;
    let tr = 1, tg = 1, tb = 1;
    if (texture) {
      let s0 = texture.m0 * u0 + texture.m3 * v0 + texture.m6, t0 = texture.m1 * u0 + texture.m4 * v0 + texture.m7;
      let s1 = texture.m0 * u1 + texture.m3 * v1 + texture.m6, t1 = texture.m1 * u1 + texture.m4 * v1 + texture.m7;
      let s2 = texture.m0 * u2 + texture.m3 * v2 + texture.m6, t2 = texture.m1 * u2 + texture.m4 * v2 + texture.m7;
      if (texture.flipY) { t0 = 1 - t0; t1 = 1 - t1; t2 = 1 - t2; }
      face.u0 = s0; face.v0 = t0;
      face.u1 = s1; face.v1 = t1;
      face.u2 = s2; face.v2 = t2;
      if (texture.sample) {
        const sampleU = wrapping((s0 + s1 + s2) / 3, texture.wrapS);
        const sampleV = wrapping((t0 + t1 + t2) / 3, texture.wrapT);
        const px = clamp(Math.floor(sampleU * texture.sampleW), 0, texture.sampleW - 1);
        const py = clamp(Math.floor(sampleV * texture.sampleH), 0, texture.sampleH - 1);
        const offset = (py * texture.sampleW + px) * 4;
        tr = LINEAR[texture.sample[offset]]; tg = LINEAR[texture.sample[offset + 1]]; tb = LINEAR[texture.sample[offset + 2]];
      }
    }
    const mr = material.r * this._instanceTint[0] * this._vertexTintR * this._shadeR;
    const mg = material.g * this._instanceTint[1] * this._vertexTintG * this._shadeG;
    const mb = material.b * this._instanceTint[2] * this._vertexTintB * this._shadeB;
    let r = mr * tr + material.er, g = mg * tg + material.eg, b = mb * tb + material.eb;
    let fog = 0;
    if (this._fog && material.fog) {
      const distance = face.depth;
      fog = this._fog.isFogExp2
        ? 1 - Math.exp(-this._fog.density * this._fog.density * distance * distance)
        : clamp((distance - this._fog.near) / Math.max(.001, this._fog.far - this._fog.near), 0, 1);
      r += (this._fog.color.r - r) * fog;
      g += (this._fog.color.g - g) * fog;
      b += (this._fog.color.b - b) * fog;
    }
    face.color = pack(srgb(r), srgb(g), srgb(b));
    face.linearR=r;face.linearG=g;face.linearB=b;
    face.pixel = pixel((face.color >>> 16) & 255, (face.color >>> 8) & 255, face.color & 255);
    face.fr = mr * (1 - fog); face.fg = mg * (1 - fog); face.fb = mb * (1 - fog);
    face.br = material.er * (1 - fog) + (this._fog ? this._fog.color.r * fog : 0);
    face.bg = material.eg * (1 - fog) + (this._fog ? this._fog.color.g * fog : 0);
    face.bb = material.eb * (1 - fog) + (this._fog ? this._fog.color.b * fog : 0);
    if (replacing) {
      let i = 0;
      while (true) {
        let child = i * 2 + 1;
        if (child >= heap.length) break;
        if (child + 1 < heap.length && heap[child + 1].rank < heap[child].rank) child++;
        if (heap[child].rank >= face.rank) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = face;
    } else {
      let i = heap.length; heap.push(face);
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent].rank <= face.rank) break;
        heap[i] = heap[parent]; i = parent;
      }
      heap[i] = face;
    }
  }

  _meshGeometry(mesh, data, modelView, scale) {
    const geometry = mesh.geometry, matrix = modelView.elements;
    this._closedRoof = mesh.userData?.type === 'closed-roof-shell' || geometry.userData?.type === 'closed-roof-shell';
    this._preserveSurface = this._closedRoof || !!mesh.userData?.preserveSurfaceInFallback;
    this._structuralSolid = !!mesh.userData?.keepSolidInFallback;
    // These are the actual front/back and thickness faces of pierced windows,
    // not opaque overlays. Side faces form the visible bars at oblique angles.
    // Keep them ahead of distant detail, with the ordinary subpixel threshold.
    this._latticeSurface = geometry.userData?.retainDoorFrontFace === true
      || geometry.userData?.doorDetail === 'lattice'
      || mesh.userData?.doorDetail === 'pierced-lattice';
    // Projectively sampled originals contain many small coplanar triangles;
    // keep the lettering / image faces ahead of their plain wooden backing.
    this._referenceArtwork = mesh.userData?.originalBrushwork === true
      || mesh.userData?.frontalProjectiveMapping === true
      || mesh.userData?.originalUserPhotograph === true;
    if (!this._visibleSphere(data.sphere, matrix, scale)) { this._rejectedInstances++; return; }
    this._normalMatrix.getNormalMatrix(modelView);
    this._acceptedInstances++;
    this._orientation = det3(matrix) < 0 ? -1 : 1;
    this._order = mesh.renderOrder || 0;
    const stamp = ++this._stamp;
    const range = geometry.drawRange;
    const rangeStart = Math.max(0, Math.ceil((range?.start || 0) / 3) * 3);
    const rangeEnd = Math.min(data.total, Number.isFinite(range?.count) ? rangeStart + Math.floor(range.count / 3) * 3 : data.total);
    const materials = mesh.material;
    const groups = Array.isArray(materials)
      ? geometry.groups.map(group => ({
        first: group.start, end: group.start + group.count, material: this._material(materials[group.materialIndex || 0])
      }))
      : [{ first: 0, end: data.total, material: this._material(materials) }];
    for (const chunk of data.chunks) {
      if (data.chunks.length > 1 && !this._visibleSphere(chunk.sphere, matrix, scale)) { this._rejectedChunks++; continue; }
      for (const group of groups) {
        if (!group.material) continue;
        const first = Math.max(rangeStart, chunk.first, group.first);
        const end = Math.min(rangeEnd, chunk.end, group.end);
        this._inputTriangles += Math.max(0, Math.floor((end - first) / 3));
        for (let i = first; i + 2 < end; i += 3) {
          this._triangle(data, data.indices ? data.indices[i] : i,
            data.indices ? data.indices[i + 1] : i + 1,
            data.indices ? data.indices[i + 2] : i + 2, stamp, matrix, group.material);
        }
      }
    }
  }

  _rasterize(face) {
    const width = this.domElement.width, height = this.domElement.height;
    const scaleX = width / this._width, scaleY = height / this._height;
    let x0 = face.x0 * scaleX, y0 = face.y0 * scaleY;
    let x1 = face.x1 * scaleX, y1 = face.y1 * scaleY;
    let x2 = face.x2 * scaleX, y2 = face.y2 * scaleY;
    let z0 = face.z0, z1 = face.z1, z2 = face.z2;
    let u0 = face.u0 || 0, v0 = face.v0 || 0;
    let u1 = face.u1 || 0, v1 = face.v1 || 0;
    let u2 = face.u2 || 0, v2 = face.v2 || 0;
    let l0=face.l0??1,l1=face.l1??1,l2=face.l2??1;
    let area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (!Number.isFinite(area) || Math.abs(area) < 1e-10) return false;
    if (area < 0) {
      [x1, x2] = [x2, x1]; [y1, y2] = [y2, y1];
      [z1, z2] = [z2, z1]; [u1, u2] = [u2, u1]; [v1, v2] = [v2, v1];
      [l1,l2]=[l2,l1];
      area = -area;
    }
    const minX = Math.max(0, Math.ceil(Math.min(x0, x1, x2) - .5));
    const maxX = Math.min(width - 1, Math.floor(Math.max(x0, x1, x2) - .5));
    const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2) - .5));
    const maxY = Math.min(height - 1, Math.floor(Math.max(y0, y1, y2) - .5));
    if (maxX < minX || maxY < minY) return false;
    const inverseArea = 1 / area, perspective = this._perspective;
    const e0x = y1 - y2, e0y = x2 - x1;
    const e1x = y2 - y0, e1y = x0 - x2;
    const e2x = y0 - y1, e2y = x1 - x0;
    // Top-left ownership avoids cracks and double alpha blending on a shared
    // diagonal. It does not expand triangles across an adjacent object edge.
    const t0 = y2 < y1 || (y2 === y1 && x2 > x1) ? -1e-8 : 1e-8;
    const t1 = y0 < y2 || (y0 === y2 && x0 > x2) ? -1e-8 : 1e-8;
    const t2 = y1 < y0 || (y1 === y0 && x1 > x0) ? -1e-8 : 1e-8;
    const px = minX + .5, py = minY + .5;
    let er0 = e0x * px + e0y * py + x1 * y2 - x2 * y1;
    let er1 = e1x * px + e1y * py + x2 * y0 - x0 * y2;
    let er2 = e2x * px + e2y * py + x0 * y1 - x1 * y0;
    const q0 = perspective ? 1 / z0 : 1, q1 = perspective ? 1 / z1 : 1, q2 = perspective ? 1 / z2 : 1;
    const d0 = perspective ? q0 : -z0, d1 = perspective ? q1 : -z1, d2 = perspective ? q2 : -z2;
    const ddx = (e0x * d0 + e1x * d1 + e2x * d2) * inverseArea;
    const ddy = (e0y * d0 + e1y * d1 + e2y * d2) * inverseArea;
    let dr = (er0 * d0 + er1 * d1 + er2 * d2) * inverseArea;
    const smooth=face.smooth;
    l0*=q0;l1*=q1;l2*=q2;
    const ldx=smooth?(e0x*l0+e1x*l1+e2x*l2)*inverseArea:0,ldy=smooth?(e0y*l0+e1y*l1+e2y*l2)*inverseArea:0;
    let lr=smooth?(er0*l0+er1*l1+er2*l2)*inverseArea:1;
    // Reciprocal view depth is affine in screen space for perspective cameras;
    // negative view depth is affine for orthographic cameras. Larger is nearer.
    const bias = face.polygonOffset * 1e-7;
    const depth = this._depthBuffer, rgba = this._frame.data, colors = this._colorBuffer;
    const texture = face.textured && face.texture?.sample ? face.texture : null;
    let texels, tw = 0, th = 0, bilinear = false;
    let udx = 0, udy = 0, vdx = 0, vdy = 0, ur = 0, vr = 0;
    if (texture) {
      const texelArea = Math.abs((u1 - u0) * (v2 - v0) - (v1 - v0) * (u2 - u0)) * texture.sampleW * texture.sampleH;
      const footprint = Math.sqrt(texelArea / Math.max(1, area));
      const level = clamp(Math.floor(Math.log2(Math.max(1, footprint)) - (texture.detail ? .4 : 0)), 0, texture.levels.length - 1);
      const mip = texture.levels[level]; texels = mip.pixels; tw = mip.width; th = mip.height;
      bilinear = level === 0 && footprint < 1 && face.score > 256;
      u0 *= q0; u1 *= q1; u2 *= q2; v0 *= q0; v1 *= q1; v2 *= q2;
      udx = (e0x * u0 + e1x * u1 + e2x * u2) * inverseArea;
      udy = (e0y * u0 + e1y * u1 + e2y * u2) * inverseArea;
      vdx = (e0x * v0 + e1x * v1 + e2x * v2) * inverseArea;
      vdy = (e0y * v0 + e1y * v1 + e2y * v2) * inverseArea;
      ur = (er0 * u0 + er1 * u1 + er2 * u2) * inverseArea;
      vr = (er0 * v0 + er1 * v1 + er2 * v2) * inverseArea;
    }
    const edge0 = face.wireframe ? Math.hypot(e0x, e0y) * .65 : 0;
    const edge1 = face.wireframe ? Math.hypot(e1x, e1y) * .65 : 0;
    const edge2 = face.wireframe ? Math.hypot(e2x, e2y) * .65 : 0;
    const solidR = (face.color >>> 16) & 255, solidG = (face.color >>> 8) & 255, solidB = face.color & 255;
    for (let y = minY; y <= maxY; y++) {
      let e0 = er0, e1 = er1, e2 = er2, d = dr, u = ur, v = vr,l=lr;
      let offset = y * width + minX;
      for (let x = minX; x <= maxX; x++, offset++, e0 += e0x, e1 += e1x, e2 += e2x, d += ddx, u += udx, v += vdx,l+=ldx) {
        if (e0 < t0 || e1 < t1 || e2 < t2) continue;
        if (face.wireframe && e0 > edge0 && e1 > edge1 && e2 > edge2) continue;
        const value = d - bias;
        if (face.depthTest && value < depth[offset]) continue;
        let r = solidR, g = solidG, b = solidB, alpha = face.opacity;
        const illumination=smooth?l*(perspective?1/d:1):1;
        if (texture) {
          const invQ = perspective ? 1 / d : 1;
          const s = wrapping(u * invQ, texture.wrapS), t = wrapping(v * invQ, texture.wrapT);
          let tr, tg, tb, ta;
          if (bilinear) {
            const fx = s * (tw - 1), fy = t * (th - 1), tx = Math.floor(fx), ty = Math.floor(fy);
            const ax = fx - tx, ay = fy - ty, bx = 1 - ax, by = 1 - ay;
            const i00 = (ty * tw + tx) * 4;
            const i10 = (ty * tw + Math.min(tx + 1, tw - 1)) * 4;
            const i01 = (Math.min(ty + 1, th - 1) * tw + tx) * 4;
            const i11 = (Math.min(ty + 1, th - 1) * tw + Math.min(tx + 1, tw - 1)) * 4;
            const w00 = bx * by, w10 = ax * by, w01 = bx * ay, w11 = ax * ay;
            tr = LINEAR[texels[i00]] * w00 + LINEAR[texels[i10]] * w10 + LINEAR[texels[i01]] * w01 + LINEAR[texels[i11]] * w11;
            tg = LINEAR[texels[i00 + 1]] * w00 + LINEAR[texels[i10 + 1]] * w10 + LINEAR[texels[i01 + 1]] * w01 + LINEAR[texels[i11 + 1]] * w11;
            tb = LINEAR[texels[i00 + 2]] * w00 + LINEAR[texels[i10 + 2]] * w10 + LINEAR[texels[i01 + 2]] * w01 + LINEAR[texels[i11 + 2]] * w11;
            ta = (texels[i00 + 3] * w00 + texels[i10 + 3] * w10 + texels[i01 + 3] * w01 + texels[i11 + 3] * w11) / 255;
          } else {
            const tx = Math.min(tw - 1, (s * tw) | 0), ty = Math.min(th - 1, (t * th) | 0);
            const index = (ty * tw + tx) * 4;
            tr = LINEAR[texels[index]]; tg = LINEAR[texels[index + 1]]; tb = LINEAR[texels[index + 2]]; ta = texels[index + 3] / 255;
          }
          alpha *= ta;
          if (alpha < face.alphaTest || alpha <= .001) continue;
          r = byte(tr * face.fr*illumination + face.br); g = byte(tg * face.fg*illumination + face.bg); b = byte(tb * face.fb*illumination + face.bb);
        } else if (alpha < face.alphaTest) continue;
        else if(smooth){
          // Only reflected light follows the interpolated surface normal.
          // Emissive radiance and fog are independent of that normal, just as
          // they are in the textured branch above.
          r=byte((face.linearR-face.br)*illumination+face.br);
          g=byte((face.linearG-face.bg)*illumination+face.bg);
          b=byte((face.linearB-face.bb)*illumination+face.bb);
        }
        if (!face.transparent || alpha >= .999) {
          colors[offset] = texture||smooth ? pixel(r, g, b) : face.pixel;
        } else {
          const p = offset * 4, destinationAlpha = rgba[p + 3] / 255;
          const outAlpha = alpha + destinationAlpha * (1 - alpha);
          if (outAlpha <= 0) continue;
          const back = destinationAlpha * (1 - alpha), inverseAlpha = 1 / outAlpha;
          colors[offset] = pixel(
            Math.round((r * alpha + rgba[p] * back) * inverseAlpha),
            Math.round((g * alpha + rgba[p + 1] * back) * inverseAlpha),
            Math.round((b * alpha + rgba[p + 2] * back) * inverseAlpha), Math.round(outAlpha * 255));
        }
        if (face.depthWrite) depth[offset] = value;
      }
      er0 += e0y; er1 += e1y; er2 += e2y; dr += ddy; ur += udy; vr += vdy;lr+=ldy;
    }
    return !!texture;
  }

  render(scene, camera) {
    if (this._disposed || !scene || !camera) return;
    const started = clock(), ctx = this.context;
    scene.updateMatrixWorld();
    camera.updateMatrixWorld(true);
    this._projection = camera.projectionMatrix.elements;
    this._perspective = !!camera.isPerspectiveCamera;
    this._near = Math.max(1e-5, camera.near || .01);
    this._far = Number.isFinite(camera.far) ? camera.far : 1000000;
    this._halfW = this._width / 2; this._halfH = this._height / 2;
    this._frustum.setFromProjectionMatrix(camera.projectionMatrix);
    this._fog = scene.fog || null;
    this._lights(scene, camera);
    this._faces.length = 0; this._poolUsed = 0; this._materialCache.clear();
    this._budget = clamp(Math.floor(this.maxRenderTriangles) || 90000, 100, 240000);
    this._inputTriangles = this._candidates = this._acceptedInstances = this._rejectedInstances = this._rejectedChunks = this._rejectedBatches = 0;
    const background = scene.background?.isColor ? scene.background : this._clearColor;
    const backgroundAlpha = scene.background?.isColor ? 1 : this._clearAlpha;
    const width = this.domElement.width, height = this.domElement.height;
    if (!this._frame || this._frame.width !== width || this._frame.height !== height) {
      this._frame = ctx.createImageData(width, height);
      this._colorBuffer = new Uint32Array(this._frame.data.buffer);
      this._depthBuffer = new Float32Array(width * height);
    }
    if (this.autoClear || backgroundAlpha === 1) this._colorBuffer.fill(pixel(srgb(background.r), srgb(background.g), srgb(background.b), Math.round(backgroundAlpha * 255)));
    this._depthBuffer.fill(-Infinity);
    scene.traverseVisible(mesh => {
      if (!mesh.isMesh || !mesh.geometry || !mesh.layers.test(camera.layers)) return;
      const data = this._geometry(mesh.geometry);
      if (!data) return;
      this._baseView.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
      this._instanceTint[0] = this._instanceTint[1] = this._instanceTint[2] = 1;
      if (mesh.isInstancedMesh) {
        // Test the batch before expanding any instance. Bounds are conservative
        // and retain the full original collection when a visible subset is used.
        if (!mesh.boundingSphere) mesh.computeBoundingSphere();
        const sphere=mesh.boundingSphere;
        this._batchSphere[0]=sphere.center.x;this._batchSphere[1]=sphere.center.y;this._batchSphere[2]=sphere.center.z;this._batchSphere[3]=sphere.radius;
        if (!this._visibleSphere(this._batchSphere, this._baseView.elements, maxScale(this._baseView.elements))) {
          this._rejectedBatches++; this._rejectedInstances += mesh.count; return;
        }
        const count = Math.min(mesh.count, mesh.instanceMatrix.count);
        for (let i = 0; i < count; i++) {
          this._instance.fromArray(mesh.instanceMatrix.array, i * 16);
          this._modelView.multiplyMatrices(this._baseView, this._instance);
          if (mesh.instanceColor) {
            this._instanceTint[0] = mesh.instanceColor.getX(i);
            this._instanceTint[1] = mesh.instanceColor.getY(i);
            this._instanceTint[2] = mesh.instanceColor.getZ(i);
          }
          this._meshGeometry(mesh, data, this._modelView, maxScale(this._modelView.elements));
        }
      } else this._meshGeometry(mesh, data, this._baseView, maxScale(this._baseView.elements));
    });
    const faces = this._faces;
    const textureCandidates = faces.filter(face => !face.textured && face.texture?.sample && !face.wireframe && face.score >= this.textureMinArea);
    textureCandidates.sort((a, b) => b.score - a.score);
    for (let i = 0, count = Math.min(textureCandidates.length, Math.max(0, this.maxTextureTriangles)); i < count; i++) textureCandidates[i].textured = true;
    // Opaque triangles are only sorted front-to-back to reduce work; the
    // per-pixel test decides visibility, even where two slanted faces cross.
    // Transparent surfaces blend after opaque depth has been established.
    faces.sort((a, b) => Number(a.transparent) - Number(b.transparent)
      || a.order - b.order || (a.transparent ? b.depth - a.depth : a.depth - b.depth));
    let textured = 0;
    for (const face of faces) {
      if (this._rasterize(face)) textured++;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.putImageData(this._frame, 0, 0);
    Object.assign(this.info.render, {
      frame: this.info.render.frame + 1, calls: 1, triangles: faces.length, lines: 0, points: 0,
      texturedTriangles: textured, inputTriangles: this._inputTriangles, visibleCandidates: this._candidates,
      acceptedInstances: this._acceptedInstances, rejectedInstances: this._rejectedInstances,
      rejectedChunks: this._rejectedChunks, rejectedBatches: this._rejectedBatches, budgetLimited: this._candidates > faces.length,
      depthBuffer: true, rasterWidth: width, rasterHeight: height,
      durationMs: Math.round((clock() - started) * 10) / 10
    });
    this.shadowMap.needsUpdate = false;
    return this.info.render;
  }

  dispose() {
    this._disposed = true;
    this._geometryCache = new WeakMap(); this._textureCache = new WeakMap();
    this._materialCache.clear(); this._colorCache.clear();
    this._faces.length = 0; this._facePool.length = 0;
    this._frame = this._colorBuffer = this._depthBuffer = null;
    this.info.memory.geometries = this.info.memory.textures = 0;
    this.context.clearRect(0, 0, this.domElement.width, this.domElement.height);
  }
}

export default CanvasFallbackRenderer;
