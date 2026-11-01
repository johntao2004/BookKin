/** Continuous walking on the courtyard, three stone terraces, two gallery
 * storeys and the accessible throne dais. All values are world-space metres. */
export function createLibraryNavigation({ architecture, entrance, ceremonial, obstacles } = {}) {
  if (!architecture) throw new TypeError('createLibraryNavigation requires architecture');
  const eyeHeight=1.72,radius=.23,bodyHeight=1.78,maxStep=.28,epsilon=1e-6;
  const upperY=architecture.stats?.floorHeight??8.4;
  const planScale=architecture.group?.userData?.planScale??1;
  const stairs=[...(architecture.stairs??[]),...(entrance?.exteriorStairs??entrance?.stairs??[]),...(ceremonial?.stairs??[])].filter(s=>Number.isFinite(s.bottomY)&&Number.isFinite(s.topY));
  const galleryRects=architecture.galleryRects??[],landingRects=architecture.landingRects??[];
  const groundRects=[...(architecture.groundRects??[]),...(entrance?.groundRects??[])];
  const ceremonyRects=ceremonial?.walkableRects??ceremonial?.daisRects??[];
  const surfaces=[...groundRects,...galleryRects,...landingRects,...ceremonyRects];
  const blockers=obstacles??architecture.obstacles??[];
  const bounds={minX:Math.min(...surfaces.map(r=>r.minX)),maxX:Math.max(...surfaces.map(r=>r.maxX)),minZ:Math.min(...surfaces.map(r=>r.minZ)),maxZ:Math.max(...surfaces.map(r=>r.maxZ))};
  const finite=Number.isFinite;
  const contains=(r,x,z)=>x>=r.minX-epsilon&&x<=r.maxX+epsilon&&z>=r.minZ-epsilon&&z<=r.maxZ+epsilon;
  const stairHeight=(s,x,z)=>{
    const alongX=s.axis==='x',bottom=alongX?(s.bottomX??s.maxX):(s.bottomZ??s.maxZ),top=alongX?(s.topX??s.minX):(s.topZ??s.minZ),coordinate=alongX?x:z;
    const t=Math.max(0,Math.min(1,(bottom-coordinate)/(bottom-top)));
    return s.bottomY+t*(s.topY-s.bottomY);
  };
  const stairsAt=(x,z)=>stairs.filter(s=>contains(s,x,z));
  function getWalkHeight(x,z,currentFootY=0){
    if(!finite(x)||!finite(z)||!finite(currentFootY)||!contains(bounds,x,z))return null;
    // A reachable stair wins over the lower solid beneath it. Never teleport
    // to another storey merely because its floor shares the same X/Z point.
    const candidates=[];
    for(const s of stairsAt(x,z)){const h=stairHeight(s,x,z);if(Math.abs(h-currentFootY)<=maxStep+epsilon)candidates.push({h,priority:0});}
    for(const r of surfaces)if(contains(r,x,z)){const h=r.y??0;if(Math.abs(h-currentFootY)<=maxStep+epsilon)candidates.push({h,priority:1});}
    candidates.sort((a,b)=>a.priority-b.priority||Math.abs(a.h-currentFootY)-Math.abs(b.h-currentFootY));
    return candidates[0]?.h??null;
  }
  function supportedAt(x,z,footY){
    return surfaces.some(r=>contains(r,x,z)&&Math.abs((r.y??0)-footY)<=.18+epsilon)||stairsAt(x,z).some(s=>Math.abs(stairHeight(s,x,z)-footY)<=.18+epsilon);
  }
  function canStand(x,z,footY){
    const h=getWalkHeight(x,z,footY);if(h===null||Math.abs(h-footY)>.025)return false;
    // Union support permits seams/landings, but stops stepping off any edge.
    for(let i=0;i<12;i++){const angle=i*Math.PI/6;if(!supportedAt(x+Math.cos(angle)*radius,z+Math.sin(angle)*radius,footY))return false;}
    for(const s of stairsAt(x,z)){const tread=stairHeight(s,x,z);if(tread>footY+maxStep&&tread-.18<footY+bodyHeight+.08)return false;}
    const bodyBottom=footY+.08,bodyTop=footY+bodyHeight;
    for(const b of blockers){
      if((b.maxY??Infinity)<=bodyBottom||(b.minY??0)>=bodyTop)continue;
      // A stair tread is support, not a wall: the walking envelope can rise
      // over one reachable riser while its centre crosses the tread nose.
      if(b.supportSurface && Number.isFinite(b.maxY) && b.maxY<=footY+maxStep+epsilon)continue;
      const nx=Math.max(b.minX,Math.min(x,b.maxX)),nz=Math.max(b.minZ,Math.min(z,b.maxZ));
      if((x-nx)**2+(z-nz)**2<radius*radius-epsilon)return false;
    }
    return true;
  }
  function describe(position,moved,blocked=false){
    const h=position.y-eyeHeight,s=stairsAt(position.x,position.z).find(s=>Math.abs(stairHeight(s,position.x,position.z)-h)<.03);
    const onDais=ceremonyRects.some(r=>contains(r,position.x,position.z)&&Math.abs((r.y??0)-h)<.03),floor=h>=upperY-.03?2:1;
    return{moved,blocked,floor,height:h,footY:h,onStairs:!!s,onDais,surface:s?'stairs':onDais?'dais':floor===2?'upper':h<-.1?'terrace':h>.18?'landing':'ground'};
  }
  function step(position,dx,dz){
    if(!position||!finite(position.x)||!finite(position.y)||!finite(position.z))throw new TypeError('step requires a finite camera-eye position');
    if(!finite(dx)||!finite(dz)||Math.hypot(dx,dz)>10)return describe(position,false,true);
    const length=Math.hypot(dx,dz);if(length<epsilon)return describe(position,false);
    const pieces=Math.max(1,Math.ceil(length/.08)),sx=dx/pieces,sz=dz/pieces;let moved=false,blocked=false;
    const tryMove=(mx,mz)=>{if(Math.abs(mx)+Math.abs(mz)<epsilon)return false;const x=position.x+mx,z=position.z+mz,y=getWalkHeight(x,z,position.y-eyeHeight);if(y===null||!canStand(x,z,y))return false;position.x=x;position.y=y+eyeHeight;position.z=z;moved=true;return true;};
    for(let i=0;i<pieces;i++){if(tryMove(sx,sz))continue;blocked=true;if(Math.abs(sx)>=Math.abs(sz)){tryMove(sx,0);tryMove(0,sz);}else{tryMove(0,sz);tryMove(sx,0);}}
    return describe(position,moved,blocked);
  }
  const lower=(architecture.stairs??[]).find(s=>s.staircaseId==='south'&&Math.abs(s.bottomY??0)<.01)??architecture.stairs?.[0];
  const stairSpawn=lower?.axis==='x'?[(lower.bottomX??lower.maxX)+1.3,(lower.bottomY??0)+eyeHeight,(lower.minZ+lower.maxZ)/2]:[15,eyeHeight,22];
  const spawns={ground:[13.7*planScale,eyeHeight,0],upper:[15.8*planScale,upperY+eyeHeight,0],stairs:stairSpawn,...(architecture.walkSpawns??{}),...(entrance?{entrance:[...(entrance.spawn??[41,eyeHeight-3.6,0])]}:{}),...(ceremonial?.standingExit?{throne:[...ceremonial.standingExit]}:{})};
  for(const [name,p] of Object.entries(spawns))if(!canStand(p[0],p[2],p[1]-eyeHeight))throw new Error(`Navigation spawn '${name}' conflicts with current geometry`);
  return{getWalkHeight,canStand,step,describe,stairHeight,spawns,eyeHeight,radius,upperY,bounds,groundRects,landingRects,surfaces,stairs,ceremonyRects};
}
