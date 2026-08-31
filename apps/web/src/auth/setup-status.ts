import { queryOptions } from "@tanstack/react-query";
import { api } from "../api/client";

export const setupStatusQueryKey = ["auth", "setup-status"] as const;

export const setupStatusQueryOptions = queryOptions({
  queryKey: setupStatusQueryKey,
  queryFn: () => api.getSetupStatus(),
  staleTime: 0,
});
