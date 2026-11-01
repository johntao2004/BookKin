import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../auth/permissions";
import { PageContainer, SectionHeader } from "../components/PageHeader";
import type { MetadataProviderId, MetadataProviderSetting } from "../domain/types";
import { Button, SaveButton } from "../ui/buttons";
import { CircularProgress } from "../ui/feedback";
import { Switch } from "../ui/forms";
import { FormControlLabel, Stack, Typography } from "../ui/primitives";
import { tokens } from "../theme/generated-tokens";

function sourceLink(homepage: string) {
  try {
    const url = new URL(homepage);
    return url.protocol === "https:" && ["openlibrary.org", "www.wikidata.org", "developers.google.com"].includes(url.hostname) ? url.href : undefined;
  } catch { return undefined; }
}

export function MetadataProviderSettingsPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canView = can("settings.metadata.view");
  const canEdit = can("settings.metadata.edit");
  const client = useQueryClient();
  const key = ["metadata-provider-settings", user?.id];
  const query = useQuery({ queryKey: key, queryFn: api.getMetadataProviderSettings, enabled: canView, retry: false });
  const [draft, setDraft] = useState<MetadataProviderSetting[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty = useRef(false);
  useEffect(() => {
    if (query.data && !dirty.current) setDraft(query.data.providers);
  }, [query.data]);
  const change = (id: MetadataProviderId, enabled: boolean) => {
    dirty.current = true;
    setSaved(false);
    setDraft(current => current?.map(provider => provider.id === id ? { ...provider, enabled } : provider) ?? null);
  };
  const save = async () => {
    if (!draft || !canEdit) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const result = await api.updateMetadataProviderSettings({ providers: draft.map(({ id, enabled }) => ({ id, enabled })) });
      dirty.current = false;
      setDraft(result.providers);
      client.setQueryData(key, result);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "元数据来源保存失败，请重试。");
    } finally { setBusy(false); }
  };
  return <PageContainer><Stack spacing={3}>
    <SectionHeader title="元数据来源" action={<SaveButton disabled={!draft || busy || !canEdit} onClick={() => void save()}>{busy ? "保存中…" : "保存"}</SaveButton>} />
    {query.isError && <Stack role="alert" spacing={1}>
      <Typography color="error">无法读取元数据来源设置。</Typography>
      <Button disabled={query.isFetching} onClick={() => void query.refetch()}>重试</Button>
    </Stack>}
    {error && <Typography role="alert" color="error">{error}</Typography>}
    {saved && <Typography role="status">元数据来源已保存。</Typography>}
    {!draft && query.isPending ? <CircularProgress /> : draft?.map(provider => {
      const homepage = sourceLink(provider.homepage);
      return <Stack key={provider.id} spacing={1} sx={{ border: 1, borderColor: "divider", borderRadius: `${tokens.radius.md}px`, p: `${tokens.spacing[4]}px` }}>
        <FormControlLabel label={provider.label} control={<Switch checked={provider.enabled} disabled={busy || !provider.available || !canEdit} onChange={(_, checked) => change(provider.id, checked)} />} />
        <Typography variant="body2" color="text.secondary">{provider.description}</Typography>
        {!provider.available && <Typography variant="body2" color="text.secondary">当前实例尚未配置此来源所需的 API 密钥。</Typography>}
        {homepage && <Typography variant="body2"><a href={homepage} target="_blank" rel="noopener noreferrer">查看来源</a></Typography>}
      </Stack>;
    })}
  </Stack></PageContainer>;
}
