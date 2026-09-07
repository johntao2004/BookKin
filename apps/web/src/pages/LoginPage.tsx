import { VisibilityOffOutlined } from "@/ui/icons";
import { VisibilityOutlined } from "@/ui/icons";
import { Alert } from "@/ui";
import { Button } from "@/ui";
import { IconButton } from "@/ui";
import { InputAdornment } from "@/ui";
import { Stack } from "@/ui";
import { TextField } from "@/ui";
import { Typography } from "@/ui";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { setupStatusQueryOptions } from "../auth/setup-status";
import { api } from "../api/client";
import { AuthFrame } from "../components/AuthFrame";
import { getLoginGreeting } from "./login-greeting";

export function getLoginDefaults(isDemo: boolean) {
  return isDemo
    ? { username: "owner", password: "bookkin-demo", hint: "内存演示模式：owner / bookkin-demo" }
    : { username: "", password: "", hint: "" };
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const defaults = getLoginDefaults(api.isDemo);
  const [username, setUsername] = useState(defaults.username);
  const [password, setPassword] = useState(defaults.password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const registration = useQuery({queryKey:["registration-status"],queryFn:api.registrationStatus,staleTime:0,refetchOnMount:"always",refetchOnWindowFocus:"always",refetchInterval:5000});
  const setupStatus = useQuery(setupStatusQueryOptions);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(user.mustChangePassword ? "/change-password" : from ?? "/library", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="回到你的书房" description="请输入用户名和密码，继续访问你的书房。" greeting={getLoginGreeting(new Date().getHours())}>
      {(location.state as {registered?:boolean} | null)?.registered && <Alert severity="success">注册成功，请登录。</Alert>}
      <Stack component="form" spacing={2.5} onSubmit={submit}>
        <TextField label="用户名" autoComplete="username" value={username} onChange={(event: any) => setUsername(event.target.value)} required autoFocus />
        <TextField
          label="密码"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(event: any) => setPassword(event.target.value)}
          required
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"} edge="end">
                    {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? "正在登录…" : "登录"}</Button>
      </Stack>
      {setupStatus.isSuccess && !setupStatus.isFetching && setupStatus.data.initialized === false && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          首次运行？<Link to="/setup">初始化主人账户</Link>
        </Typography>
      )}
      {registration.data?.registrationEnabled && <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        还没有账户？ <Link aria-label="注册账户" to="/register">立即注册</Link>
      </Typography>}
      {defaults.hint && <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 2 }}>
        {defaults.hint}
      </Typography>}
    </AuthFrame>
  );
}
