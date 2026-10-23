import { usePermissions } from "../auth/permissions";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PageBackAction, PageContainer, PageHeader } from "../components/PageHeader";
import { ArticleNotes } from "../features/notes/ArticleNotes";
import { NotesFeed } from "../features/notes/NotesFeed";
import { PostEditor, ReadingPosts } from "../features/notes/ReadingPosts";
import { postHref, type PostFilter } from "../features/notes/posts-api";
import { Tabs } from "../ui/antd";
import { Button } from "../ui/buttons";
import { BookNotesContent } from "./AnnotationsPage";

export function ReadingNotesPage({ kind }: { kind: PostFilter }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [writing, setWriting] = useState(params.get("write") === "1");
  const tab = params.get("view") === "posts" ? "posts" : "notes";
  const bookId = params.get("bookId");
  const articleId = params.get("articleId");
  const showSelectedNotes = kind === "ALL" || tab === "notes";
  const selectedBookId = showSelectedNotes && kind !== "ARTICLE" ? bookId : null;
  const selectedArticleId = showSelectedNotes && kind !== "BOOK" && !selectedBookId ? articleId : null;
  const changeTab = (key: string) => setParams(previous => {
    const next = new URLSearchParams(previous); next.delete("bookId"); next.delete("articleId");
    if (key === "posts") next.set("view", "posts"); else next.delete("view");
    return next;
  });
  const clearBookSelection = () => setParams(previous => {
    const next = new URLSearchParams(previous); next.delete("bookId"); return next;
  });
  const openArticle = (id?: string) => setParams(previous => {
    const next = new URLSearchParams(previous); if (id) next.set("articleId", id); else next.delete("articleId"); return next;
  });
  const selectedNotes = selectedBookId ? <BookNotesContent /> : selectedArticleId
    ? <ArticleNotes userId={user?.id ?? "anonymous"} articleId={selectedArticleId} onOpen={openArticle} />
    : <NotesFeed key={kind} kind={kind} />;
  const closeEditor = () => { setWriting(false); if (params.has("write")) setParams(previous => { const next = new URLSearchParams(previous); next.delete("write"); return next; }, { replace: true }); };
  return <PageContainer>
    {selectedBookId && <PageBackAction onClick={clearBookSelection}>返回笔记</PageBackAction>}
    {selectedArticleId && <PageBackAction onClick={() => openArticle()}>返回阅文札记</PageBackAction>}
    <PageHeader eyebrow="READING NOTES" title="读书录" action={can("notes.edit") ? <Button variant="contained" onClick={() => setWriting(true)}>写随笔</Button> : undefined} />
    {kind === "ALL" ? selectedNotes : <Tabs activeKey={tab} onChange={changeTab} items={[
      { key: "notes", label: "札记", children: tab === "notes" ? selectedNotes : null },
      { key: "posts", label: "随笔", children: tab === "posts" ? <ReadingPosts kind={kind} /> : null },
    ]} />}
    {writing && <PostEditor initialKind={kind === "ALL" ? articleId ? "ARTICLE" : "BOOK" : kind} allowKindChange={kind === "ALL" && !bookId && !articleId} initialSourceId={params.get("sourceId") || bookId || articleId || undefined} onClose={closeEditor} onSaved={post => { closeEditor(); navigate(postHref(post)); }} />}
  </PageContainer>;
}
