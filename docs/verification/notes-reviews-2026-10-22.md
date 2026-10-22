# 独立笔记与读后长文验收（2026-10-22）

## 功能与数据边界

- 阅读笔记以共享 Tabs 分为图书笔记和文章笔记，URL 保存分类/所选书籍或文章；只挂载所选分类，查询缓存包含用户 ID。
- 普通图书笔记继续使用 annotations 接口和原有导出。文章笔记只读当前用户 article_reading.annotations，排除书签/空记录/畸形条目，带原文 locator 链接。未合并文章、图书或禁书区数据。
- 书籍详情下新增读后长文，独立 book_reviews 表存储 Markdown，支持创建、多篇长文、作者编辑、预览与刷新恢复。标题、列表、引用、表格、代码安全渲染；外部图片以显式链接呈现，不后台加载文章/禁书区资源或远程图片。
- 默认为仅自己，可明确改成书库共享（仅登录用户）；主人/管理员不能读取其他人的私密长文或代为编辑。更新必须匹配 revision，失败不清空未保存正文。新私密响应带 Cache-Control: no-store。
- 长文位于详情页即可写作，没有强制以阅读进度 100% 为前提。

## 验证

- 前端完整检查：Lint、类型检查、149 文件 / 695 项测试、构建通过。最终正文阅读宽度改为 readingMax 后，22 项相关测试及 Lint/类型检查/构建再次通过。
- 后端最终 `BOOKKIN_NATIVE_TEST_URL=jdbc:postgresql://127.0.0.1:5432/bookkin ./mvnw verify`：197 项，0 失败，0 错误，9 项因 Docker 等可选环境跳过。
- 本轮 BookReviewNativePersistenceTest 已真实执行 PostgreSQL：随机隔离 schema 运行全部 Flyway，验证两个用户的文章笔记、私密/共享长文、管理员隔离、真实更新及版本冲突，随后清理 schema。
- 浏览器：文章笔记 2 条与图书笔记空状态分开显示，切换清除另一类所选 ID。真实书籍详情完成创建 PRIVATE 长文、Markdown 预览、保存、刷新、恢复原始 Markdown、再次编辑保存，数据库记录 PRIVATE/revision=2。
- 390×844 真实应用 iframe 验证手机编辑器：抽屉 390×844，输入框/下拉框均 335px 宽，单行控件均 40px 高；保存按钮 bottom=828/right=374，位于视口内。无横向溢出。临时框架源文件和构建副本已清理。
- 本地 QA 长文仅用于验收，ID 45f7b728-23a1-4f0c-b62e-80476ee3d59b，截图后按 ID+书籍+唯一标题限定清理，DELETE 1。没有保留演示长文或修改已有笔记。
- 本地 API/Worker 通过 pnpm start:local 使用不可变快照 bookkin-20261022-044545-10237.jar，健康检查通过；没有提交、推送或部署。

[笔记分栏](notes-reviews-2026-10-22/article-notes.png) · [长文展示](notes-reviews-2026-10-22/review-detail.png) · [手机编辑器](notes-reviews-2026-10-22/review-phone.png)
