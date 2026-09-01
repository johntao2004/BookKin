import AddRounded from "@mui/icons-material/AddRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import LockResetRounded from "@mui/icons-material/LockResetRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageContainer, PageHeader } from "../components/PageHeader";
import type { ManagedUser, SessionUser, UserRole } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

const roleLabels: Record<UserRole, string> = { OWNER: "主人", ADMIN: "管理员", MEMBER: "成员" };

export function UsersPage() {
  const { user: sessionUser } = useAuth();
  const client = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const [createOpen, setCreateOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [notice, setNotice] = useState("");

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

  const revokeSessions = async (user: ManagedUser) => {
    try { await api.revokeUserSessions(user.id); setNotice(`${user.displayName}的登录会话已撤销`); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "撤销失败"); }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="ACCESS CONTROL"
        title="用户管理"
        description="BookKin不开放注册。主人和管理员直接创建家庭成员账户；每个人的进度、书签与笔记默认私有。"
        action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>创建用户</Button>}
      />
      <Alert severity="info" sx={{ mb: 3 }}>成员只能阅读；管理员可整理书库和文件；只有主人能永久清理回收站。</Alert>

      {usersQuery.isPending ? <Stack sx={{ alignItems: "center", py: 10 }}><CircularProgress /></Stack> : (
        <>
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <TableContainer sx={{ bgcolor: "background.paper", borderRadius: 3, border: 1, borderColor: "divider", overflowX: "auto" }}>
              <Table aria-label="用户列表" sx={{ minWidth: 920 }}>
                <TableHead><TableRow><TableCell>用户</TableCell><TableCell>角色</TableCell><TableCell>状态</TableCell><TableCell>最后登录</TableCell><TableCell align="right">账户操作</TableCell></TableRow></TableHead>
                <TableBody>
                  {(usersQuery.data ?? []).map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell><UserIdentity user={user} sessionUser={sessionUser} /></TableCell>
                      <TableCell><UserRoleChip user={user} /></TableCell>
                      <TableCell><UserStatus user={user} /></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{formatLastLogin(user.lastLoginAt)}</Typography></TableCell>
                      <TableCell align="right"><Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", alignItems: "center", minWidth: 260 }}>
                        {canManageAccountActions(user, sessionUser) && <><Button size="small" startIcon={<LockResetRounded />} onClick={() => void resetPassword(user)}>临时密码</Button><Button size="small" startIcon={<LogoutRounded />} onClick={() => void revokeSessions(user)}>退出设备</Button></>}
                        <Switch checked={user.status === "ACTIVE"} disabled={!canToggleAccount(user, sessionUser)} onChange={() => void toggle(user)} slotProps={{ input: { "aria-label": `${user.status === "ACTIVE" ? "停用" : "启用"}${user.displayName}` } }} />
                      </Stack></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          <Stack component="section" aria-label="移动端用户列表" spacing={2} sx={{ display: { xs: "flex", md: "none" } }}>
            {(usersQuery.data ?? []).map((user) => (
              <UserCard
                key={user.id}
                user={user}
                sessionUser={sessionUser}
                onResetPassword={resetPassword}
                onRevokeSessions={revokeSessions}
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
      <Stack divider={<Divider flexItem />} spacing={1.5} sx={{ mt: `${tokens.spacing[4]}px` }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">状态</Typography>
          <UserStatus user={user} />
        </Stack>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">最后登录</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "right" }}>{formatLastLogin(user.lastLoginAt)}</Typography>
        </Stack>
      </Stack>
      <Stack spacing={1.25} sx={{ mt: `${tokens.spacing[4]}px` }}>
        {canManageAccountActions(user, sessionUser) && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: "100%" }}>
            <Button size="small" startIcon={<LockResetRounded />} onClick={() => void onResetPassword(user)} sx={{ width: { xs: "100%", sm: "auto" } }}>临时密码</Button>
            <Button size="small" startIcon={<LogoutRounded />} onClick={() => void onRevokeSessions(user)} sx={{ width: { xs: "100%", sm: "auto" } }}>退出设备</Button>
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
      <Stack component="form" onSubmit={submit}>
        <DialogTitle><Typography variant="h4" component="span">创建家庭账户</Typography></DialogTitle>
        <DialogContent><Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField label="显示名称" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required autoFocus />
          <TextField label="用户名" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") })} helperText="仅使用小写字母、数字、点、下划线或短横线。" required />
          <FormControl><InputLabel id="new-user-role">角色</InputLabel><Select labelId="new-user-role" label="角色" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "ADMIN" | "MEMBER" })}><MenuItem value="MEMBER">成员 · 只读藏书</MenuItem>{allowAdmin && <MenuItem value="ADMIN">管理员 · 可管理书库</MenuItem>}</Select></FormControl>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack></DialogContent>
        <DialogActions sx={{ p: 3 }}><Button onClick={onClose} color="inherit">取消</Button><Button type="submit" variant="contained" disabled={loading}>{loading ? "正在创建…" : "创建并生成临时密码"}</Button></DialogActions>
      </Stack>
    </Dialog>
  );
}

function CredentialsDialog({ value, onClose }: { value: { username: string; temporaryPassword: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(`BookKin用户名：${value.username}\n临时密码：${value.temporaryPassword}`);
    setCopied(true);
  };
  return (
    <Dialog open={Boolean(value)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle><Typography variant="h4" component="span">只显示这一次</Typography></DialogTitle>
      <DialogContent><Alert severity="warning" sx={{ mb: 3 }}>临时密码不会再次显示。请通过可信渠道交给该成员。</Alert><Stack spacing={2}><TextField label="用户名" value={value?.username ?? ""} slotProps={{ input: { readOnly: true } }} /><TextField label="临时密码" value={value?.temporaryPassword ?? ""} slotProps={{ input: { readOnly: true } }} /></Stack></DialogContent>
      <DialogActions sx={{ p: 3 }}><Button onClick={onClose} color="inherit">完成</Button><Button variant="contained" startIcon={<ContentCopyRounded />} onClick={copy}>{copied ? "已复制" : "复制登录信息"}</Button></DialogActions>
    </Dialog>
  );
}
