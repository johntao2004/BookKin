import { useSiteSettings, SiteMetadata, SiteFooter } from "../site/site-settings";
import { Button } from "@/ui/buttons";
import { ArrowBackRounded } from "@/ui/icons";
import { Link } from "react-router-dom";
import { Box, Stack, Typography } from "@/ui/primitives";
import type { ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";
import { pageWidthSx, PageTitle } from "./PageHeader";

export function AuthFrame({ children, title }: { children: ReactNode; title: string }) {
  const site = useSiteSettings();
  const brandSx = {
    color: "inherit",
    textDecoration: "none",
    whiteSpace: "nowrap",
    fontFamily: tokens.typography.fontFamily.display,
    fontWeight: tokens.typography.fontWeight.regular,
    fontSize: { xs: `${tokens.typography.fontSize.titleSm}px`, sm: `${tokens.typography.fontSize.title}px` },
  };
  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: {
      xs: "minmax(0, 1fr)",
      md: `minmax(0, 1fr) minmax(calc(${tokens.layout.touchTarget}px * 8), 0.9fr)`,
      xl: `minmax(0, 1fr) ${tokens.layout.readingMax}px`,
    } }}>
      <SiteMetadata />
      <Box sx={{ display: { xs: "none", md: "block" }, position: "relative", overflow: "hidden", bgcolor: "secondary.dark", minHeight: "100dvh" }}>
        <Box component="img" src="/covers/mountains-autumn.jpg" alt="秋日山川湖畔书房" sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
        <Box sx={{ ...pageWidthSx, position: "absolute", top: 0, height: tokens.layout.navHeight, display: "flex", alignItems: "center", color: "common.white" }}>
          <Typography component={Link} to="/library" variant="h5" sx={brandSx}>{site.name}</Typography>
        </Box>
      </Box>
      <Box sx={{ ...pageWidthSx, display: "flex", flexDirection: "column", minHeight: "100dvh", minWidth: 0, bgcolor: "background.default" }}>
        <Stack component="header" direction="row" sx={{ minHeight: tokens.layout.navHeight, alignItems: "center", justifyContent: "space-between", gap: `${tokens.spacing[3]}px` }}>
          <Typography component={Link} to="/library" variant="h5" sx={{ ...brandSx, display: { xs: "block", md: "none" } }}>{site.name}</Typography>
          <Button variant="text" component={Link} to="/library" startIcon={<ArrowBackRounded />} sx={{ px: 0 }}>返回首页</Button>
        </Stack>
        <Box component="main" sx={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0, py: `${tokens.spacing[8]}px` }}>
          <Box sx={{ width: "100%", minWidth: 0 }}>
            <Box sx={{ mb: `${tokens.spacing[8]}px` }}>
              <PageTitle>{title}</PageTitle>
            </Box>
            {children}
          </Box>
        </Box>
        <SiteFooter />
      </Box>
    </Box>
  );
}
