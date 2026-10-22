import { lazy } from 'react';
import { PageBackAction, PageContainer, PageHeader } from '../components/PageHeader';
import { useSiteSettingsQuery } from '../site/site-settings';
import { Skeleton } from '../ui/antd';
import { Button } from '../ui/buttons';
import { Alert } from '../ui/feedback';
import { Stack } from '../ui/primitives';

const Experience = lazy(() => import('./VirtualLibraryExperience').then(module => ({default: module.VirtualLibraryExperience})));

export function VirtualLibraryRoute() {
  const query = useSiteSettingsQuery(true);
  // 每次进入都确认开关；Revalidate on entry, including when cached or offline.
  const verified = query.isSuccess && query.isFetchedAfterMount;

  if (query.isError) return <PageContainer><PageBackAction to="/library/all">返回藏书库</PageBackAction><Stack spacing={2}>
    <Alert severity="error">无法确认虚拟书库是否已启用，请稍后重试。</Alert>
    <Button onClick={() => void query.refetch()}>重试</Button>
  </Stack></PageContainer>;
  if (!verified || !query.data) return <PageContainer><PageBackAction to="/library/all">返回藏书库</PageBackAction><div role="status" aria-label="正在读取虚拟书库设置"><Skeleton active /></div></PageContainer>;
  if (!query.data.virtualLibraryEnabled) return <PageContainer>
    <PageBackAction to="/library/all">返回藏书库</PageBackAction>
    <PageHeader eyebrow="VIRTUAL LIBRARY" title="虚拟书库未启用" />
  </PageContainer>;
  return <Experience />;
}
