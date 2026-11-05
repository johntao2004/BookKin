# Silvae 明式书楼模型

来源：用户云端 Sites「观文藏阁 · 明代宫殿图书馆」，应用版本 2.14.0、第 16 次发布，Git 提交 `76c77a6027918bbd86240eda76211633ffae40e1`。

- `src/` 保留可编辑 Three.js 源码；42 个原始源文件保持字节一致，`app.js` 仅增加本地宿主接入与阅读视角恢复，新增 `silvae-host.js` 连接真实目录。
- 原始 Three.js 0.180.0 单独锁定，避免与 Silvae 其他功能依赖的版本互相影响。
- 13 张无损 WebP 建筑/天空贴图与字体位于 `apps/web/public/assets/ming-library/assets`；贴图逐文件 SHA-256 与云端源码一致。
- 完整云端原始检出保存在忽略目录 `.local/cloud-ming-latest`；替换前本地场景和未提交改动位于 `.local/backups/ming-replacement-20261026`。这些本机恢复路径不进入发布包。

## 构建与验证

在仓库根目录运行：

```sh
pnpm install
pnpm generate:tokens
pnpm build:ming-library
pnpm --filter @silvae/ming-library verify:interaction
pnpm start:preview
```

主构建 `pnpm build` 自动重建此模型；实际页面仍为 `/virtual-library`。构建输出同源静态页面及带内容哈希的脚本，React 入口延迟载入它。原有模型源文件和测试保留供当前未提交工作恢复，已不参与活动场景入口。

底部入口按场景实际书架的分类去重生成，替代建筑视角预设列表；空馆藏仍可定位分类书架。每次定位先验证完整场景中的相机净空，再沿用安全视角切换；分类入口不改写书籍的 Thema 资料或阅读状态。目录面板不显示书目和三维陈列数量摘要。

## 宿主接入

宿主使用原有 `refreshVirtualLibraryBooks` 完整分页快照及修订轮询，通过同源、同 frame 校验后的消息交给 `GuanwenLibrary.ready` / `setBooks` / `updateBook`。每个可访问、可用的书籍 ID 只生成一册；空目录为零册。初始化不构建任何演示书；数据失败不回退到演示数据。

传入 `id`、`title`、`author`、同源 `coverUrl`、学科分类 `category`、`description`、阅读 `readUrl`。服务端未提供实体页数和尺寸，不将模型默认的厚度估算展示为真实页数或实体尺寸。NAS 路径、文件指纹及私人阅读记录不传入模型。

同一 ID 集合只对变更字段调用 `updateBook`，增删书目时完整重排；排架失败保留最后成功集合并显示错误。模型每批上限 16,384 条且受书架实际容量限制，不静默截断更大的业务目录。

封面、书脊和选书使用真实业务 ID。阅读入口由宿主校验当前目录成员后导航到 `/reader/:bookId`，阅读器返回时用内存中的路由状态恢复经碰撞检查的场景视角。左上返回回到书库。导入 JSON、恢复演示和会话内临时编辑入口关闭，持久修改仍通过原书籍详情/元信息页面。

界面数值归入 `design/tokens.json` 的 `mingLibrary.interface`，经共享生成器输出；矩形圆角使用现有共享 Token。字体、纹理及第三方许可见本目录 notices/licenses 和 `docs/ming-library/`。
