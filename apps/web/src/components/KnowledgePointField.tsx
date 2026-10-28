import { useState } from "react";
import { useMetadataTerms } from "./useMetadataTerms";
import AntSelect from "antd/es/select";
import { selectableKnowledgePoints } from "../domain/knowledge";
import type { BookKnowledgeDraft } from "../domain/types";
import { Alert } from "../ui/feedback";
import { Button } from "../ui/buttons";
import { InputActionGroup } from "../ui/forms";
import { Box, InputLabel, Stack, Typography } from "../ui/primitives";
import { BookContentSuggestionButton, type ContentMetadataSource } from "./BookContentSuggestionButton";

/** Manual vocabulary associations and excerpt-backed points share a picker; evidence stays with its book. */
export function KnowledgePointField({ id, value, onChange, source, disabled, aiEnabled = true, loading, error, onRetry, terms: selectedTerms = [], onTermsChange }: {
  terms?: string[];
  onTermsChange?: (terms: string[]) => void;
  id: string;
  value?: BookKnowledgeDraft;
  onChange?: (draft: BookKnowledgeDraft) => void;
  source?: ContentMetadataSource;
  disabled?: boolean;
  aiEnabled?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const points = selectableKnowledgePoints(value?.points ?? []);
  const vocabulary = useMetadataTerms("KNOWLEDGE", { enabled: !disabled });
  const [search, setSearch] = useState("");
  const key = (text: string) => text.normalize("NFKC").trim().toLocaleLowerCase();
  const unique = (items: string[]) => [...new Map(items.map(item => [key(item), item.trim()])).values()].filter(Boolean);
  const names = unique([...(selectedTerms ?? []), ...points.map(point => point.name)]);
  const unavailable = disabled || loading || Boolean(error) || vocabulary.isSaving;
  const select = (selected: string[]) => {
    setSearch(""); vocabulary.search("");
    const next = unique(selected);
    const additions = next.filter(name => ![...names, ...vocabulary.options.map(term => term.value)].some(existing => key(existing) === key(name)));
    void vocabulary.commit(additions.map(name => ({ value: name, label: name })), saved => {
      const canonical = next.map(name => saved.find(term => key(term.value) === key(name))?.value ?? name);
      onTermsChange?.(canonical);
      if (value && onChange && points.some(point => !next.some(name => key(name) === key(point.name))))
        onChange({ ...value, points: points.filter(point => next.some(name => key(name) === key(point.name))) });
      setSearch(""); vocabulary.search("");
    });
  };
  return <Stack spacing={1} sx={{ minWidth: 0 }}>
    <InputLabel htmlFor={id}>知识点</InputLabel>
    <InputActionGroup>
      <Box sx={{ flex: "1 1 0", minWidth: 0 }}>
        <AntSelect id={id} aria-label="知识点" className="bk-select" style={{ width: "100%" }}
          mode="tags" showSearch allowClear maxCount={50} disabled={unavailable || (!onTermsChange && !onChange)} filterOption={false}
          tokenSeparators={[",", "，", ";", "；"]} searchValue={search} onSearch={text => { setSearch(text); vocabulary.search(text); }}
          placeholder="搜索知识点，或输入新增知识点" value={names}
          options={unique([...vocabulary.options.map(term => term.value), ...names]).map(name => ({ value: name, label: name }))} onChange={select} />
      </Box>
      {aiEnabled && <BookContentSuggestionButton source={source} mode="knowledge" value={names}
        knowledgeDraft={value} onApply={select} onApplyKnowledge={next => { onChange?.(next); onTermsChange?.(unique([...names, ...next.points.map(point => point.name)])); }}
        disabled={unavailable || !onChange} actionLabel="AI 识别知识点" />}
    </InputActionGroup>
    {vocabulary.error && <Alert severity="error" action={<Button onClick={vocabulary.retry}>重试共享知识点</Button>}>{vocabulary.error}</Alert>}
    {loading && <Typography role="status" variant="caption">正在读取知识点…</Typography>}
    {error && <Alert severity="error" action={onRetry ? <Button onClick={onRetry}>重试知识点</Button> : undefined}>{error}</Alert>}
  </Stack>;
}
