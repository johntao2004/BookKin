import { ThemaSubjectField } from "./ThemaSubjectField";
import { formatLanguages } from "../domain/languages";
import { formatPublicationDate } from "../domain/publication-date";
import { BookCover } from "./BookCover";
import { MetadataEditorForm } from "./MetadataEditorForm";
import type { ContentMetadataSource } from "./BookContentSuggestionButton";
import { useCoverCrop } from "./CoverCropDialog";
import { useNavigate } from "react-router-dom";
import { randomId } from "../utils/random-id";
import { CloudUploadOutlined } from "@/ui/icons";
import { DeleteOutlineRounded } from "@/ui/icons";
import { InsertDriveFileOutlined } from "@/ui/icons";
import { WarningAmberRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { Dialog } from "@/ui/overlays";
import { DialogActions } from "@/ui/overlays";
import { DialogContent } from "@/ui/overlays";
import { DialogTitle } from "@/ui/overlays";
import { IconButton } from "@/ui/buttons";
import { LinearProgress } from "@/ui/feedback";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { BookMetadataDraft, BookUpload, LibraryRoot, MetadataCandidate } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { useBookUploadMetadataAutosave } from "./useBookUploadMetadataAutosave";

interface LocalUpload {
  id: string;
  file: File;
  progress: number;
  state: "QUEUED" | "UPLOADING" | "UPLOADED" | "FAILED";
  uploadId?: string;
  error?: string;
}

export function BookUploadDialog({ open, initialRootId, onClose }: {
  open: boolean; initialRootId?: string; publishToDisplay?: boolean;
  onClose: () => void; onCompleted: (message: string) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [local, setLocal] = useState<LocalUpload[]>([]);
  const [freshUploadIds, setFreshUploadIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rootsQuery = useQuery({ queryKey: ["library-roots"], queryFn: () => api.listLibraryRoots(), enabled: open });
  const pendingQuery = useQuery({ queryKey: ["book-uploads", user?.id], queryFn: api.listBookUploads, enabled: open && Boolean(user?.id) });
  const writableRoots = useMemo(() => (rootsQuery.data ?? []).filter(isWritable), [rootsQuery.data]);
  const rootId = (writableRoots.find(root => root.id === initialRootId) ?? writableRoots[0])?.id ?? "";
  const completedIds = local.filter(item => item.state === "UPLOADED" && item.uploadId).map(item => item.uploadId!);
  const pendingIds = (pendingQuery.data ?? []).filter(item => ["READY_FOR_REVIEW", "INSPECTING", "ENRICHING"].includes(item.status)).map(item => item.id);
  const editIds = [...new Set([...completedIds, ...pendingIds])];


  // 两个工作循环共享队列游标，限制并发传输；UPLOADED 表示传输成功，尚需校对入库。
  // Two workers share a queue cursor to bound transfers; UPLOADED means transfer success, still requiring review and commit.
  const start = async (queue: LocalUpload[]) => {
    if (!rootId || uploading.current || !queue.length) return;
    uploading.current = true;
    setBusy(true);
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        setLocal(current => patchLocal(current, item.id, { state: "UPLOADING", error: undefined }));
        try {
          const session = await api.createBookUpload({ libraryRootId: rootId, filename: item.file.name, sizeBytes: item.file.size });
          await api.uploadBookContent(session.id, item.file, progress => setLocal(current => patchLocal(current, item.id, { progress })));
          setFreshUploadIds(current => [...current, session.id]);
          setLocal(current => patchLocal(current, item.id, { uploadId: session.id, state: "UPLOADED", progress: 100 }));
        } catch (reason) {
          setLocal(current => patchLocal(current, item.id, { state: "FAILED", error: errorMessage(reason) }));
        }
      }
    };
    try { await Promise.all([worker(), worker()]); }
    finally {
      try {
        if (user?.id) await queryClient.invalidateQueries({ queryKey: ["book-uploads"] });
      } finally {
        uploading.current = false;
        setBusy(false);
      }
    }
  };
  const addFiles = (files: FileList | File[]) => {
    if (uploading.current || !rootId) return;
    const accepted = Array.from(files).filter(file => /\.(epub|pdf)$/i.test(file.name));
    setMessage(accepted.length !== files.length ? "只支持 EPUB 和 PDF。" : accepted.length > 20 ? "单次最多上传20本，其余文件请下一次上传。" : "");
    const queue: LocalUpload[] = accepted.slice(0, 20).map(file => ({ id: randomId(), file, progress: 0, state: "QUEUED" }));
    setLocal(current => [...current, ...queue]);
    void start(queue);
  };
  const edit = () => {
    onClose();
    setLocal([]);
    navigate(`/library/uploads/${editIds[0]}?${new URLSearchParams({ next: editIds.slice(1).join(",")})}`, { state: { freshUploadIds: completedIds.filter(id => freshUploadIds.includes(id)) } });
    setFreshUploadIds([]);
  };
  return <Dialog open={open} onClose={busy ? undefined : () => { setFreshUploadIds([]); onClose(); }} fullWidth maxWidth="sm">
    <DialogTitle>上传书籍</DialogTitle>
    <DialogContent>
      <Stack spacing={2}>
        {rootId && <Typography color="text.secondary">书籍书库 · 可用 {formatBytes(writableRoots.find(root => root.id === rootId)?.freeBytes)}</Typography>}
        {rootsQuery.isError && <Alert severity="error">无法加载书库，请关闭后重试。</Alert>}
        {!rootsQuery.isPending && writableRoots.length === 0 && <Alert severity="warning">没有可上传的书库。</Alert>}
        <Box role="button" aria-label="点击或拖入 EPUB 或 PDF" aria-disabled={busy || !rootId} tabIndex={busy || !rootId ? -1 : 0} onClick={() => { if (!busy && rootId) fileInput.current?.click(); }} onKeyDown={(event: any) => { if ((event.key === "Enter" || event.key === " ") && !busy && rootId) { event.preventDefault(); fileInput.current?.click(); } }} onDragOver={(event: any) => event.preventDefault()} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} sx={{ bgcolor: "background.default", p: 2, textAlign: "center", cursor: busy || !rootId ? "default" : "pointer", "&:focus-visible": { outline: "none", boxShadow: tokens.shadow.focus } }}>
          <CloudUploadOutlined color="primary" sx={{ fontSize: 42 }} /><Typography variant="h5">点击或拖入 EPUB 或 PDF</Typography><Typography color="text.secondary">单次最多20本</Typography>
          <input ref={fileInput} onClick={event => event.stopPropagation()} hidden multiple type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" onChange={(event: any) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
        </Box>
        {local.length > 0 && <LocalQueue items={local} onRemove={id => setLocal(current => current.filter(item => item.id !== id))} />}
        {!busy && editIds.length > 0 && <Alert severity="success">已上传。你可以更改书籍信息，点击“编辑信息”继续。</Alert>}
        {message && <Alert severity="warning">{message}</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      {!busy && editIds.length > 0 ? <Button variant="contained" onClick={edit}>编辑信息</Button> : <Button variant="contained" disabled={busy || !rootId} startIcon={busy ? <CircularProgress size={18} /> : undefined} onClick={() => { const failed = local.filter(item => item.state === "FAILED"); if (failed.length) void start(failed); else fileInput.current?.click(); }}>{busy ? "正在上传…" : "开始上传"}</Button>}
    </DialogActions>
  </Dialog>;
}

function LocalQueue({ items, onRemove }: { items: LocalUpload[]; onRemove: (id: string) => void }) {
  return <Stack spacing={1.25}>{items.map((item) => (
    <Stack key={item.id} direction="row" sx={{ gap: 1.5, alignItems: "center", border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}>
      <InsertDriveFileOutlined color={item.state === "FAILED" ? "error" : "action"} />
      <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" noWrap>{item.file.name}</Typography><Typography variant="caption" color={item.state === "FAILED" ? "error" : "text.secondary"}>{item.error ?? `${formatBytes(item.file.size)} · ${item.state === "QUEUED" ? "等待上传" : item.state === "UPLOADED" ? "已上传" : "正在上传"}`}</Typography>{item.state === "UPLOADING" && <LinearProgress variant="determinate" value={item.progress} sx={{ mt: 0.75 }} />}</Box>
      {item.state !== "UPLOADING" && <IconButton aria-label={`移除 ${item.file.name}`} onClick={() => onRemove(item.id)}><DeleteOutlineRounded /></IconButton>}
    </Stack>
  ))}</Stack>;
}

export function UploadReview({ upload, onChanged, onCommitted, onCancel, cancelling = false }: { upload: BookUpload; publishToDisplay?: boolean; onChanged: () => Promise<void>; onCommitted: (commitResult: BookUpload) => Promise<void>; onCancel?: () => Promise<void>; cancelling?: boolean }) {
  const { requestCrop, cropDialog } = useCoverCrop();
  const coverInput = useRef<HTMLInputElement>(null);
  const initialDraft = upload.draftMetadata ?? null;
  const [draft, setDraft] = useState<BookMetadataDraft | null>(initialDraft);
  const draftRef = useRef<BookMetadataDraft | null>(initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(upload.status === "SUCCEEDED");
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [resultDialogBusy, setResultDialogBusy] = useState(false);
  const [resultStatus, setResultStatus] = useState<"idle" | "loading" | "results" | "empty" | "error">("idle");
  const [resultCandidates, setResultCandidates] = useState<MetadataCandidate[] | null>(null);
  const [resultMessage, setResultMessage] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [matchInFlight, setMatchInFlight] = useState(false);
  const [resultTitle, setResultTitle] = useState("在线匹配结果");
  const resultDialogOpenRef = useRef(false);
  const resultActionId = useRef(0);
  const matchInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const autosave = useBookUploadMetadataAutosave(upload.id, upload.status === "READY_FOR_REVIEW" && !completed);

  useEffect(() => {
    // A late initial query may fill a not-yet-ready draft, but same-upload refetches never replace edits.
    if (draftRef.current === null && upload.draftMetadata) {
      draftRef.current = upload.draftMetadata;
      setDraft(upload.draftMetadata);
    }
  }, [upload.id, upload.draftMetadata]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resultDialogOpenRef.current = false;
      resultActionId.current += 1;
    };
  }, []);

  if (!draft) return <Alert severity="info">正在准备书籍信息…</Alert>;

  const editable = upload.status === "READY_FOR_REVIEW" && !completed;
  const changeDraft = (change: BookMetadataDraft | null | ((current: BookMetadataDraft | null) => BookMetadataDraft | null)) => {
    const next = typeof change === "function" ? change(draftRef.current) : change;
    draftRef.current = next;
    setDraft(next);
    if (next) autosave.schedule(next);
  };
  const update = <K extends keyof BookMetadataDraft>(key: K, value: BookMetadataDraft[K]) => changeDraft((current) => current ? ({ ...current, [key]: value, sources: { ...current.sources, [key]: "MANUAL" } }) : current);
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(""); try { await action(); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); } };
  const runAfterFlush = async (action: () => Promise<void>) => run(async () => {
    autosave.pause();
    try { await autosave.flush(); await action(); }
    finally { autosave.resume(); }
  });
  const closeResultDialog = () => {
    resultDialogOpenRef.current = false;
    resultActionId.current += 1;
    setResultDialogOpen(false);
  };
  const openResultDialog = () => {
    if (resultStatus === "idle") {
      const responseError = metadataResponseError(upload);
      setResultCandidates(upload.metadataCandidates);
      setResultStatus(responseError ? "error" : upload.metadataCandidates.length ? "results" : "empty");
      setResultMessage(responseError);
    }
    setResultTitle("在线匹配结果");
    resultDialogOpenRef.current = true;
    setResultDialogOpen(true);
  };
  const lookupMetadata = async (refresh: boolean) => {
    if (!editable || matchInFlightRef.current) return;
    matchInFlightRef.current = true;
    resultDialogOpenRef.current = true;
    setResultDialogOpen(true);
    setResultTitle("在线匹配结果");
    const previousCandidates = resultCandidates ?? upload.metadataCandidates;
    if (!previousCandidates.length) setResultStatus("loading");
    setResultMessage("");
    setSelectionMessage("");
    setBusy(true);
    setMatchInFlight(true);
    setError("");
    autosave.pause();
    try {
      await autosave.flush();
      const updated = await api.matchBookUpload(upload.id, { refresh });
      if (!mountedRef.current) return;
      setResultCandidates(updated.metadataCandidates);
      await onChanged();
      if (!mountedRef.current) return;
      const responseError = metadataResponseError(updated);
      if (responseError) {
        setResultMessage(responseError);
        setResultStatus("error");
      } else {
        setResultStatus(updated.metadataCandidates.length ? "results" : "empty");
      }
    } catch (reason) {
      if (mountedRef.current) {
        setResultMessage(errorMessage(reason));
        setResultStatus("error");
      }
    } finally {
      autosave.resume();
      if (mountedRef.current) {
        setBusy(false);
        setMatchInFlight(false);
      }
      matchInFlightRef.current = false;
    }
  };
  const showOrMatch = () => {
    const candidates = resultCandidates ?? upload.metadataCandidates;
    if (candidates.length || resultStatus !== "idle" || metadataResponseError(upload)) openResultDialog();
    else void lookupMetadata(false);
  };
  const useCandidate = async (candidate: MetadataCandidate) => {
    const actionId = ++resultActionId.current;
    setBusy(true);
    setResultDialogBusy(true);
    setResultMessage("");
    autosave.pause();
    try {
      await autosave.flush();
      if (actionId !== resultActionId.current || !resultDialogOpenRef.current) return;
      const current = draftRef.current;
      if (!current) return;
      const applied = applyCandidate(current, candidate);
      changeDraft(applied.draft);
      await autosave.flush();
      if (actionId !== resultActionId.current || !resultDialogOpenRef.current) return;
      if (applied.protectedFields.length) {
        setSelectionMessage(`已使用此版本并保存；以下手工字段已保留：${applied.protectedFields.join("、")}。`);
      } else {
        setSelectionMessage("已使用此版本并保存到草稿。");
      }
      closeResultDialog();
    } catch (reason) {
      if (mountedRef.current && actionId === resultActionId.current && resultDialogOpenRef.current) setResultMessage(errorMessage(reason));
    } finally {
      autosave.resume();
      if (mountedRef.current) {
        setBusy(false);
        setResultDialogBusy(false);
      }
    }
  };
  const useCandidateCover = async (candidate: MetadataCandidate) => {
    const actionId = ++resultActionId.current;
    setBusy(true);
    setResultDialogBusy(true);
    setResultMessage("");
    autosave.pause();
    try {
      await autosave.flush();
      if (actionId !== resultActionId.current || !resultDialogOpenRef.current) return;
      await api.selectBookUploadCover(upload.id, candidate.id);
      await onChanged();
      if (actionId === resultActionId.current && resultDialogOpenRef.current) closeResultDialog();
    } catch (reason) {
      if (mountedRef.current && actionId === resultActionId.current && resultDialogOpenRef.current) setResultMessage(errorMessage(reason));
    } finally {
      autosave.resume();
      if (mountedRef.current) {
        setBusy(false);
        setResultDialogBusy(false);
      }
    }
  };
  const coverChanged = async (file: File) => runAfterFlush(async () => {
    const blob = await requestCrop(file);
    if (!blob) return;
    await api.uploadBookCover(upload.id, blob);
    await onChanged();
  });

  const commit = async () => {
    setBusy(true);
    setError("");
    autosave.pause();
    let committed: BookUpload;
    try {
      await autosave.flush();
      committed = await api.commitBookUpload(upload.id, draftRef.current?.publiclyVisible ?? true);
    } catch (reason) {
      autosave.resume();
      setError(errorMessage(reason));
      setBusy(false);
      return;
    }
    autosave.complete();
    setCompleted(true);
    setBusy(false);
    try { await onCommitted(committed); }
    catch (reason) { setError(errorMessage(reason)); }
  };
  const cancel = async () => {
    if (!onCancel) return;
    setBusy(true);
    setError("");
    autosave.pause();
    try {
      await autosave.flush();
      await onCancel();
      autosave.complete();
    } catch (reason) {
      autosave.resume();
      setError(errorMessage(reason));
      setBusy(false);
    }
  };
  const retrySave = () => { void autosave.flush().catch(() => undefined); };
  const savedSuccessfully = completed || upload.status === "SUCCEEDED";
  const saveStateText = savedSuccessfully ? "已确认入库" : autosave.state === "saving" ? "正在保存草稿…" : autosave.state === "dirty" ? "草稿待保存" : autosave.state === "error" ? `草稿保存失败：${autosave.error}` : "草稿已自动保存";
  const contentSource: ContentMetadataSource | undefined = upload.status === "SUCCEEDED" && upload.committedBookId
    ? { type: "BOOK", id: upload.committedBookId }
    : upload.status === "READY_FOR_REVIEW" && !completed ? { type: "UPLOAD", id: upload.id } : undefined;

  const visibleCandidates = resultCandidates ?? upload.metadataCandidates;

  return <>
  <Stack spacing={2}>
    {cropDialog}
    {upload.similarBookIds.length > 0 && <Alert severity="warning" icon={<WarningAmberRounded />}>发现标题和作者相似的藏书。它不是完全重复文件，确认后仍可作为独立版本入库。</Alert>}
    {(upload.encrypted || upload.drmProtected || upload.digitallySigned) && <Alert severity="warning">该文件包含{upload.encrypted ? "加密" : ""}{upload.drmProtected ? " DRM" : ""}{upload.digitallySigned ? "数字签名" : ""}标记；可以入库，但默认禁止元数据写回原文件。</Alert>}
    <MetadataEditorForm actions={<>
      {onCancel && <Button color="error" disabled={!editable || busy || cancelling} onClick={() => void cancel()}>取消上传</Button>}
      <Button variant="outlined" onClick={showOrMatch} disabled={!editable || busy}>{visibleCandidates.length ? `在线匹配（${visibleCandidates.length}）` : "在线匹配"}</Button>
      <Button variant="contained" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined} onClick={() => void commit()} disabled={!editable || busy || !draft.title.trim() || draft.authors.length === 0}>{completed || upload.status === "SUCCEEDED" ? "已入库" : busy ? "正在处理…" : "确认入库"}</Button>
    </>} aiEnabled aiContentSource={contentSource} knowledgeDraft={draft.knowledgeDraft} knowledgeTerms={draft.knowledgeTerms}
    onKnowledgeTermsChange={next => changeDraft(current => current ? { ...current, knowledgeTerms: next } : current)}
    onKnowledgeChange={next => changeDraft(current => current ? { ...current, knowledgeDraft: next } : current)} value={{
      title: draft.title, subtitle: draft.subtitle ?? "", authors: draft.authors.join("，"), translators: draft.translators.join("，"),
      language: draft.language ?? "", publisher: draft.publisher ?? "", publishedDate: draft.publishedDate ?? "", isbn: draft.isbn ?? "",
      series: draft.series ?? "", seriesIndex: draft.seriesIndex?.toString() ?? "", tags: draft.tags.join("，"), description: draft.description ?? "", authorBiography: draft.authorBiography ?? "", tableOfContents: draft.tableOfContents ?? "", publiclyVisible: draft.publiclyVisible ?? true,
    }} disabled={!editable || busy} onChange={(key, value) => {
      if (key === "publiclyVisible") changeDraft(current => current ? { ...current, publiclyVisible: Boolean(value) } : current);
      else if (key === "authors" || key === "translators" || key === "tags") update(key, split(String(value)));
      else if (key === "seriesIndex") update(key, value ? Number(value) : undefined);
      else update(key, String(value));
    }} extraFields={() => <ThemaSubjectField value={draft.subjectCodes ?? []} disabled={!editable || busy} contentSource={contentSource}
      onChange={codes => update('subjectCodes', codes)} />} coverUrl={upload.coverUrl} coverAlt={`${draft.title}封面`} coverDetails={
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}><Chip label={upload.format} variant="outlined" /><Chip label={formatBytes(upload.declaredSizeBytes)} variant="outlined" />{(draft.pageCount || draft.wordCount) && <Chip label={draft.pageCount ? `${draft.pageCount} 页` : `${draft.wordCount!.toLocaleString("zh-CN")} 字`} variant="outlined" />}</Stack>
    } coverActions={<>
        <Button variant="outlined" disabled={!editable || busy} onClick={() => coverInput.current?.click()}>更换封面</Button>
        <input ref={coverInput} hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={!editable || busy} onChange={(event: any) => { const file = event.target.files?.[0]; if (file) void coverChanged(file); event.target.value = ""; }} />
    </>} />
    {error && <Alert severity="error">{error}</Alert>}
    {selectionMessage && <Typography variant="body2" color="text.secondary" role="status">{selectionMessage}</Typography>}
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
      <Typography variant="caption" color={!savedSuccessfully && autosave.state === "error" ? "error" : "text.secondary"} role="status" aria-live="polite">{saveStateText}</Typography>
      {!savedSuccessfully && autosave.state === "error" && <Button size="small" variant="outlined" onClick={retrySave} disabled={busy}>重试保存</Button>}
    </Stack>

  </Stack>
  <Dialog open={resultDialogOpen} onClose={resultDialogBusy ? undefined : closeResultDialog} fullWidth maxWidth="sm">
    <DialogTitle>{resultTitle}</DialogTitle>
    <DialogContent>
      <Stack spacing={1.5}>
        {(matchInFlight || resultStatus === "loading") && <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}><CircularProgress size={18} /><Typography variant="body2">正在在线匹配…</Typography></Stack>}
        {resultMessage && <Typography variant="body2" color="error" role="alert">{resultMessage}</Typography>}
        {resultStatus === "empty" && <Typography variant="body2" color="text.secondary">没有找到可用的候选书目信息。</Typography>}
        {visibleCandidates.map(candidate => <CandidateCard key={`${candidate.provider}-${candidate.id}`} candidate={candidate} draft={draft} disabled={!editable || busy} onUse={() => void useCandidate(candidate)} onCover={candidate.coverUrl ? () => void useCandidateCover(candidate) : undefined} />)}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button variant="outlined" disabled={!editable || busy} onClick={() => void lookupMetadata(true)}>{matchInFlight ? "正在匹配…" : resultMessage ? "重试匹配" : "重新匹配"}</Button>
    </DialogActions>
  </Dialog>
  </>;
}

