import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@/ui/primitives";
import { TextField, Switch } from "@/ui/forms";
import { tokens } from "../theme/generated-tokens";

export interface MetadataEditorValues {
  title: string; subtitle: string; authors: string; translators: string;
  language: string; publisher: string; publishedDate: string; isbn: string;
  series: string; seriesIndex: string; tags: string; description: string;
  publiclyVisible: boolean;
}
const fields = [
  ["title", "书名"], ["subtitle", "副标题"], ["authors", "作者"], ["translators", "译者"],
  ["language", "语言"], ["publisher", "出版社"], ["publishedDate", "出版日期"], ["isbn", "ISBN"],
  ["series", "系列"], ["seriesIndex", "系列序号"], ["tags", "标签"],
] as const;

/** Both saved books and staged uploads render this single bibliographic form. */
export function MetadataEditorForm({ value, onChange, coverUrl, coverAlt, coverActions, coverDetails, extraFields, children, disabled = false }: {
  value: MetadataEditorValues; onChange: (key: keyof MetadataEditorValues, value: string | boolean) => void;
  coverUrl?: string; coverAlt: string; coverActions: ReactNode; coverDetails?: ReactNode;
  extraFields?: ReactNode; children?: ReactNode; disabled?: boolean;
}) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: `${tokens.spacing[20] * 3}px minmax(0, 1fr)` }, gap: 4 }}>
    <Stack spacing={1.5} sx={{ minWidth: 0, alignItems: "stretch" }}>
      <Box component="img" src={coverUrl} alt={coverAlt} sx={{ width: "100%", maxWidth: tokens.spacing[20] * 3, aspectRatio: "2 / 3", objectFit: "cover", bgcolor: "background.default", borderRadius: 2, boxShadow: tokens.shadow.cover }} />
      {coverDetails && <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>{coverDetails}</Stack>}
      {coverActions}
    </Stack>
    <Stack spacing={2.25} sx={{ minWidth: 0 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
        {fields.map(([key, label]) => <TextField key={key} label={label} required={key === "title" || key === "authors"} type={key === "seriesIndex" ? "number" : "text"} value={value[key]} disabled={disabled} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value)} />)}
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}><Typography>公开展示</Typography><Switch aria-label="公开展示" checked={value.publiclyVisible} disabled={disabled} onChange={(_, checked) => onChange("publiclyVisible", checked)} /></Stack>
        {extraFields}
      </Box>
      <TextField label="简介" value={value.description} multiline minRows={5} disabled={disabled} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange("description", event.target.value)} />
      {children}
    </Stack>
  </Box>;
}
