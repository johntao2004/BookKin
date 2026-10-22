import { usePermissions } from "../../auth/permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { tokens } from "../../theme/generated-tokens";
import { Skeleton } from "../../ui/antd";
import { Button } from "../../ui/buttons";
import { Alert, Chip } from "../../ui/feedback";
import { Box, Stack, Typography } from "../../ui/primitives";
import { bookReviews, type BookReview, type ReviewDraft } from "./api";
import { PostEditor } from "../notes/ReadingPosts";
import type { ReadingPost } from "../notes/posts-api";
import { reviewMarkdownToHtml } from "./markdown";
import "../content/content.css";

export function BookReviewsPanel({ bookId, bookTitle = "书籍" }: { bookId: string; bookTitle?: string }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const headingId = useId();
  const queryKey = ["book-reviews", user?.id, bookId];
  const query = useQuery({ queryKey, queryFn: () => bookReviews.list(bookId), enabled: can("notes.view") });
  const [editor, setEditor] = useState<{ saved?: BookReview } | null>(null);
  const [notice, setNotice] = useState("");
  const open = (saved?: BookReview) => { setEditor({ saved }); setNotice(""); };
  const asPost = (review: BookReview): ReadingPost => ({ ...review, kind: "BOOK", sourceId: review.bookId, sourceTitle: bookTitle, excerpt: review.markdown.slice(0, 240) });
  const persist = async (draft: ReviewDraft) => {
    const saved = editor?.saved ? await bookReviews.update(editor.saved.id, draft, editor.saved.revision) : await bookReviews.create(bookId, draft);
    queryClient.setQueryData<BookReview[]>(queryKey, current => [saved, ...(current ?? []).filter(item => item.id !== saved.id)]);
    return asPost(saved);
  };

  if (!user || !can("notes.view")) return null;
  return <Box component="section" aria-labelledby={headingId} sx={{ mt: `${tokens.spacing[10]}px`, pt: `${tokens.spacing[6]}px`, borderTop: 1, borderColor: "divider" }}>
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: `${tokens.spacing[3]}px`, mb: `${tokens.spacing[5]}px` }}>
      <Typography id={headingId} variant="h4" component="h2">博文</Typography>
      {can("notes.edit") && <Button variant="outlined" onClick={() => open()}>写博文</Button>}
    </Stack>
    {notice && <Typography role="status" color="text.secondary" sx={{ mb: `${tokens.spacing[3]}px` }}>{notice}</Typography>}
    {query.isPending ? <Skeleton active /> : query.isError ? <Stack spacing={2} sx={{ alignItems: "flex-start" }}><Alert severity="error">无法加载博文</Alert><Button onClick={() => void query.refetch()}>重试</Button></Stack>
      : !query.data?.length ? <Typography color="text.secondary">暂无博文</Typography>
        : <Stack spacing={3}>{query.data.map(review => <Box component="article" key={review.id} sx={{ p: { xs: `${tokens.spacing[4]}px`, md: `${tokens.spacing[6]}px` }, border: 1, borderColor: "divider", borderRadius: `${tokens.radius.md}px`, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: `${tokens.spacing[3]}px` }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="h3" sx={{ overflowWrap: "anywhere" }}>{review.title}</Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", gap: `${tokens.spacing[2]}px`, mt: `${tokens.spacing[2]}px` }}>
                <Typography variant="caption" color="text.secondary">{review.authorName} · {new Date(review.updatedAt).toLocaleDateString("zh-CN")}</Typography>
                <Chip size="small" variant="outlined" label={review.visibility === "PRIVATE" ? "仅自己" : "书库共享"} />
              </Stack>
            </Box>
            {review.userId === user.id && can("notes.edit") && <Button variant="outlined" aria-label={`编辑博文：${review.title}`} onClick={() => open(review)}>编辑</Button>}
          </Stack>
          <Box className="bk-content-prose bk-markdown-prose bk-article-markdown-preview" sx={{ maxWidth: `${tokens.layout.readingMax}px` }} dangerouslySetInnerHTML={{ __html: reviewMarkdownToHtml(review.markdown) }} />
        </Box>)}</Stack>}
    {editor && <PostEditor initialKind="BOOK" initialSourceId={bookId} sourceTitle={bookTitle} saved={editor.saved ? asPost(editor.saved) : undefined}
      persist={draft => persist({ title: draft.title, markdown: draft.markdown, visibility: draft.visibility })}
      onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("已保存"); void queryClient.invalidateQueries({ queryKey }); }} />}

  </Box>;
}
