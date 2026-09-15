import { DataTexture, type Texture } from 'three';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createHistoricalBindingMaterial, createHistoricalBindingMaterialSteps } from './longRoomBindings';

function surfaceHash(texture:Texture) {
  if(!(texture instanceof DataTexture)) throw new Error('Expected a generated data texture');
  const pixels=texture.image.data;
  if(!pixels) throw new Error('Expected generated texture pixels');
  return createHash('sha256').update(pixels).digest('hex');
}

// Captured before changing the generator: all four color and relief maps.
const surfaceHashes = [
  "6a6406ef1bab4a239178fd57e950f0186a69faa704f3936727995215eae4e5f6",
  "ce6624157ac4824ac53f8132a3c2639ac78961e75bd6cfac53cb04b4708a3626",
  "5344f5a1e01861ccb36d746f9ace81eabe055b020f7e1f4beddf71f0b063e65c",
  "e6a91976b57e4d41e8d64c97315137f09eba3d2a0d8c747044e33b5b951100a1",
  "d16e623fa8f6669fa9944aee0e2e877e0cac3a7c0ab2d8cc11f6853fa248f6e5",
  "da3c99c431362c1b4442aa6c899c64faff73e4ab7ef78c43b8e81c9dd7f37540",
  "e2ba866f1ec61403387fd687366dd1509963501913ea2576c5d2ae27a9f2065d",
  "c948e126bdc04f1fe7a53cba810ca3df4911c4fa98d229dcc84c482732fbdad7"
];

it('preserves every byte of the original binding color and relief maps', () => {
  const hashes:string[]=[];
  for (let variant=0;variant<4;variant++) {
    const material=createHistoricalBindingMaterial(variant);
    for(const texture of [material.map!,material.bumpMap!]) {
      hashes.push(surfaceHash(texture));
      texture.dispose();
    }
    material.dispose();
  }
  expect(hashes).toEqual(surfaceHashes);
});

it('yields control during texture generation and returns the same surface', () => {
  const steps=createHistoricalBindingMaterialSteps(0);
  let pauses=0, step=steps.next();
  while(!step.done) { pauses++; step=steps.next(); }
  expect(pauses).toBeGreaterThan(1);
  const material=step.value;
  expect(surfaceHash(material.map!)).toBe(surfaceHashes[0]);
  material.map!.dispose(); material.bumpMap!.dispose(); material.dispose();
});
