import { useIsMutating } from "@tanstack/react-query";
import { BookMetadataLayout, bookMetadataFieldsSx, bookMetadataTitleSx } from "./BookMetadataLayout";
import { ActionToolbar } from "./PageHeader";
import type { BookKnowledgeDraft } from "../domain/types";
import { KnowledgePointField } from "./KnowledgePointField";
import { SeriesField } from "./SeriesField";
import { parseLanguages, serializeLanguages } from "../domain/languages";
import { LanguageField } from "./LanguageField";
import { TagField, parseTags } from "./TagField";
import { AiAssistantButton } from "../features/ai/AiAssistant";
import { BookContentSuggestionButton, type ContentMetadataSource } from "./BookContentSuggestionButton";
import { useId, type ReactNode } from "react";
import { Box, FormControl, InputLabel, Stack, Typography } from "@/ui/primitives";
import { InputActionGroup, TextField, Switch } from "@/ui/forms";
import { Divider } from "@/ui/feedback";
import { tokens } from "../theme/generated-tokens";
import { PublicationMonthField } from "../ui/PublicationMonthField";

export interface MetadataEditorValues {
  title: string; subtitle: string; authors: string; translators: string;
  language: string; publisher: string; publishedDate: string; isbn: string;
  series: string; seriesIndex: string; tags: string; description: string;
  publiclyVisible: boolean; authorBiography?: string; tableOfContents?: string;
}
const fields = [
  ["title", "书名"], ["subtitle", "副标题"], ["authors", "作者"], ["translators", "译者"],
  ["publisher", "出版社"], ["publishedDate", "出版日期"], ["isbn", "ISBN"], ["language", "语言"],
  ["series", "系列"], ["seriesIndex", "系列序号"],
] as const;

