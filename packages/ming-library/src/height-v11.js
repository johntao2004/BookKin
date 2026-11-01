/** The architectural setting-out uses one vertical transform, so internal
 * beams, external brackets, walls and roof remain on the same physical levels.
 * Furniture and books retain their human-scale dimensions. */
export const ARCHITECTURAL_HEIGHT_SCALE = 4 / 3;
export const UPPER_FLOOR_Y = 8.4;
export const COURTYARD_Y = -3.6;

function plain(value) {
  return value && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);
}

/** Scale ordinary construction metadata together with the rendered frame.
 * Three.js transforms/materials/geometries are deliberately not traversed. */
export function raiseMetadata(value, { scale = ARCHITECTURAL_HEIGHT_SCALE, skip = new WeakSet(), seen = new WeakSet() } = {}) {
  function visit(object, key = '') {
    if (!plain(object) || seen.has(object) || skip.has(object) || Object.isFrozen(object)) return;
    seen.add(object);
    if (Array.isArray(object)) {
      if(key==='rafterBottomAtEnds'){for(let i=0;i<object.length;i++)object[i]*=scale;return;}
      if (object.length === 3 && object.every(Number.isFinite) && /^(position|center|anchor|origin|pivot|bottomBearing|topBearing)$/.test(key)) object[1] *= scale;
      else for (const item of object) visit(item);
      return;
    }
    for (const [name, item] of Object.entries(object)) {
      if (Number.isFinite(item)) {
        const coordinate = name === 'y' || (/Y$/.test(name) && !/rotation|angle|yaw|scale|normal|direction/i.test(name));
        const distance = /^(height|rise|thicknessY)$/.test(name) || /Height$/.test(name);
        if (coordinate || distance) object[name] = item * scale;
      } else visit(item, name);
    }
  }
  visit(value);
  return seen;
}

export function raiseArchitecture(architecture) {
  const scale = ARCHITECTURAL_HEIGHT_SCALE;
  const spawns = architecture.walkSpawns;
  // Eye height is a human measurement, not an architectural one.
  const spawnCopies = spawns && Object.fromEntries(Object.entries(spawns).map(([key, p]) => [key, [p[0], (p[1] - 1.72) * scale + 1.72, p[2]]]));
  architecture.group.scale.y = scale;
  const groundFloor = architecture.group.getObjectByName('00_Ground_Stone_Floor');
  if (groundFloor) groundFloor.scale.y /= scale;
  architecture.group.traverse(object => {
    if (object.isGroup && object.userData.preservePhysicalHeight) object.scale.y /= scale;
    if (object.isInstancedMesh && object.userData.preserveInstanceProportions) {
      object.scale.y /= scale;
      const matrices=object.instanceMatrix.array;
      for (let i=0;i<object.count;i++) matrices[i*16+13] *= scale;
      object.instanceMatrix.needsUpdate=true;
      object.computeBoundingBox();object.computeBoundingSphere();
    }
  });
  const seen = raiseMetadata(architecture);
  const floorRecord=architecture.structuralParts?.find(part=>part.id==='ground-floor');
  if(floorRecord){floorRecord.minY=-.34;floorRecord.maxY=0;}
  architecture.group.traverse(object => raiseMetadata(object.userData, { seen }));
  if (spawnCopies) architecture.walkSpawns = spawnCopies;
  architecture.stats.floorHeight = UPPER_FLOOR_Y;
  for (const level of architecture.referenceCaisson?.levels ?? []) {
    if (Number.isFinite(level.bottom)) level.bottom *= scale;
    if (Number.isFinite(level.top)) level.top *= scale;
  }
  // The shell's declared thickness is its vertical separation, rather than
  // a universal normal offset on every differently inclined roof face.
  if (Number.isFinite(architecture.roofMetadata?.thickness)) architecture.roofMetadata.thickness *= scale;
  if (Number.isFinite(architecture.stats.roofThickness)) architecture.stats.roofThickness *= scale;
  architecture.group.userData.upperFloorY = UPPER_FLOOR_Y;
  architecture.group.userData.architecturalHeightScale = scale;
  architecture.group.updateMatrixWorld(true);
  return architecture;
}

export function raiseEntrance(entrance) {
  const scale = ARCHITECTURAL_HEIGHT_SCALE;
  entrance.group.scale.y = scale;
  // The stone stairs and handrails remain at their specified physical size.
  if (entrance.terraceGroup) entrance.terraceGroup.scale.y /= scale;
  // Preserve the reference calligraphy and curving frame's aspect ratio.
  if (entrance.plaqueGroup) entrance.plaqueGroup.scale.y /= scale;
  const skip = new WeakSet();
  const preserve = value => {
    if (!plain(value) || skip.has(value)) return;
    skip.add(value); for (const item of Object.values(value)) preserve(item);
  };
  preserve(entrance.plinth);
  for (const value of [entrance.plinth, entrance.groundRects, entrance.exteriorSteps, entrance.stairs, entrance.surfaceRects, entrance.edgeObstacles]) if (value && typeof value === 'object') skip.add(value);
  for (const b of entrance.obstacles ?? []) if (b.preservePhysicalHeight || /plinth|terrace|stone-platform|platform-edge|exterior-step/i.test((b.type ?? '') + ' ' + (b.id ?? ''))) skip.add(b);
  const plaque = entrance.geometryMetadata?.plaque;
  if (plaque) { const originalY=plaque.center?.[1]??12.9; preserve(plaque); if (plaque.center) plaque.center[1] *= scale; if (Number.isFinite(plaque.frameHighestY)) plaque.frameHighestY += originalY*(scale-1); }
  const metadata = entrance.geometryMetadata;
  if (metadata) for (const key of ['forecourt','exteriorSteps','terraces','plinth','surfaceRects']) if (metadata[key] && typeof metadata[key] === 'object') skip.add(metadata[key]);
  if (metadata && Number.isFinite(metadata.exteriorGroundY)) metadata.exteriorGroundY = COURTYARD_Y / scale;
  raiseMetadata(entrance, { skip });
  if (metadata) metadata.exteriorGroundY = COURTYARD_Y;
  entrance.group.updateMatrixWorld(true);
  entrance.gate?.setOpen(entrance.gate.isOpen);
  return entrance;
}
