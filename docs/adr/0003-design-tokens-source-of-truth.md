# ADR-0003：仓库 JSON 是设计 Token 唯一数值真源

- 状态：已采纳
- 日期：2026-08-20

## 决策

颜色、间距、圆角、排版尺寸、阴影和布局常量只在 `design/tokens.json` 定义。生成器产出 Ant Design/BookKin UI/CSS 绑定；Figma 变量使用相同名称和 Web code syntax。

## 后果

Figma 负责设计结构和交互表达，但不成为第二套数值来源。任何设计调整先更新 JSON，再同步代码和 Figma。
