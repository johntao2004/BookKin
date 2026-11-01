#!/usr/bin/env node
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMingLibrary} from '../src/library.js';
import {createCameraCollision} from '../src/camera-collision.js';
import {PALACE_FRAME_V10 as FRAME} from '../src/palace-frame-v10.js';

const library=createMingLibrary();
library.group.updateMatrixWorld(true);
const exterior=library.architecture.exterior,scale=library.architecture.group.userData.planScale??1.2;
const collision=createCameraCollision({library,radius:.20});
const checks=[],failures=[];let assertions=0;
function check(ok,message){assertions++;assert.ok(ok,message);}
function test(name,run){try{checks.push({name,status:'PASS',...run()});}catch(error){checks.push({name,status:'FAIL'});failures.push({name,error:error.message});}}
const close=(a,b)=>Math.abs(a-b)<1e-5;
const stationId=(face,part,u)=>`v7-1-${face}-${part}-${u}`;
const part=(face,partName,u)=>exterior.supportConnections.find(r=>r.id===stationId(face,partName,u));
const allPartsAt=(face,u)=>exterior.supportConnections.filter(r=>r.face===face&&[
  `column-base-${u}`,`column-shaft-${u}`,`column-neck-${u}`,`column-capital-${u}`,
  `ground-portico-tie-${u}`,
].some(s=>r.id.endsWith(s)));
const worldPosition=record=>{
  const mesh=exterior.group.getObjectByName(record.meshName);
  check(!!mesh?.isInstancedMesh,`Missing rendered instance mesh for ${record.id}`);
  const local=new THREE.Matrix4();mesh.getMatrixAt(record.instanceIndex,local);
  return new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld.clone().multiply(local));
};
const atColumn=(face,u)=>{
  const shaft=part(face,'column-shaft',u),base=part(face,'column-base',u);
  check(!!shaft,`Missing ${face} shaft at ${u}`);check(!!base,`Missing ${face} base at ${u}`);
  const world=worldPosition(shaft),expectedX=(face==='east'?1:-1)*FRAME.lower.outerColumnX*scale,expectedZ=u*scale;
  check(close(world.x,expectedX)&&close(world.z,expectedZ),`Wrong rendered column world position ${face}/${u}: ${world.toArray()}`);
  check(!collision.isSafe(new THREE.Vector3(expectedX,2,expectedZ),{radius:.20}),`Real collision engine did not block ${face}/${u}`);
  return {face,u,world:[world.x,world.y,world.z]};
};
function expectedScreenStations(face){
  const screenStations=face==='east'
    ?FRAME.lower.postStationsLong.filter(u=>Math.abs(Math.abs(u)-7.35)>1e-6)
    :FRAME.lower.postStationsLong;
  const spans=face==='east'
    ?[[-FRAME.lower.wallZ,-2.70],[2.70,FRAME.lower.wallZ]]
    :[[-FRAME.lower.wallZ,FRAME.lower.wallZ]];
  const expected=[];
  for(const[lo,hi]of spans){
    const divisions=[lo,...screenStations.filter(p=>p>lo+.2&&p<hi-.2),hi];
    for(let j=0;j<divisions.length-1;j++){
      const start=divisions[j]+.10,end=divisions[j+1]-.10,width=end-start;
      const count=Math.max(1,Math.round(width/1.03)),pitch=width/count;
      for(let i=0;i<count;i++)expected.push(start+(i+.5)*pitch);
    }
  }
  return expected.sort((a,b)=>a-b);
}
function assertScreenStations(face){
  const actual=exterior.screenPanels.filter(p=>p.face===face&&p.level===1).map(p=>p.center[2]/scale).sort((a,b)=>a-b);
  const expected=expectedScreenStations(face);
  check(actual.length===expected.length,`${face} screen panel count changed: ${actual.length} / ${expected.length}`);
  actual.forEach((u,i)=>check(close(u,expected[i]),`${face} screen panel station changed at ${i}: ${u} / ${expected[i]}`));
  return actual.length;
}
function assertNoColumnOrObstacle(face,u){
  check(allPartsAt(face,u).length===0,`Removed ${face}/${u} still has column parts or its short tie`);
  const x=(face==='east'?1:-1)*FRAME.lower.outerColumnX*scale,z=u*scale;
  const blockers=library.obstacles.filter(o=>['column','columnBase'].includes(o.type)&&x>=o.minX-1e-6&&x<=o.maxX+1e-6&&z>=o.minZ-1e-6&&z<=o.maxZ+1e-6);
  check(blockers.length===0,`Removed ${face}/${u} still has a column obstacle`);
  check(collision.isSafe(new THREE.Vector3(x,2,z),{radius:.20}),`Removed ${face}/${u} is still blocked by actual scene geometry`);
  return {face,u,clearance:[x,2,z]};
}

