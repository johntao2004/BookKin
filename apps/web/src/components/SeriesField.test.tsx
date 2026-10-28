import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { api } from '../api/client';
import type { MetadataTerm } from '../domain/types';
import { TestProviders } from '../test/TestProviders';
import { SeriesField } from './SeriesField';

function Editor() {
  const [value, onChange] = useState('');
  return <TestProviders><SeriesField value={value} onChange={onChange} /><output>{value}</output></TestProviders>;
}
afterEach(() => vi.restoreAllMocks());
it('creates a series on Enter and searches its canonical option after remount', async () => {
  const store: MetadataTerm[] = [];
  const search = vi.spyOn(api, 'listMetadataTerms').mockImplementation(async (_kind, q = '') => ({ items: store.filter(term => term.label.includes(q)) }));
  vi.spyOn(api, 'ensureMetadataTerms').mockImplementation(async (kind, items) => {
    const saved = items.map(item => ({ ...item, kind, id: item.value })); store.push(...saved); return { items: saved };
  });
  const first = render(<Editor />);
  fireEvent.change(screen.getByRole('combobox', { name: '系列' }), { target: { value: '现代文库' } });
  fireEvent.keyDown(screen.getByRole('combobox', { name: '系列' }), { key: 'Enter', keyCode: 13 });
  await waitFor(() => expect(document.querySelector('output')).toHaveTextContent('现代文库'));
  first.unmount();
  render(<Editor />);
  const input = screen.getByRole('combobox', { name: '系列' });
  fireEvent.mouseDown(input);
  fireEvent.change(input, { target: { value: '现代' } });
  await waitFor(() => expect(search).toHaveBeenCalledWith('SERIES', '现代', expect.any(AbortSignal)));
  expect([...document.querySelectorAll('.ant-select-item-option-content')].map(node => node.textContent)).toContain('现代文库');
});
