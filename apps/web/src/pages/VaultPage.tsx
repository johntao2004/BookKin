// 访问由会话绑定的 2FA 授权；内容密钥仅在当前已验证页面的内存中使用。
import { useCallback, useEffect, useRef, useState } from "react";
import { _AntAlert as Alert, Skeleton } from "../ui/antd";
import { Button } from "../ui/buttons";
import { TextField } from "../ui/forms";
import { useConfirmation } from "../ui/confirmations";
import { Box } from "@/ui/primitives";
import { BookCardPresentation } from "../components/BookCardPresentation";
import { bookGridSx } from "../components/bookGrid";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { CatalogSection } from "../components/CatalogSection";
import { CatalogFilters } from "../components/CatalogFilters";
import { tokens } from "../theme/generated-tokens";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { vaultApi } from "../features/vault/api";
import { ApiRequestError } from "../api/client";
import { b64, unb64 } from "../features/vault/crypto";
import { importVaultFile, unlockObjects, type UnlockedObject } from "../features/vault/files";
import { VaultReader } from "../features/vault/VaultReader";
import { VaultAccessGate } from "../features/vault/VaultAccessGate";
import { useAuth } from "../auth/AuthContext";
import { deviceKeys } from "../features/vault/device-keys";
import "../features/content/content.css";

