import { usePermissions, settingsPermissions } from "../auth/permissions";
import { AccessDeniedPage } from "./AccessDeniedPage";
import { lazy, Suspense, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RequireAuth } from "../auth/AuthContext";
import { Tabs, Skeleton } from "../ui/antd";
import { Box, useMediaQuery } from "../ui/primitives";
import { EmbeddedSettingsContext, PageContainer, PageHeader } from "../components/PageHeader";
import { tokens } from "../theme/generated-tokens";
import { normalizeSettingsHash, settingsGroups } from "./settings-navigation";

const LibraryRoots = lazy(() => import("./LibraryRootsPage").then(m => ({ default: m.LibraryRootsPage })));
const Operations = lazy(() => import("./FileOperationsPage").then(m => ({ default: m.FileOperationsPage })));
const RecycleBin = lazy(() => import("./RecycleBinPage").then(m => ({ default: m.RecycleBinPage })));
const Users = lazy(() => import("./UsersPage").then(m => ({ default: m.UsersPage })));
const Sessions = lazy(() => import("./ActiveSessionsPage").then(m => ({ default: m.ActiveSessionsPage })));
const Logins = lazy(() => import("./LoginLogsPage").then(m => ({ default: m.LoginLogsPage })));
const Security = lazy(() => import("./SecuritySettingsPage").then(m => ({ default: m.SecuritySettingsPage })));
const Fonts = lazy(() => import("./ReaderFontsPage").then(m => ({ default: m.ReaderFontsPage })));
const AiSettings = lazy(() => import("./AiSettingsPage").then(m => ({ default: m.AiSettingsPage })));
const MailSettings = lazy(() => import("./MailSettingsPage").then(m => ({ default: m.MailSettingsPage })));
const Personalization = lazy(() => import("./SiteSettingsPage").then(m => ({ default: m.SiteSettingsPage })));

const Roles = lazy(() => import("./RolePermissionsPage").then(m => ({ default: m.RolePermissionsPage })));

const panels = { roots: LibraryRoots, operations: Operations, recycle: RecycleBin, users: Users, roles: Roles,
  security: Security, sessions: Sessions, logins: Logins, site: Personalization, fonts: Fonts, ai: AiSettings, mail: MailSettings };
const groups = settingsGroups.map(group => ({ ...group, sections: group.sections.map(section => ({ ...section, component: panels[section.panel] })) }));

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(`(max-width: ${tokens.layout.breakpointMobile - 0.05}px)`);
  const { can } = usePermissions();
  const available = groups.map(group => ({ ...group, sections: group.sections.filter(section => can(settingsPermissions[section.hash])) })).filter(group => group.sections.length > 0);
  const canManage = available.length > 0;
  const requestedHash = normalizeSettingsHash(location.hash);
  const requestedAllowed = !settingsPermissions[requestedHash] || can(settingsPermissions[requestedHash]);
  const activeGroup = available.find(group => group.sections.some(section => section.hash === requestedHash))
    ?? available.find(group => requestedHash === `#${group.key}` || requestedHash.startsWith(`#${group.key}/`))
    ?? available[0];
  const active = activeGroup?.sections.find(section => section.hash === requestedHash) ?? activeGroup?.sections[0];

  useEffect(() => {
    if (location.hash === "#recovery-email") { navigate("/profile", { replace: true }); return; }
    if (location.hash === "#display-books") { navigate({ pathname: "/library", search: location.search }, { replace: true }); return; }
    if (active && location.hash !== active.hash && requestedAllowed) navigate({ pathname: "/settings", search: location.search, hash: active.hash }, { replace: true });
  }, [active?.hash, location.hash, location.search, navigate, requestedAllowed]);

  // Never mount administrative data while redirecting a member or a legacy account link.
  if (location.hash === "#recovery-email" || location.hash === "#display-books") return null;
  if ((settingsPermissions[requestedHash] && !can(settingsPermissions[requestedHash])) || !canManage || !active || !activeGroup) return <AccessDeniedPage reason="INSUFFICIENT_ROLE" returnTo={`/settings${location.hash}`} />;
  const Panel = active.component;
  const panel = <Box component="section" aria-label={active.label} sx={{ minWidth: 0, py: `${tokens.spacing[4]}px` }}>
      <EmbeddedSettingsContext.Provider value>
        <RequireAuth roles={active.ownerOnly ? ["OWNER"] : ["OWNER", "ADMIN"]}>
          <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}><Panel /></Suspense>
        </RequireAuth>
      </EmbeddedSettingsContext.Provider>
    </Box>;
  const content = <Box component="section" aria-label={activeGroup.label} sx={{ minWidth: 0 }}>
    <Tabs className="bk-user-management-tabs" activeKey={active.hash} destroyOnHidden
      onChange={hash => navigate({ pathname: "/settings", search: location.search, hash })}
      items={activeGroup.sections.map(section => ({ key: section.hash, label: section.label, children: section.hash === active.hash ? panel : undefined }))} />
  </Box>;

  return <PageContainer>
    <PageHeader eyebrow="SETTINGS" title="管理设置" />
    <Box role="region" aria-label="设置分区" sx={{ minWidth: 0 }}>
      <Tabs className={`bk-settings-navigation ${isMobile ? "bk-settings-navigation--mobile" : "bk-settings-navigation--desktop"}`}
        activeKey={activeGroup.key} destroyOnHidden tabPlacement={isMobile ? "top" : "start"}
        tabBarStyle={isMobile ? { width: "100%", maxWidth: "100%", marginBottom: 0 } : { width: `${tokens.spacing[24] * 2}px`, flexShrink: 0, marginBottom: 0 }}
        style={{ minWidth: 0, ...(isMobile ? { rowGap: `${tokens.spacing[6]}px` } : {}) }}
        onChange={key => {
          const group = available.find(item => item.key === key);
          if (group) navigate({ pathname: "/settings", search: location.search, hash: group.sections[0].hash });
        }}
        items={available.map(group => ({ key: group.key, label: group.label, children: group.key === activeGroup.key ? content : undefined }))} />
    </Box>
  </PageContainer>;
}
