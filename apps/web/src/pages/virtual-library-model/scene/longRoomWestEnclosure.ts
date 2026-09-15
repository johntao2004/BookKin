import { WEST_LEVELS } from './longRoomWestLevels';
import { createWestHighWindow, WEST_HIGH_WINDOWS, WEST_LOWER_WINDOW } from './longRoomWestWindow';
import { createWestCorniceGeometries, createWestStairCornice } from './longRoomWestCornice';
import { createWestStairCeilingRelief } from './longRoomWestCeiling';
import * as THREE from 'three';
import { PALETTE } from '../config';
import { createWestStairFrieze } from './longRoomWestFrieze';
import { createWestStairPanel } from './longRoomWestPanels';
import { markCameraCollider } from '../../virtual-library-collision';

/** Estimated enclosure for testing the historic stair hypothesis, not a survey. */
export function* createWestStairEnclosureSteps(basePlaster: THREE.MeshStandardMaterial, timber: THREE.Material, cutaway: boolean): Generator<string, THREE.Group> {
  // Casey 2018 shows cool gray wall fields and lighter raised plasterwork.
  // Keep this finish independent of the book-paper material shared by the main hall.
  const neutral = new THREE.Color(PALETTE.parchment).offsetHSL(0, -1, 0);
  const plaster = basePlaster.clone(); plaster.name = 'West stair gray plaster wall fields';
  plaster.color.copy(neutral).multiplyScalar(0.66); plaster.roughness = 0.96;
  const trim = plaster.clone(); trim.name = 'West stair pale raised plasterwork';
  trim.color.copy(neutral).multiplyScalar(0.94);
  const recess = plaster.clone(); recess.name = 'West stair recessed rustication joints';
  recess.color.multiplyScalar(0.86);
  const root = new THREE.Group(); root.name = 'West stair estimated enclosure';
  root.userData.fidelity = '2019-G_E-1-and-G_E-2-wall-topology; adapted-dimensions';
  const corniceGeometry = createWestCorniceGeometries();
  const rusticationGeometries = new Map<string, THREE.BufferGeometry>();
  const box = (parent: THREE.Group, name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
    let geometry: THREE.BufferGeometry = new THREE.BoxGeometry(w,h,d);
    if (name === 'Shallow plaster rustication face') {
      // Small eased plaster edges catch light gradually instead of reading as sharp bricks.
      geometry.dispose();
      const key = [w,h,d].map(value => value.toFixed(6)).join('/');
      const cached = rusticationGeometries.get(key);
      if (cached) geometry = cached;
      else {
      const bevel = Math.min(0.005, w / 6);
      const shape = new THREE.Shape();
      shape.moveTo(-w/2+bevel,-h/2+bevel); shape.lineTo(w/2-bevel,-h/2+bevel);
      shape.lineTo(w/2-bevel,h/2-bevel); shape.lineTo(-w/2+bevel,h/2-bevel); shape.closePath();
      geometry = new THREE.ExtrudeGeometry(shape, {depth:d-2*bevel,bevelEnabled:true,
        bevelSize:bevel,bevelThickness:bevel,bevelSegments:2});
      geometry.translate(0,0,-d/2+bevel);
      rusticationGeometries.set(key, geometry);
      }
    }
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name = name; mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
    if(/^(Continuous plaster wall|Wall below|Wall above|Estimated timber door)/.test(name))
      markCameraCollider(mesh,{id:`west-enclosure-${parent.name}-${name}-${x}-${y}`,shape:'box',
        center:{x:0,y:0,z:0},size:{x:w,y:h,z:d}});
  };
  const wall = (name: string, length: number, x: number, z: number, angle: number,
    door?: {center: number; base: number; width: number; height: number}, highWindows=false) => {
    const group = new THREE.Group(); group.name = name; group.position.set(x,0,z); group.rotation.y = angle; root.add(group);
    const left = door ? door.center-door.width/2 : length/2, right = door ? door.center+door.width/2 : length/2;
    const openings=[...(door?[door]:[]),...(highWindows?[...WEST_HIGH_WINDOWS,WEST_LOWER_WINDOW]:[])];
    const xs=[...new Set([-length/2,length/2,...openings.flatMap(o=>[o.center-o.width/2,o.center+o.width/2])])].sort((a,b)=>a-b);
    const ys=[...new Set([0,WEST_LEVELS.ceiling,...openings.flatMap(o=>[o.base,o.base+o.height])])].sort((a,b)=>a-b);
    for(let i=0;i<xs.length-1;i++) for(let j=0;j<ys.length-1;j++) {
      const cx=(xs[i]+xs[i+1])/2,cy=(ys[j]+ys[j+1])/2;
      if(openings.some(o=>cx>o.center-o.width/2&&cx<o.center+o.width/2&&cy>o.base&&cy<o.base+o.height))continue;
      box(group,'Continuous plaster wall pier',xs[i+1]-xs[i],ys[j+1]-ys[j],0.24,cx,cy,0,plaster);
    }
    if (door) {
      const top=door.base+door.height;
      for (const u of [left-0.055,right+0.055]) box(group,'Estimated timber door jamb',0.11,door.height+0.08,0.36,u,door.base+door.height/2,0,timber);
      box(group,'Estimated timber door head',door.width+0.22,0.11,0.36,door.center,top+0.055,0,timber);
    }
    if(highWindows) for (const [index, opening] of WEST_HIGH_WINDOWS.entries())
      group.add(createWestHighWindow(timber,trim,opening,`west-high-window-glazing-${index}`));
    if(highWindows) {
      const lower=createWestHighWindow(timber,trim,WEST_LOWER_WINDOW,'west-lower-window-glazing',4,2);
      lower.name='West pavilion lower four-by-two window';group.add(lower);
    }
    // Shallow applied courses on a continuous wall create recessed joints;
    // they are plaster rustication, not separate freestanding masonry bricks.
    const visibleRects = (left:number,right:number,bottom:number,top:number) => {
      const cuts=[bottom,top,...openings.flatMap(o=>[o.base,o.base+o.height]).filter(y=>y>bottom&&y<top)].sort((a,b)=>a-b);
      return cuts.slice(0,-1).flatMap((y,index)=>{
        const end=cuts[index+1];let spans=[[left,right]];
        for(const opening of openings) if(y<opening.base+opening.height&&end>opening.base) {
          const a=opening.center-opening.width/2,b=opening.center+opening.width/2;
          spans=spans.flatMap(([l,r])=> b<=l||a>=r?[[l,r]]:[[l,Math.min(r,a)],[Math.max(l,b),r]].filter(([u,v])=>v>u));
        }
        return spans.map(([l,r])=>({left:l,right:r,bottom:y,top:end}));
      });
    };
    for (let row=0;row<13;row++) {
      const jointY=row*0.38;
      for(const r of visibleRects(-length/2,length/2,jointY-0.01,jointY+0.01))
        box(group,'Recessed horizontal plaster joint',r.right-r.left,r.top-r.bottom,0.002,
          (r.left+r.right)/2,(r.bottom+r.top)/2,0.122,recess);
      const bottom=row*0.38+0.01,top=bottom+0.36;
      for(let start=-length/2-(row%2)*0.45;start<length/2;start+=0.9) {
        const a=Math.max(-length/2,start+0.008),b=Math.min(length/2,start+0.892);
        for(const r of visibleRects(a,b,bottom,top)) if(r.right-r.left>0.01&&r.top-r.bottom>0.01)
          box(group,'Shallow plaster rustication face',r.right-r.left,r.top-r.bottom,0.035,
            (r.left+r.right)/2,(r.bottom+r.top)/2,0.1375,plaster);
      }
    }
    const frieze=createWestStairFrieze(length,trim);
    frieze.position.y=WEST_LEVELS.frieze; group.add(frieze);
    // A continuous shallow cornice closes the wall/ceiling junction.
    const cornice=createWestStairCornice(length,trim,corniceGeometry);
    cornice.position.y=WEST_LEVELS.ceiling-0.22; group.add(cornice);
    if(!highWindows) {
      const panel=createWestStairPanel(2.3,2.7,trim);
      panel.position.set(door && door.base>0 ? (door.center>0 ? -0.6 : 0.8) : 0,7.8,0.126); group.add(panel);
    }
    if(!highWindows && (!door || door.base===0)) for(const side of [-1,1]) {
      const narrow=createWestStairPanel(1.1,2.7,trim,false);
      narrow.position.set(side*(length/2-0.92),7.8,0.126); group.add(narrow);
    }
    if(highWindows) for(const center of [-0.85,2.65]) {
      const panel=createWestStairPanel(1.05,2.7,trim,false);
      panel.position.set(center,7.925,0.126);group.add(panel);
    }
    return group;
  };
  wall('West study rear wall and lower doorway',6.8,0,-2.05,0,{center:1.9,base:0,width:1.25,height:2.2});
  yield 'construction-west-rear-wall';
  // G_E-1: the first-flight wall has two high windows, alternating with narrow panels.
  wall('West study side wall',7.65,-3.4,1.775,Math.PI/2,{center:-2.55,base:0,width:1.25,height:2.2},true);
  yield 'construction-west-side-wall';
  if (!cutaway) {
    wall('West study opposite side wall',7.65,3.4,1.775,-Math.PI/2,{center:2.865,base:5.4,width:1.04,height:2.35});
    yield 'construction-west-opposite-wall';
    wall('West study upper threshold wall',6.8,0,5.6,Math.PI,{center:-2.08,base:5.4,width:1.04,height:2.35});
    yield 'construction-west-threshold-wall';
    const ceilingField = plaster.clone(); ceilingField.name = 'West stair ceiling plaster field';
    ceilingField.color.lerp(trim.color,0.55);
    box(root,'West study ceiling',7.04,0.18,7.89,0,WEST_LEVELS.ceiling+0.09,1.775,ceilingField);
    const relief = createWestStairCeilingRelief(trim);
    relief.rotation.x = Math.PI / 2; relief.position.set(0,WEST_LEVELS.ceiling-0.01,1.775);
    root.add(relief);
    yield 'construction-west-ceiling-relief';
    // Local reflected-light approximation reveals shallow carving without illuminating the whole hall.
    // Static architecture needs one cached shadow map, not a six-face point-light shadow.
    const bounce = new THREE.SpotLight(neutral, 55, 12, 0.92, 0.65, 2);
    bounce.name = 'West ceiling local reflected light';
    bounce.position.set(-2.4,3.8,0.8); bounce.target.position.set(0,WEST_LEVELS.ceiling,1.775);
    bounce.castShadow = true; bounce.shadow.mapSize.set(1024,1024);
    bounce.shadow.camera.near = 0.2; bounce.shadow.camera.far = 12;
    bounce.shadow.normalBias = 0.003; bounce.shadow.bias = -0.0001;
    bounce.shadow.autoUpdate = false; bounce.shadow.needsUpdate = true;
    root.add(bounce,bounce.target);
    const daylight = new THREE.SpotLight(neutral,65,12,0.42,0.35,2);
    daylight.name='West paired-window daylight';daylight.position.set(-4,7.9,2.625);
    daylight.target.position.set(0,3,3.5);daylight.castShadow=true;
    daylight.shadow.mapSize.set(1024,1024);daylight.shadow.camera.near=0.1;
    daylight.shadow.camera.far=12;daylight.shadow.normalBias=0.01;
    daylight.shadow.autoUpdate=false;daylight.shadow.needsUpdate=true;
    root.add(daylight,daylight.target);
  }
  return root;
}

/** Synchronous component/offline entry shares exactly the progressive geometry. */
export function createWestStairEnclosure(basePlaster: THREE.MeshStandardMaterial, timber: THREE.Material, cutaway: boolean) {
  const steps = createWestStairEnclosureSteps(basePlaster, timber, cutaway);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}
