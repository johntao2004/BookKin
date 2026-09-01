import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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
    : { username: "owner", password: "", hint: "使用初始化时创建的账户登录" };
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
    <AuthFrame title="回到你的书房" greeting={getLoginGreeting(new Date().getHours())}>
      <Stack component="form" spacing={2.5} onSubmit={submit}>
        <TextField label="用户名" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoFocus />
        <TextField
          label="密码"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
      <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 2 }}>
        {defaults.hint}
      </Typography>
    </AuthFrame>
  );
}
