import { EmptyState } from "../ui/empty-state";
import { RevokeSessionsDialog } from "../components/RevokeSessionsDialog";
import { DataTable, TableAction } from "@/ui/antd";
import { AddRounded } from "@/ui/icons";
import { IconButton } from "@/ui/buttons";
import { ContentCopyRounded } from "@/ui/icons";
import { LockResetRounded } from "@/ui/icons";
import { LogoutRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Avatar } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Dialog } from "@/ui/overlays";
import { DialogActions } from "@/ui/overlays";
import { DialogContent } from "@/ui/overlays";
import { DialogTitle } from "@/ui/overlays";
import { Divider } from "@/ui/feedback";
import { FormControl } from "@/ui/primitives";
import { InputLabel } from "@/ui/primitives";
import { MenuItem } from "@/ui/primitives";
import { Select } from "@/ui/forms";
import { Snackbar } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Switch } from "@/ui/forms";
import { TextField } from "@/ui/forms";
import { Typography } from "@/ui/primitives";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useContext, useEffect, type FormEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ActionToolbar, EmbeddedSettingsContext, PageContainer, PageHeader } from "../components/PageHeader";
import type { ManagedUser, SessionUser, UserRole } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

const roleLabels: Record<UserRole, string> = { OWNER: "主人", ADMIN: "管理员", MEMBER: "成员" };
const dialogViewportMaxHeight = `calc(100dvh - ${tokens.spacing[6]}px)`;

export function UsersPage() {
  const embedded = useContext(EmbeddedSettingsContext);
  const { user: sessionUser } = useAuth();
  const client = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const [createOpen, setCreateOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<ManagedUser | null>(null);

  const toggle = async (user: ManagedUser) => {
    try {
      const updated = await api.toggleUser(user.id);
      client.setQueryData<ManagedUser[]>(["users"], (current = []) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`${updated.displayName}已${updated.status === "ACTIVE" ? "启用" : "停用"}`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "操作失败");
    }
  };

  const resetPassword = async (user: ManagedUser) => {
    try {
      const result = await api.resetTemporaryPassword(user.id);
      client.setQueryData<ManagedUser[]>(["users"], (current = []) => current.map((item) => item.id === user.id ? { ...item, mustChangePassword: true } : item));
      setCredentials(result);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "重置失败"); }
  };


  return (
    <PageContainer>
      {embedded ? <Stack sx={{ mb: 2 }}><ActionToolbar><Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>创建用户</Button></ActionToolbar></Stack> : <PageHeader
        eyebrow="ACCESS CONTROL"
        title="用户管理"
        action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>创建用户</Button>}
      />}

      {usersQuery.isPending ? <Stack sx={{ alignItems: "center", py: 10 }}><CircularProgress /></Stack> : (
        <>
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <DataTable<ManagedUser>
              aria-label="用户列表"
              locale={{ emptyText: <EmptyState compact title="暂无用户" /> }}
              rowKey="id"
              size="middle"
              pagination={false}
              dataSource={usersQuery.data ?? []}
              scroll={{ x: tokens.spacing[24] * 10 }}
              columns={[
                { title: "用户", key: "identity", width: tokens.spacing[24] * 2.5, render: (_, user) => <UserIdentity user={user} sessionUser={sessionUser} /> },
                { title: "角色", key: "role", width: tokens.spacing[24] * 1.25, render: (_, user) => <UserRoleChip user={user} /> },
                { title: "状态", key: "status", width: tokens.spacing[24] * 1.5, render: (_, user) => <UserStatus user={user} /> },
                { title: "最后登录", dataIndex: "lastLoginAt", width: tokens.spacing[24] * 2.5, render: (value) => formatLastLogin(value) },
                { title: "启用", key: "enabled", width: tokens.spacing[24], render: (_, user) => (
                  <Switch checked={user.status === "ACTIVE"} disabled={!canToggleAccount(user, sessionUser)} onChange={() => void toggle(user)} slotProps={{ input: { "aria-label": `${user.status === "ACTIVE" ? "停用" : "启用"}${user.displayName}` } }} />
                ) },
                { title: "账户操作", key: "actions", width: tokens.spacing[24] * 2.5, render: (_, user) => canManageAccountActions(user, sessionUser) ? (
                  <Stack direction="row" spacing={2}>
                    <TableAction onClick={() => void resetPassword(user)}>临时密码</TableAction>
                    <TableAction onClick={() => setRevokeTarget(user)}>退出全部会话</TableAction>
                  </Stack>
                ) : "—" },
              ]}
            />
          </Box>
          <Stack component="section" aria-label="移动端用户列表" spacing={2} sx={{ display: { xs: "flex", sm: "none" } }}>
            {usersQuery.isSuccess && usersQuery.data.length === 0 && <EmptyState compact title="暂无用户" />}
            {(usersQuery.data ?? []).map((user) => (
              <UserCard
                key={user.id}
                user={user}
                sessionUser={sessionUser}
                onResetPassword={resetPassword}
                onRevokeSessions={async user => { setRevokeTarget(user); }}
                onToggle={toggle}
              />
            ))}
          </Stack>
        </>
      )}

      <CreateUserDialog
        open={createOpen}
        allowAdmin={sessionUser?.role === "OWNER"}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          client.setQueryData<ManagedUser[]>(["users"], (current = []) => [result.user, ...current]);
          setCredentials({ username: result.user.username, temporaryPassword: result.temporaryPassword });
          setCreateOpen(false);
        }}
      />
      <RevokeSessionsDialog target={revokeTarget} onClose={() => setRevokeTarget(null)} onRevoked={() => {setNotice("已通知在线设备保存阅读数据并退出全部会话");void client.invalidateQueries({queryKey:["active-sessions"]});}} />
      <CredentialsDialog value={credentials} onClose={() => setCredentials(null)} />
      <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice("")} message={notice} />
    </PageContainer>
  );
}