function CandidateCard({ candidate, draft, onUse, onCover, disabled = false }: { candidate: MetadataCandidate; draft: BookMetadataDraft; onUse: () => void; onCover?: () => void; disabled?: boolean }) {
  const protectedFields = candidateProtectedFields(draft, candidate);
  const facts = [
    ["作者", candidate.authors?.filter(Boolean).join(" / ")],
    ["出版社", candidate.publisher],
    ["出版日期", formatPublicationDate(candidate.publishedDate)],
    ["ISBN", candidate.isbn],
    ["版次", candidate.edition],
    ["语言", formatLanguages(candidate.language)],
  ] as const;
  return <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2, alignItems: { sm: "center" }, border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
    {candidate.coverUrl && <BookCover src={candidate.coverUrl} alt="在线候选封面" sx={{ width: `${tokens.spacing[12]}px` }} />}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.75 }}><Typography variant="subtitle2">{candidate.title ?? "未提供书名"}</Typography></Stack>
      <Stack spacing={0.25}>
        {facts.map(([label, value]) => <Typography key={label} variant="caption" color="text.secondary">{label}：{value?.trim() || "未提供"}</Typography>)}
      </Stack>
      {protectedFields.length > 0 && <Typography variant="caption" color="warning.main" role="note">使用此版本时将保留手工字段：{protectedFields.join("、")}</Typography>}
    </Box>
    <Stack direction="row" spacing={1}>{onCover && <Button size="small" disabled={disabled} onClick={onCover}>采用封面</Button>}<Button size="small" variant="contained" aria-label={`使用此版本：${candidate.title ?? "未提供书名"}`} disabled={disabled} onClick={onUse}>使用此版本</Button></Stack>
  </Stack>;
}

