import { TreeSelect } from '../ui/antd';
import { InputActionGroup } from '../ui/forms';
import { Box, InputLabel, Stack } from '../ui/primitives';
import { themaTree } from '../domain/thema';
import { BookContentSuggestionButton, type ContentMetadataSource } from './BookContentSuggestionButton';

const editTree = themaTree();
const filterTree = [{ value: 'UNCLASSIFIED', title: '未指定学科分类', searchText: '未分类 unclassified', selectable: true, children: [] }, ...themaTree(true)];

export function ThemaSubjectField({ value, onChange, disabled, filter = false, contentSource }: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  filter?: boolean;
  contentSource?: ContentMetadataSource;
}) {
  return <Stack spacing={1} sx={{ minWidth: 0 }}>
    <InputLabel htmlFor={filter ? 'catalog-thema' : 'metadata-thema'}>学科分类</InputLabel>
    {filter ? (
      <TreeSelect id="catalog-thema" aria-label="学科分类" style={{ width: '100%' }}
        multiple={false} treeData={filterTree} showSearch allowClear
        treeNodeFilterProp="searchText" disabled={disabled} placeholder="全部学科分类"
        value={value[0]} onChange={(next: string | string[] | undefined) => onChange(next ? Array.isArray(next) ? next : [next] : [])} />
    ) : <InputActionGroup>
      <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
        <TreeSelect id="metadata-thema" aria-label="学科分类" style={{ width: '100%' }}
          multiple maxCount={4} treeData={editTree} showSearch allowClear
          treeNodeFilterProp="searchText" disabled={disabled} placeholder="搜索中文、英文或代码，最多四项"
          value={value} onChange={(next: string | string[] | undefined) => onChange(next ? Array.isArray(next) ? next : [next] : [])} />
      </Box>
      <BookContentSuggestionButton source={contentSource} mode="subjects" value={value} onApply={onChange}
        disabled={disabled || !contentSource} actionLabel="生成分类建议" />
    </InputActionGroup>}
  </Stack>;
}
