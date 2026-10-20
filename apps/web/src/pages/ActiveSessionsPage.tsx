import { EmptyState } from "../ui/empty-state";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ActiveSession } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RevokeSessionsDialog } from "../components/RevokeSessionsDialog";
import { ActionToolbar } from "../components/PageHeader";
import { DataTable } from "../ui/antd";
import { Button, RefreshButton } from "../ui/buttons";
import { Alert, Chip } from "../ui/feedback";
import { Stack } from "../ui/primitives";
const date=(value:string)=>new Date(value).toLocaleString("zh-CN",{hour12:false});
export function ActiveSessionsPage() {
 const {user}=useAuth(); const client=useQueryClient();
 const query=useQuery({queryKey:["active-sessions"],queryFn:api.activeSessions,refetchInterval:10000});
 const [target,setTarget]=useState<{id:string;displayName:string}|null>(null);
 return <>
  <Stack sx={{mb:2}}><ActionToolbar><RefreshButton onClick={()=>void query.refetch()} disabled={query.isFetching}>刷新</RefreshButton></ActionToolbar></Stack>
  {query.isError?<Alert severity="error">无法读取在线会话，请刷新重试。</Alert>:<DataTable<ActiveSession> aria-label="在线会话" rowKey="id" loading={query.isPending} dataSource={query.data??[]} scroll={{x:true}} locale={{emptyText:<EmptyState compact title="暂无活跃会话" />}} pagination={false} columns={[
   {title:"用户",key:"user",render:(_,s)=><>{s.displayName}（{s.username}）{s.current && <Chip label="当前会话" size="small" />}</>},
   {title:"登录时间",dataIndex:"createdAt",render:date},
   {title:"最近活动",dataIndex:"lastAccessAt",render:date},
   {title:"到期时间",dataIndex:"expiresAt",render:date},
   {title:"状态",key:"status",render:(_,s)=>s.ending?"正在保存并退出":"活跃"},
   {title:"操作",key:"action",render:(_,s)=>s.userId!==user?.id && s.role!=="OWNER" && (user?.role==="OWNER"||s.role==="MEMBER")?<Button size="small" disabled={s.ending} onClick={()=>setTarget({id:s.userId,displayName:s.displayName})}>退出全部会话</Button>:"—"},
  ]}/>}
  <RevokeSessionsDialog target={target} onClose={()=>setTarget(null)} onRevoked={()=>void client.invalidateQueries({queryKey:["active-sessions"]})} />
 </>;
}
