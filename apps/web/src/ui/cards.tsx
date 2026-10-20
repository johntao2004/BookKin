// 共享卡片适配层把样式约定传给统一 UI，避免业务页面重复基础外观。
// Shared card adapter forwards styling conventions to unified UI instead of duplicating base appearance in pages.
import AntCard from "antd/es/card";
import { mergeClassNames, sxClassName, useTheme, type BoxProps } from "./primitives";

export function Card({ sx, className, children, ...props }: BoxProps & { elevation?: number }) {
  return <AntCard {...props} className={mergeClassNames("bk-card", sxClassName(sx, useTheme()), className)} styles={{ body: { padding: 0 } }}>{children}</AntCard>;
}
