import { ARCHITECTURAL_HEIGHT_SCALE, UPPER_FLOOR_Y } from './height-v11.js';

/** V15 changes the upper storey's clear height, not the scale of its artwork,
 * joinery or roof. Builders shorten only long posts/window stiles; all upper
 * roof-bearing members and the complete roof/caisson move by one shared datum.
 * These helpers run before the existing 4/3 architectural height transform. */
export const UPPER_CEILING_Y_V15 = 16.40;
export const UPPER_TIER_DROP_Y_V15 = 2.72;
export const UPPER_TIER_DROP_LOCAL_V15 = UPPER_TIER_DROP_Y_V15 / ARCHITECTURAL_HEIGHT_SCALE;
export const upperLocalYV15 = originalY => originalY - UPPER_TIER_DROP_LOCAL_V15;
export const upperWorldYV15 = originalY => originalY - UPPER_TIER_DROP_Y_V15;

export const PALACE_HEIGHTS_V15 = Object.freeze({
  groundFloorY: 0,
  upperFloorY: UPPER_FLOOR_Y,
  lowerCeilingY: 6.08 * ARCHITECTURAL_HEIGHT_SCALE,
  upperCeilingY: UPPER_CEILING_Y_V15,
  lowerClearHeight: 6.08 * ARCHITECTURAL_HEIGHT_SCALE,
  upperClearHeight: UPPER_CEILING_Y_V15 - UPPER_FLOOR_Y,
  upperTierDropY: UPPER_TIER_DROP_Y_V15,
  lowerRoofInnerY: 7.25 * ARCHITECTURAL_HEIGHT_SCALE,
  upperWindowSillTopY: 7.10 * ARCHITECTURAL_HEIGHT_SCALE,
  policy: 'Fixed floors and lower eave; shorten tall shafts/windows; translate upper roof and joinery without rescaling',
});
