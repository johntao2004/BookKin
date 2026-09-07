import { ActionToolbar } from "../components/PageHeader";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Chip } from "../ui/feedback";
import { Button } from "../ui/buttons";
import { DataTable } from "../ui/antd";
import { Stack } from "../ui/primitives";
import { RefreshRounded } from "../ui/icons";
import { api } from "../api/client";
type Entry = Awaited<ReturnType<typeof api.listLoginLogs>>["items"][number];
export function LoginLogsPage() {
 const [page, setPage] = useState(0);
 const query = useQuery({ queryKey:["login-logs",page], queryFn:() => api.listLoginLogs(page) });
 const users = useQuery({ queryKey:["users"], queryFn:api.listUsers });
 return <>
  <Stack sx={{mb:2}}><ActionToolbar><Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => query.refetch()}>刷新</Button></ActionToolbar></Stack>
  {query.isError ? <Alert severity="error">无法读取登录日志，请重试。</Alert> : <DataTable<Entry> aria-label="登录日志" rowKey="id" loading={query.isPending} dataSource={query.data?.items ?? []} scroll={{x:true}} locale={{emptyText:"暂无登录日志"}} pagination={{current:page+1,pageSize:20,total:query.data?.total ?? 0,showSizeChanger:false,onChange:p => setPage(p-1)}} columns={[
   {title:"用户",key:"user",render:(_,entry) => users.data?.find(user => user.id === entry.actorId)?.username ?? entry.subjectId ?? "未知用户"},
   {title:"结果",key:"outcome",render:(_,entry) => <Chip size="small" color={entry.outcome === "SUCCEEDED" ? "success" : "error"} label={entry.outcome === "SUCCEEDED" ? "登录成功" : "登录失败"} />},
   {title:"来源 IP",dataIndex:"ip",render:value => value || "未记录"},
   {title:"登录时间",dataIndex:"occurredAt",render:value => new Intl.DateTimeFormat("zh-CN",{dateStyle:"medium",timeStyle:"medium"}).format(new Date(value))},
  ]} />}
 </>;
}
