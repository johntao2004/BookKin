// 保留稳定页面导出名称，实际场景生命周期由 VirtualLibraryExperience 负责，避免重复实现。
// Keeps a stable page export while VirtualLibraryExperience owns scene lifecycle, avoiding duplicate implementations.
export { VirtualLibraryExperience as VirtualLibraryPage } from "./VirtualLibraryExperience";
