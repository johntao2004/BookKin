// 真实书卡与骨架共用响应式列规则，宽屏稀疏结果也保留空轨道。
// Real cards and skeletons share responsive grid columns, preserving empty tracks for sparse wide-screen results.
import { tokens } from "../theme/generated-tokens";

const gridGaps = { xs: 2, sm: 3, md: 4 } as const;

export const bookGridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "repeat(2, minmax(0, 1fr))",
    sm: "repeat(3, minmax(0, 1fr))",
    md: "repeat(4, minmax(0, 1fr))",
    lg: "repeat(6, minmax(0, 1fr))",
    xl: `repeat(auto-fill, minmax(min(100%, ${tokens.layout.bookCardMinWidth}px), 1fr))`,
  },
  gap: gridGaps,
} as const;

// 文章保留目录页的响应式间距，在宽屏上按文章卡片的横向封面比例增加列数。
// Article cards reuse catalog spacing and add columns on wide screens to fit their landscape covers.
export const articleGridSx = {
  ...bookGridSx,
  gridTemplateColumns: {
    xs: "minmax(0, 1fr)",
    sm: "repeat(2, minmax(0, 1fr))",
    md: "repeat(3, minmax(0, 1fr))",
    xl: `repeat(auto-fill, minmax(min(100%, ${tokens.layout.bookCardMinWidth * 2}px), 1fr))`,
  },
} as const;
