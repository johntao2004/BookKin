export const VIRTUAL_LIBRARY_LAYOUT = {
  reception: {
    centerZ: 0,
    radius: 2.15,
    countertop: {
      surfaceY: 1.245,
      inspectionAngle: Math.PI / 2,
      bookStackAngle: Math.PI * 0.28,
      lampAngle: Math.PI * 0.14,
    },
  },
  sidePortals: {
    outerWidth: 3.92,
    outerHeight: 5.24,
    innerWidth: 3.54,
    innerHeight: 4.94,
    openingWidth: 3.2,
    openingHeight: 4.72,
    thresholdWidth: 4.08,
    sconceOffset: 2.24,
    sconceY: 3.18,
  },
} as const;
