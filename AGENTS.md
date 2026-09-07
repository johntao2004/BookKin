# BookKin 仓库协作规范

本文件对整个仓库生效；子目录中的 `AGENTS.md` 只能增加约束，不能放宽本文件。

## 不可偏移的产品边界

- V1 只支持 EPUB、PDF；不要引入有声书、漫画、OCR、邮件、OAuth 或 MFA。
- 这是原创产品。不得复制 BookOrbit、Claude 或其他项目的代码、素材、品牌标记和页面布局。
- 阅读位置、书签、划线和笔记按用户隔离，默认不可被主人或管理员查看。
- 成员不得修改 NAS 原文件；主人和管理员可执行受控写操作，永久清理仅主人可执行。

- 注册默认关闭；主人可在安全设置开启。自行注册只能创建 MEMBER，服务端必须执行注册策略、密码验证与频率限制。

## 设计系统

- `design/tokens.json` 是颜色、间距、圆角、字号和阴影数值的唯一来源。
- 不得在 React 组件或 CSS 中新增未命名的十六进制颜色、间距、圆角或阴影。
- 修改 Token 后必须运行 `pnpm generate:tokens`，并同步检查 Figma 变量。
- Ant Design 组件应通过 `apps/web/src/theme/theme.ts` 与 `apps/web/src/ui/` 统一定制；业务页面不得局部重写品牌基础样式。
- 界面使用暖色编辑出版风格、克制珊瑚强调色、稀少阴影和真实封面素材。

## Java 模块边界

- 模块位于 `io.github.johntao2004.bookkin.<module>`：`auth`、`users`、`catalog`、`ingestion`、`filemanagement`、`reading`、`annotations`、`audit`。
- 模块之间只能通过公开 application service、事件或明确标记为模块网关的 public Repository 协作；不得访问其他模块的 Controller、包私有类型或绕过网关自行改写其表。
- 现有 `BookRepository`、`UserRepository`、`LibraryRootRepository` 是模块间查询/命令网关。新增跨模块依赖优先增加窄接口，禁止把 jOOQ `Record` 暴露到模块外。
- Controller 只做协议转换和权限入口；事务规则位于 application service；文件系统访问位于 file-management infrastructure。
- 数据库变更只能由 Flyway 迁移完成；已发布迁移不可修改，只能追加。

## NAS 文件安全

- 任何写操作必须经过预览并持有 `expectedFingerprint` 与幂等键。
- 禁止静默覆盖；禁止直接拼接用户路径；禁止跳过根目录、软链接和保留名称检查。
- 禁止在扫描任务中自动重命名、移动、删除或写回文件。
- 跨根目录移动必须复制到暂存区、刷盘、校验 SHA-256、验证可解析、正式落位，再把源文件移入回收站。
- 写回前必须创建版本；失败必须恢复上一版本并写审计记录。
- 新增文件变更路径时，必须同时添加失败恢复、幂等、冲突和路径逃逸测试。

## 上传与元数据

- EPUB/PDF 必须先流式写入根目录 `.bookkin-staging/uploads`，解析和人工确认后才能进入正式目录；不得把整个文件读入 Java 堆。
- 原书、上传暂存和封面二进制不存 PostgreSQL；持久封面仅存 `.bookkin-assets/covers` 路径、哈希与来源。
- 主人和管理员必须能从现有书籍卡片或详情页直接上传 JPEG、PNG、WebP 自定义封面；上传前显示 2:3 裁切预览，完成后必须立即刷新所有封面消费页面。
- 字段级 `MANUAL` 来源是扫描和在线补全的覆盖边界；后续文件变化只能产生候选值，不得覆盖人工值。
- 完全相同的 SHA-256 文件不得重复入库；标题/作者相似只可警告，不可自动合并。
- Flyway 初始化不得预置书籍；本地演示初始化只保留 4 本且封面不得重复，不得把白底 PDF 首页预览当作默认书籍封面，也不得预置阅读进度、阅读时长、书签、划线或笔记。
- 网络补全失败不得阻断本地校对和入库；服务端下载候选封面必须校验主机白名单、MIME、大小和像素上限。

## 验证

- 前端提交前运行 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`。
- 后端提交前从 `apps/server` 运行 `./mvnw verify`。
- 构建成功不等于交互正确；影响用户流程的改动还必须在浏览器验证关键路径和控制台。
- 本地 API/Worker 必须通过 `pnpm start:local` 以不可变 JAR 快照运行；禁止直接运行 `target/bookkin-*.jar`，避免 Maven 构建覆盖正在被 JVM 懒加载的归档。
