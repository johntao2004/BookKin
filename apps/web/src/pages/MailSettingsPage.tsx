import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type MailSettings } from "../api/client";
import { Stack, Typography } from "../ui/primitives";
import { TextField, Switch, Select } from "../ui/forms";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { Skeleton } from "../ui/antd";
import { ActionToolbar, PageHeader } from "../components/PageHeader";

export function MailSettingsPage() {
  const query = useQuery({queryKey: ["mail-settings"], queryFn: api.mailSettings});
  if (query.isPending) return <Skeleton active />;
  if (query.isError) return <><Alert severity="error">邮件配置加载失败。</Alert><Button onClick={() => query.refetch()}>重试</Button></>;
  return <MailForm initial={query.data} />;
}
function MailForm({initial}: {initial: MailSettings}) {
  const client = useQueryClient();
  const [form, setForm] = useState(initial);
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const update = (patch: Partial<MailSettings>) => { setForm({...form,...patch}); setDirty(true); };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch(e) { setError(e instanceof Error ? e.message : "操作失败"); } finally { setBusy(false); }
  };
  return <Stack spacing={3}>
    <PageHeader title="邮件服务" description="配置 SMTP，用于发送找回邮箱验证和密码重置链接。仅主人可修改。" />
    <Stack className="bk-form-section" component="form" spacing={2} onSubmit={(e: FormEvent) => {e.preventDefault(); void run(async () => {
      const saved = await api.saveMailSettings(form); setForm(saved); client.setQueryData(["mail-settings"], saved); setDirty(false); setMessage("邮件配置已保存。");
    });}}>
      <Stack direction="row" spacing={2}><Typography>启用邮件服务</Typography><Switch disabled={busy} checked={form.enabled} onChange={(_,v) => update({enabled:v})} slotProps={{input:{"aria-label":"启用邮件服务"}}} /></Stack>
      <TextField disabled={busy} label="SMTP 主机" required value={form.host} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({host:e.target.value})} />
      <TextField disabled={busy} label="SMTP 端口" required type="number" value={form.port} slotProps={{htmlInput:{min:1,max:65535}}} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({port:Number(e.target.value)})} />
      <Stack spacing={1}><Typography>连接加密</Typography><Select disabled={busy} label="连接加密" value={form.security} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({security:e.target.value})}>
        <option value="STARTTLS">STARTTLS（通常为 587）</option><option value="TLS">TLS（通常为 465）</option><option value="LOCAL">本机测试，不加密</option>
      </Select></Stack>
      <TextField disabled={busy} label="SMTP 用户名" autoComplete="off" value={form.username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({username:e.target.value})} />
      <TextField disabled={busy} label="SMTP 密码或授权码" type="password" autoComplete="new-password" helperText={form.passwordConfigured ? "已保存，留空保留原授权码。" : "填写邮件服务商提供的密码或授权码。"} value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({password:e.target.value})} />
      <TextField disabled={busy} label="发件邮箱" type="email" required value={form.sender} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({sender:e.target.value})} />
      <TextField disabled={busy} label="BookKin 站点地址" type="url" required helperText="邮件链接将使用此地址。正式使用请填写可访问的 HTTPS 地址。" value={form.publicUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({publicUrl:e.target.value})} />
      <ActionToolbar><Button type="submit" variant="contained" disabled={busy}>保存邮件配置</Button></ActionToolbar>
    </Stack>
    <Stack className="bk-form-section" component="form" spacing={2} onSubmit={(e: FormEvent) => {e.preventDefault(); void run(async () => {await api.testMail(recipient); setMessage("测试邮件已提交，请检查收件箱和垃圾邮件。");});}}>
      <Typography variant="h5">发送测试邮件</Typography>
      <TextField disabled={busy} label="测试收件邮箱" type="email" required value={recipient} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)} />
      <ActionToolbar><Button type="submit" disabled={busy || dirty || !form.enabled}>发送测试邮件</Button></ActionToolbar>
      {dirty && <Typography color="text.secondary">请先保存配置，再发送测试邮件。</Typography>}
    </Stack>
    {message && <Alert severity="success">{message}</Alert>}{error && <Alert severity="error">{error}</Alert>}
  </Stack>;
}
