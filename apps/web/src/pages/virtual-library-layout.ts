// 共享接待台与侧门的建模尺寸；调用路径决定是否使用这些布局值，不代表当前主模型全部采用。
// Shares reception/side-portal dimensions; consumers determine their use, not every value necessarily belongs to the active main model.
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
