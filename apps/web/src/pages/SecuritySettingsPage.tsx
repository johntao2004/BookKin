// 组合用户安全设置入口，不把前端可见开关当作权限授权。
// Composes user-security controls without treating visible UI switches as authorization.
import { SessionPolicySettings } from "./SessionPolicySettings";
import { PasswordPolicySettings } from "./PasswordPolicySettings";
import { VaultPolicySettings } from "./VaultPolicySettings";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../ui/feedback";
import { Stack, Typography } from "../ui/primitives";
import { Switch } from "../ui/forms";
import { Skeleton } from "../ui/antd";
export function SecuritySettingsPage() {
 const {user} = useAuth(); const client=useQueryClient();
 const query=useQuery({queryKey:["security-settings"],queryFn:api.securitySettings});
 const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 if(query.isPending) return <Skeleton active />;
 if(query.isError) return <Alert severity="error">无法读取安全设置，请刷新重试。</Alert>;
 return <Stack spacing={2} sx={{ width: "100%", minWidth: 0 }}>
  <Stack className="bk-form-section" direction={{ xs: "column", sm: "row" }} sx={{alignItems:{xs:"flex-start",sm:"center"},justifyContent:"space-between",gap:2}}>
   <Stack spacing={1} sx={{minWidth:0}}><Typography variant="h5">开放注册</Typography><Typography color="text.secondary">开启后，访客可以注册普通成员账户。</Typography></Stack>
   <Switch checked={query.data.registrationEnabled} disabled={busy || user?.role!=="OWNER"} slotProps={{input:{"aria-label":"开放注册"}}} sx={{alignSelf:{xs:"flex-end",sm:"auto"},flexShrink:0}} onChange={async (_,enabled) => {
    setBusy(true);setError("");
    try { const result=await api.updateSecuritySettings(enabled);client.setQueryData(["security-settings"],result);await client.invalidateQueries({queryKey:["registration-status"]}); }
    catch(reason) { setError(reason instanceof Error ? reason.message : "保存失败"); }
    finally {setBusy(false);}
   }} />
  </Stack>
  <SessionPolicySettings />
  <VaultPolicySettings />
  <PasswordPolicySettings />
  {user?.role!=="OWNER" && <Typography color="text.secondary">仅主人可修改此设置。</Typography>}
  {error && <Alert severity="error">{error}</Alert>}
 </Stack>;
}
