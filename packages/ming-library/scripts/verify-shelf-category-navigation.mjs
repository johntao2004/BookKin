import assert from 'node:assert/strict';
import { CATEGORIES, createShelfLayout } from '../src/shelves-v2.js';
import { shelfCategories, shelfCategoryPose } from '../src/shelf-category-navigation.js';
import { createMingLibrary } from '../src/library.js';
import { createCameraCollision } from '../src/camera-collision.js';

const racks = createShelfLayout(1.2);
const categories = shelfCategories(racks);

assert.equal(categories.length, 6, 'the real layout exposes its six distinct shelf categories');
assert.deepEqual(categories.map(item => item.label), CATEGORIES, 'category order follows the real rack layout');
assert.deepEqual(categories.map(item => item.id), CATEGORIES);
for (const item of categories) {
  assert.ok(item.rackIds.length > 0, `${item.label} has real rack IDs`);
  assert.ok(item.rackIds.every(id => racks.some(rack => rack.id === id && rack.category === item.label)));
}

// The navigation source is the furniture layout, so an empty book collection
// does not remove its real shelf categories.
const emptyBooks = [];
const emptyCatalogLibrary = { books: emptyBooks, furniture: { racks } };
assert.deepEqual(emptyCatalogLibrary.books, []);
assert.deepEqual(shelfCategories(emptyCatalogLibrary.furniture.racks).map(item => item.id), CATEGORIES);

const historyRacks = racks.filter(rack => rack.category === '历史');
assert.ok(historyRacks.length > 1, 'the real layout repeats categories across shelves');
const historyPose = shelfCategoryPose(historyRacks, '历史');
assert.ok(historyPose);
assert.equal(historyPose.category, '历史');
assert.ok(historyRacks.some(rack => rack.id === historyPose.shelfId));

const floorTwo = racks.find(rack => rack.floor === 2 && rack.category === '文学');
const floorOne = racks.find(rack => rack.floor === 1 && rack.category === '文学');
assert.ok(floorTwo && floorOne);
const preferredFloorPose = shelfCategoryPose([floorTwo, floorOne], '文学');
assert.equal(preferredFloorPose.floor, 1, 'floor 1 is preferred even when floor 2 appears first');
assert.equal(preferredFloorPose.shelfId, floorOne.id);

const singleRack = [floorOne];
const safeCalls = [];
const backSidePose = shelfCategoryPose(singleRack, '文学', {
  isSafe(position, target) {
    safeCalls.push({ position, target });
    return safeCalls.length === 2;
  },
});
assert.ok(backSidePose, 'the second side is tried when the front candidate is rejected');
assert.equal(safeCalls.length, 2);
assert.deepEqual(safeCalls[0].target, safeCalls[1].target);
const normalX = Math.sin(floorOne.rotationY);
const normalZ = Math.cos(floorOne.rotationY);
const expectedDistance = floorOne.depth / 2 + 2.2;
assert.ok(Math.abs(backSidePose.position[0] - (floorOne.position[0] - normalX * expectedDistance)) < 1e-10);
assert.ok(Math.abs(backSidePose.position[2] - (floorOne.position[2] - normalZ * expectedDistance)) < 1e-10);

let rejectedCandidates = 0;
assert.equal(shelfCategoryPose(singleRack, '文学', {
  isSafe() { rejectedCandidates += 1; return false; },
}), null);
assert.equal(rejectedCandidates, 2, 'both sides are checked before returning null');

const twoFirstFloorRacks = historyRacks.filter(rack => rack.floor === 1).slice(0, 2);
assert.equal(twoFirstFloorRacks.length, 2);
let crossShelfCalls = 0;
const nextShelfPose = shelfCategoryPose(twoFirstFloorRacks, '历史', {
  isSafe() { crossShelfCalls += 1; return crossShelfCalls === 3; },
});
assert.equal(crossShelfCalls, 3, 'both sides of one rack are exhausted before trying the next');
assert.equal(nextShelfPose.shelfId, twoFirstFloorRacks[1].id);

const secondFloorOnlyPose = shelfCategoryPose([floorTwo], '文学');
assert.ok(secondFloorOnlyPose);
assert.equal(secondFloorOnlyPose.floor, 2);
assert.ok(Math.abs(secondFloorOnlyPose.position[1] - (floorTwo.position[1] + 1.6)) < 1e-10);
assert.ok(Math.abs(secondFloorOnlyPose.target[1] - (floorTwo.position[1] + floorTwo.height / 2)) < 1e-10);
assert.deepEqual(secondFloorOnlyPose.target, [floorTwo.position[0], floorTwo.position[1] + floorTwo.height / 2, floorTwo.position[2]]);

assert.deepEqual(shelfCategories(null), []);
assert.deepEqual(shelfCategories({}), []);
assert.deepEqual(shelfCategories([
  { id: 'blank', category: '   ', position: [0, 0, 0] },
  { id: 'infinite', category: '无效', position: [0, Infinity, 0] },
  { id: 'nan', category: '无效', position: [0, Number.NaN, 0] },
  { id: 'malformed', category: '无效', position: [0, 0] },
]), []);
assert.equal(shelfCategoryPose(null, '文学'), null);
assert.equal(shelfCategoryPose(racks, '不存在'), null);
assert.equal(shelfCategoryPose([{ ...floorOne, position: [0, Infinity, 0] }], '文学'), null);
assert.equal(shelfCategoryPose([{ ...floorOne, rotationY: Infinity }], '文学'), null);

const library = createMingLibrary();
const collision = createCameraCollision({ library, radius: .20, groundY: -3.6 });
for (const category of shelfCategories(library.furniture.racks)) {
  const pose = shelfCategoryPose(library.furniture.racks, category.id, {
    isSafe: position => collision.isSafe(position, { radius: .28, ignoreInvisible: false }),
  });
  assert.ok(pose, `${category.label} has a safe endpoint in the actual building`);
  assert.ok(collision.isSafe(pose.position, { radius: .28, ignoreInvisible: false }));
}
console.log('PASS shelf categories, candidate fallback and actual-building camera clearance');
