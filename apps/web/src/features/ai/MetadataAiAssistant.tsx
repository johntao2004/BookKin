import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { request } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../ui/buttons";
import { _AntAlert } from "../../ui/antd";
import { Select, TextField } from "../../ui/forms";
import { Dialog, DialogContent, DialogTitle } from "../../ui/overlays";
import { AiResultActions } from "./AiResultActions";
import { Box, MenuItem, Stack, Typography } from "../../ui/primitives";
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
const actions = (source: AiSource): AiAction[] => source === "METADATA_DRAFT" ? ["DESCRIPTION", "TAGS", "AUTHOR_BIOGRAPHY"]
  : source.endsWith("_DRAFT") ? ["POLISH", "OUTLINE", "TITLES", "SUMMARY"]
    : source === "COLLECTION" ? ["READING_PLAN", "SUMMARY", "QUESTIONS", "ASK"] : ["SUMMARY", "OUTLINE", "QUESTIONS", "ASK"];

/** Generation starts only on an explicit click; results require adoption and are never automatically saved. */
export function MetadataAiAssistantButton(props: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return <>
    <Button type="button" aria-label={props.actionLabel} title={props.actionLabel} disabled={props.disabled} onClick={() => setOpen(true)}>{props.label ?? "AI 助读"}</Button>
    {open && <AiAssistantSession key={`${user.id}:${props.source}:${props.id ?? "draft"}`} {...props} onClose={() => setOpen(false)} />}
  </>;
}

function AiAssistantSession({ source, id, draft, disabled, directAction, onApply, applyActions = ["POLISH"], onClose }: Props & { onClose: () => void }) {
  const directMode = source === "METADATA_DRAFT" && directAction !== undefined;
  const [action, setAction] = useState<AiAction>(actions(source)[0]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [result, setResult] = useState<{ value: AiResult; draft?: string; action: AiAction }>();
  const resultHtml = useMemo(() => result ? reviewMarkdownToHtml(result.value.text) : "", [result]);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const isDraft = source.endsWith("_DRAFT");
  const invalidDraft = isDraft && (!draft?.trim() || draft.length > 20000);
  const changed = result && result.draft !== draft;
  const generate = async (requestedAction: AiAction = action) => {
    if (disabled || busy || pending.current || invalidDraft || (requestedAction === "ASK" && !question.trim())) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(""); setResult(undefined);
    try {
      const value = await request<AiResult>("/ai/assistance", { method: "POST", signal: controller.signal,
        body: JSON.stringify({ source, id, action: requestedAction, question: requestedAction === "ASK" ? question : undefined, draft: isDraft ? draft : undefined, consent: true }) }, { timeoutMs: 150000 });
      if (!controller.signal.aborted) { setResult({ value, draft, action: requestedAction }); setHasGenerated(true); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "AI 请求失败，请重试。"); }
    finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const generateRef = useRef(generate);
  generateRef.current = generate;
  const autoAction = useRef<AiAction | undefined>(directMode ? directAction : undefined);
  useEffect(() => {
    if (!autoAction.current) return;
    // Deferring lets StrictMode's setup/cleanup replay cancel its first timer before any request starts.
    const timer = window.setTimeout(() => { void generateRef.current(autoAction.current!); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <Dialog open fullWidth maxWidth={isDraft ? "sm" : "md"} onClose={onClose}>
    <DialogTitle>{directMode ? `AI ${labels[directAction]}` : isDraft ? "AI 编辑辅助" : "AI 助读"}</DialogTitle>
    <DialogContent><Stack spacing={2}>
      {invalidDraft && <Alert severity="warning">请先填写草稿；单次最多发送 20000 字，请缩短后再试。</Alert>}
      {!directMode && <Select label="AI 操作" value={action} disabled={busy} onChange={event => { setAction(event.target.value as AiAction); setResult(undefined); setHasGenerated(false); }}>
        {actions(source).map(value => <MenuItem key={value} value={value}>{labels[value]}</MenuItem>)}
      </Select>}
      {action === "ASK" && <TextField label="想了解什么" value={question} disabled={busy} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} onChange={event => { setQuestion(event.target.value); setResult(undefined); }} />}
      {error && <Alert severity="error">{error}</Alert>}
      {busy && <Typography role="status">AI 正在生成，请稍候…</Typography>}
      {result && <Stack spacing={2}>
        <Box component="section" aria-label="AI 生成结果" className="bk-content-prose bk-markdown-prose bk-article-markdown-preview" dangerouslySetInnerHTML={{ __html: resultHtml }} />
        {changed && <Alert severity="warning">草稿已变化，请重新生成后再采用，避免覆盖新的修改。</Alert>}
      </Stack>}
    </Stack></DialogContent>
    <AiResultActions initialGeneration={!hasGenerated} regenerateLabel={busy ? "生成中…" : hasGenerated ? "重新生成" : "生成建议"}
      regenerateDisabled={disabled || busy || invalidDraft || (action === "ASK" && !question.trim())}
      onRegenerate={() => void generate(directMode ? directAction : undefined)}
      applyDisabled={Boolean(changed) || disabled || busy}
      onApply={result && onApply && applyActions.includes(result.action) ? () => { if (!changed && !disabled && !busy) { onApply(result.value.text, result.action); onClose(); } } : undefined} />
  </Dialog>;
}
