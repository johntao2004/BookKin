import * as THREE from 'three';
import { PALETTE } from '../config';

const textureCanvas = (width: number, height = width) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  return { canvas, context };
};

const textureFromCanvas = (
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
};

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

function createWoodTexture(base = '#3d2114', highlight = '#7a482a') {
  const { canvas, context } = textureCanvas(1024);
  const random = seededRandom(1487);
  const gradient = context.createLinearGradient(0, 0, 1024, 0);
  gradient.addColorStop(0, base);
  gradient.addColorStop(0.12, base);
  gradient.addColorStop(0.5, highlight);
  gradient.addColorStop(0.86, base);
  gradient.addColorStop(1, base);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 1024);

  context.globalAlpha = 0.28;
  for (let i = 0; i < 190; i += 1) {
    const y = random() * 1024;
    const amplitude = 2 + random() * 9;
    context.beginPath();
    context.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 24) {
      context.lineTo(x, y + Math.sin(x * 0.018 + random() * 2) * amplitude);
    }
    context.strokeStyle = random() > 0.5 ? '#b97a46' : '#130906';
    context.lineWidth = 0.6 + random() * 2.2;
    context.stroke();
  }

  context.globalAlpha = 0.2;
  for (let i = 0; i < 16; i += 1) {
    const x = random() * 1024;
    const y = random() * 1024;
    context.beginPath();
    context.ellipse(x, y, 8 + random() * 20, 3 + random() * 8, 0, 0, Math.PI * 2);
    context.strokeStyle = '#160805';
    context.lineWidth = 2;
    context.stroke();
  }
  return textureFromCanvas(canvas, 1.6, 1.6);
}

function createStoneTexture() {
  const { canvas, context } = textureCanvas(1024);
  const random = seededRandom(9341);
  context.fillStyle = '#4b4942';
  context.fillRect(0, 0, 1024, 1024);

  const image = context.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.floor((random() - 0.5) * 24);
    image.data[i] = Math.max(0, Math.min(255, image.data[i] + value));
    image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + value));
    image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + value));
  }
  context.putImageData(image, 0, 0);

  context.globalAlpha = 0.32;
  context.strokeStyle = '#1d1c19';
  context.lineWidth = 5;
  const blockHeight = 128;
  for (let row = 0; row <= 8; row += 1) {
    const y = row * blockHeight;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1024, y);
    context.stroke();
    const offset = row % 2 === 0 ? 0 : 128;
    for (let x = offset; x < 1024; x += 256) {
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y + blockHeight);
      context.stroke();
    }
  }
  return textureFromCanvas(canvas, 2.2, 6.4);
}

function createFloorTexture() {
  const { canvas, context } = textureCanvas(1024);
  const random = seededRandom(7221);
  context.fillStyle = '#2b1b11';
  context.fillRect(0, 0, 1024, 1024);

  const plankWidth = 85;
  for (let x = 0; x < 1024; x += plankWidth) {
    const shade = 33 + Math.floor(random() * 28);
    context.fillStyle = `rgb(${shade + 18}, ${shade + 4}, ${shade - 7})`;
    context.fillRect(x + 2, 0, plankWidth - 4, 1024);
    context.fillStyle = 'rgba(5, 2, 1, 0.52)';
    context.fillRect(x, 0, 3, 1024);
    context.strokeStyle = 'rgba(178, 111, 55, 0.12)';
    context.lineWidth = 1;
    for (let grain = 0; grain < 7; grain += 1) {
      const gx = x + 8 + random() * (plankWidth - 16);
      context.beginPath();
      context.moveTo(gx, 0);
      context.bezierCurveTo(gx + 7, 300, gx - 8, 700, gx + 2, 1024);
      context.stroke();
    }
  }
  context.strokeStyle = 'rgba(4, 2, 1, 0.5)';
  context.lineWidth = 3;
  for (let y = 0; y < 1024; y += 256) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1024, y);
    context.stroke();
  }
  return textureFromCanvas(canvas, 2.6, 8.5);
}

