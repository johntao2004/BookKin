import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "../auth/permissions";
import { api, request } from "../api/client";
import { demoUsers } from "../data/demo";
import type { ManagedUser, UserRole } from "../domain/types";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { Stack, Typography, MenuItem } from "../ui/primitives";
import { Select } from "../ui/forms";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "../ui/overlays";
export function UserRoleControl({ user }: { user: ManagedUser }) {
  const { can } = usePermissions(); const client = useQueryClient();
  const [open, setOpen] = useState(false); const [role, setRole] = useState<UserRole>(user.role); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (!can("roles.manage") || user.role === "OWNER") return null;
  const save = async () => {
    setBusy(true); setError("");
    try {
      let result: ManagedUser;
      if (api.isDemo) { const item = demoUsers.find(u => u.id === user.id); if (!item) throw new Error("用户不存在。"); item.role = role; result = { ...item }; }
      else result = await request<ManagedUser>(`/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ expectedRole: user.role, role }) });
      client.setQueryData<ManagedUser[]>(["users"], old => old?.map(u => u.id === result.id ? result : u));
      await client.invalidateQueries({ queryKey: ["active-sessions"] }); setOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "角色修改失败"); } finally { setBusy(false); }
  };
  return <><Button size="small" onClick={() => { setRole(user.role); setError(""); setOpen(true); }}>调整角色</Button>
    <Dialog open={open} onClose={busy ? undefined : () => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>调整用户角色</DialogTitle><DialogContent><Stack spacing={3}>
        <Typography>{user.displayName}（{user.username}）</Typography>
        <Select label="用户角色" value={role} disabled={busy} onChange={event => setRole(event.target.value as UserRole)}><MenuItem value="MEMBER">成员</MenuItem><MenuItem value="ADMIN">管理员</MenuItem></Select>
        <Typography color="text.secondary">确认后，该账户及其已登录设备会按新角色的权限执行后续操作。请先核对角色权限配置。</Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setOpen(false)}>取消</Button><Button variant="contained" disabled={busy || role === user.role} onClick={() => void save()}>确认调整</Button></DialogActions>
    </Dialog></>;
}
