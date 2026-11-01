import {PALACE_PLAN_SCALE as PLAN} from './design-v12.js';

const plain=o=>o&&(Array.isArray(o)||Object.getPrototypeOf(o)===Object.prototype);
const pointNames=/^(position|center|origin|pivot|anchor|bottomBearing|topBearing|spawn|entranceSpawn|ground|upper|stairs|entrance|throne)$/;
const pairNames=/^(a|b|start|end|upperFootprint|lowerFootprint|lowerCentreOpening)$/;
const dimensions=/^(width|depth|radius|shaftRadius|baseRadius|boreRadius|halfX|halfZ|halfWidth|halfDepth|innerHalfWidth|innerHalfDepth|ridgeHalfLength|ridgeLength|spanStart|spanEnd|u|at|half|bodyEndNormal|outerNormal|innerNormal|bracketCenterU|seatX|seatZ|overlapX|overlapZ|tenonDepth|visibleGap|tread|stepRun|landingDepth|clearWidth|stairClearWidth|stairWidth|atriumWidth|atriumDepth|facadeLength|entranceFacadeLength|entrancePassageWidth|doorOpeningWidth|doorLeafWidth|leafWidth|leafThickness|centerSeamWidth|doorCenterSeamWidth|openClearance|openGateClearance|walkingPlatformEndX|courtyardHalf|stairHalfWidth|x|z)$/;

/** Keep explicit collision, floor and joint metadata in the same metre space
 * as rendered geometry. Texture UVs, pixel quadrilaterals and counts are never
 * treated as coordinates. Shared records are transformed exactly once. */
export function expandPlanMetadata(root,{scale=PLAN,seen=new WeakSet(),skip=new WeakSet()}={}){
  function visit(value,key=''){
    if(!plain(value)||seen.has(value)||skip.has(value)||Object.isFrozen(value))return;
    seen.add(value);
    if(Array.isArray(value)){
      if(value.every(Number.isFinite)){
        if(value.length===3&&pointNames.test(key)){value[0]*=scale;value[2]*=scale;}
        else if(value.length===2&&pairNames.test(key)){value[0]*=scale;value[1]*=scale;}
        else if(/^(roofRafterStations|cofferX|cofferZ|x|z)$/.test(key))for(let i=0;i<value.length;i++)value[i]*=scale;
      }else for(const item of value)visit(item,key==='pivots'?'pivot':key);
      return;
    }
    for(const[name,item]of Object.entries(value)){
      if(Number.isFinite(item)){
        if(/^(groundArea|upperArea|forecourtArea)$/.test(name))value[name]=item*scale*scale;
        else if(dimensions.test(name)||/^(min|max|top|bottom|center|inner|outer|openingHalf|wall|column)[XZ]$/.test(name)||/^(upperWidth|upperDepth)$/.test(name))value[name]=item*scale;
      }else if(!/^(photoQuad|referencePixels|atlasRect|imageSize|quad|boundsPixels)$/.test(name))visit(item,name);
    }
  }
  visit(root);return seen;
}

export function expandArchitecturePlan(architecture){
  const root=architecture.group;root.position.x*=PLAN;root.position.z*=PLAN;root.scale.x*=PLAN;root.scale.z*=PLAN;
  root.traverse(object=>{
    if(object.isGroup&&object.userData.preservePlanProportions){object.scale.x/=PLAN;object.scale.z/=PLAN;}
  });
  const seen=expandPlanMetadata(architecture);
  root.traverse(object=>expandPlanMetadata(object.userData,{seen}));
  root.userData.planScale=PLAN;root.userData.version='15.0';root.updateMatrixWorld(true);
  return architecture;
}

export function expandEntrancePlan(entrance){
  const root=entrance.group;root.position.x*=PLAN;root.position.z*=PLAN;root.scale.x*=PLAN;root.scale.z*=PLAN;
  // Keep the photographed calligraphy and cloud frame's width/height ratio.
  // Its normal-depth and rear mounting brackets still reach the enlarged wall.
  if(entrance.plaqueGroup)entrance.plaqueGroup.scale.x/=PLAN;
  const skip=new WeakSet();
  const plaque=entrance.geometryMetadata?.plaque;
  if(plaque){skip.add(plaque);if(plaque.center){plaque.center[0]*=PLAN;plaque.center[2]*=PLAN;}}
  const seen=expandPlanMetadata(entrance,{skip});
  root.traverse(object=>{if(object===entrance.plaqueGroup||object.parent===entrance.plaqueGroup)return;expandPlanMetadata(object.userData,{seen,skip});});
  const upper=entrance.plinth?.metadata?.terraces?.[0];
  if(upper){
    entrance.geometryMetadata.forecourt={minX:24.2*PLAN,maxX:upper.halfX,minZ:-upper.halfZ,maxZ:upper.halfZ,y:0,rectangles:entrance.terraceSurfaces.filter(r=>r.y===0)};
    entrance.geometryMetadata.walkingPlatformEndX=upper.halfX;
    entrance.stats.forecourtArea=upper.halfX*upper.halfZ*4-48.4*66.4*PLAN*PLAN;
  }
  root.userData.planScale=PLAN;root.userData.version='15.0';root.updateMatrixWorld(true);
  entrance.gate?.setOpen(entrance.gate.isOpen);
  return entrance;
}
