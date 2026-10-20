import { useCallback, useEffect, useRef, useState } from "react";
import {
  _AntButton as Button,
  _AntAlert as Alert,
  _AntCard as Card,
  Input,
  Skeleton,
  Empty,
  _AntModal as Modal,
} from "../ui/antd";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { vaultApi } from "../features/vault/api";
import {
  createEnvelope,
  unlock,
  type Envelope,
} from "../features/vault/crypto";
import {
  importVaultFile,
  unlockObjects,
  type UnlockedObject,
} from "../features/vault/files";
import { VaultReader } from "../features/vault/VaultReader";
import "../features/content/content.css";
export function VaultPage() {
  const [config, setConfig] = useState<{
      envelope: string;
      revision: number;
    } | null>(null),
    [master, setMaster] = useState<Uint8Array | null>(null),
    [items, setItems] = useState<UnlockedObject[]>([]);
  const key = useRef<Uint8Array | null>(null),
    epoch = useRef(0),
    operation = useRef<AbortController | null>(null);
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [recover, setRecover] = useState(false),
    [recovery, setRecovery] = useState(""),
    [recoveryConfirm, setRecoveryConfirm] = useState("");
  const pending = useRef<Awaited<ReturnType<typeof createEnvelope>> | null>(
    null,
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [changePassword, setChangePassword] = useState(false);
  const lock = useCallback(() => {
    epoch.current++;
    operation.current?.abort();
    operation.current = null;
    setSelected(null);
    setMaster(null);
    key.current?.fill(0);
    key.current = null;
    pending.current?.master.fill(0);
    pending.current = null;
    setItems([]);
    setPassword("");
    setConfirm("");
    setRecovery("");
    setRecoveryConfirm("");
    setChangePassword(false);
    setBusy(false);
  }, []);
  useEffect(() => {
    void vaultApi
      .config()
      .then(setConfig)
      .catch((e) => setError(e.message));
    return () => {
      epoch.current++;
      operation.current?.abort();
      key.current?.fill(0);
      pending.current?.master.fill(0);
    };
  }, []);
  useEffect(() => {
    if (!master) return;
    let timer: number;
    const reset = () => {
      clearTimeout(timer);
      timer = window.setTimeout(lock, 5 * 60 * 1000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    window.addEventListener("bookkin:session-expired", lock);
    window.addEventListener("pagehide", lock);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
      window.removeEventListener("bookkin:session-expired", lock);
      window.removeEventListener("pagehide", lock);
    };
  }, [master, lock]);
  const run = async (fn: (revision: number) => Promise<void>) => {
    const revision = epoch.current;
    setBusy(true);
    setError("");
    try {
      await fn(revision);
    } catch (e) {
      if (revision === epoch.current)
        setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      if (revision === epoch.current) setBusy(false);
    }
  };
  const setUnlocked = async (bytes: Uint8Array, revision: number) => {
    let list: UnlockedObject[];
    try {
      list = await unlockObjects(bytes);
    } catch (error) {
      bytes.fill(0);
      throw error;
    }
    if (revision !== epoch.current) {
      bytes.fill(0);
      return;
    }
    if (key.current && key.current !== bytes) key.current.fill(0);
    key.current = bytes;
    setItems(list);
    setMaster(bytes);
    setPassword("");
    setConfirm("");
  };
  const prepare = async (revision: number) => {
    if (password !== confirm) throw new Error("两次密码不一致。");
    const value = await createEnvelope(
      password,
      master ? new Uint8Array(master) : undefined,
    );
    if (revision !== epoch.current) {
      value.master.fill(0);
      return;
    }
    pending.current = value;
    setRecovery(value.recovery);
    setPassword("");
    setConfirm("");
  };
  const saveRecovery = async (revision: number) => {
    if (!config || !pending.current) return;
    if (recoveryConfirm.trim() !== recovery)
      throw new Error("请粘贴已保存的恢复密钥确认。");
    const value = pending.current;
    await vaultApi.saveConfig(value.envelope, config.revision);
    if (revision !== epoch.current) return;
    setConfig({
      envelope: JSON.stringify(value.envelope),
      revision: config.revision + 1,
    });
    pending.current = null;
    setRecovery("");
    setRecoveryConfirm("");
    setChangePassword(false);
    await setUnlocked(value.master, revision);
  };
  const current = items.find((x) => x.id === selected);
  const setup = config?.revision === 0 || changePassword;
  if (!window.isSecureContext || !crypto.subtle)
    return (
      <PageContainer>
        <PageHeader eyebrow="PRIVATE VAULT" title="禁书区" />
        <Alert
          type="warning"
          title="加密功能需要 HTTPS 或本机 localhost 安全环境。"
        />
      </PageContainer>
    );
  return (
    <PageContainer>
      <PageHeader
        eyebrow="PRIVATE VAULT"
        title={current ? current.metadata.title : "禁书区"}
        action={master ? <Button onClick={lock}>立即锁定</Button> : undefined}
      />
      <div className="bk-content-stack">
        {error && (
          <Alert
            type="error"
            title={error}
            closable
            onClose={() => setError("")}
          />
        )}
        {!config ? (
          <Skeleton active />
        ) : recovery ? (
          <Card title="保存离线恢复密钥">
            <p>
              将密钥保存到安全的离线位置。二次密码与恢复密钥均丢失时无法恢复。
            </p>
            <Input.TextArea
              aria-label="离线恢复密钥"
              readOnly
              value={recovery}
            />
            <Button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      `BookKin 禁书区恢复密钥\n${recovery}\n请离线保管，不要与数据库备份放在一起。`,
                    ],
                    { type: "text/plain" },
                  ),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "bookkin-vault-recovery.txt";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 0);
              }}
            >
              下载恢复密钥
            </Button>
            <Input
              aria-label="确认恢复密钥"
              placeholder="粘贴已保存的恢复密钥"
              value={recoveryConfirm}
              onChange={(e) => setRecoveryConfirm(e.target.value)}
            />
            <Button
              type="primary"
              loading={busy}
              onClick={() => void run(saveRecovery)}
            >
              确认保存并启用
            </Button>
          </Card>
        ) : setup ? (
          <Card
            title={changePassword ? "设置新的二次密码" : "首次设置二次密码"}
          >
            <div className="bk-content-stack">
              <p>
                独立长口令至少 12
                个字符；在浏览器本地加密，服务器不保存解密密钥。
              </p>
              <Input.Password
                aria-label="设置二次密码"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input.Password
                aria-label="确认二次密码"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button
                type="primary"
                loading={busy}
                onClick={() => void run(prepare)}
              >
                生成离线恢复密钥
              </Button>
              {master && (
                <Button onClick={() => setChangePassword(false)}>取消</Button>
              )}
            </div>
          </Card>
        ) : !master ? (
          <Card title={recover ? "使用离线恢复密钥" : "输入二次密码解锁"}>
            <div className="bk-content-stack">
              <Input.Password
                aria-label={recover ? "恢复密钥" : "二次密码"}
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={() =>
                  void run(async (revision) => {
                    const bytes = await unlock(
                      JSON.parse(config.envelope) as Envelope,
                      password,
                      recover,
                    );
                    await setUnlocked(bytes, revision);
                    if (recover) setChangePassword(true);
                  })
                }
              />
              <Button
                type="primary"
                loading={busy}
                onClick={() =>
                  void run(async (revision) => {
                    const bytes = await unlock(
                      JSON.parse(config.envelope) as Envelope,
                      password,
                      recover,
                    );
                    await setUnlocked(bytes, revision);
                    if (recover) setChangePassword(true);
                  })
                }
              >
                解锁
              </Button>
              <Button
                onClick={() => {
                  setRecover(!recover);
                  setPassword("");
                }}
              >
                {recover ? "返回密码解锁" : "忘记二次密码，使用恢复密钥"}
              </Button>
              <p>
                内容、书名、笔记、高亮及阅读时间全部加密；闲置 5
                分钟后自动锁定。
              </p>
            </div>
          </Card>
        ) : current ? (
          <VaultReader
            key={current.id}
            item={current}
            master={master}
            onClose={() => setSelected(null)}
            onState={(reading, revision) => {
              if (key.current === master)
                setItems((previous) =>
                  previous.map((x) =>
                    x.id === current.id ? { ...x, reading, revision } : x,
                  ),
                );
            }}
          />
        ) : (
          <>
            <Alert
              type="info"
              title="独立加密存储，阅读时间及笔记仅保存在禁书区，不参与普通书籍统计。"
            />
            <div className="bk-content-tools">
              <label>
                加密导入 EPUB / PDF（最多 100 MB）{" "}
                <input
                  disabled={busy}
                  type="file"
                  accept=".epub,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    void run(async (revision) => {
                      const controller = new AbortController();
                      operation.current = controller;
                      await importVaultFile(
                        file,
                        master,
                        setProgress,
                        controller.signal,
                      );
                      const list = await unlockObjects(master);
                      if (revision === epoch.current) setItems(list);
                    });
                  }}
                />
              </label>
              <Button
                onClick={() => {
                  setChangePassword(true);
                  setPassword("");
                  setConfirm("");
                }}
              >
                修改二次密码
              </Button>
            </div>
            {busy && (
              <p role="status">正在加密导入 {Math.round(progress * 100)}%</p>
            )}
            {!items.length ? (
              <Empty description="禁书区暂无书籍" />
            ) : (
              items.map((item) => (
                <Card key={item.id} title={item.metadata.title}>
                  <p>
                    {item.metadata.format} · 独立阅读{" "}
                    {Math.floor(item.reading.seconds / 60)} 分钟 · 进度{" "}
                    {Math.round(item.reading.progress * 100)}%
                  </p>
                  <div className="bk-content-tools">
                    <Button onClick={() => setSelected(item.id)}>
                      开始阅读
                    </Button>
                    <Button
                      danger
                      onClick={() =>
                        Modal.confirm({
                          title: "永久删除此加密书籍及其阅读记录？",
                          onOk: () =>
                            run(async () => {
                              await vaultApi.remove(item.id);
                              setItems((previous) =>
                                previous.filter((x) => x.id !== item.id),
                              );
                            }),
                        })
                      }
                    >
                      删除
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
