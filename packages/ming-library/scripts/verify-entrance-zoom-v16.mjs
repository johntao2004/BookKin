#!/usr/bin/env node
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {createMingLibrary} from '../src/library.js';
import {createLibraryNavigation} from '../src/navigation-v2.js';
import {createCameraCollision} from '../src/camera-collision.js';
import {createEntranceZoom} from '../src/entrance-zoom-v16.js';
import {poses} from '../src/views-v13.js';

const started=performance.now();
const library=createMingLibrary(),entrance=library.entrance;
const navigation=createLibraryNavigation({architecture:library.architecture,entrance,ceremonial:library.ceremonial,obstacles:library.obstacles});
const collision=createCameraCollision({library,radius:.20,groundY:-3.6});
const trace=[];
// This is the real collision engine with a recording hook, not a replacement
// collider or metadata-only mock. Every accepted piece is rechecked below.
const instrumented={...collision,resolve(from,to,options){const result=collision.resolve(from,to,options);trace.push({from:from.clone(),to:to.clone(),accepted:result.position.clone(),blocked:result.blocked,radius:options.radius});return result;}};
const route=createEntranceZoom({library,navigation,collision:instrumented,start:poses.gate});
const checks=[],failures=[],measurements={};let assertions=0,sampledPositions=0,acceptedSweeps=0;
function check(ok,message){assertions++;assert.ok(ok,message);}
function near(a,b,message,epsilon=2e-6){check(Math.abs(a-b)<=epsilon,`${message}: ${a} / ${b}`);}
function same(a,b,message){check(a.distanceTo(b)<2e-6,`${message}: ${a.toArray()} / ${b.toArray()}`);}
function test(name,run){try{const evidence=run();checks.push({name,status:'PASS',...evidence});}catch(error){checks.push({name,status:'FAIL'});failures.push({name,error:error.message});}}
function gate(open){entrance.gate.setOpen(open);collision.refreshDynamic();}

test('The far limit is exactly the existing palace overview and outward input cannot retreat farther',()=>{
  gate(true);same(route.start.position,new THREE.Vector3(...poses.gate.position),'Original overview eye');same(route.start.target,new THREE.Vector3(...poses.gate.target),'Original overview target');
  const result=route.advance(route.start,-100000);same(result.position,route.start.position,'Outward start remains fixed');near(result.progress,0,'Progress at far limit');check(result.atStart,'Far-limit state');
  const end=route.advance(route.end,100000);same(end.position,route.end.position,'Inward end remains fixed');check(end.atEnd,'Near-limit state');
  return{start:route.start.position.toArray(),finish:route.end.position.toArray(),length:route.length};
});

test('The full open-gate route clears actual courtyard roofs, all three stone flights and the palace entrance',()=>{
  gate(true);let prior=route.start.position;const n=Math.ceil(route.length/.12),levels=new Set();
  for(let i=0;i<=n;i++){
    const progress=route.length*i/n,p=route.positionAt(progress);
    check(collision.isSafe(p,{radius:.28}),'Unsafe actual geometry sample '+p.toArray());
    check(!collision.sweep(prior,p,{radius:.28}),'Actual roof/stone/gate collision on the route '+p.toArray());
    if(progress>=route.approachDistance){
      const foot=p.y-navigation.eyeHeight;check(navigation.canStand(p.x,p.z,foot),'Grounded route has no walkable support '+p.toArray());
      for(const y of[-3.6,-2.4,-1.2,0])if(Math.abs(foot-y)<1e-6)levels.add(y);
    }
    prior=p;sampledPositions++;
  }
  check(levels.size===4,'Route must use courtyard plus three terrace levels');near(prior.x,16,'Inner endpoint before throne');near(prior.y,1.72,'Inner eye height');
  measurements.supportLevels=[...levels];return{positions:n+1,clearanceRadius:.28,supportLevels:[...levels]};
});

test('Very large input still sweeps every stair corner and landing; it cannot cut through a long chord',()=>{
  gate(true);trace.length=0;const result=route.advance(route.start,100000,{radius:.28});check(!result.blocked,'Open entrance unexpectedly blocked');check(result.atEnd,'Large input reaches the finite inside limit');
  let longest=0;for(const step of trace){
    const length=step.from.distanceTo(step.to);longest=Math.max(longest,length);check(length<=.250002,'Unbounded camera sweep length');
    check(!collision.sweep(step.from,step.accepted,{radius:step.radius}),'Accepted route piece crosses an actual solid');check(collision.isSafe(step.accepted,{radius:step.radius}),'Accepted endpoint unsafe');acceptedSweeps++;
  }
  check(trace.length>400,'Insufficient actual segmented sweep coverage');return{sweeps:trace.length,longestAcceptedRequest:longest};
});

