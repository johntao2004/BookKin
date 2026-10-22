import { useMemo, useState } from 'react';
import { TreeSelect } from '../ui/antd';
import { Button } from '../ui/buttons';
import { InputLabel, Stack, Typography } from '../ui/primitives';
import { suggestThema, themaLabel, themaTree, THEMA_VERSION } from '../domain/thema';

const editTree = themaTree();
const filterTree = [{ value: 'UNCLASSIFIED', title: '未指定学科分类', searchText: '未分类 unclassified', selectable: true, children: [] }, ...themaTree(true)];
export function ThemaSubjectField({ value, onChange, disabled, metadataText = '', filter = false }: {
  value: string[]; onChange: (value: string[]) => void; disabled?: boolean; metadataText?: string; filter?: boolean;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = useMemo(() => suggestThema(metadataText), [metadataText]);
  return <Stack spacing={1} sx={{ minWidth: 0 }}>
    <InputLabel htmlFor={filter ? 'catalog-thema' : 'metadata-thema'}>学科分类</InputLabel>
    <TreeSelect id={filter ? 'catalog-thema' : 'metadata-thema'} aria-label="学科分类" style={{ width: '100%' }}
      multiple={!filter} maxCount={filter ? undefined : 4} treeData={filter ? filterTree : editTree} showSearch allowClear
      treeNodeFilterProp="searchText" disabled={disabled} placeholder={filter ? '全部学科分类' : '搜索中文、英文或代码，最多四项'}
      value={filter ? value[0] : value} onChange={(next: string | string[] | undefined) => onChange(next ? Array.isArray(next) ? next : [next] : [])} />
    {!filter && <>
      <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">分类体系：Thema {THEMA_VERSION}；第一项为主要学科</Typography>
        <Button disabled={disabled} onClick={() => setShowSuggestions(true)}>生成分类建议</Button>
      </Stack>
      {showSuggestions && <Stack spacing={1}>
        <Typography variant="caption" color="text.secondary">{suggestions.length ? '依据当前书名、简介和标签生成；采纳后仍需保存。' : '当前资料不足以生成建议，请搜索分类后选择。'}</Typography>
        {suggestions.map(code => <Button key={code} variant="outlined" disabled={disabled || value.includes(code) || value.length >= 4} onClick={() => onChange([...value, code])}>采纳：{themaLabel(code)}</Button>)}
      </Stack>}
    </>}
  </Stack>;
}
