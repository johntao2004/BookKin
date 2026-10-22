// 轮询显示后台文件任务阶段与结果，排队或执行中状态不当作完成。
// Polls background file-operation stages/results without treating queued or running work as complete.
import { EmptyState } from "../ui/empty-state";
import { Alert, Chip } from "../ui/feedback";
import { RefreshButton } from "../ui/buttons";
import { Stack, Typography } from "../ui/primitives";
import { DataTable } from "../ui/antd";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { ActionToolbar, PageContainer } from "../components/PageHeader";
import type { FileOperation, FileOperationStatus, FileOperationType } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

const operationLabels: Record<FileOperationType, string> = {
  RENAME: "重命名",
  MOVE: "移动",
  TRASH: "移入回收站",
  RESTORE: "恢复",
  WRITE_METADATA: "写回元数据",
  PURGE: "永久清理",
};

const statusMeta: Record<FileOperationStatus, { label: string; color: "default" | "success" | "warning" | "error" }> = {
  PLANNED: { label: "等待执行", color: "default" },
  RUNNING: { label: "执行中", color: "warning" },
  SUCCEEDED: { label: "已完成", color: "success" },
  FAILED: { label: "失败", color: "error" },
  ROLLED_BACK: { label: "已回滚", color: "warning" },
};

const runningStageLabels: Record<string, string> = {
  ATOMIC_MOVE: "正在移动",
  CHECKING_SPACE: "检查空间",
  COPYING: "正在复制",
  VERIFYING_SHA256: "校验文件",
  FINALIZING_TARGET: "正在落位",
  TRASHING_SOURCE: "清理源文件",
  ATOMIC_TRASH: "移入回收站",
  PREPARING_OVERWRITE: "准备写回",
};

const formatCreatedAt = (createdAt: string) => new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(createdAt));

export function FileOperationsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const query = useQuery({ queryKey: ["file-operations", page, pageSize], queryFn: () => api.listFileOperationPage(page - 1, pageSize), placeholderData: keepPreviousData, refetchInterval: 5000 });
  useEffect(() => {
    if (query.data && !query.isPlaceholderData) {
      const last = Math.max(1, Math.ceil(query.data.total / pageSize));
      if (page > last) setPage(last);
    }
  }, [page, pageSize, query.data, query.isPlaceholderData]);
  return <PageContainer>
    <Stack sx={{ mb: 2 }}><ActionToolbar><RefreshButton onClick={() => query.refetch()} disabled={query.isFetching}>刷新</RefreshButton></ActionToolbar></Stack>
    {query.isError ? <Alert severity="error">无法读取操作日志，请刷新重试。</Alert> : <DataTable<FileOperation>
      aria-label="操作日志列表" rowKey="id" loading={query.isFetching} dataSource={query.data?.items ?? []}
      scroll={{ x: tokens.layout.touchTarget * 16 }}
      locale={{ emptyText: <Stack spacing={1}><EmptyState title="暂无操作日志" padded={false} /><Typography color="text.secondary">从藏书卡片的更多菜单发起安全预览。</Typography></Stack> }}
      pagination={{ current: page, pageSize, total: query.data?.total ?? 0, disabled: query.isFetching,
        onChange: (next, size) => { setPage(size === pageSize ? next : 1); setPageSize(size); } }}
      columns={[
        { title: "任务", key: "type", render: (_, operation) => <Typography sx={{ fontWeight: tokens.typography.fontWeight.semibold }}>{operationLabels[operation.type]}</Typography> },
        { title: "书籍", key: "book", render: (_, operation) => <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{operation.sourcePath.split(/[\\/]/).filter(Boolean).at(-1)?.replace(/\.(epub|pdf)$/i, "") || "未知书籍"}</Typography> },
        { title: "状态", key: "status", render: (_, operation) => <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
          <Chip size="small" variant="outlined" color={statusMeta[operation.status].color} label={statusMeta[operation.status].label} />
          {operation.status === "RUNNING" && operation.stage && <Typography variant="caption" color="text.secondary">{runningStageLabels[operation.stage] ?? "正在处理"}</Typography>}
        </Stack> },
        { title: "时间", key: "time", align: "right", render: (_, operation) => <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{formatCreatedAt(operation.createdAt)}</Typography> },
      ]} />}
  </PageContainer>;
}
