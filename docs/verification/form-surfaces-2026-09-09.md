# 全站表单表面色调整

- 纸张主题保持暖白画布，surface/surfaceCard 改为 cream050，新增 surfaceInput=cream200。明亮主题输入框使用暖白，夜间使用深色独立层级。
- 统一 Ant Design 与共享 TextField/Select 的背景，避免两套覆盖规则导致表单颜色不一致。
- 字体上传与 AI 设置移除整块填色卡片，以留白、细分隔线分区；字体列表、状态卡片和弹窗表面同步减淡。
- 字体上传、找回邮箱、邮件设置的实际浏览器页面已检查。纸张、明亮和夜间切换成功；最终恢复纸张主题，未保存任何业务表单。
- 纸张实测：画布 rgb(250,249,245)，输入 rgb(245,240,232)，卡片 rgb(255,253,248)，上传分区透明。明亮实测输入 rgb(250,249,245)，卡片白色。检查页面无横向溢出。
- Token 已重新生成。已核对 Figma 原有表面变量，并增加 color/surface/input（VariableID:12:2）、color/surface/card（VariableID:12:3）基础语义别名；未重建全部 Figma 页面或主题模式。

## 验证结果

- `pnpm lint`、`pnpm typecheck` 通过；最终 `pnpm build` 通过（保留既有大包体提示）。
- 主题、SettingsPage、AiSettingsPage 定向测试：3 个文件、5 项测试全部通过。
- 完整回归在机器负载较高时运行超过 13 分钟，ReaderPage 两项交互与 BooklistDetailPage 一项交互失败；本轮已停止，未认定全量回归通过，也未确认失败根因。日志保留在 `/tmp/bookkin-surfaces-tests.log`。
- 最终刷新找回邮箱页面，输入框背景符合预期且无横向溢出。

## 可读性修正

用户反馈初版可读性下降，撤回透明分区方案。共享分区改用 surfaceSoft 背景及内边距，浅色主题输入使用现有 white token，控件边框使用 borderStrong，标签使用 textPrimary/medium。找回邮箱和邮件服务使用同一分区样式；字体上传与 AI 设置同步生效。
浏览器实测找回邮箱：分区 rgb(245,240,232)，输入白色，边框 rgb(142,139,130)，无横向溢出。夜间输入文字 rgb(250,249,245)，最终恢复纸张主题。未提交业务表单。
