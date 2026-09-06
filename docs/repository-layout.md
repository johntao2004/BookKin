# 代码位置与存放规则

仓库采用前后端分离的工作区。前端只放在 `apps/web/`，后端只放在 `apps/server/`；根目录保留项目入口与工作区、部署配置。

## 一级目录

| 位置 | 存放内容 |
| --- | --- |
| `apps/web/` | 浏览器界面、前端资源、前端测试与构建配置 |
| `apps/server/` | Java API、后台 Worker、数据库迁移与后端测试 |
| `design/` | 设计 Token、Figma 范围、`qa/` 下的设计验收记录及配套截图 |
| `docs/` | 架构、实施状态、运维说明；`adr/` 放决策，`openapi/` 放接口契约 |
| `scripts/` | 本地开发与生成脚本；`benchmark/` 放性能测试脚本及 SQL |
| `docker/` | Dockerfile 和额外部署示例；默认 `compose.yaml` 保留在根目录 |
| `ops/` | 数据库备份、恢复等运维脚本 |
| `.github/workflows/` | CI/CD 工作流 |
| `.local/` | 不提交的本地运行数据：`run/` 运行包、`logs/` 日志、`library/` 书籍及资产 |

## 前端：apps/web

所有路径均相对于 `apps/web/`。

| 位置 | 职责 |
| --- | --- |
| `src/main.tsx` | 浏览器应用启动入口 |
| `src/App.tsx` | 路由和应用组装 |
| `src/pages/` | 书库、分类、书单、阅读、设置和管理等页面；页面按功能命名 |
| `src/pages/VirtualLibrarySearch.tsx` | 天球触发的居中目录搜索 |
| `src/pages/virtual-library-*` | 虚拟书库布局、碰撞、交互与目录逻辑 |
| `src/pages/virtual-library-model/` | 虚拟书库三维模型与场景构建 |
| `src/components/` | 书籍卡片、上传、元数据编辑及通用业务组件 |
| `src/components/readers/` | EPUB/PDF 渲染、批注、分页与翻页效果 |
| `src/api/` | 前端 HTTP 请求封装 |
| `src/auth/` | 登录状态与访问控制 |
| `src/domain/` | 前端领域类型和常量 |
| `src/hooks/` | 可复用 React Hooks |
| `src/charts/` | 图表封装 |
| `src/theme/`、`src/ui/` | Ant Design 主题与统一组件适配 |
| `src/styles.css` | 全局语义样式 |
| `src/generated/` | OpenAPI 生成的客户端代码，修改接口契约后重新生成 |
| `src/data/` | 演示数据定义 |
| `src/test/` | 测试初始化与公共测试辅助 |
| `src/**/*.test.ts(x)` | 与被测功能就近存放的单元及组件测试 |
| `public/` | 浏览器直接使用的图片、字体及其他静态资源 |
| `worker/`、`scripts/`、`tests/` | Sites 托管适配、构建准备脚本及其测试；不属于 Java 业务后端 |
| `dist/` | 自动生成的前端发布产物，不提交、不手改 |

## 后端：apps/server

业务代码基准路径为 `src/main/java/io/github/johntao2004/bookkin/`。

| Java 包 | 职责 |
| --- | --- |
| `auth/` | 认证与安全入口 |
| `users/` | 用户和角色管理 |
| `catalog/` | 书籍、封面、分类和书单 |
| `ingestion/`、`ingestion/upload/` | 书库扫描、流式上传、解析及元数据补全 |
| `filemanagement/` | 受控 NAS 写操作、版本、回收站及恢复 |
| `reading/` | 阅读内容、位置、时长和字体 |
| `annotations/` | 用户私有书签、划线和笔记 |
| `audit/` | 审计记录 |
| `config/` | 应用配置 |
| `common/` | 通用错误处理等共享基础能力 |
| `web/` | Web 入口适配 |
| `BookKinApplication.java` | Spring Boot 启动入口，API 与 Worker 使用不同 profile |

- `src/main/resources/application*.yml`：应用及 profile 配置。
- `src/main/resources/db/migration/`：Flyway 迁移；只追加新迁移，不修改已发布版本。
- `src/test/java/`：与主代码包结构对应的后端测试。
- `pom.xml`、`mvnw`、`.mvn/`：Maven 构建入口及 Wrapper。
- `target/`：自动生成的构建、测试和打包产物，不放手写源代码。

## 新文件放在哪里

1. 页面及浏览器交互放前端；权限规则、事务和 NAS 访问放后端对应模块。
2. 公共组件放 `src/components/`，基础 UI 放 `src/ui/`，避免业务页面各自复制基础样式。
3. 项目说明放 `docs/`；设计验收 Markdown 与截图一起放 `design/qa/`，不散落根目录。
4. 跨项目开发脚本放根目录 `scripts/`；只服务前端构建的脚本放 `apps/web/scripts/`；备份恢复放 `ops/`。
5. 临时验证输出放 `.artifacts/`，本地运行文件放 `.local/`；两者均已被 Git 忽略。
6. 保留资源来源说明、测试夹具和锁文件。不能仅凭“没有代码 import”判定图片、字体、SQL 或文档无用。

## 清理边界

- `.local/run/bookkin-*.jar`：旧启动快照可以删除，但必须保留任何进程正在引用的快照及最新快照；先检查 `ps -axo command`。
- `dist/`、`target/`、`coverage/`、`*.tsbuildinfo`：可再生成；清理前确认没有构建、预览或运行进程使用它们。
- `node_modules/`：安装依赖，不是源码；开发期间保留，避免破坏正在运行的服务。
- `.local/library/`、数据库、用户上传、封面、字体及 NAS 原文件：属于业务数据，不按临时垃圾清理。
- `.git/`：版本历史，保留。
