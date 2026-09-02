import { RefreshRounded } from "@/ui/icons";
import { Button } from "@/ui";
import { Chip } from "@/ui";
import { CircularProgress } from "@/ui";
import { Stack } from "@/ui";
import { Table } from "@/ui";
import { TableBody } from "@/ui";
import { TableCell } from "@/ui";
import { TableContainer } from "@/ui";
import { TableHead } from "@/ui";
import { TableRow } from "@/ui";
import { Typography } from "@/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageContainer, PageHeader } from "../components/PageHeader";
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
      <PageHeader
        eyebrow="FILE JOURNAL"
        title="文件任务"
        description="每次重命名、移动、删除、恢复和写回都保留源目标、指纹、操作者与结果。"
        action={<Button startIcon={<RefreshRounded />} variant="outlined" onClick={() => query.refetch()}>刷新</Button>}
      />

      {query.isPending ? (
        <Stack sx={{ py: `${tokens.spacing[20]}px`, alignItems: "center" }}><CircularProgress /></Stack>
      ) : (query.data ?? []).length === 0 ? (
        <Stack spacing={tokens.spacing[1] / tokens.meta.baseUnit} sx={{ py: `${tokens.spacing[24]}px`, alignItems: "center" }}>
          <Typography variant="h4">暂无文任务</Typography>
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
          <Table aria-label="文件任务列表">
            <TableHead>
              <TableRow sx={{ bgcolor: "background.default" }}>
                <TableCell sx={{ width: "19%" }}>任务</TableCell>
                <TableCell>文件变更</TableCell>
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
                const hasDistinctTarget = operation.targetPath && operation.targetPath !== operation.sourcePath;

                return (
                  <TableRow key={operation.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: tokens.typography.fontWeight.semibold }}>
                        {operationLabels[operation.type]}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 0 }}>
                      <Typography variant="body2" title={operation.sourcePath} sx={{ overflowWrap: "anywhere" }}>
                        {operation.sourcePath}
                      </Typography>
                      {hasDistinctTarget && (
                        <Stack
                          direction="row"
                          spacing={tokens.spacing[2] / tokens.meta.baseUnit}
                          sx={{ mt: `${tokens.spacing[1]}px`, alignItems: "baseline", color: "text.secondary" }}
                        >
                          <Typography component="span" variant="caption" aria-hidden="true">→</Typography>
                          <Typography
                            component="span"
                            variant="caption"
                            title={operation.targetPath}
                            sx={{ overflowWrap: "anywhere" }}
                          >
                            {operation.targetPath}
                          </Typography>
                        </Stack>
                      )}
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
