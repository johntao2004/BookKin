import { fireEvent, render, screen } from '@testing-library/react';
import { ThemaSubjectField } from './ThemaSubjectField';
import { TestProviders } from '../test/TestProviders';

it('requires explicit adoption for suggestions and preserves existing chosen subjects', () => {
  const onChange = vi.fn();
  render(<TestProviders><ThemaSubjectField value={['PS']} metadataText="古籍装帧与纸张保护" onChange={onChange} /></TestProviders>);
  expect(screen.getByRole('combobox', { name: '学科分类' })).toBeInTheDocument();
  expect(screen.queryByText('Thema 主题分类')).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '生成分类建议' }));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /采纳：书籍设计与装帧/ }));
  expect(onChange).toHaveBeenCalledWith(['PS', 'AKH']);
});
it('does not silently classify a book with insufficient metadata', () => {
  render(<TestProviders><ThemaSubjectField value={[]} onChange={vi.fn()} /></TestProviders>);
  fireEvent.click(screen.getByRole('button', { name: '生成分类建议' }));
  expect(screen.getByText('当前资料不足以生成建议，请搜索分类后选择。')).toBeInTheDocument();
});
