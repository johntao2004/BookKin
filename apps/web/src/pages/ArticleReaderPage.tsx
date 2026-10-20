import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  _AntButton as Button,
  _AntAlert as Alert,
  Skeleton,
  Tag,
} from "../ui/antd";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { useAuth } from "../auth/AuthContext";
import {
  articles,
  emptyReading,
  type Article,
  type ReadingState,
} from "../features/content/api";
import { safeHtml } from "../features/content/import";
import { useIndependentReading } from "../features/content/useIndependentReading";
import { IndependentNotes } from "../features/content/IndependentNotes";
import "../features/content/content.css";
export function ArticleReaderPage() {
  const { user } = useAuth();
  const { articleId } = useParams();
  const [loaded, setLoaded] = useState<{
      article: Article;
      state: ReadingState;
      revision: number;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoaded(null);
    void Promise.all([
      articles.get(articleId!),
      user
        ? articles.reading(articleId!)
        : Promise.resolve({ state: "{}", revision: 0 }),
    ])
      .then(([article, reading]) => {
        if (active)
          setLoaded({
            article,
            state: { ...emptyReading(), ...JSON.parse(reading.state) },
            revision: reading.revision,
          });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [articleId, user?.id]);
  return loaded ? (
    <ArticleReading key={articleId} {...loaded} />
  ) : (
    <PageContainer>
      {error ? <Alert type="error" title={error} /> : <Skeleton active />}
    </PageContainer>
  );
}
function ArticleReading({
  article,
  state: initial,
  revision: initialRevision,
}: {
  article: Article;
  state: ReadingState;
  revision: number;
}) {
  const revision = useRef(initialRevision);
  const { user } = useAuth();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const save = useCallback(
    async (s: ReadingState) => {
      if (!user) return;
      await articles.saveReading(article.id, s, revision.current);
      revision.current++;
    },
    [article.id, user],
  );
  const {
    state,
    change,
    error: saveError,
    flush,
  } = useIndependentReading(initial, save);
  const body = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{
    quote: string;
    locator: string;
  } | null>(null);
  const jump = useCallback((locator: string) => {
    if (!/^p-\d+$/.test(locator)) return;
    body.current
      ?.querySelector(`#${locator}`)
      ?.scrollIntoView({ block: "center" });
  }, []);
  useEffect(() => {
    jump(window.location.hash.slice(1) || initial.locator);
  }, [initial.locator, jump]);
  useEffect(() => {
    const paint = () => {
      const root = body.current;
      if (!root) return;
      root
        .querySelectorAll("mark[data-annotation]")
        .forEach((mark) => mark.replaceWith(...mark.childNodes));
      root.normalize();
      for (const entry of state.annotations.filter(
        (x) => x.type === "HIGHLIGHT",
      )) {
        if (!/^p-\d+$/.test(entry.locator) || !entry.quote) continue;
        const parent = root.querySelector(`[id="${entry.locator}"]`);
        if (!parent) continue;
        const start = parent.textContent?.indexOf(entry.quote) ?? -1;
        if (start < 0) continue;
        const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
        let offset = 0,
          node: Node | null,
          startNode: Node | null = null,
          endNode: Node | null = null,
          startOffset = 0,
          endOffset = 0;
        while ((node = walker.nextNode())) {
          const length = node.textContent?.length ?? 0;
          if (!startNode && start < offset + length) {
            startNode = node;
            startOffset = start - offset;
          }
          if (start + entry.quote.length <= offset + length) {
            endNode = node;
            endOffset = start + entry.quote.length - offset;
            break;
          }
          offset += length;
        }
        if (startNode && endNode) {
          const range = document.createRange();
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          const mark = document.createElement("mark");
          mark.dataset.annotation = entry.id;
          mark.append(range.extractContents());
          range.insertNode(mark);
        }
      }
    };
    paint();
  }, [state.annotations]);
  useEffect(() => {
    const scroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const progress = height > 0 ? Math.min(1, window.scrollY / height) : 1;
      let locator = "";
      for (const p of body.current?.querySelectorAll("[id]") ?? []) {
        if (p.getBoundingClientRect().top < window.innerHeight / 2)
          locator = p.id;
      }
      change((s) => ({ ...s, progress, locator: locator || s.locator }));
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, [change]);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="ARTICLE"
        title={article.title}
        action={<Link to="/articles">返回文章收藏</Link>}
      />
      <div className="bk-content-stack">
        <p>
          {article.author} · {article.published_at}{" "}
          <Tag>{article.visibility === "PUBLIC" ? "公开" : "私有"}</Tag>
        </p>
        {article.source_url.startsWith("https://") && (
          <a href={article.source_url} target="_blank" rel="noreferrer">
            查看原始来源
          </a>
        )}
        {(error || saveError) && (
          <Alert type="error" title={error || saveError} />
        )}
        <div
          ref={body}
          className="bk-content-prose"
          dangerouslySetInnerHTML={{ __html: safeHtml(article.html) }}
          onMouseUp={() => {
            const selection = window.getSelection();
            if (
              !selection?.toString().trim() ||
              !body.current?.contains(selection.anchorNode)
            )
              return;
            const node =
              selection.anchorNode instanceof Element
                ? selection.anchorNode
                : selection.anchorNode?.parentElement;
            setSelection({
              quote: selection.toString(),
              locator: node?.closest("[id]")?.id ?? "",
            });
          }}
        />
        {user && (
          <IndependentNotes
            state={state}
            selection={selection}
            change={change}
            onJump={jump}
          />
        )}
        <div className="bk-content-tools">
          {user && (
            <Button
              onClick={() => void flush().catch((e) => setError(e.message))}
            >
              保存阅读记录
            </Button>
          )}
          {(user?.role === "OWNER" || user?.role === "ADMIN") && (
            <Button
              loading={busy}
              onClick={() => {
                setBusy(true);
                void articles
                  .generate(article.id)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              提取知识点
            </Button>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
