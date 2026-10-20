import * as THREE from 'three';
import { catalogBindingProfile, coverBindingColor, paintCatalogSpine } from './catalog-book-appearance';
import { createCatalogBindingBump, createCatalogPaperMap } from './catalog-book-surfaces';
import { getCatalogBookShelfTransform, CATALOG_BOOK_MODEL_SIZE, getCenteredShelfBookOffsets, getShelfBookInteractionWidth } from './virtual-library-scene';
import { createReferenceCatalogAnchors } from './virtual-library-model/scene/referenceLibrary';

describe('real catalog binding proportions and shelf support', () => {
  it('varies bindings deterministically while keeping every tail on its original shelf', () => {
    const {catalogSlots} = createReferenceCatalogAnchors();
    const thicknesses = new Set<number>();
    const heights = new Set<number>();
    for (const slot of catalogSlots.filter((_, index) => index % 120 === 0)) {
      for (let i = 0; i < 30; i++) {
        const id = `real-catalog-volume-${i}`;
        const profile = catalogBindingProfile(id);
        expect(profile).toEqual(catalogBindingProfile(id));
        const transform = getCatalogBookShelfTransform(slot, CATALOG_BOOK_MODEL_SIZE, id);
        const height = CATALOG_BOOK_MODEL_SIZE.height * transform.scale.y;
        const thickness = CATALOG_BOOK_MODEL_SIZE.depth * transform.scale.z;
        heights.add(Number(height.toFixed(6))); thicknesses.add(Number(thickness.toFixed(6)));
        expect(transform.position.y - height / 2).toBeCloseTo(slot.position.y - slot.scale.y / 2);
        expect(height).toBeGreaterThanOrEqual(slot.scale.y * 0.89);
        expect(height).toBeLessThanOrEqual(slot.scale.y);
        expect(thickness / height).toBeLessThan(0.24);
        expect(thickness).toBeGreaterThan(0.06);
        expect(CATALOG_BOOK_MODEL_SIZE.width * transform.scale.x).toBeCloseTo(0.288);
        expect(transform.position.z).toBe(slot.position.z);
        expect(transform.rotation.z).toBe(0); // No fake lean that intersects neighbours.
      }
    }
    expect(thicknesses.size).toBeGreaterThan(10);
    expect(heights.size).toBeGreaterThan(3);
  });

  it('packs different bindings with disjoint hit lanes and no overlap', () => {
    const widths = Array.from({length: 20}, (_, i) => 0.16 * 0.94 * catalogBindingProfile(`volume-${i}`).thickness);
    const lanes = widths.map(getShelfBookInteractionWidth);
    const positions = getCenteredShelfBookOffsets(lanes);
    expect(positions[19] + lanes[19] / 2 - positions[0] + lanes[0] / 2).toBeLessThan(3.276);
    for (let i = 1; i < widths.length; i++) {
      expect(positions[i] - lanes[i] / 2).toBeGreaterThan(positions[i - 1] + lanes[i - 1] / 2);
      expect(positions[i] - widths[i] / 2).toBeGreaterThan(positions[i - 1] + widths[i - 1] / 2);
    }
  });
});

describe('paper and cloth surfaces', () => {
  it('keeps paper light and neutral with leaf separation through thickness, not page height', () => {
    const a = createCatalogPaperMap(4), b = createCatalogPaperMap(4);
    expect(a.image.data).toEqual(b.image.data);
    const pixels = a.image.data as Uint8Array;
    let alongStack = 0, alongHeight = 0, sum = 0;
    const {width, height} = a.image;
    for (let y = 1; y < height; y++) for (let x = 1; x < width; x++) {
      const i = (y * width + x) * 4;
      expect(pixels[i]).toBe(pixels[i + 1]); expect(pixels[i]).toBe(pixels[i + 2]);
      expect(pixels[i + 3]).toBe(255);
      alongStack += Math.abs(pixels[i] - pixels[i - 4]);
      alongHeight += Math.abs(pixels[i] - pixels[i - width * 4]);
      sum += pixels[i];
    }
    expect(sum / ((width - 1) * (height - 1) * 255)).toBeGreaterThan(0.85);
    expect(alongStack).toBeGreaterThan(alongHeight * 2);
    expect(a.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    a.dispose(); b.dispose();
  });

  it('uses a quiet reproducible non-color cloth relief map', () => {
    const a = createCatalogBindingBump(99), b = createCatalogBindingBump(99);
    expect(a.colorSpace).toBe(THREE.NoColorSpace);
    expect(a.image.data).toEqual(b.image.data);
    expect(a.anisotropy).toBe(8);
    const values = a.image.data as Uint8Array;
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(26);
    a.dispose(); b.dispose();
  });
});

describe('printed spine and cover palette', () => {
  it('prints every title glyph and actual author without a five-character label or glow', () => {
    const fillText = vi.fn();
    const ctx = {createLinearGradient: () => ({addColorStop: vi.fn()}), fillRect: vi.fn(), fillText};
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    try {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 1024;
      const title = '这是一部有完整书名的小说 041';
      paintCatalogSpine(canvas, {title, author: '真实作者'}, new THREE.Color('navy'));
      expect(fillText.mock.calls.slice(0, Array.from(title).length).map(call => call[0]).join('')).toBe(title);
      expect(fillText.mock.calls.some(call => call[0] === '真实作者')).toBe(true);
    } finally {spy.mockRestore();}
  });

  it('uses cover stock colors when readable and safely retains cloth on a tainted image', () => {
    const pixels = new Uint8ClampedArray(24 * 32 * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set([110, 130, 90, 255], i);
    const ctx = {drawImage: vi.fn(), getImageData: () => ({data: pixels})};
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const image = document.createElement('img');
    try {
      expect(coverBindingColor(image, 'red').getHex()).toBe(new THREE.Color().setRGB(110 / 255, 130 / 255, 90 / 255, THREE.SRGBColorSpace).getHex());
      ctx.drawImage.mockImplementation(() => {throw new DOMException('tainted', 'SecurityError');});
      expect(coverBindingColor(image, 'red').getHex()).toBe(new THREE.Color('red').getHex());
    } finally {spy.mockRestore();}
  });
});
