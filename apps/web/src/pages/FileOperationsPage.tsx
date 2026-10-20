// 轮询显示后台文件任务阶段与结果，排队或执行中状态不当作完成。
// Polls background file-operation stages/results without treating queued or running work as complete.
import { EmptyState } from "../ui/empty-state";
import { Alert } from "@/ui/feedback";
import { RefreshButton } from "@/ui/buttons";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Stack } from "@/ui/primitives";
import { Table } from "@/ui/primitives";
import { TableBody } from "@/ui/primitives";
import { TableCell } from "@/ui/primitives";
import { TableContainer } from "@/ui/primitives";
import { TableHead } from "@/ui/primitives";
import { TableRow } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { ActionToolbar, PageContainer } from "../components/PageHeader";
import type { FileOperationStatus, FileOperationType } from "../domain/types";
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
  const query = useQuery({ queryKey: ["file-operations"], queryFn: api.listFileOperations, refetchInterval: 5000 });

  return (
    <PageContainer>
      <Stack sx={{ mb: 2 }}><ActionToolbar><RefreshButton onClick={() => query.refetch()} disabled={query.isFetching}>刷新</RefreshButton></ActionToolbar></Stack>

      {query.isError ? <Alert severity="error">无法读取操作日志，请刷新重试。</Alert> : query.isPending ? (
        <Stack sx={{ py: `${tokens.spacing[20]}px`, alignItems: "center" }}><CircularProgress /></Stack>
      ) : (query.data ?? []).length === 0 ? (
        <Stack spacing={tokens.spacing[1] / tokens.meta.baseUnit} sx={{ py: `${tokens.spacing[24]}px`, alignItems: "center" }}>
          <EmptyState title="暂无操作日志" padded={false} />
          <Typography color="text.secondary">从藏书卡片的更多菜单发起安全预览。</Typography>
        </Stack>
      ) : (
        <TableContainer
          sx={{
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            borderRadius: `${tokens.radius.xl}px`,
            overflow: "hidden",
          }}
        >
          <Table aria-label="操作日志列表">
            <TableHead>
              <TableRow sx={{ bgcolor: "background.default" }}>
                <TableCell sx={{ width: "19%" }}>任务</TableCell>
                <TableCell>书籍</TableCell>
                <TableCell sx={{ width: "15%" }}>状态</TableCell>
                <TableCell align="right" sx={{ width: "17%" }}>时间</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(query.data ?? []).map((operation) => {
                const status = statusMeta[operation.status];
                const stage = operation.status === "RUNNING" && operation.stage
                  ? runningStageLabels[operation.stage] ?? "正在处理"
                  : undefined;
                const bookName = operation.sourcePath.split(/[\\/]/).filter(Boolean).at(-1)?.replace(/\.(epub|pdf)$/i, "") || "未知书籍";

                return (
                  <TableRow key={operation.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: tokens.typography.fontWeight.semibold }}>
                        {operationLabels[operation.type]}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                        {bookName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={tokens.spacing[1] / tokens.meta.baseUnit} sx={{ alignItems: "flex-start" }}>
                        <Chip size="small" variant="outlined" color={status.color} label={status.label} />
                        {stage && <Typography variant="caption" color="text.secondary">{stage}</Typography>}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                        {formatCreatedAt(operation.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageContainer>
  );
}
