# 飞牛 NAS 部署

## 运行环境

- 地址：`http://192.168.1.103/`；飞牛管理端继续使用 `5666/5667`。
- Compose 目录：`/vol1/bookkin/releases`，应用和 Worker 使用同一镜像。
- 书库：`/vol1/bookkin/data/library`；字体：`/vol1/bookkin/data/fonts`。
- 数据库卷：`bookkin_bookkin-postgres`。账户及登录会话保存在 PostgreSQL，不随容器重建丢失。
- 数据目录 UID/GID：`1000:1001`，目录权限 `0750`。飞牛 ACL 需同时允许该身份访问；镜像中的 JAR 使用 `0644`。
- `.env` 只保存在服务器，权限 `0600`；不得将密码或 `BOOKKIN_AI_SETTINGS_ENCRYPTION_KEY` 提交到 Git 或发布记录。启用 AI 前必须注入稳定的实例专属随机密钥；AI 关闭时可以留空。
- 飞牛网关 `redirect=false` 为 BookKin 释放 80 端口；不修改飞牛生成的 nginx 配置。原配置备份为 `network_gateway_setting.before-bookkin.json`。飞牛升级后需复查端口占用。

## 构建和发布

从仓库根目录执行 `bash ops/release/build.sh`。每次创建新的 `.artifacts/release-*` 目录，执行前端 lint、类型检查、构建及后端 verify，将同次构建的前端嵌入 JAR。测试输出中的跳过项需独立审阅，不能视为通过。

将目录中的 `bookkin.jar`、`SHA256SUMS`、`release.json`、`routes.json`、`check.py`、`install.sh` 上传到服务器新的 `versions/<版本号>` 目录。在服务器运行：

```sh
sudo bash versions/<版本号>/install.sh /vol1/bookkin/releases /vol1/bookkin/releases/versions/<版本号>
```

安装器互斥执行，校验 JAR 哈希，对比数据库迁移文件；只有迁移未变化的发布可使用自动应用回退。构建带内容哈希的镜像，备份数据库，重建 app/worker，等待就绪并检查全部前端路由、JS/CSS 分块、私有 API 授权边界。失败时恢复上一镜像；成功后写入 `current-release.json`、`current-release-directory`，更新 `bookkin:local` 与常规 Compose 构建用 JAR。

发布期间单实例应用有短暂不可用窗口。安装器成功退出后才可以宣布发布成功；容器启动或健康接口成功都不等于全部验收通过。不要在应用重启过程中刷新验收页面。

数据库迁移变化时，安装器会拒绝执行，需另行审阅迁移兼容性、备份和恢复方案，不允许自动将旧应用接到不兼容的新 schema。

## 发布后验收

在 NAS 外的机器执行：

```sh
python3 ops/release/check.py http://192.168.1.103 --routes .artifacts/release-<本次构建>/routes.json
```

路由清单从前端 `App.tsx` 实际声明生成，新增页面忘记后端入口时会阻止验收通过。检查器递归验证页面的 JS/CSS 依赖，不接受用 HTML 替代缺失资源。`python3 -m unittest discover -s ops/release -p 'test_*.py'` 验证检查器会拒绝缺失懒加载资源和私有 API 暴露。

浏览器仍需验证登录状态、直接打开与刷新、导航及关键交互。重启 app/worker 后重复检查，并确认用户、会话、书籍和文件未丢失。不得通过创建真实测试账户或删除业务数据来做验收。

## 备份与排查

安装器的数据库备份保存在 `backups/pre-<JAR哈希>-<时间戳>.dump`，权限仅 root 可访问。它是发布回滚用的数据库快照，不替代完整灾备；日常应从 Compose 目录执行 `BOOKKIN_BACKUP_DIR=/vol1/bookkin/backups BOOKKIN_FONT_BACKUP_ROOT=/vol1/bookkin/data/fonts ./ops/backup.sh`，完整归档书库原书、`.bookkin-assets`、暂存区、回收站、兼容版本和字体目录，参见运维文档。可先用 `./ops/restore.sh --dry-run <备份目录>` 做无损校验。

```sh
sudo docker compose ps
sudo docker compose logs --tail=100 app worker
```

当前已补齐藏书、分类、书单、虚拟书库和管理页面的 SPA 入口。页面 HTML 允许加载，私有 API 仍要求认证。初始化表单使用 Ant Design 字段校验；导航搜索在当前页面筛选。

## 2026-09-06 加固验收

已使用新流程发布 `bookkin:release-f49538e94e7ebdf3`。NAS 内和局域网外部调用均通过 20 个页面、47 个 JS/CSS 资源、4 个私有 API 边界及 readiness 检查；主动重启 app/worker 后重复通过，用户和会话数量保持 1/1，书库和字体目录仍可写。检查器 3 个测试通过，后端 verify 为 50 通过、4 跳过。未执行 NAS 整机重启，也未宣称全量业务验收或零停机发布。

藏书概览的四个模块在空书库时也保持显示：本周新藏显示空状态，最近批注独立于是否有新藏。已加入空书库页面回归测试。

局域网 HTTP 上传：客户端 UUID 使用 getRandomValues 实现，避免 randomUUID 在非安全上下文中不可用导致选择文件白屏。已增加缺少 randomUUID 的上传队列回归测试。

