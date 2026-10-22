import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { Skeleton } from "../ui/antd";
import { Stack } from "../ui/primitives";
import { useFeedback } from "../ui/notifications";
import { BookMetadataEditor } from "../components/BookMetadataEditor";
import { PageBackAction, PageContainer, PageHeader } from "../components/PageHeader";
import { UploadMetadataEditor } from "../components/UploadMetadataEditor";

// 已入库编辑和上传校对共用页面壳及表单。
/** One page shell and one form for stored books and upload review. */
export function MetadataEditPage() {
  const { uploadId, bookId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromDetail = !uploadId && location.state?.bookDetailReturnTo === `/library/books/${bookId}`;
  const catalogReturnTo = typeof location.state?.bookReturnTo === "string" && /^\/library(?:\/all)?(?:[?#]|$)/.test(location.state.bookReturnTo) ? location.state.bookReturnTo : "/library/all";
  const returnTo = fromDetail ? `/library/books/${bookId}` : catalogReturnTo;
  const onReturn = () => navigate(returnTo, { state: { bookReturnTo: location.state?.bookReturnTo } });
  return <PageContainer>
    <PageBackAction onClick={onReturn}>{fromDetail ? "返回详情" : "返回书库"}</PageBackAction>
    <Stack spacing={3}>
      <PageHeader eyebrow="EDIT BOOK INFO" title="编辑书籍信息" />
      {uploadId ? <UploadMetadataEditor key={uploadId} /> : <SavedBookEditor key={bookId} bookId={bookId} onReturn={onReturn} />}
    </Stack>
  </PageContainer>;
}

function SavedBookEditor({ bookId, onReturn }: { bookId: string; onReturn: () => void }) {
  const feedback = useFeedback();
  const query = useQuery({ queryKey: ["book", bookId], queryFn: () => api.getBook(bookId) });
  if (query.isPending) return <Skeleton active />;
  if (query.isError) return <Stack spacing={2}><Alert severity="error">无法加载书籍信息。</Alert><Button onClick={() => void query.refetch()}>重试</Button></Stack>;
  return <BookMetadataEditor book={query.data} onClose={onReturn}
    onCompleted={message => feedback?.success({ title: message })}
    onSavedImmediately={message => feedback?.success({ title: message })}
    onSaveFailed={message => feedback?.error({ title: message, duration: 0 })} />;
}
