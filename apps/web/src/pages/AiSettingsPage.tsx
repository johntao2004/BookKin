import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Checkbox } from "@/ui/forms";
import { CircularProgress } from "@/ui/feedback";
import { FormControl } from "@/ui/primitives";
import { FormControlLabel } from "@/ui/primitives";
import { InputLabel } from "@/ui/primitives";
import { MenuItem } from "@/ui/primitives";
import { Select } from "@/ui/forms";
import { Stack } from "@/ui/primitives";
import { Switch } from "@/ui/forms";
import { TextField } from "@/ui/forms";
import { Typography } from "@/ui/primitives";
import { ActionToolbar, PageContainer } from "../components/PageHeader";
import { api } from "../api/client";
import type { AiProviderSetting, AiProviderSettingInput, AiSettings, AiSettingsInput } from "../domain/types";
import type { ReactNode } from "react";

type ModelPreset = { value: string; label: string };

const customModelValue = "__custom__";

const modelPresetsByProvider: Record<string, ModelPreset[]> = {
  openai: [
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5.1", label: "GPT-5.1" },
    { value: "gpt-5-mini", label: "GPT-5 mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
  ],
  deepseek: [
    { value: "deepseek-v4-flash", label: "deepseek-v4-flash" },
    { value: "deepseek-v4-pro", label: "deepseek-v4-pro" },
  ],
  qwen: [
    { value: "qwen3-max", label: "qwen3-max" },
    { value: "qwen-plus", label: "qwen-plus" },
    { value: "qwen3.5-plus", label: "qwen3.5-plus" },
    { value: "qwen-flash", label: "qwen-flash" },
    { value: "qwen-turbo", label: "qwen-turbo" },
    { value: "qwen3-coder-plus", label: "qwen3-coder-plus" },
  ],
  siliconflow: [
    { value: "Qwen/Qwen3-32B", label: "Qwen/Qwen3-32B" },
    { value: "Qwen/Qwen3-14B", label: "Qwen/Qwen3-14B" },
    { value: "Qwen/Qwen3-8B", label: "Qwen/Qwen3-8B" },
    { value: "Pro/deepseek-ai/DeepSeek-V3", label: "Pro/deepseek-ai/DeepSeek-V3" },
    { value: "Pro/deepseek-ai/DeepSeek-R1", label: "Pro/deepseek-ai/DeepSeek-R1" },
  ],
  anthropic: [
    { value: "claude-opus-4-8", label: "claude-opus-4-8" },
    { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6" },
    { value: "claude-haiku-4-5-20251001", label: "claude-haiku-4-5-20251001" },
  ],
  gemini: [
    { value: "gemini-3.6-flash", label: "gemini-3.6-flash" },
    { value: "gemini-3.5-flash", label: "gemini-3.5-flash" },
    { value: "gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite" },
    { value: "gemini-3.1-pro-preview", label: "gemini-3.1-pro-preview" },
    { value: "gemini-3-flash-preview", label: "gemini-3-flash-preview" },
  ],
  ollama: [
    { value: "qwen3", label: "qwen3" },
    { value: "deepseek-r1", label: "deepseek-r1" },
    { value: "llama3.3", label: "llama3.3" },
    { value: "gemma3", label: "gemma3" },
  ],
};

export function AiSettingsPage() {
  const query = useQuery({ queryKey: ["ai-settings"], queryFn: api.getAiSettings });
  const [draft, setDraft] = useState<AiSettingsInput | null>(null);
  const [currentSettings, setCurrentSettings] = useState<AiSettings | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.data) {
      setCurrentSettings(query.data);
      setDraft(toDraft(query.data));
    }
  }, [query.data]);

  useEffect(() => {
    const providers = draft?.providers ?? [];
    if (!providers.some((provider) => provider.id === selectedProviderId)) {
      setSelectedProviderId(providers[0]?.id ?? "");
    }
  }, [draft?.providers, selectedProviderId]);

  const statuses = useMemo(() => new Map((currentSettings?.providers ?? []).map((provider) => [provider.id, provider])), [currentSettings]);
  const update = <K extends keyof AiSettingsInput>(key: K, value: AiSettingsInput[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);
  const updateProvider = (id: string, patch: Partial<AiProviderSettingInput>) => setDraft((current) => current ? {
    ...current,
    providers: current.providers.map((provider) => provider.id === id ? { ...provider, ...patch } : provider),
  } : current);

  const save = async () => {
    if (!draft) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const next = await api.updateAiSettings(draft);
      setCurrentSettings(next);
      setDraft(toDraft(next));
      setMessage("AI 设置已保存。新的上传任务会按当前策略匹配书目信息。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 设置保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  };

  if (query.isPending) return <PageContainer><Stack sx={{ minHeight: 260, alignItems: "center", justifyContent: "center" }}><CircularProgress /></Stack></PageContainer>;
  if (query.isError || !query.data) return <PageContainer><Alert severity="error">无法读取 AI 设置，请刷新页面后重试。</Alert></PageContainer>;
  if (!draft) return <PageContainer><Stack sx={{ minHeight: 260, alignItems: "center", justifyContent: "center" }}><CircularProgress /></Stack></PageContainer>;

  const selectedProvider = draft.providers.find((provider) => provider.id === selectedProviderId) ?? draft.providers[0];
  return <PageContainer>
    <ActionToolbar>
      <Button variant="contained" disabled={busy} onClick={() => void save()}>{busy ? "保存中…" : "保存设置"}</Button>
    </ActionToolbar>
    {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack spacing={2.5}>
      <SettingsPanel title="匹配策略" description="AI 只接收解析出的结构化书目信息，不会上传 EPUB/PDF 原文。">
        <Stack spacing={1.5}>
          <FormControlLabel control={<Switch checked={draft.enabled} onChange={(_, checked) => update("enabled", checked)} />} label={<SettingLabel title="启用 AI 书目匹配" description="关闭后不会调用任何 AI 平台，普通本地和在线书目识别仍可使用。" />} />
          <FormControlLabel control={<Switch checked={draft.autoMatch} disabled={!draft.enabled} onChange={(_, checked) => update("autoMatch", checked)} />} label={<SettingLabel title="入库时自动查找未匹配书目" description="常规来源没有强 ISBN 或书名/作者匹配时，自动请求已启用的平台。" />} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 0.5 }}>
            <TextField label="最多候选数" type="number" value={draft.maxCandidates} slotProps={{ htmlInput: { min: 1, max: 10 } }} onChange={(event) => update("maxCandidates", clampNumber(event.target.value, 1, 10, 4))} sx={{ maxWidth: 220 }} />
            <TextField label="平台超时（秒）" type="number" value={draft.timeoutSeconds} slotProps={{ htmlInput: { min: 5, max: 120 } }} onChange={(event) => update("timeoutSeconds", clampNumber(event.target.value, 5, 120, 20))} sx={{ maxWidth: 220 }} />
          </Stack>
        </Stack>
      </SettingsPanel>

      <SettingsPanel title="AI 平台" description="选择厂商后配置模型和接口；不同厂商可以分别启用。">
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth sx={{ maxWidth: { sm: 420 } }}>
              <InputLabel id="ai-provider-select-label">选择厂商</InputLabel>
              <Select labelId="ai-provider-select-label" label="选择厂商" value={selectedProvider?.id ?? ""} onChange={(event) => setSelectedProviderId(event.target.value)}>
                {draft.providers.map((provider) => <MenuItem key={provider.id} value={provider.id}>{provider.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          {selectedProvider && <ProviderPanel key={selectedProvider.id} provider={selectedProvider} status={statuses.get(selectedProvider.id)} disabled={busy} onChange={(patch) => updateProvider(selectedProvider.id, patch)} />}
        </Stack>
      </SettingsPanel>
    </Stack>
  </PageContainer>;
}

function ProviderPanel({ provider, status, disabled, onChange }: { provider: AiProviderSettingInput; status?: AiProviderSetting; disabled: boolean; onChange: (patch: Partial<AiProviderSettingInput>) => void }) {
  return <Stack spacing={1.5} sx={{ border: 1, borderColor: provider.enabled ? "primary.main" : "divider", borderRadius: 2, p: { xs: 2, sm: 2.5 }, bgcolor: provider.enabled ? "background.paper" : "background.default" }}>
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1, pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
      <Typography variant="h5">{provider.label}</Typography>
      <FormControlLabel control={<Switch checked={provider.enabled} disabled={disabled} onChange={(_, checked) => onChange({ enabled: checked })} />} label="启用" />
    </Stack>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
      <TextField fullWidth label="显示名称" value={provider.label} disabled={disabled} onChange={(event) => onChange({ label: event.target.value })} sx={{ flex: 1, minWidth: 0 }} />
      <ModelField provider={provider} disabled={disabled} onChange={onChange} />
    </Stack>
    <TextField fullWidth label="接口地址" value={provider.baseUrl} disabled={disabled} onChange={(event) => onChange({ baseUrl: event.target.value })} />
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "flex-start" } }}>
      <TextField fullWidth type="password" label="API 密钥" value={provider.apiKey ?? ""} disabled={disabled} onChange={(event) => onChange({ apiKey: event.target.value, clearApiKey: false })} placeholder={status?.apiKeyConfigured ? "已配置，留空保持不变" : "请输入 API 密钥"} helperText={status?.apiKeyConfigured ? "服务端已保存密钥；留空不会覆盖。" : undefined} autoComplete="new-password" />
      {status?.apiKeyConfigured && <FormControlLabel sx={{ minWidth: 132, mt: { sm: 1 } }} control={<Checkbox checked={provider.clearApiKey} disabled={disabled} onChange={(event) => onChange({ clearApiKey: event.target.checked, apiKey: "" })} />} label="清除密钥" />}
    </Stack>
  </Stack>;
}

function ModelField({ provider, disabled, onChange }: { provider: AiProviderSettingInput; disabled: boolean; onChange: (patch: Partial<AiProviderSettingInput>) => void }) {
  const presets = modelPresetsByProvider[provider.id] ?? [];
  if (presets.length === 0) {
    return <TextField fullWidth label="模型 ID" value={provider.model} disabled={disabled} onChange={(event) => onChange({ model: event.target.value })} />;
  }

  const isPreset = presets.some((preset) => preset.value === provider.model);
  return <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
    <FormControl fullWidth disabled={disabled}>
      <InputLabel id={`ai-model-preset-${provider.id}`}>模型预设</InputLabel>
      <Select
        labelId={`ai-model-preset-${provider.id}`}
        label="模型预设"
        value={isPreset ? provider.model : customModelValue}
        onChange={(event: any) => onChange({ model: event.target.value === customModelValue ? "" : event.target.value })}
      >
        {presets.map((preset) => <MenuItem key={preset.value} value={preset.value}>{preset.label}</MenuItem>)}
        <MenuItem value={customModelValue}>自定义模型</MenuItem>
      </Select>
    </FormControl>
    {!isPreset && <TextField fullWidth label="自定义模型 ID" value={provider.model} disabled={disabled} onChange={(event) => onChange({ model: event.target.value })} />}
  </Stack>;
}

function SettingsPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <Stack spacing={1.5} sx={{ border: 1, borderColor: "divider", borderRadius: 3, p: { xs: 2, sm: 2.5 }, bgcolor: "background.paper" }}>
    <Box><Typography variant="h4">{title}</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>{description}</Typography></Box>
    {children}
  </Stack>;
}

function SettingLabel({ title, description }: { title: string; description: string }) {
  return <Box><Typography component="span" sx={{ display: "block", fontWeight: 700 }}>{title}</Typography><Typography component="span" variant="body2" color="text.secondary">{description}</Typography></Box>;
}

function toDraft(settings: AiSettings): AiSettingsInput {
  return {
    enabled: settings.enabled,
    autoMatch: settings.autoMatch,
    maxCandidates: settings.maxCandidates,
    timeoutSeconds: settings.timeoutSeconds,
    providers: settings.providers.map(({ id, label, type, enabled, baseUrl, model }) => ({ id, label, type, enabled, baseUrl, model, apiKey: "", clearApiKey: false })),
  };
}

function clampNumber(value: string, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
