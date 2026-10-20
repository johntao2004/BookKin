// 通过 URL hash 选择允许的设置面板，仅挂载当前面板并兼容旧入口。
// Selects permitted settings panels through the URL hash, mounting only the active panel and preserving legacy entry points.
import { lazy, Suspense, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RequireAuth, useAuth } from "../auth/AuthContext";
import { Tabs, Skeleton } from "../ui/antd";
import { Box, Typography, useMediaQuery } from "../ui/primitives";
import { EmbeddedSettingsContext, PageContainer, PageHeader } from "../components/PageHeader";
import { tokens } from "../theme/generated-tokens";

const LibraryRoots = lazy(() => import("./LibraryRootsPage").then(m => ({ default: m.LibraryRootsPage })));
const Fonts = lazy(() => import("./ReaderFontsPage").then(m => ({ default: m.ReaderFontsPage })));
const AiSettings = lazy(() => import("./AiSettingsPage").then(m => ({ default: m.AiSettingsPage })));
const MailSettings = lazy(() => import("./MailSettingsPage").then(m => ({default:m.MailSettingsPage})));
const UserManagement = lazy(() => import("./UserManagementPage").then(m => ({ default: m.UserManagementPage })));
const Personalization = lazy(() => import("./SiteSettingsPage").then(m => ({default:m.SiteSettingsPage})));
const sections = [
  { key: "users", label: "用户管理", component: UserManagement, managed: true },
  { key: "personalization", label: "个性化设置", component: Personalization, managed: true, ownerOnly: true },
  { key: "library-roots", label: "书库状态", component: LibraryRoots, managed: true },
  { key: "reader-fonts", label: "阅读字体", component: Fonts, managed: true },
  { key: "mail", label: "邮件服务", component: MailSettings, managed: true, ownerOnly: true },
  { key: "ai", label: "AI 书目匹配", component: AiSettings, managed: true },
];
const mobileSettingsQuery = `(max-width: ${tokens.layout.breakpointMobile - 0.05}px)`;
const settingsNavigationWidth = `${tokens.spacing[24] * 2}px`;
const settingsSectionGap = `${tokens.spacing[6]}px`;

export function SettingsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(mobileSettingsQuery);
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";
  const available = sections.filter(s => s.ownerOnly ? user?.role === "OWNER" : canManage || !s.managed);
  const requested = available.find(s => `#${s.key}` === location.hash || (s.key === "users" && location.hash.startsWith("#users/")));
  const active = requested ?? available[0] ?? sections[0];
  useEffect(() => {
    if (location.hash === "#recovery-email" || !canManage) { navigate("/profile", { replace: true }); return; }
    if (location.hash === "#display-books") { navigate("/library/all", { replace: true }); return; }
    if (location.hash === "#file-operations") { navigate("/settings#users/operations", { replace: true }); return; }
    if (!requested) navigate({ pathname: "/settings", hash: `#${active.key}` }, { replace: true });
  }, [requested, active.key, navigate, location.hash, canManage]);
  const Panel = active.component;
  const content = <Box
    component="section"
    className="bk-settings-panel"
    id={active.key}
    aria-label={active.label}
    sx={{
      minWidth: 0,
      py: `${tokens.spacing[4]}px`,
    }}
  >
    <Typography variant="h5" component="h2" sx={{ mb: `${tokens.spacing[6]}px` }}>{active.label}</Typography>
    <EmbeddedSettingsContext.Provider value>
      <Box sx={{ width: "100%", minWidth: 0, maxWidth: "none" }}>
        <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
          {active.managed ? <RequireAuth roles={active.ownerOnly ? ["OWNER"] : ["OWNER", "ADMIN"]}><Panel /></RequireAuth> : <Panel />}
        </Suspense>
      </Box>
    </EmbeddedSettingsContext.Provider>
  </Box>;
  return <PageContainer>
    <PageHeader eyebrow="SETTINGS" title="设置" />
    <Box role="region" aria-label="设置分区" sx={{ minWidth: 0 }}>
      <Tabs
        className={`bk-settings-navigation ${isMobile ? "bk-settings-navigation--mobile" : "bk-settings-navigation--desktop"}`}
        activeKey={active.key}
        destroyOnHidden
        tabPlacement={isMobile ? "top" : "start"}
        tabBarStyle={isMobile
          ? { width: "100%", maxWidth: "100%", marginBottom: 0 }
          : { width: settingsNavigationWidth, flexShrink: 0, marginBottom: 0 }}
        style={{ minWidth: 0, ...(isMobile ? { rowGap: settingsSectionGap } : {}) }}
        onChange={key => navigate({ pathname: "/settings", hash: `#${key}` })}
        items={available.map(s => ({ key: s.key, label: s.label, children: s.key === active.key ? content : undefined }))}
      />
    </Box>
  </PageContainer>;
}
