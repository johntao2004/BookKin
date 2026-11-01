/** Track a single primary tap separately from orbit/first-person dragging.
 * A drag that returns to its starting point, a cancelled gesture, or a
 * multi-touch gesture must never open a book. Coordinates are CSS pixels. */
export function createBookTapGesture({slop=5}={}){
  const active=new Set();let pointer=null;
  return{
    begin(event){
      active.add(event.pointerId);
      if(active.size!==1||event.isPrimary===false||event.button!==0){if(pointer)pointer.cancelled=true;return false;}
      pointer={id:event.pointerId,x:event.clientX,y:event.clientY,originX:event.clientX,originY:event.clientY,moved:false,cancelled:false};
      return true;
    },
    move(event){
      if(!pointer||pointer.id!==event.pointerId||pointer.cancelled)return null;
      const delta={x:event.clientX-pointer.x,y:event.clientY-pointer.y};
      if(Math.hypot(event.clientX-pointer.originX,event.clientY-pointer.originY)>=slop)pointer.moved=true;
      pointer.x=event.clientX;pointer.y=event.clientY;return delta;
    },
    end(event){
      active.delete(event.pointerId);
      if(!pointer||pointer.id!==event.pointerId)return false;
      const tap=!pointer.cancelled&&!pointer.moved&&active.size===0&&event.button===0&&
        Math.hypot(event.clientX-pointer.originX,event.clientY-pointer.originY)<slop;
      pointer=null;return tap;
    },
    cancel(event){active.delete(event.pointerId);if(pointer){pointer.cancelled=true;if(pointer.id===event.pointerId)pointer=null;}},
    reset(){active.clear();pointer=null;},
  };
}
