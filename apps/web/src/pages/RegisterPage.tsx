import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuthFrame } from "../components/AuthFrame";
import { Alert, Button, Form, Input, Skeleton, Typography } from "../ui";
export function RegisterPage() {
 const {user}=useAuth(); const navigate=useNavigate();
 const policy=useQuery({queryKey:["registration-status"],queryFn:api.registrationStatus,staleTime:0,refetchOnMount:"always",refetchOnWindowFocus:"always",refetchInterval:5000});
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 if(user) return <Navigate to="/library" replace />;
 return <AuthFrame title="注册账户">
  {policy.isPending ? <Skeleton active /> : policy.isError ? <Alert severity="error">无法确认注册状态，请稍后重试。</Alert> : !policy.data.registrationEnabled ? <Alert severity="info">当前未开放注册。</Alert> :
  <Form layout="vertical" autoComplete="off" onFinish={async (values:{username:string;displayName:string;password:string}) => {
   setBusy(true);setError("");
   try {await api.register({username:values.username.trim(),displayName:values.displayName.trim(),password:values.password});navigate("/login",{replace:true,state:{registered:true}});}
   catch(reason){setError(reason instanceof Error ? reason.message : "注册失败");}
   finally{setBusy(false);}
  }}>
   <Form.Item name="displayName" label="昵称" rules={[{required:true,whitespace:true,message:"请输入昵称"},{max:120,message:"昵称最多 120 字"}]}><Input autoComplete="off" /></Form.Item>
   <Form.Item name="username" label="用户名" rules={[{required:true,message:"请输入用户名"},{pattern:/^[a-zA-Z0-9._-]{3,80}$/,message:"使用 3–80 位字母、数字、点、下划线或短横线"}]}><Input autoComplete="off" /></Form.Item>
   <Form.Item name="password" label="密码" rules={[{required:true,message:"请输入密码"},{min:12,max:200,message:"密码需为 12–200 位"}]}><Input.Password autoComplete="new-password" /></Form.Item>
   <Form.Item name="confirmation" label="确认密码" dependencies={["password"]} rules={[{required:true,message:"请再次输入密码"},({getFieldValue})=>({validator(_,value){return !value || getFieldValue("password")===value ? Promise.resolve() : Promise.reject(new Error("两次密码不一致"));}})]}><Input.Password autoComplete="new-password" /></Form.Item>
   {error && <Alert severity="error">{error}</Alert>}
   <Button type="submit" variant="contained" disabled={busy}>{busy ? "正在注册…" : "注册"}</Button>
  </Form>}
  <Typography sx={{mt:3}}><Link to="/login">返回登录</Link></Typography>
 </AuthFrame>;
}
