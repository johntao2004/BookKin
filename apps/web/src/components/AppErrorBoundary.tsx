import { Component, type ReactNode } from "react";
import { Alert } from "../ui/feedback";
import { Button } from "../ui/buttons";
import { Stack } from "../ui/primitives";
import { PageContainer } from "./PageHeader";

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
    // A restricted storage context still gets the regular recovery screen.
    return;
  }
  window.location.reload();
}

/** Keep an unexpected render or lazy-chunk failure from leaving a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { reloadForStaleChunk(error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <PageContainer><Stack spacing={3}>
      <Alert severity="error">页面暂时无法显示，请重新加载。已保存到书库的数据不受影响。</Alert>
      <Button variant="contained" onClick={() => window.location.reload()}>重新加载页面</Button>
    </Stack></PageContainer>;
  }
}
