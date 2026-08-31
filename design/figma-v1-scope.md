# Figma V1 范围锁定

## Token 集

- Primitives：19 个颜色原语。
- Semantic Color：19 个语义色，Light 模式；V1 阅读器深色通过语义 dark surface 表达，不建立全应用暗色模式。
- Spacing：0、4、8、12、16、20、24、32、40、48、64、80、96。
- Radius：0、6、8、12、16、24、pill。
- Typography：Display 60/48/36/28、Title 22/18、Body 16/14、Caption 12。
- Effects：Focus、Cover、Popover。

## 组件集

第一批可复用组件：Button、Text Field、Status Chip、Book Card、Navigation Item、Data Row、Dialog Header、Operation Step、Reader Toolbar。

## 页面

- Auth：登录、首次改密、主人初始化。
- Users：用户列表、创建用户、重置密码、禁用确认。
- Library：藏书画廊、搜索/筛选、图书详情。
- File Management：操作菜单、批量重命名预览、冲突、任务进度、回收站、版本恢复。
- Reader：EPUB、PDF、划线与笔记侧栏。
- Responsive：1440、1024、390 三类代表帧。

## 代码映射

| Figma | React/MUI | Token |
|---|---|---|
| Button | `BookKinButton` / MUI Button override | color/primary, radius/md, spacing |
| Text Field | `BookKinTextField` / MUI TextField override | color/surface, border, focus |
| Book Card | `BookCard` | radius/lg, shadow/cover |
| Status Chip | `StatusChip` | semantic status colors |
| Operation Preview | `OperationPreviewDialog` | Dialog + DataTable |

新文件不存在代码/Figma冲突。若可用 Material 库组件 API 与本地 Token/交互不兼容，保留 MUI 作为代码基础，Figma 组件本地自建并按映射命名。

## 当前同步状态

- Figma 文件：[BookKin · 电子图书馆 V1](https://www.figma.com/design/zRtcdgwQ0yRMpeTHMV9hox)
- 已写入：5 个变量集合、73 个变量、9 个文本样式、3 个效果样式。
- 待验证：Starter 套餐触发 MCP 调用上限后，`P1.g`/`P1.h` 尚未执行；恢复额度后从 Phase 1 验证继续，不得直接进入组件创建。
