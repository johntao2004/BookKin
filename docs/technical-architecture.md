# BookKin 技术架构

## 1. 架构结论

BookKin 采用模块化单体：一个 Java 21/Spring Boot 4.1 构建产物，通过 `api` 与 `worker` Profile 分别运行。该形态保留单机 NAS 部署的低运维成本，同时把耗时扫描和文件事务从 HTTP 请求线程隔离。

```text
Browser ──HTTP/Range──> app(api) ──SQL──> PostgreSQL 18
                           │                 ▲
                           └──lease/journal──┤
NAS roots <──safe file transaction── worker ┘
```

原书、封面缓存、暂存区和回收站不存数据库。数据库只保存逻辑目录、索引、锚点、状态和审计事实。

## 2. 模块边界

| 模块 | 职责 | 不负责 |
|---|---|---|
| `auth` | Session、CSRF、登录限流、首次改密 | 用户列表与角色修改 |
| `users` | 用户生命周期、角色、禁用、临时密码 | 认证协议 |
| `catalog` | 书籍、文件、作者、系列、标签、搜索 | 扫描文件系统 |
| `ingestion` | 根目录能力检测、扫描、上传暂存、解析、在线候选和封面资产 | 未经确认自动整理原文件 |
| `filemanagement` | 预览、幂等任务、租约、移动、回收、直接覆盖写回 | 目录搜索 |
| `reading` | HTTP Range、EPUB/PDF 会话、阅读位置 | 批注内容 |
| `annotations` | 书签、划线、笔记与用户隔离 | 文件元数据写回 |
| `audit` | 不可变操作事实与安全事件 | 业务回滚 |

模块对外暴露 application service、事件或显式 public Repository 网关；jOOQ `Record`、Controller 和包私有实现不得跨模块传播。现有 `BookRepository`、`UserRepository`、`LibraryRootRepository` 作为窄查询/命令网关使用。

## 3. 数据模型与十万册策略

核心表：`app_users`、`library_roots`、`books`、`book_files`、`authors`、`book_authors`、`series`、`tags`、`book_tags`、`book_uploads`、`metadata_lookup_cache`、`book_cover_assets`、`reading_positions`、`annotations`、`file_operations`、`recycle_bin_entries`、`file_leases`、`audit_events`。旧部署中的 `file_versions` 仅用于兼容并清理既有记录，不再生成新版本，也不提供用户入口。

`annotations` 将语义类型（高亮、笔记、书签）与呈现样式（高亮、下划线、加粗）分开保存；“高亮并写笔记”使用 `NOTE + HIGHLIGHT`，并在 `color` 保存黄色、绿色、粉色、蓝色或橙色荧光笔预设，不破坏笔记语义。

笔记中心按 `user_id + book_id` 聚合，书籍入口使用 `max(updated_at) + book_id` 游标分页，避免全量拉取或受单页 500 条批注限制。单书详情和 DOCX/XLSX 导出必须再次绑定当前 `user_id`；管理员没有跨用户导出接口。DOCX 采用章节式阅读摘录布局并保留高亮、下划线、加粗语义，XLSX 包含概览与可筛选的结构化明细，日期写为真实日期单元格。

- 主键使用 UUID；数据库与应用分别使用 `gen_random_uuid()` 和 `UUID.randomUUID()`。如果压测显示随机主键写放大成为瓶颈，再通过 ADR 迁移到单调 UUID。
- 藏书列表使用 `(sort_key, id)` 游标，不使用深页 OFFSET。
- `pg_trgm` GIN 索引覆盖标题、主作者、作者、系列和标签；游标键、关系键与指纹使用 B-tree。
- 当前扫描按书库根目录顺序遍历；快速指纹未变化时只更新本次扫描标记，变化时才计算 SHA-256、解析元数据和封面。`batch-size` 用于进度日志，不冒充可恢复的文件级 checkpoint。
- `book_files` 的 `(library_root_id, normalized_path)` 唯一；扫描通过稳定路径与指纹合并，不直接删除缺失记录。中断后可安全重跑整次扫描。
- 10 万册/15 万文件基准数据由 `scripts/benchmark/seed-large-catalog.sql` 生成。

