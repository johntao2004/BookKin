import AntCard from "antd/es/card";
import { mergeClassNames, sxClassName, useTheme, type BoxProps } from "./primitives";

export function Card({ sx, className, children, ...props }: BoxProps & { elevation?: number }) {
  return <AntCard {...props} className={mergeClassNames("bk-card", sxClassName(sx, useTheme()), className)} styles={{ body: { padding: 0 } }}>{children}</AntCard>;
}
