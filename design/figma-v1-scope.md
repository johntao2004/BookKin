# Figma V1 范围锁定

## Token 集

- Primitives：24 个颜色原语。
- Semantic Color：19 个语义色，代码以 Paper、Bright、Night 覆盖全站；Figma 模式同步仍待验证。
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
- File Management：操作菜单、批量重命名预览、冲突、任务进度、回收站、恢复；元数据写回仅有事务内临时回滚，不提供历史版本浏览。
- Reader：EPUB、PDF、划线与笔记、字体上传和全站主题。
- Virtual Library：原创哥特式圆厅、天球查询入口、独立档案室与办公室。
- Responsive：1440、1024、390 三类代表帧。

## 代码映射

| Figma | React/Ant Design | Token |
|---|---|---|
| Button | `Button` / Ant Design Button adaptation | color/primary, radius/md, spacing |
| Text Field | `TextField` / Ant Design Input adaptation | color/surface/input, border, focus |
| Book Card | `BookCard` | radius/lg, shadow/cover |
| Status Chip | `Chip` | semantic status colors |
| Operation Preview | `OperationPreviewDialog` | Dialog + DataTable |

代码为当前实现依据，不能据历史同步记录宣称 Figma 与现有页面完全一致。若 Ant Design 组件 API 与本地 Token/交互不兼容，优先在 `apps/web/src/ui/` 做窄适配，Figma 组件本地自建并按映射命名。

## 当前同步状态

- Figma 文件：[BookKin · 电子图书馆 V1](https://www.figma.com/design/zRtcdgwQ0yRMpeTHMV9hox)
- 历史记录（本轮未重新验证远端）：5 个变量集合、73 个变量、9 个文本样式、3 个效果样式。
- 待验证：Starter 套餐触发 MCP 调用上限后，`P1.g`/`P1.h` 尚未执行；恢复额度后从 Phase 1 验证继续，不得直接进入组件创建。
- 2026-10-08 上次布局变量核对：关联文件现有 75 个变量，未找到名称包含 `content`、`layout`、`width`、`reading` 或 `max` 的变量；该项为历史远端核对，本次未重新检查 Figma。
- 2026-10-08 后续共享外框 gutter 对齐步骤仅调整代码布局规则，复用现有 `spacing[3]` / `spacing[6]` 固定 12px / 24px gutter 并移除 `pageWidthSx` 最大宽度限制；该步骤未修改 Token 数值或新增变量。此前本轮已将兼容保留的 `design/tokens.json` `layout.contentMax` 从 1024 更新为 1280，并运行 `pnpm generate:tokens` / `pnpm check:tokens`。布局变量缺失依据上次 75 变量历史核对记录，本次不声称已同步 Figma。

### 2026-09-09 表单表面色同步

已读取远端表面色变量并新增 `color/surface/input`（VariableID:12:2，引用 surface/soft）和 `color/surface/card`（VariableID:12:3，引用 surface/default）。代码新增 surfaceInput，并分别处理纸张、明亮、夜间主题；本次仅同步基础变量，未宣称所有 Figma 页面和主题模式完成重建。
