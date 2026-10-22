// 验证服务端分页和当前页刷新，不用本地数组分页伪装完整日志。
// Checks server pagination and current-page refresh rather than local slicing pretending to cover all logs.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { TestProviders } from '../test/TestProviders';
import { LoginLogsPage } from './LoginLogsPage';

afterEach(() => vi.restoreAllMocks());

it('requests server pages and refreshes the selected login-log page', async () => {
  vi.spyOn(api, 'listUsers').mockResolvedValue([]);
  const request = vi.spyOn(api, 'listLoginLogs').mockImplementation(async page => ({
    items: [{id: `entry-${page}`, actorId: null, subjectId: `account-${page}`, outcome: 'SUCCEEDED', ip: '127.0.0.1', occurredAt: '2026-10-20T00:00:00Z'}],
    total: 25,
  }));
  render(<TestProviders><LoginLogsPage /></TestProviders>);
  expect(await screen.findByText('account-0')).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith(0, 10);
  expect(screen.getAllByText(/共 25 条/)).toHaveLength(1);
  fireEvent.click(screen.getAllByTitle('2')[0]);
  expect(await screen.findByText('account-1')).toBeInTheDocument();
  expect(request).toHaveBeenLastCalledWith(1, 10);
  const calls = request.mock.calls.length;
  fireEvent.click(screen.getByRole('button', {name: '刷新'}));
  await waitFor(() => expect(request.mock.calls.length).toBeGreaterThan(calls));
  expect(request).toHaveBeenLastCalledWith(1, 10);
});
