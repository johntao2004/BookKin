import { queryOptions } from "@tanstack/react-query";
import { api } from "../api/client";

export const setupStatusQueryKey = ["auth", "setup-status"] as const;

// 初始化状态不使用长期新鲜缓存；页面仅在服务端明确未初始化时展示入口。
// Setup status is not held fresh for a long interval; pages show setup only after the server explicitly reports it uninitialized.
export const setupStatusQueryOptions = queryOptions({
  queryKey: setupStatusQueryKey,
  queryFn: () => api.getSetupStatus(),
  staleTime: 0,
});
