import { usePermissions, PermissionBoundary } from "../auth/permissions";
// 共享导航与账号操作壳，显示权限取自认证状态而非代替服务端权限检查。
// Shared navigation/account shell derives display permissions from auth state without replacing server authorization.
import { useSiteSettingsQuery, SiteMetadata, SiteFooter } from "../site/site-settings";
import { pageWidthSx, topNavigationSurfaceSx } from "./PageHeader";
import { LibraryBooksOutlined } from "@/ui/icons";
import { LockOutlined } from "@/ui/icons";
import { ExpandMoreRounded } from "@/ui/icons";

import { MenuRounded } from "@/ui/icons";
import { NotesOutlined } from "@/ui/icons";
import { PaletteOutlined } from "@/ui/icons";
import { SearchRounded } from "@/ui/icons";

import { AppBar } from "@/ui/primitives";
import { Alert } from "@/ui/feedback";
import { Avatar } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button, IconButton } from "@/ui/buttons";
import { Dropdown } from "@/ui/antd";
import { Drawer } from "@/ui/overlays";
import { InputAdornment } from "@/ui/primitives";
import { List } from "@/ui/primitives";
import { ListItemButton } from "@/ui/primitives";
import { ListItemIcon } from "@/ui/primitives";
import { ListItemText } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { TextField } from "@/ui/forms";
import { Toolbar } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useEffect, useRef, useState, type KeyboardEvent, type PropsWithChildren } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DEFAULT_SITE_SETTINGS } from "../api/client";
import type { ReaderTheme } from "./readers/reader-fonts";
import { tokens } from "../theme/generated-tokens";
import { useBookKinTheme } from "../theme/BookKinThemeProvider";
import { bookKinThemeOptions } from "../theme/theme";
import { useOrdinaryPageScale } from "../theme/useOrdinaryPageScale";

const navigation = [
  { label: "藏书阁", path: "/library", icon: <LibraryBooksOutlined /> },
  { label: "撷文斋", path: "/articles", icon: <NotesOutlined /> },
  { label: "札记轩", path: "/annotations", icon: <NotesOutlined /> },
  { label: "秘藏阁", path: "/vault", icon: <LockOutlined /> },
];

const headerControlSx = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: `${tokens.layout.touchTarget}px`,
  height: `${tokens.layout.touchTarget}px`,
  minWidth: `${tokens.layout.touchTarget}px`,
  minHeight: `${tokens.layout.touchTarget}px`,
  p: 0,
  flexShrink: 0,
  border: 0,
  borderRadius: `${tokens.radius.md}px`,
  bgcolor: "transparent",
  color: "text.primary",
  cursor: "pointer",
  "&:hover": { bgcolor: "action.hover" },
  "&:focus-visible": { outline: "none", boxShadow: "var(--shadow-focus)" },
};

