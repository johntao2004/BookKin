import { Alert } from "@/ui";
import { Button } from "@/ui";
import { CircularProgress } from "@/ui";
import { Stack } from "@/ui";
import { Form, Input } from "@/ui";
import { Typography } from "@/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
      <Form form={formInstance} name="setup" layout="vertical" autoComplete="off" noValidate onFinish={submit} requiredMark validateTrigger="onBlur">
        <Form.Item label="昵称" name="displayName" rules={[{ required: true, whitespace: true, message: "请输入昵称" }]}>
          <Input autoComplete="off" size="large" />
        </Form.Item>
        <Form.Item label="用户名" name="username" rules={[{ required: true, whitespace: true, message: "请输入用户名" }]}>
          <Input autoComplete="off" size="large" />
        </Form.Item>
        <Form.Item label="密码" name="password" extra="至少 12 位，建议使用密码管理器生成。" rules={[{ required: true, message: "请输入密码" }, { min: 12, message: "密码至少需要 12 个字符" }]}>
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>
        <Form.Item label="确认密码" name="confirmPassword" dependencies={["password"]} rules={[{ required: true, message: "请再次输入密码" }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("两次输入的密码不一致")); } })]}>
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? "正在初始化…" : "创建主人账户"}</Button>
        </Stack>
      </Form>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>已经初始化？<Link to="/login">返回登录</Link></Typography>
    </AuthFrame>
  );
}
