import { useQuery } from "@tanstack/react-query";
import { api, type PasswordPolicy } from "../api/client";
import { Stack, Typography } from "../ui/primitives";
import { Button } from "../ui/buttons";
export function passwordRequirements(policy: PasswordPolicy, value: string) {
 return [
  {label:`长度为 ${policy.minLength}–200 个字符`,met:value.length>=policy.minLength && value.length<=200},
  {label:"不能仅使用空白字符",met:value.trim().length>0},
  ...(policy.requireUppercase?[{label:"包含大写字母 A–Z",met:/[A-Z]/.test(value)}]:[]),
  ...(policy.requireLowercase?[{label:"包含小写字母 a–z",met:/[a-z]/.test(value)}]:[]),
  ...(policy.requireDigit?[{label:"包含数字 0–9",met:/[0-9]/.test(value)}]:[]),
  ...(policy.requireSpecial?[{label:"包含英文标点或符号（如 ! @ #）",met:/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(value)}]:[]),
 ];
}
export function usePasswordPolicy() {
 return useQuery({queryKey:["password-policy"],queryFn:api.passwordPolicy,staleTime:0,refetchOnWindowFocus:true});
}
export function PasswordRequirements({policy,value}:{policy:ReturnType<typeof usePasswordPolicy>;value:string}) {
 if(policy.isPending) return <Typography role="status" variant="body2">正在加载密码规则…</Typography>;
 if(policy.isError) return <Stack spacing={1}><Typography color="error.main">无法读取密码规则，请重试。</Typography><Button onClick={()=>policy.refetch()}>重新加载密码规则</Button></Stack>;
 return <Stack spacing={1} role="status" aria-label="密码要求">{passwordRequirements(policy.data,value).map(rule=><Typography key={rule.label} variant="body2" color={value ? rule.met?"success.main":"error.main":"text.secondary"}>{value ? rule.met?"✓ ":"未满足：":""}{rule.label}</Typography>)}</Stack>;
}
