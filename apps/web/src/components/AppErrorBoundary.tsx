import { Component, type ReactNode } from "react";
import { Button } from "../ui/buttons";
import { ApiRequestError } from "../api/errors";
import { HttpErrorPage, pageFailure, type PageFailure } from "../pages/HttpErrorPage";

const chunkReloadKey = "bookkin:chunk-reload-at";
const chunkReloadWindowMs = 60_000;

function isDynamicImportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:chunkloaderror|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk)/i.test(message);
}

function reloadForStaleChunk(error: unknown) {
  if (!isDynamicImportError(error)) return;
  try {
    const previous = Number(sessionStorage.getItem(chunkReloadKey));
    if (Number.isFinite(previous) && Date.now() - previous < chunkReloadWindowMs) return;
    sessionStorage.setItem(chunkReloadKey, String(Date.now()));
  } catch {
    // 存储受限时仍显示正常的恢复界面。
    // A restricted storage context still gets the regular recovery screen.
    return;
  }
  window.location.reload();
}

// 捕获意外渲染或延迟模块加载失败，避免整页空白。
/** Keep an unexpected render or lazy-chunk failure from leaving a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failure: PageFailure | null }> {
  state: { failure: PageFailure | null } = { failure: null };
  static getDerivedStateFromError(error: unknown) { return { failure: error instanceof ApiRequestError ? pageFailure(error)
    : { code: isDynamicImportError(error) ? "PAGE_MODULE_LOAD_FAILED" : "CLIENT_RENDER_ERROR", reason: isDynamicImportError(error) ? "页面资源加载失败，请重新加载页面。" : "页面显示发生异常，请重新加载；若问题持续，请将错误代码提供给管理员。" } }; }
  componentDidCatch(error: unknown) { reloadForStaleChunk(error); }
  render() {
    if (!this.state.failure) return this.props.children;
    return <HttpErrorPage fullHeight failure={this.state.failure} title="页面暂时无法显示"
      actions={<Button variant="contained" onClick={() => window.location.reload()}>重新加载</Button>} />;
  }
}
