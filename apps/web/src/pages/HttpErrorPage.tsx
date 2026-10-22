import type { ReactNode } from "react";
import { ApiRequestError } from "../api/errors";
import { PageTitle, pageWidthSx } from "../components/PageHeader";
import { Button } from "../ui/buttons";
import { Stack, Typography } from "../ui/primitives";
import { tokens } from "../theme/generated-tokens";

export interface PageFailure { status?: number; code: string; reason: string; traceId?: string }
export function pageFailure(error: unknown): PageFailure {
  if (error instanceof ApiRequestError) return { status: error.status, code: error.code ?? `HTTP_${error.status}`, reason: error.message, traceId: error.traceId };
  return { code: "CONNECTION_ERROR", reason: error instanceof Error ? error.message : "暂时无法连接书库服务，请稍后重试。" };
}
const statusLabels: Record<number, string> = { 400: "请求有误", 401: "需要登录", 403: "权限受限", 404: "页面不存在", 405: "请求方式不支持", 408: "请求超时", 409: "内容已变化", 413: "文件过大", 415: "格式不支持", 422: "内容无法处理", 429: "请求过于频繁", 500: "服务器异常", 502: "服务连接异常", 503: "服务暂不可用", 504: "服务响应超时" };

/** Page-level failures retain their diagnostics until recovery. */
export function HttpErrorPage({ failure, title, actions, recovery, back, fullHeight = false }: {
  failure: PageFailure; title?: string; actions?: ReactNode; recovery?: string; back?: ReactNode; fullHeight?: boolean;
}) {
  const label = failure.status ? statusLabels[failure.status] ?? (failure.status >= 500 ? "服务器异常" : "请求无法完成") : "连接异常";
  return <Stack component="section" aria-label="错误页面" role="alert" sx={{ ...pageWidthSx,
    minHeight: fullHeight ? "100dvh" : `calc(100dvh - ${tokens.layout.navHeight}px)`,
    py: `${tokens.spacing[10]}px`, alignItems: "center", textAlign: "center", bgcolor: "background.default", color: "text.primary" }}>
    {back && <Stack sx={{ width: "100%", alignItems: "flex-start" }}>{back}</Stack>}
    <Stack sx={{ flex: 1, justifyContent: "center", width: "100%", maxWidth: tokens.layout.readingMax, alignItems: "center", gap: `${tokens.spacing[5]}px`, overflowWrap: "anywhere" }}>
      <Typography variant="overline" color="primary.main">{failure.status ? `${failure.status} · ${label}` : label}</Typography>
      <PageTitle>{title ?? label}</PageTitle>
      <Typography>原因：{failure.reason}</Typography>
      <Stack spacing={1} sx={{ color: "text.secondary" }}>
        <Typography variant="body2">错误代码：{failure.code}</Typography>
        {failure.traceId && <Typography variant="body2">请求标识：{failure.traceId}</Typography>}
      </Stack>
      {recovery && <Typography color="text.secondary">{recovery}</Typography>}
      {actions && <Stack direction={{ xs: "column", sm: "row" }} sx={{ width: { xs: "100%", sm: "auto" }, gap: `${tokens.spacing[3]}px` }}>{actions}</Stack>}
    </Stack>
  </Stack>;
}

export function RequestErrorPage({ error, onRetry, retrying = false, recovery, back }: { error: unknown; onRetry: () => void; retrying?: boolean; recovery?: string; back?: ReactNode }) {
  return <HttpErrorPage failure={pageFailure(error)} recovery={recovery} back={back}
    actions={<Button disabled={retrying} onClick={onRetry}>{retrying ? "正在重试…" : "重试"}</Button>} />;
}
