import { useQuery, useQueryClient } from "@tanstack/react-query";
import { vaultAccessApi } from "./access-api";

export const vaultNavigationStatusKey = (userId: string) => ["vault-navigation-status", userId] as const;

/** Read only the visit-authorized status endpoint; never query the owner-only policy endpoint here. */
export function useVaultNavigationStatus(userId: string | undefined, canVisitVault: boolean) {
  const query = useQuery({
    queryKey: vaultNavigationStatusKey(userId ?? "anonymous"),
    queryFn: async () => (await vaultAccessApi.status()).enabled,
    enabled: Boolean(userId && canVisitVault),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  return Boolean(userId && canVisitVault && query.isSuccess && query.data === true);
}

export function publishVaultPolicyChange(enabled: boolean, userId: string, client: ReturnType<typeof useQueryClient>) {
  client.setQueryData(vaultNavigationStatusKey(userId), enabled);
}
