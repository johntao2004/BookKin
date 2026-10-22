export { default as TreeSelect } from "antd/es/tree-select";
export { default as Tabs } from "antd/es/tabs";
export { default as Skeleton } from "antd/es/skeleton";
export { default as Dropdown } from "antd/es/dropdown";
export { default as ConfigProvider } from "antd/es/config-provider";
export { default as Form } from "antd/es/form";
export { default as Input } from "antd/es/input";
export { default as QRCode } from "antd/es/qr-code";

import { ActionButton as AntButton } from "./action-button";
import AntInput from "antd/es/input";
import AntList from "antd/es/list";
import AntTable, { type TableProps } from "antd/es/table";
import { tablePaginationDefaults } from "./table-pagination";
import AntRadio from "antd/es/radio";
import AntSwitch from "antd/es/switch";
import AntSlider from "antd/es/slider";
import AntProgress from "antd/es/progress";
import AntAvatar from "antd/es/avatar";
import AntCard from "antd/es/card";
import AntDrawer from "antd/es/drawer";
import type { ComponentProps } from "react";

export {
  AntInput as _AntInput,
  AntRadio as _AntRadio,
  AntSwitch as _AntSwitch,
  AntSlider as _AntSlider,
  AntProgress as _AntProgress,
  AntAvatar as _AntAvatar,
  AntCard as _AntCard,
  AntDrawer as _AntDrawer,
  AntList as _AntList,
  AntTable as _AntTable,
};

export function DataTable<RecordType extends object = Record<string, unknown>>({ pagination, ...props }: TableProps<RecordType>) {
  return <AntTable<RecordType> {...props} pagination={pagination === false ? false : { ...tablePaginationDefaults, ...pagination }} />;
}
export function TableAction(props: ComponentProps<typeof AntButton>) {
  return <AntButton {...props} type="default" size="small" />;
}

// 为组合探索界面保留原生控件入口。
// Native controls for composed exploration surfaces.
export { default as _AntAlert } from "antd/es/alert";
export { ActionButton as _AntButton } from "./action-button";
export { default as Empty } from "antd/es/empty";
export { default as Pagination } from "antd/es/pagination";
export { default as Tag } from "antd/es/tag";
