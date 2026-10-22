# 文章 Markdown 正文与图片自动导入

## 行为

- 正文改为 Markdown 编辑，预览渲染标题、强调、列表、GFM 表格、代码块和图片；可导入 Markdown/HTML 文件，粘贴 HTML 图文时转换为 Markdown。
- 抓取的 HTML 转换为可编辑源码，已有内部图片保留。封面继续使用独立字段，保留替换/移除，不混入正文。
- 移除正文图片手动上传入口。正文外链图片在预览、文件导入或保存前通过 `POST /api/v1/articles/prepare` 自动下载，转成内部文章资产再显示；浏览器不直接加载外链图片。
- prepare 仅 OWNER/ADMIN 可用，不保存文章记录；复用既有 HTTPS、地址检查、下载限制、图片净化和访问控制，下载失败保留占位与周围文字。
- 只改元信息、封面或未修改正文的预览保留原 HTML，避免 Markdown 往返转换重排原阅读定位。正文源文本独立于元信息更新，不丢未保存输入。
- 使用 Marked 与 Turndown；复杂 HTML 表格保留安全的原始表格结构，仍可被 Markdown 预览渲染。Markdown 源编辑区保留完整内容，最多显示 24 行后内部滚动。

## 验证

- 前端定向 4 个文件、21 项测试通过，覆盖 Markdown 转换/渲染、外链图片转内部地址、移除手动入口、封面/正文独立、正文草稿保留、仅改元信息不重写原 HTML。
- `pnpm lint`、`pnpm typecheck`、`pnpm build` 通过。全量前端测试 146 个文件、683 项通过。
- 后端 `BOOKKIN_NATIVE_TEST_URL=jdbc:postgresql://127.0.0.1:5432/bookkin ./mvnw verify` 成功：188 项中 179 项通过、9 项依赖 Docker 的测试跳过，0 失败、0 错误。
- 新增 7 项后端测试覆盖 prepare 协议校验、匿名/成员拦截、主人/管理员授权、相对图片地址、内部图片复用和下载失败占位。
- 本地 API/Worker 已通过 `pnpm start:local` 使用不可变 JAR 快照更新，健康检查通过。

## 浏览器

- 手动输入 Markdown 标题、粗体、列表、表格、代码块与公开 HTTPS 图片链接，预览均正常。外部 PNG 被转换为 `/api/v1/articles/assets/...` 并成功解码；返回编辑后源码含内部图片地址。
- 重新抓取 `https://mp.weixin.qq.com/s/vIb1GXMen2IvmRjLiANLfA`：源码自动包含 21 张内部正文图片，封面独立；预览中图片数量 21、外链图片数量 0，流程图成功解码为 677×784。
- 在该真实文章的 Markdown 源码追加临时粗体标记并重新预览，标记正常渲染为 strong，21 张图片仍保留；随后已撤销临时标记。
- 页面已无正文图片手动上传控件。当前保留未保存的真实文章预览，没有保存测试文章、提交、推送或部署。

证据：[Markdown 渲染](./article-markdown-2026-10-22/rendered.png)、[源码编辑](./article-markdown-2026-10-22/source.png)、[真实文章源码](./article-markdown-2026-10-22/captured-source.png)、[自动导入流程图](./article-markdown-2026-10-22/captured-flowchart.png)、[测量记录](./article-markdown-2026-10-22/metrics.json)。

转换参考：[Turndown 官方 README](https://github.com/mixmark-io/turndown/blob/master/README.md)、[Marked 官方配置文档](https://marked.js.org/using_advanced)。
