import { AddRounded } from "@/ui/icons";
import { ArrowDownwardRounded } from "@/ui/icons";
import { ArrowUpwardRounded } from "@/ui/icons";
import { DeleteOutlineRounded } from "@/ui/icons";
import { EditOutlined } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Dialog } from "@/ui/overlays";
import { DialogActions } from "@/ui/overlays";
import { DialogContent } from "@/ui/overlays";
import { DialogTitle } from "@/ui/overlays";
import { IconButton } from "@/ui/buttons";
import { List } from "@/ui/primitives";
import { ListItem } from "@/ui/primitives";
import { ListItemText } from "@/ui/primitives";
import { Snackbar } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { TextField } from "@/ui/forms";
import { Tooltip } from "@/ui/feedback";
import { Typography } from "@/ui/primitives";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { CategorySummary } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function CategoryManagementDialog({ open, categories, onClose }: {
  open: boolean;
  categories: CategorySummary[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [ordered, setOrdered] = useState<CategorySummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CategorySummary | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrdered(categories);
  }, [categories, open]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
  };

  const edit = (category: CategorySummary) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description ?? "");
  };

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (editingId) await api.updateCategory(editingId, { name, description });
      else await api.createCategory({ name, description });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNotice(editingId ? "分类已更新" : "分类已创建");
      resetForm();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= ordered.length || busy) return;
    const previous = ordered;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    setOrdered(next);
    setBusy(true);
    try {
      const result = await api.reorderCategories(next.map((category) => category.id));
      setOrdered(result.items);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      setOrdered(previous);
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNotice("分类已删除；书籍和 NAS 文件未受影响");
      if (editingId === deleteTarget.id) resetForm();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
        <DialogTitle>管理分类</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: `${tokens.spacing[6]}px` }}>分类独立于文件标签；调整或删除分类不会改写原书，也不会删除 NAS 文件。</Alert>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.18fr) minmax(280px, .82fr)" }, gap: `${tokens.spacing[8]}px` }}>
            <Box>
              <Typography variant="h5" sx={{ mb: `${tokens.spacing[3]}px` }}>当前顺序</Typography>
              {ordered.length ? (
                <List sx={{ p: 0, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, overflow: "hidden" }}>
                  {ordered.map((category, index) => (
                    <ListItem key={category.id} divider={index < ordered.length - 1} sx={{ px: `${tokens.spacing[3]}px` }}>
                      <ListItemText primary={category.name} secondary={`${category.bookCount} 本 · ${category.description || "暂无简介"}`} />
                      <Tooltip title="上移"><span><IconButton size="small" disabled={index === 0 || busy} onClick={() => void move(index, -1)} aria-label={`上移 ${category.name}`}><ArrowUpwardRounded fontSize="small" /></IconButton></span></Tooltip>
                      <Tooltip title="下移"><span><IconButton size="small" disabled={index === ordered.length - 1 || busy} onClick={() => void move(index, 1)} aria-label={`下移 ${category.name}`}><ArrowDownwardRounded fontSize="small" /></IconButton></span></Tooltip>
                      <Tooltip title="编辑"><IconButton size="small" onClick={() => edit(category)} aria-label={`编辑 ${category.name}`}><EditOutlined fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => setDeleteTarget(category)} aria-label={`删除 ${category.name}`}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>
                    </ListItem>
                  ))}
                </List>
              ) : <Alert severity="info">还没有分类，请从右侧创建第一个分类。</Alert>}
            </Box>
            <Stack sx={{ gap: `${tokens.spacing[4]}px` }}>
              <Typography variant="h5">{editingId ? "编辑分类" : "新建分类"}</Typography>
              <TextField autoFocus label="分类名称" value={name} onChange={(event: any) => setName(event.target.value)} slotProps={{ htmlInput: { maxLength: 160 } }} />
              <TextField label="简介" value={description} onChange={(event: any) => setDescription(event.target.value)} multiline minRows={4} slotProps={{ htmlInput: { maxLength: 2000 } }} />
              <Button variant="contained" startIcon={editingId ? <EditOutlined /> : <AddRounded />} disabled={!name.trim() || busy} onClick={() => void save()}>{editingId ? "保存修改" : "创建分类"}</Button>
              {editingId ? <Button onClick={resetForm}>取消编辑</Button> : null}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={onClose} disabled={busy}>完成</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={busy ? undefined : () => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除“{deleteTarget?.name}”？</DialogTitle>
        <DialogContent>
          <Typography>这里只会解除分类关系。分类中的书籍、标签和 NAS 原文件都会保留。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>取消</Button>
          <Button color="error" variant="contained" onClick={() => void remove()} disabled={busy}>删除分类</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={4200} onClose={() => setNotice("")} message={notice} />
    </>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试";
}
