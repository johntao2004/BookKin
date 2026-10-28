import { useEffect, useRef, useState } from "react";
import { selectableKnowledgePoints } from "../domain/knowledge";
import type { BookKnowledgeDraft } from "../domain/types";
import { api, request } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { languageOption } from "../domain/languages";
import { themaLabel } from "../domain/thema";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { Checkbox } from "../ui/forms";
import { Dialog, DialogContent, DialogTitle } from "../ui/overlays";
import { AiResultActions } from "../features/ai/AiResultActions";
import { Stack, Typography } from "../ui/primitives";

export interface ContentMetadataSource { type: "BOOK" | "UPLOAD"; id: string }
interface Evidence { locator: string; quote: string }
interface ClassificationResult {
  subjects: { code: string; reason: string; evidence: Evidence[] }[];
  tags: string[];
  included: number;
  total: number;
  coverage: string;
  evidence?: Evidence[];
}
interface Props {
  source?: ContentMetadataSource;
  mode: "subjects" | "tags" | "knowledge" | "languages" | "series";
  knowledgeDraft?: BookKnowledgeDraft;
  onApplyKnowledge?: (next: BookKnowledgeDraft) => void;
  value: string[];
  onApply: (next: string[]) => void;
  disabled?: boolean;
  actionLabel?: string;
}

/** These actions send a file identity, never bibliographic text or a title-search query. */
const modeLabels = { subjects: "生成分类建议", tags: "AI 生成标签", knowledge: "AI 识别知识点", languages: "AI 识别语言", series: "AI 识别系列" };
export function BookContentSuggestionButton(props: Props) {
  const { user } = useAuth();
  const [openedSource, setOpenedSource] = useState<string | null>(null);
  const key = user && props.source ? `${user.id}:${props.source.type}:${props.source.id}:${props.mode}` : "";
  useEffect(() => { setOpenedSource(null); }, [key]);
  return <>
    <Button type="button" aria-label={props.actionLabel ?? modeLabels[props.mode]}
      title={props.source ? (props.actionLabel ?? modeLabels[props.mode]) : "请先上传或选择可读取的书籍"}
      disabled={props.disabled || !props.source?.id || !user} onClick={() => setOpenedSource(key)}>AI</Button>
    {key && openedSource === key && props.source && <ContentSuggestionSession key={key} {...props} source={props.source} onClose={() => setOpenedSource(null)} />}
  </>;
}