### 3.1 上传、识别与来源保护

```text
RECEIVING → INSPECTING → ENRICHING → READY_FOR_REVIEW → COMMITTING → SUCCEEDED
       ↘ CANCELLED/EXPIRED       ↘ DUPLICATE/FAILED
```

- HTTP 请求体流式写入 `.bookkin-staging/uploads`，同时计算 SHA-256；不把书籍二进制或封面 BLOB 存入 PostgreSQL。
- EPUB 读取 OPF/EPUB3、贡献者、Calibre 系列、ISBN、标签、简介、字数和内置封面；PDF 合并 Document Info/XMP，并记录页数。
- 缺失字段按 ISBN、然后标题+作者查询 Open Library 和可选 Google Books。`metadata_lookup_cache` 用规范化查询哈希缓存 30 天，在线失败只记录候选状态。
- `books.metadata_sources` 保存字段来源，`metadata_overrides` 保存人工覆盖集合。扫描仅刷新 FILE 字段，人工字段始终保留。
- 确认入库重新检查根目录权限、空间、目标路径、软链接和重复指纹；同文件系统原子移动。数据库提交失败时将文件移回暂存区。
- 自定义封面统一规范化为 2:3 JPEG，持久化到 `.bookkin-assets/covers`；数据库只保存路径、哈希、尺寸、来源和保留时间。

## 4. 身份与安全

- 不开放注册。空系统仅允许本机/局域网首次创建 OWNER；完成后 setup 接口永久关闭。
- 密码使用 Spring Security 5.8 预设参数的 Argon2id；临时密码只在创建/重置响应中返回一次。
- Spring Session JDBC 保存 Session；Cookie 为 `HttpOnly`、`SameSite=Strict`，生产环境通过反向代理 HTTPS 时开启 `Secure`。
- SPA 使用 Cookie CSRF Token，所有状态变更要求 `X-XSRF-TOKEN`。
- 登录按用户名与来源地址双维度限流；成功和失败均进入安全审计。
- OWNER/ADMIN/MEMBER 由服务端授权；只有 OWNER 可永久清理与变更 OWNER 权限。
- 阅读位置和批注查询必须始终带当前 `user_id`，管理员无旁路读取接口。
- 笔记导出是流式 HTTP 附件响应，不在 NAS 或数据库持久化临时 Office 文件；文件名经过控制字符与保留字符清理。

PDF 阅读默认由 PDF.js 按当前页懒提取文本并在浏览器中重排，不预解析整本文件；批注继续使用 `pdf:page=N` 定位。没有文字层的页面在阅读模式中按正文宽度直接渲染为页面图像，仍不进行 OCR；复杂排版和图表可切回原版画布。

## 5. 文件事务协议

每个写操作包含：`previewToken`、`expectedFingerprint`、`idempotencyKey`。预览是有期限的服务端快照；执行时重新计算关键条件。

状态机：

```text
PLANNED → RUNNING → SUCCEEDED
                  ↘ FAILED
                  ↘ ROLLED_BACK
```

- 路径先进行 Unicode NFC、分段和绝对路径规范化，再确认真实路径仍在已登记根目录内。
- 现有路径逐段拒绝软链接；目标父目录解析后也必须位于根目录。
- 重命名、移动和恢复目标使用 create-new 语义，从不覆盖已有文件；只有管理员明确确认的元数据写回会替换当前原文件。
- Worker 先获取数据库文件租约；活动阅读租约存在时重试，超过时限安全失败。
- 同根目录移动优先原子 `move`；跨根目录执行 stage → fsync → SHA-256 → parse → finalize → source-to-trash。
- 写回执行 transient-rollback → temp-write → fsync → parse/checksum → atomic replace → database commit → delete-rollback。失败时恢复本次操作的临时快照；成功后立即清理，不形成可浏览历史。
- `.bookkin-trash`、`.bookkin-staging`、`.bookkin-assets` 均位于对应根目录并从扫描中排除；旧部署遗留的 `.bookkin-versions` 也继续排除并按原保留期清理。

