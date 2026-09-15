import { lazy, Suspense, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RequireAuth, useAuth } from "../auth/AuthContext";
import { Tabs, Skeleton } from "../ui/antd";
import { EmbeddedSettingsContext, PageContainer, PageHeader } from "../components/PageHeader";

const LibraryRoots = lazy(() => import("./LibraryRootsPage").then(m => ({ default: m.LibraryRootsPage })));
const Fonts = lazy(() => import("./ReaderFontsPage").then(m => ({ default: m.ReaderFontsPage })));
const AiSettings = lazy(() => import("./AiSettingsPage").then(m => ({ default: m.AiSettingsPage })));
const MailSettings = lazy(() => import("./MailSettingsPage").then(m => ({default:m.MailSettingsPage})));
const sections = [
  { key: "library-roots", label: "书库状态", component: LibraryRoots, managed: true },
  { key: "reader-fonts", label: "阅读字体", component: Fonts, managed: true },
  { key: "mail", label: "邮件服务", component: MailSettings, managed: true, ownerOnly: true },
  { key: "ai", label: "AI 书目匹配", component: AiSettings, managed: true },
];
export function SettingsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";
  const available = sections.filter(s => s.ownerOnly ? user?.role === "OWNER" : canManage || !s.managed);
  const requested = sections.find(s => `#${s.key}` === location.hash);
  const active = requested ?? available[0] ?? sections[0];
  useEffect(() => {
    if (location.hash === "#recovery-email" || !canManage) { navigate("/profile", { replace: true }); return; }
    if (location.hash === "#display-books") { navigate("/display-books", { replace: true }); return; }
    if (location.hash === "#file-operations") { navigate("/admin/users#operations", { replace: true }); return; }
    if (location.hash === "#users") { navigate("/admin/users", { replace: true }); return; }
    if (!requested) navigate({ pathname: "/settings", hash: `#${active.key}` }, { replace: true });
  }, [requested, active.key, navigate, location.hash, canManage]);
  const Panel = active.component;
  const content = <section id={active.key} aria-label={active.label}>
    <EmbeddedSettingsContext.Provider value>
      <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
        {active.managed ? <RequireAuth roles={active.ownerOnly ? ["OWNER"] : ["OWNER", "ADMIN"]}><Panel /></RequireAuth> : <Panel />}
      </Suspense>
    </EmbeddedSettingsContext.Provider>
  </section>;
  return <PageContainer>
    <PageHeader title="设置" description="管理书库与阅读偏好。" />
    <Tabs activeKey={active.key} destroyOnHidden onChange={key => navigate({ pathname: "/settings", hash: `#${key}` })} items={available.map(s => ({ key: s.key, label: s.label, children: s.key === active.key ? content : undefined }))} />
    {active.managed && (!canManage || (active.ownerOnly && user?.role !== "OWNER")) && content}
  </PageContainer>;
}
