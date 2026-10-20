// 现状图 Y2.001 的标高注释，以米计，相对于地面层或台基。顶棚构造厚度为估计；完成面标高并非顶棚底面标高。
/** Existing-condition Y2.001 level annotations, metres relative to GF/podium.
 * Ceiling build-up is an estimate; finished-floor annotations are not soffit levels. */
export const WEST_SURVEY_LEVELS = {ground:-0.8,first:4.58,second:10.07} as const;
export const WEST_LEVELS = {
  landing:5.4,
  // 保留现有 2 厘米通行适配，同时维持资料标高。
  // Preserve the existing 2 cm circulation adaptation while retaining source levels.
  secondFloor:WEST_SURVEY_LEVELS.second-WEST_SURVEY_LEVELS.ground+0.02,
  ceiling:10.45,
  estimatedFloorBuildUp:0.44,
  frieze:5.15,
} as const;