## 6. API 与契约

契约以 `docs/openapi/bookkin-api.yaml` 为源，生成 TypeScript Client。HTTP 约定：

- 错误遵循 RFC 9457 Problem Details，并附 `code` 与 `traceId`。
- 列表返回 `items` 与 `nextCursor`。
- 幂等写接口读取 `Idempotency-Key`；相同键和相同请求返回原结果，不同请求返回 409。
- 上传接口默认单文件 2 GiB、队列 20 本、前端并发 2 本，未确认会话 24 小时后过期清理；参数可通过环境变量调整。
- 文件任务记录与 `book_files.status=OPERATING` 在同一数据库事务中提交，避免 Worker 抢占任务时留下状态窗口。
- 文件冲突返回 409；指纹陈旧使用 `FILE_CHANGED_EXTERNALLY`。
- 首次改密未完成时，除会话、CSRF、改密和退出外返回 428。

## 7. Profile 与任务

- `api`：Web、鉴权、目录、Range 读取与任务提交；不执行扫描和文件事务。
- `worker`：无 Web 端口，执行 Spring Batch 扫描、文件任务、回收站清理以及旧版本兼容清理。
- Spring Batch 在 PostgreSQL 记录每次扫描 Job/Step 结果；当前扫描 Tasklet 在中断后整次安全重跑。文件事务自身以 `file_operations` 为持久化日志，`RUNNING` 中断任务必须按运维手册核对后恢复。

## 8. Docker 与 NAS

Compose 只包含 `app`、`worker`、`postgres`。`app` 与 `worker` 使用同一多架构镜像；镜像不得假定 x86 指令。书库目录以显式 bind mount 提供，禁止挂载宿主根目录。

启动时根目录检查：存在、可读、可列目录、可创建并 fsync 临时文件、可原子移动、暂存目录可用、剩余空间达到阈值。写能力失败时根目录降级为只读并记录告警；目录浏览仍可用。

## 9. 备份与恢复

- 每日 `pg_dump --format=custom`；备份与源书不放同一物理盘。
- `.bookkin-trash` 纳入 NAS 快照策略；原始 EPUB/PDF 由 NAS 自身快照或备份策略保护。元数据写回成功后只保留当前文件。
- 恢复顺序：数据库 → 根目录挂载 → 能力检查 → 只读校验扫描 → 开启 worker。
- 每个版本发布前演练 NAS 断连、空间不足、跨根复制中断和数据库恢复。

## 10. 性能目标与可观测性

- 10 万册/15 万文件：列表 p95 ≤ 250ms，常规搜索 p95 ≤ 500ms。
- 日志带 `traceId`，文件任务日志带 operation id；禁止记录密码、Session、笔记正文或完整文件内容。生产环境可在容器日志采集层转换为结构化 JSON。
- Actuator/Prometheus 暴露 HTTP、JVM、连接池等标准 Micrometer 指标；扫描速率、队列深度、租约等待和根目录空间等业务指标列为生产加固项。
- 超过 1 秒的 SQL 在开发/压测记录执行计划；生产日志不打印参数中的私人数据。

## 11. 浏览器与虚拟书库

React 路由按页面懒加载。公开发现入口与受保护的私人书库、管理页分别由 `PublicShell` / `ProtectedShell` 组织；匿名访问受保护内容显示 401，角色不符显示 403。公开阅读仍须经过书籍可见性判断。

`apps/web/src/ui/` 统一适配 Ant Design；共享按钮独立处理图标槽、标签和链接。`VirtualLibraryExperience.tsx` 组合 Three.js 场景、真实目录及 `VirtualLibrarySearch.tsx`；搜索在已授权且加载的目录中匹配标题、作者、系列、格式和标签，不新增后端搜索协议。场景几何批处理与房间懒创建、火焰更新及碰撞规则见 [虚拟书库](virtual-library.md)。

阅读字体由前端预设资源与服务端自定义字体记录合并。自定义字体二进制存放在 `BOOKKIN_FONT_STORAGE_PATH`，不进入 NAS 书籍原目录或数据库；状态与授权由字体 API 控制。
