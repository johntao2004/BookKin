import * as THREE from 'three';
import type { LibraryMaterials } from './materials';
import { markCameraCollider } from '../../virtual-library-collision';

/** Y1.002 and survey XS-3A/3B establish the east stair location and solid parapets.
 * The 4.58 m floor rise is source-backed; tread count, radii and thickness are estimates.
 * Attached to the live east enclosure; a guided descent is not yet exposed. */
export const EAST_STAIR = {rise:4.58,stepsPerFlight:14,width:1.3,run:3.9,
  southX:-2.5,turnX:-6.4,centerZ:5.6,radius:1.8,parapetHeight:1.05} as const;
export function createEastStairStudy(materials:LibraryMaterials) {
  const root=new THREE.Group();root.name='East solid-parapet return stair study';
  root.userData.fidelity='Y1.002 and XS-3A/3B topology; estimated tread and turning geometry';
  const S=EAST_STAIR,halfRise=S.rise/2,going=S.run/S.stepsPerFlight;
  const surfaces=new THREE.Group();surfaces.name='East stair walking surfaces';root.add(surfaces);
  const finish=materials.parchment.clone();finish.roughness=0.95;
  const mesh=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Group=root)=>{
    const item=new THREE.Mesh(geometry,material);item.name=name;item.castShadow=item.receiveShadow=true;parent.add(item);return item;
  };
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,parent:THREE.Group=surfaces)=>{
    const item=mesh(name,new THREE.BoxGeometry(w,h,d),finish,parent);item.position.set(x,y,z);return item;
  };
  box('East stair lower arrival floor',2,0.18,1.7,-2,-S.rise-0.09,S.centerZ-S.radius);
  box('East stair upper arrival floor',1.1,0.18,1.7,-1.95,-0.09,S.centerZ+S.radius);
  const rail=(points:THREE.Vector3[])=>mesh('East stair continuous handrail',
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(12,points.length*2),0.035,8,false),materials.iron);
  for(const flight of [0,1]) {
    const direction=flight===0?-1:1,startX=flight===0?S.southX:S.turnX;
    const base=flight===0?-S.rise:-halfRise,z=S.centerZ+(flight===0?-S.radius:S.radius);
    for(let i=0;i<S.stepsPerFlight;i++) {
      const top=base+(i+1)*halfRise/S.stepsPerFlight,x=startX+direction*(i+0.5)*going;
      box('East stair supported tread',going+0.015,0.18,S.width,x,top-0.09,z);
      box('East stair closed riser',0.025,halfRise/S.stepsPerFlight,S.width,
        startX+direction*i*going,top-halfRise/S.stepsPerFlight/2,z,root);
      for(const side of [-1,1])markCameraCollider(root,{id:`east-stair-guard-${flight}-${i}-${side}`,shape:'box',
        center:{x,y:top+1,z:z+side*S.width/2},size:{x:going+0.03,y:2.2,z:0.15}});
    }
    for(const side of [-1,1]) {
      const shape=new THREE.Shape();shape.moveTo(startX,base);shape.lineTo(startX+direction*S.run,base+halfRise);
      shape.lineTo(startX+direction*S.run,base+halfRise+S.parapetHeight);shape.lineTo(startX,base+S.parapetHeight);shape.closePath();
      const wall=mesh('East stair solid raking parapet',new THREE.ExtrudeGeometry(shape,{depth:0.12,bevelEnabled:false}),finish);
      wall.position.z=z+side*S.width/2-0.06;
      rail([new THREE.Vector3(startX,base+S.parapetHeight+0.05,z+side*S.width/2),
        new THREE.Vector3(startX+direction*S.run,base+halfRise+S.parapetHeight+0.05,z+side*S.width/2)]);
    }
  }
  const ring=(inner:number,outer:number,depth:number,y:number,name:string,parent:THREE.Group)=>{
    const shape=new THREE.Shape();
    for(let i=0;i<=64;i++){const a=i*Math.PI/64,x=-outer*Math.sin(a),z=-outer*Math.cos(a);if(i===0)shape.moveTo(x,z);else shape.lineTo(x,z);}
    for(let i=64;i>=0;i--){const a=i*Math.PI/64;shape.lineTo(-inner*Math.sin(a),-inner*Math.cos(a));}shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geometry.rotateX(Math.PI/2);
    const item=mesh(name,geometry,finish,parent);item.position.set(S.turnX,y,S.centerZ);
  };
  ring(S.radius-S.width/2,S.radius+S.width/2,0.18,-halfRise,'East stair curved half-turn landing',surfaces);
  for(const radius of [S.radius-S.width/2,S.radius+S.width/2]) {
    ring(radius-0.06,radius+0.06,S.parapetHeight,-halfRise+S.parapetHeight,'East stair curved solid parapet',root);
    const points=Array.from({length:65},(_,i)=>new THREE.Vector3(S.turnX-radius*Math.sin(i*Math.PI/64),
      -halfRise+S.parapetHeight+0.05,S.centerZ-radius*Math.cos(i*Math.PI/64)));
    rail(points);
    for(let i=0;i<64;i++) {
      const a=points[i],b=points[i+1];
      markCameraCollider(root,{id:`east-stair-turn-${radius}-${i}`,shape:'box',center:{x:(a.x+b.x)/2,y:-halfRise+1,z:(a.z+b.z)/2},
        size:{x:0.15,y:2.2,z:a.distanceTo(b)+0.02},rotationY:Math.atan2(b.x-a.x,b.z-a.z)});
    }
  }
  return root;
}
