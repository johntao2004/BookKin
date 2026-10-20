import { readFileSync } from 'node:fs';
import { getReferenceStairExitView } from './reference-library-view';
import { REFERENCE_LIBRARY as R } from './virtual-library-model/hogwartsLibraryLayout';

const config = JSON.parse(readFileSync('public/assets/hogwarts-library/scene-config.json', 'utf8'));

describe('guided reference-library stair exits', () => {
  it('follows the supported northbound tangent from both upper stair landings', () => {
    expect(getReferenceStairExitView(config.stairRoutes.left, 'left').yaw)
      .toBeCloseTo(0, 8);
    expect(getReferenceStairExitView(config.stairRoutes.right, 'right').yaw)
      .toBeCloseTo(0, 8);
  });

  it('keeps both lower exits facing away from the stairs into the hall', () => {
    for (const side of ['left', 'right'] as const) {
      const route = [...config.stairRoutes[side]].reverse();
      const view = getReferenceStairExitView(route, side, R.galleryY);
      const end = route.at(-1)!;
      const previous = route.at(-2)!;
      const expectedYaw = Math.atan2(previous.x - end.x, previous.z - end.z);
      expect(view.pitch).toBe(0);
      expect(view.yaw).toBeCloseTo(expectedYaw, 8);
      expect(Math.sign(view.yaw)).toBe(side === 'left' ? 1 : -1);
    }
  });
});
