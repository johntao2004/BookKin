import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { Button } from "../../ui/buttons";
import { _AntAlert } from "../../ui/antd";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "../../ui/overlays";
import { Stack } from "../../ui/primitives";
import type { AiServiceAvailability } from "../../domain/types";

type Notice =
  | { kind: "disabled" }
  | { kind: "unconfigured" }
  | { kind: "provider-disabled" }
  | { kind: "unavailable" }
  | { kind: "status-error" };

function isAvailability(value: AiServiceAvailability | null | undefined): value is AiServiceAvailability {
  return Boolean(value && typeof value.enabled === "boolean"
    && typeof value.hasConfiguredProvider === "boolean" && typeof value.hasEnabledProvider === "boolean");
}

function isAiUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "AI_UNAVAILABLE" || error.code === "AI_PROVIDER_UNAVAILABLE";
}

/** Checks readiness before an AI action and shares the same permission-aware explanation across entry points. */
export function useAiAvailability(canConfigure: boolean) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const checking = useRef(false);
  const continueAction = useRef<(() => void) | null>(null);

  const requireAiAvailable = useCallback(async (onReady: () => void): Promise<boolean> => {
    if (checking.current) return false;
    checking.current = true;
    continueAction.current = onReady;
    let status: AiServiceAvailability;
    try {
      const response = await api.getAiServiceAvailability();
      if (!isAvailability(response)) throw new Error("返回了无法识别的 AI 服务状态。");
      status = response;
    } catch {
      setNotice({ kind: "status-error" });
      return false;
    } finally {
      checking.current = false;
    }

    if (!status.hasConfiguredProvider) setNotice({ kind: "unconfigured" });
    else if (!status.enabled) setNotice({ kind: "disabled" });
    else if (!status.hasEnabledProvider) setNotice({ kind: "provider-disabled" });
    else {
      setNotice(null);
      continueAction.current = null;
      onReady();
      return true;
    }
    continueAction.current = null;
    return false;
  }, []);

  const presentAiUnavailableError = useCallback((error: unknown): boolean => {
    if (!isAiUnavailableError(error)) return false;
    setNotice({ kind: "unavailable" });
    return true;
  }, []);

  const retry = useCallback(() => {
    const action = continueAction.current;
    if (action) void requireAiAvailable(action);
  }, [requireAiAvailable]);

  const close = useCallback(() => setNotice(null), []);
  const dialog = <AiAvailabilityDialog notice={notice} canConfigure={canConfigure} onRetry={retry} onClose={close} />;
  return { requireAiAvailable, presentAiUnavailableError, dialog };
}

function AiAvailabilityDialog({ notice, canConfigure, onRetry, onClose }: {
  notice: Notice | null;
  canConfigure: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  if (!notice) return null;
  const statusError = notice.kind === "status-error";
  const title = statusError ? "无法检查 AI 服务状态"
    : notice.kind === "disabled" ? "AI 服务已关闭"
      : notice.kind === "provider-disabled" ? "没有启用可用的 AI 平台"
        : notice.kind === "unavailable" ? "AI 服务当前不可用" : "AI 服务尚未配置";
  const description = statusError ? "暂时无法检查 AI 服务状态，请检查网络后重试。"
    : notice.kind === "disabled" ? "AI 服务当前已关闭。"
      : notice.kind === "provider-disabled" ? "尚未启用已配置的 AI 平台。"
        : notice.kind === "unavailable" ? "请检查 AI 服务是否已启用，并确认平台配置仍然有效。"
          : "尚未配置可用的 AI 平台。";
  return <Dialog open fullWidth maxWidth="xs" onClose={onClose}>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent><Stack spacing={2}>
      <_AntAlert type={statusError ? "error" : "warning"} showIcon description={description} />
      {!statusError && (canConfigure
        ? <span>你可以前往管理设置检查 AI 服务配置。</span>
        : <span>请联系主人或管理员配置 AI 服务。</span>)}
    </Stack></DialogContent>
    <DialogActions>
      {statusError
        ? <Button variant="contained" onClick={onRetry}>重试检查</Button>
        : canConfigure && <Button component={Link} to="/settings#services/ai" variant="contained" onClick={onClose}>前往 AI 服务配置</Button>}
    </DialogActions>
  </Dialog>;
}
