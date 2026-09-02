import { DeleteOutlineRounded } from "@/ui/icons";
import { Alert } from "@/ui";
import { Button } from "@/ui";
import { Dialog } from "@/ui";
import { DialogActions } from "@/ui";
import { DialogContent } from "@/ui";
import { DialogTitle } from "@/ui";
import { FormControl } from "@/ui";
import { InputLabel } from "@/ui";
import { MenuItem } from "@/ui";
import { Select } from "@/ui";
import { Stack } from "@/ui";
import { TextField } from "@/ui";
import { Typography } from "@/ui";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { BooklistDetail, BooklistKind, BooklistVisibility } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function BooklistFormDialog({ open, initial, canCreateOfficial, onClose, onSaved, onDeleted }: {
  open: boolean;
  initial?: BooklistDetail | null;
  canCreateOfficial: boolean;
  onClose: () => void;
  onSaved: (booklist: BooklistDetail, message: string) => void;
  onDeleted?: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<BooklistKind>("PERSONAL");
  const [visibility, setVisibility] = useState<BooklistVisibility>("PRIVATE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setKind(initial?.kind ?? "PERSONAL");
    setVisibility(initial?.visibility ?? "PRIVATE");
    setError("");
    setConfirmDelete(false);
  }, [initial, open]);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = initial
        ? await api.updateBooklist(initial.id, { title, description, visibility, revision: initial.revision })
        : await api.createBooklist({ title, description, kind, visibility });
      onSaved(result, initial ? "书单资料已更新" : "书单已创建");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial || !onDeleted) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteBooklist(initial.id, initial.revision);
      onDeleted("书单已删除；书籍和 NAS 文件未受影响");
    } catch (reason) {
      setError(errorMessage(reason));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open && !confirmDelete} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
        <DialogTitle>{initial ? "编辑书单" : "新建书单"}</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: `${tokens.spacing[5]}px`, pt: `${tokens.spacing[2]}px` }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField autoFocus label="书单名称" value={title} onChange={(event: any) => setTitle(event.target.value)} slotProps={{ htmlInput: { maxLength: 240 } }} />
            <TextField label="书单说明" value={description} onChange={(event: any) => setDescription(event.target.value)} multiline minRows={4} slotProps={{ htmlInput: { maxLength: 4000 } }} />
            {!initial && canCreateOfficial ? (
              <FormControl>
                <InputLabel id="booklist-kind-label">书单类型</InputLabel>
                <Select labelId="booklist-kind-label" label="书单类型" value={kind} onChange={(event: any) => setKind(event.target.value as BooklistKind)}>
                  <MenuItem value="PERSONAL">个人书单</MenuItem>
                  <MenuItem value="OFFICIAL">官方书单</MenuItem>
                </Select>
              </FormControl>
            ) : null}
            <FormControl>
              <InputLabel id="booklist-visibility-label">谁可以看</InputLabel>
              <Select labelId="booklist-visibility-label" label="谁可以看" value={visibility} onChange={(event: any) => setVisibility(event.target.value as BooklistVisibility)}>
                <MenuItem value="PRIVATE">仅自己</MenuItem>
                <MenuItem value="MEMBERS">家庭成员</MenuItem>
                <MenuItem value="PUBLIC">任何访客</MenuItem>
              </Select>
            </FormControl>
            {visibility === "PUBLIC" ? <Alert severity="info">公开书单只能包含已经进入公共书目池的书籍。</Alert> : null}
            {initial && onDeleted ? <Button color="error" startIcon={<DeleteOutlineRounded />} onClick={() => setConfirmDelete(true)} sx={{ alignSelf: "flex-start" }}>删除书单</Button> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>取消</Button>
          <Button variant="contained" onClick={() => void save()} disabled={!title.trim() || busy}>{initial ? "保存" : "创建书单"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open && confirmDelete} onClose={busy ? undefined : () => setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle>删除“{initial?.title}”？</DialogTitle>
        <DialogContent>
          {error ? <Alert severity="error" sx={{ mb: `${tokens.spacing[4]}px` }}>{error}</Alert> : null}
          <Typography>这里只会删除书单和排序关系。书籍、阅读记录和 NAS 原文件都会保留。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)} disabled={busy}>取消</Button>
          <Button color="error" variant="contained" onClick={() => void remove()} disabled={busy}>删除书单</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试";
}