export function AppShell({ children }: PropsWithChildren) {
  const siteQuery = useSiteSettingsQuery();
  const site = siteQuery.data ?? DEFAULT_SITE_SETTINGS;
  const { user, logout } = useAuth();
  const { canVisit } = usePermissions();
  const [logoutError, setLogoutError] = useState("");
  const { mode: bookKinTheme, setMode: setBookKinTheme } = useBookKinTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [libraryMenuOpen, setLibraryMenuOpen] = useState(false);
  const [libraryGroupOpen, setLibraryGroupOpen] = useState(true);
  const [notesMenuOpen, setNotesMenuOpen] = useState(false);
  const [notesGroupOpen, setNotesGroupOpen] = useState(true);
  const [articlesMenuOpen, setArticlesMenuOpen] = useState(false);
  const [articlesGroupOpen, setArticlesGroupOpen] = useState(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuSelectionRef = useRef(false);
  const libraryNavigation = (user ? navigation : navigation.filter(item => item.path === "/library")).filter(item => canVisit(item.path));
  const librarySections = [
    ...(user ? [{ label: "阁中一览", path: "/library/overview" }] : []),
    { label: "书目", path: "/booklists" },
    ...(user ? [{ label: "知识图谱", path: "/knowledge-graph" }] : []),
    ...(user && siteQuery.isSuccess && site.virtualLibraryEnabled ? [{ label: "虚拟书库", path: "/virtual-library" }] : []),
  ].filter(item => canVisit(item.path));
  const notesSections = [
    { label: "读书札记", path: "/annotations/books" },
    { label: "阅文札记", path: "/annotations/articles" },
  ].filter(item => canVisit(item.path));
  const articlesSections = [
    { label: "全部文章", path: "/articles" },
    { label: "合集", path: "/article-collections" },
  ].filter(item => canVisit(item.path));
  const searchLabel = "搜索书籍、笔记、书目";
  const searchableLibrary = canVisit("/search");
  const readerRoute = location.pathname.startsWith("/reader/") || /^\/articles\/[^/]+\/?$/.test(location.pathname);
  useOrdinaryPageScale(!readerRoute && location.pathname !== "/virtual-library");
  const [query, setQuery] = useState(location.pathname === "/search" ? new URLSearchParams(location.search).get("q") ?? "" : "");
  useEffect(() => {
    if (location.pathname === "/search") setQuery(new URLSearchParams(location.search).get("q") ?? "");
  }, [location.pathname, location.search]);
  const [searchExpanded, setSearchExpanded] = useState(Boolean(query));
  const searchTriggerRef = useRef<HTMLElement>(null);
  const isActivePath = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`)
    || (path === "/articles" && location.pathname.startsWith("/article-collections"))
    || (path === "/library" && ["/knowledge-graph", "/virtual-library", "/booklists"].some(section => location.pathname === section || location.pathname.startsWith(`${section}/`)));
  const selectedLibraryPath = librarySections.find(section => location.pathname === section.path || location.pathname.startsWith(`${section.path}/`))?.path;
  const selectedArticlesPath = location.pathname.startsWith("/article-collections") ? "/article-collections" : "/articles";
  const selectedNotesPath = location.pathname.startsWith("/annotations/posts/book/") ? "/annotations/books"
    : location.pathname.startsWith("/annotations/posts/article/") ? "/annotations/articles"
      : notesSections.find(section => isActivePath(section.path))?.path;

  const updateQuery = (value: string) => setQuery(value);

  const linkButton = (item: (typeof navigation)[number]) => {
    const library = item.path === "/library";
    const articleGroup = item.path === "/articles";
    const grouped = library || articleGroup || item.path === "/annotations";
    const menuOpen = library ? libraryMenuOpen : articleGroup ? articlesMenuOpen : notesMenuOpen;
    const setMenuOpen = library ? setLibraryMenuOpen : articleGroup ? setArticlesMenuOpen : setNotesMenuOpen;
    const sections = library ? librarySections : articleGroup ? articlesSections : notesSections;
    const selectedPath = library ? selectedLibraryPath : articleGroup ? selectedArticlesPath : selectedNotesPath;
    const button = <Box
      key={item.path}
      component={grouped ? Link : NavLink}
      to={item.path}
      aria-haspopup={grouped ? "menu" : undefined}
      aria-expanded={grouped ? menuOpen : undefined}
      aria-current={grouped && isActivePath(item.path) ? "page" : undefined}
      onClick={grouped ? () => setMenuOpen(false) : undefined}
      onKeyDown={grouped ? (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setMenuOpen(true); }
        if (event.key === "Escape") setMenuOpen(false);
      } : undefined}
      className={`bk-nav-link${isActivePath(item.path) ? " bk-nav-link-active" : ""}`}
    >
      <span className="bk-nav-label">{item.label}</span>
      {grouped && <ExpandMoreRounded className="bk-nav-chevron" />}
    </Box>;
    return grouped ? <Dropdown key={item.path} open={menuOpen} onOpenChange={setMenuOpen}
      trigger={["hover", "click"]} mouseEnterDelay={0} placement="bottomLeft" autoFocus
      styles={{ root: { minWidth: tokens.layout.menuMinWidth } }}
      menu={{
        selectedKeys: selectedPath ? [selectedPath] : [],
        items: sections.map(section => ({ key: section.path, label: <NavLink to={section.path}>{section.label}</NavLink> })),
        onClick: () => setMenuOpen(false),
      }}>
      {button}
    </Dropdown> : button;
  };

  return (
    <Box sx={{ minHeight: "var(--app-viewport-height, 100vh)", bgcolor: "background.default", color: "text.primary" }}>
      {logoutError && <Alert severity="error" onClose={() => setLogoutError("")}>{logoutError}</Alert>}
      <>
        <AppBar
          className="bk-top-nav"
          position="sticky"
          elevation={0}
          color="transparent"
          sx={topNavigationSurfaceSx}
        >
          <Toolbar
            component="nav"
            aria-label="全站导航"
            className="bk-top-nav-inner"
            sx={{
              minHeight: `${tokens.layout.navHeight}px !important`,
              ...pageWidthSx,
              display: { xs: "flex", md: "grid" },
              gridTemplateColumns: { md: "minmax(0, 1fr) max-content" },
              justifyContent: { md: "space-between" },
              gap: { xs: 0.5, sm: 1, md: 2 },
            }}
          >
            <Stack direction="row" sx={{ alignItems: "center", gap: { xs: 0.5, md: 2 }, minWidth: 0, flexWrap: "wrap" }}>
              <Box
                component="button"
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="打开导航"
                sx={{ ...headerControlSx, display: { xs: "inline-flex", md: "none" } }}
              >
                <MenuRounded />
              </Box>
              <Typography
                component={NavLink}
                to="/library"
                variant="h5"
                sx={{
                  color: "text.primary",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  maxWidth: { xs: `${tokens.spacing[24]*1.5}px`, sm: `${tokens.spacing[24]*2.5}px` },
                  overflow: "hidden", textOverflow: "ellipsis",
                  fontFamily: tokens.typography.fontFamily.display,
                  fontWeight: tokens.typography.fontWeight.regular,
                  fontSize: { xs: `${tokens.typography.fontSize.titleSm}px`, sm: `${tokens.typography.fontSize.title}px` },
                }}
              >
                {site.name}
              </Typography>

              <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", md: "flex" }, minWidth: 0, flexWrap: "wrap" }}>
                {libraryNavigation.map(linkButton)}
              </Stack>
            </Stack>

            <Stack direction="row" sx={{ position: "relative", alignItems: "center", gap: { xs: 0.5, sm: 1, md: 2 }, flexShrink: 0, ml: { xs: "auto", md: 0 }, justifySelf: { md: "end" } }}>
              {searchableLibrary && <Box
                data-testid="global-navigation-search"
                onMouseEnter={() => setSearchExpanded(true)}
                onMouseLeave={() => setSearchExpanded(false)}
                sx={{
                  position: { xs: "static", md: "relative" },
                  width: { xs: `${tokens.layout.touchTarget}px`, md: searchExpanded ? `clamp(${tokens.spacing[24] + tokens.spacing[12]}px, calc(100vw - ${tokens.spacing[24] * 9 + tokens.spacing[8]}px), ${tokens.spacing[24] * 3}px)` : `${tokens.layout.touchTarget}px` },
                  height: `${tokens.layout.touchTarget}px`,
                  flexShrink: 0,
                }}
              >
                <Box
                  ref={searchTriggerRef}
                  component="button"
                  type="button"
                  aria-label="展开搜索"
                  aria-expanded={searchExpanded}
                  aria-controls="global-navigation-search-panel"
                  onClick={() => setSearchExpanded(true)}
                  sx={headerControlSx}
                >
                  <SearchRounded fontSize="small" />
                </Box>
                <Box id="global-navigation-search-panel" data-testid="global-navigation-search-panel" sx={(theme: any) => ({
                  position: "absolute", right: 0, top: { xs: "100%", md: 0 },
                  zIndex: 2,
                  width: { xs: searchExpanded ? `min(${tokens.spacing[24] * 3}px, calc(100vw - ${tokens.spacing[6] * 2}px))` : `${tokens.layout.touchTarget}px`, md: "100%" },
                  visibility: searchExpanded ? "visible" : "hidden",
                  transition: theme.transitions.create("width"),
                  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                })}>
                  {searchExpanded && <TextField
                    autoFocus
                    value={query}
                    onChange={(event: any) => updateQuery(event.target.value)}
                    onBlur={() => setSearchExpanded(false)}
                    onKeyDown={(event: any) => {
                      if (event.key === "Enter" && !event.nativeEvent?.isComposing && query.trim()) {
                        event.preventDefault();
                        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                        setSearchExpanded(false);
                      }
                      if (event.key === "Escape") {
                        setSearchExpanded(false);
                        searchTriggerRef.current?.focus();
                      }
                    }}
                    placeholder={searchLabel ?? undefined}
                    aria-label={searchLabel ?? undefined}
                    sx={{ width: "100%", "& .bk-field-control": { bgcolor: "background.default" } }}
                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }}
                  />}
                </Box>
              </Box>}
              <Dropdown
                open={themeMenuOpen}
                onOpenChange={(open) => {
                  if (open && themeMenuSelectionRef.current) return;
                  setThemeMenuOpen(open);
                }}
                trigger={["hover", "click"]}
                placement="bottomRight"
                menu={{
                  selectable: true,
                  selectedKeys: [bookKinTheme],
                  items: (Object.keys(bookKinThemeOptions) as ReaderTheme[]).map((mode) => ({
                    key: mode,
                    label: bookKinThemeOptions[mode].label,
                    icon: <Box sx={{ width: tokens.spacing[5], height: tokens.spacing[5], borderRadius: `${tokens.radius.pill}px`, bgcolor: bookKinThemeOptions[mode].reader.background, border: 1, borderColor: "divider" }} />,
                  })),
                  onClick: ({ key }) => {
                    themeMenuSelectionRef.current = true;
                    setBookKinTheme(key as ReaderTheme);
                    setThemeMenuOpen(false);
                    globalThis.setTimeout(() => { themeMenuSelectionRef.current = false; }, 400);
                  },
                }}
              >
                <Box
                  component="button"
                  type="button"
                  aria-label="切换全站主题"
                  aria-haspopup="menu"
                  aria-expanded={themeMenuOpen}
                  sx={headerControlSx}
                >
                  <PaletteOutlined />
                </Box>
              </Dropdown>
              {user ? <Dropdown open={accountMenuOpen} onOpenChange={setAccountMenuOpen} trigger={["click"]} placement="bottomRight"
                menu={{
                  items: [
                    { key: "account", label: user.displayName, disabled: true },
                    { type: "divider" },
                    { key: "/profile", label: "个人信息" },
                    ...(canVisit("/settings") ? [{ key: "/settings", label: "管理设置" }] : []),
                    { type: "divider" },
                    { key: "logout", label: "退出登录" },
                  ],
                  onClick: async ({ key }) => {
                    setAccountMenuOpen(false);
                    if (key === "logout") {
                      setLogoutError("");
                      try { await logout(); navigate("/login"); }
                      catch (reason) { setLogoutError(reason instanceof Error ? reason.message : "退出失败，请重试。"); }
                    }
                    else navigate(key);
                  },
                }}
              ><Box
                component="button"
                type="button"
                className="bk-account-trigger"
                aria-label="账户菜单"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                sx={headerControlSx}
              >
                <Avatar className="bk-account-avatar" sx={{ width: 40, height: 40, flexShrink: 0, bgcolor: "secondary.main", color: "common.white", fontFamily: tokens.typography.fontFamily.display }}>
                  {user.displayName.slice(0, 1)}
                </Avatar>
              </Box></Dropdown> : <Button color="inherit" onClick={() => navigate("/login")} sx={{ whiteSpace: "nowrap", px: 1, minWidth: tokens.layout.touchTarget, flexShrink: 0 }}>登录</Button>}
            </Stack>
          </Toolbar>
        </AppBar>

        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          size={`min(${tokens.spacing[24] * 3}px, calc(100vw - ${tokens.spacing[6]}px))`}
          title={<Typography variant="h5" sx={{ fontFamily: tokens.typography.fontFamily.display, fontWeight: tokens.typography.fontWeight.regular }}>{site.name}</Typography>}
        >
          <Box
            role="navigation"
            aria-label="移动端导航"
            sx={{
              width: "100%",
              minWidth: 0,
              px: `${tokens.spacing[3]}px`,
              py: `${tokens.spacing[4]}px`,
              overflowX: "hidden",
            }}
          >
            <List sx={{ width: "100%" }}>
              {libraryNavigation.map((item) => {
                const group = item.path === "/library" ? "library" : item.path === "/articles" ? "articles" : item.path === "/annotations" ? "notes" : undefined;
                const groupOpen = group === "library" ? libraryGroupOpen : group === "articles" ? articlesGroupOpen : notesGroupOpen;
                const setGroupOpen = group === "library" ? setLibraryGroupOpen : group === "articles" ? setArticlesGroupOpen : setNotesGroupOpen;
                const sections = group === "library" ? librarySections : group === "articles" ? articlesSections : notesSections;
                const selectedPath = group === "library" ? selectedLibraryPath : group === "articles" ? selectedArticlesPath : selectedNotesPath;
                return group ? <Box key={item.path}>
                <Stack direction="row" sx={{ alignItems: "center" }}>
                <ListItemButton selected={isActivePath(item.path)}
                  onClick={() => { setDrawerOpen(false); navigate(item.path); }}
                  sx={{ flex: 1, minWidth: 0, minHeight: `${tokens.layout.touchTarget}px`, px: { xs: `${tokens.spacing[1]}px`, sm: `${tokens.spacing[3]}px` } }}>
                  <ListItemIcon sx={{ minWidth: `${tokens.layout.touchTarget}px` }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
                <IconButton aria-label={`${item.label}二级菜单`} aria-expanded={groupOpen} aria-controls={`${group}-navigation-children`}
                  sx={{ minWidth: tokens.layout.touchTarget, minHeight: tokens.layout.touchTarget }}
                  onClick={() => setGroupOpen(open => !open)}>
                  <ExpandMoreRounded className="bk-nav-chevron" sx={{ transform: groupOpen ? "rotate(180deg)" : undefined }} />
                </IconButton>
                </Stack>
                {groupOpen && <List id={`${group}-navigation-children`} role="group" aria-label={`${item.label}二级菜单`} sx={{ pl: `${tokens.layout.touchTarget}px` }}>
                  {sections.map(section => <ListItemButton key={section.path}
                    selected={selectedPath === section.path} aria-current={selectedPath === section.path ? "page" : undefined}
                    onClick={() => { setDrawerOpen(false); navigate(section.path); }}
                    sx={{ minWidth: 0, minHeight: `${tokens.layout.touchTarget}px`, px: `${tokens.spacing[3]}px` }}>
                    <ListItemText primary={section.label} />
                  </ListItemButton>)}
                </List>}
              </Box> : (
                <ListItemButton
                  key={item.path}
                  selected={isActivePath(item.path)}
                  onClick={() => { setDrawerOpen(false); navigate(item.path); }}
                  sx={{ minWidth: 0, minHeight: `${tokens.layout.touchTarget}px`, px: { xs: `${tokens.spacing[1]}px`, sm: `${tokens.spacing[3]}px` } }}
                >
                  <ListItemIcon sx={{ minWidth: `${tokens.layout.touchTarget}px` }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              );})}
            </List>
          </Box>
        </Drawer>
      </>

      <SiteMetadata />
      <Box component="main"><PermissionBoundary>{children}</PermissionBoundary></Box>
      <SiteFooter />
    </Box>
  );
}
