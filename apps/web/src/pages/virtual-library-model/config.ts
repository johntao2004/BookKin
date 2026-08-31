import * as THREE from 'three';

export type ViewId = 'hall' | 'gallery' | 'stair' | 'restricted';
export type ExteriorPresetId = 'moonlit' | 'highland' | 'castleGlow';

export interface ExteriorPreset {
  id: ExteriorPresetId;
  label: string;
  backdropTint: number;
  backdropIntensity: number;
  glassTint: number;
  glassEmissive: number;
  glassEmissiveIntensity: number;
  windowLightColor: number;
  windowLightIntensity: number;
  moonColor: number;
  moonIntensity: number;
  textureShift: number;
  textureY: number;
  fogColor: number;
  exposure: number;
}

export const EXTERIOR_PRESETS: readonly ExteriorPreset[] = [
  {
    id: 'moonlit',
    label: '月夜湖景',
    backdropTint: 0xd6e7ff,
    backdropIntensity: 2.65,
    glassTint: 0x9bb3ca,
    glassEmissive: 0x20374d,
    glassEmissiveIntensity: 0.62,
    windowLightColor: 0xbfd9f0,
    windowLightIntensity: 255,
    moonColor: 0xb8cee0,
    moonIntensity: 1.55,
    textureShift: 0,
    textureY: 0.02,
    fogColor: 0x090908,
    exposure: 1.23,
  },
  {
    id: 'highland',
    label: '远山薄雾',
    backdropTint: 0xaebdc6,
    backdropIntensity: 2.85,
    glassTint: 0x9faeb4,
    glassEmissive: 0x394953,
    glassEmissiveIntensity: 0.52,
    windowLightColor: 0xc5d0d4,
    windowLightIntensity: 218,
    moonColor: 0xaab8c0,
    moonIntensity: 1.25,
    textureShift: 0.18,
    textureY: 0.11,
    fogColor: 0x0b0d0d,
    exposure: 1.18,
  },
  {
    id: 'castleGlow',
    label: '城堡灯火',
    backdropTint: 0xe0c6a1,
    backdropIntensity: 3.0,
    glassTint: 0xb9a889,
    glassEmissive: 0x4b3824,
    glassEmissiveIntensity: 0.58,
    windowLightColor: 0xd7c8ad,
    windowLightIntensity: 232,
    moonColor: 0x9fb3c9,
    moonIntensity: 1.38,
    textureShift: 0.62,
    textureY: 0.0,
    fogColor: 0x0b0908,
    exposure: 1.25,
  },
];

export interface LibraryConfig {
  tower: {
    innerRadius: number;
    wallThickness: number;
    mainHeight: number;
    galleryY: number;
    galleryDepth: number;
    roofHeight: number;
    segmentCount: number;
    entranceAngle: number;
  };
  bookcase: {
    depth: number;
    lowerHeight: number;
    upperHeight: number;
    shelfCount: number;
  };
  window: {
    width: number;
    height: number;
    sillHeight: number;
  };
  atmosphere: {
    fogColor: number;
    fogDensity: number;
    exposure: number;
    bloomStrength: number;
    bloomRadius: number;
    bloomThreshold: number;
  };
}

/**
 * Circular tower proportions derived from the supplied plan and section.
 * Every major radius and vertical level is controlled here so the model can
 * be refined without rebuilding individual meshes.
 */
export const LIBRARY: LibraryConfig = {
  tower: {
    innerRadius: 14.4,
    wallThickness: 0.72,
    mainHeight: 12.8,
    galleryY: 6.2,
    galleryDepth: 4.35,
    roofHeight: 6.8,
    segmentCount: 16,
    entranceAngle: Math.PI / 2,
  },
  bookcase: {
    depth: 0.76,
    lowerHeight: 5.45,
    upperHeight: 4.55,
    shelfCount: 6,
  },
  window: {
    width: 2.55,
    height: 4,
    sillHeight: 8.1,
  },
  atmosphere: {
    fogColor: 0x090908,
    fogDensity: 0.012,
    exposure: 1.23,
    bloomStrength: 0.075,
    bloomRadius: 0.32,
    bloomThreshold: 1.72,
  },
};

export interface CameraPreset {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  title: string;
  body: string;
  index: string;
}

export const CAMERA_PRESETS: Record<ViewId, CameraPreset> = {
  hall: {
    position: new THREE.Vector3(0.15, 2.35, 11.7),
    target: new THREE.Vector3(0, 4.7, -3.4),
    fov: 58,
    index: '01',
    title: '圆形主阅览区',
    body: '环形书墙包围中央阅览区，高窗与回廊共同强化塔楼尺度。',
  },
  gallery: {
    position: new THREE.Vector3(-8.2, 7.25, 8.2),
    target: new THREE.Vector3(-9.5, 7.8, -5.5),
    fov: 55,
    index: '02',
    title: '上层环形回廊',
    body: '木质回廊沿塔壁连续展开，栏杆、书墙与下层尖拱形成双层环带。',
  },
  stair: {
    position: new THREE.Vector3(1.8, 2.55, 2.2),
    target: new THREE.Vector3(6.25, 3.2, 5.45),
    fov: 52,
    index: '03',
    title: '旋转楼梯',
    body: '螺旋楼梯贴近入口侧上升，与回廊内缘衔接。',
  },
  restricted: {
    position: new THREE.Vector3(-5.4, 2.25, -5.0),
    target: new THREE.Vector3(-11.6, 2.55, -10.4),
    fov: 48,
    index: '04',
    title: '隐藏通道入口',
    body: '旋转书柜与铁门嵌入外圈书墙，形成独立的禁书区入口。',
  },
};

export const PALETTE = {
  nearBlack: 0x090806,
  stone: 0x69645a,
  stoneDark: 0x24231f,
  oak: 0x2c160d,
  oakWarm: 0x4b2816,
  oakEdge: 0x160b07,
  brass: 0x9e6f2c,
  gold: 0xb9914c,
  parchment: 0xd9cba7,
  oxblood: 0x3a090b,
  green: 0x193126,
  glassBlue: 0x253c51,
};
