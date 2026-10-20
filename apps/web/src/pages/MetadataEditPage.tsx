import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { Skeleton } from "../ui/antd";
import { Stack } from "../ui/primitives";
import { useFeedback } from "../ui/notifications";
import { BookMetadataEditor } from "../components/BookMetadataEditor";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { UploadMetadataEditor } from "../components/UploadMetadataEditor";

// 已入库编辑和上传校对共用页面壳及表单。
/** One page shell and one form for stored books and upload review. */
export function MetadataEditPage() {
  const { uploadId, bookId = "" } = useParams();
  const navigate = useNavigate();
  return <PageContainer><Stack spacing={3}>
    <PageHeader eyebrow="EDIT BOOK INFO" title="编辑书籍信息" action={<Button onClick={() => navigate("/library/all")}>返回书库</Button>} />
    {uploadId ? <UploadMetadataEditor key={uploadId} /> : <SavedBookEditor key={bookId} bookId={bookId} />}
  </Stack></PageContainer>;
}

function SavedBookEditor({ bookId }: { bookId: string }) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const query = useQuery({ queryKey: ["book", bookId], queryFn: () => api.getBook(bookId) });
  if (query.isPending) return <Skeleton active />;
  if (query.isError) return <Stack spacing={2}><Alert severity="error">无法加载书籍信息。</Alert><Button onClick={() => void query.refetch()}>重试</Button></Stack>;
  return <BookMetadataEditor book={query.data} onClose={() => navigate("/library/all")}
    onCompleted={message => feedback?.success({ title: message })}
    onSavedImmediately={message => feedback?.success({ title: message })}
    onSaveFailed={message => feedback?.error({ title: message, duration: 0 })} />;
}
