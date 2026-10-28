import AntSelect from "antd/es/select";
import { useId, useMemo, useState, type ReactNode } from "react";
import type { MetadataTerm } from "../domain/types";
import { languageOption, languageOptions, parseLanguages, serializeLanguages } from "../domain/languages";
import { useMetadataTerms } from "./useMetadataTerms";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { InputActionGroup } from "../ui/forms";
import { Box, InputLabel, Stack } from "../ui/primitives";

const availableOptionValues = new Set(languageOptions.map(option => option.value));
const valueKey = (value: string) => parseLanguages(value)[0]?.normalize("NFKC").trim().toLocaleLowerCase()
  ?? value.normalize("NFKC").trim().toLocaleLowerCase();

function termOption(term: MetadataTerm) {
  const value = parseLanguages(term.value)[0] ?? term.value.normalize("NFKC").trim();
  return { value, label: term.label, searchText: [term.value, term.label].join(" ") };
}

export function LanguageField({ value, onChange, disabled, actions }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  actions?: ReactNode;
}) {
  const id = useId();
  const [lengthError, setLengthError] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [pendingValues, setPendingValues] = useState<string[]>([]);
  const terms = useMetadataTerms("LANGUAGE", { enabled: !disabled });
  const selectedValues = useMemo(() => parseLanguages(value), [value]);
  const sharedOptions = useMemo(() => {
    const seen = new Set(availableOptionValues);
    return terms.options.map(termOption).filter(option => {
      const key = valueKey(option.value);
      if (!option.value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [terms.options]);
  const selectedOptions = selectedValues.filter(selected =>
    !availableOptionValues.has(selected) && !sharedOptions.some(option => valueKey(option.value) === valueKey(selected)))
    .map(selected => languageOption(selected));
  const query = searchText.normalize("NFKC").trim().toLocaleLowerCase();
  const builtInOptions = query
    ? languageOptions.filter(option => option.searchText.normalize("NFKC").toLocaleLowerCase().includes(query))
    : languageOptions;
  const options = [...builtInOptions, ...sharedOptions, ...selectedOptions].map(option => ({
    ...option,
    // Tags mode must recognize aliases as existing options instead of offering
    // a second, untranslated tag such as English or zho.
    searchAlias: query && valueKey(option.value) === valueKey(searchText) ? searchText : undefined,
  }));
  const savedTermValue = (input: string, saved: MetadataTerm[]) => {
    const key = valueKey(input);
    return saved.find(term => valueKey(term.value) === key || valueKey(term.label) === key)?.value ?? input;
  };

  const update = (nextValues: string[]) => {
    let serialized: string;
    try {
      serialized = serializeLanguages(nextValues);
    } catch (error) {
      if (error instanceof RangeError) setLengthError(true);
      else throw error;
      return;
    }
    setLengthError(false);
    const knownValues = new Set([
      ...availableOptionValues,
      ...sharedOptions.map(option => valueKey(option.value)),
      ...selectedValues.map(valueKey),
    ]);
    const additions = [...new Map(nextValues.map(item => [valueKey(item), item])).values()]
      .filter(item => !knownValues.has(valueKey(item)));
    if (additions.length === 0) {
      setPendingValues([]);
      setSearchText(""); terms.search("");
      onChange(serialized);
      return;
    }

    setPendingValues(additions);
    terms.commit(additions.map(item => ({ value: item, label: item })), saved => {
      try {
        const values = nextValues.map(item => savedTermValue(item, saved));
        onChange(serializeLanguages(values));
        setPendingValues([]); setSearchText(""); terms.search("");
        setLengthError(false);
      } catch (error) {
        if (error instanceof RangeError) setLengthError(true);
        else throw error;
      }
    });
  };

  const control = <AntSelect
    id={id}
    aria-label="语言"
    className="bk-select"
    style={{ width: "100%" }}
    mode="tags"
    showSearch={{ filterOption: false, optionFilterProp: ["value", "label", "searchAlias"] }}
    allowClear
    disabled={disabled || terms.isSaving}
    value={[...new Set([...selectedValues, ...pendingValues])].map(value => {
      const option = sharedOptions.find(item => valueKey(item.value) === valueKey(value));
      return option?.value ?? value;
    })}
    options={options}
    placeholder="搜索语言，或输入新增语言"
    tokenSeparators={[",", "，", ";", "；", "\n", "\r"]}
    notFoundContent={terms.isLoading ? "正在搜索共享语言…" : undefined}
    onSearch={search => { setSearchText(search); terms.search(search); }}
    onChange={(nextValues: string[]) => update(Array.isArray(nextValues) ? nextValues : [])}
    aria-invalid={lengthError || undefined}
    aria-describedby={lengthError ? `${id}-length-error` : undefined}
  />;

  return <Stack spacing={1} sx={{ minWidth: 0 }}>
    <InputLabel htmlFor={id}>语言</InputLabel>
    {actions ? <InputActionGroup><Box sx={{ flex: "1 1 0", minWidth: 0 }}>{control}</Box>{actions}</InputActionGroup> : control}
    {lengthError && <span id={`${id}-length-error`} role="status" className="bk-field-helper">选择的语言过多，请移除部分项后重试。</span>}
    {terms.error && <Alert severity="error" action={<Button onClick={terms.retry}>重试共享语言</Button>}>{terms.error}</Alert>}
  </Stack>;
}
