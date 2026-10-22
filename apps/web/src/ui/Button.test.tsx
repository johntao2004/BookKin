// 验证图标间距、链接导航和纯图标可访问目标，统一适配层不能吞掉动作语义。
// Checks icon spacing, link navigation and accessible icon-only targets without losing action semantics.
import { fireEvent, render, screen } from '@testing-library/react';
import { Link } from 'react-router-dom';
import { TestProviders } from '../test/TestProviders';
import { Button, IconButton } from './index';
import { AddRounded, ArrowForwardRounded, SearchRounded } from './icons';
import { _AntButton, TableAction } from './antd';

describe('shared icon buttons', () => {
  it('preserves warning, danger and disabled actions through both button APIs', () => {
    const onClick = vi.fn();
    render(<TestProviders>
      <Button danger variant="contained">删除资料</Button>
      <Button color="warning">紧急恢复</Button>
      <_AntButton intent="warning">使用备用码</_AntButton>
      <TableAction danger disabled onClick={onClick}>永久清理</TableAction>
    </TestProviders>);
    expect(screen.getByRole('button', {name: '删除资料'})).toHaveClass('ant-btn-primary', 'ant-btn-dangerous');
    expect(screen.getByRole('button', {name: '紧急恢复'})).toHaveAttribute('data-intent', 'warning');
    expect(screen.getByRole('button', {name: '使用备用码'})).toHaveAttribute('data-intent', 'warning');
    const purge = screen.getByRole('button', {name: '永久清理'});
    expect(purge).toHaveClass('ant-btn-dangerous');
    expect(purge).toBeDisabled();
    fireEvent.click(purge);
    expect(onClick).not.toHaveBeenCalled();
  });
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
