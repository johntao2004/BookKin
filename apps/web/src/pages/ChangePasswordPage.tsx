import { FormActions } from "../components/PageHeader";
import { Alert } from "@/ui/feedback";
import { Button } from "@/ui/buttons";
import { PasswordRequirements, usePasswordPolicy, passwordRequirements } from "../auth/password-policy";
import { Stack } from "@/ui/primitives";
import { TextField } from "@/ui/forms";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthFrame } from "../components/AuthFrame";

export function ChangePasswordPage({ embedded = false }: { embedded?: boolean }) {
  const policy = usePasswordPolicy();
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSuccess(false);
    if (newPassword !== confirmPassword) return setError("两次输入的新密码不一致");
    if (!policy.data || policy.isError) return setError("请先加载密码规则。");
    const missing = passwordRequirements(policy.data,newPassword).filter(rule=>!rule.met);
    if (missing.length) return setError(missing.map(rule=>rule.label).join("；"));
    setLoading(true);
    setError("");
    try {
      await changePassword(currentPassword, newPassword);
      if (embedded) { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setSuccess(true); }
      else navigate(user?.mustChangePassword ? "/library" : "/profile", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "密码更新失败");
    } finally {
      setLoading(false);
    }
  };

  const form = (
      <Stack component="form" noValidate spacing={2.5} onSubmit={submit}>
        <TextField label={user?.mustChangePassword ? "当前临时密码" : "当前密码"} type="password" autoComplete="current-password" value={currentPassword} onChange={(event: any) => setCurrentPassword(event.target.value)} required autoFocus={!embedded} />
        <TextField label="新密码" type="password" autoComplete="new-password" value={newPassword} onChange={(event: any) => setNewPassword(event.target.value)} required slotProps={{ htmlInput: { maxLength: 200 } }} />
        <PasswordRequirements policy={policy} value={newPassword} />
        <TextField label="确认新密码" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event: any) => setConfirmPassword(event.target.value)} required />
        {success && <Alert severity="success">登录密码已更新。</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {embedded ? <FormActions><Button type="submit" variant="contained" disabled={loading || !policy.data || policy.isError}>{loading ? "正在保存…" : user?.mustChangePassword ? "保存并进入书库" : "保存密码"}</Button></FormActions> : <Button type="submit" variant="contained" size="large" disabled={loading || !policy.data || policy.isError}>{loading ? "正在保存…" : user?.mustChangePassword ? "保存并进入书库" : "保存密码"}</Button>}
      </Stack>
  );
  if (embedded) return form;
  return <AuthFrame title={user?.mustChangePassword ? "先换一把自己的钥匙" : "修改登录密码"} description={user?.mustChangePassword ? "管理员创建的是临时密码。完成修改后，才能进入藏书与阅读数据。" : "验证当前密码，为账户设置新的登录密码。"}>{form}</AuthFrame>;
}