test('Repeated small forward and reverse inputs return continuously to the same original overview',()=>{
  gate(true);let current=route.start,forwardSteps=0,reverseSteps=0;
  while(!current.atEnd){const result=route.advance(current,.8);check(!result.blocked&&result.onRoute,'Small inward input failed');check(result.progress>=current.progress,'Inward progression reversed');current=result;forwardSteps++;if(forwardSteps>200)throw new Error('Forward input failed to terminate');}
  same(current.position,route.end.position,'Repeated forward endpoint');
  while(!current.atStart){const result=route.advance(current,-1.1);check(!result.blocked&&result.onRoute,'Small outward input failed');check(result.progress<=current.progress,'Outward progression reversed');current=result;reverseSteps++;if(reverseSteps>200)throw new Error('Reverse input failed to terminate');}
  same(current.position,route.start.position,'Repeated reverse eye');same(current.target,route.start.target,'Repeated reverse target');return{forwardSteps,reverseSteps};
});

test('A closed palace gate stops entry at its actual leaf and reopening resumes without a jump',()=>{
  gate(false);let current=route.advance(route.start,100000);check(current.blocked&&current.blockedByDoor,'Closed door must be identified by real leaf collision');check(collision.isSafe(current.position),'Closed-door stop unsafe');check(current.position.x>entrance.geometryMetadata.pivots[0][0],'Camera crossed a closed gate');
  const stopped=current.position.clone(),stoppedProgress=current.progress;
  for(let i=0;i<8;i++){current=route.advance(current,2);check(current.blocked&&current.blockedByDoor,'Repeated closed-door input must stay blocked');same(current.position,stopped,'Closed leaf cannot accumulate penetration');}
  gate(true);const continued=route.advance(current,100000);check(!continued.blocked&&continued.atEnd,'Opening the gate did not permit continuation');near(continued.travelled,route.length-stoppedProgress,'Remaining route continues from stop');
  measurements.closedEntryStop=stopped.toArray();return{stopped:stopped.toArray(),resumed:continued.position.toArray()};
});

test('Reverse travel from inside also respects a closed gate and can resume after opening',()=>{
  gate(false);const blocked=route.advance(route.end,-100000);check(blocked.blocked&&blocked.blockedByDoor,'Closed gate must block outward travel');check(blocked.position.x<entrance.geometryMetadata.pivots[0][0],'Reverse motion crossed closed leaf');check(collision.isSafe(blocked.position),'Inside door stop unsafe');
  gate(true);const returned=route.advance(blocked,-100000);check(!returned.blocked&&returned.atStart,'Return after reopening must reach overview');same(returned.position,route.start.position,'Returned initial eye');return{stopped:blocked.position.toArray()};
});

test('Orbiting or panning off the approach never snaps the user back to its centreline',()=>{
  gate(true);const current=route.sample(route.length*.4),off=current.position.clone().add(new THREE.Vector3(1.5,1,4));
  const result=route.advance({...current,position:off},3);check(!result.onRoute,'Off-route input was treated as attached');same(result.position,off,'Off-route eye unexpectedly moved');same(result.target,current.target,'Off-route target changed');near(result.travelled,0,'Off-route input travels zero guided distance');
  for(const progress of[0,route.length*.15,route.approachDistance,route.length*.82,route.length]){const p=route.sample(progress),projection=route.project(p.position);near(projection.distance,0,'Actual-route projection distance');near(projection.progress,progress,'Actual-route projected progress');}
  return{offRouteEye:off.toArray()};
});

const report={version:16,recordedAt:new Date().toISOString(),scope:'Finite palace entrance approach; real composed library geometry and continuous camera collision, both gate states',checks,failures,assertions,sampledPositions,acceptedSweeps,measurements,elapsedMs:performance.now()-started,limitations:['Node geometry and interaction-controller verification does not replace browser wheel/pinch inspection or a GPU frame-time measurement.']};
if(process.argv.includes('--report'))writeFileSync(new URL('../docs/entrance-zoom-v16.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));process.exitCode=failures.length?1:0;
