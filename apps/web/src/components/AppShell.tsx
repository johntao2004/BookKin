import { pageWidthSx } from "./PageHeader";
import { AdminPanelSettingsOutlined } from "@/ui/icons";
import { AutoStoriesOutlined } from "@/ui/icons";
import { CategoryOutlined } from "@/ui/icons";
import { CollectionsBookmarkOutlined } from "@/ui/icons";
import { FontDownloadOutlined } from "@/ui/icons";
import { HomeOutlined } from "@/ui/icons";
import { LibraryBooksOutlined } from "@/ui/icons";
import { LogoutOutlined } from "@/ui/icons";
import { MenuRounded } from "@/ui/icons";
import { NotesOutlined } from "@/ui/icons";
import { PaletteOutlined } from "@/ui/icons";
import { SearchRounded } from "@/ui/icons";
import { SettingsOutlined } from "@/ui/icons";
import { StorageRounded } from "@/ui/icons";
import { ThreeDRotationOutlined } from "@/ui/icons";
import { AppBar } from "@/ui";
import { Avatar } from "@/ui";
import { Box } from "@/ui";
import { Button } from "@/ui";
import { Dropdown } from "@/ui";
import { Drawer } from "@/ui";
import { IconButton } from "@/ui";
import { InputAdornment } from "@/ui";
import { List } from "@/ui";
import { ListItemButton } from "@/ui";
import { ListItemIcon } from "@/ui";
import { ListItemText } from "@/ui";
import { Stack } from "@/ui";
import { TextField } from "@/ui";
import { Toolbar } from "@/ui";
import { Typography } from "@/ui";
import { alpha } from "@/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  fetchVirtualLibraryBooks,
  VIRTUAL_LIBRARY_BOOKS_QUERY_KEY,
  VIRTUAL_LIBRARY_BOOKS_STALE_TIME,
} from "../pages/virtual-library-query";
import type { ReaderTheme } from "./readers/reader-fonts";
import { tokens } from "../theme/generated-tokens";
import { useBookKinTheme } from "../theme/BookKinThemeProvider";
import { bookKinThemeOptions } from "../theme/theme";

const navigation = [
  { label: "首页", path: "/library", icon: <HomeOutlined /> },
  { label: "藏书库", path: "/library/all", icon: <LibraryBooksOutlined /> },
  { label: "分类", path: "/categories", icon: <CategoryOutlined /> },
  { label: "书单", path: "/booklists", icon: <CollectionsBookmarkOutlined /> },
  { label: "阅读笔记", path: "/annotations", icon: <NotesOutlined /> },
  { label: "虚拟书库", path: "/virtual-library", icon: <ThreeDRotationOutlined /> },
];

const displaySettings = { label: "展示书目设置", path: "/settings/display-books", icon: <AutoStoriesOutlined /> };

const management = [
  { label: "书库状态", path: "/admin/library-roots", icon: <StorageRounded /> },
  { label: "用户管理", path: "/admin/users", icon: <AdminPanelSettingsOutlined /> },
  { label: "文件任务", path: "/admin/file-operations", icon: <SettingsOutlined /> },
  { label: "阅读字体", path: "/admin/reader-fonts", icon: <FontDownloadOutlined /> },
];

