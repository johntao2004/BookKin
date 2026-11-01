import * as THREE from 'three';
import { buildArchitectureV7 } from './architecture-v7.js';
import { buildCeremonialV7 } from './ceremonial-v7.js';
import { buildShelvesV2, allocateBookSlots } from './shelves-v2.js';
import { buildEntranceV3 } from './entrance-v3.js';
import { raiseArchitecture, raiseEntrance } from './height-v11.js';
import { expandArchitecturePlan, expandEntrancePlan } from './plan-v12.js';
import { PALACE_PLAN_SCALE } from './design-v12.js';
import { buildPalaceCourtyardV12 } from './courtyard-v12.js';
import { yieldToBrowser } from './runtime-performance-v14.js';
import { PALACE_HEIGHTS_V15 } from './height-v15.js';

/** Creates the complete reusable scene. Geometry uses metres, Y is up. */
export function createMingLibrary(options = {}) {
  const architecture = expandArchitecturePlan(raiseArchitecture(buildArchitectureV7(options)));
  const ceremonial = buildCeremonialV7(options);
  const furniture = buildShelvesV2({planScale:PALACE_PLAN_SCALE});
  const entrance = expandEntrancePlan(raiseEntrance(buildEntranceV3(options)));
  const courtyard = buildPalaceCourtyardV12();
  return assembleLibrary({architecture,ceremonial,furniture,entrance,courtyard});
}

/** Browser entry: preserve the exact factories, with paint opportunities between phases. */
export async function createMingLibraryAsync(options = {}, {onProgress, yieldTask = yieldToBrowser} = {}) {
  const parts = {}, stages = [
    ['architecture','正在搭建两层木构',()=>expandArchitecturePlan(raiseArchitecture(buildArchitectureV7(options)))],
    ['ceremonial','正在布置宝座与藻井',()=>buildCeremonialV7(options)],
    ['furniture','正在排布两翼书架',()=>buildShelvesV2({planScale:PALACE_PLAN_SCALE})],
    ['entrance','正在连接宫门与台基',()=>expandEntrancePlan(raiseEntrance(buildEntranceV3(options)))],
    ['courtyard','正在铺设院落与环道',()=>buildPalaceCourtyardV12()],
  ];
  const timings = {};
  for (const [key,label,build] of stages) {
    onProgress?.(label); await yieldTask();
    const start=performance.now();parts[key]=build();timings[key]=performance.now()-start;
  }
  const library=assembleLibrary(parts);library.performance={stages:timings};return library;
}

function assembleLibrary({architecture,ceremonial,furniture,entrance,courtyard}) {
  architecture.stats.heightProfile={...PALACE_HEIGHTS_V15};
  architecture.group.userData.heightProfile={...PALACE_HEIGHTS_V15};
  const group = new THREE.Group(); group.name = 'Guanwen_Two_Storey_Library';
  group.add(architecture.group, furniture.group, entrance.group, ceremonial.group, courtyard.group);
  group.userData = {
    title: '观文藏阁 · 两层现代藏书空间', style: 'Original Ming-inspired palace with modern books',
    units: 'metres', upAxis: 'Y', entrance: '+X', entranceFacadeLength: 62*PALACE_PLAN_SCALE, roofCount: 2, version: '2.14.0', hallAxis: 'X', throneFacing: '+X',
    historicalScope: 'Artistic interpretation; not a measured reconstruction of a historical building',
    heightProfile: {...PALACE_HEIGHTS_V15},
  };
  return { group, architecture, furniture, entrance, ceremonial, courtyard,
    obstacles: [...architecture.obstacles, ...furniture.obstacles, ...entrance.obstacles, ...ceremonial.obstacles,...courtyard.obstacles],
    stats: { ...architecture.stats, ...furniture.stats, ...entrance.stats, ...ceremonial.stats },
    allocateBooks: (books, options) => allocateBookSlots(furniture.compartments,books,options),
  };
}

export { createModernBook, createBookCollection, normalizeBookData, generateDemoBooks } from './modern-books.js';