function applyCandidate(current: BookMetadataDraft, candidate: MetadataCandidate) {
  const draft: BookMetadataDraft = { ...current, sources: { ...current.sources } };
  const protectedFields: string[] = [];
  const apply = <K extends keyof BookMetadataDraft>(key: K, value: BookMetadataDraft[K] | undefined, label: string) => {
    const hasValue = typeof value === "string" ? Boolean(value.trim()) : Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null;
    if (!hasValue) return;
    if (current.sources[key] === "MANUAL") {
      protectedFields.push(label);
      return;
    }
    draft[key] = value as BookMetadataDraft[K];
    draft.sources[key] = candidate.provider;
  };
  apply("title", candidate.title, "书名");
  apply("subtitle", candidate.subtitle, "副标题");
  apply("authors", candidate.authors?.length ? candidate.authors : undefined, "作者");
  apply("language", candidate.language, "语言");
  apply("publisher", candidate.publisher, "出版社");
  apply("publishedDate", candidate.publishedDate, "出版日期");
  apply("isbn", candidate.isbn, "ISBN");
  apply("description", candidate.description, "内容简介");
  apply("tags", candidate.tags?.length ? candidate.tags : undefined, "标签");
  return { draft, protectedFields };
}

function candidateProtectedFields(draft: BookMetadataDraft, candidate: MetadataCandidate) {
  const candidates = [
    ["title", candidate.title, "书名"], ["subtitle", candidate.subtitle, "副标题"], ["authors", candidate.authors?.length ? candidate.authors : undefined, "作者"],
    ["language", candidate.language, "语言"], ["publisher", candidate.publisher, "出版社"], ["publishedDate", candidate.publishedDate, "出版日期"],
    ["isbn", candidate.isbn, "ISBN"], ["description", candidate.description, "内容简介"], ["tags", candidate.tags?.length ? candidate.tags : undefined, "标签"],
  ] as const;
  return candidates.filter(([key, value]) => value !== undefined && draft.sources[key] === "MANUAL").map(([, , label]) => label);
}

function patchLocal(items: LocalUpload[], id: string, patch: Partial<LocalUpload>) { return items.map((item) => item.id === id ? { ...item, ...patch } : item); }
function isWritable(root: LibraryRoot) { return root.status === "ONLINE" && root.canWrite && root.canStage; }
function split(value: string) { return value.split(/[，,;；]/).map((item) => item.trim()).filter(Boolean); }
function metadataResponseError(upload: BookUpload) {
  if (upload.errorDetail?.trim()) return upload.errorDetail;
  if (upload.errorCode === "ENRICHMENT_FAILED" || upload.errorCode === "AI_MATCH_FAILED") return "在线匹配暂时不可用，本地识别结果仍可继续使用。";
  return upload.errorCode ? `书目信息处理失败（${upload.errorCode}）。` : "";
}
function formatBytes(value?: number | null) { if (value == null) return "未知"; if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} GB`; if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`; return `${Math.max(1, Math.round(value / 1000))} KB`; }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : "操作失败"; }
