// 文章列表、导入和校对抽屉共享刷新流程，管理动作由角色与服务端共同约束。
// Article listing/import/review share refresh flows, with management actions constrained by roles and the server.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  _AntButton as Button,
  _AntAlert as Alert,
  _AntCard as Card,
  _AntModal as Modal,
  Input,
  Tag,
  Empty,
  Skeleton,
  _AntSwitch as Switch,
} from "../ui/antd";
import { ActionToolbar, PageContainer, PageHeader } from "../components/PageHeader";
import { Drawer } from "../ui/overlays";
import { tokens } from "../theme/generated-tokens";
import { useAuth } from "../auth/AuthContext";
import { articles, type Article, type Draft } from "../features/content/api";
import { ArticleFileImport } from "../features/content/ArticleFileImport";
import { readArticleImage } from "../features/content/imageImport";
import { importArticle, safeHtml } from "../features/content/import";
import "../features/content/content.css";
const blank = (): Draft => ({
  title: "",
  author: "",
  sourceUrl: "",
  publishedAt: "",
  visibility: "PUBLIC",
  tags: "",
  html: "",
});
export function ArticlesPage() {
  const { user } = useAuth();
  const manager = user?.role === "OWNER" || user?.role === "ADMIN";
  const [items, setItems] = useState<Article[]>([]),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null),
    [editId, setEditId] = useState<string>(),
    [preview, setPreview] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const [initialHtml, setInitialHtml] = useState("");
  const load = () =>
    articles
      .list()
      .then(setItems)
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false));
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
    setDraft(value);
    setEditId(id);
    setInitialHtml(safeHtml(value.html));
    setPreview(false);
  };
  return (
    <PageContainer>
      <PageHeader
        eyebrow="ARTICLES"
        title="文章收藏"
        action={
          manager ? (
            <Button type="primary" onClick={() => open(blank())}>
              手动导入
            </Button>
          ) : undefined
        }
      />
      <div className="bk-content-stack">
        {error && (
          <Alert
            type="error"
            title={error}
            closable
            onClose={() => setError("")}
          />
        )}
        {manager && (
          <div className="bk-content-tools">
            <Input
              aria-label="网页链接"
              placeholder="微信公众号或普通公开网页 HTTPS 链接"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button
              loading={busy}
              onClick={() =>
                void run(async () => open(await articles.fetch(url)))
              }
            >
              抓取并预览
            </Button>
          </div>
        )}
        <Input.Search
          aria-label="搜索文章"
          placeholder="搜索标题、作者、标签"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading ? (
          <Skeleton active />
        ) : items.length === 0 ? (
          <Empty description="暂无收藏文章" />
        ) : (
          items
            .filter((x) =>
              `${x.title} ${x.author} ${x.tags}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((x) => (
              <Card
                key={x.id}
                title={<Link to={`/articles/${x.id}`}>{x.title}</Link>}
                extra={<Tag>{x.visibility === "PUBLIC" ? "公开" : "私有"}</Tag>}
              >
                <p>
                  {x.author} {x.tags}
                </p>
                {manager && (
                  <div className="bk-content-tools">
                    <Button
                      onClick={() =>
                        void run(async () => {
                          const a = await articles.get(x.id);
                          open(
                            {
                              title: a.title,
                              author: a.author,
                              sourceUrl: a.source_url,
                              publishedAt: a.published_at,
                              visibility: a.visibility,
                              tags: a.tags,
                              html: a.html,
                            },
                            a.id,
                          );
                        })
                      }
                    >
                      编辑
                    </Button>
                    <Button
                      danger
                      onClick={() =>
                        Modal.confirm({
                          title: "删除这篇文章？",
                          content: "文章阅读记录及笔记也会删除。",
                          onOk: () =>
                            run(async () => {
                              await articles.remove(x.id);
                              await load();
                            }),
                        })
                      }
                    >
                      删除
                    </Button>
                  </div>
                )}
              </Card>
            ))
        )}
      </div>
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
              onClick={() => {
                if (!draft) return;
                const html = safeHtml(editor.current?.innerHTML ?? draft.html);
                setDraft({ ...draft, html });
                setPreview(!preview);
                setInitialHtml(html);
              }}
            >
              {preview ? "继续校对" : "预览排版"}
            </Button>
            <Button
              type="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!draft) return;
                  await articles.save(
                    {
                      ...draft,
                      html: safeHtml(editor.current?.innerHTML ?? draft.html),
                    },
                    editId,
                  );
                  setDraft(null);
                  await load();
                })
              }
            >
              确认保存
            </Button>
          </ActionToolbar>
        }
      >
        {draft && (
          <div className="bk-article-editor-form bk-content-stack">
            {error && <Alert type="error" title={error} />}
            <Input
              aria-label="文章标题"
              placeholder="文章标题"
              maxLength={300}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <Input
              aria-label="作者"
              placeholder="作者"
              value={draft.author}
              maxLength={300}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
            />
            <Input
              aria-label="标签"
              placeholder="分类 / 标签，以逗号分隔"
              value={draft.tags}
              maxLength={1000}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            />
            <Input
              aria-label="来源链接"
              placeholder="来源链接（可选）"
              value={draft.sourceUrl}
              onChange={(e) =>
                setDraft({ ...draft, sourceUrl: e.target.value })
              }
            />
            <Input
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
                checked={draft.visibility === "PUBLIC"}
                onChange={(checked) =>
                  setDraft({
                    ...draft,
                    visibility: checked ? "PUBLIC" : "PRIVATE",
                  })
                }
              />
            </label>
            {!preview && (
              <>
                <ArticleFileImport
                  disabled={busy}
                  onError={setError}
                  onImport={file => run(async () => {
                    const html = await importArticle(file);
                    setDraft({ ...draft, html, title: draft.title || file.name.replace(/\.[^.]+$/, "") });
                    setInitialHtml(html);
                    if (editor.current) editor.current.innerHTML = html;
                  })}
                />
                <ArticleFileImport
                  kind="image"
                  disabled={busy}
                  onError={setError}
                  onImport={file => {
                    const currentHtml = editor.current?.innerHTML ?? draft.html;
                    setInitialHtml(safeHtml(currentHtml));
                    return run(async () => {
                      const image = await readArticleImage(file);
                      if (!editor.current) return;
                      editor.current.innerHTML = safeHtml(currentHtml);
                      editor.current.append(image);
                      const html = safeHtml(editor.current.innerHTML);
                      setDraft({ ...draft, html });
                      setInitialHtml(html);
                    });
                  }}
                />
                <p>在正文区域粘贴图文，或导入文件后校对。</p>
              </>
            )}
            <div
              ref={editor}
              key={String(preview)}
              className="bk-content-prose bk-content-editor"
              role={preview ? undefined : "textbox"}
              aria-label="文章正文"
              contentEditable={!preview}
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: initialHtml }}
              onPaste={(e) => {
                if (preview) return;
                const html = e.clipboardData.getData("text/html");
                if (html) {
                  e.preventDefault();
                  document.execCommand("insertHTML", false, safeHtml(html));
                }
              }}
            />
          </div>
        )}
      </Drawer>
    </PageContainer>
  );
}
