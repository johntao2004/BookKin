import { AddRounded } from "@/ui/icons";
import { LibraryAddOutlined } from "@/ui/icons";
import { Alert } from "@/ui";
import { Box } from "@/ui";
import { Button } from "@/ui";
import { CircularProgress } from "@/ui";
import { Dialog } from "@/ui";
import { DialogActions } from "@/ui";
import { DialogContent } from "@/ui";
import { DialogTitle } from "@/ui";
import { List } from "@/ui";
import { ListItem } from "@/ui";
import { ListItemText } from "@/ui";
import { Stack } from "@/ui";
import { Typography } from "@/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { BooklistDetail } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { VisibilityChip } from "./CatalogDiscoveryCards";
import { BooklistFormDialog } from "./BooklistFormDialog";

export function AddToBooklistDialog({ open, bookId, bookTitle, onClose, onCompleted }: {
  open: boolean;
  bookId: string;
  bookTitle: string;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const listsQuery = useQuery({
    queryKey: ["booklists", "mine", bookId],
    queryFn: () => api.listBooklists(),
    enabled: open,
  });
  const personalLists = listsQuery.data?.items.filter((list) => list.kind === "PERSONAL" && list.ownedByViewer) ?? [];

  const add = async (booklist: BooklistDetail) => {
    setBusyId(booklist.id);
    setError("");
    try {
      await api.addBooklistBooks(booklist.id, [bookId], booklist.revision);
      await queryClient.invalidateQueries({ queryKey: ["booklists"] });
      onCompleted(`已将《${bookTitle}》加入“${booklist.title}”`);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加入书单失败");
    } finally {
      setBusyId(null);
    }
  };

  const created = async (booklist: BooklistDetail, _message: string) => {
    setCreateOpen(false);
    await add(booklist);
  };

  return (
    <>
      <Dialog open={open && !createOpen} onClose={busyId ? undefined : onClose} fullWidth maxWidth="sm">
        <DialogTitle>将《{bookTitle}》加入书单</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: `${tokens.spacing[4]}px` }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {listsQuery.isPending ? (
              <Stack sx={{ alignItems: "center", py: `${tokens.spacing[8]}px` }}><CircularProgress /></Stack>
            ) : listsQuery.isError ? (
              <Alert severity="error">个人书单暂时无法读取，请重试。</Alert>
            ) : personalLists.length ? (
              <List sx={{ p: 0, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.lg}px`, overflow: "hidden" }}>
                {personalLists.map((booklist, index) => (
                  <ListItem key={booklist.id} divider={index < personalLists.length - 1} secondaryAction={
                    <Button size="small" startIcon={<LibraryAddOutlined />} disabled={Boolean(busyId)} onClick={() => void add(booklist)}>
                      加入
                    </Button>
                  }>
                    <ListItemText primary={booklist.title} secondary={<Stack component="span" direction="row" sx={{ alignItems: "center", gap: `${tokens.spacing[2]}px`, mt: `${tokens.spacing[1]}px` }}><VisibilityChip visibility={booklist.visibility} /><Typography component="span" variant="caption" color="text.secondary">{booklist.bookCount} 本</Typography></Stack>} />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: "center", py: `${tokens.spacing[8]}px` }}>
                <Typography variant="h5">还没有个人书单</Typography>
                <Typography color="text.secondary" sx={{ mt: `${tokens.spacing[2]}px` }}>先创建一个，再把这本书收进去。</Typography>
              </Box>
            )}
            <Button variant={personalLists.length ? "outlined" : "contained"} startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>新建个人书单</Button>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={onClose} disabled={Boolean(busyId)}>取消</Button></DialogActions>
      </Dialog>
      <BooklistFormDialog
        open={open && createOpen}
        canCreateOfficial={false}
        onClose={() => setCreateOpen(false)}
        onSaved={(booklist, message) => void created(booklist, message)}
      />
    </>
  );
}
