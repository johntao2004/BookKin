// 书目编辑与封面消费共用缓存更新；普通乐观保存失败须恢复快照，文件写回另行确认。
// Metadata/cover consumers share cache updates; failed optimistic saves restore snapshots and writeback requires separate confirmation.
import { ImageOutlined } from "@/ui/icons";
import { Chip } from "@/ui/feedback";
import { MetadataEditorForm } from "./MetadataEditorForm";
import { Alert } from "@/ui/feedback";
import { Button } from "@/ui/buttons";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "@/ui/overlays";
import { Checkbox } from "@/ui/forms";
import { CircularProgress } from "@/ui/feedback";
import { FormControlLabel } from "@/ui/primitives";
import { MenuItem } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Select } from "@/ui/forms";
import { Typography } from "@/ui/primitives";
import { useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Book, BookMetadata, BookPage, FileOperationPreview } from "../domain/types";
import { LIBRARY_CATEGORIES } from "../pages/virtual-library-catalog";
import { tokens } from "../theme/generated-tokens";
import { useCoverCrop } from "./CoverCropDialog";

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
  primaryCategoryCode: string;
  subcategoryCode: string;
  writeBack: boolean;
  publiclyVisible: boolean;
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
  primaryCategoryCode: "",
  subcategoryCode: "",
  writeBack: false,
  publiclyVisible: true,
};

function taxonomySelection(subjectCodes: readonly string[] | undefined) {
  const codes = subjectCodes ?? [];
  for (const category of LIBRARY_CATEGORIES) {
    const subcategory = category.subcategories.find((candidate) => codes.includes(candidate.code));
    if (subcategory) return { primaryCategoryCode: category.code, subcategoryCode: subcategory.code };
  }
  const category = LIBRARY_CATEGORIES.find((candidate) => codes.includes(candidate.code));
  return { primaryCategoryCode: category?.code ?? "", subcategoryCode: "" };
}

