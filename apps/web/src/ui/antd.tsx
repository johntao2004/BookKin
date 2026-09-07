export { default as Tabs } from "antd/es/tabs";
export { default as Skeleton } from "antd/es/skeleton";
export { default as Dropdown } from "antd/es/dropdown";
export { default as ConfigProvider } from "antd/es/config-provider";
export { default as Form } from "antd/es/form";
export { default as Input } from "antd/es/input";

import AntButton from "antd/es/button";
import AntInput from "antd/es/input";
import AntList from "antd/es/list";
import AntTable from "antd/es/table";
import AntRadio from "antd/es/radio";
import AntSwitch from "antd/es/switch";
import AntSlider from "antd/es/slider";
import AntProgress from "antd/es/progress";
import AntAvatar from "antd/es/avatar";
import AntCard from "antd/es/card";
import AntModal from "antd/es/modal";
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
  AntModal as _AntModal,
  AntDrawer as _AntDrawer,
  AntList as _AntList,
  AntTable as _AntTable,
};

export { AntTable as DataTable };
export function TableAction(props: ComponentProps<typeof AntButton>) {
  return <AntButton {...props} type="link" size="small" style={{ padding: 0, height: "auto" }} />;
}
