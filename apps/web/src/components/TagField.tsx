import AntSelect from "antd/es/select";
import { useMemo, useState } from "react";
import type { MetadataTerm } from "../domain/types";
import { useMetadataTerms } from "./useMetadataTerms";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";

const tagKey = (tag: string) => tag.normalize("NFKC").trim().toLocaleLowerCase();

export function parseTags(value: string): string[] {
  const unique = new Map<string, string>();
  for (const piece of value.split(/[，,;；\r\n]+/)) {
    const tag = piece.normalize("NFKC").trim();
    const key = tagKey(tag);
    if (tag && !unique.has(key)) unique.set(key, tag);
  }
  return [...unique.values()];
}

function optionFor(term: MetadataTerm) {
  return { value: term.value, label: term.label, searchText: [term.value, term.label].join(" ") };
}

/** Shared, server-backed tags with legacy string serialization. */
export function TagField({ id, value, onChange, disabled }: {
  id?: string;
  value: string;
  onChange: (serialized: string) => void;
  disabled?: boolean;
}) {
  const tags = useMemo(() => parseTags(value), [value]);
  const separator = value.match(/[，,;；]/)?.[0] ?? "，";
  const [searchText, setSearchText] = useState("");
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const terms = useMetadataTerms("TAG", { enabled: !disabled });
  const sharedOptions = useMemo(() => {
    const seen = new Set<string>();
    return terms.options.map(optionFor).filter(option => {
      const key = tagKey(option.value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [terms.options]);
  const selected = [...new Map([...tags, ...pendingTags].map(tag => [tagKey(tag), tag])).values()];
  const options = [...sharedOptions, ...selected.filter(tag => !sharedOptions.some(option => tagKey(option.value) === tagKey(tag)))
    .map(tag => ({ value: tag, label: tag, searchText: tag }))];

  const update = (nextValues: string[]) => {
    setSearchText(""); terms.search("");
    const next = [...new Map(nextValues.map(item => {
      const normalized = item.normalize("NFKC").trim();
      return [tagKey(normalized), normalized] as const;
    }).filter(([key, item]) => key && item)).values()];
    const existingKeys = new Set([...tags, ...sharedOptions.map(option => option.value)].map(tagKey));
    const additions = next.filter(tag => !existingKeys.has(tagKey(tag)));
    if (additions.length === 0) {
      setPendingTags([]);
      setSearchText(""); terms.search("");
      onChange(next.join(separator));
      return;
    }

    setPendingTags(next);
    terms.commit(additions.map(tag => ({ value: tag, label: tag })), saved => {
      const savedByKey = new Map(saved.flatMap(term => [[tagKey(term.value), term.value], [tagKey(term.label), term.value]] as const));
      onChange(next.map(tag => savedByKey.get(tagKey(tag)) ?? tag).join(separator));
      setPendingTags([]);
      setSearchText(""); terms.search("");
    });
  };

  return <>
    <AntSelect
      id={id}
      aria-label="标签"
      className="bk-select"
      style={{ width: "100%" }}
      mode="tags"
      showSearch
      allowClear
      disabled={disabled || terms.isSaving}
      value={selected}
      options={options}
      placeholder="输入或搜索标签"
      filterOption={false}
      tokenSeparators={["，", ",", "；", ";", "\n", "\r"]}
      notFoundContent={terms.isLoading ? "正在搜索共享标签…" : undefined}
      onSearch={search => { setSearchText(search); terms.search(search); }}
      onChange={(next: string[]) => update(Array.isArray(next) ? next : [])}
      searchValue={searchText}
    />
    {terms.error && <Alert severity="error" action={<Button onClick={terms.retry}>重试共享标签</Button>}>{terms.error}</Alert>}
  </>;
}
