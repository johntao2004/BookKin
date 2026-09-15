import { PasswordRequirements, usePasswordPolicy, passwordRequirements } from "../auth/password-policy";
import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { AuthFrame } from "../components/AuthFrame";
import { Stack } from "../ui/primitives";
import { TextField } from "../ui/forms";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
export function RecoveryPage() {
  const policy=usePasswordPolicy();
  const location=useLocation(); const params=new URLSearchParams(location.hash.slice(1));
  const token=params.get("bind") ?? params.get("reset") ?? "";
  const binding=params.has("bind"); const requesting=location.pathname==="/forgot-password";
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false); const [done,setDone]=useState(false); const [error,setError]=useState("");
  const submit=async (e: FormEvent) => {
    e.preventDefault(); setError("");
    if (!requesting && !binding && password!==confirm) {setError("两次输入的新密码不一致。");return;}
    if (!requesting && !binding && (!policy.data || policy.isError || passwordRequirements(policy.data,password).some(rule=>!rule.met))) {setError("请满足下方密码要求后重试。");return;}
    setBusy(true);
    try {
      if(requesting) await api.requestPasswordReset(email);
      else if(binding) await api.verifyRecoveryEmail(token);
      else await api.resetPassword(token,password);
      setDone(true);setPassword("");setConfirm("");
    } catch(e) {setError(e instanceof Error?e.message:"操作失败");} finally {setBusy(false);}
  };
  return <AuthFrame title={requesting?"找回书房的钥匙":binding?"验证找回邮箱":"设置新密码"} description={requesting?"输入已验证的找回邮箱，我们会发送重置链接。":"链接有效期为 30 分钟，仅可使用一次。"}>
    <Stack component="form" noValidate={!requesting} spacing={2} onSubmit={submit}>
      {done ? <Alert severity="success">{requesting?"如果此邮箱已绑定可用账户，重置链接将发送至收件箱，请同时检查垃圾邮件。":binding?"找回邮箱已验证。":"密码已重置，请使用新密码重新登录。"}</Alert> : <>
        {requesting ? <TextField label="找回邮箱" type="email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEmail(e.target.value)} /> : !binding && <>
          <TextField label="新密码" type="password" required autoComplete="new-password" slotProps={{htmlInput:{maxLength:200}}} value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setPassword(e.target.value)} />
          <PasswordRequirements policy={policy} value={password} />
          <TextField label="确认新密码" type="password" required autoComplete="new-password" value={confirm} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setConfirm(e.target.value)} />
        </>}
        <Button variant="contained" type="submit" disabled={busy || (!requesting && !token)}>{busy?"正在处理…":requesting?"发送重置链接":binding?"确认绑定邮箱":"重置密码"}</Button>
        {!requesting && !token && <Alert severity="error">链接不完整，请重新申请。</Alert>}
      </>}
      {error && <Alert severity="error">{error}</Alert>}
      <Link to="/login">返回登录</Link>{!requesting && <Link to="/forgot-password">重新申请重置链接</Link>}
    </Stack>
  </AuthFrame>;
}
