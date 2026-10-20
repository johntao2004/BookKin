// 编辑当前密码复杂度策略，规则变化不意味着重新验证所有已有密码。
// Edits current password complexity rules without implying revalidation of every existing password.
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, type PasswordPolicy } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { usePasswordPolicy } from "../auth/password-policy";
import { Stack, Typography } from "../ui/primitives";
import { TextField, Switch } from "../ui/forms";
import { SaveButton } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { ActionToolbar } from "../components/PageHeader";
export function PasswordPolicySettings() {
 const query=usePasswordPolicy();
 if(!query.data) return <Typography>{query.isError?"密码规则读取失败，请刷新重试。":"正在加载密码规则…"}</Typography>;
 return <PolicyForm initial={query.data} />;
}
function PolicyForm({initial}:{initial:PasswordPolicy}) {
 const {user}=useAuth();const client=useQueryClient();
 const [form,setForm]=useState(initial);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
 const disabled=busy || user?.role!=="OWNER";
 const options=[['requireUppercase','要求大写字母'],['requireLowercase','要求小写字母'],['requireDigit','要求数字'],['requireSpecial','要求英文标点或符号']] as const;
 return <Stack className="bk-form-section" component="form" spacing={2} noValidate onSubmit={async(e:FormEvent)=>{
  e.preventDefault();setError("");setSaved(false);
  if(!Number.isInteger(form.minLength)||form.minLength<8||form.minLength>128){setError("最小长度需为 8–128 的整数。");return;}
  setBusy(true);try{const result=await api.savePasswordPolicy(form);client.setQueryData(["password-policy"],result);setForm(result);setSaved(true);}catch(e){setError(e instanceof Error?e.message:"保存失败");}finally{setBusy(false);}
 }}>
  <Typography variant="h5">密码复杂度</Typography>
  <Typography color="text.secondary">对新设置的密码生效，适用于注册、修改密码和邮件重置；已有密码仍可登录。</Typography>
  <TextField label="密码最小长度" type="number" value={form.minLength} disabled={disabled} helperText="可设置 8–128 个字符；密码最多 200 个字符。" onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setForm({...form,minLength:Number(e.target.value)})} />
  {options.map(([key,label])=><Stack key={key} direction="row" sx={{alignItems:"center",justifyContent:"space-between",gap:2,minWidth:0}}><Typography sx={{minWidth:0}}>{label}</Typography><Switch checked={form[key]} disabled={disabled} slotProps={{input:{"aria-label":label}}} sx={{flexShrink:0}} onChange={(_,v)=>setForm({...form,[key]:v})} /></Stack>)}
  <ActionToolbar><SaveButton type="submit" disabled={disabled}>保存密码规则</SaveButton></ActionToolbar>
  {error&&<Alert severity="error">{error}</Alert>}{saved&&<Alert severity="success">密码规则已保存。</Alert>}
 </Stack>;
}
