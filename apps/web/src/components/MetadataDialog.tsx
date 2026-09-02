import { Alert } from "@/ui";
import { Box } from "@/ui";
import { Button } from "@/ui";
import { Checkbox } from "@/ui";
import { CircularProgress } from "@/ui";
import { Dialog } from "@/ui";
import { DialogActions } from "@/ui";
import { DialogContent } from "@/ui";
import { DialogTitle } from "@/ui";
import { Divider } from "@/ui";
import { FormControlLabel } from "@/ui";
import { Stack } from "@/ui";
import { TextField } from "@/ui";
import { Typography } from "@/ui";
import { useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Book, BookMetadata, BookPage, FileOperationPreview } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { cropCover } from "./BookUploadDialog";

interface EditableMetadata {
  title: string;
  subtitle: string;
  authors: string;
  translators: string;
  language: string;
  publisher: string;
  publishedDate: string;
  isbn: string;
  description: string;
  series: string;
  seriesIndex: string;
  tags: string;
  writeBack: boolean;
}

const empty: EditableMetadata = {
  title: "",
  subtitle: "",
  authors: "",
  translators: "",
  language: "",
  publisher: "",
  publishedDate: "",
  isbn: "",
  description: "",
  series: "",
  seriesIndex: "",
  tags: "",
  writeBack: false,
};

function visibleBookFromMetadata(book: Book, metadata: BookMetadata): Book {
  return {
    ...book,
    title: metadata.title,
    author: metadata.authors.join(" / "),
    series: metadata.series,
    description: metadata.description ?? "",
    tags: metadata.tags,
  };
}

function updateCachedBook(queryClient: QueryClient, updatedBook: Book) {
  const snapshots = queryClient.getQueriesData<InfiniteData<BookPage>>({ queryKey: ["books"] });
  for (const [queryKey, data] of snapshots) {
    if (!data) continue;
    queryClient.setQueryData<InfiniteData<BookPage>>(queryKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((book) => book.id === updatedBook.id ? updatedBook : book),
      })),
    });
  }
  return () => {
    for (const [queryKey, data] of snapshots) queryClient.setQueryData(queryKey, data);
  };
}

