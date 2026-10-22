// 设置绝对会话时长并使用服务器返回值更新，客户端倒计时不替代服务端过期检查。
// Edits absolute session lifetime using server results; client countdowns do not replace server expiry checks.
import { SectionHeader } from "../components/PageHeader";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SaveButton } from "../ui/buttons";
import { TextField } from "../ui/forms";
import { Alert } from "../ui/feedback";
import { Skeleton } from "../ui/antd";
import { Stack } from "../ui/primitives";
export function SessionPolicySettings() {
 const {user}=useAuth(); const client=useQueryClient();
 const query=useQuery({queryKey:["session-policy"],queryFn:api.sessionPolicy});
 const [minutes,setMinutes]=useState<number|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
 if(query.isPending)return <Skeleton active />;
 if(query.isError)return <Alert severity="error">无法读取会话设置，请刷新重试。</Alert>;
 const value=minutes??query.data.maxMinutes;
 return <Stack className="bk-form-section" component="form" spacing={2} onSubmit={async(e:FormEvent)=>{
  e.preventDefault();setError("");setSaved(false);
  if(!Number.isInteger(value)||value<5||value>43200){setError("请输入 5–43200 分钟的整数。");return;}
  setBusy(true);try{const result=await api.saveSessionPolicy(value);client.setQueryData(["session-policy"],result);setSaved(true);}catch(e){setError(e instanceof Error?e.message:"保存失败");}finally{setBusy(false);}
 }}>
  <SectionHeader title="会话时长" action={<SaveButton type="submit" disabled={busy||user?.role!=="OWNER"}>保存会话设置</SaveButton>} />
  <TextField label="最长登录时长（分钟）" type="number" value={value} disabled={busy||user?.role!=="OWNER"} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>{setMinutes(Number(e.target.value));setSaved(false);}} helperText="从登录时开始计时，到期前保存阅读进度并退出。适用于所有现有和新会话。" />
  {error&&<Alert severity="error">{error}</Alert>}{saved&&<Alert severity="success">会话设置已保存</Alert>}
 </Stack>;
}
