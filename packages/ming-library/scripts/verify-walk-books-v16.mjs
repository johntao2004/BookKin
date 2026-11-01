#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createBookTapGesture} from '../src/book-interaction-v16.js';

const checks=[];
const event=(x=40,y=60,extra={})=>({pointerId:1,clientX:x,clientY:y,button:0,isPrimary:true,...extra});
function check(name,body){body();checks.push({name,status:'PASS'});}
check('Mouse and touch taps remain selectable',()=>{
  for(const pointerType of ['mouse','touch']){const g=createBookTapGesture(),e=event(40,60,{pointerType});assert.equal(g.begin(e),true);g.move(event(42,61));assert.equal(g.end(event(42,61)),true);}
});
check('Dragging outward and back does not become a click',()=>{
  const g=createBookTapGesture();g.begin(event());g.move(event(90,60));g.move(event());assert.equal(g.end(event()),false);
});
check('Release displacement, secondary buttons and cancellation cannot select',()=>{
  const g=createBookTapGesture();g.begin(event());assert.equal(g.end(event(50,60)),false);
  assert.equal(g.begin(event(40,60,{button:2})),false);assert.equal(g.end(event(40,60,{button:2})),false);
  g.begin(event());g.cancel(event());assert.equal(g.end(event()),false);
});
check('Pinch gestures, unmatched pointers and released capture cannot select',()=>{
  const g=createBookTapGesture();g.begin(event());assert.equal(g.begin(event(90,60,{pointerId:2,isPrimary:false})),false);
  g.end(event(90,60,{pointerId:2,isPrimary:false}));assert.equal(g.end(event()),false);
  g.begin(event());assert.equal(g.end(event(40,60,{pointerId:7})),false);g.cancel(event());assert.equal(g.end(event()),false);
});
check('Resetting an interrupted gesture permits a fresh tap',()=>{
  const g=createBookTapGesture();g.begin(event());g.reset();assert.equal(g.end(event()),false);g.begin(event());assert.equal(g.end(event()),true);
});

// Exercise the actual app functions with a small DOM and book stage. This
// verifies first-person state/position across asynchronous book construction,
// without rebuilding the architectural scene or emulating browser rendering.
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const panels=new Map();
function element(id){if(!panels.has(id))panels.set(id,{hidden:true,textContent:'',innerHTML:'',classList:{toggle(){}}});return panels.get(id);}
for(const id of ['selection','catalog-panel','data-panel','help'])element(id);
let focused=0,transitions=0,steps=0;
const camera=new THREE.PerspectiveCamera();camera.position.set(18.96,10.12,8);
const before=camera.position.clone(),keys=new Set(['KeyW']);
const record={id:'book-1',title:'漫游选书',author:'测试',pageCount:240,category:'文学',width:.22,height:.35,thickness:.03,placements:[{position:[19,10.5,8],floor:2,shelfId:'F2-01',cellId:'cell-1'}]};
const context=vm.createContext({THREE,console,state:{mode:'walk',selected:null,source:'custom'},camera,keys,
  $:selector=>element(selector.slice(1)),renderer:{domElement:{focus(){focused++;}}},bookTap:createBookTapGesture(),dragging:true,
  pendingEntranceTravel:0,entranceInput:{cancel(){}},
  selectionRevision:0,stageModel:null,stageScene:new THREE.Scene(),stageCamera:new THREE.PerspectiveCamera(),
  stageControls:{target:new THREE.Vector3(),minDistance:0,update(){}},stageDirty:false,frameLoop:{request(){}},
  collection:{records:new Map([[record.id,record]])},library:{furniture:{compartments:[]}},
  navigation:{step(){steps++;}},requestRender(){},disposeBookModel(){},stageInit(){},stageSize(){},
  plainBook:b=>b,cameraCollisionRadius:()=>.035,startTransition(){transitions++;},
  async createModernBook(){const model=new THREE.Group();model.add(new THREE.Mesh(new THREE.BoxGeometry(.22,.35,.03)));model.userData.warnings=[];return model;},
  window:{dispatchEvent(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},notifyParent(){},toast(){},
});
vm.runInContext(section('function showPanel(','function stageInit(')+section('async function selectBook(','function fillBookForm(')+section('function walk(dt){','function pick(e){'),context);
await vm.runInContext("selectBook('book-1',{focus:true})",context);
check('Opening a book during walking preserves mode and camera, and clears movement',()=>{
  assert.equal(context.state.mode,'walk');assert.equal(transitions,0);assert.deepEqual(camera.position.toArray(),before.toArray());
  assert.equal(element('selection').hidden,false);assert.equal(keys.size,0);assert.equal(vm.runInContext('isWalkInputPaused()',context),true);
  vm.runInContext('walk(.1)',context);assert.equal(steps,0);
});
check('Closing details resumes walking at the same position',()=>{
  vm.runInContext('closeSelection()',context);assert.equal(element('selection').hidden,true);
  assert.equal(context.state.mode,'walk');assert.equal(vm.runInContext('isWalkInputPaused()',context),false);assert.deepEqual(camera.position.toArray(),before.toArray());assert.ok(focused>0);
});
vm.runInContext("showPanel('catalog-panel')",context);
assert.equal(element('catalog-panel').hidden,false);
await vm.runInContext("selectBook('book-1',{focus:true})",context);
check('Catalog selection in walking opens details without a camera transition',()=>{
  assert.equal(context.state.mode,'walk');assert.equal(transitions,0);assert.equal(element('catalog-panel').hidden,true);assert.equal(element('selection').hidden,false);
  assert.deepEqual(camera.position.toArray(),before.toArray());
});
const report={revision:16,status:'PASS',checkedAt:new Date().toISOString(),appSourceSha256:createHash('sha256').update(source).digest('hex'),checks,
  limits:'Gesture and actual app-function regression; browser pointer dispatch and rendered UI require separate browser QA.'};
if(process.argv.includes('--report'))fs.writeFileSync(new URL('../docs/walk-books-v16.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
