const EYE_HEIGHT = 1.6;
const AISLE_CLEARANCE = 2.2;

function categoryName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finitePosition(position) {
  return Array.isArray(position)
    && position.length === 3
    && position.every(Number.isFinite);
}

function hasShelfId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * Return the distinct categories represented by real, positioned shelves.
 * Category order and rack ID order follow the supplied rack layout.
 */
export function shelfCategories(racks) {
  if (!Array.isArray(racks)) return [];

  const categories = new Map();
  for (const rack of racks) {
    if (!rack || !hasShelfId(rack.id) || !finitePosition(rack.position)) continue;
    const category = categoryName(rack.category);
    if (!category) continue;

    let entry = categories.get(category);
    if (!entry) {
      entry = { id: category, label: category, rackIds: [], rackIdSet: new Set() };
      categories.set(category, entry);
    }
    if (!entry.rackIdSet.has(rack.id)) {
      entry.rackIdSet.add(rack.id);
      entry.rackIds.push(rack.id);
    }
  }

  return [...categories.values()].map(({ id, label, rackIds }) => ({ id, label, rackIds }));
}

function canPoseFrom(rack) {
  return rack
    && hasShelfId(rack.id)
    && categoryName(rack.category)
    && finitePosition(rack.position)
    && Number.isFinite(rack.floor)
    && Number.isFinite(rack.rotationY)
    && Number.isFinite(rack.depth)
    && rack.depth >= 0;
}

/**
 * Find a safe, eye-level standing pose beside an existing shelf in a category.
 * All measurements use the library layout's world-coordinate units (metres).
 */
export function shelfCategoryPose(racks, category, options = {}) {
  const requestedCategory = categoryName(category);
  if (!requestedCategory || !Array.isArray(racks)) return null;

  const matches = racks.filter(rack => canPoseFrom(rack)
    && categoryName(rack.category) === requestedCategory);
  const ordered = [
    ...matches.filter(rack => rack.floor === 1),
    ...matches.filter(rack => rack.floor !== 1),
  ];
  const isSafe = typeof options?.isSafe === 'function' ? options.isSafe : null;

  for (const rack of ordered) {
    const [x, baseY, z] = rack.position;
    const normalX = Math.sin(rack.rotationY);
    const normalZ = Math.cos(rack.rotationY);
    const distance = rack.depth / 2 + AISLE_CLEARANCE;
    const height = baseY + EYE_HEIGHT;
    const targetHeight = Number.isFinite(rack.height) && rack.height > 0 ? rack.height / 2 : EYE_HEIGHT;
    const target = [x, baseY + targetHeight, z];

    for (const side of [1, -1]) {
      const position = [
        x + normalX * distance * side,
        height,
        z + normalZ * distance * side,
      ];
      let safe = true;
      if (isSafe) {
        try {
          safe = Boolean(isSafe([...position], [...target]));
        } catch {
          safe = false;
        }
      }
      if (safe) {
        return {
          category: requestedCategory,
          shelfId: rack.id,
          floor: rack.floor,
          position,
          target,
        };
      }
    }
  }

  return null;
}
