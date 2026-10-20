// 未知前端路由的恢复页面，不把资源不存在解释成认证失败。
// Recovery page for unknown frontend routes, keeping missing resources distinct from authentication failures.
import { Button } from "@/ui/buttons";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useNavigate } from "react-router-dom";
import { PageTitle, pageWidthSx } from "../components/PageHeader";
import { tokens } from "../theme/generated-tokens";

export function NotFoundPage() {
  const navigate = useNavigate();
  return <Stack spacing={2} sx={{ ...pageWidthSx, minHeight: `calc(100dvh - ${tokens.layout.navHeight}px)`, alignItems: "center", justifyContent: "center", textAlign: "center" }}><Typography component="p" variant="h4" color="primary" sx={{ fontWeight: tokens.typography.fontWeight.semibold }}>404</Typography><PageTitle>这一页夹错了位置</PageTitle><Button variant="contained" onClick={() => navigate("/library")}>返回藏书</Button></Stack>;
}
