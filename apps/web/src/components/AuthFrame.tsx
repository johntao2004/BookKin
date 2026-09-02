import { Box } from "@/ui";
import { Stack } from "@/ui";
import { Typography } from "@/ui";
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", px: { xs: 2, sm: 6 }, py: 6 }}>
        <Box sx={{ width: "100%", maxWidth: 440 }}>
          <Typography variant="h5" sx={{ display: { xs: "block", md: "none" }, mb: 7 }}>BookKin</Typography>
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
  );
}
