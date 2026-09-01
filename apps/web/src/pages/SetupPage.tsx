import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { setupStatusQueryKey, setupStatusQueryOptions } from "../auth/setup-status";
import { AuthFrame } from "../components/AuthFrame";
import { tokens } from "../theme/generated-tokens";

export function SetupPage() {
  const { setupOwner, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setupStatus = useQuery(setupStatusQueryOptions);
  const [form, setForm] = useState({ username: "owner", displayName: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) return setError("两次输入的密码不一致");
    setLoading(true);
    setError("");
    try {
      await setupOwner({ username: form.username.trim(), displayName: form.displayName.trim(), password: form.password });
      queryClient.setQueryData(setupStatusQueryKey, { initialized: true });
      navigate("/library", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "初始化失败");
    } finally {
      setLoading(false);
    }
  };

  if (setupStatus.isPending) {
    return (
      <AuthFrame title="正在确认书库状态">
        <Stack sx={{ alignItems: "center", py: 4 }}><CircularProgress size={tokens.spacing[8]} /></Stack>
      </AuthFrame>
    );
  }

  if (setupStatus.isError) {
    return (
      <AuthFrame title="暂时无法确认初始化状态">
        <Alert severity="error">为了避免重复初始化，请先重试状态检查。</Alert>
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button variant="contained" onClick={() => void setupStatus.refetch()}>重试</Button>
          <Button component={Link} to="/login">返回登录</Button>
        </Stack>
      </AuthFrame>
    );
  }

  if (setupStatus.data.initialized) return <Navigate to={user ? "/library/all" : "/login"} replace />;

  return (
    <AuthFrame title="建立第一把钥匙" description="主人是唯一可永久清理文件的账户。初始化只允许执行一次。">
      <Stack component="form" spacing={2.5} onSubmit={submit}>
        <TextField label="显示名称" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required autoFocus />
        <TextField label="用户名" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
        <TextField label="密码" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} helperText="至少 12 位，建议使用密码管理器生成。" required slotProps={{ htmlInput: { minLength: 12 } }} />
        <TextField label="确认密码" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? "正在初始化…" : "创建主人账户"}</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>已经初始化？<Link to="/login">返回登录</Link></Typography>
    </AuthFrame>
  );
}
