import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SiteSettings } from '../api/client';
import { ActionToolbar } from '../components/PageHeader';
import { SaveButton } from '../ui/buttons';
import { Alert } from '../ui/feedback';
import { TextField, Switch } from '../ui/forms';
import { Stack, Typography } from '../ui/primitives';
import { Skeleton } from '../ui/antd';

export function SiteSettingsPage() {
  const client=useQueryClient();
  const query=useQuery({queryKey:['site-settings'],queryFn:api.siteSettings});
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
      <Typography component="h3" variant="h5">基本信息</Typography>
      <TextField label="网站名称" required value={form.name} disabled={busy} onChange={e=>update('name',e.target.value)} slotProps={{htmlInput:{maxLength:80}}} />
      {field('tagline','网站副标题',120,'用于浏览器标签页标题。')}
      <TextField label="网站简介" multiline minRows={3} value={form.description} disabled={busy} onChange={e=>update('description',e.target.value)} slotProps={{htmlInput:{maxLength:500}}} />
    </Stack>
    <Stack className="bk-form-section" spacing={2}>
      <Typography component="h3" variant="h5">域名与搜索引擎</Typography>
      {field('publicUrl','站点地址（域名）',255,'例如 https://books.example.com；留空使用当前访问地址。此处不会修改 DNS、证书或部署地址。')}
      {field('keywords','网站关键词',250,'多个关键词用逗号分隔。')}
      <Stack direction="row" sx={{alignItems:'center',justifyContent:'space-between',gap:2}}><Typography>允许搜索引擎收录</Typography><Switch checked={form.allowIndexing} disabled={busy} slotProps={{input:{'aria-label':'允许搜索引擎收录'}}} onChange={(_,checked)=>update('allowIndexing',checked)} /></Stack>
      <Typography color="text.secondary">通过 robots.txt 和页面指令声明收录策略。开启仅允许收录公开页面，不保证搜索引擎收录；私人内容仍需登录，关闭收录不替代访问权限。</Typography>
    </Stack>
    <Stack className="bk-form-section" spacing={2}>
      <Typography component="h3" variant="h5">备案与页脚</Typography>
      {field('icpNumber','ICP备案号',80,'按实际备案信息填写，留空不显示。')}
      {field('policeNumber','公安备案号',80)}
      {field('copyright','版权说明',200)}
      <TextField type="email" label="公开联系邮箱" value={form.contactEmail} disabled={busy} onChange={e=>update('contactEmail',e.target.value)} helperText="填写后会公开显示在页脚。" slotProps={{htmlInput:{maxLength:254}}} />
    </Stack>
    <ActionToolbar><SaveButton type="submit" disabled={busy}>{busy?'保存中…':'保存个性化设置'}</SaveButton></ActionToolbar>
    {error&&<Alert severity="error">{error}</Alert>}{saved&&<Alert severity="success">个性化设置已保存，全站信息已更新。</Alert>}
  </Stack>;
}
