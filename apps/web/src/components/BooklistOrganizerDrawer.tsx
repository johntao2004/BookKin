import AddRounded from "@mui/icons-material/AddRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRounded from "@mui/icons-material/DragIndicatorRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { BooklistDetail, BrowseBook } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

async function loadAllBooklistBooks(id: string): Promise<BrowseBook[]> {
  const items: BrowseBook[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.listBooklistBooks({ id, cursor, limit: 100 });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

export function BooklistOrganizerDrawer({ open, booklist, onClose, onChanged }: {
  open: boolean;
  booklist: BooklistDetail;
  onClose: () => void;
  onChanged: (booklist: BooklistDetail, message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [ordered, setOrdered] = useState<BrowseBook[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const currentQuery = useQuery({
    queryKey: ["booklist-books", booklist.id, "organizer"],
    queryFn: () => loadAllBooklistBooks(booklist.id),
    enabled: open,
  });
  const sourceQuery = useQuery({
    queryKey: ["books", "booklist-source", deferredQuery],
    queryFn: () => api.listBooks({ q: deferredQuery.trim() || undefined, sort: "title", limit: 100 }),
    enabled: open,
  });

  useEffect(() => {
    if (currentQuery.data) setOrdered(currentQuery.data);
  }, [currentQuery.data]);

  const currentIds = useMemo(() => new Set(ordered.map((book) => book.id)), [ordered]);
  const candidates = sourceQuery.data?.items.filter((book) => !currentIds.has(book.id)) ?? [];

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["booklist", booklist.id] }),
      queryClient.invalidateQueries({ queryKey: ["booklist-books", booklist.id] }),
      queryClient.invalidateQueries({ queryKey: ["booklists"] }),
    ]);
  };

  const commitOrder = async (next: BrowseBook[]) => {
    const previous = ordered;
    setOrdered(next);
    setBusyId("order");
    setError("");
    try {
      const result = await api.reorderBooklistBooks(booklist.id, next.map((book) => book.id), booklist.revision);
      onChanged(result, "书单顺序已保存");
      await refresh();
    } catch (reason) {
      setOrdered(previous);
      setError(errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= ordered.length || busyId) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    void commitOrder(next);
  };

  const drop = (bookId: string, target: number) => {
    if (busyId) return;
    const from = ordered.findIndex((book) => book.id === bookId);
    if (from < 0 || from === target) return;
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    void commitOrder(next);
  };

  const add = async (bookId: string, title: string) => {
    setBusyId(bookId);
    setError("");
    try {
      const result = await api.addBooklistBooks(booklist.id, [bookId], booklist.revision);
      onChanged(result, `已将《${title}》加入书单`);
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (book: BrowseBook) => {
    setBusyId(book.id);
    setError("");
    try {
      const result = await api.removeBooklistBook(booklist.id, book.id, booklist.revision);
      onChanged(result, `已将《${book.title}》移出书单；原书未删除`);
      setOrdered((current) => current.filter((candidate) => candidate.id !== book.id));
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={busyId ? undefined : onClose} slotProps={{ paper: { sx: { width: { xs: "100%", md: 960 }, maxWidth: "100vw" } } }}>
      <Stack sx={{ minHeight: "100%", p: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px` }, gap: `${tokens.spacing[5]}px` }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: `${tokens.spacing[4]}px` }}>
          <Box>
            <Typography variant="overline" color="primary.main">整理书单</Typography>
            <Typography variant="h3">{booklist.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: `${tokens.spacing[1]}px` }}>拖动或使用上下按钮排序；所有变更自动保存。</Typography>
          </Box>
          <IconButton aria-label="关闭整理书单" onClick={onClose}><CloseRounded /></IconButton>
        </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {booklist.visibility === "PUBLIC" ? <Alert severity="info">这个书单已公开，只能加入公共书目池中的书籍。</Alert> : null}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.22fr) minmax(320px, .78fr)" }, gap: `${tokens.spacing[8]}px`, alignItems: "start" }}>
          <Box component="section" aria-labelledby="current-booklist-heading">
            <Typography id="current-booklist-heading" variant="h5" sx={{ mb: `${tokens.spacing[3]}px` }}>当前顺序 · {ordered.length} 本</Typography>
            {currentQuery.isPending ? <Stack sx={{ alignItems: "center", py: `${tokens.spacing[10]}px` }}><CircularProgress /></Stack> : ordered.length ? (
              <List sx={{ p: 0, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, overflow: "hidden" }}>
                {ordered.map((book, index) => (
                  <ListItem
                    key={book.id}
                    divider={index < ordered.length - 1}
                    draggable={!busyId}
                    onDragStart={(event) => event.dataTransfer.setData("text/booklist-book", book.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); drop(event.dataTransfer.getData("text/booklist-book"), index); }}
                    sx={{ gap: `${tokens.spacing[2]}px`, px: `${tokens.spacing[3]}px` }}
                  >
                    <ListItemIcon sx={{ minWidth: tokens.spacing[8], color: "text.disabled", cursor: "grab" }}><DragIndicatorRounded aria-hidden /></ListItemIcon>
                    <Box component="img" src={book.coverUrl} alt="" sx={{ width: 38, aspectRatio: "2 / 3", objectFit: "cover", borderRadius: `${tokens.radius.sm}px` }} />
                    <ListItemText primary={book.title} secondary={book.author} sx={{ minWidth: 0 }} />
                    <Stack direction="row" spacing={0}>
                      <Tooltip title="上移"><span><IconButton size="small" disabled={index === 0 || Boolean(busyId)} onClick={() => move(index, -1)} aria-label={`上移 ${book.title}`}><ArrowUpwardRounded fontSize="small" /></IconButton></span></Tooltip>
                      <Tooltip title="下移"><span><IconButton size="small" disabled={index === ordered.length - 1 || Boolean(busyId)} onClick={() => move(index, 1)} aria-label={`下移 ${book.title}`}><ArrowDownwardRounded fontSize="small" /></IconButton></span></Tooltip>
                      <Tooltip title="移出书单"><span><IconButton size="small" color="error" disabled={Boolean(busyId)} onClick={() => void remove(book)} aria-label={`移出 ${book.title}`}><DeleteOutlineRounded fontSize="small" /></IconButton></span></Tooltip>
                    </Stack>
                  </ListItem>
                ))}
              </List>
            ) : <Alert severity="info">书单还是空的，请从右侧加入藏书。</Alert>}
          </Box>
          <Stack component="aside" sx={{ gap: `${tokens.spacing[3]}px`, position: { md: "sticky" }, top: `${tokens.spacing[6]}px` }}>
            <Typography variant="h5">加入藏书</Typography>
            <TextField label="搜索书名或作者" value={query} onChange={(event) => setQuery(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
            {sourceQuery.isPending ? <Stack sx={{ alignItems: "center", py: `${tokens.spacing[8]}px` }}><CircularProgress size={24} /></Stack> : candidates.length ? (
              <List sx={{ p: 0, maxHeight: { md: "62vh" }, overflowY: "auto", border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px` }}>
                {candidates.map((book, index) => (
                  <ListItem key={book.id} divider={index < candidates.length - 1} secondaryAction={<Button size="small" startIcon={<AddRounded />} disabled={Boolean(busyId)} onClick={() => void add(book.id, book.title)}>加入</Button>}>
                    <ListItemText primary={book.title} secondary={book.author} />
                  </ListItem>
                ))}
              </List>
            ) : <Alert severity="info">没有可加入的匹配藏书。</Alert>}
          </Stack>
        </Box>
      </Stack>
    </Drawer>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试";
}
