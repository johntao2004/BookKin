# 全局紧凑操作菜单（2026-10-19）

共享 Menu 与 Ant Design Dropdown/Menu 统一使用 14px 字号、18px 图标、36px 桌面行高。共享操作菜单最小宽度由 220px 改为 180px，面板内边距由 8px 改为 4px；移除旧图标右外边距，避免与菜单 gap 重复。粗指针设备保留 44px 行高。颜色、危险操作、键盘关闭与浮层定位逻辑沿用原实现。

新增命名设计 Token，已运行 generate:tokens 同步 CSS/TS 产物。

浏览器验证 `/library/all`：书籍操作菜单实际宽 180px，五行各 36px，字体 14px，图标 18px。账户菜单同步紧凑，Escape 关闭正常。本次未点击写操作。

截图：`compact-menus-2026-10-19.png`。

类型检查、lint、构建通过；Overlay、BookCard、AppShell 三个测试文件共 21 项通过。控制台 error 日志为空。此次未重复全量测试，未提交、推送或部署。Figma 变量未作在线核验。