export function VaultPage() {
  return <VaultAccessGate><VaultContent /></VaultAccessGate>;
}
function VaultContent() {
  const modal = useConfirmation();
  const { user } = useAuth();
  const userId = user?.id;
  const [opening, setOpening] = useState(true), [openingError, setOpeningError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [master, setMaster] = useState<Uint8Array | null>(null);
  const [items, setItems] = useState<UnlockedObject[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const key = useRef<Uint8Array | null>(null), epoch = useRef(0);
  const operation = useRef<AbortController | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0), [selected, setSelected] = useState<string | null>(null);
  const lock = useCallback(() => {
    epoch.current++;
    operation.current?.abort(); operation.current = null;
    setSelected(null); setMaster(null);
    key.current?.fill(0); key.current = null;
    setItems([]); setQuery(""); setBusy(false);
    window.dispatchEvent(new Event("bookkin:vault-lock"));
  }, []);
  useEffect(() => {
    window.addEventListener("bookkin:session-expired", lock);
    window.addEventListener("pagehide", lock);
    return () => {
      window.removeEventListener("bookkin:session-expired", lock);
      window.removeEventListener("pagehide", lock);
    };
  }, [lock]);
  const run = async (fn: (revision: number) => Promise<void>) => {
    const revision = epoch.current;
    setBusy(true); setError("");
    try { await fn(revision); }
    catch (reason) { if (revision === epoch.current) setError(reason instanceof Error ? reason.message : "操作失败"); }
    finally { if (revision === epoch.current) setBusy(false); }
  };
  useEffect(() => {
    const controller = new AbortController(), revision = epoch.current;
    setOpening(true); setOpeningError("");
    void (async () => {
      if (!userId) throw new Error("请重新登录后进入秘阁。");
      if (!window.isSecureContext || !crypto.subtle) throw new Error("加密功能需要 HTTPS 或本机 localhost 安全环境。");
      let access: Awaited<ReturnType<typeof vaultApi.open>>;
      try { access = await vaultApi.open(); }
      catch (reason) {
        if (!(reason instanceof ApiRequestError) || reason.code !== "VAULT_LEGACY_KEY_REQUIRED") throw reason;
        const config = await vaultApi.config();
        controller.signal.throwIfAborted();
        const remembered = await deviceKeys.restore(userId, config.envelope, controller.signal);
        if (!remembered) throw reason;
        try {
          controller.signal.throwIfAborted();
          // A previous browser can migrate its actual content key without asking for a password.
          await unlockObjects(remembered.master);
          controller.signal.throwIfAborted();
          access = await vaultApi.migrateKey(b64(remembered.master), config.revision);
        } finally { remembered.master.fill(0); }
      }
      const bytes = unb64(access.key);
      try {
        controller.signal.throwIfAborted();
        if (bytes.length !== 32) throw new Error("内容密钥格式无效，请联系主人检查服务器配置。");
        const list = await unlockObjects(bytes);
        if (revision !== epoch.current || controller.signal.aborted) return;
        key.current?.fill(0); key.current = bytes;
        setItems(list); setMaster(bytes);
      } finally { if (key.current !== bytes) bytes.fill(0); }
    })().catch(reason => {
      if (revision === epoch.current && !controller.signal.aborted) setOpeningError(reason instanceof Error ? reason.message : "无法打开秘阁，请重试。");
    }).finally(() => { if (revision === epoch.current && !controller.signal.aborted) setOpening(false); });
    return () => {
      epoch.current++; controller.abort(); operation.current?.abort();
      key.current?.fill(0); key.current = null;
    };
  }, [loadAttempt, userId]);
  const current = items.find(item => item.id === selected);
  return <PageContainer>
    <PageHeader eyebrow="PRIVATE VAULT" title={current ? current.metadata.title : "秘阁"} action={<Button onClick={lock}>锁定</Button>} />
    <div className="bk-content-stack">
      {error && <Alert type="error" title={error} closable onClose={() => setError("")} />}
      {opening ? <Skeleton active /> : openingError ? <Alert type="error" title={openingError} action={<Button onClick={() => setLoadAttempt(value => value + 1)}>重试</Button>} />
        : !master ? <Skeleton active /> : current ? <VaultReader key={current.id} item={current} master={master} onClose={() => setSelected(null)}
          onState={(reading, revision) => { if (key.current === master) setItems(previous => previous.map(item => item.id === current.id ? { ...item, reading, revision } : item)); }} />
          : <>
            <CatalogSection title="全部藏书" tools={<CatalogFilters
              actions={<Button variant="contained" disabled={busy} onClick={() => uploadInput.current?.click()} sx={{ whiteSpace: "nowrap" }}>上传书籍</Button>}
              extraTools={<TextField aria-label="搜索秘阁" placeholder="搜索书名" value={query} onChange={event => setQuery(event.target.value)}
                sx={{ width: { xs: "100%", sm: tokens.spacing[24] * 2.5 }, maxWidth: "100%" }} />}
            />}>
              <input ref={uploadInput} hidden disabled={busy} type="file" accept=".epub,.pdf" onChange={event => {
                const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
                void run(async revision => {
                  const controller = new AbortController(); operation.current = controller;
                  await importVaultFile(file, master, setProgress, controller.signal);
                  const list = await unlockObjects(master);
                  if (revision === epoch.current) setItems(list);
                });
              }} />
              {busy && <p role="status">正在加密导入 {Math.round(progress * 100)}%</p>}
              {!items.length ? <BookCatalogEmptyState title="秘阁暂无书籍" />
                : !items.some(item => item.metadata.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ? <BookCatalogEmptyState title="未找到匹配的书籍" />
                  : <Box sx={bookGridSx}>{items.filter(item => item.metadata.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(item => <BookCardPresentation key={item.id}
                    book={{ id: item.id, title: item.metadata.title, author: `${item.metadata.format} · 已读 ${Math.round(item.reading.progress * 100)}%` }}
                    onOpen={() => setSelected(item.id)} onRead={() => setSelected(item.id)} actions={[{ label: "永久删除", danger: true, onClick: () => modal.confirm({
                      title: "永久删除此加密书籍及其阅读记录？", okText: "永久删除", cancelText: "取消", okButtonProps: { danger: true },
                      onOk: () => run(async () => { await vaultApi.remove(item.id); setItems(previous => previous.filter(value => value.id !== item.id)); }),
                    }) }]} />)}</Box>}
            </CatalogSection>
          </>}
    </div>
  </PageContainer>;
}
