import { usePermissions } from "../auth/permissions";
// 文章列表、导入和校对抽屉共享刷新流程，管理动作由角色与服务端共同约束。
// Article listing/import/review share refresh flows, with management actions constrained by roles and the server.
import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CatalogFilters } from "../components/CatalogFilters";
import {
  _AntAlert as Alert,
  Input,
  _AntSwitch as Switch,
} from "../ui/antd";
import { useConfirmation } from "../ui/confirmations";
import { ActionToolbar, PageContainer, PageHeader } from "../components/PageHeader";
import { CatalogSection } from "../components/CatalogSection";
import { BookCatalogEmptyState } from "../components/BookCatalogEmptyState";
import { BookGridSkeleton } from "../components/BookGridSkeleton";
import { BookCardPresentation } from "../components/BookCardPresentation";
import { articleGridSx } from "../components/bookGrid";
import { Drawer } from "../ui/overlays";
import { Button } from "../ui/buttons";
import { TextField } from "../ui/forms";
import { Box } from "../ui/primitives";
import { tokens } from "../theme/generated-tokens";
import { articles, type ArticleSummary, type Draft } from "../features/content/api";
import { RequestErrorPage } from "./HttpErrorPage";
import { ArticleCoverField } from "../features/content/ArticleCoverField";
import { ArticleBodyEditor } from "../features/content/ArticleBodyEditor";
import { readArticleImage } from "../features/content/imageImport";
import { articleHtmlToMarkdown, articleMarkdownToHtml } from "../features/content/article-markdown";
import "../features/content/content.css";
const AddToArticleCollectionDialog = lazy(() => import("../features/article-collections/AddToArticleCollectionDialog").then(module => ({ default: module.AddToArticleCollectionDialog })));
const articleCollator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const articleTags = (tags: string) => tags.split(/[,，、;；\n]/).map(tag => tag.trim()).filter(Boolean);
const blank = (): Draft => ({
  title: "",
  author: "",
  sourceUrl: "",
  publishedAt: "",
  visibility: "PUBLIC",
  tags: "",
  html: "",
  coverUrl: "",
});
export function ArticlesPage() {
  const modal = useConfirmation();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const refreshCollections = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["article-collections"] }),
    queryClient.invalidateQueries({ queryKey: ["article-collection"] }),
  ]);
  const manager = can("articles.edit");
  const [collectionArticle, setCollectionArticle] = useState<ArticleSummary | null>(null);
  const [items, setItems] = useState<ArticleSummary[]>([]),
    [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const tag = params.get("tag") ?? "ALL";
  const sort = params.get("sort") ?? "recent";
  const updateFilter = (key: string, value: string, defaultValue: string) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value === defaultValue) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  };
  const [loadFailure, setLoadFailure] = useState<unknown>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null),
    [editId, setEditId] = useState<string>(),
    [preview, setPreview] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [bodyDirty, setBodyDirty] = useState(false);
  const tags = [...new Set(items.flatMap(item => articleTags(item.tags)))].sort(articleCollator.compare);
  const filteredItems = items.filter(item => tag === "ALL" || (tag === "UNTAGGED" ? articleTags(item.tags).length === 0 : articleTags(item.tags).includes(tag)))
    .sort((a, b) => {
      if (sort === "title") return articleCollator.compare(a.title, b.title);
      if (sort === "author") return articleCollator.compare(a.author, b.author) || articleCollator.compare(a.title, b.title);
      return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
    });
  const load = () => {
    setLoading(true);
    return articles
      .list()
      .then(result => { setItems(result); setLoadFailure(null); })
      .catch((e: unknown) => setLoadFailure(e))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void load();
  }, []);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };
  const open = (value: Draft, id?: string) => {
    setError("");
    setDraft(value);
    setEditId(id);
    setMarkdown(articleHtmlToMarkdown(value.html));
    setBodyDirty(false);
    setPreview(false);
  };
  const prepareBody = async (html: string, sourceUrl: string) => {
    const document = new DOMParser().parseFromString(html, "text/html");
    const needsDownload = Array.from(document.images).some(image =>
      !/^\/api\/v1\/articles\/assets\/[0-9a-f-]{36}$/iu.test(image.getAttribute("src") || ""));
    return needsDownload ? (await articles.prepare(html, sourceUrl)).html : html;
  };
  const changePreview = (next: boolean) => {
    if (!draft || busy || next === preview) return;
    if (!next) { setPreview(false); return; }
    void run(async () => {
      const sourceHtml = bodyDirty ? articleMarkdownToHtml(markdown) : draft.html;
      const html = await prepareBody(sourceHtml, draft.sourceUrl);
      setDraft(previous => previous ? { ...previous, html } : previous);
      if (html !== sourceHtml) setMarkdown(articleHtmlToMarkdown(html));
      setBodyDirty(false);
      setPreview(true);
    });
  };
  const importBodyImages = async (files: File[]) => {
    let inserted: string | undefined;
    await run(async () => {
      if (!draft) return;
      const current = new DOMParser().parseFromString(bodyDirty ? articleMarkdownToHtml(markdown) : draft.html, "text/html");
      if (current.images.length + files.length > 40) throw new Error("每篇文章最多支持 40 张正文图片。");
      const images = await Promise.all(files.map(readArticleImage));
      const container = document.createElement("div");
      for (const image of images) {
        const node = document.createElement("img");
        node.src = image.src; node.alt = image.alt;
        container.append(node);
      }
      const html = await prepareBody(container.innerHTML, draft.sourceUrl);
      if (new DOMParser().parseFromString(html, "text/html").images.length !== images.length) throw new Error("图片未能导入，请检查图片后重试。");
      inserted = articleHtmlToMarkdown(html);
    });
    return inserted;
  };
  if (loadFailure !== null) return <RequestErrorPage error={loadFailure} retrying={loading} onRetry={() => { void load(); }} />;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="ARTICLES"
        title="撷文斋"
      />
      <div className="bk-content-stack bk-articles-content">
        {error && (
          <Alert
            type="error"
            title={error}
            closable
            onClose={() => setError("")}
          />
        )}
        <CatalogSection
          title="全部文章"
          tools={
            <CatalogFilters
              actions={manager ? <Button variant="contained" onClick={() => { setError(""); setCaptureOpen(true); }} sx={{ whiteSpace: "nowrap" }}>新增文章</Button> : undefined}
              filter={{ label: "标签", value: tag, onChange: value => updateFilter("tag", value, "ALL"), options: [
                { value: "ALL", label: "全部标签" }, { value: "UNTAGGED", label: "未分类" },
                ...tags.map(value => ({ value, label: value })),
              ] }}
              sort={{ label: "排序", value: sort, onChange: value => updateFilter("sort", value, "recent"), options: [
                { value: "recent", label: "最近收藏" }, { value: "title", label: "按标题" }, { value: "author", label: "按作者" },
              ] }}
            />
          }
        >
          {loading ? (
            <BookGridSkeleton label="正在加载文章" variant="article" count={6} />
          ) : filteredItems.length === 0 ? (
            <BookCatalogEmptyState
              title={tag !== "ALL" ? "没有找到匹配的文章" : "暂无收藏文章"}
              action={tag !== "ALL" ? <Button onClick={() => updateFilter("tag", "ALL", "ALL")}>清除筛选</Button> : undefined}
            />
          ) : (
            <Box component="section" aria-label="文章列表" sx={articleGridSx}>
              {filteredItems.map((article) => (
                <BookCardPresentation
                  key={article.id}
                  variant="article"
                  href={`/articles/${article.id}`}
                  book={{
                    id: article.id,
                    title: article.title,
                    author: article.author,
                    coverUrl: article.cover_url || undefined,
                  }}
                  status={article.visibility === "PUBLIC" ? "公开" : "私有"}
                  actions={[
                    ...(can("articles.collections.edit") ? [{ label: "加入合集", onClick: () => setCollectionArticle(article) }] : []),
                    ...(manager ? [
                    {
                      label: "编辑文章",
                      onClick: () => void run(async () => {
                        const a = await articles.get(article.id);
                        open({ title: a.title, author: a.author, sourceUrl: a.source_url, publishedAt: a.published_at, visibility: a.visibility, tags: a.tags, html: a.html, coverUrl: a.cover_url || "" }, a.id);
                      }),
                    },
                    {
                      label: "删除文章",
                      danger: true,
                      onClick: () => modal.confirm({
                        title: "删除这篇文章？",
                        content: "文章阅读记录及笔记也会删除。",
                        okText: "删除",
                        cancelText: "取消",
                        okButtonProps: { danger: true },
                        onOk: () => run(async () => { await articles.remove(article.id); await refreshCollections(); await load(); }),
                      }),
                    },
                    ] : []),
                  ]}
                />
              ))}
            </Box>
          )}
        </CatalogSection>
      </div>
      <Drawer
        anchor="right"
        slotProps={{ paper: { sx: { width: `min(100vw, ${tokens.layout.touchTarget * 16}px)` } } }}
        title="新增文章"
        open={captureOpen}
        destroyOnHidden
        onClose={() => !busy && setCaptureOpen(false)}
        footer={
          <ActionToolbar>
            <Button onClick={() => { setCaptureOpen(false); open(blank()); }} disabled={busy}>手动导入</Button>
            <Button onClick={() => setCaptureOpen(false)} disabled={busy}>取消</Button>
            <Button type="submit" form="article-capture-form" variant="contained" loading={busy}>抓取预览</Button>
          </ActionToolbar>
        }
      >
        <form
          id="article-capture-form"
          className="bk-article-editor-form bk-content-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const captured = await articles.fetch(url.trim());
              setCaptureOpen(false);
              open(captured);
            });
          }}
        >
          {error && <Alert type="error" title={error} />}
          <label htmlFor="article-capture-url">网页链接</label>
          <Input
            id="article-capture-url"
            type="url"
            required
            pattern="https://.*"
            autoFocus
            placeholder="微信公众号或普通公开网页 HTTPS 链接"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </form>
      </Drawer>
      <Drawer
        anchor="right"
        slotProps={{ paper: { sx: { width: `min(100vw, ${tokens.layout.touchTarget * 16}px)` } } }}
        title={editId ? "编辑文章" : "导入文章"}
        open={draft !== null}
        destroyOnHidden
        onClose={() => !busy && setDraft(null)}
        footer={
          <ActionToolbar>
            <Button
              variant="contained"
              aria-label="保存"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!draft) return;
                  const html = preview || !bodyDirty ? draft.html : await prepareBody(articleMarkdownToHtml(markdown), draft.sourceUrl);
                  await articles.save(
                    {
                      ...draft,
                      html,
                    },
                    editId,
                  );
                  await refreshCollections();
                  setDraft(null);
                  await load();
                })
              }
            >
              保存
            </Button>
          </ActionToolbar>
        }
      >
        {draft && (
          <div className="bk-article-editor-form bk-content-stack">
            {error && <Alert type="error" title={error} />}
            <TextField fullWidth disabled={busy} label="文章标题"
              aria-label="文章标题"
              placeholder="文章标题"
              maxLength={300}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <TextField fullWidth disabled={busy} label="作者"
              aria-label="作者"
              placeholder="作者"
              value={draft.author}
              maxLength={300}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
            />
            <TextField fullWidth disabled={busy} label="分类 / 标签"
              aria-label="标签"
              placeholder="分类 / 标签，以逗号分隔"
              value={draft.tags}
              maxLength={1000}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            />
            <TextField fullWidth disabled={busy} label="来源链接（可选）"
              aria-label="来源链接"
              placeholder="来源链接（可选）"
              value={draft.sourceUrl}
              onChange={(e) =>
                setDraft({ ...draft, sourceUrl: e.target.value })
              }
            />
            <TextField fullWidth disabled={busy} label="发布时间（可选）"
              aria-label="发布时间"
              placeholder="原文发布时间（可选）"
              value={draft.publishedAt}
              maxLength={100}
              onChange={(e) =>
                setDraft({ ...draft, publishedAt: e.target.value })
              }
            />
            <label>
              公开文章{" "}
              <Switch
                disabled={busy}
                checked={draft.visibility === "PUBLIC"}
                onChange={(checked) =>
                  setDraft({
                    ...draft,
                    visibility: checked ? "PUBLIC" : "PRIVATE",
                  })
                }
              />
            </label>
            <ArticleCoverField
              value={draft.coverUrl}
              disabled={busy}
              readOnly={preview}
              onImport={file => run(async () => {
                const image = await readArticleImage(file);
                setDraft(previous => previous ? { ...previous, coverUrl: image.src } : previous);
              })}
              onRemove={() => setDraft(previous => previous ? { ...previous, coverUrl: "" } : previous)}
            />
            <ArticleBodyEditor
              markdown={markdown}
              onChange={value => { setMarkdown(value); setBodyDirty(true); }}
              html={draft.html}
              preview={preview}
              disabled={busy}
              onPreviewChange={changePreview}
              onImportImages={importBodyImages}
            />
          </div>
        )}
      </Drawer>
      {collectionArticle && <Suspense fallback={null}><AddToArticleCollectionDialog open articleId={collectionArticle.id} articleTitle={collectionArticle.title} articleVisibility={collectionArticle.visibility} onClose={() => setCollectionArticle(null)} /></Suspense>}
    </PageContainer>
  );
}
