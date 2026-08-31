# BookKin V1 实施状态

更新日期：2026-08-21

## 已落地

- 规范：设计系统、技术架构、仓库协作规则、3 项 ADR、OpenAPI 契约、运维/备份手册。
- 前端：React 19、MUI 9、响应式藏书馆、用户管理、NAS 状态、文件任务、回收站、当前元数据直接覆盖、EPUB 阅读器、PDF 文字重排/图片页/原版三类呈现、书签/划线/笔记。
- 后端：Java 21、Spring Boot 4.1 模块化单体、Session/CSRF/Argon2id/限流/审计、游标目录、扫描与封面提取、Range 阅读、按书聚合的私人批注及 DOCX/XLSX 导出。
- 文件事务：服务端预览、指纹前置条件、幂等键、入队状态原子提交、读写租约、同根移动、跨根复制校验、回收/恢复，以及带事务内临时回滚的元数据直接覆盖。
- NAS：多根目录环境配置、每分钟能力检查、只读/离线降级告警、Compose override 示例、30 天保留任务。
- 书籍上传：EPUB/PDF 流式暂存、队列恢复、本地识别、Open Library/Google Books 候选、字段来源、封面裁切、重复/相似检测、人工校对和幂等入库。
- 交付：`app`/`worker`/`postgres` Compose、多阶段镜像、ARM64/AMD64 Buildx 工作流、备份恢复脚本、十万册数据与 p95 压测脚本。
- 本机数据环境：原生 PostgreSQL 18.6、Flyway V1-V3、JDBC Session、13 本真实 EPUB/PDF 演示书；书库、用户、进度、批注、回收站与文件操作均从数据库读取。

## 本轮验证结果

| 检查 | 结果 |
|---|---|
| TypeScript 类型检查 | 通过 |
| ESLint（0 warning） | 通过 |
| Vitest 交互测试 | 25/25 通过；包含 PDF 文本重排与扫描页空内容边界 |
| Vite 生产构建 | 通过 |
| Sites 静态路由测试 | 4/4 通过 |
| Java/JUnit | 17 项，0 失败，1 项 Testcontainers 迁移测试因 Docker daemon 不可用而跳过；包含直接覆盖、成功清理和失败回滚测试 |
| Maven 可执行 JAR | 通过 |
| 原生 PostgreSQL 18.6 / Flyway V1-V3 | 通过；API 与 Worker 共用数据库 |
| 数据库演示状态 | 3 用户、14 逻辑书、13 可用文件；上传会话、字段来源、作者/译者关联与封面资产均由数据库持久化 |
| 真实 EPUB 上传闭环 | 流式上传、SHA-256、解析、人工校对、安全入库、检索、扫描不覆盖人工字段通过 |
| 浏览器真实数据流程 | OWNER 上传队列 200、MEMBER 403；根目录/藏书上传入口、元数据与封面编辑通过；文件版本入口已移除，写回提示只覆盖当前文件 |
| OpenAPI TypeScript Client 生成 | 通过 |
| Token 漂移检查 | 通过 |
| Compose 与多书库 override 配置解析 | 通过 |
| 备份/恢复脚本语法 | 通过 |
| 浏览器 1440/1024/390 核心流程 | 通过；本轮重点复核上传队列的桌面与 390px 布局 |

## 仍需在有 Docker 与真实 NAS 的环境完成

这些是运行环境验收，不是以静态代码检查替代的项目：

1. 在有 Docker daemon 的 CI/开发机重复执行 Testcontainers 迁移测试。
2. 构建并启动 `app`、`worker`、`postgres` 三容器，验证健康检查和 ARM64/AMD64 镜像。
3. 注入 10 万册/15 万文件数据，实测列表 p95 ≤ 250ms、搜索 p95 ≤ 500ms。
4. 使用代表性 EPUB/PDF 在 NAS 上执行断连、空间不足、复制中断、校验失败、权限丢失、大小写冲突和进程中断演练。
5. 对加密/DRM/签名/损坏文件及异常 ZIP 做真实样本回归，并完成备份恢复演练。

## Figma 边界

Figma Draft 已同步 Foundations（5 个变量集合、73 个变量、9 个文本样式、3 个效果样式）。Starter MCP 调用额度在组件与页面阶段触顶，因此完整页面尚未同步；仓库代码原型与 [`design/qa/design-qa.md`](../design/qa/design-qa.md) 是当前完整可验证设计交付。
