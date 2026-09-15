import {createServiceWalk} from './longRoomServiceWalk';
import { fagelWalkPoint, FAGEL_WALK_LENGTH } from './longRoomFagelWalk';
import * as THREE from 'three';
import { optimizeStaticMeshes } from './optimizeScene';
import { LONG_ROOM, LONG_ROOM_BAY_PITCH, TRINITY_MEASURED_DIMENSIONS, galleryWalkPoint, GALLERY_WALK_LENGTH, longRoomBayZ,
  HISTORIC_SPIRAL, HISTORIC_SPIRAL_ACCESS_LENGTH, EAST_GALLERY_CONNECTION, LONG_ROOM_LIVE_SHELF_SECTION_COUNT,
  LONG_ROOM_FRONTMOST_CASE, LONG_ROOM_STAIR_ADJACENT_CASE, LONG_ROOM_STAIR_ALCOVE,
  longRoomLiveCatalogFace, longRoomLiveCatalogSectionIndex } from '../longRoomLayout';
import { buildLongRoom, buildLongRoomProgressively, createLongRoomVault, longRoomRoofY,
  LONG_ROOM_CATALOG_BOOKS_PER_ROW, LONG_ROOM_CATALOG_BOOK_SIZE, LONG_ROOM_SHELF_BOARD_THICKNESS,
  longRoomShelfBoardY } from './longRoom';
import { createLibraryMaterials } from './materials';
import { collectCameraColliders, resolveCameraCollision } from '../../virtual-library-collision';
import { henryJonesWalkPoint,HENRY_JONES_WALK_LENGTH } from './longRoomWestWalk';
import { shouldRenderLongRoomShelfFaceMarks, shouldRenderLongRoomShelfMarks } from './longRoomShelfMarks';

vi.mock('./materials', () => ({
  createLibraryMaterials: () => Object.fromEntries(['stone', 'stoneDark', 'wood', 'woodDark', 'woodWarm', 'floor',
    'rug', 'brass', 'iron', 'leather', 'parchment', 'glass', 'lampGlass'].map(key => [key, new THREE.MeshStandardMaterial()])),
}));

beforeEach(() => vi.spyOn(THREE.TextureLoader.prototype, 'load').mockReturnValue(new THREE.Texture()));
afterEach(() => vi.restoreAllMocks());