function createRugTexture() {
  const { canvas, context } = textureCanvas(512, 2048);
  const random = seededRandom(1941);
  context.fillStyle = '#29070a';
  context.fillRect(0, 0, 512, 2048);

  context.fillStyle = '#a17b3f';
  context.fillRect(18, 0, 8, 2048);
  context.fillRect(486, 0, 8, 2048);
  context.fillStyle = '#5c1a1b';
  context.fillRect(30, 0, 26, 2048);
  context.fillRect(456, 0, 26, 2048);

  for (let y = 0; y < 2048; y += 150) {
    context.save();
    context.translate(256, y + 75);
    context.rotate(Math.PI / 4);
    context.strokeStyle = '#8f6a35';
    context.lineWidth = 8;
    context.strokeRect(-42, -42, 84, 84);
    context.strokeStyle = 'rgba(215, 184, 111, 0.34)';
    context.lineWidth = 3;
    context.strokeRect(-24, -24, 48, 48);
    context.restore();
  }

  context.globalAlpha = 0.13;
  context.fillStyle = '#ead59e';
  for (let i = 0; i < 5200; i += 1) {
    context.fillRect(random() * 512, random() * 2048, 1, 1);
  }
  return textureFromCanvas(canvas);
}

export interface LibraryMaterials {
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  woodWarm: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  rug: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  parchment: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  lampGlass: THREE.MeshStandardMaterial;
}

export function createLibraryMaterials(): LibraryMaterials {
  const woodMap = createWoodTexture();
  const darkWoodMap = createWoodTexture('#211008', '#482519');
  const warmWoodMap = createWoodTexture('#4b2715', '#8f5630');
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9bb3ca,
    emissive: 0x20374d,
    emissiveIntensity: 0.62,
    roughness: 0.18,
    transparent: true,
    opacity: 0.46,
    side: THREE.DoubleSide,
  });
  glass.forceSinglePass = true;
  glass.userData.batchTransparent = true;
  return {
    stone: new THREE.MeshStandardMaterial({
      color: PALETTE.stone,
      map: createStoneTexture(),
      roughness: 0.93,
      metalness: 0,
    }),
    stoneDark: new THREE.MeshStandardMaterial({
      color: PALETTE.stoneDark,
      roughness: 0.98,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: PALETTE.parchment,
      map: woodMap,
      bumpMap: woodMap,
      bumpScale: 0.025,
      roughness: 0.72,
    }),
    woodDark: new THREE.MeshStandardMaterial({
      color: PALETTE.parchment,
      map: darkWoodMap,
      bumpMap: darkWoodMap,
      bumpScale: 0.018,
      roughness: 0.78,
    }),
    woodWarm: new THREE.MeshStandardMaterial({
      color: PALETTE.parchment,
      map: warmWoodMap,
      bumpMap: warmWoodMap,
      bumpScale: 0.022,
      roughness: 0.68,
    }),
    floor: new THREE.MeshStandardMaterial({
      color: 0x775238,
      map: createFloorTexture(),
      roughness: 0.78,
      metalness: 0.02,
    }),
    rug: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createRugTexture(),
      roughness: 0.96,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: PALETTE.brass,
      roughness: 0.35,
      metalness: 0.76,
    }),
    iron: new THREE.MeshStandardMaterial({
      color: 0x0d1011,
      roughness: 0.5,
      metalness: 0.78,
    }),
    leather: new THREE.MeshStandardMaterial({
      color: PALETTE.oxblood,
      roughness: 0.74,
    }),
    parchment: new THREE.MeshStandardMaterial({
      color: PALETTE.parchment,
      roughness: 0.95,
    }),
    glass,
    lampGlass: new THREE.MeshStandardMaterial({
      color: 0xf0a95a,
      emissive: 0xff7d25,
      emissiveIntensity: 1.35,
      roughness: 0.3,
    }),
  };
}
