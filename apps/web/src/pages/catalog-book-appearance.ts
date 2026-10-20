import * as THREE from 'three';
import type { Book } from '../domain/types';
import { tokens } from '../theme/generated-tokens';

// 仅估计装帧外观，不据此推断页数或版本尺寸。
/** Visual binding estimates only; no page count or edition size is inferred. */
export function catalogBindingProfile(id: string) {
  const hash = Array.from(id).reduce((value, c) => (Math.imul(value, 31) + c.charCodeAt(0)) >>> 0, 0);
  let mixed = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
  const seed = (mixed ^ (mixed >>> 16)) >>> 0;
  return {seed, thickness: 0.40 + (seed % 27) / 100, height: 0.89 + ((seed >>> 8) % 12) / 100};
}

// 仅采样已加载的目录封面；不可读或跨域失败时保留确定性布面回退，不中断选书。
/** Sample only an already-loaded catalog cover. Unreadable/CORS images retain
 * the deterministic cloth fallback and never interrupt book selection. */
export function coverBindingColor(image: CanvasImageSource | undefined, fallback: string) {
  if (!image) return new THREE.Color(fallback);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 24; canvas.height = 32;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    if (!ctx) return new THREE.Color(fallback);
    ctx.drawImage(image, 0, 0, 24, 32);
    const pixels = ctx.getImageData(0, 0, 24, 32).data;
    // 从封面边缘采样，侧重书衣或纸材颜色而非中央插画。
    // Perimeter sampling follows jacket/cover stock rather than central artwork.
    let r = 0, g = 0, b = 0, count = 0;
    for (let y = 2; y < 30; y++) for (let x = 1; x < 23; x++) {
      if (x > 4 && x < 19 && y > 5 && y < 26) continue;
      const i = (y * 24 + x) * 4;
      if (pixels[i + 3] < 128) continue;
      r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++;
    }
    if (!count) return new THREE.Color(fallback);
    return new THREE.Color().setRGB(r / count / 255, g / count / 255, b / count / 255, THREE.SRGBColorSpace);
  } catch { return new THREE.Color(fallback); }
}

// 使用实际完整书名与作者，不虚构出版社；字体按标题自适应，避免重复的大号截断字形。
/** Full title and actual author, restrained printing, no invented publisher.
 * Font scale adapts to each title rather than repeating oversized truncated glyphs. */
export function paintCatalogSpine(canvas: HTMLCanvasElement, book: Pick<Book, 'title' | 'author'>, color: THREE.Color) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const {width, height} = canvas;
  const edge = color.clone().multiplyScalar(0.72).getStyle();
  const face = color.getStyle();
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, edge); gradient.addColorStop(0.20, face);
  gradient.addColorStop(0.48, color.clone().lerp(new THREE.Color(tokens.color.primitive.cream100), 0.045).getStyle());
  gradient.addColorStop(0.82, face); gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  ctx.fillStyle = luminance > 0.34 ? tokens.color.primitive.ink900 : tokens.color.primitive.cream200;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const glyphs = Array.from(book.title.trim());
  // 优先保留完整书名，极长书名分为多个窄竖列。
  // Prefer a complete title; very long titles use multiple narrow vertical columns.
  const columns = Math.max(1, Math.ceil(glyphs.length / 18));
  const perColumn = Math.ceil(glyphs.length / columns);
  const fontSize = Math.min(82 / columns, 650 / Math.max(perColumn, 1));
  ctx.font = `500 ${fontSize}px ${tokens.typography.fontFamily.readerSerif}`;
  for (let column = 0; column < columns; column++) {
    const text = glyphs.slice(column * perColumn, (column + 1) * perColumn);
    const x = width / 2 + ((columns - 1) / 2 - column) * (fontSize + 10);
    text.forEach((glyph, i) => ctx.fillText(glyph, x, 140 + (i + 0.5) * Math.min(fontSize * 1.18, 650 / text.length), width * 0.70));
  }
  ctx.globalAlpha = 0.78;
  ctx.font = `400 28px ${tokens.typography.fontFamily.readerSerif}`;
  const author = book.author.trim();
  if (author) ctx.fillText(author, width / 2, height - 115, width * 0.72);
  ctx.globalAlpha = 0.38;
  ctx.fillRect(width * 0.30, height - 73, width * 0.40, 1);
  ctx.globalAlpha = 1;
}