describe('Long Room historical reference assembly', () => {
  it('omits every removed window-end double reading stand from the live hall', () => {
    const built = buildLongRoom(0, new THREE.TextureLoader());
    const removedFurniture: string[] = [];
    built.root.traverse(object => {
      if (object.name.includes('Reading stand') || object.name.includes('double reading stand')) {
        removedFurniture.push(object.name);
      }
    });
    expect(removedFurniture).toEqual([]);
    expect(collectCameraColliders(built.root, 'hall').some(collider => collider.id.startsWith('window-lectern-'))).toBe(false);
  });

  it('blocks the projecting aisle pilasters and walls after batching', () => {
    const built = buildLongRoom(0, new THREE.TextureLoader());
    optimizeStaticMeshes(built.root, built.interactiveObjects);
    const colliders = collectCameraColliders(built.root, 'hall');
    const z = LONG_ROOM.length / 2 - LONG_ROOM.endMargin - 2 * LONG_ROOM_BAY_PITCH;
    for (const side of [-1, 1]) {
      const x = side * LONG_ROOM.aisleHalfWidth;
      const result = resolveCameraCollision({ x: x - side, y: 1.65, z }, { x: x + side, y: 1.65, z }, colliders);
      expect(result.blockedBy).toContain('long-room-pilaster');
      expect(side * result.x).toBeLessThan(LONG_ROOM.aisleHalfWidth - 0.5);
      const wall = resolveCameraCollision({x: side * 10, y: 2, z: z + 1.5},
        {x: side * 15, y: 2, z: z + 1.5}, colliders);
      expect(wall.blocked).toBe(true);
      expect(Math.abs(wall.x)).toBeLessThan(LONG_ROOM.width / 2);
    }
  });

  it('preserves collision after mesh batching and allows the complete stair and gallery route', () => {
    const built = buildLongRoom(120, new THREE.TextureLoader(), true);
    const firstCase = built.shelfSections.find(section => section.id === 0)!;
    const occupiedRows = new Set(built.bookSlots.filter(slot => slot.sectionId === 0).map(slot => slot.rowIndex));
    expect(built.bookSlots).toHaveLength(120);
    expect(occupiedRows.size).toBe(firstCase.shelfCount);
    expect(Math.max(...occupiedRows)).toBe(firstCase.shelfCount - 1);
    expect(firstCase.shelfCount).toBe(6);
    expect(LONG_ROOM_CATALOG_BOOKS_PER_ROW).toBe(20);
    const firstLowerCase = built.root.children.find(child => (
      child.name.startsWith('Transverse oak case') && child.name.endsWith(':0')
    ))!;
    expect(firstLowerCase.children.filter(child => child.name === 'Continuous shelf board')).toHaveLength(6);
    for (const slot of built.bookSlots.filter(item => item.sectionId === firstCase.id)) {
      expect(slot.scale.toArray()).toEqual([
        LONG_ROOM_CATALOG_BOOK_SIZE.spineWidth,
        LONG_ROOM_CATALOG_BOOK_SIZE.height,
        LONG_ROOM_CATALOG_BOOK_SIZE.coverWidth,
      ]);
      expect(slot.position.y - slot.scale.y / 2).toBeCloseTo(
        longRoomShelfBoardY(slot.rowIndex, LONG_ROOM.lowerCaseHeight)
          + LONG_ROOM_SHELF_BOARD_THICKNESS / 2,
      );
    }
    expect(built.root.getObjectByName('Walkable gallery access stair')).toBeUndefined();
    expect(built.root.getObjectByName('Long Room pierced iron alcove stair study')).toBeDefined();
    expect(built.root.getObjectByName('West pavilion stair topology study')).toBeUndefined();
    expect(built.root.getObjectByName('East solid-parapet return stair study')).toBeUndefined();
    built.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(built.root);
    expect(bounds.min.y).toBeGreaterThan(-0.5);
    const westBalusters=built.root.getObjectByName('West crosswalk turned balusters') as THREE.InstancedMesh;
    expect(built.root.getObjectByName('Crosswalk baluster')).toBeUndefined();
    westBalusters.geometry.computeBoundingBox();const placement=new THREE.Matrix4();westBalusters.getMatrixAt(0,placement);
    const memberBounds=westBalusters.geometry.boundingBox!.clone().applyMatrix4(placement);
    expect(memberBounds.min.y).toBeCloseTo(LONG_ROOM.galleryY+.17,4);
    expect(memberBounds.max.y).toBeCloseTo(LONG_ROOM.galleryY+.985,4);
    const liveBuilt = buildLongRoom(0, new THREE.TextureLoader());
    liveBuilt.root.updateMatrixWorld(true);
    const liveColliders = collectCameraColliders(liveBuilt.root, 'hall');
    const sx=HISTORIC_SPIRAL.x,sz=HISTORIC_SPIRAL.z,half=HISTORIC_SPIRAL.opening/2,eyeY=LONG_ROOM.galleryY+1.65;
    // The opening's visible perimeter blocks side entry, but its landing admits a person.
    for(const [x,z,dx,dz] of [[sx-half,sz,1,0],[sx,sz-half,0,1],[sx,sz+half,0,1],
      [sx+half,sz+0.85,-1,0],[sx+half,sz-0.85,-1,0]]) {
      const blocked=resolveCameraCollision({x:x-dx*0.45,y:eyeY,z:z-dz*0.45},{x:x+dx*0.45,y:eyeY,z:z+dz*0.45},liveColliders);
      expect(blocked.blockedBy).toMatch(/^spiral-opening-guard-/);
    }
    const doorway=resolveCameraCollision({x:sx+0.6,y:eyeY,z:sz},{x:sx+1.6,y:eyeY,z:sz},liveColliders);
    expect(doorway.blocked).toBe(false);
    for (const side of [-1, 1]) {
      const galleryRail = resolveCameraCollision(
        {x: side * 6.3, y: eyeY, z: EAST_GALLERY_CONNECTION.center},
        {x: side * 5.3, y: eyeY, z: EAST_GALLERY_CONNECTION.center},
        liveColliders,
      );
      expect(galleryRail.blockedBy).toMatch(/^gallery-guard-/);
    }
    optimizeStaticMeshes(liveBuilt.root, liveBuilt.interactiveObjects);
    const optimizedLiveColliders = collectCameraColliders(liveBuilt.root, 'hall');
    expect([...optimizedLiveColliders].sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual([...liveColliders].sort((a, b) => a.id.localeCompare(b.id)));

    const before = collectCameraColliders(built.root, 'hall');
    optimizeStaticMeshes(built.root, built.interactiveObjects);
    const serviceWalk=createServiceWalk(built.root.getObjectByName('East first to second floor service core')!.userData.walkingSamples);
    const colliders = collectCameraColliders(built.root, 'hall');
    // Static batching must preserve LOD ownership and identical book placement.
    built.root.updateMatrixWorld(true);
    const detailClusters: THREE.LOD[] = [];
    built.root.traverse(object => { if (object instanceof THREE.LOD) detailClusters.push(object); });
    expect(detailClusters.length).toBeGreaterThan(10);
    const camera = new THREE.PerspectiveCamera();
    for (const lod of detailClusters) {
      const [near, far] = lod.levels.map(level => level.object);
      const nearBooks = near.children.filter(object => object.name === 'Historical collection scenery volumes') as THREE.InstancedMesh[];
      const farBooks = far.children as THREE.InstancedMesh[];
      expect(nearBooks).toHaveLength(4); expect(farBooks).toHaveLength(4);
      for (let variant = 0; variant < 4; variant++) {
        expect(nearBooks[variant].count).toBe(farBooks[variant].count);
        expect(nearBooks[variant].instanceMatrix).toBe(farBooks[variant].instanceMatrix);
        expect(nearBooks[variant].boundingSphere).toEqual(farBooks[variant].boundingSphere);
        expect(nearBooks[variant].boundingSphere!.isEmpty()).toBe(false);
        expect(nearBooks[variant].matrixWorld.elements).toEqual(farBooks[variant].matrixWorld.elements);
        expect(farBooks[variant].geometry.index!.count).toBeLessThan(nearBooks[variant].geometry.index!.count);
      }
      camera.position.copy(lod.position).add(new THREE.Vector3(0, 0, 2)); camera.updateMatrixWorld(); lod.update(camera);
      expect(near.visible).toBe(true); expect(far.visible).toBe(false);
      camera.position.copy(lod.position).add(new THREE.Vector3(0, 0, 50)); camera.updateMatrixWorld(); lod.update(camera);
      expect(near.visible).toBe(false); expect(far.visible).toBe(true);
    }
    expect([...colliders].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...before].sort((a, b) => a.id.localeCompare(b.id)));
    for (const [length,pointAt,routeColliders] of [
      [HISTORIC_SPIRAL_ACCESS_LENGTH,galleryWalkPoint,optimizedLiveColliders],
      [HENRY_JONES_WALK_LENGTH,henryJonesWalkPoint,colliders],
      [serviceWalk.length,serviceWalk.pointAt,colliders],
    ] as const) for (const reverse of [false, true]) {
      let previous: {x: number; y: number; z: number} | null = null;
      for (let travelled = 0; travelled <= length; travelled += 0.2) {
        const point = pointAt(reverse ? length - travelled : travelled);
        const eye = {...point, y: point.y + 1.65};
        const resolved = resolveCameraCollision(previous ?? eye, eye, routeColliders);
        expect(Math.hypot(resolved.x - eye.x, resolved.y - eye.y, resolved.z - eye.z), `blocked route ${travelled} reverse=${reverse} by ${resolved.blockedBy}`).toBeLessThan(0.01);
        previous = eye;
      }
    }
    for (const y of [1.65, LONG_ROOM.galleryY + 1.65]) {
      const resolved = resolveCameraCollision({x: 9, y, z: 39}, {x: 9, y, z: 44}, colliders);
      expect(resolved.blocked).toBe(true);
      expect(resolved.z).toBeLessThan(43.35 - 0.5);
    }
  });

  it('yields to queued browser work and stops construction when navigation aborts', async () => {
    const controller = new AbortController();
    const slices = vi.fn();
    let slicesAtNavigation=0;
    const navigation = setTimeout(() => {
      slicesAtNavigation=slices.mock.calls.length;
      controller.abort();
    }, 0);
    await expect(buildLongRoomProgressively(4, new THREE.TextureLoader(), controller.signal, slices))
      .rejects.toMatchObject({name: 'AbortError'});
    clearTimeout(navigation);
    expect(slicesAtNavigation).toBeGreaterThan(0);
    // Cheap stages may share a task; cancellation must prevent any further work.
    expect(slices).toHaveBeenCalledTimes(slicesAtNavigation);
  });
  it('retains the source dimensions separately from the requested larger architectural envelope', () => {
    expect(TRINITY_MEASURED_DIMENSIONS).toEqual({length: 63.7, width: 12.2, height: 14.2});
    expect(LONG_ROOM.length).toBe(90);
    expect(LONG_ROOM.width).toBe(22.3);
    expect(LONG_ROOM.height).toBe(18.45);
    const vault = createLongRoomVault(createLibraryMaterials());
    const shell = vault.getObjectByName('Continuous oak barrel lining')!;
    const box = new THREE.Box3().setFromObject(shell);
    expect(box.max.y).toBeCloseTo(18.45, 4);
    expect(box.max.z - box.min.z).toBeCloseTo(90, 4);
    expect(box.max.x - box.min.x).toBeCloseTo(LONG_ROOM.vaultRadius * 2, 4);
    const sideVaults = vault.children.filter(child => child.name === 'Upper alcove intersecting barrel vault');
    expect(sideVaults).toHaveLength(40);
    const beads = vault.children.filter(child => child.name === 'Rounded upper alcove arch bead') as THREE.Mesh[];
    expect(beads).toHaveLength(40);
    expect(new Set(beads.map(bead => bead.geometry)).size).toBe(1);
    vault.updateMatrixWorld(true);
    for (const side of [-1, 1]) for (let bay = 0; bay < 20; bay++) {
      const ray = new THREE.Raycaster(new THREE.Vector3(side * 9, 9, longRoomBayZ(bay)), new THREE.Vector3(0, 1, 0));
      const hit = ray.intersectObjects(sideVaults)[0];
      expect(hit).toBeDefined(); expect(hit.point.y).toBeCloseTo(LONG_ROOM.vaultSpring + LONG_ROOM_BAY_PITCH / 2, 4);
    }
    // Trace across the barrel/lunette junction: neither a gap nor the old low
    // central barrel may cover the raised side-arch crown.
    for(const side of [-1,1])for(const offset of [0,0.5,1]) {
      const rise=Math.sqrt((LONG_ROOM_BAY_PITCH/2)**2-offset**2);
      const seam=Math.sqrt(LONG_ROOM.vaultRadius**2-rise**2);
      for(const dx of [-0.08,0,0.08]) {
        const x=side*(seam+dx),z=longRoomBayZ(8)+offset;
        const ray=new THREE.Raycaster(new THREE.Vector3(x,9,z),new THREE.Vector3(0,1,0));
        const hit=ray.intersectObjects([shell,...sideVaults])[0];
        expect(hit,`missing barrel junction ${x},${z}`).toBeDefined();
        expect(hit.point.y).toBeCloseTo(Math.max(longRoomRoofY(x),LONG_ROOM.vaultSpring+rise),1);
      }
    }
    expect(longRoomRoofY(0)).toBeCloseTo(18.45);
    expect(longRoomRoofY(9.15)).toBeCloseTo(LONG_ROOM.vaultSpring);
  });

  it('builds straight two-level alcoves, real catalog reservations and closed room boundaries', () => {
    const built = buildLongRoom(4, new THREE.TextureLoader(), true);
    expect(built.shelfSections).toHaveLength(40);
    const capitalCores: THREE.Mesh[] = [], shafts: THREE.Mesh[] = [];
    built.root.traverse(object => {
      if (object instanceof THREE.Mesh && object.name === 'Capital carving core'
        && Math.abs(Math.abs(object.parent!.position.x) - LONG_ROOM.aisleHalfWidth) < 0.001) capitalCores.push(object);
      if (object instanceof THREE.Mesh && object.name === 'Oak pilaster with rounded recessed flutes') shafts.push(object);
    });
    expect(capitalCores).toHaveLength(80);
    expect(new Set(capitalCores.map(mesh => mesh.geometry)).size).toBe(1);
    expect(shafts).toHaveLength(80);
    expect(new Set(shafts.map(mesh => mesh.geometry)).size).toBe(2);
    expect(new Set(shafts.map(mesh => mesh.position.toArray().join(':'))).size).toBe(80);
    built.root.updateMatrixWorld(true);
    for (const side of [-1, 1]) for (const level of [0, 1]) {
      const backboards: THREE.BufferGeometry[] = [];
      for (let bay = 0; bay < 20; bay++) {
        const cabinet = built.root.getObjectByName(`Transverse oak case ${side}:${bay}:${level}`)!;
        const board = cabinet.getObjectByName('Bookcase fitted backboard') as THREE.Mesh;
        backboards.push(board.geometry);
        const bounds = new THREE.Box3().setFromObject(cabinet);
        const expectedZ = LONG_ROOM.length / 2 - LONG_ROOM.endMargin - bay * LONG_ROOM_BAY_PITCH;
        expect((bounds.min.z + bounds.max.z) / 2).toBeCloseTo(expectedZ, 5);
        const descriptors = cabinet.userData.cameraColliderDescriptors;
        expect(descriptors[0].id).toBe(`long-room-case-${side}-${bay}-${level}`);
        expect(descriptors[0].center.z + cabinet.position.z).toBeCloseTo(expectedZ, 5);
      }
      expect(new Set(backboards).size).toBe(1);
    }


    expect(built.bookSlots).toHaveLength(4);
    expect(built.root.children.some(child => child.userData.sitter)).toBe(false);
    const wallLamps=built.root.children.filter(child => child.name === 'Curved brass and glass wall lamp');
    expect(wallLamps).toHaveLength(18);
    expect(wallLamps.some(lamp => lamp.userData.side === LONG_ROOM_STAIR_ALCOVE.side
      && lamp.userData.bay === LONG_ROOM_STAIR_ALCOVE.bay)).toBe(false);
    // Window geometry is shared within a build without flattening its detailed joinery.
    for(const side of [-1,1]) {
      const windows=built.root.children.filter(child=>child.name===`Paired Long Room window detail ${side}`);
      expect(windows).toHaveLength(LONG_ROOM.alcovesPerSide);
      const reference:THREE.Mesh[]=[];windows[0].traverse(o=>{if(o instanceof THREE.Mesh)reference.push(o);});
      for(const [bay,window] of windows.entries()) {
        expect(window.position.z).toBeCloseTo(longRoomBayZ(bay));
        const meshes:THREE.Mesh[]=[];window.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
        expect(meshes).toHaveLength(reference.length);
        meshes.forEach((mesh,index)=>{expect(mesh.geometry).toBe(reference[index].geometry);expect(mesh.material).toBe(reference[index].material);});
      }
    }
    expect(built.bookSlots.every(slot => slot.sectionId === 0)).toBe(true);
    const section = built.shelfSections.find(item => item.id === 0)!;
    expect(section.centerZ).toBeLessThan(40);
    expect(section.centerX).toBeLessThan(-LONG_ROOM.aisleHalfWidth);
    expect(built.root.children.filter(child => child.name.startsWith('Transverse oak case'))).toHaveLength(80);
    expect(built.root.children.filter(child => child.name === 'Continuous straight upper gallery')).toHaveLength(2);
    built.root.updateMatrixWorld(true);
    const spiral = built.root.getObjectByName('Long Room pierced iron alcove stair study')!;
    expect(spiral.userData.placement).toContain('south-entry-alcove');
    expect(spiral.position.x + HISTORIC_SPIRAL.diameter / 2).toBeCloseTo(-LONG_ROOM.aisleHalfWidth);
    expect(spiral.position.z).toBeCloseTo(longRoomBayZ(LONG_ROOM_STAIR_ALCOVE.bay));
    expect(spiral.userData.height).toBe(LONG_ROOM.galleryY);
    expect(built.root.children.filter(child => child.name === 'Iron stair opening guard')).toHaveLength(7);
    const galleries = built.root.children.filter(child => child.name === 'Continuous straight upper gallery');
    const stairApertureRay = new THREE.Raycaster(new THREE.Vector3(HISTORIC_SPIRAL.x, LONG_ROOM.galleryY + 0.2, HISTORIC_SPIRAL.z), new THREE.Vector3(0, -1, 0));
    expect(stairApertureRay.intersectObjects(galleries, true)).toHaveLength(0);
    const brackets = built.root.getObjectByName('Upper shelf timber support brackets') as THREE.InstancedMesh;
    brackets.geometry.computeBoundingBox();
    const bracketTransform = new THREE.Matrix4();
    for (let index = 0; index < brackets.count; index++) {
      brackets.getMatrixAt(index, bracketTransform);
      const bounds = brackets.geometry.boundingBox!.clone().applyMatrix4(bracketTransform);
      expect(bounds.min.y).toBeGreaterThan(LONG_ROOM.galleryY);
      expect(Math.min(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeGreaterThan(LONG_ROOM.aisleHalfWidth);
      expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThan(LONG_ROOM.width / 2);
    }

    const floorParts = built.root.children.filter(child => child.name === 'Continuous Long Room timber floor');
    const holeRay = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0));
    expect(holeRay.intersectObjects(floorParts)[0]?.point.y).toBeCloseTo(0);
    expect(built.root.getObjectByName('Central descending visitor stair')).toBeUndefined();
    holeRay.set(new THREE.Vector3(3, 2, 0), new THREE.Vector3(0, -1, 0));
    expect(holeRay.intersectObjects(floorParts).length).toBeGreaterThan(0);
    // A cut floor must not restart or stretch its wood pattern at the join.
    holeRay.set(new THREE.Vector3(3, 2, 2.499), new THREE.Vector3(0, -1, 0));
    const beforeJoin = holeRay.intersectObjects(floorParts)[0].uv!;
    holeRay.set(new THREE.Vector3(3, 2, 2.501), new THREE.Vector3(0, -1, 0));
    const afterJoin = holeRay.intersectObjects(floorParts)[0].uv!;
    expect(beforeJoin.x).toBeCloseTo(afterJoin.x, 5);
    expect(afterJoin.y - beforeJoin.y).toBeCloseTo(0.002 / 4.8, 5);
    // Every point on the circulation route must have a physical tread, landing or floor below it.
    const supports = [...floorParts, ...built.root.children.filter(child => child.name === 'Continuous straight upper gallery'),
      built.root.getObjectByName('East gallery doorway connection')!, built.root.getObjectByName('East upper Early Printed Books room')!, built.root.getObjectByName('Gallery end crossing')!, built.root.getObjectByName('Long Room pierced iron alcove stair study')!, built.root.getObjectByName('Iron stair upper landing')!];
    for (let distance = 0; distance <= GALLERY_WALK_LENGTH; distance += 0.2) {
      const point = galleryWalkPoint(distance);
      holeRay.set(new THREE.Vector3(point.x, point.y + 0.3, point.z), new THREE.Vector3(0, -1, 0));
      const hit = holeRay.intersectObjects(supports, true)[0];
      expect(hit, `unsupported route at ${distance}`).toBeDefined();
      expect(hit.distance).toBeLessThan(0.55);
    }
    expect(galleryWalkPoint(GALLERY_WALK_LENGTH).y).toBe(EAST_GALLERY_CONNECTION.upperFloor);
    expect(LONG_ROOM.aisleHalfWidth + 0.15 - LONG_ROOM.galleryInnerX).toBeGreaterThan(1.3);
    const shadowLight = built.root.getObjectByName('Window daylight with architectural shadows') as THREE.DirectionalLight;
    expect(shadowLight.castShadow).toBe(true);
    expect(shadowLight.shadow.autoUpdate).toBe(false);
    const colliders = collectCameraColliders(built.root, 'hall');
    const stairCollision = resolveCameraCollision({x: 3, y: 2, z: 0}, {x: 0, y: 2, z: 0}, colliders);
    expect(stairCollision.blocked).toBe(false);
    expect(colliders.some(collider => collider.shape === 'radial-boundary')).toBe(false);
    const collision = resolveCameraCollision({x: 0, y: 2, z: 43}, {x: 0, y: 2, z: 48}, colliders);
    expect(collision.blocked).toBe(false);
    expect(collision.z).toBeCloseTo(48,4);
    const fagelFloors:THREE.Object3D[]=[];
    built.root.traverse(object=>{if(['Continuous Long Room timber floor','Fagel room floor','East circulation floor'].includes(object.name))fagelFloors.push(object);});
    for(const reverse of [false,true]) {
      let previous:ReturnType<typeof fagelWalkPoint>|null=null;
      for(let d=0;d<=FAGEL_WALK_LENGTH;d+=0.08) {
        const p=fagelWalkPoint(reverse?FAGEL_WALK_LENGTH-d:d),eye={...p,y:1.65};
        const safe=resolveCameraCollision(previous??eye,eye,colliders);
        expect(safe.blocked,`blocked Fagel route at ${d}: ${safe.blockedBy}`).toBe(false);
        const floorRay=new THREE.Raycaster(new THREE.Vector3(p.x,0.2,p.z),new THREE.Vector3(0,-1,0),0,0.5);
        const floor=floorRay.intersectObjects(fagelFloors,false).find(hit=>hit.object instanceof THREE.Mesh);
        expect(floor?.point.y,`unsupported Fagel route ${d}`).toBeCloseTo(0,3);
        previous=eye;
      }
    }
    const east = built.root.getObjectByName('East entrance and paired arched niches')!;
    for (const name of ['East circulation ceiling', 'East circulation north wall']) {
      const behindWall = new THREE.Box3().setFromObject(east.getObjectByName(name)!);
      expect(behindWall.min.z).toBeGreaterThan(LONG_ROOM.length / 2 + 0.05);
    }
    const endFace = east.getObjectByName('East end wall with seven real openings')!;
    for (const x of [-3.25, 0, 3.25]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 2, LONG_ROOM.length / 2 - 1), new THREE.Vector3(0, 0, 1));
      expect(ray.intersectObject(endFace)).toHaveLength(0);
    }
    for (const x of [-2.1, -1.8, 1.8, 2.1]) for (const y of [0.5, 2.5, 3.2, 4]) {
      const solidRay = new THREE.Raycaster(new THREE.Vector3(x, y, LONG_ROOM.length / 2 - 1), new THREE.Vector3(0, 0, 1));
      expect(solidRay.intersectObject(endFace), `unintended end-wall hole ${x}:${y}`).not.toHaveLength(0);
    }
    const axisRay = new THREE.Raycaster(new THREE.Vector3(0, 2, LONG_ROOM.length / 2 - 1), new THREE.Vector3(0, 0, 1), 0, 4.2);
    expect(axisRay.intersectObject(east, true)).toHaveLength(0);
    expect(built.root.getObjectByName('East Fagel screened threshold study')).toBeUndefined();
    const west = built.root.getObjectByName('West entrance and paired arched niches')!;
    expect(west.getObjectByName('East vestibule floor')).toBeUndefined();
    const westJoinery = west.getObjectByName('West proportioned lower joinery')!;
    expect(westJoinery.children.filter(child => child.name === 'Open west connection study door leaf')).toHaveLength(2);
    expect(west.getObjectByName('West door meeting stile')).toBeUndefined();
    expect(westJoinery.children.filter(child => child.name === 'Recessed arched niche backing')).toHaveLength(2);
    for (const end of [east, west]) {
      const lower = end.getObjectByName(`${end === east ? 'East' : 'West'} proportioned lower joinery`)!;
      const shafts = lower.children.filter(child => child.name.endsWith('carved end pilaster shaft')) as THREE.Mesh[];
      expect(shafts).toHaveLength(4);
      for (const shaft of shafts) {
        const depthAt = (x: number) => {
          const origin = shaft.localToWorld(new THREE.Vector3(x, 0, 0.5));
          const direction = new THREE.Vector3(0, 0, -1).transformDirection(shaft.matrixWorld);
          return new THREE.Raycaster(origin, direction).intersectObject(shaft)[0]?.distance;
        };
        // Real hollows must remain deeper than the adjacent wood, with the
        // carved face oriented into the hall at both ends.
        expect(depthAt(0)).toBeGreaterThan(depthAt(0.0285)! + 0.01);
      }
      const niche = lower.getObjectByName('Recessed arched niche backing')!;
      const nicheBounds = new THREE.Box3().setFromObject(niche);
      expect(nicheBounds.max.y - 5.25 * LONG_ROOM.galleryY / 8.3).toBeCloseTo((nicheBounds.max.x - nicheBounds.min.x) / 2, 2);
      for (const name of ['Recessed arched niche backing', 'East upper central inset panel']) {
        const feature = lower.getObjectByName(name);
        if (feature) expect(new THREE.Box3().setFromObject(feature).max.y).toBeLessThan(LONG_ROOM.galleryY - 0.2);
      }
    }
    expect(west.getObjectByName('West triangular pediment tympanum')).toBeUndefined();
    expect(new THREE.Box3().setFromObject(west.getObjectByName('West upper triangular pediment')!).min.y).toBeGreaterThan(LONG_ROOM.galleryY);
    for(const [end,sign] of [[east,1],[west,-1]] as const) {
      for(const x of [-3.25,3.25]) {
        const ray=new THREE.Raycaster(new THREE.Vector3(x,8,sign*44.8),new THREE.Vector3(0,0,sign));
        const hit=ray.intersectObject(end,true)[0];
        expect(hit.object.name).toBe('Upper recessed arched niche backing');
        expect(Math.abs(hit.point.z)).toBeCloseTo(45.32,2);
      }
    }
    const westRay = new THREE.Raycaster(new THREE.Vector3(0, 2, -44), new THREE.Vector3(0, 0, -1));
    expect(westRay.intersectObject(west, true)).toHaveLength(0);
    for (const x of [-1.1, 1.1]) {
      westRay.set(new THREE.Vector3(x, 2, -44), new THREE.Vector3(0, 0, -1));
      expect(westRay.intersectObject(west, true)[0].object.name).toBe('West door raised panel');
    }
    const westCollision = resolveCameraCollision({x: 0, y: 1.65, z: -43.5}, {x: 0, y: 1.65, z: -46.5}, colliders);
    expect(westCollision.blocked).toBe(false);
    const walls = built.root.children.filter(child => child.name === 'Long exterior wall');
    expect(walls).toHaveLength(2);
    for (const wall of walls) {
      const side = Math.sign(wall.position.x);
      for (let bay = 0; bay < LONG_ROOM.alcovesPerSide; bay++) {
        const z = longRoomBayZ(bay);
        for (const y of [2, 9.5]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(side * 8, y, z), new THREE.Vector3(side, 0, 0));
          expect(ray.intersectObject(wall, true), `closed aperture ${side}:${bay}:${y}`).toHaveLength(0);
        }
        const pierRay = new THREE.Raycaster(new THREE.Vector3(side * 8, 2, z + 1), new THREE.Vector3(side, 0, 0));
        const pier = pierRay.intersectObject(wall, true)[0];
        expect(pier).toBeDefined(); expect(pier.object.castShadow).toBe(true);
      }
    }
    built.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      expect(Number.isFinite(object.position.x + object.position.y + object.position.z)).toBe(true);
      object.geometry.dispose();
    });
  });
});


