import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Stack, Typography } from "../ui/primitives";
import { TextField } from "../ui/forms";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { FormActions } from "../components/PageHeader";
export function RecoveryEmailPage() {
  const query=useQuery({queryKey:["recovery-email"],queryFn:api.recoveryEmail});
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [sent,setSent]=useState(false);
  return <Stack component="section" aria-label="找回邮箱" className="bk-form-section" spacing={2}>
    <Typography component="h2" variant="h4">找回邮箱</Typography>
    <Typography color="text.secondary">验证邮箱后，可在忘记密码时通过邮件重置。</Typography>
    <Typography>{query.isPending ? "正在读取找回邮箱…" : query.data?.email ? `已验证邮箱：${query.data.email}` : "尚未绑定找回邮箱。"}</Typography>
    {query.isError && <Alert severity="error">读取失败，请刷新重试。</Alert>}
    <Stack component="form" spacing={2} onSubmit={async (e: FormEvent) => {
      e.preventDefault(); setBusy(true);setError("");setSent(false);
      try {await api.bindRecoveryEmail(email,password);setPassword("");setSent(true);} catch(e) {setError(e instanceof Error?e.message:"发送失败");} finally {setBusy(false);}
    }}>
      <TextField label="找回邮箱" required type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEmail(e.target.value)} />
      <TextField label="当前密码" required type="password" autoComplete="current-password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setPassword(e.target.value)} />
      <FormActions><Button variant="contained" type="submit" disabled={busy}>发送验证链接</Button></FormActions>
    </Stack>
    {sent && <Alert severity="success">验证链接已发送，请在 30 分钟内打开邮件并确认绑定。</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
  </Stack>;
}
