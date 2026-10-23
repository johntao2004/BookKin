import { BookCover } from "./BookCover";
import { AiAssistantButton } from "../features/ai/AiAssistant";
import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@/ui/primitives";
import { TextField, Switch } from "@/ui/forms";
import { tokens } from "../theme/generated-tokens";

export interface MetadataEditorValues {
  title: string; subtitle: string; authors: string; translators: string;
  language: string; publisher: string; publishedDate: string; isbn: string;
  series: string; seriesIndex: string; tags: string; description: string;
  publiclyVisible: boolean; authorBiography?: string; tableOfContents?: string;
}
const fields = [
  ["title", "书名"], ["subtitle", "副标题"], ["authors", "作者"], ["translators", "译者"],
  ["language", "语言"], ["publisher", "出版社"], ["publishedDate", "出版日期"], ["isbn", "ISBN"],
  ["series", "系列"], ["seriesIndex", "系列序号"], ["tags", "标签"],
] as const;

// 已入库书籍与暂存上传共用同一个书目表单。
/** Both saved books and staged uploads render this single bibliographic form. */
export function MetadataEditorForm({ value, onChange, coverUrl, coverAlt, coverActions, coverDetails, extraFields, children, disabled = false, aiEnabled = false }: {
  value: MetadataEditorValues; onChange: (key: keyof MetadataEditorValues, value: string | boolean) => void;
  coverUrl?: string; coverAlt: string; coverActions: ReactNode; coverDetails?: ReactNode;
  extraFields?: ReactNode; children?: ReactNode; disabled?: boolean; aiEnabled?: boolean;
}) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: `${tokens.spacing[20] * 3}px minmax(0, 1fr)` }, gap: 4 }}>
    <Stack spacing={1.5} sx={{ minWidth: 0, alignItems: "stretch" }}>
      <BookCover src={coverUrl} alt={coverAlt} sx={{ maxWidth: `${tokens.spacing[20] * 3}px` }} />
      {coverDetails && <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>{coverDetails}</Stack>}
      {coverActions}
    </Stack>
    <Stack spacing={2.25} sx={{ minWidth: 0 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
        {fields.map(([key, label]) => <TextField key={key} label={label} required={key === "title" || key === "authors"} type={key === "seriesIndex" ? "number" : "text"} value={value[key]} disabled={disabled} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value)} />)}
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}><Typography>公开展示</Typography><Switch aria-label="公开展示" checked={value.publiclyVisible} disabled={disabled} onChange={(_, checked) => onChange("publiclyVisible", checked)} /></Stack>
        {extraFields}
      </Box>
      {aiEnabled && <AiAssistantButton source="METADATA_DRAFT" label="AI 简介与标签" disabled={disabled}
        draft={JSON.stringify({ title: value.title, authors: value.authors, description: value.description, tags: value.tags, tableOfContents: value.tableOfContents ?? "" }, null, 2)}
        applyActions={["DESCRIPTION", "TAGS"]} onApply={(text, action) => onChange(action === "TAGS" ? "tags" : "description", text)} />}
      <TextField label="简介" value={value.description} multiline minRows={5} disabled={disabled} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange("description", event.target.value)} />
      <TextField label="作者介绍" value={value.authorBiography ?? ""} multiline minRows={3} disabled={disabled} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange("authorBiography", event.target.value)} />
      <TextField label="目录" value={value.tableOfContents ?? ""} multiline minRows={5} disabled={disabled} helperText="可从原书目录识别，也可手工校对；不修改阅读器原有目录。" onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange("tableOfContents", event.target.value)} />
      {children}
    </Stack>
  </Box>;
}