describe('live Long Room area removal', () => {
  it('omits retired areas and closes their entrances before and after batching', () => {
    const built = buildLongRoom(4);
    for (const name of ['East pavilion Fagel room and circulation', 'East first to second floor service core',
      'West upper open doorway leaf', 'West upper storage rooms', 'East gallery doorway connection']) {
      expect(built.root.getObjectByName(name), name).toBeUndefined();
    }
    expect(built.root.getObjectByName('West level passage without lower storey')).toBeDefined();
    const liveEastEnd = built.root.getObjectByName('East solid timber end wall')!;
    const liveWestEnd = built.root.getObjectByName('West solid timber end wall')!;
    expect(liveEastEnd).toBeDefined();
    expect(liveWestEnd).toBeDefined();
    expect(built.shelfSections).toHaveLength(LONG_ROOM_LIVE_SHELF_SECTION_COUNT);
    expect(LONG_ROOM_LIVE_SHELF_SECTION_COUNT).toBe(38);
    for (const omitted of [LONG_ROOM_STAIR_ALCOVE, LONG_ROOM_FRONTMOST_CASE]) {
      expect(built.shelfSections.some(section => section.id === omitted.sectionId)).toBe(false);
      expect(built.bookSlots.some(slot => slot.sectionId === omitted.sectionId)).toBe(false);
      expect(shouldRenderLongRoomShelfMarks(omitted.side, omitted.bay)).toBe(false);
      expect(shouldRenderLongRoomShelfMarks(omitted.side, omitted.bay, true)).toBe(true);
      for (const level of [0, 1]) {
        expect(built.root.getObjectByName(
          `Transverse oak case ${omitted.side}:${omitted.bay}:${level}`,
        )).toBeUndefined();
      }
    }
    expect(longRoomLiveCatalogSectionIndex(38)).toBe(36);
    const entranceWindow = built.root.children.find(child => child.name === 'Paired Long Room window detail 1'
      && Math.abs(child.position.z - longRoomBayZ(LONG_ROOM_FRONTMOST_CASE.bay)) < 0.001);
    expect(entranceWindow).toBeDefined();
    expect(built.root.getObjectByName('Gallery continuous entablature and rail')).toBeDefined();
    const entranceCaseLamps = built.root.children.filter(child => child.name === 'Curved brass and glass wall lamp'
      && child.userData.side === LONG_ROOM_FRONTMOST_CASE.side
      && child.userData.bay === LONG_ROOM_FRONTMOST_CASE.bay);
    expect(entranceCaseLamps).toHaveLength(0);
    const entranceCaseLadders = built.root.children.filter(child => child.userData.side === LONG_ROOM_FRONTMOST_CASE.side
      && child.userData.bay === LONG_ROOM_FRONTMOST_CASE.bay
      && child.userData.face === 1);
    expect(entranceCaseLadders).toHaveLength(0);
    const retainedInnerLadder = built.root.children.filter(child => child.userData.side === LONG_ROOM_FRONTMOST_CASE.side
      && child.userData.bay === LONG_ROOM_FRONTMOST_CASE.bay
      && child.userData.face === -1);
    expect(retainedInnerLadder).toHaveLength(1);
    for (const level of [0, 1]) {
      const adjacentCase = built.root.getObjectByName(
        `Transverse oak case ${LONG_ROOM_STAIR_ADJACENT_CASE.side}:${LONG_ROOM_STAIR_ADJACENT_CASE.bay}:${level}`,
      )!;
      expect(adjacentCase.userData.shelfFaces).toEqual([-1]);
      const boards = adjacentCase.children.filter(child => child.name === 'Continuous single-face shelf board');
      expect(boards).toHaveLength(LONG_ROOM.shelfRows);
      adjacentCase.updateWorldMatrix(true, true);
      for (const board of boards) {
        const bounds = new THREE.Box3().setFromObject(board);
        expect(bounds.max.z).toBeLessThanOrEqual(adjacentCase.position.z + 0.001);
      }
    }
    expect(shouldRenderLongRoomShelfFaceMarks(
      LONG_ROOM_STAIR_ADJACENT_CASE.side,
      LONG_ROOM_STAIR_ADJACENT_CASE.bay,
      LONG_ROOM_STAIR_ADJACENT_CASE.stairFace,
    )).toBe(false);
    expect(shouldRenderLongRoomShelfFaceMarks(
      LONG_ROOM_STAIR_ADJACENT_CASE.side,
      LONG_ROOM_STAIR_ADJACENT_CASE.bay,
      -1,
    )).toBe(true);
    expect(shouldRenderLongRoomShelfFaceMarks(
      LONG_ROOM_STAIR_ADJACENT_CASE.side,
      LONG_ROOM_STAIR_ADJACENT_CASE.bay,
      LONG_ROOM_STAIR_ADJACENT_CASE.stairFace,
      true,
    )).toBe(true);
    expect(longRoomLiveCatalogFace(
      LONG_ROOM_STAIR_ADJACENT_CASE.side,
      LONG_ROOM_STAIR_ADJACENT_CASE.bay,
    )).toBe(-1);
    expect(built.root.getObjectByName('East entrance and paired arched niches')).toBeUndefined();
    expect(built.root.getObjectByName('West entrance and paired arched niches')).toBeUndefined();
    for (const name of ['Closed east entrance door leaf', 'East upper central inset panel',
      'Open west connection study door leaf', 'West upper closed door', 'Recessed arched niche backing',
      'Upper recessed arched niche backing', 'West upper triangular pediment']) {
      expect(built.root.getObjectByName(name), name).toBeUndefined();
    }
    expect(built.bookSlots).toHaveLength(4);
    expect(built.bookSlots.every(slot => slot.scale.x >= 0.16)).toBe(true);
    let sceneryVolumes = 0;
    built.root.traverse(object => { if (object.userData.isHistoricalScenery) sceneryVolumes++; });
    expect(sceneryVolumes).toBe(0);
    const verifyClosures = () => {
      const colliders = collectCameraColliders(built.root, 'hall');
      for (const y of [1.65, LONG_ROOM.galleryY + 1.65]) {
        expect(resolveCameraCollision({x: 0, y, z: LONG_ROOM.length / 2 - 1},
          {x: 0, y, z: LONG_ROOM.length / 2 + 1}, colliders).blocked).toBe(true);
      }
      const y = LONG_ROOM.galleryY + 1.65;
      expect(resolveCameraCollision({x: 0, y, z: -LONG_ROOM.length / 2 + 1},
        {x: 0, y, z: -LONG_ROOM.length / 2 - 1}, colliders).blocked).toBe(true);
      for (const [end, sign] of [['East', 1], ['West', -1]] as const)
        for (const x of [-3.25, 0, 3.25]) for (const endY of [2, 8]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(x, endY, sign * (LONG_ROOM.length / 2 - 1)),
            new THREE.Vector3(0, 0, sign));
          expect(ray.intersectObject(built.root.getObjectByName(`${end} continuous timber end wall`)!),
            `unsealed ${end} end at ${x}:${endY}`).not.toHaveLength(0);
        }
    };
    verifyClosures();
    optimizeStaticMeshes(built.root, built.interactiveObjects);
    verifyClosures();
  });
});
