import { useNavigate } from "react-router-dom";
import { Button } from "../ui/buttons";
import { HttpErrorPage } from "./HttpErrorPage";
export function NotFoundPage() {
  const navigate = useNavigate();
  return <HttpErrorPage failure={{ status: 404, code: "PAGE_NOT_FOUND", reason: "访问的页面不存在，链接可能已失效或地址输入有误。" }}
    title="这一页夹错了位置" actions={<Button variant="contained" onClick={() => navigate("/library")}>返回藏书</Button>} />;
}