export function MetadataDialog({ book, onClose, onCompleted, onSavedImmediately, onSaveFailed }: {
  book: Book | null;
  onClose: () => void;
  onCompleted: (message: string) => void;
  onSavedImmediately: (message: string) => void;
  onSaveFailed: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["book-metadata", book?.id],
    queryFn: () => api.getBookMetadata(book?.id ?? ""),
    enabled: Boolean(book),
  });
  const [form, setForm] = useState<EditableMetadata>(empty);
  const [preview, setPreview] = useState<FileOperationPreview | null>(null);
  const [preparingWriteBack, setPreparingWriteBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!book) {
      setForm(empty);
      setPreview(null);
      setPreparingWriteBack(false);
      setError("");
      return;
    }
    if (query.data) setForm({
      title: query.data.title,
      subtitle: query.data.subtitle ?? "",
      authors: query.data.authors.join("，"),
      translators: query.data.translators.join("，"),
      language: query.data.language ?? "",
      publisher: query.data.publisher ?? "",
      publishedDate: query.data.publishedDate ?? "",
      isbn: query.data.isbn ?? "",
      description: query.data.description ?? "",
      series: query.data.series ?? "",
      seriesIndex: query.data.seriesIndex?.toString() ?? "",
      tags: query.data.tags.join("，"),
      writeBack: false,
    });
  }, [book, query.data]);

  const update = (key: keyof EditableMetadata, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(null);
  };

  const save = () => {
    if (!book) return;
    const metadataInput = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      authors: form.authors.split(/[，,]/).map((value) => value.trim()).filter(Boolean),
      translators: form.translators.split(/[，,]/).map((value) => value.trim()).filter(Boolean),
      language: form.language.trim() || undefined,
      publisher: form.publisher.trim() || undefined,
      publishedDate: form.publishedDate.trim() || undefined,
      isbn: form.isbn.trim() || undefined,
      description: form.description.trim() || undefined,
      series: form.series.trim() || undefined,
      seriesIndex: form.seriesIndex ? Number(form.seriesIndex) : undefined,
      tags: form.tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean),
      sources: query.data?.sources ?? {},
    };
    const optimisticMetadata: BookMetadata = { id: book.id, ...metadataInput };
    const metadataQueryKey = ["book-metadata", book.id] as const;
    const previousMetadata = queryClient.getQueryData<BookMetadata>(metadataQueryKey);
    queryClient.setQueryData(metadataQueryKey, optimisticMetadata);
    const rollbackBooks = updateCachedBook(
      queryClient,
      visibleBookFromMetadata(book, optimisticMetadata),
    );
    const rollback = () => {
      rollbackBooks();
      queryClient.setQueryData(metadataQueryKey, previousMetadata);
    };
    const shouldWriteBack = form.writeBack;

    setBusy(true);
    setError("");
    onSavedImmediately("书籍展示信息已保存");
    if (shouldWriteBack) setPreparingWriteBack(true);
    else onClose();

    void api.updateBookMetadata(book, {
      ...metadataInput,
      manualFields: ["title", "subtitle", "authors", "translators", "language", "publisher", "publishedDate", "isbn", "description", "series", "seriesIndex", "tags"],
      writeBack: shouldWriteBack,
    }).then((result) => {
      queryClient.setQueryData(["book-metadata", book.id], result.metadata);
      updateCachedBook(queryClient, visibleBookFromMetadata(book, result.metadata));
      void queryClient.invalidateQueries({ queryKey: ["books"] });
      if (result.writeBackPreview) setPreview(result.writeBackPreview);
      else if (shouldWriteBack) onClose();
    }).catch((reason) => {
      rollback();
      const message = reason instanceof Error ? reason.message : "元数据保存失败";
      if (shouldWriteBack) setError(message);
      else onSaveFailed(`元数据保存失败，已恢复原内容：${message}`);
    }).finally(() => {
      setPreparingWriteBack(false);
      setBusy(false);
    });
  };

  const executeWriteBack = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const operation = await api.executeFileOperation(preview);
      onCompleted(operation.status === "SUCCEEDED" ? "元数据已写回文件" : "元数据写回任务已提交");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "写回任务提交失败");
    } finally {
      setBusy(false);
    }
  };

  const replaceCover = async (file: File) => {
    if (!book) return;
    setBusy(true);
    setError("");
    try {
      await api.updateBookCover(book.id, await cropCover(file));
      onCompleted("书籍封面已更新");
      await query.refetch();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "封面保存失败"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={Boolean(book)} onClose={busy ? undefined : onClose} fullWidth maxWidth="md" transitionDuration={0}>
      <DialogTitle>
        <Typography variant="h4" component="span">
          {preview || preparingWriteBack ? "确认写回原文件" : "编辑元信息"}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {query.isPending ? <Stack sx={{ py: 8, alignItems: "center" }}><CircularProgress /></Stack> : query.isError ? <Alert severity="error">无法读取书籍元数据。</Alert> : preparingWriteBack ? (
          <Stack direction="row" spacing={1.5} sx={{ py: 2, alignItems: "center" }}>
            <CircularProgress size={22} />
            <Typography>正在准备写回确认…</Typography>
          </Stack>
        ) : !preview ? (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
              <Box component="img" src={query.data?.coverUrl ?? book?.coverUrl} alt="当前书籍封面" sx={{ width: 96, aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 1.5, boxShadow: tokens.shadow.cover }} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="outlined" onClick={() => coverInput.current?.click()}>更换封面</Button>
                <Button color="inherit" onClick={async () => { if (!book) return; setBusy(true); try { await api.resetBookCover(book.id); onCompleted("已恢复文件内置封面"); await query.refetch(); } catch (reason) { setError(reason instanceof Error ? reason.message : "封面恢复失败"); } finally { setBusy(false); } }}>恢复默认封面</Button>
              </Stack>
              <input ref={coverInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: any) => { const file = event.target.files?.[0]; if (file) void replaceCover(file); event.target.value = ""; }} />
            </Stack>
            <Divider />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField label="书名" required value={form.title} onChange={(event: any) => update("title", event.target.value)} />
              <TextField label="副标题" value={form.subtitle} onChange={(event: any) => update("subtitle", event.target.value)} />
              <TextField label="作者" required value={form.authors} onChange={(event: any) => update("authors", event.target.value)} helperText="多位作者用逗号分隔" />
              <TextField label="译者" value={form.translators} onChange={(event: any) => update("translators", event.target.value)} helperText="多位译者用逗号分隔" />
              <TextField label="语言" value={form.language} onChange={(event: any) => update("language", event.target.value)} placeholder="zh-CN" />
              <TextField label="出版社" value={form.publisher} onChange={(event: any) => update("publisher", event.target.value)} />
              <TextField label="出版日期" value={form.publishedDate} onChange={(event: any) => update("publishedDate", event.target.value)} />
              <TextField label="ISBN" value={form.isbn} onChange={(event: any) => update("isbn", event.target.value)} />
              <TextField label="系列" value={form.series} onChange={(event: any) => update("series", event.target.value)} />
              <TextField label="系列序号" type="number" value={form.seriesIndex} onChange={(event: any) => update("seriesIndex", event.target.value)} />
              <TextField label="标签" value={form.tags} onChange={(event: any) => update("tags", event.target.value)} helperText="用逗号分隔" />
            </Box>
            <TextField label="简介" multiline minRows={4} value={form.description} onChange={(event: any) => update("description", event.target.value)} />
            <Divider />
            <FormControlLabel control={<Checkbox checked={form.writeBack} onChange={(event: any) => update("writeBack", event.target.checked)} />} label={`同时写回 ${book?.format ?? ""} 原文件`} />
          </Stack>
        ) : (
          <Stack spacing={2.25} sx={{ pt: 1 }}>
            <Typography>是否将刚刚保存的元信息同步到原文件？</Typography>
            {preview.conflicts.map((conflict) => <Alert key={`${conflict.code}-${conflict.path}`} severity="error">{conflict.message}</Alert>)}
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>取消</Button>
        {preparingWriteBack ? <Button variant="contained" disabled>正在准备…</Button>
          : !preview ? <Button variant="contained" disabled={busy || !form.title.trim() || !form.authors.trim()} onClick={save}>{form.writeBack ? "保存并生成预览" : "保存"}</Button>
          : <Button variant="contained" disabled={busy || preview.conflicts.length > 0} onClick={executeWriteBack}>{busy ? "正在提交…" : "确认写回原文件"}</Button>}
      </DialogActions>
    </Dialog>
  );
}
