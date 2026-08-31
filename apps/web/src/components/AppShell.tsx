import {
  AdminPanelSettingsOutlined,
  AutoStoriesOutlined,
  CategoryOutlined,
  CheckRounded,
  CollectionsBookmarkOutlined,
  FontDownloadOutlined,
  LibraryBooksOutlined,
  LogoutOutlined,
  MenuRounded,
  NotesOutlined,
  PaletteOutlined,
  SearchRounded,
  SettingsOutlined,
  StorageRounded,
  ThreeDRotationOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
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
  { label: "首页", path: "/library", icon: <LibraryBooksOutlined /> },
  { label: "分类", path: "/categories", icon: <CategoryOutlined /> },
  { label: "书单", path: "/booklists", icon: <CollectionsBookmarkOutlined /> },
  { label: "藏书库", path: "/library/all", icon: <LibraryBooksOutlined /> },
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
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";
  const libraryNavigation = user ? navigation : navigation.slice(0, 3);
  const drawerLinks = user ? [...libraryNavigation, displaySettings] : libraryNavigation;
  const searchableLibrary = ["/library", "/library/all", "/recycle-bin"].includes(location.pathname);
  const readerRoute = location.pathname.startsWith("/reader/");
  const query = searchableLibrary ? searchParams.get("q") ?? "" : "";
  const searchExpanded = Boolean(query);
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

  const linkButton = (item: (typeof drawerLinks)[number]) => (
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
          sx={(theme) => ({
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
              maxWidth: tokens.layout.contentMax,
              width: "100%",
              mx: "auto",
              display: { xs: "flex", lg: "grid" },
              gridTemplateColumns: { lg: "max-content max-content" },
              justifyContent: { lg: "space-between" },
              gap: { xs: 1, md: 4, lg: 6 },
              px: { xs: 2, sm: 3, lg: 0 },
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
              <TextField
                size="small"
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder={location.pathname === "/recycle-bin" ? "搜索回收站" : location.pathname === "/library" ? "搜索展示书目" : "搜索整座书库"}
                aria-label={location.pathname === "/recycle-bin" ? "搜索回收站" : location.pathname === "/library" ? "搜索展示书目" : "搜索整座书库"}
                sx={(theme) => ({
                  flexGrow: { xs: searchExpanded ? 1 : 0, md: 0 },
                  flexShrink: 1,
                  flexBasis: `${tokens.layout.touchTarget}px`,
                  width: { xs: `${tokens.layout.touchTarget}px`, md: searchExpanded ? "100%" : `${tokens.layout.touchTarget}px` },
                  minWidth: `${tokens.layout.touchTarget}px`,
                  maxWidth: "100%",
                  overflow: "hidden",
                  transition: theme.transitions.create(["width", "flex-grow"], {
                    duration: theme.transitions.duration.standard,
                    easing: theme.transitions.easing.easeInOut,
                  }),
                  "&:hover, &:focus-within": {
                    flexGrow: { xs: 1, md: 0 },
                    width: { xs: `${tokens.layout.touchTarget}px`, md: "100%" },
                  },
                  "& .MuiOutlinedInput-root": {
                    height: `${tokens.layout.touchTarget}px`,
                    bgcolor: searchExpanded ? "background.paper" : "transparent",
                    borderRadius: `${tokens.radius.lg}px`,
                    overflow: "hidden",
                    transition: theme.transitions.create("background-color", {
                      duration: theme.transitions.duration.standard,
                    }),
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: searchExpanded ? "divider" : "transparent",
                      transition: theme.transitions.create("border-color", {
                        duration: theme.transitions.duration.standard,
                      }),
                    },
                  },
                  "&:hover .MuiOutlinedInput-root, &:focus-within .MuiOutlinedInput-root": {
                    bgcolor: "background.paper",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline, &:focus-within .MuiOutlinedInput-notchedOutline": {
                    borderColor: "divider",
                  },
                  "& .MuiInputBase-input": {
                    minWidth: 0,
                    opacity: searchExpanded ? 1 : 0,
                    transition: theme.transitions.create("opacity", {
                      duration: theme.transitions.duration.shorter,
                    }),
                  },
                  "&:hover .MuiInputBase-input, &:focus-within .MuiInputBase-input": {
                    opacity: 1,
                  },
                  "& .MuiInputAdornment-root": {
                    mr: searchExpanded ? `${tokens.spacing[2]}px` : 0,
                    transition: theme.transitions.create("margin-right", {
                      duration: theme.transitions.duration.shorter,
                    }),
                  },
                  "&:hover .MuiInputAdornment-root, &:focus-within .MuiInputAdornment-root": {
                    mr: `${tokens.spacing[2]}px`,
                  },
                })}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment>,
                  },
                }}
              />
              <Tooltip title={`全站主题：${bookKinThemeOptions[bookKinTheme].label}`}>
                <IconButton color="inherit" onClick={(event) => setThemeAnchor(event.currentTarget)} aria-label="切换全站主题">
                  <PaletteOutlined />
                </IconButton>
              </Tooltip>
              {user ? <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)} aria-label="账户菜单">
                <Avatar sx={{ width: 38, height: 38, bgcolor: "secondary.main", color: "common.white", fontFamily: tokens.typography.fontFamily.display }}>
                  {user.displayName.slice(0, 1)}
                </Avatar>
              </IconButton> : <Button color="inherit" onClick={() => navigate("/login")} sx={{ whiteSpace: "nowrap" }}>登录</Button>}
            </Stack>
          </Toolbar>
        </AppBar>

        <Menu anchorEl={themeAnchor} open={Boolean(themeAnchor)} onClose={() => setThemeAnchor(null)}>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: tokens.typography.fontWeight.semibold }}>全站主题</Typography>
            <Typography variant="caption" color="text.secondary">与阅读界面保持一致</Typography>
          </Box>
          <Divider />
          {(Object.keys(bookKinThemeOptions) as ReaderTheme[]).map((mode) => (
            <MenuItem key={mode} selected={bookKinTheme === mode} onClick={() => { setBookKinTheme(mode); setThemeAnchor(null); }}>
              <ListItemIcon>
                <Box sx={{ width: `${tokens.spacing[5]}px`, height: `${tokens.spacing[5]}px`, borderRadius: `${tokens.radius.pill}px`, bgcolor: bookKinThemeOptions[mode].reader.background, border: 1, borderColor: "divider" }} />
              </ListItemIcon>
              <ListItemText primary={bookKinThemeOptions[mode].label} />
              {bookKinTheme === mode && <CheckRounded fontSize="small" />}
            </MenuItem>
          ))}
        </Menu>

        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor) && Boolean(user)} onClose={() => setMenuAnchor(null)}>
          <Box sx={{ px: 2, py: 1, minWidth: 190 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{user?.displayName}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.role}</Typography>
          </Box>
          <Divider />
          {canManage && management.map((item) => (
            <MenuItem key={item.path} onClick={() => { setMenuAnchor(null); navigate(item.path); }}>
              <ListItemIcon>{item.icon}</ListItemIcon>{item.label}
            </MenuItem>
          ))}
          {user && <MenuItem onClick={() => { setMenuAnchor(null); navigate(displaySettings.path); }}>
            <ListItemIcon>{displaySettings.icon}</ListItemIcon>{displaySettings.label}
          </MenuItem>}
          <MenuItem onClick={async () => { setMenuAnchor(null); await logout(); navigate("/login"); }}>
            <ListItemIcon><LogoutOutlined /></ListItemIcon>退出登录
          </MenuItem>
        </Menu>

        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Box role="navigation" sx={{ width: 288, py: 2 }}>
            <Typography variant="h5" sx={{ px: 2, pb: 2 }}>BookKin</Typography>
            <Divider />
            <List>
              {drawerLinks.map((item) => (
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
