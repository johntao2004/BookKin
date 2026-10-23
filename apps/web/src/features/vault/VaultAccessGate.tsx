import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageContainer, PageHeader } from "../../components/PageHeader";
import { _AntButton as Button, _AntAlert as Alert, _AntCard as Card, Input, QRCode, Skeleton, Form } from "../../ui/antd";
import { vaultAccessApi, type Enrollment } from "./access-api";
import { OneTimeCodeInput, RecoveryCodeInput, VerificationDialog } from "../../ui/VerificationDialog";
import "../content/content.css";

/** No vault content mounts until the server confirms the current session's second factor. */
export function VaultAccessGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkedVisit = useRef(false);
  const query = useQuery({ queryKey: ["vault-two-factor"], queryFn: async () => {
    if (!checkedVisit.current) { await vaultAccessApi.lock(); checkedVisit.current = true; }
    return vaultAccessApi.status();
  }, refetchInterval: 15_000, refetchOnWindowFocus: "always", staleTime: 0, retry: false });
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [password, setPassword] = useState(""), [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]), [saved, setSaved] = useState(false);
  const [recovery, setRecovery] = useState(false), [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  // Close this visit even when an outstanding request fails; remote unlocks never reopen it.
  const [closed, setClosed] = useState(false);
  const mounted = useRef(true);
  const epoch = useRef(0);
  const close = useCallback(() => {
    epoch.current++;
    setClosed(true); setPassword(""); setCode(""); setEnrollment(null); setCodes([]);
    setRecovery(false); setReset(false); setSaved(false); setError("");
    void vaultAccessApi.lock().finally(() => { if (mounted.current) void query.refetch(); }).catch(() => undefined);
  }, [query.refetch]);
  useEffect(() => {
    mounted.current = true;
    const lock = () => close();
    window.addEventListener("bookkin:vault-lock", lock);
    window.addEventListener("bookkin:vault-access-required", lock);
    return () => {
      mounted.current = false;
      epoch.current++;
      window.removeEventListener("bookkin:vault-lock", lock);
      window.removeEventListener("bookkin:vault-access-required", lock);
      void vaultAccessApi.lock().catch(() => undefined);
    };
  }, [close]);
  // Never retain enrollment secrets or codes across a hidden tab or page departure.
  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") close(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", close);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", close); };
  }, [close]);
  useEffect(() => {
    if (!query.data?.verified || closed || codes.length) return;
    const timer = window.setTimeout(close, Math.max(0, query.data.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [query.data?.verified, query.data?.expiresAt, closed, codes.length, close]);
  useEffect(() => {
    if (!query.data?.verified || closed) return;
    let active = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void vaultAccessApi.renew().then(status => {
        if (active) queryClient.setQueryData(["vault-two-factor"], status);
      }).catch(() => { if (active) close(); });
    }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [query.data?.verified, closed, close, queryClient]);
  const run = async (work: (active: () => boolean) => Promise<void>) => {
    const started = epoch.current;
    const active = () => mounted.current && started === epoch.current;
    setBusy(true); setError("");
    try { await work(active); }
    catch (reason) { if (active()) setError(reason instanceof Error ? reason.message : "操作失败，请重试。"); }
    finally {
      if (!active()) void vaultAccessApi.lock().catch(() => undefined);
      if (mounted.current) setBusy(false);
    }
  };
  const refresh = async () => { setCode(""); setPassword(""); setClosed(false); await query.refetch(); };
  const submitting = useRef(false);
  const submitVerification = (value = code) => {
    if (submitting.current || busy || !(recovery ? /^[0-9A-F]{32}$/.test(value) : /^\d{6}$/.test(value)) || (reset && !password)) return;
    submitting.current = true;
    const started = epoch.current;
    void run(async active => {
      if (reset) { await vaultAccessApi.reset(password, value, recovery); if (!active()) return; setReset(false); }
      else await vaultAccessApi.verify(value, recovery);
      if (active()) await refresh();
    }).finally(() => {
      submitting.current = false;
      if (mounted.current && started === epoch.current) setCode("");
    });
  };
  const data = query.data;
  const verificationDialog = data?.enabled && data.configured && data.bound && !codes.length;
  if (query.isFetchedAfterMount && data?.enabled && data.configured && data.verified && !closed && !codes.length && !reset && !query.isError) return children;
  return <PageContainer>
    <PageHeader eyebrow="PRIVATE VAULT" title="秘阁" />
    <div className="bk-content-stack">
      {error && !verificationDialog && <Alert type="error" title={error} closable onClose={() => setError("")} />}
      {query.isPending ? <Skeleton active /> : query.isError ? <Alert type="error" title="无法确认秘阁访问权限。" action={<Button onClick={() => void query.refetch()}>重试</Button>} />
        : !data?.enabled ? <Alert type="info" title="秘阁尚未启用" description="请联系主人在管理设置的安全设置中启用。" />
        : !data.configured ? <Alert type="warning" title="身份验证器服务尚未配置，请联系主人。" />
        : codes.length ? <Card title="保存 2FA 备用码">
          <div className="bk-content-stack">
            <p>这些备用码仅显示一次，每个只能使用一次。请保存在安全位置；它们用于身份验证，不替代书籍的加密恢复密钥。</p>
            <Input.TextArea aria-label="2FA 备用码" readOnly value={codes.join("\n")} autoSize={{ minRows: 10 }} />
            <div><Button onClick={() => {
              const url = URL.createObjectURL(new Blob([`BookKin 2FA 备用码\n每个仅可使用一次。\n${codes.join("\n")}\n与书籍加密恢复密钥分别保存。`], { type: "text/plain" }));
              const anchor = document.createElement("a"); anchor.href = url; anchor.download = "bookkin-2fa-backup-codes.txt"; anchor.click(); URL.revokeObjectURL(url); setSaved(true);
            }}>下载备用码</Button></div>
            <Button type="primary" disabled={!saved} loading={busy} onClick={() => void run(async () => { setCodes([]); setSaved(false); await refresh(); })}>已保存，继续进入</Button>
          </div>
        </Card>
        : !data.bound ? <Card title="绑定身份验证器">
          <div className="bk-content-stack">
            <p>进入秘阁前需要绑定支持 TOTP 的身份验证器。绑定成功后，每次重新进入均需验证动态码。</p>
            {!enrollment ? <Form layout="vertical" onFinish={() => void run(async active => { const value = await vaultAccessApi.begin(password); if (!active()) return; setEnrollment(value); setPassword(""); setCode(""); })}>
              <Form.Item label="当前登录密码"><Input.Password aria-label="当前登录密码" value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} /></Form.Item>
              <Button type="primary" htmlType="submit" disabled={!password} loading={busy}>获取绑定二维码</Button>
            </Form> : <>
              <QRCode value={enrollment.uri} />
              <p>用身份验证器扫描二维码，或手动输入下方密钥。二维码 10 分钟内有效，请勿分享。</p>
              <Input aria-label="身份验证器绑定密钥" readOnly value={enrollment.secret} />
              <Form layout="vertical" onFinish={() => void run(async active => { const value = await vaultAccessApi.confirm(enrollment.id, code); if (!active()) return; setEnrollment(null); setCode(""); setCodes(value.recoveryCodes); setSaved(false); })}>
                <Form.Item label="6 位动态码"><OneTimeCodeInput value={code} onInput={setCode} disabled={busy} invalid={Boolean(error)} /></Form.Item>
                <Button type="primary" htmlType="submit" disabled={!/^\d{6}$/.test(code)} loading={busy}>确认绑定</Button>
                <Button disabled={busy} onClick={() => { setEnrollment(null); setCode(""); }}>重新获取二维码</Button>
              </Form>
            </>}
          </div>
        </Card> : <VerificationDialog title={reset ? "重新绑定身份验证器" : "验证身份"}
          description={reset ? "使用登录密码和动态码或备用码验证后重新绑定，已加密内容保持不变。" : recovery ? "请输入已保存的 32 位备用码，可整段粘贴" : "请输入身份验证器中的 6 位动态码"}
          error={error} onCancel={() => { close(); navigate("/library", { replace: true }); }}>
          <Form layout="vertical" onFinish={() => submitVerification()}>
            {reset && <Form.Item label="当前登录密码"><Input.Password aria-label="当前登录密码" value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} /></Form.Item>}
            <Form.Item>{recovery
              ? <RecoveryCodeInput value={code} onInput={setCode} disabled={busy} invalid={Boolean(error)} />
              : <OneTimeCodeInput value={code} onInput={setCode} onComplete={reset ? undefined : value => submitVerification(value)} disabled={busy} invalid={Boolean(error)} />}
            </Form.Item>
            {!reset && !recovery && busy && <p className="bk-verification-status" role="status">正在验证…</p>}
            <div className="bk-verification-actions">
              {(reset || recovery) && <Button type="primary" block intent={reset ? "danger" : "normal"} htmlType="submit" disabled={!(recovery ? /^[0-9A-F]{32}$/.test(code) : /^\d{6}$/.test(code)) || (reset && !password)} loading={busy}>{reset ? "验证并重新绑定" : "验证并进入"}</Button>}
              <Button type="default" intent={recovery ? "normal" : "warning"} block disabled={busy} onClick={() => { setRecovery(!recovery); setCode(""); setError(""); }}>{recovery ? "使用动态码" : "设备丢失，使用备用码"}</Button>
              <Button type="default" block disabled={busy} onClick={() => { setReset(!reset); setPassword(""); setCode(""); setError(""); }}>{reset ? "返回验证" : "重新绑定身份验证器"}</Button>
            </div>
          </Form>
        </VerificationDialog>}
    </div>
  </PageContainer>;
}
