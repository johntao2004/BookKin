import { lazy, Suspense, useContext } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Tabs, Skeleton } from "../ui/antd";
import { EmbeddedSettingsContext, PageContainer } from "../components/PageHeader";
const Users = lazy(() => import("./UsersPage").then(m => ({ default: m.UsersPage })));
const Operations = lazy(() => import("./FileOperationsPage").then(m => ({ default: m.FileOperationsPage })));
const Logins = lazy(() => import("./LoginLogsPage").then(m => ({ default: m.LoginLogsPage })));
const Security = lazy(() => import("./SecuritySettingsPage").then(m => ({ default: m.SecuritySettingsPage })));
const Sessions = lazy(() => import("./ActiveSessionsPage").then(m => ({ default: m.ActiveSessionsPage })));
const sections = [{ key: "users", label: "用户列表", component: Users }, { key: "sessions", label: "在线会话", component: Sessions }, { key: "operations", label: "操作日志", component: Operations }, { key: "logins", label: "登录日志", component: Logins }, { key: "security", label: "安全设置", component: Security }];
export function UserManagementPage() {
 const location = useLocation(); const navigate = useNavigate();
 const embedded = useContext(EmbeddedSettingsContext);
 const sectionKey = location.hash.replace(/^#(?:users\/)?/, "");
 const active = sections.find(s => s.key === sectionKey) ?? sections[0];

 const Panel = active.component;
 if (!embedded) return <Navigate to={`/settings#users${active.key === "users" ? "" : `/${active.key}`}`} replace />;
 return <PageContainer>
  <Tabs className="bk-user-management-tabs" activeKey={active.key} destroyOnHidden onChange={key => navigate({hash: key === "users" ? "#users" : `#users/${key}`})} items={sections.map(s => ({key:s.key,label:s.label,children:s.key === active.key ? <section id={`user-management-${s.key}`} aria-label={s.label}><EmbeddedSettingsContext.Provider value><Suspense fallback={<Skeleton active />}><Panel /></Suspense></EmbeddedSettingsContext.Provider></section> : undefined}))} />
 </PageContainer>;
}
