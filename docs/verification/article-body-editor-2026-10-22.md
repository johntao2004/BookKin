# 文章正文编辑器调整

- 删除文章抽屉独立的“正文文件”上传区，保留独立封面。
- 在正文上方展示“编辑 / 预览”模式和“上传图片”，底部只保留保存。
- 正文图片支持多选上传、剪贴板粘贴和拖入，按源码选区插入 Markdown；每张 JPEG/PNG/WebP 不超过 5 MB，每篇最多 40 张。
- 图片通过已有鉴权 `/articles/prepare` 接口清洗并保存为内部资源。预览复用共享 Markdown 样式和代码高亮，远程图片仍先经服务端下载。
- 切换模式或修改封面、元数据不会丢失正文；图片导入失败保留原文；仅修改元数据仍保留原始 HTML 和阅读定位。
- 同步更新 `apps/web/AGENTS.md`，明确这次反馈取代此前的独立正文文件区和禁止手动插图要求。

## 已完成验证

- `pnpm lint`、`pnpm typecheck` 通过。
- 文章页面和正文编辑器测试共 18 项通过，覆盖插入选区、粘贴/拖入、失败保留、Markdown 源码/预览/保存和此前的重复检测。
- 本地浏览器实际上传 `limestone-texture.png`，确认得到 `/api/v1/articles/assets/...` 链接，预览图片真实加载（naturalWidth 1024），返回源码后标题、列表、加粗和图片链接全部保留。
- 桌面截图：`.local/verification/article-body-editor/source.png`、`preview.png`（Git 忽略的本机验收材料）。没有保存测试文章。
- `pnpm build` 通过；只报告桌面浏览器验收，未做物理移动设备验证。
- `pnpm test` 全量运行中，App 路由、文章页、分类页及权限测试出现多项超时（单个用例达 19–75 秒）。当时存在其他并行全量测试及构建进程。本轮全量和随后的一次单 worker 复核均主动终止（退出 143），不能记为通过；不依据这次运行断定具体代码回归原因。最初的 18 项针对性测试结果与全量结果分开保留。
- 未提交、推送或部署。日志：`/tmp/bookkin-body-editor-targeted.log`、`/tmp/bookkin-body-editor-full-tests.log`、`/tmp/bookkin-body-editor-build.log`。
