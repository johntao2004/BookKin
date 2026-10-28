import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MetadataAiAssistantButton } from "./MetadataAiAssistant";
import { request } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../ui/buttons";
import { _AntAlert } from "../../ui/antd";
import { Checkbox, Select, TextField } from "../../ui/forms";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "../../ui/overlays";
import { Box, FormControlLabel, MenuItem, Stack, Typography } from "../../ui/primitives";
import { reviewMarkdownToHtml } from "../reviews/markdown";
import "../content/content.css";

export type AiSource = "BOOK" | "ARTICLE" | "COLLECTION" | "NOTE_DRAFT" | "ARTICLE_DRAFT" | "METADATA_DRAFT";
export type AiAction = "SUMMARY" | "OUTLINE" | "QUESTIONS" | "ASK" | "READING_PLAN" | "POLISH" | "TITLES" | "DESCRIPTION" | "TAGS" | "AUTHOR_BIOGRAPHY";
export interface AiResult {
  text: string; evidence: { locator: string; quote: string }[]; provider: string; model: string;
  sourceTitle: string; included: number; total: number; coverage: string;
}
interface Props {
  source: AiSource; id?: string; draft?: string; label?: string; disabled?: boolean;
  actionLabel?: string;
  directAction?: "DESCRIPTION" | "TAGS" | "AUTHOR_BIOGRAPHY";
  onApply?: (text: string, action: AiAction) => void;
  applyActions?: AiAction[];
}
const labels: Record<AiAction, string> = { SUMMARY: "内容摘要", OUTLINE: "结构提纲", QUESTIONS: "讨论问题", ASK: "原文问答", READING_PLAN: "阅读顺序与导读", POLISH: "润色正文", TITLES: "标题建议", DESCRIPTION: "简介建议", TAGS: "标签建议", AUTHOR_BIOGRAPHY: "作者介绍建议" };
function Alert({ severity, children }: { severity: "info" | "warning" | "error" | "success"; children: ReactNode }) {
  return <_AntAlert type={severity} description={children} showIcon />;
}
const actions = (source: AiSource): AiAction[] => source === "METADATA_DRAFT" ? ["DESCRIPTION", "TAGS"]
  : source.endsWith("_DRAFT") ? ["POLISH", "OUTLINE", "TITLES", "SUMMARY"]
    : source === "COLLECTION" ? ["READING_PLAN", "SUMMARY", "QUESTIONS", "ASK"] : ["SUMMARY", "OUTLINE", "QUESTIONS", "ASK"];

/** Explicit per-call consent and preview. Results are ephemeral and never automatically saved. */
export function AiAssistantButton(props: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (props.source === "METADATA_DRAFT") return <MetadataAiAssistantButton {...props} />;
  if (!user) return null;
  return <>
    <Button type="button" disabled={props.disabled} onClick={() => setOpen(true)}>{props.label ?? "AI 助读"}</Button>
    {open && <AiAssistantSession key={`${user.id}:${props.source}:${props.id ?? "draft"}`} {...props} onClose={() => setOpen(false)} />}
  </>;
}

function AiAssistantSession({ source, id, draft, disabled, onApply, applyActions = ["POLISH"], onClose }: Props & { onClose: () => void }) {
  const [action, setAction] = useState<AiAction>(actions(source)[0]);
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ value: AiResult; draft?: string; action: AiAction }>();
  const resultHtml = useMemo(() => result ? reviewMarkdownToHtml(result.value.text) : "", [result]);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const isDraft = source.endsWith("_DRAFT");
  const invalidDraft = isDraft && (!draft?.trim() || draft.length > 20000);
  const changed = result && result.draft !== draft;
  const generate = async () => {
    if (busy || !consent || invalidDraft) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(""); setMessage(""); setResult(undefined);
    try {
      const value = await request<AiResult>("/ai/assistance", { method: "POST", signal: controller.signal,
        body: JSON.stringify({ source, id, action, question: action === "ASK" ? question : undefined, draft: isDraft ? draft : undefined, consent }) }, { timeoutMs: 150000 });
      if (!controller.signal.aborted) setResult({ value, draft, action });
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "AI 请求失败，请重试。"); }
    finally { if (!controller.signal.aborted) { setBusy(false); pending.current = null; } }
  };
  return <Dialog open fullWidth maxWidth="md" onClose={onClose}>
    <DialogTitle>{isDraft ? "AI 编辑辅助" : "AI 助读"}</DialogTitle>
    <DialogContent><Stack spacing={2}>
      <Alert severity="info">{isDraft ? "仅发送下方当前草稿给主人配置的 AI 平台，可能包含私人内容。结果需人工复核，采用后仍需保存。" : source === "COLLECTION" ? "将发送当前可访问的前 6 篇文章的标题和正文采样，每篇最多 3000 字。" : "将发送本内容的标题和最多 12 段正文采样，每段最多 1800 字。AI 仅基于采样材料回答，可能遗漏内容。"}</Alert>
      {isDraft && <Box component="details"><Typography component="summary">查看将发送的草稿（{draft?.length ?? 0} 字）</Typography><Typography component="pre" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" }}>{draft}</Typography></Box>}
      {invalidDraft && <Alert severity="warning">请先填写草稿；单次最多发送 20000 字，请缩短后再试。</Alert>}
      <Select label="AI 操作" value={action} disabled={busy} onChange={event => { setAction(event.target.value as AiAction); setResult(undefined); setMessage(""); }}>
        {actions(source).map(value => <MenuItem key={value} value={value}>{labels[value]}</MenuItem>)}
      </Select>
      {action === "ASK" && <TextField label="想了解什么" value={question} disabled={busy} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} onChange={event => { setQuestion(event.target.value); setResult(undefined); }} />}
      <FormControlLabel control={<Checkbox checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />} label="我同意本次将上述内容发送给已配置的 AI 平台" />
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      {busy && <Typography role="status">AI 正在生成，请稍候…</Typography>}
      {result && <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">{result.value.provider} · {result.value.model} · {result.value.sourceTitle}</Typography>
        <Alert severity="warning">{result.value.coverage}</Alert>
        <Box component="section" aria-label="AI 生成结果" className="bk-content-prose bk-markdown-prose bk-article-markdown-preview" dangerouslySetInnerHTML={{ __html: resultHtml }} />
        {result.value.evidence.length > 0 && <Stack spacing={1}><Typography fontWeight={700}>原文依据</Typography>{result.value.evidence.map((item, index) => <Box key={`${item.locator}:${index}`}><Typography component="blockquote" sx={{ m: 0 }}>{item.quote}</Typography><Typography variant="caption" color="text.secondary">{item.locator}</Typography></Box>)}</Stack>}
        {changed && <Alert severity="warning">草稿已变化，请重新生成后再采用，避免覆盖新的修改。</Alert>}
      </Stack>}
    </Stack></DialogContent>
    <DialogActions>
      <Button onClick={onClose}>关闭助手</Button>
      {result && <Button onClick={() => { void navigator.clipboard.writeText(result.value.text).then(() => setMessage("已复制建议。"), () => setError("无法访问剪贴板，请选择结果文本复制。")); }}>复制结果</Button>}
      {result && onApply && applyActions.includes(result.action) && <Button disabled={Boolean(changed) || disabled} onClick={() => { if (!changed && !disabled) { onApply(result.value.text, result.action); onClose(); } }}>采用建议</Button>}
      <Button variant="contained" disabled={disabled || busy || !consent || invalidDraft || (action === "ASK" && !question.trim())} onClick={() => void generate()}>{busy ? "生成中…" : "生成建议"}</Button>
    </DialogActions>
  </Dialog>;
}
