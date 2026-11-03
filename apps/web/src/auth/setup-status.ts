import { queryOptions } from "@tanstack/react-query";
import { api } from "../api/client";

export const setupStatusQueryKey = ["auth", "setup-status"] as const;

// Setup state is anonymous and stable enough to reuse briefly during app startup.
// A failed request is never treated as proof that initialization is required.
export const setupStatusQueryOptions = queryOptions({
  queryKey: setupStatusQueryKey,
  queryFn: ({ signal }) => api.getSetupStatus(signal),
  staleTime: 60_000,
  retry: false,
  refetchOnWindowFocus: false,
});