function visibleBookFromMetadata(book: Book, metadata: BookMetadata): Book {
  return {
    ...book,
    title: metadata.title,
    author: metadata.authors.join(" / "),
    series: metadata.series,
    description: metadata.description ?? "",
    tags: metadata.tags,
    subjectCodes: metadata.subjectCodes ?? [],
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

export function BookMetadataEditor({ book, onClose, onCompleted, onSavedImmediately, onSaveFailed }: {
  book: Book | null;
  onClose: () => void;
  onCompleted: (message: string) => void;
  onSavedImmediately: (message: string) => void;
  onSaveFailed: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [resetCoverOpen, setResetCoverOpen] = useState(false);
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
  const { requestCrop, cropDialog } = useCoverCrop();
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
      ...taxonomySelection(query.data.subjectCodes),
      writeBack: false,
      publiclyVisible: query.data.publiclyVisible ?? true,
    });
  }, [book, query.data]);

  const update = (key: keyof EditableMetadata, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(null);
  };

  const subcategories = LIBRARY_CATEGORIES.find((category) => category.code === form.primaryCategoryCode)?.subcategories ?? [];

  const updatePrimaryCategory = (value: string) => {
    setForm((current) => ({ ...current, primaryCategoryCode: value, subcategoryCode: "" }));
    setPreview(null);
  };

  const save = () => {
    if (!book || !query.data) return;
    const original = query.data;
    const originalTaxonomy = taxonomySelection(original.subjectCodes);
    const subjectChanged = form.primaryCategoryCode !== originalTaxonomy.primaryCategoryCode
      || form.subcategoryCode !== originalTaxonomy.subcategoryCode;
    const metadataInput = {
      publiclyVisible: form.publiclyVisible,
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
      subjectCodes: subjectChanged
        ? form.subcategoryCode ? [form.subcategoryCode] : []
        : original.subjectCodes ?? [],
      sources: original.sources,
    };
    const sameList = (left: readonly string[], right: readonly string[]) => JSON.stringify(left) === JSON.stringify(right);
    const manualFields = [
      metadataInput.title !== original.title && "title",
      metadataInput.subtitle !== (original.subtitle || undefined) && "subtitle",
      !sameList(metadataInput.authors, original.authors) && "authors",
      !sameList(metadataInput.translators, original.translators) && "translators",
      metadataInput.language !== (original.language || undefined) && "language",
      metadataInput.publisher !== (original.publisher || undefined) && "publisher",
      metadataInput.publishedDate !== (original.publishedDate || undefined) && "publishedDate",
      metadataInput.isbn !== (original.isbn || undefined) && "isbn",
      metadataInput.description !== (original.description || undefined) && "description",
      metadataInput.series !== (original.series || undefined) && "series",
      metadataInput.seriesIndex !== (original.seriesIndex ?? undefined) && "seriesIndex",
      !sameList(metadataInput.tags, original.tags) && "tags",
      subjectChanged && "subjectCodes",
    ].filter((field): field is string => Boolean(field));
    const optimisticMetadata: BookMetadata = {
      id: book.id,
      ...metadataInput,
      sources: { ...original.sources, ...Object.fromEntries(manualFields.map((field) => [field, "MANUAL" as const])) },
    };
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
      manualFields,
      writeBack: shouldWriteBack,
    }).then((result) => {
      queryClient.setQueryData(["book-metadata", book.id], result.metadata);
      updateCachedBook(queryClient, visibleBookFromMetadata(book, result.metadata));
      void queryClient.invalidateQueries({ queryKey: ["books"] });
      void queryClient.invalidateQueries({ queryKey: ["display-books"] });
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
      const blob = await requestCrop(file);
      if (!blob) return;
      await api.updateBookCover(book.id, blob);
      onCompleted("书籍封面已更新");
      await query.refetch();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "封面保存失败"); }
    finally { setBusy(false); }
  };

  return (
    <Stack spacing={3}>
      {cropDialog}
      <Dialog open={resetCoverOpen} onClose={() => { if (!busy) setResetCoverOpen(false); }} maxWidth="xs" fullWidth>
        <DialogTitle>恢复默认封面？</DialogTitle>
        <DialogContent><Typography>当前上传的自定义封面图片将被删除，无法撤销。确认后将恢复书籍默认封面。</Typography></DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setResetCoverOpen(false)}>取消</Button>
          <Button variant="contained" disabled={busy} onClick={async () => {
            if (!book) return;
            setBusy(true); setError("");
            try {
              await api.resetBookCover(book.id);
              setResetCoverOpen(false);
              await query.refetch();
              await queryClient.invalidateQueries({ predicate: ({ queryKey }) => ["book", "books", "display-books", "global-search-books", "categories", "category", "category-books", "booklists", "booklist", "booklist-books", "annotations", "annotation-books"].includes(String(queryKey[0])) });
              onCompleted("已恢复默认封面，原上传图片将在后台清理");
            } catch (reason) { setResetCoverOpen(false); setError(reason instanceof Error ? reason.message : "封面恢复失败"); }
            finally { setBusy(false); }
          }}>{busy ? "正在恢复…" : "确认恢复"}</Button>
        </DialogActions>
      </Dialog>
      {(preview || preparingWriteBack) && <Typography variant="h5" component="h2">确认写回原文件</Typography>}
        {query.isPending ? <Stack sx={{ py: 8, alignItems: "center" }}><CircularProgress /></Stack> : query.isError ? <Alert severity="error">无法读取书籍元数据。</Alert> : preparingWriteBack ? (
          <Stack direction="row" spacing={1.5} sx={{ py: 2, alignItems: "center" }}>
            <CircularProgress size={22} />
            <Typography>正在准备写回确认…</Typography>
          </Stack>
        ) : !preview ? (
          <MetadataEditorForm value={form} onChange={update} disabled={busy}
            coverUrl={query.data?.coverUrl ?? book?.coverUrl} coverAlt="当前书籍封面"
            coverDetails={<Chip label={book?.format} variant="outlined" />}
            coverActions={<>
              <Button variant="outlined" startIcon={<ImageOutlined />} disabled={busy} onClick={() => coverInput.current?.click()}>更换封面</Button>
                <Button color="inherit" disabled={busy} onClick={() => setResetCoverOpen(true)}>恢复默认封面</Button>
              <input ref={coverInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: any) => { const file = event.target.files?.[0]; if (file) void replaceCover(file); event.target.value = ""; }} />
            </>} extraFields={
              <Stack sx={{ gridColumn: { xs: "auto", sm: "1 / -1" }, gap: `${tokens.spacing[2]}px`, minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary">书业主题分类</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: `${tokens.spacing[2]}px`, minWidth: 0 }}>
                  <Select sx={{ width: "100%" }} label="Thema 主分类" disabled={busy} value={form.primaryCategoryCode} onChange={(event: any) => updatePrimaryCategory(event.target.value)} placeholder="选择主分类">
                    <MenuItem value="">未指定（按书名与标签自动归类）</MenuItem>
                    {LIBRARY_CATEGORIES.map((category) => <MenuItem key={category.code} value={category.code}>{category.label} · {category.code} · {category.themaLabel}</MenuItem>)}
                  </Select>
                  <Select sx={{ width: "100%" }} label="Thema 子分类" value={form.subcategoryCode} disabled={busy || !form.primaryCategoryCode} onChange={(event: any) => update("subcategoryCode", event.target.value)} placeholder={form.primaryCategoryCode ? "选择子分类" : "先选择主分类"}>
                    <MenuItem value="">未指定（保留自动归类）</MenuItem>
                    {subcategories.map((subcategory) => <MenuItem key={subcategory.code} value={subcategory.code}>{subcategory.label} · {subcategory.subtitle}</MenuItem>)}
                  </Select>
                </Stack>
              </Stack>
            }>
            <FormControlLabel control={<Checkbox disabled={busy} checked={form.writeBack} onChange={(event: any) => update("writeBack", event.target.checked)} />} label={`同时写回 ${book?.format ?? ""} 原文件`} />
          </MetadataEditorForm>
        ) : (
          <Stack spacing={2.25} sx={{ pt: 1 }}>
            <Typography>是否将刚刚保存的元信息同步到原文件？</Typography>
            {preview.conflicts.map((conflict) => <Alert key={`${conflict.code}-${conflict.path}`} severity="error">{conflict.message}</Alert>)}
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "flex-end", gap: 1.5 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>取消</Button>
        {preparingWriteBack ? <Button variant="contained" disabled>正在准备…</Button>
          : !preview ? <Button variant="contained" disabled={busy || !form.title.trim() || !form.authors.trim()} onClick={save}>{form.writeBack ? "保存并生成预览" : "保存"}</Button>
          : <Button variant="contained" disabled={busy || preview.conflicts.length > 0} onClick={executeWriteBack}>{busy ? "正在提交…" : "确认写回原文件"}</Button>}
      </Stack>
    </Stack>
  );
}
