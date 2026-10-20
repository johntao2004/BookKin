import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api, DEFAULT_SITE_SETTINGS } from '../api/client';
import { TestProviders } from '../test/TestProviders';
import { AppShell } from '../components/AppShell';
import { SiteSettingsPage } from './SiteSettingsPage';

afterEach(()=>vi.restoreAllMocks());
it('saves personalization and immediately updates site brand, metadata and footer',async()=>{
  vi.spyOn(api,'siteSettings').mockResolvedValue({...DEFAULT_SITE_SETTINGS});
  const save=vi.spyOn(api,'saveSiteSettings').mockImplementation(async input=>({...input}));
  render(<TestProviders initialPath="/settings#personalization"><AppShell><SiteSettingsPage /></AppShell></TestProviders>);
  fireEvent.change(await screen.findByRole('textbox',{name:'网站名称'}),{target:{value:'山间书屋'}});
  fireEvent.change(screen.getByRole('textbox',{name:'版权说明'}),{target:{value:'山间书屋 版权所有'}});
  fireEvent.click(screen.getByRole('button',{name:'保存个性化设置'}));
  await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({name:'山间书屋',copyright:'山间书屋 版权所有',allowIndexing:false})));
  expect(await screen.findByRole('link',{name:'山间书屋'})).toBeInTheDocument();
  expect(await screen.findByText('山间书屋 版权所有')).toBeInTheDocument();
  await waitFor(()=>expect(document.title).toBe('山间书屋 · 电子图书馆'));
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow');
});
