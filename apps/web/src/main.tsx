// 应用根统一提供查询缓存、路由、认证、主题和错误边界；变更请求默认不自动重试。
// The root supplies query cache, routing, auth, theme and error boundaries; mutations do not retry automatically by default.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AuthProvider } from "./auth/AuthContext";
import { SilvaeThemeProvider } from "./theme/SilvaeThemeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SilvaeThemeProvider><AppErrorBoundary><App /></AppErrorBoundary></SilvaeThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
