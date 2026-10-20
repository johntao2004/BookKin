# 统一圆角验收

用户确认：矩形 UI 固定使用约 7.42px（12px / φ），保留功能性圆形。

- Token：radius.xs/sm/md/lg/xl/2xl = 7.416408；none/full/pill 保留其结构和圆形用途。
- 共享 sx 转换：旧数字圆角统一到 radius.md，保留 0 和 full。矩形标签、3D 页控件、图标按钮和回顶按钮去除胶囊/圆形圆角覆盖。
- 读书批注内联标记和 PDF 标记改用同一 CSS Token。
- Figma：实时同步现有五个矩形圆角变量，读回 7.416408061981201；xs 原本不存在，未新增。
- 浏览器：127.0.0.1:4176/library/all；卡片、封面裁切容器、按钮、选择框、上传弹窗和弹窗关闭按钮 computed border-radius 均为 7.41641px；头像 9999px。上传弹窗可正常打开/关闭，控制台 error 列表为空。
- 截图：unified-radius-2026-10-20.png。
- 本次为桌面代表组件验收，未逐一访问所有页面或进行实体移动设备测试。
- 检查结果：lint、typecheck、check:tokens、diff --check 通过；Vitest 109 文件、431 用例全部通过；生产构建通过（保留大体积 chunk 提示）。
