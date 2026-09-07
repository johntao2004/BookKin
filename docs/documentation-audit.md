# 文档与代码核对记录

日期：2026-09-06。范围为仓库内手写项目说明、协作规则、设计记录、资源来源文件及生成的 API 文档。

| 文档范围 | 核对依据与处理 |
|---|---|
| README | package.json、路由、运行脚本、目录；补充虚拟书库与许可边界、文档入口 |
| docs/technical-architecture.md | Java 模块、Flyway V1–V10、路由、API 客户端、场景入口；补充浏览器与字体实现 |
| docs/design-system.md | Token、PageHeader、ui 适配、页面；修正组件名、响应式描述并记录现行交互 |
| docs/operations-runbook.md | 启停、完整备份/恢复与 benchmark 脚本、Docker 工作流；说明恢复演练边界和分支推送边界 |
| docs/implementation-status.md | 本次命令结果；把旧数据、容器与运行环境结论标记为历史验收 |
| docs/repository-layout.md | 当前目录；记录前后端、场景、生成代码和文件放置规则 |
| docs/virtual-library.md | 当前场景、查询与资源；作为现行功能说明 |
| docs/adr/*.md | 模块、事务和 Token 决策仍适用；ADR-0002 澄清临时回滚与历史版本区别 |
| design/figma-v1-scope.md | Token 和主题代码；修正颜色数量、全站主题与页面范围，远端同步未重新确认 |
| design/qa/**/*.md | 保留有日期的历史证据，旧桌椅/电脑方案明确为已替代；当前规格链接至 docs |
| AGENTS.md、apps/web/AGENTS.md | 保留仓库约束和已确认设计反馈；不以文档更新放宽产品或文件安全边界 |
| public/fonts/FONT_SOURCES.md | 对照预设字体与本地许可；补充阿里巴巴普惠体 |
| public/assets/**/NOTICE.md | 保留素材原始来源与署名；旧火焰/穹顶贴图及未加载的 glTF 模型标记为保留资源 |
| docs/openapi/bookkin-api.yaml、src/generated/bookkin-api/docs/*.md | 本次服务端接口、契约及生成目录无改动；保留生成文档，不手工改写生成产物 |

生成 API 文档的源是 OpenAPI 契约，更新接口时运行 `pnpm generate:client`。资源法律声明保留原文。没有发现需要随本轮前端调整变更的接口；本记录不声称完成所有历史接口的重新设计或远端 Figma 验收。

验证结果集中记录在 [实施状态](implementation-status.md)，实际代码位置见 [目录导航](repository-layout.md)。
