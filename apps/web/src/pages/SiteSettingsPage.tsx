// 主人编辑站点个性化配置，保存结果通过公共设置查询刷新消费方。
// Owner site-personalization edits refresh consumers through the shared settings query after saving.
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SiteSettings } from '../api/client';
import { SectionHeader } from '../components/PageHeader';
import { SaveButton } from '../ui/buttons';
import { Alert } from '../ui/feedback';
import { TextField, Switch } from '../ui/forms';
import { Stack, Typography } from '../ui/primitives';
import { Skeleton } from '../ui/antd';

export function SiteSettingsPage() {
  const client=useQueryClient();
  const query=useQuery({queryKey:['site-settings'],queryFn:({signal})=>api.siteSettings(signal)});
  const [draft,setDraft]=useState<SiteSettings|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  if(query.isPending)return <Skeleton active />;
  if(query.isError||!query.data)return <Alert severity="error">无法读取个性化设置，请稍后重试。</Alert>;
  const form=draft??query.data;
  const update=(key:keyof SiteSettings,value:string|boolean)=>{setDraft({...form,[key]:value});setSaved(false);};
  const field=(key:keyof SiteSettings,label:string,max:number,helper?:string)=> <TextField label={label} value={String(form[key])} disabled={busy} onChange={e=>update(key,e.target.value)} helperText={helper} slotProps={{htmlInput:{maxLength:max}}} />;
  return <Stack component="form" spacing={2} onSubmit={async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setSaved(false);
    try {const result=await api.saveSiteSettings(form);client.setQueryData(['site-settings'],result);setDraft(result);setSaved(true);}
    catch(reason){setError(reason instanceof Error?reason.message:'保存失败，请重试。');}finally{setBusy(false);}
  }}>
    <Stack className="bk-form-section" spacing={2}>
      <SectionHeader title="基本信息" action={<SaveButton type="submit" disabled={busy}>{busy?'保存中…':'保存'}</SaveButton>} />
      <TextField label="网站名称" required value={form.name} disabled={busy} onChange={e=>update('name',e.target.value)} slotProps={{htmlInput:{maxLength:80}}} />
      {field('tagline','网站副标题',120)}
      <TextField label="网站简介" multiline minRows={3} value={form.description} disabled={busy} onChange={e=>update('description',e.target.value)} slotProps={{htmlInput:{maxLength:500}}} />
    </Stack>
    <Stack className="bk-form-section" spacing={2}>
      <Typography component="h3" variant="h5">可选功能</Typography>
      <Stack direction="row" sx={{alignItems:'center',justifyContent:'space-between',gap:2}}><Typography>启用虚拟 3D 书库</Typography><Switch checked={form.virtualLibraryEnabled} disabled={busy} slotProps={{input:{'aria-label':'启用虚拟 3D 书库'}}} onChange={(_,checked)=>update('virtualLibraryEnabled',checked)} /></Stack>
    </Stack>
    <Stack className="bk-form-section" spacing={2}>
      <Typography component="h3" variant="h5">域名与搜索引擎</Typography>
      {field('publicUrl','站点地址（域名）',255,'完整网址，留空使用当前地址。')}
      {field('keywords','网站关键词',250,'用逗号分隔')}
      <Stack direction="row" sx={{alignItems:'center',justifyContent:'space-between',gap:2}}><Typography>允许搜索引擎收录</Typography><Switch checked={form.allowIndexing} disabled={busy} slotProps={{input:{'aria-label':'允许搜索引擎收录'}}} onChange={(_,checked)=>update('allowIndexing',checked)} /></Stack>
    </Stack>
    <Stack className="bk-form-section" spacing={2}>
      <Typography component="h3" variant="h5">备案与页脚</Typography>
      {field('icpNumber','ICP备案号',80)}
      {field('policeNumber','公安备案号',80)}
      {field('copyright','版权说明',200)}
      <TextField type="email" label="公开联系邮箱" value={form.contactEmail} disabled={busy} onChange={e=>update('contactEmail',e.target.value)} slotProps={{htmlInput:{maxLength:254}}} />
    </Stack>
    {error&&<Alert severity="error">{error}</Alert>}{saved&&<Alert severity="success">已保存</Alert>}
  </Stack>;
}
