import { Alert } from "@/ui";
import { Button } from "@/ui";
import { LinearProgress } from "@/ui";
import { Stack } from "@/ui";
import { TextField } from "@/ui";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthFrame } from "../components/AuthFrame";

export function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = Math.min(100, Math.max(8, newPassword.length * 6 + (/[A-Z]/.test(newPassword) ? 12 : 0) + (/\d/.test(newPassword) ? 10 : 0)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return setError("两次输入的新密码不一致");
    setLoading(true);
    setError("");
    try {
      await changePassword(currentPassword, newPassword);
      navigate("/library", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "密码更新失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="先换一把自己的钥匙" description="管理员创建的是临时密码。完成修改后，才能进入藏书与阅读数据。">
      <Stack component="form" spacing={2.5} onSubmit={submit}>
        <TextField label="当前临时密码" type="password" autoComplete="current-password" value={currentPassword} onChange={(event: any) => setCurrentPassword(event.target.value)} required autoFocus />
        <TextField label="新密码" type="password" autoComplete="new-password" value={newPassword} onChange={(event: any) => setNewPassword(event.target.value)} required slotProps={{ htmlInput: { minLength: 12 } }} />
        <LinearProgress variant="determinate" value={strength} color={strength >= 75 ? "success" : "primary"} sx={{ height: 4, borderRadius: 2 }} />
        <TextField label="确认新密码" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event: any) => setConfirmPassword(event.target.value)} required />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? "正在保存…" : "保存并进入书库"}</Button>
      </Stack>
    </AuthFrame>
  );
}
