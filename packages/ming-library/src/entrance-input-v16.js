/** Route travel owns wheel/double-touch zoom only. OrbitControls continues to
 * receive pointer events, including the final up that resets its one-finger
 * state. Call cancel() before replacing the controls' configuration, and call
 * syncActive() when route eligibility changes without an input event. */
export function bindEntranceZoomInput({element,controls,isActive,onTravel}){
  if(!element?.addEventListener||!controls||typeof isActive!=='function'||typeof onTravel!=='function')throw new TypeError('Entrance zoom needs an element, controls, isActive and onTravel');
  const ownerDocument=element.ownerDocument;
  const ownerWindow=ownerDocument?.defaultView??(typeof window!=='undefined'?window:null);
  const touches=new Map();
  let pinchLock=null,lastDistance=0,disposed=false;
  const clamp=metres=>Math.max(-24,Math.min(24,metres));
  const travel=metres=>{if(Number.isFinite(metres)&&metres!==0)onTravel(clamp(metres));};
  const distance=()=>{
    if(touches.size!==2)return 0;
    const [a,b]=touches.values();
    return Math.hypot(b.x-a.x,b.y-a.y);
  };
  function restorePinch(){
    if(!pinchLock)return;
    controls.enableRotate=pinchLock.rotate;controls.enablePan=pinchLock.pan;pinchLock=null;
  }
  function lockPinch(){
    if(pinchLock)return;
    pinchLock={rotate:controls.enableRotate,pan:controls.enablePan};
    controls.enableRotate=false;controls.enablePan=false;
  }
  function notifyPointerCancel(point){
    const options={bubbles:true,cancelable:false,pointerType:'touch',pointerId:point.id,clientX:point.x,clientY:point.y,pageX:point.pageX,pageY:point.pageY};
    const PointerEventClass=ownerWindow?.PointerEvent??(typeof PointerEvent!=='undefined'?PointerEvent:null);
    if(PointerEventClass){element.dispatchEvent(new PointerEventClass('pointercancel',options));return;}
    const EventClass=ownerWindow?.Event??Event,event=new EventClass('pointercancel',{bubbles:true});
    for(const[key,value]of Object.entries(options))if(key!=='bubbles'&&key!=='cancelable')Object.defineProperty(event,key,{value});
    element.dispatchEvent(event);
  }
  function cancel(){
    // A single-finger orbit belongs entirely to OrbitControls. Do not cancel it
    // merely because that rotation made the camera leave the entrance route.
    const interrupted=pinchLock?[...touches.values()]:[];
    touches.clear();lastDistance=0;
    const saved=pinchLock;pinchLock=null;
    try{
      // Clearing our map first makes these ordinary DOM cancellation events
      // non-recursive. Orbit and the book-tap recognizer both see the cleanup.
      for(const point of interrupted)notifyPointerCancel(point);
    }finally{
      if(saved){controls.enableRotate=saved.rotate;controls.enablePan=saved.pan;}
    }
  }
  function syncActive(active=isActive()){
    if(disposed)return false;
    if(!active)cancel();
    return Boolean(active);
  }
  function onWheel(event){
    if(!syncActive()||!Number.isFinite(event.deltaY))return;
    const pageHeight=Math.max(1,element.clientHeight||ownerWindow?.innerHeight||800);
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?pageHeight:1);
    event.preventDefault();event.stopImmediatePropagation();
    travel(-pixels*.02);
  }
  function onPointerDown(event){
    if(event.pointerType!=='touch'||!syncActive()||controls.enabled===false)return;
    if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
    touches.set(event.pointerId,{id:event.pointerId,x:event.clientX,y:event.clientY,pageX:event.pageX,pageY:event.pageY});
    if(touches.size>=2)lockPinch();
    lastDistance=distance();
  }
  function onPointerMove(event){
    if(event.pointerType!=='touch'||!syncActive())return;
    const point=touches.get(event.pointerId);
    if(!point||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
    point.x=event.clientX;point.y=event.clientY;point.pageX=event.pageX;point.pageY=event.pageY;
    if(!pinchLock)return;
    if(event.cancelable)event.preventDefault();
    const nextDistance=distance(),previous=lastDistance;lastDistance=nextDistance;
    // Three or more fingers pause travel until a fresh two-finger baseline is
    // available. Near-coincident touches cannot produce an unbounded log ratio.
    if(nextDistance>=1&&previous>=1)travel(Math.log(nextDistance/previous)*24);
    // Never stop pointer propagation: Orbit updates its pointer positions and
    // the book-tap recognizer must observe movement and multiple touch points.
  }
  function onPointerEnd(event){
    if(!touches.delete(event.pointerId))return;
    if(touches.size<2)restorePinch();
    lastDistance=distance();
    // This capture listener restores flags before Orbit's pointerup listener,
    // allowing that listener to initialize a remaining single-finger rotation.
  }
  function onLostCapture(event){if(touches.has(event.pointerId))cancel();}
  function onVisibility(){if(ownerDocument?.hidden)cancel();}
  const bindings=[
    [element,'wheel',onWheel,{capture:true,passive:false}],
    [element,'pointerdown',onPointerDown,{capture:true}],
    [element,'pointermove',onPointerMove,{capture:true,passive:false}],
    [element,'pointerup',onPointerEnd,{capture:true}],
    [element,'pointercancel',onPointerEnd,{capture:true}],
    [element,'lostpointercapture',onLostCapture,{capture:true}],
    [ownerWindow,'blur',cancel,false],
    [ownerDocument,'visibilitychange',onVisibility,false],
  ];
  for(const[target,type,handler,options]of bindings)target?.addEventListener(type,handler,options);
  function dispose(){
    if(disposed)return;
    cancel();disposed=true;
    for(const[target,type,handler,options]of bindings)target?.removeEventListener(type,handler,options);
  }
  return {cancel,dispose,syncActive};
}
