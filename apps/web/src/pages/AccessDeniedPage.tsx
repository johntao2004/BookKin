import { Link } from "react-router-dom";
import { Button } from "../ui/buttons";
import { HttpErrorPage } from "./HttpErrorPage";

export type AccessDeniedReason = "AUTHENTICATION_REQUIRED" | "INSUFFICIENT_ROLE";
export function AccessDeniedPage({ reason, returnTo }: { reason: AccessDeniedReason; returnTo: string }) {
  const authenticationRequired = reason === "AUTHENTICATION_REQUIRED";
  return <HttpErrorPage fullHeight={authenticationRequired}
    failure={{ status: authenticationRequired ? 401 : 403, code: reason, reason: authenticationRequired ? "尚未登录或登录已过期，请登录后访问此页面。" : "当前账户没有访问此页面的权限，请联系主人确认角色权限。" }}
    title={authenticationRequired ? "这间书房暂未为你开门" : "这把钥匙打不开这一页"}
    actions={<>
      {authenticationRequired ? <Button component={Link} to="/login" state={{ from: returnTo }} variant="contained" size="large">登录</Button>
        : <Button component={Link} to="/library/all" variant="contained" size="large">返回藏书库</Button>}
      <Button component={Link} to="/library" variant="outlined" size="large">公开书目</Button>
    </>} />;
}