// 已入库书籍与暂存上传共用同一个书目表单。
/** Both saved books and staged uploads render this single bibliographic form. */
export function MetadataEditorForm({ value, onChange, coverUrl, coverAlt, coverActions, coverDetails, extraFields, children, disabled = false, aiEnabled = false, aiContentSource, actions, knowledgeDraft, onKnowledgeChange, knowledgeLoading, knowledgeError, onRetryKnowledge, knowledgeAvailable = true, knowledgeTerms, onKnowledgeTermsChange }: {
  value: MetadataEditorValues; onChange: (key: keyof MetadataEditorValues, value: string | boolean) => void;
  coverUrl?: string; coverAlt: string; coverActions: ReactNode; coverDetails?: ReactNode;
  extraFields?: (actions: ReactNode) => ReactNode; children?: ReactNode; disabled?: boolean; aiEnabled?: boolean;
  aiContentSource?: ContentMetadataSource;
  knowledgeTerms?: string[]; onKnowledgeTermsChange?: (terms: string[]) => void;
  actions?: ReactNode; knowledgeDraft?: BookKnowledgeDraft; onKnowledgeChange?: (draft: BookKnowledgeDraft) => void;
  knowledgeAvailable?: boolean; knowledgeLoading?: boolean; knowledgeError?: string; onRetryKnowledge?: () => void;
}) {
  const formId = useId();
  const savingTerms = useIsMutating({ mutationKey: ["metadata-term-save"] }) > 0;
  const aiDraft = JSON.stringify({ title: value.title, authors: value.authors, description: value.description, tags: value.tags, authorBiography: value.authorBiography ?? "", tableOfContents: value.tableOfContents ?? "" }, null, 2);
  const aiDraftFields = { DESCRIPTION: ["description", "AI 生成简介"], AUTHOR_BIOGRAPHY: ["authorBiography", "AI 生成作者介绍"] } as const;
  const aiButton = (action: keyof typeof aiDraftFields) => aiEnabled ? <AiAssistantButton source="METADATA_DRAFT"
    directAction={action} label="AI" actionLabel={aiDraftFields[action][1]} disabled={disabled} draft={aiDraft}
    applyActions={[action]} onApply={text => onChange(aiDraftFields[action][0], text)} /> : null;
  const tagSeparator = (tags: string) => tags.match(/[，,;；]/)?.[0] ?? "，";
  const aiTagButton = aiEnabled ? <BookContentSuggestionButton source={aiContentSource} mode="tags" value={parseTags(value.tags)}
    onApply={tags => onChange("tags", tags.join(tagSeparator(value.tags)))} disabled={disabled || !aiContentSource} actionLabel="AI 生成标签" /> : null;
  const renderField = ([key, label]: typeof fields[number], options: { hero?: boolean; multiline?: boolean; resizable?: boolean; sx?: Record<string, unknown> } = {}) => key === "language"
    ? <LanguageField key={key} value={value.language} disabled={disabled} onChange={next => onChange("language", next)} actions={aiEnabled ? <BookContentSuggestionButton source={aiContentSource} mode="languages" value={parseLanguages(value.language)} onApply={next => onChange("language", serializeLanguages(next))} disabled={disabled} /> : null} />
    : key === "series" ? <SeriesField key={key} value={value.series} disabled={disabled} onChange={next => onChange("series", next)} actions={aiEnabled ? <BookContentSuggestionButton source={aiContentSource} mode="series" value={value.series ? [value.series] : []} onApply={next => onChange("series", next[0] ?? "")} disabled={disabled} /> : null} />
    : key === "publishedDate" ? <PublicationMonthField key={key} value={value.publishedDate} disabled={disabled} onChange={next => onChange("publishedDate", next)} />
    : <TextField key={key}
    aria-label={label} label={options.hero ? undefined : label} placeholder={options.hero ? label : undefined} sx={options.sx}
    required={key === "title" || key === "authors"} multiline={options.multiline} resizable={options.resizable} minRows={options.multiline ? 1 : undefined}
    type={options.multiline ? undefined : key === "seriesIndex" ? "number" : "text"} value={value[key]}
    disabled={disabled} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value)} />;
  const visibilityField = <FormControl key="publiclyVisible">
    <InputLabel>公开展示</InputLabel>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start", minHeight: `${tokens.layout.controlHeight}px` }}>
      <Switch aria-label="公开展示" checked={value.publiclyVisible} disabled={disabled} onChange={(_, checked) => onChange("publiclyVisible", checked)} />
    </Box>
  </FormControl>;
  const classificationFields = <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, minWidth: 0 }}>
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      <InputLabel htmlFor={`${formId}-tags`}>标签</InputLabel>
      <InputActionGroup>
        <Box sx={{ flex: "1 1 0", minWidth: 0 }}>
          <TagField id={`${formId}-tags`} value={value.tags} disabled={disabled} onChange={next => onChange("tags", next)} />
        </Box>
        {aiTagButton}
      </InputActionGroup>
    </Stack>
    {extraFields?.(null)}
  </Box>;
  const longTextField = (key: "description" | "authorBiography", label: string, sectionId?: string) => <Stack spacing={1} sx={{ minWidth: 0 }}>
    {sectionId ? <Typography id={sectionId} variant="h5" component="h3">{label}</Typography> : <InputLabel htmlFor={`${formId}-${key}`}>{label}</InputLabel>}
    <InputActionGroup>
      <TextField aria-label={label} slotProps={{ htmlInput: { id: `${formId}-${key}` } }} value={value[key] ?? ""} multiline resizable minRows={1} disabled={disabled} sx={{ flex: 1, minWidth: 0 }}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value)} />
      {key === "description" && aiButton("DESCRIPTION")}
      {key === "authorBiography" && aiButton("AUTHOR_BIOGRAPHY")}
    </InputActionGroup>
  </Stack>;

  return <BookMetadataLayout coverUrl={coverUrl} coverAlt={coverAlt} coverActions={coverActions}>
      {coverDetails && <Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[2]}px` }}>{coverDetails}</Stack>}
      <Stack sx={{ minWidth: 0, gap: `${tokens.spacing[2]}px` }}>
        {renderField(fields[0], { hero: true, multiline: true, resizable: false, sx: { "& .ant-input": { ...bookMetadataTitleSx, overflow: "hidden" } } })}
        {renderField(fields[1], { hero: true })}
        {renderField(fields[2], { hero: true, sx: { "& .ant-input": { color: "text.secondary" } } })}
      </Stack>
      <Divider />
      <Box component="section" aria-labelledby="metadata-editor-bibliography-title">
        <Typography id="metadata-editor-bibliography-title" variant="h5" component="h3" sx={{ mb: `${tokens.spacing[4]}px` }}>书目资料</Typography>
        <Box sx={bookMetadataFieldsSx}>
          {fields.slice(3).map((field) => renderField(field))}
          {visibilityField}
        </Box>
        <Box sx={{ mt: 2 }}>{classificationFields}</Box>
      </Box>
      {knowledgeAvailable && <KnowledgePointField id={`${formId}-knowledge`} value={knowledgeDraft} onChange={onKnowledgeChange}
        source={aiContentSource} disabled={disabled} aiEnabled={aiEnabled} terms={knowledgeTerms} onTermsChange={onKnowledgeTermsChange}
        loading={knowledgeLoading} error={knowledgeError} onRetry={onRetryKnowledge} />}
      <Box component="section" aria-labelledby="metadata-editor-description-title">
        {longTextField("description", "内容简介", "metadata-editor-description-title")}
      </Box>
      <Box component="section" aria-labelledby="metadata-editor-author-biography-title">
        {longTextField("authorBiography", "作者介绍", "metadata-editor-author-biography-title")}
      </Box>
      {children}
      {actions && <Box component="fieldset" disabled={savingTerms} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}><ActionToolbar>{actions}</ActionToolbar></Box>}
  </BookMetadataLayout>;
}
