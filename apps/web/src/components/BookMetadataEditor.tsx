import { usePermissions } from "../auth/permissions";
// 书目编辑与封面消费共用缓存更新；普通乐观保存失败须恢复快照，文件写回另行确认。
// Metadata/cover consumers share cache updates; failed optimistic saves restore snapshots and writeback requires separate confirmation.
import { Chip } from "@/ui/feedback";
import { MetadataEditorForm } from "./MetadataEditorForm";
import { Alert } from "@/ui/feedback";
import { Button } from "@/ui/buttons";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "@/ui/overlays";
import { Checkbox } from "@/ui/forms";
import { CircularProgress } from "@/ui/feedback";
import { FormControlLabel } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { Book, BookMetadata, BookKnowledgeDraft, FileOperation, FileOperationPreview } from "../domain/types";
import { FileOperationDialog } from "./FileOperationDialog";
import { ThemaSubjectField } from "./ThemaSubjectField";
import type { ContentMetadataSource } from "./BookContentSuggestionButton";
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
  subjectCodes: string[];
  authorBiography: string;
  tableOfContents: string;
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
  subjectCodes: [],
  authorBiography: "",
  tableOfContents: "",
  writeBack: false,
  publiclyVisible: true,
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function updateBookSummaries(value: unknown, updatedBook: Book): unknown {
  if (Array.isArray(value)) return value.map((item) => updateBookSummaries(item, updatedBook));
  if (!isRecord(value)) return value;
  if (value.bookId === updatedBook.id && ("bookTitle" in value || "bookAuthor" in value)) {
    return { ...value, bookTitle: updatedBook.title, bookAuthor: updatedBook.author, coverUrl: updatedBook.coverUrl };
  }
  if (value.kind === "BOOK" && value.sourceId === updatedBook.id) {
    return { ...value, sourceTitle: updatedBook.title };
  }
  if (value.id === updatedBook.id) {
    if ("libraryRoot" in value && "relativePath" in value) return updatedBook;
    return {
      ...value,
      title: updatedBook.title,
      author: updatedBook.author,
      description: updatedBook.description,
      format: updatedBook.format,
      coverUrl: updatedBook.coverUrl,
      available: updatedBook.status === "AVAILABLE",
    };
  }

  const next = { ...value };
  for (const key of ["items", "pages", "previewBooks", "featuredBook", "recentReading", "book"] as const) {
    if (key in next) next[key] = updateBookSummaries(next[key], updatedBook);
  }
  return next;
}

function updateCachedBook(queryClient: QueryClient, updatedBook: Book) {
  const refreshableKeys = new Set([
    "books", "book", "display-books", "booklists", "booklist", "booklist-books",
    "categories", "category", "category-books", "global-search-books", "global-search-notes",
    "annotation-books", "annotations", "notes-feed-books", "reading-posts", "book-reviews",
  ]);
  const snapshots = queryClient.getQueriesData<unknown>({
    predicate: ({ queryKey }) => refreshableKeys.has(String(queryKey[0]))
      && (queryKey[0] !== "book" || queryKey[1] === updatedBook.id),
  });
  for (const [queryKey, data] of snapshots) {
    if (data) queryClient.setQueryData(queryKey, updateBookSummaries(data, updatedBook));
  }
  return () => {
    for (const [queryKey, data] of snapshots) queryClient.setQueryData(queryKey, data);
  };
}

function invalidateBookMetadataConsumers(queryClient: QueryClient) {
  for (const queryKey of [
    ["book"], ["books"], ["display-books"], ["booklists"], ["booklist"], ["booklist-books"],
    ["categories"], ["category"], ["category-books"], ["global-search-books"], ["global-search-notes"],
    ["annotation-books"], ["annotations"], ["notes-feed-books"], ["reading-posts"], ["book-reviews"],
  ]) void queryClient.invalidateQueries({ queryKey });
}

type BibliographyFallback = {
  authorBiography?: string;
  tableOfContents?: string;
};

