import { lazy, Suspense, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, Skeleton } from "../ui/antd";
import { EmbeddedSettingsContext, PageContainer, PageHeader } from "../components/PageHeader";
const Users = lazy(() => import("./UsersPage").then(m => ({ default: m.UsersPage })));
const Operations = lazy(() => import("./FileOperationsPage").then(m => ({ default: m.FileOperationsPage })));
const Logins = lazy(() => import("./LoginLogsPage").then(m => ({ default: m.LoginLogsPage })));
const Security = lazy(() => import("./SecuritySettingsPage").then(m => ({ default: m.SecuritySettingsPage })));
const sections = [{ key: "users", label: "用户列表", component: Users }, { key: "operations", label: "操作日志", component: Operations }, { key: "logins", label: "登录日志", component: Logins }, { key: "security", label: "安全设置", component: Security }];
export function UserManagementPage() {
 const location = useLocation(); const navigate = useNavigate();
 const active = sections.find(s => `#${s.key}` === location.hash) ?? sections[0];
 useEffect(() => { if (location.hash !== `#${active.key}`) navigate({hash: `#${active.key}`}, {replace:true}); }, [active.key, location.hash, navigate]);
 const Panel = active.component;
 return <PageContainer>
  <PageHeader eyebrow="ACCESS CONTROL" title="用户管理" />
  <Tabs activeKey={active.key} destroyOnHidden onChange={key => navigate({hash:`#${key}`})} items={sections.map(s => ({key:s.key,label:s.label,children:s.key === active.key ? <section id={s.key} aria-label={s.label}><EmbeddedSettingsContext.Provider value><Suspense fallback={<Skeleton active />}><Panel /></Suspense></EmbeddedSettingsContext.Provider></section> : undefined}))} />
 </PageContainer>;
}
