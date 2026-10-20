import { useSiteSettings, SiteMetadata, SiteFooter } from "../site/site-settings";
import { pageWidthSx, topNavigationSurfaceSx } from "./PageHeader";
import { CategoryOutlined } from "@/ui/icons";
import { CollectionsBookmarkOutlined } from "@/ui/icons";
import { HomeOutlined } from "@/ui/icons";
import { LibraryBooksOutlined } from "@/ui/icons";
import { LogoutOutlined } from "@/ui/icons";
import { MenuRounded } from "@/ui/icons";
import { NotesOutlined } from "@/ui/icons";
import { PaletteOutlined } from "@/ui/icons";
import { SearchRounded } from "@/ui/icons";
import { SettingsOutlined } from "@/ui/icons";
import { ThreeDRotationOutlined } from "@/ui/icons";
import { AppBar } from "@/ui/primitives";
import { Alert } from "@/ui/feedback";
import { Avatar } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
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
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  refreshVirtualLibraryBooks,
  VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
  VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
} from "../pages/virtual-library-query";
import type { ReaderTheme } from "./readers/reader-fonts";
import { tokens } from "../theme/generated-tokens";
import { useBookKinTheme } from "../theme/BookKinThemeProvider";
import { bookKinThemeOptions } from "../theme/theme";
import { useOrdinaryPageScale } from "../theme/useOrdinaryPageScale";

const navigation = [
  { label: "首页", path: "/library", icon: <HomeOutlined /> },
  { label: "文章收藏", path: "/articles", icon: <NotesOutlined /> },
  { label: "禁书区", path: "/vault", icon: <LibraryBooksOutlined /> },
  { label: "藏书库", path: "/library/all", icon: <LibraryBooksOutlined /> },
  { label: "分类", path: "/categories", icon: <CategoryOutlined /> },
  { label: "书单", path: "/booklists", icon: <CollectionsBookmarkOutlined /> },
  { label: "知识图谱", path: "/knowledge-graph", icon: <CategoryOutlined /> },
  { label: "阅读笔记", path: "/annotations", icon: <NotesOutlined /> },
  { label: "虚拟书库", path: "/virtual-library", icon: <ThreeDRotationOutlined /> },
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
  const site = useSiteSettings();
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const queryClient = useQueryClient();
  const { mode: bookKinTheme, setMode: setBookKinTheme } = useBookKinTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuSelectionRef = useRef(false);
  const libraryNavigation = user
    ? navigation
    : navigation.filter((item) => ["/library", "/articles", "/categories", "/booklists"].includes(item.path));
  const searchLabel = "搜索书籍、笔记、书单";
  const searchableLibrary = true;
  const readerRoute = location.pathname.startsWith("/reader/");
  useOrdinaryPageScale(!readerRoute && location.pathname !== "/virtual-library");
  const [query, setQuery] = useState(location.pathname === "/search" ? new URLSearchParams(location.search).get("q") ?? "" : "");
  useEffect(() => {
    if (location.pathname === "/search") setQuery(new URLSearchParams(location.search).get("q") ?? "");
  }, [location.pathname, location.search]);
  const [searchExpanded, setSearchExpanded] = useState(Boolean(query));
  const searchTriggerRef = useRef<HTMLElement>(null);
  const isActivePath = (path: string) => path === "/categories" || path === "/booklists"
    ? location.pathname === path || location.pathname.startsWith(`${path}/`)
    : location.pathname === path;

  const prepareVirtualLibrary = useCallback(() => {
    if (!user) return;
    void import("../pages/VirtualLibraryExperience").catch(() => undefined);
    void queryClient.prefetchQuery({
      queryKey: VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
      queryFn: ({ signal }) => refreshVirtualLibraryBooks(queryClient, signal),
      staleTime: VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
    });
  }, [queryClient, user]);

  useEffect(() => {
    if (!user || readerRoute || location.pathname === "/virtual-library") return undefined;
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prepareVirtualLibrary, { timeout: 1_800 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = globalThis.setTimeout(prepareVirtualLibrary, 650);
    return () => globalThis.clearTimeout(timeoutId);
  }, [location.pathname, prepareVirtualLibrary, readerRoute, user]);

  const updateQuery = (value: string) => setQuery(value);

  const linkButton = (item: (typeof navigation)[number]) => (
    <Button
      variant="text"
      key={item.path}
      component={NavLink}
      to={item.path}
      onMouseEnter={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
      onFocus={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
      onTouchStart={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
      color="inherit"
      className="bk-nav-link"
      sx={{
        minWidth: 0,
        px: 1.25,
        minHeight: `${tokens.layout.touchTarget}px`,
        borderRadius: `${tokens.radius.md}px`,
        position: "relative",
        color: isActivePath(item.path) ? "text.primary" : "text.secondary",
        "&::after": isActivePath(item.path) ? {
          content: '""',
          position: "absolute",
          left: tokens.spacing.sm,
          right: tokens.spacing.sm,
          bottom: 0,
          height: 2,
          bgcolor: "primary.main",
        } : undefined,
      }}
    >
      {item.label}
    </Button>
  );

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
                    size="small"
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
                    sx={{ width: "100%", "& .bk-field-control": { height: `${tokens.layout.touchTarget}px`, bgcolor: "background.default" } }}
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
                    { key: "/profile", label: "个人信息", icon: <SettingsOutlined /> },
                    ...(["OWNER", "ADMIN"].includes(user.role) ? [{ key: "/settings", label: "设置", icon: <SettingsOutlined /> }] : []),
                    { type: "divider" },
                    { key: "logout", label: "退出登录", icon: <LogoutOutlined /> },
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
              {libraryNavigation.map((item) => (
                <ListItemButton
                  key={item.path}
                  selected={isActivePath(item.path)}
                  onMouseEnter={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
                  onFocus={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
                  onTouchStart={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
                  onClick={() => { setDrawerOpen(false); navigate(item.path); }}
                  sx={{ minWidth: 0, minHeight: `${tokens.layout.touchTarget}px`, px: { xs: `${tokens.spacing[1]}px`, sm: `${tokens.spacing[3]}px` } }}
                >
                  <ListItemIcon sx={{ minWidth: `${tokens.layout.touchTarget}px` }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        </Drawer>
      </>

      <SiteMetadata />
      <Box component="main">{children}</Box>
      <SiteFooter />
    </Box>
  );
}
