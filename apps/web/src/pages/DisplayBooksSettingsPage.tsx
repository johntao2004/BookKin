import { AddRounded } from "@/ui/icons";
import { ArrowDownwardRounded } from "@/ui/icons";
import { ArrowUpwardRounded } from "@/ui/icons";
import { CloudUploadOutlined } from "@/ui/icons";
import { DeleteOutlineRounded } from "@/ui/icons";
import { DragIndicatorRounded } from "@/ui/icons";
import { RefreshRounded } from "@/ui/icons";
import { Alert } from "@/ui";
import { Box } from "@/ui";
import { Button } from "@/ui";
import { Chip } from "@/ui";
import { CircularProgress } from "@/ui";
import { Dialog } from "@/ui";
import { DialogActions } from "@/ui";
import { DialogContent } from "@/ui";
import { DialogTitle } from "@/ui";
import { IconButton } from "@/ui";
import { List } from "@/ui";
import { ListItem } from "@/ui";
import { ListItemButton } from "@/ui";
import { ListItemIcon } from "@/ui";
import { ListItemText } from "@/ui";
import { Radio } from "@/ui";
import { Snackbar } from "@/ui";
import { Stack } from "@/ui";
import { TextField } from "@/ui";
import { Tooltip } from "@/ui";
import { Typography } from "@/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BookUploadDialog } from "../components/BookUploadDialog";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { tokens } from "../theme/generated-tokens";