export function BookMetadataEditor({ book, layout = "page", bibliographyFallback, onClose, onCompleted, onSavedImmediately, onSaveFailed }: {
  book: Book | null;
  layout?: "page" | "detail";
  bibliographyFallback?: BibliographyFallback;
  onClose: () => void;
  onCompleted: (message: string) => void;
  onSavedImmediately: (message: string) => void;
  onSaveFailed: (message: string) => void;
}) {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const bookId = book?.id;
  const contentSource: ContentMetadataSource | undefined = bookId ? { type: "BOOK", id: bookId } : undefined;
  const initializedBookId = useRef<string | null>(null);
  const editedFields = useRef(new Set<keyof EditableMetadata>());
  const displayedFallback = useRef<BibliographyFallback>({});
  const authorBiographyFallback = bibliographyFallback?.authorBiography ?? "";
  const tableOfContentsFallback = bibliographyFallback?.tableOfContents ?? "";
  const [resetCoverOpen, setResetCoverOpen] = useState(false);
  const query = useQuery({
    queryKey: ["book-metadata", bookId],
    queryFn: () => api.getBookMetadata(bookId ?? ""),
    enabled: Boolean(bookId),
  });
  const knowledgeQuery = useQuery({
    queryKey: ["book-knowledge-draft", bookId],
    queryFn: ({ signal }) => api.getBookKnowledge(bookId ?? "", signal),
    enabled: Boolean(bookId) && can("knowledge.view"), retry: false,
  });
  const [knowledgeDraft, setKnowledgeDraft] = useState<BookKnowledgeDraft>();
  const knowledgeEdited = useRef(false);
  const [knowledgeTerms, setKnowledgeTerms] = useState<string[]>();
  const knowledgeTermsEdited = useRef(false);
  const [form, setForm] = useState<EditableMetadata>(empty);
  const [preview, setPreview] = useState<FileOperationPreview | null>(null);
  const [preparingWriteBack, setPreparingWriteBack] = useState(false);
  const [fileOperation, setFileOperation] = useState<"RENAME" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { requestCrop, cropDialog } = useCoverCrop();
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bookId) {
      initializedBookId.current = null;
      knowledgeEdited.current = false;
      knowledgeTermsEdited.current = false; setKnowledgeTerms(undefined);
      setKnowledgeDraft(undefined);
      editedFields.current.clear();
      displayedFallback.current = {};
      setForm(empty);
      setPreview(null);
      setPreparingWriteBack(false);
      setFileOperation(null);
      setError("");
      return;
    }
    if (!query.data || query.data.id !== bookId) return;

    const useAuthorFallback = layout === "detail"
      && !query.data.authorBiography?.trim()
      && query.data.sources.authorBiography !== "MANUAL"
      && Boolean(authorBiographyFallback.trim());
    const useContentsFallback = layout === "detail"
      && !query.data.tableOfContents?.trim()
      && query.data.sources.tableOfContents !== "MANUAL"
      && Boolean(tableOfContentsFallback.trim());
    const nextFallback = {
      authorBiography: useAuthorFallback ? authorBiographyFallback : "",
      tableOfContents: useContentsFallback ? tableOfContentsFallback : "",
    };

    if (initializedBookId.current !== bookId) {
      initializedBookId.current = bookId;
      knowledgeEdited.current = false;
      knowledgeTermsEdited.current = false; setKnowledgeTerms(undefined);
      setKnowledgeDraft(undefined);
      editedFields.current.clear();
      displayedFallback.current = nextFallback;
      setForm({
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
        subjectCodes: query.data.subjectCodes ?? [],
        authorBiography: query.data.authorBiography?.trim() ? query.data.authorBiography : nextFallback.authorBiography,
        tableOfContents: query.data.tableOfContents?.trim() ? query.data.tableOfContents : nextFallback.tableOfContents,
        writeBack: false,
        publiclyVisible: query.data.publiclyVisible ?? true,
      });
      return;
    }

    if (layout !== "detail") return;
    displayedFallback.current = nextFallback;
    setForm((current) => {
      const next = { ...current };
      if (!editedFields.current.has("authorBiography")) {
        next.authorBiography = query.data.authorBiography?.trim() ? query.data.authorBiography : nextFallback.authorBiography ?? "";
      }
      if (!editedFields.current.has("tableOfContents")) {
        next.tableOfContents = query.data.tableOfContents?.trim() ? query.data.tableOfContents : nextFallback.tableOfContents ?? "";
      }
      return next;
    });
  }, [authorBiographyFallback, bookId, layout, query.data, tableOfContentsFallback]);

  const update = (key: keyof EditableMetadata, value: string | boolean) => {
    editedFields.current.add(key);
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(null);
  };

  const save = () => {
    if (!book || !query.data) return;
    const original = query.data;
    const subjectChanged = JSON.stringify(form.subjectCodes) !== JSON.stringify(original.subjectCodes ?? []);
    const authorFallbackUnchanged = layout === "detail"
      && Boolean(displayedFallback.current.authorBiography)
      && !original.authorBiography?.trim()
      && original.sources.authorBiography !== "MANUAL"
      && form.authorBiography === displayedFallback.current.authorBiography;
    const metadataInput = {
      knowledgeDraft: knowledgeEdited.current ? knowledgeDraft : undefined,
      knowledgeTerms: knowledgeTermsEdited.current ? knowledgeTerms : undefined,
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
      tags: form.tags.split(/[，,;；]/).map((tag) => tag.trim()).filter(Boolean),
      subjectCodes: form.subjectCodes,
      authorBiography: authorFallbackUnchanged ? original.authorBiography || undefined : form.authorBiography.trim() || undefined,
      tableOfContents: original.tableOfContents || undefined,
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
      (metadataInput.authorBiography !== (original.authorBiography || undefined)
        || (layout === "detail" && !form.authorBiography.trim() && editedFields.current.has("authorBiography") && Boolean(displayedFallback.current.authorBiography))) && "authorBiography",
    ].filter((field): field is string => Boolean(field));
    const optimisticMetadata: BookMetadata = {
      id: book.id,
      ...metadataInput,
      knowledgeTerms: knowledgeTermsEdited.current ? knowledgeTerms : original.knowledgeTerms,
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
    const shouldWriteBack = form.writeBack && can("library.files");

    setBusy(true);
    setError("");
    if (layout === "page" && shouldWriteBack) setPreparingWriteBack(true);

    void api.updateBookMetadata(book, {
      ...metadataInput,
      manualFields,
      writeBack: shouldWriteBack,
    }).then((result) => {
      queryClient.setQueryData(["book-metadata", book.id], result.metadata);
      updateCachedBook(queryClient, visibleBookFromMetadata(book, result.metadata));
      invalidateBookMetadataConsumers(queryClient);
      if (metadataInput.knowledgeDraft) {
        queryClient.setQueryData(["book-knowledge-draft", book.id], metadataInput.knowledgeDraft);
        void queryClient.invalidateQueries({ queryKey: ["book-knowledge"] });
      }
      if (result.writeBackPreview) setPreview(result.writeBackPreview);
      onSavedImmediately("书籍展示信息已保存");
      if (!result.writeBackPreview) onClose();
    }).catch((reason) => {
      rollback();
      const message = reason instanceof Error ? reason.message : "元数据保存失败";
      setError(message);
      onSaveFailed(`元数据保存失败，已恢复原内容：${message}`);
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

  const handleFileOperationCompleted = (operation: FileOperation) => {
    if (book) {
      void queryClient.invalidateQueries({ queryKey: ["book", book.id] });
      void queryClient.invalidateQueries({ queryKey: ["book-metadata", book.id] });
    }
    void queryClient.invalidateQueries({ queryKey: ["books"] });
    void queryClient.invalidateQueries({ queryKey: ["display-books"] });
    void queryClient.invalidateQueries({ queryKey: ["file-operations"] });

    if (operation.status === "SUCCEEDED") {
      onCompleted("原文件已重命名");
    } else if (["PLANNED", "RUNNING"].includes(operation.status)) {
      onCompleted("重命名任务已提交，可在文件任务页查看进度");
    } else {
      onSaveFailed("重命名任务未完成，可在文件任务页查看结果");
    }
  };

  const readSource = async () => {
    if (!book) return;
    setBusy(true); setError("");
    try {
      const source = await api.getBookBibliographySource(book.id);
      setForm(current => {
        const authorBiography = current.authorBiography || source.authorBiography || "";
        if (authorBiography !== current.authorBiography) editedFields.current.add("authorBiography");
        if (!current.subjectCodes.length && source.subjectCodes?.length) editedFields.current.add("subjectCodes");
        return {
          ...current,
          description: current.description || source.description || "",
          authorBiography,
          subjectCodes: current.subjectCodes.length ? current.subjectCodes : source.subjectCodes ?? [],
        };
      });
      onCompleted("已读取原书可用资料，核对后保存；已有填写内容已保留。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "无法读取原书资料"); }
    finally { setBusy(false); }
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

  const editorActions: ReactNode = <>
    {book && can("library.files") && <Button variant="outlined" disabled={busy || preparingWriteBack || Boolean(preview)} onClick={() => setFileOperation("RENAME")}>
      重命名原文件
    </Button>}
    <Button color="inherit" onClick={onClose} disabled={busy}>取消</Button>
    {preparingWriteBack ? <Button variant="contained" disabled>正在准备…</Button>
      : preview ? <Button variant="contained" disabled={busy || preview.conflicts.length > 0} onClick={executeWriteBack}>
        {busy ? "正在提交…" : "确认写回原文件"}
      </Button>
      : <Button variant="contained" disabled={busy || !form.title.trim() || !form.authors.trim()} onClick={save}>
        {busy ? "正在保存…" : form.writeBack ? "保存并预览" : "保存"}
      </Button>}
  </>;

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
      {query.isPending ? <Stack sx={{ py: 8, alignItems: "center" }}><CircularProgress /></Stack>
        : query.isError ? <Alert severity="error">无法读取书籍元数据。</Alert> : (
          <MetadataEditorForm value={form} onChange={update} disabled={busy || preparingWriteBack || Boolean(preview)} aiEnabled={can("library.edit")} aiContentSource={contentSource}
            actions={editorActions}
            knowledgeAvailable={can("knowledge.view")}
            knowledgeTerms={knowledgeTermsEdited.current ? knowledgeTerms : query.data?.knowledgeTerms}
            onKnowledgeTermsChange={next => { knowledgeTermsEdited.current = true; setKnowledgeTerms(next); setPreview(null); }}
            knowledgeDraft={knowledgeEdited.current ? knowledgeDraft : knowledgeQuery.data}
            onKnowledgeChange={next => { knowledgeEdited.current = true; setKnowledgeDraft(next); setPreview(null); }}
            knowledgeLoading={knowledgeQuery.isPending}
            knowledgeError={knowledgeQuery.isError ? "知识点暂时无法读取。" : undefined}
            onRetryKnowledge={() => { void knowledgeQuery.refetch(); }}
            coverUrl={query.data?.coverUrl ?? book?.coverUrl} coverAlt="当前书籍封面"
            coverDetails={<Chip label={book?.format} variant="outlined" />}
            coverActions={<>
              <Button variant="outlined" disabled={busy || Boolean(preview)} onClick={() => coverInput.current?.click()}>更换封面</Button>
              <Button variant="outlined" disabled={busy || Boolean(preview)} onClick={() => void readSource()}>读取原书资料</Button>
                <Button color="inherit" disabled={busy || Boolean(preview)} onClick={() => setResetCoverOpen(true)}>恢复默认封面</Button>
              <input ref={coverInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: any) => { const file = event.target.files?.[0]; if (file) void replaceCover(file); event.target.value = ""; }} />
            </>} extraFields={() => (
              <ThemaSubjectField value={form.subjectCodes} disabled={busy || Boolean(preview)} contentSource={contentSource}
                onChange={subjectCodes => { editedFields.current.add("subjectCodes"); setForm(current => ({ ...current, subjectCodes })); setPreview(null); }} />
            )}>
            {preview ? <Stack spacing={2.25} sx={{ pt: 1 }}>
              <Typography variant="h5" component="h3">确认写回原文件</Typography>
              <Typography>是否将刚刚保存的元信息同步到原文件？</Typography>
              {preview.conflicts.map((conflict) => <Alert key={`${conflict.code}-${conflict.path}`} severity="error">{conflict.message}</Alert>)}
            </Stack> : <FormControlLabel control={<Checkbox disabled={busy || !can("library.files")} checked={form.writeBack && can("library.files")} onChange={(event: any) => update("writeBack", event.target.checked)} />} label={`同时写回 ${book?.format ?? ""} 原文件`} />}
          </MetadataEditorForm>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}


      {book && can("library.files") && <FileOperationDialog
        book={fileOperation ? book : null}
        type={fileOperation}
        onClose={() => setFileOperation(null)}
        onCompleted={handleFileOperationCompleted}
      />}
    </Stack>
  );
}
