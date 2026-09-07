import { LockOutlined } from "@/ui/icons";
import { Button } from "@/ui/buttons";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { Link } from "react-router-dom";
import { tokens } from "../theme/generated-tokens";

export type AccessDeniedReason = "AUTHENTICATION_REQUIRED" | "INSUFFICIENT_ROLE";

export function AccessDeniedPage({ reason, returnTo }: { reason: AccessDeniedReason; returnTo: string }) {
  const authenticationRequired = reason === "AUTHENTICATION_REQUIRED";

  return (
    <Stack
      component="main"
      sx={{
        minHeight: authenticationRequired ? "100dvh" : `calc(100dvh - ${tokens.layout.navHeight}px)`,
        alignItems: "center",
        justifyContent: "center",
        px: `${tokens.spacing[5]}px`,
        py: `${tokens.spacing[10]}px`,
        bgcolor: "background.default",
        color: "text.primary",
        textAlign: "center",
      }}
    >
      <Stack sx={{ width: "100%", maxWidth: tokens.layout.readingMax, alignItems: "center", gap: `${tokens.spacing[5]}px` }}>
        <LockOutlined aria-hidden sx={{ color: "primary.main", fontSize: tokens.spacing[12] }} />
        <Typography variant="overline" sx={{ color: "primary.main", fontWeight: tokens.typography.fontWeight.semibold }}>
          {authenticationRequired ? "401 · 需要登录" : "403 · 权限受限"}
        </Typography>
        <Typography component="h1" variant="h2">
          {authenticationRequired ? "这间书房暂未为你开门" : "这把钥匙打不开这一页"}
        </Typography>
        <Typography sx={{ maxWidth: tokens.layout.readingMax, color: "text.secondary" }}>
          {authenticationRequired
            ? "请先登录，再继续访问这项私人书库功能。"
            : "当前账户没有访问此页面所需的权限。如需使用，请联系书库主人或管理员。"}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ width: { xs: "100%", sm: "auto" }, gap: `${tokens.spacing[3]}px`, pt: `${tokens.spacing[3]}px` }}>
          {authenticationRequired ? (
            <Button component={Link} to="/login" state={{ from: returnTo }} variant="contained" size="large">
              前往登录
            </Button>
          ) : (
            <Button component={Link} to="/library/all" variant="contained" size="large">
              返回藏书库
            </Button>
          )}
          <Button component={Link} to="/library" variant="outlined" size="large">
            浏览公开书目
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
