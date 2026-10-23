import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import { BookCatalogEmptyState } from "../../components/BookCatalogEmptyState";
import { tokens } from "../../theme/generated-tokens";
import { DataTable, Skeleton } from "../../ui/antd";
import { Button } from "../../ui/buttons";
import { Alert } from "../../ui/feedback";
import { Select, TextField } from "../../ui/forms";
import { SearchRounded } from "../../ui/icons";
import { Box, MenuItem, Stack, Typography } from "../../ui/primitives";
import { articleNotesApi, listCompleteBookNotes } from "./api";
import { articles as articleCatalog } from "../content/api";
import { NotesMasonry } from "./NotesMasonry";
import { collectNotes, noteSourceHref, type NoteRecord } from "./note-records";
import { postLabels, type PostFilter } from "./posts-api";
import { PostCard, usePostCollection } from "./ReadingPosts";

export function NotesFeed({ kind }: { kind: PostFilter }) {
  const { user } = useAuth();
  const [, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("ALL");
  const [view, setView] = useState("cards");
  const [sort, setSort] = useState("recent");
  const [tag, setTag] = useState("ALL");
  const books = useQuery({ queryKey: ["notes-feed-books", user?.id], queryFn: listCompleteBookNotes, enabled: Boolean(user) && kind !== "ARTICLE" });
  const articles = useQuery({ queryKey: ["article-notes", user?.id], queryFn: articleNotesApi.list, enabled: Boolean(user) && kind !== "BOOK" });
  const posts = usePostCollection("ALL", kind === "ALL");
  const catalog = useQuery({ queryKey: ["post-source-articles", user?.id], queryFn: articleCatalog.list, enabled: Boolean(user) && kind !== "BOOK" });
  const articleTags = new Map((catalog.data ?? []).map(article => [article.id, article.tags.split(/[,，、;；\n]/u).map(value => value.trim()).filter(Boolean)]));
  const tags = [...new Set([...articleTags.values()].flat())].sort();
  const notes = useMemo(() => collectNotes(kind !== "ARTICLE" ? books.data ?? [] : [], kind !== "BOOK" ? articles.data ?? [] : []), [books.data, articles.data, kind]);
  const allPosts = kind === "ALL" ? posts.data?.pages.flatMap(page => page.items) ?? [] : [];
  const sources = [...new Map([...notes, ...allPosts].map(item => [`${item.kind}:${item.sourceId}`, { title: item.sourceTitle, kind: item.kind }])).entries()];
  const matches = (text: string) => text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const filtered = notes.filter(note => (source === "ALL" || source === `${note.kind}:${note.sourceId}`) && (tag === "ALL" || (note.kind === "ARTICLE" && articleTags.get(note.sourceId)?.includes(tag))) && matches(`${note.sourceTitle} ${note.author} ${note.quote} ${note.note}`))
    .sort((a, b) => sort === "oldest" ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt));
  const postItems = kind === "ALL" ? allPosts.filter(post => (source === "ALL" || source === `${post.kind}:${post.sourceId}`) && (tag === "ALL" || (post.kind === "ARTICLE" && articleTags.get(post.sourceId)?.includes(tag))) && matches(`${post.title} ${post.sourceTitle} ${post.excerpt}`)) : [];
  const openSource = (note: NoteRecord) => setParams(previous => {
    const next = new URLSearchParams(previous); next.set("view", "annotations");
    next.delete("bookId"); next.delete("articleId");
    next.set(note.kind === "BOOK" ? "bookId" : "articleId", note.sourceId); return next;
  });
  const pending = (kind !== "ARTICLE" && books.isPending) || (kind !== "BOOK" && articles.isPending) || (kind === "ALL" && posts.isPending);
  const failed = (kind !== "ARTICLE" && books.isError) || (kind !== "BOOK" && articles.isError) || (kind === "ALL" && posts.isError);
  const items = [
    ...filtered.map(note => ({ key: `${note.kind}:${note.sourceId}:${note.id}`, time: note.updatedAt, content: <NoteCard note={note} onOpen={() => openSource(note)} /> })),
    ...postItems.map(post => ({ key: `post:${post.kind}:${post.id}`, time: post.updatedAt, content: <PostCard post={post} /> })),
  ].sort((a, b) => sort === "oldest" ? a.time.localeCompare(b.time) : b.time.localeCompare(a.time));
  return <>
    <Box component="section" aria-label="笔记搜索与筛选" sx={{ mb: `${tokens.spacing[6]}px` }}>
      <Typography component="div" variant="body2" sx={{ mb: `${tokens.spacing[2]}px` }}>搜索笔记</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `minmax(0, 2fr) repeat(${tags.length > 0 ? 4 : 3}, minmax(0, 1fr))` }, alignItems: "center", gap: `${tokens.spacing[3]}px` }}>
      <TextField aria-label="搜索笔记" placeholder="来源、摘录或笔记" value={search} onChange={event => setSearch(event.target.value)} slotProps={{ input: { startAdornment: <SearchRounded fontSize="small" /> } }} sx={{ minWidth: 0, width: "100%", gridColumn: { xs: "1 / -1", md: "auto" } }} />
      <Select label="笔记来源" aria-label="笔记来源" value={source} onChange={event => setSource(event.target.value)} sx={{ minWidth: 0, width: "100%", gridColumn: { xs: "1 / -1", md: "auto" } }}>
        <MenuItem value="ALL">全部来源</MenuItem>{sources.map(([id, item]) => <MenuItem key={id} value={id}>{kind === "ALL" ? `${postLabels[item.kind]} · ` : ""}{item.title}</MenuItem>)}
      </Select>
      {tags.length > 0 && <Select label="文章标签" value={tag} onChange={event => setTag(event.target.value)} sx={{ minWidth: 0, width: "100%", gridColumn: { xs: "1 / -1", md: "auto" } }}><MenuItem value="ALL">全部标签</MenuItem>{tags.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select>}
      <Select label="笔记排序" aria-label="笔记排序" sx={{ minWidth: 0, width: "100%" }} value={sort} onChange={event => setSort(event.target.value)}><MenuItem value="recent">最近记录</MenuItem><MenuItem value="oldest">最早记录</MenuItem></Select>
      <Select label="展示方式" aria-label="展示方式" sx={{ minWidth: 0, width: "100%" }} value={view} onChange={event => setView(event.target.value)}><MenuItem value="cards">卡片</MenuItem><MenuItem value="table">表格</MenuItem></Select>
      </Box>
    </Box>
    {pending ? <Box role="status" aria-label={kind === "ARTICLE" ? "正在加载阅文札记" : "正在加载阅读札记"}><Skeleton active /></Box> : failed ? <Stack spacing={2}><Alert severity="error">无法加载阅读札记</Alert><Button onClick={() => { if (kind !== "ARTICLE") void books.refetch(); if (kind !== "BOOK") void articles.refetch(); if (kind === "ALL") void posts.refetch(); }}>重试</Button></Stack>
      : !items.length ? <BookCatalogEmptyState title="暂无阅读札记" />
        : view === "table" ? <>
          <DataTable<NoteRecord> key={`${kind}:${search}:${source}:${tag}:${sort}`} aria-label="阅读札记表格" rowKey={note => `${note.kind}:${note.sourceId}:${note.id}`} dataSource={filtered} scroll={{ x: tokens.layout.annotationCardMinWidth * 2 }} columns={[
            { title: "来源", key: "source", width: tokens.spacing[24] * 2, render: (_, note) => <Button onClick={() => openSource(note)}>{note.sourceTitle}</Button> },
            { title: "摘录", dataIndex: "quote", ellipsis: true }, { title: "笔记", dataIndex: "note", ellipsis: true },
            { title: "日期", dataIndex: "updatedAt", width: tokens.spacing[24], render: value => new Date(value).toLocaleDateString("zh-CN") },
            { title: "原文", key: "location", width: tokens.spacing[24], render: (_, note) => <Button component={Link} to={noteSourceHref(note)}>原文</Button> },
          ]} />
          {postItems.length > 0 && <Box sx={{ mt: `${tokens.spacing[6]}px` }}><NotesMasonry label="随笔" items={items.filter(item => item.key.startsWith("post:"))} /></Box>}
        </> : <NotesMasonry label="阅读札记卡片" items={items} />}
    {kind === "ALL" && posts.hasNextPage && <Button disabled={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>更多随笔</Button>}
  </>;
}

function NoteCard({ note, onOpen }: { note: NoteRecord; onOpen: () => void }) {
  return <Box component="article" aria-label={`${note.sourceTitle}的笔记`} sx={{ p: `${tokens.spacing[5]}px`, bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: `${tokens.radius.md}px`, overflowWrap: "anywhere", minWidth: 0 }}>
    <Typography variant="caption" color="primary.main">{postLabels[note.kind]} · {note.note ? "阅读札记" : "摘录"}</Typography>
    <Typography component="h2" variant="h5" sx={{ mt: `${tokens.spacing[2]}px`, mb: `${tokens.spacing[4]}px` }}><Box component="button" type="button" onClick={onOpen} sx={{ appearance: "none", border: 0, bgcolor: "transparent", p: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }} aria-label={`查看《${note.sourceTitle}》的${note.kind === "BOOK" ? "阅读札记" : "阅文札记"}`}>{note.sourceTitle}</Box></Typography>
    {note.quote && <Typography component="blockquote" sx={{ m: 0, pl: `${tokens.spacing[3]}px`, borderLeft: "2px solid var(--color-primary)", color: "text.secondary", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}>{note.quote}</Typography>}
    {note.note && <Typography sx={{ mt: `${tokens.spacing[4]}px`, whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 10, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{note.note}</Typography>}
    <Typography component="time" variant="caption" color="text.secondary" dateTime={note.updatedAt} sx={{ display: "block", mt: `${tokens.spacing[5]}px` }}>{new Date(note.updatedAt).toLocaleDateString("zh-CN")}</Typography>
  </Box>;
}