function ContentSuggestionSession({ source, mode, value, onApply, knowledgeDraft, onApplyKnowledge, disabled, onClose }: Props & { source: ContentMetadataSource; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const live = useRef(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ candidates: string[]; knowledgeDraft?: BookKnowledgeDraft; labels?: Record<string, string>; base: string }>();
  const [selected, setSelected] = useState<string[]>([]);
  const pending = useRef<AbortController | null>(null);
  const limit = mode === "subjects" ? 4 : mode === "knowledge" ? 10 : mode === "series" ? 1 : 50;
  const currentBase = JSON.stringify(mode === "knowledge" ? { knowledgeDraft, value } : value);
  const available = mode === "series" ? 1 : Math.max(0, limit - new Set(mode === "knowledge" ? (knowledgeDraft?.points ?? []).map(point => point.name) : value).size);
  const currentBaseRef = useRef(currentBase); currentBaseRef.current = currentBase;
  const changed = result !== undefined && result.base !== currentBase;
  const candidates = result?.candidates ?? [];
  const generate = async () => {
    if (pending.current || disabled) return;
    const controller = new AbortController();
    pending.current = controller;
    const base = currentBase;
    setBusy(true); setError(""); setResult(undefined); setSelected([]);
    try {
      const options = {
        method: "POST", signal: controller.signal,
        body: JSON.stringify({ source: source.type, id: source.id, consent: true }),
      };
      let suggestions: string[];
      let labels: Record<string, string> | undefined;
      let generatedKnowledge: BookKnowledgeDraft | undefined;
      if (mode === "knowledge") {
        generatedKnowledge = await request<BookKnowledgeDraft>("/ai/book-knowledge", options, { timeoutMs: 180000 });
        generatedKnowledge = { ...generatedKnowledge, points: selectableKnowledgePoints(generatedKnowledge.points).slice(0, 10) };
        suggestions = generatedKnowledge.points.map(point => point.name);
      } else if (mode === "languages" || mode === "series") {
        const data = await request<{ items: { value: string; label: string }[] }>("/ai/metadata-terms", {
          ...options, body: JSON.stringify({ source: source.type, id: source.id, consent: true, kind: mode === "languages" ? "LANGUAGE" : "SERIES" }),
        }, { timeoutMs: 180000 });
        suggestions = data.items.map(item => item.value);
        labels = Object.fromEntries(data.items.map(item => [item.value, item.label]));
      } else {
        const data = await request<ClassificationResult>("/ai/book-classification", options, { timeoutMs: 180000 });
        suggestions = mode === "subjects" ? data.subjects.map(item => item.code) : data.tags;
      }
      if (!controller.signal.aborted) {
        const candidates = [...new Set(suggestions)].slice(0, mode === "knowledge" ? 10 : mode === "subjects" ? 4 : 5);
        setResult({ candidates, knowledgeDraft: generatedKnowledge, labels, base });
        setSelected(candidates.filter(item => mode === "series" || !value.includes(item)).slice(0, available));
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "无法分析原文件，请重试。");
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const generateRef = useRef(generate);
  generateRef.current = generate;
  useEffect(() => {
    live.current = true;
    const timer = window.setTimeout(() => { void generateRef.current(); }, 0);
    return () => { live.current = false; window.clearTimeout(timer); pending.current?.abort(); };
  }, []);
  const title = mode === "subjects" ? "分类建议" : mode === "knowledge" ? "AI 知识点建议" : mode === "languages" ? "AI 语言建议" : mode === "series" ? "AI 系列建议" : "AI 标签建议";
  return <Dialog open fullWidth maxWidth="sm" onClose={adopting ? undefined : onClose}>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent><Stack spacing={2}>
      {adopting && <Typography role="status">正在保存共享选项…</Typography>}
      {busy && <Typography role="status">正在读取原文并分析，请稍候…</Typography>}
      {error && <Alert severity="error">{error}</Alert>}
      {result && <>
        {candidates.length === 0 && <Typography role="status">当前原文不足以生成可靠建议，请手动选择。</Typography>}
        {candidates.map(item => {
          const existing = mode !== "series" && value.includes(item);
          const checked = existing || selected.includes(item);
          return <Checkbox key={item} checked={checked} disabled={adopting || disabled || changed || existing || (!checked && selected.length >= available)}
              onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, item])] : current.filter(entry => entry !== item))}>
              {mode === "subjects" ? themaLabel(item) : result.labels?.[item] ?? (mode === "languages" ? languageOption(item).label : item)}{existing ? "（已选）" : ""}
            </Checkbox>;
        })}
        {available === 0 && <Alert severity="info">当前{mode === "subjects" ? "分类" : mode === "knowledge" ? "知识点" : "标签"}已达上限，请先调整已有选择。</Alert>}
        {changed && <Alert severity="warning">当前选择已变化，请重新分析后再确认。</Alert>}
      </>}
    </Stack></DialogContent>
    <AiResultActions regenerateLabel={busy ? "生成中…" : result ? "重新生成" : "重试"}
      regenerateDisabled={adopting || busy || disabled} onRegenerate={() => void generate()} applyLabel="确认选择"
      applyDisabled={adopting || busy || disabled || changed || selected.length === 0 || !result}
      onApply={() => { void (async () => {
        if (!result || changed || disabled || busy || adopting) return;
        setAdopting(true); setError("");
        try {
          let adopted = selected;
          if (mode !== "subjects") {
            const kind = mode === "languages" ? "LANGUAGE" : mode === "series" ? "SERIES" : mode === "knowledge" ? "KNOWLEDGE" : "TAG";
            const saved = await api.ensureMetadataTerms(kind, selected.map(value => ({ value, label: result.labels?.[value] ?? value })));
            if (mode !== "knowledge" && saved.items.length === selected.length) adopted = saved.items.map(term => term.value);
          }
          if (!live.current) return;
          if (currentBaseRef.current !== result.base) { setError("当前选择已变化，请重新分析后再确认。"); return; }
          if (mode === "knowledge" && result.knowledgeDraft && onApplyKnowledge) {
            const points = selectableKnowledgePoints(knowledgeDraft?.points ?? []);
            for (const point of result.knowledgeDraft.points) {
              if (selected.includes(point.name) && !points.some(existing => existing.name === point.name)) points.push(point);
            }
            onApplyKnowledge({ ...result.knowledgeDraft, points });
          } else onApply(mode === "series" ? adopted.slice(0, 1) : [...new Set([...value, ...adopted])]);
          onClose();
        } catch (failure) { if (live.current) setError(failure instanceof Error ? failure.message : "选项保存失败，请重试。"); }
        finally { if (live.current) setAdopting(false); }
      })(); }} />
  </Dialog>;
}
