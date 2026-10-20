import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { api, DEFAULT_SITE_SETTINGS } from '../api/client';
import { Box, Typography } from '../ui/primitives';
import { tokens } from '../theme/generated-tokens';

export function useSiteSettings() {
  const query=useQuery({queryKey:['site-settings'],queryFn:api.siteSettings,staleTime:60_000});
  return query.data??DEFAULT_SITE_SETTINGS;
}
export function SiteMetadata() {
  const site=useSiteSettings();const {pathname}=useLocation();
  useEffect(()=>{
    document.title=site.name+(site.tagline?` · ${site.tagline}`:'');
    const publicPage=pathname==='/'||pathname==='/library'||/^\/(categories|booklists|articles)(\/|$)/.test(pathname);
    for(const [name,content] of Object.entries({description:site.description,keywords:site.keywords,robots:site.allowIndexing&&publicPage?'index, follow':'noindex, nofollow'})) {
      let meta=document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if(!meta){meta=document.createElement('meta');meta.name=name;document.head.append(meta);}meta.content=content;
    }
    let canonical=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if(site.publicUrl&&publicPage){if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=site.publicUrl+pathname;}
    else canonical?.remove();
  },[site,pathname]);
  return null;
}
export function SiteFooter() {
  const site=useSiteSettings();const {pathname}=useLocation();
  if(pathname.startsWith('/reader/')||pathname==='/virtual-library'||!(site.icpNumber||site.policeNumber||site.copyright||site.contactEmail))return null;
  return <Box component="footer" sx={{borderTop:1,borderColor:'divider',px:`${tokens.spacing[6]}px`,py:`${tokens.spacing[4]}px`,display:'flex',gap:2,flexWrap:'wrap',justifyContent:'center',color:'text.secondary'}}>
    {site.copyright&&<Typography variant="body2">{site.copyright}</Typography>}
    {site.icpNumber&&<Typography component="a" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" variant="body2" color="inherit">{site.icpNumber}</Typography>}
    {site.policeNumber&&<Typography variant="body2">{site.policeNumber}</Typography>}
    {site.contactEmail&&<Typography component="a" href={`mailto:${site.contactEmail}`} variant="body2" color="inherit">{site.contactEmail}</Typography>}
  </Box>;
}
