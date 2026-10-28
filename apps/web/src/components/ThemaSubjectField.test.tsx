import { fireEvent, render, screen } from '@testing-library/react';
import { ThemaSubjectField } from './ThemaSubjectField';
import { TestProviders } from '../test/TestProviders';

vi.mock('./BookContentSuggestionButton', () => ({
  BookContentSuggestionButton: (props: {
    source?: { type: 'BOOK' | 'UPLOAD'; id: string };
    mode: 'subjects' | 'tags';
    value: string[];
    onApply: (next: string[]) => void;
    disabled?: boolean;
    actionLabel?: string;
  }) => <button type="button" aria-label={props.actionLabel} disabled={props.disabled}
    data-mode={props.mode} data-source-type={props.source?.type} data-source-id={props.source?.id}
    data-value={props.value.join(',')} onClick={() => props.onApply([...props.value, 'AKH'])}>AI</button>,
}));

it('keeps the subject tree and forwards real book content context to the suggestion action', () => {
  const onChange = vi.fn();
  render(<TestProviders><ThemaSubjectField value={['PS']} onChange={onChange}
    contentSource={{ type: 'BOOK', id: 'book-1' }} /></TestProviders>);

  expect(screen.getByRole('combobox', { name: '学科分类' })).toBeInTheDocument();
  const action = screen.getByRole('button', { name: '生成分类建议' });
  expect(action).toHaveAttribute('data-mode', 'subjects');
  expect(action).toHaveAttribute('data-source-type', 'BOOK');
  expect(action).toHaveAttribute('data-source-id', 'book-1');
  expect(action).toHaveAttribute('data-value', 'PS');
  fireEvent.click(action);
  expect(onChange).toHaveBeenCalledWith(['PS', 'AKH']);
});

it('keeps the catalog filter as a single-value tree without AI actions', () => {
  render(<TestProviders><ThemaSubjectField filter value={['GL']} onChange={vi.fn()}
    contentSource={{ type: 'BOOK', id: 'book-1' }} /></TestProviders>);

  expect(screen.getByRole('combobox', { name: '学科分类' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '生成分类建议' })).not.toBeInTheDocument();
});

it('disables content suggestions without a content source', () => {
  render(<TestProviders><ThemaSubjectField value={[]} onChange={vi.fn()} /></TestProviders>);

  expect(screen.getByRole('button', { name: '生成分类建议' })).toBeDisabled();
});
