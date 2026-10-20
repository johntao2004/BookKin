// 统一图表构造入口的重导出，不在业务页面引入另一套主题初始化。
// Re-exports the shared chart-construction entry rather than introducing separate page-level theme initialization.
export { createBookKinChart } from "./antv";
