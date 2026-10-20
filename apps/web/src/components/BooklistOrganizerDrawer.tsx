import { EmptyState } from "../ui/empty-state";
import { AddRounded } from "@/ui/icons";
import { DeleteOutlineRounded } from "@/ui/icons";
import { DragIndicatorRounded } from "@/ui/icons";
import { SearchRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { CircularProgress } from "@/ui/feedback";
import { Drawer } from "@/ui/overlays";
import { IconButton } from "@/ui/buttons";
import { InputAdornment } from "@/ui/primitives";
import { List } from "@/ui/primitives";
import { ListItem } from "@/ui/primitives";
import { ListItemIcon } from "@/ui/primitives";
import { ListItemText } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { TextField } from "@/ui/forms";
import { Tooltip } from "@/ui/feedback";
import { Typography } from "@/ui/primitives";
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
    <Drawer anchor="right" title={`整理书单 · ${booklist.title}`} closeLabel="关闭整理书单" open={open} onClose={busyId ? undefined : onClose} slotProps={{ paper: { sx: { width: { xs: "100%", md: 960 }, maxWidth: "100vw" } } }}>
      <Stack sx={{ minHeight: "100%", p: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px` }, gap: `${tokens.spacing[5]}px` }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {booklist.visibility === "PUBLIC" ? <Alert severity="info">这个书单已公开，只能加入公共书目池中的书籍。</Alert> : null}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, .9fr) minmax(0, 1.1fr)" }, gap: `${tokens.spacing[8]}px`, alignItems: "start" }}>
          <Box component="section" aria-labelledby="current-booklist-heading">
            <Stack direction="row" sx={{ alignItems: "center", minHeight: tokens.layout.touchTarget, mb: `${tokens.spacing[3]}px` }}><Typography id="current-booklist-heading" variant="h5">当前顺序</Typography></Stack>
            {currentQuery.isPending ? <Stack sx={{ alignItems: "center", py: `${tokens.spacing[10]}px` }}><CircularProgress /></Stack> : ordered.length ? (
              <List role="list" sx={{ p: 0, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, overflow: "hidden" }}>
                {ordered.map((book, index) => (
                  <ListItem
                    key={book.id}
                    role="listitem"
                    divider={index < ordered.length - 1}
                    draggable={!busyId}
                    onDragStart={(event: any) => event.dataTransfer.setData("text/booklist-book", book.id)}
                    onDragOver={(event: any) => event.preventDefault()}
                    onDrop={(event: any) => { event.preventDefault(); drop(event.dataTransfer.getData("text/booklist-book"), index); }}
                    sx={{ gap: `${tokens.spacing[2]}px`, px: `${tokens.spacing[3]}px`, "& > .bk-list-item-content": { display: { xs: "grid", sm: "flex" }, gridTemplateColumns: "auto auto minmax(0, 1fr)", gap: `${tokens.spacing[2]}px` } }}
                  >
                    <ListItemIcon sx={{ minWidth: tokens.spacing[8], color: "text.disabled", cursor: "grab" }}><DragIndicatorRounded aria-hidden /></ListItemIcon>
                    <Box component="img" src={book.coverUrl} alt="" sx={{ width: 38, aspectRatio: "2 / 3", objectFit: "cover", borderRadius: `${tokens.radius.sm}px` }} />
                    <ListItemText primary={book.title} secondary={book.author} sx={{ minWidth: 0 }} />
                    <Stack direction="row" spacing={0} sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, justifySelf: "end", flexShrink: 0 }}>
                      <Tooltip title="移出书单"><span><IconButton size="small" color="error" disabled={Boolean(busyId)} onClick={() => void remove(book)} aria-label={`移出 ${book.title}`}><DeleteOutlineRounded fontSize="small" /></IconButton></span></Tooltip>
                    </Stack>
                  </ListItem>
                ))}
              </List>
            ) : <EmptyState compact title="书单中暂无书籍" />}
          </Box>
          <Stack component="aside" sx={{ gap: `${tokens.spacing[3]}px`, position: { md: "sticky" }, top: `${tokens.spacing[6]}px` }}>
            <Stack direction="row" sx={{ alignItems: "center", minHeight: tokens.layout.touchTarget, gap: `${tokens.spacing[2]}px` }}>
              <Typography variant="h5" sx={{ flexShrink: 0 }}>加入藏书</Typography>
              <TextField aria-label="搜索书名或作者" placeholder="搜索书名或作者" value={query} onChange={(event: any) => setQuery(event.target.value)} sx={{ flex: 1, minWidth: 0 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
            </Stack>
            {sourceQuery.isPending ? <Stack sx={{ alignItems: "center", py: `${tokens.spacing[8]}px` }}><CircularProgress size={24} /></Stack> : candidates.length ? (
              <List sx={{ p: 0, maxHeight: { md: "62vh" }, overflowY: "auto", border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px` }}>
                {candidates.map((book, index) => (
                  <ListItem key={book.id} divider={index < candidates.length - 1} secondaryAction={<Button size="small" startIcon={<AddRounded />} disabled={Boolean(busyId)} onClick={() => void add(book.id, book.title)}>加入</Button>}>
                    <ListItemText primary={book.title} secondary={book.author} />
                  </ListItem>
                ))}
              </List>
            ) : <EmptyState compact title="暂无可添加的书籍" />}
          </Stack>
        </Box>
      </Stack>
    </Drawer>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试";
}
