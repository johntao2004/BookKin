# fnOS 部署验收（2026-10-20）

## 发布结果

- NAS：`192.168.1.103`，Compose 目录 `/vol1/bookkin/releases`。
- 已接受镜像：`bookkin:release-13c696e5309d5b50`，API 与 Worker 使用同一镜像。
- JAR SHA-256：`13c696e5309d5b506b5ddc902cafb5ae1fdac937c0c34343b743fbc28d06a29c`。
- 本地发布包：`.artifacts/release-PClHPqXS`。构建基于包含未提交修改的工作区；不是已提交、已推送版本。
- NAS 发布目录：`versions/release-20261020-route-fix`，安装器输出 `Accepted release`，更新了 `current-release.json` 和持久发布镜像。

## 修复与保护

- 补齐密码找回、文章、私人书库、个人资料页面的 SPA 直接访问映射；个人资料页面 HTML 允许加载，私有 API 仍要求登录。
- `SpaForwardControllerTest` 增加相关入口回归用例。
- 首次候选因缺失 `/recover` 映射被验收拒绝并回退。正式数据库已迁移到 V19，未降级。
- V1–V10 迁移哈希保持不变；审阅 V11–V19 后，以准确的新增迁移哈希限制本次专用安装器。
- 升级前数据库备份已在独立临时数据库验证恢复；临时实例成功执行新增迁移。验收后删除本次创建的临时容器和临时数据库，保留备份。
- NAS 增加 `/vol1/bookkin/data/content` → `/var/lib/bookkin/content` 挂载，并通过 `BOOKKIN_CONTENT_STORAGE_PATH` 指定文章附件、私人书库文件的持久位置。该配置已在 NAS Compose 中保存；目录权限 `0700`，UID/GID `1000:1001`。日常灾备还需覆盖该目录，数据库备份不能替代文件备份。

## 实际检查

- 前端 lint、typecheck、build 通过；最终测试 130 个文件、521 个用例通过。
- 发布包后端 `./mvnw verify`：134 个测试，0 失败、0 错误、7 跳过（Docker/Testcontainers 相关）；跳过项未视为通过。
- 独立 NAS 实例：33 个页面路由、114 个 JS/CSS 资源、4 个私有 API 授权边界、readiness 均通过。
- 正式服务在 NAS 内及局域网外部机器执行同一检查，均通过。
- 主动重启 API/Worker 后，NAS 内重复通过全部发布检查；API 为 healthy，Worker 为 running，两者镜像一致。
- 重启前后账户、书籍、会话数量均为 `1|1|0`。书库、字体及内容持久目录可写。
- 浏览器直接打开 `/recover` 正常显示重置界面（无令牌时提示链接不完整）；导航到 `/forgot-password` 正常，无控制台错误。
- 重启后文章页正常渲染，无控制台错误；`/profile` 未登录时显示登录边界，能导航至登录页。

## 尚未验证

- 未取得 BookKin 主人账号的登录密码，未完成登录后的业务交互、上传与校对验收。
- 未提供外网域名或穿透入口，尚未配置或验证外网访问。
- 未重启 NAS 整机；未提交、推送 Git，也未更改其他容器或现有穿透配置。
