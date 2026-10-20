// 每次测试封装创建独立查询缓存并禁用自动重试，路由、认证与主题上下文按实际组件组合。
// Creates an isolated query cache with retries disabled, composing router, auth and theme contexts for tests.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { BookKinThemeProvider } from "../theme/BookKinThemeProvider";

export function TestProviders({ children, initialPath = "/" }: PropsWithChildren<{ initialPath?: string }>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider><BookKinThemeProvider>{children}</BookKinThemeProvider></AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
