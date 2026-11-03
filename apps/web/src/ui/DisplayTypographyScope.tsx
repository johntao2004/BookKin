import ConfigProvider from "antd/es/config-provider";
import type { ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";

const displayTheme = { token: { fontFamily: tokens.typography.fontFamily.display } };
const displayPopup = { classNames: { popup: { root: "bk-display-typography" } } };

/** Keeps field text and portalled choices in the same display typeface. */
export function DisplayTypographyScope({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={displayTheme} select={displayPopup} treeSelect={displayPopup} datePicker={displayPopup}>
    <div className="bk-display-typography">{children}</div>
  </ConfigProvider>;
}
