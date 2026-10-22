import { BookCover } from "./BookCover";
// 在抽屉中按分类加载书籍，查询及分页状态与当前分类绑定。
// Loads category books inside a drawer with query/pagination state bound to the selected category.
import { EmptyState } from "../ui/empty-state";
import { Alert } from "@/ui/feedback";
import { Button } from "@/ui/buttons";
import { Checkbox } from "@/ui/forms";
import { CircularProgress } from "@/ui/feedback";
import { Drawer } from "@/ui/overlays";
import { List } from "@/ui/primitives";
import { ListItem } from "@/ui/primitives";
import { ListItemButton } from "@/ui/primitives";
import { ListItemText } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { TextField } from "@/ui/forms";
import { Typography } from "@/ui/primitives";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { BrowseBook } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function CategoryBooksDrawer({ open, categoryId, categoryName, onClose }: {
  open: boolean;
  categoryId: string;
  categoryName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sourceQuery = useQuery({
    queryKey: ["books", "category-source", deferredQuery],
    queryFn: () => api.listBooks({ q: deferredQuery.trim() || undefined, sort: "title", limit: 100 }),
    enabled: open,
  });
  const assignedQuery = useQuery({
    queryKey: ["category-books", categoryId, "membership"],
    queryFn: async () => {
      const items: BrowseBook[] = [];
      let cursor: string | undefined;
      do {
        const page = await api.listCategoryBooks({ id: categoryId, cursor, limit: 100 });
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return items;
    },
    enabled: open && Boolean(categoryId),
  });

  useEffect(() => {
    if (!open || !assignedQuery.data) return;
    const next = new Set(assignedQuery.data.map((book) => book.id));
    setInitialIds(next);
    setSelectedIds(new Set(next));
    setError("");
  }, [assignedQuery.data, open]);

  const changedIds = useMemo(() => {
    const ids = new Set([...initialIds, ...selectedIds]);
    return [...ids].filter((id) => initialIds.has(id) !== selectedIds.has(id));
  }, [initialIds, selectedIds]);

  const toggle = (bookId: string) => {
    setSelectedIds((current) => {
      const updated = new Set(current);
      if (updated.has(bookId)) updated.delete(bookId);
      else updated.add(bookId);
      return updated;
    });
  };

  const save = async () => {
    if (!changedIds.length) return;
    setBusy(true);
    setError("");
    try {
      for (const bookId of changedIds) {
        const assigned = await api.listBookCategories(bookId);
        const next = new Set(assigned.items.map((category) => category.id));
        if (selectedIds.has(bookId)) next.add(categoryId);
        else next.delete(categoryId);
        await api.replaceBookCategories(bookId, [...next]);
      }
      setInitialIds(new Set(selectedIds));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["category", categoryId] }),
        queryClient.invalidateQueries({ queryKey: ["category-books", categoryId] }),
      ]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "分类归属更新失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      title={`整理分类 · ${categoryName}`}
      closeLabel="关闭整理分类"
      open={open}
      onClose={busy ? undefined : onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 520 }, maxWidth: "100vw" } } }}
    >
      <Stack sx={{ minHeight: "100%", p: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px` }, gap: `${tokens.spacing[5]}px` }}>
        <TextField
          fullWidth
          label="搜索书名或作者"
          value={query}
          onChange={(event: any) => setQuery(event.target.value)}
        />
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: `${tokens.spacing[3]}px` }}>
          <Typography color="text.secondary">已选 {selectedIds.size} 本{changedIds.length ? ` · ${changedIds.length} 项变更待保存` : ""}</Typography>
          <Stack direction="row" sx={{ gap: `${tokens.spacing[2]}px` }}>
            <Button disabled={!changedIds.length || busy} onClick={() => setSelectedIds(new Set(initialIds))}>撤销</Button>
            <Button variant="contained" disabled={!changedIds.length || busy} onClick={() => void save()}>
              {busy ? "正在保存…" : "保存"}
            </Button>
          </Stack>
        </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {sourceQuery.isPending || assignedQuery.isPending ? (
          <Stack sx={{ alignItems: "center", py: `${tokens.spacing[12]}px` }}><CircularProgress /></Stack>
        ) : sourceQuery.isError || assignedQuery.isError ? (
          <Alert severity="error">藏书或分类关系暂时无法读取，请重试。</Alert>
        ) : sourceQuery.data?.items.length ? (
          <List sx={{ p: 0, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, overflow: "hidden" }}>
            {sourceQuery.data.items.map((book, index) => {
              const selected = selectedIds.has(book.id);
              return (
                <ListItem key={book.id} disablePadding divider={index < sourceQuery.data.items.length - 1}>
                  <ListItemButton role={undefined} onClick={() => toggle(book.id)} disabled={busy} dense>
                    <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple slotProps={{ input: { "aria-label": `${selected ? "移出" : "加入"} ${book.title}` } }} />
                    <BookCover src={book.coverUrl} alt="" sx={{ width: `${tokens.spacing[10]}px`, mr: `${tokens.spacing[3]}px` }} />
                    <ListItemText primary={book.title} secondary={book.author} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        ) : <EmptyState compact title="暂无可添加的书籍" />}
      </Stack>
    </Drawer>
  );
}
