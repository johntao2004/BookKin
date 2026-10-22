# Markdown 与发现页面视觉验收

日期：2026-10-22。预览服务：http://127.0.0.1:4176。

## 实现

- `markdown-prose.css` 统一文章阅读 iframe、文章导入/编辑预览和读后长文：有序列表用珊瑚色，无序列表和引用用青绿色，表格有表头强调、隔行底色与单元格边框，代码区有独立底色。
- 支持有/无 thead 的表头结构。桌面表格铺满正文宽度；手机宽表格在自身区域横向滚动，正文保持竖向滚动。
- iframe 直接使用当前主题调色板，避免父级 DOM 变量更新顺序导致切换主题后保留旧配色。仅注入样式和 class，不重写正文、段落 ID 或 CFI；普通 EPUB 不注入文章样式。
- 书单拼图将 3:4 封面整体居中，横纵间距统一为 4px，保留空书单框架。
- 图谱移除单独的“知识点”按钮，搜索与“重置视图”在同一组，保留节点筛选与页面上的“分析书籍”。

## 验证

- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 通过。全量前端 150 个测试文件、703 项测试通过。
- 新增主题切换回归：纸张→夜间→纸张，iframe 调色板立即更新，仅保留一个样式节点，原有段落节点和 rendition 不重建。
- 真实文章 `/articles/0402f1b4-c884-45e5-836c-e5f8199a471b`：1280px 桌面正文表格宽 760px；纸张和夜间主题表头、列表、引用、代码样式均生效，主题切换后重新读取颜色确认。
- 390×844 手机：正文宽及 scrollWidth 均为 336px；宽表格容器 336px、内部内容 460px，单元格约 153px，使用局部 overflow-x:auto，页面没有横向溢出。手机有序列表实际渲染正常。
- 未保存的 Markdown 草稿中验证有序、无序列表及表格预览；测试草稿已关闭，未创建文章。
- 书单真实四封面拼图测量：101.34×135.13px，横纵间距均 4px。图谱桌面和手机搜索框、重置按钮均高 40px 且顶边一致；输入搜索、点击重置以及清空搜索可操作。
- 浏览器读取到的控制台 error 为空。`pnpm status:preview` 显示 API 与前端代理 ready。
- jsdom 保留现有 CSS/伪元素/canvas 能力提示；构建保留现有大 chunk 提示，均未阻断检查。本次未修改后端、未提交或部署。

## 截图

- `prose-polish-2026-10-22/markdown-preview.png`
- `prose-polish-2026-10-22/table-light.png`
- `prose-polish-2026-10-22/table-dark.png`
- `prose-polish-2026-10-22/table-mobile.png`
- `prose-polish-2026-10-22/ordered-list-mobile.png`
- `prose-polish-2026-10-22/booklists-desktop.png`
- `prose-polish-2026-10-22/booklists-mobile.png`
- `prose-polish-2026-10-22/graph.png`
- `prose-polish-2026-10-22/graph-mobile.png`
