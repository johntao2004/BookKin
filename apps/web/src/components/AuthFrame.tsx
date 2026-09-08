import { Button } from "@/ui/buttons";
import { ArrowBackRounded } from "@/ui/icons";
import { Link } from "react-router-dom";
import { Box } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import type { ReactNode } from "react";
import { tokens } from "../theme/generated-tokens";

type AuthFrameProps = {
  children: ReactNode;
  title: string;
  description?: string;
  greeting?: string;
};

export function AuthFrame({ children, title, description, greeting }: AuthFrameProps) {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1.08fr) minmax(360px, 0.92fr)" } }}>
      <Box
        sx={{
          display: { xs: "none", sm: "grid" },
          position: "relative",
          overflow: "hidden",
          bgcolor: "secondary.dark",
          minHeight: "100vh",
        }}
      >
        <Box
          component="img"
          src="/covers/mountains-autumn.jpg"
          alt="秋日山川湖畔书房"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        <Typography
          variant="h5"
          sx={{
            position: "absolute",
            zIndex: 2,
            top: { sm: tokens.spacing[10], lg: tokens.spacing[12] },
            left: { sm: tokens.spacing[12], lg: tokens.spacing[16] },
            color: "primary.main",
            whiteSpace: "nowrap",
          }}
        >
          BookKin
        </Typography>
        <Stack
          sx={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            px: { sm: 4, md: 6, lg: 8 },
            py: { sm: 5, lg: 6 },
            color: "common.white",
          }}
        >
          <Box sx={{ position: "relative", width: "fit-content", maxWidth: 480, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", height: "100%", textAlign: "center" }}>
              <Box>
                <Typography variant="overline" sx={{ letterSpacing: "0.18em", opacity: 0.68 }}>PRIVATE LIBRARY</Typography>
                <Typography variant="h3" sx={{ mt: 1.5, fontSize: tokens.typography.fontSize.heading, lineHeight: tokens.typography.lineHeight.heading, letterSpacing: "0.02em" }}>
                  让十万本书，也保有
                  <Box component="span" sx={{ display: "block" }}>一间安静的阅览室。</Box>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Stack>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
          bgcolor: "background.default",
          borderLeft: { sm: "1px solid" },
          borderColor: "divider",
          px: { xs: 3, sm: 4, lg: 6 },
          py: { xs: 3, sm: 4 },
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1, md: 0 }} sx={{ width: "100%", alignItems: "flex-start" }}>
          <Typography variant="h5" sx={{ display: { xs: "block", sm: "none" }, fontFamily: tokens.typography.fontFamily.display, fontWeight: tokens.typography.fontWeight.regular }}>BookKin</Typography>
          <Button component={Link} to="/library" startIcon={<ArrowBackRounded />} sx={{ px: 0 }}>返回首页</Button>
        </Stack>
        <Box sx={{ flex: 1, display: "flex", alignItems: { xs: "flex-start", md: "center" }, justifyContent: "center", py: { xs: 4, sm: 6, md: 4 } }}>
          <Box sx={{ width: "100%", maxWidth: 440 }}>
            {greeting && (
              <Typography variant="body2" color="primary" sx={{ mb: 1, fontWeight: tokens.typography.fontWeight.medium }}>
                {greeting}
              </Typography>
            )}
            <Typography variant="h2" component="h1" sx={{ mb: description ? 0 : 4 }}>{title}</Typography>
            {description && <Typography color="text.secondary" sx={{ mt: 1.5, mb: 4 }}>{description}</Typography>}
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
