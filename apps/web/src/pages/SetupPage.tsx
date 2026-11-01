// 仅在服务端明确未初始化后显示创建表单；状态未知或失败时不尝试创建主人。
// Shows owner creation only after explicit uninitialized status; unknown or failed checks do not trigger setup.
import { usePasswordPolicy, passwordRequirements } from "../auth/password-policy";
import { Alert } from "@/ui/feedback";
import { Button } from "@/ui/buttons";
import { CircularProgress } from "@/ui/feedback";
import { Stack, Typography } from "@/ui/primitives";
import { Form, Input } from "@/ui/antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { setupStatusQueryKey, setupStatusQueryOptions } from "../auth/setup-status";
import { AuthFrame } from "../components/AuthFrame";
import { tokens } from "../theme/generated-tokens";

export function SetupPage() {
 const passwordPolicy=usePasswordPolicy();
  const { setupOwner, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setupStatus = useQuery(setupStatusQueryOptions);
  const [formInstance] = Form.useForm();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (form: { username: string; displayName: string; password: string; confirmPassword: string }) => {
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
      <AuthFrame title="正在确认书库状态" setupLocked>
        <Stack sx={{ alignItems: "center", py: 4 }}><CircularProgress size={tokens.spacing[8]} /></Stack>
      </AuthFrame>
    );
  }

  if (setupStatus.isError) {
    return (
      <AuthFrame title="暂时无法确认初始化状态" setupLocked>
        <Alert severity="error">为了避免重复初始化，请先重试状态检查。</Alert>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 3 }}>
          <Button variant="contained" onClick={() => void setupStatus.refetch()} sx={{ width: { xs: "100%", sm: "auto" } }}>重试</Button>
        </Stack>
      </AuthFrame>
    );
  }

  if (setupStatus.data.initialized) return <Navigate to={user ? "/library/all" : "/login"} replace />;

  return (
    <AuthFrame title="初始化" setupLocked>
      <Form form={formInstance} name="setup" layout="vertical" autoComplete="off" noValidate onFinish={submit} requiredMark validateTrigger="onBlur">
        <Form.Item label="昵称" name="displayName" rules={[{ required: true, whitespace: true, message: "请输入昵称" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item label="用户名" name="username" rules={[{ required: true, whitespace: true, message: "请输入用户名" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        {passwordPolicy.isPending ? (
          <Typography variant="body2" color="text.secondary">正在加载密码规则…</Typography>
        ) : passwordPolicy.isError || !passwordPolicy.data ? (
          <Stack spacing={1}>
            <Typography variant="body2" color="error.main">无法读取密码规则，请重试。</Typography>
            <Button onClick={() => void passwordPolicy.refetch()}>重试</Button>
          </Stack>
        ) : null}
        <Form.Item label="密码" name="password" required rules={[{
          validator: (_, value) => {
            if (!value) return Promise.reject(new Error("请输入密码，请满足密码要求"));
            if (passwordPolicy.isPending || passwordPolicy.isError || !passwordPolicy.data) {
              return Promise.reject(new Error("请满足密码要求"));
            }
            return passwordRequirements(passwordPolicy.data, value).every((rule) => rule.met)
              ? Promise.resolve()
              : Promise.reject(new Error("请满足密码要求"));
          },
        }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
   <Form.Item label="确认密码" name="confirmPassword" dependencies={["password"]} rules={[{ required: true, message: "请再次输入密码" }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("两次输入的密码不一致")); } })]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ width: { xs: "100%", sm: "auto" } }}>{loading ? "正在初始化…" : "创建主人账户"}</Button>
        </Stack>
      </Form>
    </AuthFrame>
  );
}
