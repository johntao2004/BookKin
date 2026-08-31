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