export function AppShell({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { mode: bookKinTheme, setMode: setBookKinTheme } = useBookKinTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";
  const libraryNavigation = user
    ? navigation
    : navigation.filter((item) => ["/library", "/categories", "/booklists"].includes(item.path));
  const searchableLibrary = ["/library", "/library/all", "/recycle-bin"].includes(location.pathname);
  const readerRoute = location.pathname.startsWith("/reader/");
  const query = searchableLibrary ? searchParams.get("q") ?? "" : "";
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
      queryFn: ({ signal }) => fetchVirtualLibraryBooks(signal),
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

  const updateQuery = (value: string) => {
    if (!searchableLibrary) navigate(`/library?q=${encodeURIComponent(value)}`);
    else {
      const next = new URLSearchParams(searchParams);
      if (value) next.set("q", value);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    }
  };

  const linkButton = (item: (typeof navigation)[number]) => (
    <Button
      key={item.path}
      component={NavLink}
      to={item.path}
      onMouseEnter={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
      onFocus={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
      onTouchStart={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
      color="inherit"
      sx={{
        minWidth: 0,
        px: 1.25,
        borderRadius: 0,
        position: "relative",
        color: isActivePath(item.path) ? "text.primary" : "text.secondary",
        "&::after": isActivePath(item.path) ? {
          content: '""',
          position: "absolute",
          left: 12,
          right: 12,
          bottom: -14,
          height: 2,
          bgcolor: "primary.main",
        } : undefined,
      }}
    >
      {item.label}
    </Button>
  );

  return (
    <Box sx={{ minHeight: "100vh" }}>
      {!readerRoute && <>
        <AppBar
          position="sticky"
          elevation={0}
          color="transparent"
          sx={(theme: any) => ({
            bgcolor: alpha(theme.palette.background.default, 0.94),
            color: "text.primary",
            backdropFilter: "blur(16px)",
            borderBottom: 1,
            borderColor: "divider",
          })}
        >
          <Toolbar
            sx={{
              minHeight: `${tokens.layout.navHeight}px !important`,
              ...pageWidthSx,
              display: { xs: "flex", lg: "grid" },
              gridTemplateColumns: { lg: "max-content max-content" },
              justifyContent: { lg: "space-between" },
              gap: { xs: 0.5, sm: 1, md: 4, lg: 6 },
            }}
          >
            <IconButton onClick={() => setDrawerOpen(true)} sx={{ display: { lg: "none" } }} aria-label="打开导航">
              <MenuRounded />
            </IconButton>
            <Stack direction="row" sx={{ alignItems: "center", gap: 3, flexShrink: 0 }}>
              <Typography
                component={NavLink}
                to="/library"
                variant="h5"
                sx={{ color: "text.primary", textDecoration: "none", whiteSpace: "nowrap" }}
              >
                BookKin
              </Typography>

              <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", lg: "flex" } }}>
                {libraryNavigation.map(linkButton)}
              </Stack>
            </Stack>

            <Stack direction="row" sx={{ alignItems: "center", gap: { xs: 0.5, sm: 2 }, flexShrink: 0, ml: { xs: "auto", lg: 0 }, justifySelf: { lg: "end" } }}>
              <Box onMouseEnter={() => setSearchExpanded(true)} onMouseLeave={() => setSearchExpanded(false)} sx={{ position: "relative", width: tokens.layout.touchTarget, height: tokens.layout.touchTarget, flexShrink: 0 }}>
                <IconButton ref={searchTriggerRef} aria-label="展开搜索" aria-expanded={searchExpanded} onClick={() => setSearchExpanded(true)}>
                  <SearchRounded fontSize="small" />
                </IconButton>
                <Box sx={(theme: any) => ({
                  position: "absolute", right: 0, top: 0,
                  width: searchExpanded ? `min(${tokens.layout.touchTarget * 7}px, calc(100vw - ${tokens.spacing[20] * 2}px))` : `${tokens.layout.touchTarget}px`,
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
                      if (event.key === "Escape") {
                        setSearchExpanded(false);
                        searchTriggerRef.current?.focus();
                      }
                    }}
                    placeholder={location.pathname === "/recycle-bin" ? "搜索回收站" : location.pathname === "/library" ? "搜索展示书目" : "搜索整座书库"}
                    aria-label={location.pathname === "/recycle-bin" ? "搜索回收站" : location.pathname === "/library" ? "搜索展示书目" : "搜索整座书库"}
                    sx={{ width: "100%", "& .bk-field-control": { height: tokens.layout.touchTarget, bgcolor: "background.paper" } }}
                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }}
                  />}
                </Box>
              </Box>
              <Dropdown
                open={themeMenuOpen}
                onOpenChange={setThemeMenuOpen}
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
                  onClick: ({ key }) => { setBookKinTheme(key as ReaderTheme); setThemeMenuOpen(false); },
                }}
              >
                <IconButton color="inherit" aria-label="切换全站主题" aria-haspopup="menu" aria-expanded={themeMenuOpen}>
                  <PaletteOutlined />
                </IconButton>
              </Dropdown>
              {user ? <Dropdown open={accountMenuOpen} onOpenChange={setAccountMenuOpen} trigger={["click"]} placement="bottomRight"
                menu={{
                  items: [
                    { key: "account", label: user.displayName, disabled: true },
                    { type: "divider" },
                    ...(canManage ? management.map((item) => ({ key: item.path, label: item.label, icon: item.icon })) : []),
                    { key: displaySettings.path, label: displaySettings.label, icon: displaySettings.icon },
                    { type: "divider" },
                    { key: "logout", label: "退出登录", icon: <LogoutOutlined /> },
                  ],
                  onClick: async ({ key }) => {
                    setAccountMenuOpen(false);
                    if (key === "logout") { await logout(); navigate("/login"); }
                    else navigate(key);
                  },
                }}
              ><IconButton aria-label="账户菜单" aria-haspopup="menu" aria-expanded={accountMenuOpen}>
                <Avatar sx={{ width: 38, height: 38, bgcolor: "secondary.main", color: "common.white", fontFamily: tokens.typography.fontFamily.display }}>
                  {user.displayName.slice(0, 1)}
                </Avatar>
              </IconButton></Dropdown> : <Button color="inherit" onClick={() => navigate("/login")} sx={{ whiteSpace: "nowrap", px: 1, minWidth: tokens.layout.touchTarget, flexShrink: 0 }}>登录</Button>}
            </Stack>
          </Toolbar>
        </AppBar>

        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} width={tokens.spacing[24] * 3} title={<Typography variant="h5">BookKin</Typography>}>
          <Box role="navigation" sx={{ width: "100%", p: 2 }}>
            <List>
              {libraryNavigation.map((item) => (
                <ListItemButton
                  key={item.path}
                  selected={isActivePath(item.path)}
                  onMouseEnter={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
                  onFocus={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
                  onTouchStart={item.path === "/virtual-library" ? prepareVirtualLibrary : undefined}
                  onClick={() => { setDrawerOpen(false); navigate(item.path); }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        </Drawer>
      </>}

      <Box component="main">{children}</Box>
    </Box>
  );
}
