// 未确认上传保留为草稿；确认后自动进入队列下一本或已入库书籍详情。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert } from "../ui/feedback";
import { Button } from "../ui/buttons";
import { Skeleton } from "../ui/antd";
import { Stack, Typography } from "../ui/primitives";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "../ui/overlays";
import { api } from "../api/client";
import type { BookUpload } from "../domain/types";
import { UploadReview } from "./BookUploadDialog";

export function UploadMetadataEditor({ returnTo = "/library/all" }: { returnTo?: string }) {
  const { uploadId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [freshUploadIds] = useState<string[]>(() => Array.isArray(location.state?.freshUploadIds) ? location.state.freshUploadIds.filter((id: unknown): id is string => typeof id === "string") : []);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const committedInThisVisit = useRef(false);
  // 首次校对免提示仅供本次进入使用，刷新、返回或重新打开仍按草稿状态提醒。
  useEffect(() => {
    const ids = location.state?.freshUploadIds;
    if (!Array.isArray(ids) || !ids.includes(uploadId)) return;
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, {
      replace: true, state: { ...location.state, freshUploadIds: ids.filter(id => id !== uploadId) },
    });
  }, [location, navigate, uploadId]);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["book-upload", uploadId], queryFn: () => api.getBookUpload(uploadId), refetchInterval: q => q.state.data && ["RECEIVING", "INSPECTING", "ENRICHING", "COMMITTING"].includes(q.state.data.status) ? 1200 : false });
  const upload = query.data;
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const remaining = useMemo(() => (params.get("next") ?? "").split(",").filter(id => Boolean(id) && id !== uploadId), [params, uploadId]);
  const queueState = useCallback(() => ({ bookReturnTo: returnTo, freshUploadIds: freshUploadIds.filter(id => id !== uploadId) }), [freshUploadIds, returnTo, uploadId]);
  const advanceQueueOrReturn = () => {
    if (remaining.length) navigate(`/library/uploads/${remaining[0]}?${new URLSearchParams({ next: remaining.slice(1).join(",") })}`, { replace: true, state: queueState() });
    else navigate(returnTo);
  };
  const navigateAfterCommit = (result: BookUpload) => {
    if (remaining.length) {
      navigate(`/library/uploads/${remaining[0]}?${new URLSearchParams({ next: remaining.slice(1).join(",") })}`, { replace: true, state: queueState() });
    } else if (result.committedBookId) {
      navigate(`/library/books/${encodeURIComponent(result.committedBookId)}`, { replace: true, state: { bookReturnTo: returnTo } });
    } else {
      navigate(returnTo, { replace: true });
    }
  };
  const onCommitted = async (result: BookUpload) => {
    committedInThisVisit.current = true;
    await client.cancelQueries({ queryKey: ["book-upload", uploadId] });
    client.setQueryData(["book-upload", uploadId], result);
    client.setQueriesData<BookUpload[]>({ queryKey: ["book-uploads"] }, current => current?.map(item => item.id === result.id ? result : item));
    void Promise.allSettled(["books", "display-books", "book-uploads"].map(key => client.invalidateQueries({ queryKey: [key] })));
    navigateAfterCommit(result);
  };
  const completed = upload?.status === "SUCCEEDED";
  const review = upload?.status === "READY_FOR_REVIEW" && upload.draftMetadata;
  useEffect(() => {
    if (!completed || !upload || committedInThisVisit.current) return;
    if (remaining.length) {
      navigate(`/library/uploads/${remaining[0]}?${new URLSearchParams({ next: remaining.slice(1).join(",") })}`, { replace: true, state: queueState() });
    } else if (upload.committedBookId) {
      navigate(`/library/books/${encodeURIComponent(upload.committedBookId)}`, { replace: true, state: { bookReturnTo: returnTo } });
    } else {
      navigate(returnTo, { replace: true });
    }
  }, [completed, upload?.committedBookId, remaining, navigate, queueState, returnTo]);
  return <Stack spacing={3}>
    {cancelError && <Alert severity="error">{cancelError}</Alert>}
    <Dialog open={!query.isError && upload?.status === "READY_FOR_REVIEW" && !freshUploadIds.includes(uploadId) && !noticeDismissed} onClose={() => setNoticeDismissed(true)} fullWidth maxWidth="sm">
      <DialogTitle>完善书籍信息</DialogTitle>
      <DialogContent><Typography>此书为草稿，尚未确认入库。请完善资料后点击“确认入库”。</Typography></DialogContent>
      <DialogActions><Button variant="contained" onClick={() => setNoticeDismissed(true)}>继续完善</Button></DialogActions>
    </Dialog>
    {query.isError ? <Alert severity="error">无法加载书籍信息。<Button onClick={() => void query.refetch()}>重试</Button></Alert>
      : completed ? <Stack role="status" aria-label="正在打开书籍详情或下一本校对" spacing={2}><Skeleton active /></Stack>
      : !upload || ["RECEIVING", "INSPECTING", "ENRICHING", "COMMITTING"].includes(upload.status) ? <Stack role="status" aria-label="正在准备书籍信息" spacing={2}><Skeleton active /></Stack>
      : review ? <UploadReview key={upload.id} upload={upload} onCancel={async () => { setCancelling(true); try { await api.cancelBookUpload(uploadId); await client.invalidateQueries({ queryKey: ["book-uploads"] }); advanceQueueOrReturn(); } catch (error) { setCancelError(error instanceof Error ? error.message : "取消失败，请重试"); } finally { setCancelling(false); } }} cancelling={cancelling} onChanged={async () => { await query.refetch(); }} onCommitted={onCommitted} />
      : <Stack spacing={1}><Alert severity="warning">{upload.errorDetail ?? "该上传已结束，无法继续编辑。"}{remaining.length > 0 && <Button onClick={advanceQueueOrReturn}>继续校对</Button>}</Alert></Stack>}

  </Stack>;
}
