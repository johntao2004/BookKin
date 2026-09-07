import { Component, type ReactNode } from "react";
import { Alert, Button, Stack } from "../ui";
import { PageContainer } from "./PageHeader";

/** Keep an unexpected render or lazy-chunk failure from leaving a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <PageContainer><Stack spacing={3}>
      <Alert severity="error">页面暂时无法显示，请重新加载。已保存到书库的数据不受影响。</Alert>
      <Button variant="contained" onClick={() => window.location.reload()}>重新加载页面</Button>
    </Stack></PageContainer>;
  }
}