后续发布 `bookkin:release-10fc681d7beda353` 增加全站渲染异常恢复入口、HTTP 剪贴板不可用提示，以及上传异常响应和取消请求处理；ESLint 禁止直接调用 `crypto.randomUUID`，防止同类问题再次引入。相关 3 个前端回归测试通过，发布构建及部署检查通过。

在实际 `http://192.168.1.103` 登录会话中，用原创临时 EPUB 验证了选择文件、真实上传、服务端解析、等待校对及打开校对页；书名、作者、语言和目标路径正确。验收任务随后取消，没有正式入库。此证据不代表已验证全部格式、大文件或最终入库后的阅读流程。上线验收必须包含实际文件上传与校对，不能仅测试选择文件或健康接口。

上传弹窗使用紧凑队列宽度，校对页使用中等宽度；共享弹窗按动态视口高度限制内容并内部滚动，标题和操作区保留可见，避免平板和矮窗口中弹窗撑出屏幕。

上传交互更新：选择或拖入 EPUB/PDF 后自动传输；完成后提示已上传，点击确定进入 `/library/uploads/:uploadId` 编辑页。批量上传按顺序编辑；页面可刷新恢复。上传不再自动在线补全，后台仍进行文件合法性及重复校验，用户可在编辑页按需在线补全，保存完成后安全入库。

设置统一入口为 `/settings`，保留书库状态和阅读字体两个设置 Tab，并分别使用 `#library-roots`、`#reader-fonts` 锚点。原管理地址兼容跳转；用户管理、操作日志、登录日志和安全设置位于独立的 `/admin/users` Tab，展示书目位于 `/display-books`。

后续调整：用户管理独立恢复到 `/admin/users` 和账户菜单，`/settings#users` 兼容跳转；设置页仅保留其余四项 Tab。

### 在设置中新增书库

在「设置 → 书库状态」点击「新增书库」，填写名称和容器内目录，检查位置后确认新增。检查会拒绝不存在、不可读、包含软链接、重复或相互嵌套的目录；确认时重新核对目录指纹。新增后检查写入、暂存与原子移动能力，并继续每分钟巡检。

目录必须事先以相同容器路径挂载到应用与任务容器，例如把 NAS 的书籍目录分别挂载为 `/library/books`。界面不会自动挂载宿主目录，也不需要 Docker socket。默认只允许登记 `/library` 下的独立目录，可通过 `BOOKKIN_STORAGE_REGISTRATION_BASE` 调整允许的父目录。新增记录持久保存于数据库，无需再写入启动根目录配置。

### 用户管理日志

`/admin/users` 通过 `#users`、`#operations`、`#logins` 切换用户列表、操作日志与登录日志。原 `/admin/file-operations` 及 `/settings#file-operations` 跳转到操作日志，设置页不再提供文件任务 Tab。

登录日志来自已有审计记录，展示成功/失败、账户、时间与来源 IP，按每页 20 条分页，仅主人和管理员可查看。升级前没有保存 IP 的记录显示「未记录」；升级后的登录记录使用服务端收到的连接地址，不信任客户端伪造的转发头。不会记录密码。数据库结构无需迁移。

展示书目管理现位于独立路由 `/display-books`，登录后从主导航进入。旧 `/settings/display-books` 和 `/settings#display-books` 自动跳转，设置仅保留书库状态、阅读字体。公共首页 `/library` 仍展示面向访客的书目。

### 注册策略

用户管理的 `#security` Tab 提供开放注册开关，默认关闭，仅主人可修改。开启后登录页显示注册入口 `/register`，新账户固定为普通成员；关闭后服务端立即拒绝新的注册请求。注册使用 12–200 位密码、现有密码哈希算法、CSRF 校验，以及每个来源地址 15 分钟最多 8 次提交（包括成功提交）的进程内限流。限流计数在应用重启后重置。

V8 迁移新增持久化安全设置表，升级不会自动开放注册；注册与策略更新共享行锁，防止关闭策略时并发请求绕过。注册及开关变更写入审计记录，不保存明文密码。无需新增邮件、OAuth 等依赖。

V8/V9/V10 部署恢复方案：发布脚本仅在显式传入对应的 `--registration-policy-migration`、`--additive-ai-settings-migration` 或 `--refresh-ai-provider-defaults-migration`，且新增 SQL 与审核过的哈希完全一致、所有旧迁移均未变化时放行；启动前生成 PostgreSQL 备份。若应用验证失败，恢复旧镜像并保留新增设置表及 Flyway 记录，不删除或覆盖业务数据。后续同版本迁移发布无需该参数。

### 移动书库流程

书籍菜单的「移动」显示当前书库，并从已登记书库中选择目标；当前书库不可重复选择，离线或只读书库不可选。点击「校验目标书库」后，由服务端检查源文件指纹、目标冲突和空间，校验通过才能确认移动。原相对目录及文件名自动保留，不再要求用户输入路径。执行仍使用预览令牌、预期指纹和幂等键，底层跨书库文件保护流程不变。

### 统一反馈提示

页面和弹窗中的提示通过共享 Ant Design 气泡通知显示，不占用表单布局。成功提示自动消失；错误和需要操作的提示可手动关闭，并保留原有重试入口。AI 设置的保存工具栏与下方卡片保留统一间距。

AI 设置选择厂商后保存，该厂商成为唯一启用的平台；刷新恢复已保存的平台，平台内部不再提供单独启用开关。全局 AI 开关继续控制是否调用 AI。
