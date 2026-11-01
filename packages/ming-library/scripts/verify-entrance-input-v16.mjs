#!/usr/bin/env node
import assert from 'node:assert/strict';
import {PerspectiveCamera} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {bindEntranceZoomInput} from '../src/entrance-input-v16.js';

// A small DOM event surface preserves capture-before-bubble ordering and runs
// the installed r180 OrbitControls itself. No private control fields are used.
class InputEvent{
  constructor(type,options={}){Object.assign(this,{type,bubbles:true,cancelable:true,defaultPrevented:false,pointerType:'touch',clientX:100,clientY:100,pageX:100,pageY:100,pointerId:1,deltaY:0,deltaMode:0,button:0,buttons:1},options);}
  preventDefault(){if(this.cancelable)this.defaultPrevented=true;}
  stopImmediatePropagation(){this.stopped=true;}
}
class Target{
  constructor(){this.listeners=[];}
  addEventListener(type,handler,options){this.listeners.push({type,handler,capture:typeof options==='boolean'?options:Boolean(options?.capture)});}
  removeEventListener(type,handler,options){const capture=typeof options==='boolean'?options:Boolean(options?.capture);this.listeners=this.listeners.filter(l=>l.type!==type||l.handler!==handler||l.capture!==capture);}
  dispatchEvent(event){event.target=this;const listeners=this.listeners.filter(l=>l.type===event.type).sort((a,b)=>Number(b.capture)-Number(a.capture));for(const listener of listeners){if(event.stopped)break;if(this.listeners.includes(listener))listener.handler(event);}return !event.defaultPrevented;}
}
function fixture(){
  const window=new Target(),document=new Target(),element=new Target();
  window.PointerEvent=InputEvent;window.innerHeight=538;document.defaultView=window;document.hidden=false;
  Object.assign(element,{ownerDocument:document,clientWidth:867,clientHeight:538,style:{},captures:new Set(),getRootNode:()=>document,getBoundingClientRect:()=>({left:0,top:0,width:867,height:538})});
  element.setPointerCapture=id=>element.captures.add(id);element.releasePointerCapture=id=>element.captures.delete(id);
  const camera=new PerspectiveCamera(62,867/538,.1,500);camera.position.set(0,3,20);
  const controls=new OrbitControls(camera,element);controls.target.set(0,3,0);controls.update();
  let active=true;const travel=[],cancels=[];
  const binding=bindEntranceZoomInput({element,controls,isActive:()=>active,onTravel:metres=>travel.push(metres)});
  element.addEventListener('pointercancel',event=>cancels.push(event.pointerId));
  const fire=(type,options={})=>{const event=new InputEvent(type,options);element.dispatchEvent(event);return event;};
  const pointer=(type,id,x,y=100)=>fire(type,{pointerId:id,clientX:x,clientY:y,pageX:x,pageY:y});
  const pinch=()=>{controls.enableZoom=false;pointer('pointerdown',1,100);pointer('pointerdown',2,200);};
  const cleanup=()=>{binding.dispose();controls.dispose();};
  return {window,document,element,camera,controls,travel,cancels,binding,fire,pointer,pinch,cleanup,setActive:value=>{active=value;}};
}
const checks=[];
function check(name,run){run();checks.push({name,status:'PASS'});}

check('Active wheel is captured exactly once; inactive wheel reaches real OrbitControls',()=>{
  const f=fixture(),before=f.camera.position.clone();
  const event=f.fire('wheel',{deltaY:-100});
  assert.equal(event.defaultPrevented,true);assert.deepEqual(f.travel,[2]);assert.ok(f.camera.position.equals(before));
  f.setActive(false);const ordinary=f.fire('wheel',{deltaY:-100});
  assert.equal(ordinary.stopped,undefined);assert.equal(f.travel.length,1);assert.ok(!f.camera.position.equals(before));f.cleanup();
});
check('Wheel line/page units, direction and extreme input clamp are finite',()=>{
  const f=fixture();f.fire('wheel',{deltaY:3,deltaMode:1});f.fire('wheel',{deltaY:-1,deltaMode:2});f.fire('wheel',{deltaY:1e9});f.fire('wheel',{deltaY:Infinity});
  assert.deepEqual(f.travel,[-.96,10.76,-24]);f.cleanup();
});
check('Pinch travels without rotating or panning and the surviving finger resumes normal orbit',()=>{
  const f=fixture();f.pinch();assert.equal(f.controls.enableRotate,false);assert.equal(f.controls.enablePan,false);
  const before=f.camera.position.clone(),target=f.controls.target.clone();f.pointer('pointermove',2,250);
  assert.ok(Math.abs(f.travel[0]-Math.log(1.5)*24)<1e-12);assert.ok(f.camera.position.equals(before));assert.ok(f.controls.target.equals(target));
  f.pointer('pointerup',2,250);assert.equal(f.controls.enableRotate,true);assert.equal(f.controls.enablePan,true);
  f.pointer('pointermove',1,120);assert.ok(!f.camera.position.equals(before));assert.equal(f.travel.length,1);f.pointer('pointerup',1,120);f.cleanup();
});
check('Route deactivation preserves an ordinary single-finger orbit',()=>{
  const f=fixture();f.pointer('pointerdown',7,100);const before=f.camera.position.clone();f.setActive(false);f.binding.syncActive(false);
  assert.deepEqual(f.cancels,[]);f.pointer('pointermove',7,130);assert.ok(!f.camera.position.equals(before));f.pointer('pointerup',7,130);f.cleanup();
});
check('Blur, capture loss and route cancellation restore options and clear real Orbit gesture state',()=>{
  for(const reason of ['blur','lostcapture','inactive']){
    const f=fixture();f.controls.enablePan=false;f.pinch();
    if(reason==='blur')f.window.dispatchEvent(new InputEvent('blur'));
    else if(reason==='lostcapture')f.fire('lostpointercapture',{pointerId:1});
    else{f.setActive(false);f.binding.syncActive();}
    assert.equal(f.controls.enableRotate,true);assert.equal(f.controls.enablePan,false);assert.deepEqual(f.cancels,[1,2]);
    f.setActive(true);const before=f.camera.position.clone();f.pointer('pointerdown',3,100);f.pointer('pointermove',3,130);assert.ok(!f.camera.position.equals(before));f.pointer('pointerup',3,130);f.cleanup();
  }
});
check('Native pointercancel and disposal restore locks; event listeners are removed',()=>{
  const f=fixture();f.pinch();f.pointer('pointercancel',2,200);assert.equal(f.controls.enableRotate,true);assert.equal(f.controls.enablePan,true);f.pointer('pointerup',1,100);
  f.pinch();f.binding.dispose();assert.equal(f.controls.enableRotate,true);assert.equal(f.controls.enablePan,true);f.controls.enableZoom=true;
  const before=f.camera.position.clone();f.fire('wheel',{deltaY:-100});assert.ok(!f.camera.position.equals(before));assert.deepEqual(f.travel,[]);f.controls.dispose();
});
console.log(JSON.stringify({version:16,status:'PASS',scope:'Capture ordering and installed Three.js r180 OrbitControls gesture behavior using a minimal DOM event surface; not a physical touchscreen browser test.',checks},null,2));
