import { fireEvent, render, screen } from '@testing-library/react';
import { Link } from 'react-router-dom';
import { TestProviders } from '../test/TestProviders';
import { Button, IconButton } from './index';
import { AddRounded, ArrowForwardRounded, SearchRounded } from './icons';

describe('shared icon buttons', () => {
  it('keeps both icons outside the label so the button gap can separate them', () => {
    render(<TestProviders><Button startIcon={<AddRounded />} endIcon={<ArrowForwardRounded />}>新建书单</Button></TestProviders>);
    const button = screen.getByRole('button', {name: '新建书单'});
    const label = screen.getByText('新建书单');
    expect(label.querySelector('svg')).toBeNull();
    expect(label.parentElement).toBe(button);
    expect(button.querySelector(':scope > .ant-btn-icon svg')).toBeInTheDocument();
    expect(button.querySelector(':scope > .bk-button-icon svg')).toBeInTheDocument();
    expect(button.querySelectorAll('svg')).toHaveLength(2);
  });

  it('preserves link navigation and an accessible icon-only click target', () => {
    const onClick = vi.fn();
    render(<TestProviders>
      <Button component={Link} to="/library" startIcon={<SearchRounded />}>返回藏书</Button>
      <IconButton aria-label="搜索藏书" onClick={onClick}><SearchRounded /></IconButton>
      <Button>保存</Button>
      <Button disabled startIcon={<AddRounded />} onClick={onClick}>不可新建</Button>
    </TestProviders>);
    expect(screen.getByRole('button', {name: '保存'})).toHaveTextContent('保存');
    const link = screen.getByRole('link', {name: '返回藏书'});
    expect(link).toHaveAttribute('href', '/library');
    expect(link.querySelector(':scope > .bk-button-icon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '不可新建'}));
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '搜索藏书'}));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
