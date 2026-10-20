import { expect, it } from 'vitest';
import { readArticleImage } from './imageImport';
it('rejects unsupported image types and oversized images before reading', async () => {
  await expect(readArticleImage(new File(['<svg/>'], 'image.svg', {type:'image/svg+xml'}))).rejects.toThrow('JPEG、PNG 或 WebP');
  await expect(readArticleImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {type:'image/png'}))).rejects.toThrow('5 MB');
});
