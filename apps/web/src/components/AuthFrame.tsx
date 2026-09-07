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
    <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.08fr minmax(420px, 0.92fr)" } }}>
      <Box
        sx={{
          display: { xs: "none", md: "grid" },
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
            top: { md: tokens.spacing[10], lg: tokens.spacing[12] },
            left: { md: tokens.spacing[12], lg: tokens.spacing[16] },
            color: "secondary.dark",
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
            px: { md: 6, lg: 8 },
            py: { md: 5, lg: 6 },
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
          bgcolor: "background.paper",
          borderLeft: { md: "1px solid" },
          borderColor: "divider",
          px: { xs: 2, sm: 4, lg: 6 },
          py: { xs: 2, sm: 3 },
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1, md: 0 }} sx={{ width: "100%", alignItems: "flex-start" }}>
          <Typography variant="h5" sx={{ display: { xs: "block", md: "none" } }}>BookKin</Typography>
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
