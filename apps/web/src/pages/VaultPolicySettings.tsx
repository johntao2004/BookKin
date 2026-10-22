import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { vaultAccessApi } from "../features/vault/access-api";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../ui/feedback";
import { Stack, Typography } from "../ui/primitives";
import { Switch } from "../ui/forms";
import { Skeleton } from "../ui/antd";

export function VaultPolicySettings() {
  const { user } = useAuth(); const client = useQueryClient();
  const query = useQuery({ queryKey: ["vault-policy"], queryFn: vaultAccessApi.policy });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (query.isPending) return <Skeleton active />;
  if (query.isError) return <Alert severity="error">无法读取禁书区设置，请刷新重试。</Alert>;
  return <Stack className="bk-form-section" spacing={2}>
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 2 }}>
      <Stack spacing={1} sx={{ minWidth: 0 }}>
        <Typography variant="h5">禁书区</Typography>
        <Typography color="text.secondary">开启后，具备禁书区权限的用户须绑定身份验证器，通过 2FA 验证后进入。关闭后暂停访问，已加密内容仍保留。</Typography>
      </Stack>
      <Switch checked={query.data.enabled} disabled={busy || user?.role !== "OWNER" || (!query.data.configured && !query.data.enabled)} slotProps={{ input: { "aria-label": "启用禁书区" } }} sx={{ alignSelf: { xs: "flex-end", sm: "auto" }, flexShrink: 0 }} onChange={async (_, enabled) => {
        setBusy(true); setError("");
        try { const saved = await vaultAccessApi.savePolicy(enabled, query.data.revision); client.setQueryData(["vault-policy"], saved); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); }
        finally { setBusy(false); }
      }} />
    </Stack>
    {!query.data.configured && <Alert severity="warning">尚未配置身份验证器服务。请在服务器配置 BOOKKIN_TWO_FACTOR_ENCRYPTION_KEY 后重启，再启用禁书区。</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
  </Stack>;
}
