import AntSelect from "antd/es/select";
import { useId, useState, type ReactNode } from "react";
import { useMetadataTerms } from "./useMetadataTerms";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { InputActionGroup } from "../ui/forms";
import { Box, InputLabel, Stack } from "../ui/primitives";

export function SeriesField({ value, onChange, disabled, actions }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; actions?: ReactNode;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const terms = useMetadataTerms("SERIES", { enabled: !disabled });
  const key = (text: string) => text.normalize("NFKC").trim().toLocaleLowerCase();
  const options = [...new Map([...terms.options.map(term => ({ value: term.value, label: term.label })),
    ...(value ? [{ value, label: value }] : [])].map(option => [key(option.value), option])).values()];
  const create = () => {
    const text = search.trim();
    if (!text || disabled || terms.isSaving) return;
    const existing = options.find(option => key(option.value) === key(text) || key(option.label) === key(text));
    if (existing) { onChange(existing.value); setSearch(""); terms.search(""); return; }
    void terms.commit([{ value: text, label: text }], saved => { onChange(saved[0].value); setSearch(""); terms.search(""); });
  };
  const control = <AntSelect id={id} aria-label="系列" className="bk-select" style={{ width: "100%" }} showSearch allowClear
    value={value || undefined} searchValue={search} disabled={disabled || terms.isSaving} filterOption={false}
    placeholder="搜索系列，或输入新增系列" options={search.trim() && !options.some(option => key(option.value) === key(search))
      ? [...options, { value: search.trim(), label: `新增“${search.trim()}”` }] : options}
    onSearch={text => { setSearch(text); terms.search(text); }}
    onChange={next => {
      setSearch(""); terms.search("");
      if (!next) { onChange(""); setSearch(""); terms.search(""); }
      else void terms.commit([{ value: next, label: next }], saved => { onChange(saved[0].value); setSearch(""); terms.search(""); });
    }} onBlur={create} onInputKeyDown={event => { if (event.key === "Enter" && search.trim()) { event.preventDefault(); event.stopPropagation(); create(); } }} />;
  return <Stack spacing={1} sx={{ minWidth: 0 }}><InputLabel htmlFor={id}>系列</InputLabel>
    <InputActionGroup><Box sx={{ flex: "1 1 0", minWidth: 0 }}>{control}</Box>{actions}</InputActionGroup>
    {terms.error && <Alert severity="error" action={<Button onClick={terms.retry}>重试共享系列</Button>}>{terms.error}</Alert>}
  </Stack>;
}
