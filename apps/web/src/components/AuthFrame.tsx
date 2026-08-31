import { AutoStoriesOutlined } from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";
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
            <Stack direction="row" spacing={1} sx={{ position: "absolute", top: 0, left: 0, alignItems: "center", color: "secondary.dark", whiteSpace: "nowrap" }}>
              <AutoStoriesOutlined color="primary" />
              <Typography variant="h5">BookKin</Typography>
            </Stack>
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
          <Stack direction="row" spacing={1} sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", mb: 7 }}>
            <AutoStoriesOutlined color="primary" />
            <Typography variant="h5">BookKin</Typography>
          </Stack>
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