test('Only the marked front and rear pairs are removed; restored and retained columns render and collide',()=>{
  check(exterior.metadata.removedEntranceColumns===2,'Front removed-column metadata must be 2');
  check(exterior.metadata.removedRearColumns===2,'Rear removed-column metadata must be 2');
  check(library.architecture.columnLayout.removedEntranceColumns===2,'Architecture front-column metadata is stale');
  check(library.architecture.columnLayout.removedRearColumns===2,'Architecture rear-column metadata is stale');
  check(exterior.metadata.columnCount===exterior.columnFootprints.length,'Column count must come from actual footprints');
  const restored=[-7.35,7.35].map(u=>atColumn('east',u));
  const retained=[-7.35,7.35].map(u=>atColumn('west',u));
  for(const u of[-4.9,4.9]){
    assertNoColumnOrObstacle('east',u);assertNoColumnOrObstacle('west',u);
  }
  return {restoredFront:restored,retainedRear:retained,removedFrontAndRear:[-4.9,4.9]};
});

test('All components and attachments follow each removed shaft, with its eave transfer still jointed',()=>{
  for(const face of['east','west'])for(const u of[-4.9,4.9]){
    check(!part(face,'column-base',u),`Removed ${face}/${u} base remains`);
    check(!part(face,'column-shaft',u),`Removed ${face}/${u} shaft remains`);
    check(!part(face,'column-neck',u),`Removed ${face}/${u} neck remains`);
    check(!part(face,'column-capital',u),`Removed ${face}/${u} capital remains`);
    check(!exterior.supportConnections.some(r=>r.face===face&&r.id.includes(`spandrel-${u}-`)),`Removed ${face}/${u} spandrel remains`);
    check(!exterior.supportConnections.some(r=>r.face===face&&r.id.endsWith(`ground-portico-tie-${u}`)),`Removed ${face}/${u} short tie remains`);
  }
  for(const u of[-7.35,7.35]){
    const shaft=part('east','column-shaft',u),capital=part('east','column-capital',u);
    check(exterior.groundFrameConnections.some(c=>c.type==='outer-column-bearing'&&c.upperId===shaft.id),'Restored front column is disconnected from its base');
    check(exterior.groundFrameConnections.filter(c=>c.type==='housed-eave-fang-to-capital'&&c.lowerId===capital.id).length>=2,`Restored front ${u} capital lacks eave connections`);
    const beam=library.architecture.unifiedFrame.primaryBeams.find(r=>r.axis==='x'&&r.side===1&&close(r.coordinate,u));
    check(!!beam?.outerColumnId,`Restored front ${u} primary timber is not carried by the shaft`);
  }
  for(const u of[-4.9,4.9]){
    const cuts=exterior.supportConnections.filter(r=>r.face==='west'&&r.kind==='continuous-colonnade-beam'&&(close(r.transferStart,u)||close(r.transferEnd,u)));
    check(cuts.some(r=>close(r.transferEnd,u))&&cuts.some(r=>close(r.transferStart,u)),`Rear eave transfer ${u} is not split on both sides`);
    for(const section of cuts)check(exterior.groundFrameConnections.some(c=>c.type==='seated-eave-band-bearing'&&c.lowerId===section.id),`Rear eave section ${section.id} has no seated band connection`);
  }
  return {rearTransferStations:[-4.9,4.9],primaryPortalStations:[-7.35,7.35],supportState:'supported'};
});

test('Front door and both long screen grids retain their original openings and panel stations',()=>{
  check(library.entrance.doors.length===2,'The existing double door must remain two leaves');
  check(library.entrance.geometryMetadata.pivots.length===2,'The existing double-door pivots changed');
  const opening=exterior.metadata.entryOpening;
  check(close(opening.minX,21.67*scale)&&close(opening.maxX,22.09*scale),'The front gate frame X opening changed');
  check(close(opening.minZ,-2.30*scale)&&close(opening.maxZ,2.30*scale),'The front gate frame Z opening changed');
  const eastPanels=assertScreenStations('east'),westPanels=assertScreenStations('west');
  return {doorLeaves:library.entrance.doors.length,frontOpening:{minX:opening.minX,maxX:opening.maxX,minZ:opening.minZ,maxZ:opening.maxZ},eastPanels,westPanels};
});

const report={status:failures.length?'FAIL':'PASS',checks,failures,assertions,collisionObjects:collision.stats.staticColliders};
console.log(JSON.stringify(report,null,2));
process.exitCode=failures.length?1:0;
