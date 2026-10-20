// 真实目录书籍共用中性纸张和亚麻纹理；U 对应书页厚度、V 对应高度，书头通过旋转纹理延续同一页叠。
/** Shared neutral paper/linen maps for real catalog volumes only.
 * Paper U spans the leaf stack thickness; V spans page height. Rotate the map
 * for the horizontal head so the same leaves continue across both surfaces. */

import * as THREE from "three";

const PAPER_W = 512;
const PAPER_H = 128;
const BUMP_SIZE = 128;

// 确定性逐像素哈希位于 [0,1)，无需 Math.random，可复现。
/** Deterministic per-pixel hash in [0, 1). Reproducible; no Math.random. */
function hash2(x: number, y: number, seed: number): number {
  let h = (seed ^ Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca6b)) | 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 各向异性限制为支持的 1..8 范围，无效值或 NaN 回退为 4。
/** Clamp anisotropy to the supported 1..8 range (invalid/NaN defaults to 4). */
function clampAnisotropy(anisotropy: number): number {
  const a = Number.isFinite(anisotropy) ? Math.round(anisotropy) : 4;
  return Math.min(8, Math.max(1, a));
}

function byteFromUnit(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

// 中性灰度纸张调制纹理为 512×128 RGBA；U 为页叠厚度、V 为高度，含不规则细分隔、轻微纸纹与克制边缘老化；alpha 不透明，采用 LinearSRGB。
/**
 * Neutral grayscale paper / fore-edge modulation texture (512x128 RGBA).
 *
 * U = leaf-stack thickness, V = book height. Contents:
 *  - fine, nonregular leaf separation along U (thin darker lines at
 *    pseudo-random spacing, matching page-edge stacking);
 *  - very low per-pixel noise for paper grain;
 *  - restrained aging at the head and tail of the page block.
 * Opaque alpha (255); LinearSRGB color space so it behaves as a modulation input.
 */
export function createCatalogPaperMap(anisotropy: number): THREE.DataTexture {
  const data = new Uint8Array(PAPER_W * PAPER_H * 4);

  // 书页沿厚度 U 堆叠而非高度；略不规则细线在书架距离的 mipmap 下保持克制。
  // Pages stack through the book thickness (U), not through its height.
  // Slightly irregular fine lines remain quiet after mipmapping at shelf distance.
  let nextLeaf = 2;
  const seams = new Set<number>();
  while (nextLeaf < PAPER_W) {
    seams.add(nextLeaf);
    nextLeaf += 2 + Math.floor(hash2(nextLeaf, 0, 17) * 4);
  }
  for (let y = 0; y < PAPER_H; y++) for (let x = 0; x < PAPER_W; x++) {
    const edgeAge = Math.pow(Math.abs(y / (PAPER_H - 1) * 2 - 1), 6) * 0.035;
    const leafTone = hash2(x, 0, 31) * 0.018;
    const noise = (hash2(x, y, 47) - 0.5) * 0.008;
    const value = 0.97 - (seams.has(x) ? 0.075 : 0) - edgeAge - leafTone + noise;
    const i = (y * PAPER_W + x) * 4;
    const byte = byteFromUnit(value);
    data[i] = data[i + 1] = data[i + 2] = byte;
    data[i + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, PAPER_W, PAPER_H);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = clampAnisotropy(anisotropy);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// 装帧使用 128×128 单通道 R 凹凸纹理；可复现的经纬交织起伏有少量相位扰动，幅度限制在 0.45..0.55。
/**
 * Neutral single-channel (R) bump texture (128x128) for the book binding.
 *
 * Reproducible (no Math.random) crosswoven linen relief: two gentle orthogonal
 * undulations with a small per-cell phase warp, amplitude kept inside the
 * 0.45..0.55 normalized band so bump strength stays gentle everywhere.
 */
export function createCatalogBindingBump(anisotropy: number): THREE.DataTexture {
  const data = new Uint8Array(BUMP_SIZE * BUMP_SIZE);
  const seed = 0xbb67ae85;

  for (let v = 0; v < BUMP_SIZE; v++) {
    const ny = v / (BUMP_SIZE - 1);
    for (let x = 0; x < BUMP_SIZE; x++) {
      const nx = x / (BUMP_SIZE - 1);

      // 每格轻微改变相位，并将两组起伏相乘形成交织纹。
      // Crosswoven pattern: warp phase slightly per cell, multiply two undulations.
      const phaseU = hash2(x, v, seed) * 0.5;
      const phaseV = hash2(v, x, seed) * 0.5;
      const weave =
        0.5 * Math.sin((nx * 2.0 + phaseU) * Math.PI * 2.8) *
               Math.cos((ny * 2.0 + phaseV) * Math.PI * 2.8) +
        0.5 * Math.sin((nx * 0.11 - ny * 0.16) * Math.PI * 3.0);
      const lowFreq = (hash2(x, v, seed ^ 0x5f356495) - 0.5) * 0.012;

      // 幅度限制为 0.45..0.55，只影响起伏，不添加颜色。
      // Gentle band, clamped to 0.45..0.55 (neutral, no color contribution).
      const value = Math.max(0.45, Math.min(0.55, 0.5 + 0.05 * weave + lowFreq));
      data[v * BUMP_SIZE + x] = byteFromUnit(value);
    }
  }

  const tex = new THREE.DataTexture(data, BUMP_SIZE, BUMP_SIZE);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = clampAnisotropy(anisotropy);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}