import { useState, type FormEvent } from "react";
import { TextField } from "../ui/forms";
import { Alert } from "../ui/feedback";
import { ChangePasswordPage } from "./ChangePasswordPage";
import { useAuth } from "../auth/AuthContext";
import { FormActions, PageContainer, PageHeader } from "../components/PageHeader";
import { Stack, Typography } from "../ui/primitives";
import { Button } from "../ui/buttons";
import { RecoveryEmailPage } from "./RecoveryEmailPage";

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false);
    try { await updateProfile({username, displayName, currentPassword: password}); setUsername(username.toLowerCase()); setDisplayName(displayName.trim()); setPassword(""); setSaved(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试。"); }
    finally { setBusy(false); }
  }
  if (!user) return null;
  const role = { OWNER: "主人", ADMIN: "管理员", MEMBER: "成员" }[user.role];
  return <PageContainer>
    <PageHeader title="个人信息" description="查看账户资料，管理邮箱与账户安全。" />
    <Stack spacing={3}>
      <Stack component="section" className="bk-form-section" spacing={2} aria-label="账户资料">
        <Typography component="h2" variant="h4">账户资料</Typography>
        <Typography>账户角色：{role}</Typography>
        <Stack component="form" spacing={2} onSubmit={save}>
          <TextField label="用户名" value={username} required disabled={busy} helperText="3–80 位字母、数字、点、下划线或短横线；保存后使用新用户名登录。" slotProps={{htmlInput:{pattern:"[a-zA-Z0-9._-]{3,80}",maxLength:80}}} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setUsername(e.target.value)} />
          <TextField label="账户名字" value={displayName} required disabled={busy} slotProps={{htmlInput:{maxLength:120}}} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setDisplayName(e.target.value)} />
          <TextField label="当前密码（确认资料修改）" type="password" autoComplete="current-password" value={password} required disabled={busy} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setPassword(e.target.value)} />
          {error && <Alert severity="error">{error}</Alert>}
          {saved && <Alert severity="success">账户资料已保存。</Alert>}
          <FormActions><Button type="submit" variant="contained" disabled={busy}>{busy ? "正在保存…" : "保存账户资料"}</Button></FormActions>
        </Stack>
      </Stack>
      <RecoveryEmailPage />
      <Stack component="section" className="bk-form-section" spacing={2} aria-label="登录密码">
        <Typography component="h2" variant="h4">登录密码</Typography>
        <Typography color="text.secondary">定期检查账户安全，修改密码时需要验证当前密码。</Typography>
        <ChangePasswordPage embedded />
      </Stack>
    </Stack>
  </PageContainer>;
}