function UserCard({ user, sessionUser, onResetPassword, onRevokeSessions, onToggle }: {
  user: ManagedUser;
  sessionUser: SessionUser | null;
  onResetPassword: (user: ManagedUser) => Promise<void>;
  onRevokeSessions: (user: ManagedUser) => Promise<void>;
  onToggle: (user: ManagedUser) => Promise<void>;
}) {
  return (
    <Box component="article" sx={{ p: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[5]}px` }, bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: `${tokens.radius.xl}px` }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between", minWidth: 0 }}>
        <UserIdentity user={user} sessionUser={sessionUser} />
        <UserRoleChip user={user} />
      </Stack>
      <Stack spacing={1.5} sx={{ mt: `${tokens.spacing[4]}px` }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">状态</Typography>
          <UserStatus user={user} />
        </Stack>
        <Divider flexItem />
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">最后登录</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "right" }}>{formatLastLogin(user.lastLoginAt)}</Typography>
        </Stack>
      </Stack>
      <Stack spacing={1.25} sx={{ mt: `${tokens.spacing[4]}px` }}>
        {canManageAccountActions(user, sessionUser) && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: "100%" }}>
            <Button size="small" startIcon={<LockResetRounded />} onClick={() => void onResetPassword(user)} sx={{ width: { xs: "100%", sm: "auto" } }}>临时密码</Button>
            <Button size="small" startIcon={<LogoutRounded />} onClick={() => void onRevokeSessions(user)} sx={{ width: { xs: "100%", sm: "auto" } }}>退出全部会话</Button>
          </Stack>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">账户状态</Typography>
          <Switch checked={user.status === "ACTIVE"} disabled={!canToggleAccount(user, sessionUser)} onChange={() => void onToggle(user)} slotProps={{ input: { "aria-label": `${user.status === "ACTIVE" ? "停用" : "启用"}${user.displayName}` } }} />
        </Stack>
      </Stack>
    </Box>
  );
}

function UserIdentity({ user, sessionUser }: { user: ManagedUser; sessionUser: SessionUser | null }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
      <Avatar sx={{ flexShrink: 0, bgcolor: user.role === "OWNER" ? "primary.main" : "secondary.main" }}>{user.displayName.slice(0, 1)}</Avatar>
      <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{user.displayName}{user.id === sessionUser?.id && "（你）"}</Typography><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>@{user.username}</Typography></Box>
    </Stack>
  );
}

function UserRoleChip({ user }: { user: ManagedUser }) {
  return <Chip label={roleLabels[user.role]} color={user.role === "OWNER" ? "primary" : "default"} variant={user.role === "MEMBER" ? "outlined" : "filled"} size="small" />;
}

function UserStatus({ user }: { user: ManagedUser }) {
  return <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Box sx={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", bgcolor: user.status === "ACTIVE" ? "success.main" : "text.disabled" }} /><Typography variant="body2">{user.status === "ACTIVE" ? (user.mustChangePassword ? "等待首次改密" : "正常") : "已停用"}</Typography></Stack>;
}

function formatLastLogin(value?: string) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "尚未登录";
}

function canManageAccountActions(user: ManagedUser, sessionUser: SessionUser | null) {
  return user.role !== "OWNER" && user.id !== sessionUser?.id && (sessionUser?.role === "OWNER" || user.role === "MEMBER");
}

function canToggleAccount(user: ManagedUser, sessionUser: SessionUser | null) {
  return user.role !== "OWNER" && user.id !== sessionUser?.id && !(sessionUser?.role === "ADMIN" && user.role !== "MEMBER");
}

function CreateUserDialog({ open, allowAdmin, onClose, onCreated }: {
  open: boolean;
  allowAdmin: boolean;
  onClose: () => void;
  onCreated: (value: { user: ManagedUser; temporaryPassword: string }) => void;
}) {
  const [form, setForm] = useState<{ username: string; displayName: string; role: Exclude<UserRole, "OWNER"> }>({ username: "", displayName: "", role: "MEMBER" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onCreated(await api.createUser(form));
      setForm({ username: "", displayName: "", role: "MEMBER" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建失败");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <Stack component="form" onSubmit={submit} sx={{ maxHeight: dialogViewportMaxHeight, minHeight: 0 }}>
        <DialogTitle sx={{ flexShrink: 0 }}><Typography variant="h4" component="span">创建家庭账户</Typography></DialogTitle>
        <DialogContent sx={{ minHeight: 0, overflowY: "auto" }}><Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField label="显示名称" value={form.displayName} onChange={(event: any) => setForm({ ...form, displayName: event.target.value })} required autoFocus />
          <TextField label="用户名" value={form.username} onChange={(event: any) => setForm({ ...form, username: event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") })} helperText="仅使用小写字母、数字、点、下划线或短横线。" required />
          <FormControl><InputLabel id="new-user-role">角色</InputLabel><Select labelId="new-user-role" label="角色" value={form.role} onChange={(event: any) => setForm({ ...form, role: event.target.value as "ADMIN" | "MEMBER" })}><MenuItem value="MEMBER">成员 · 只读藏书</MenuItem>{allowAdmin && <MenuItem value="ADMIN">管理员 · 可管理书库</MenuItem>}</Select></FormControl>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack></DialogContent>
        <DialogActions sx={{ flexShrink: 0, flexWrap: "wrap", p: { xs: 2, sm: 3 } }}><Button onClick={onClose} color="inherit" sx={{ width: { xs: "100%", sm: "auto" } }}>取消</Button><Button type="submit" variant="contained" disabled={loading} sx={{ width: { xs: "100%", sm: "auto" } }}>{loading ? "正在创建…" : "创建并生成临时密码"}</Button></DialogActions>
      </Stack>
    </Dialog>
  );
}

export function CredentialsDialog({ value, onClose }: { value: { username: string; temporaryPassword: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  useEffect(() => { setCopied(false); setCopyError(""); }, [value]);
  const copy = async () => {
    if (!value) return;
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(value.temporaryPassword);
      setCopied(true);
    } catch {
      setCopyError("当前浏览器无法自动复制，请选中临时密码手动复制。");
    }
  };
  return (
    <Dialog open={Boolean(value)} onClose={onClose} fullWidth maxWidth="sm">
      <Stack sx={{ maxHeight: dialogViewportMaxHeight, minHeight: 0 }}>
        <DialogTitle sx={{ flexShrink: 0 }}><Typography variant="h4" component="span">只显示这一次</Typography></DialogTitle>
        <DialogContent sx={{ minHeight: 0, overflowY: "auto" }}><Alert severity="warning" sx={{ mb: 3 }}>临时密码不会再次显示。请通过可信渠道交给该成员。</Alert><Stack spacing={2}><Box><Typography variant="body2" color="text.secondary">用户名</Typography><Typography sx={{ mt: 1, overflowWrap: "anywhere" }}>{value?.username}</Typography></Box><TextField label="临时密码" value={value?.temporaryPassword ?? ""} slotProps={{ input: { readOnly: true, endAdornment: <IconButton aria-label={copied ? "已复制临时密码" : "复制临时密码"} onClick={() => void copy()}><ContentCopyRounded /></IconButton> } }} /></Stack>{copyError && <Alert severity="info" sx={{ mt: 3 }}>{copyError}</Alert>}</DialogContent>
        <DialogActions sx={{ flexShrink: 0, flexWrap: "wrap", p: { xs: 2, sm: 3 } }}><Button variant="contained" onClick={onClose} sx={{ width: { xs: "100%", sm: "auto" } }}>完成</Button></DialogActions>
      </Stack>
    </Dialog>
  );
}
