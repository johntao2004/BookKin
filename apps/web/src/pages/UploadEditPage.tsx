import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Skeleton, Stack } from "../ui";
import { api } from "../api/client";
import { UploadReview } from "../components/BookUploadDialog";
import { PageContainer, PageHeader } from "../components/PageHeader";

export function UploadEditPage() {
  const { uploadId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["book-upload", uploadId], queryFn: () => api.getBookUpload(uploadId), refetchInterval: q => q.state.data && ["RECEIVING", "INSPECTING", "ENRICHING", "COMMITTING"].includes(q.state.data.status) ? 1200 : false });
  const upload = query.data;
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const next = () => {
    const remaining = (params.get("next") ?? "").split(",").filter(Boolean);
    if (remaining.length) navigate(`/library/uploads/${remaining[0]}?${new URLSearchParams({ next: remaining.slice(1).join(","), publish: params.get("publish") ?? "false" })}`, { replace: true });
    else navigate("/library/all");
  };
  return <PageContainer><Stack spacing={3}>
    {cancelError && <Alert severity="error">{cancelError}</Alert>}
    <PageHeader title="编辑书籍信息" description={upload?.originalFilename ?? "已上传，可以在这里修改书籍信息。"} />
    {query.isError ? <Alert severity="error">无法加载书籍信息。<Button onClick={() => void query.refetch()}>重试</Button></Alert>
      : !upload || ["RECEIVING", "INSPECTING", "ENRICHING", "COMMITTING"].includes(upload.status) ? <div role="status" aria-label="正在准备书籍信息"><Skeleton active /></div>
      : upload.status === "READY_FOR_REVIEW" ? <UploadReview key={upload.id} upload={upload} publishToDisplay={params.get("publish") === "true"} onChanged={async () => { await query.refetch(); }} onCommitted={async () => { await Promise.all([client.invalidateQueries({ queryKey: ["books"] }), client.invalidateQueries({ queryKey: ["display-books"] }), client.invalidateQueries({ queryKey: ["book-uploads"] })]); next(); }} />
      : <Alert severity={upload.status === "SUCCEEDED" ? "success" : "warning"}>{upload.status === "SUCCEEDED" ? "书籍信息已保存。" : upload.errorDetail ?? "该上传已结束，无法继续编辑。"}<Button onClick={next}>返回书库</Button></Alert>}
    {upload?.status === "READY_FOR_REVIEW" && <Button disabled={cancelling} onClick={async () => { setCancelling(true); try { await api.cancelBookUpload(uploadId); await client.invalidateQueries({ queryKey: ["book-uploads"] }); next(); } catch (error) { setCancelError(error instanceof Error ? error.message : "取消失败，请重试"); } finally { setCancelling(false); } }}>取消本次上传</Button>}
  </Stack></PageContainer>;
}