export function DisplayBooksSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const displayQuery = useQuery({ queryKey: ["display-books", "settings"], queryFn: () => api.listDisplayBooks({ limit: 100 }) });
  const booksQuery = useQuery({ queryKey: ["books", "display-source", sourceQuery], queryFn: () => api.listBooks({ q: sourceQuery.trim() || undefined, limit: 100, sort: "title" }), enabled: addOpen });
  const displayed = displayQuery.data?.items ?? [];
  const books = booksQuery.data?.items ?? [];
  const sourceBooks = useMemo(() => {
    const displayedSet = new Set(orderedIds);
    return books.filter((book) => !displayedSet.has(book.id));
  }, [books, orderedIds]);
  const canUpload = user?.role === "OWNER" || user?.role === "ADMIN";

  useEffect(() => {
    if (!displayQuery.data) return;
    setOrderedIds(displayQuery.data.items.map((book) => book.id));
    setRevision(displayQuery.data.revision);
  }, [displayQuery.data]);

  const refresh = () => {
    void displayQuery.refetch();
    if (addOpen) void booksQuery.refetch();
  };

  const add = async () => {
    if (!selectedId) return;
    setBusyId(selectedId);
    try {
      await api.addDisplayBook(selectedId, revision);
      setAddOpen(false);
      setSourceQuery("");
      setSelectedId("");
      await displayQuery.refetch();
      setNotice("已加入公共展示书单");
    } catch (error) {
      await displayQuery.refetch();
      setNotice(errorMessage(error));
    } finally { setBusyId(null); }
  };

  const remove = async (bookId: string) => {
    setBusyId(bookId);
    try {
      await api.removeDisplayBook(bookId, revision);
      await displayQuery.refetch();
      setNotice("已移出展示书单；原书和文件未删除");
    } catch (error) {
      await displayQuery.refetch();
      setNotice(errorMessage(error));
    } finally { setBusyId(null); }
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= orderedIds.length || busyId) return;
    const next = [...orderedIds];
    [next[index], next[target]] = [next[target], next[index]];
    setOrderedIds(next);
    setBusyId("order");
    try {
      const result = await api.reorderDisplayBooks(next, revision);
      setOrderedIds(result.items.map((book) => book.id));
      setRevision(result.revision);
    } catch (error) {
      await displayQuery.refetch();
      setNotice(errorMessage(error));
    } finally { setBusyId(null); }
  };

  const displayedById = new Map(displayed.map((book) => [book.id, book]));
  const openAddDialog = () => {
    setSourceQuery("");
    setSelectedId("");
    setAddOpen(true);
  };
  const closeAddDialog = () => {
    setAddOpen(false);
    setSourceQuery("");
    setSelectedId("");
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="DISPLAY CATALOG"
        title="展示书目"
        description="维护所有访客都能看到的公共书单。移出这里只会解除展示关系，不会删除平台书籍、NAS 文件或个人阅读数据。"
        action={<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}><Button startIcon={<RefreshRounded />} onClick={refresh} disabled={displayQuery.isFetching}>刷新</Button>{canUpload && <Button variant="contained" startIcon={<CloudUploadOutlined />} onClick={() => setUploadOpen(true)}>上传并展示</Button>}</Stack>}
      />
      {displayQuery.isError ? <Alert severity="error" action={<Button color="inherit" onClick={refresh}>重试</Button>}>公共书单暂时无法读取。</Alert> : null}
      <Stack spacing={2} component="section" aria-labelledby="display-order-heading">
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "flex-end" }, gap: `${tokens.spacing[3]}px` }}>
          <Box>
            <Typography id="display-order-heading" variant="h4">当前展示顺序</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: `${tokens.spacing[1]}px` }}>拖动书目调整顺序，键盘操作可使用每行右侧的上移、下移按钮；调整后自动保存。</Typography>
          </Box>
          <Stack direction="row" sx={{ alignItems: "center", gap: `${tokens.spacing[3]}px` }}>
            <Chip label={`${orderedIds.length} 本已展示`} size="small" variant="outlined" />
            <Button variant="contained" startIcon={<AddRounded />} onClick={openAddDialog} disabled={displayQuery.isPending || Boolean(busyId)}>新增</Button>
          </Stack>
        </Stack>
        {displayQuery.isPending ? <Stack sx={{ alignItems: "center", py: 8 }}><CircularProgress /></Stack> : orderedIds.length === 0 ? <Alert severity="info">还没有展示书目，请点击“新增”从藏书库中选择。</Alert> : (
          <List aria-label="当前展示书目，可拖动排序" sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, p: 0, overflow: "hidden" }}>
            {orderedIds.map((id, index) => {
              const book = displayedById.get(id);
              if (!book) return null;
              return <ListItem key={id} divider={index < orderedIds.length - 1} draggable onDragStart={(event: any) => event.dataTransfer.setData("text/display-book", id)} onDragOver={(event: any) => event.preventDefault()} onDrop={(event: any) => { event.preventDefault(); if (busyId) return; const from = orderedIds.indexOf(event.dataTransfer.getData("text/display-book")); if (from >= 0 && from !== index) { const next = [...orderedIds]; next.splice(index, 0, ...next.splice(from, 1)); setOrderedIds(next); setBusyId("order"); void (async () => { try { const result = await api.reorderDisplayBooks(next, revision); setOrderedIds(result.items.map((book) => book.id)); setRevision(result.revision); } catch (error) { await displayQuery.refetch(); setNotice(errorMessage(error)); } finally { setBusyId(null); } })(); } }} sx={{ gap: `${tokens.spacing[2]}px`, py: `${tokens.spacing[3]}px`, px: { xs: `${tokens.spacing[2]}px`, sm: `${tokens.spacing[4]}px` } }}>
                <ListItemIcon sx={{ minWidth: tokens.spacing[8], color: "text.disabled", cursor: "grab" }}><DragIndicatorRounded aria-label={`拖动 ${book.title}`} /></ListItemIcon>
                <Box component="img" src={book.coverUrl} alt="" sx={{ width: tokens.spacing[12], aspectRatio: "2 / 3", objectFit: "cover", borderRadius: `${tokens.radius.sm}px`, flexShrink: 0 }} />
                <ListItemText primary={book.title} secondary={<>{book.author}{!book.available && " · 文件暂不可用"}</>} sx={{ minWidth: 0, ml: `${tokens.spacing[2]}px` }} />
                <Stack direction="row" spacing={0.25}>
                  <Tooltip title="上移"><span><IconButton aria-label={`上移 ${book.title}`} disabled={index === 0 || Boolean(busyId)} onClick={() => void move(index, -1)}><ArrowUpwardRounded fontSize="small" /></IconButton></span></Tooltip>
                  <Tooltip title="下移"><span><IconButton aria-label={`下移 ${book.title}`} disabled={index === orderedIds.length - 1 || Boolean(busyId)} onClick={() => void move(index, 1)}><ArrowDownwardRounded fontSize="small" /></IconButton></span></Tooltip>
                  <Tooltip title="移出展示"><span><IconButton color="error" aria-label={`移出 ${book.title}`} disabled={busyId === id} onClick={() => void remove(id)}><DeleteOutlineRounded fontSize="small" /></IconButton></span></Tooltip>
                </Stack>
              </ListItem>;
            })}
          </List>
        )}
      </Stack>
      <Dialog open={addOpen} onClose={busyId ? undefined : closeAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>新增展示书目</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: `${tokens.spacing[5]}px` }}>搜索藏书库并选择一本书；加入展示不会修改原书或 NAS 文件。</Typography>
          <TextField autoFocus fullWidth label="搜索书名或作者" value={sourceQuery} onChange={(event: any) => setSourceQuery(event.target.value)} />
          {booksQuery.isPending ? <Stack sx={{ alignItems: "center", py: `${tokens.spacing[10]}px` }}><CircularProgress size={28} /></Stack> : booksQuery.isError ? <Alert severity="error" sx={{ mt: `${tokens.spacing[4]}px` }} action={<Button color="inherit" onClick={() => void booksQuery.refetch()}>重试</Button>}>书库暂时无法读取。</Alert> : sourceBooks.length ? (
            <List aria-label="可新增的书籍" sx={{ mt: `${tokens.spacing[4]}px`, maxHeight: 360, overflowY: "auto", border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, p: 0 }}>
              {sourceBooks.map((book, index) => (
                <ListItemButton key={book.id} selected={selectedId === book.id} onClick={() => setSelectedId(book.id)} divider={index < sourceBooks.length - 1} sx={{ gap: `${tokens.spacing[3]}px` }}>
                  <Radio checked={selectedId === book.id} value={book.id} slotProps={{ input: { "aria-label": `选择 ${book.title}` } }} />
                  <Box component="img" src={book.coverUrl} alt="" sx={{ width: tokens.spacing[10], aspectRatio: "2 / 3", objectFit: "cover", borderRadius: `${tokens.radius.sm}px`, flexShrink: 0 }} />
                  <ListItemText primary={book.title} secondary={`${book.author}${book.status !== "AVAILABLE" ? " · 文件暂不可用" : ""}`} />
                </ListItemButton>
              ))}
            </List>
          ) : <Alert severity="info" sx={{ mt: `${tokens.spacing[4]}px` }}>{sourceQuery.trim() ? "没有匹配的未展示书籍。" : "所有藏书都已经加入展示书单。"}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddDialog} disabled={Boolean(busyId)}>取消</Button>
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => void add()} disabled={!selectedId || Boolean(busyId)}>新增</Button>
        </DialogActions>
      </Dialog>
      <BookUploadDialog open={uploadOpen} publishToDisplay onClose={() => setUploadOpen(false)} onCompleted={(message) => { setUploadOpen(false); setNotice(message); void queryClient.invalidateQueries({ queryKey: ["display-books"] }); void queryClient.invalidateQueries({ queryKey: ["books"] }); }} />
      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice("")} message={notice} />
    </PageContainer>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "公共书单已变化，请刷新后重试。";
}
