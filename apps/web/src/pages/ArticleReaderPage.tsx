import { RequestErrorPage } from "./HttpErrorPage";
import { usePermissions } from "../auth/permissions";
// Article content and its private reading state use the shared reader surface.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  _AntAlert as Alert,
  _AntButton as Button,
  Skeleton,
  Tag,
} from "../ui/antd";
import { PageBackAction, PageContainer, PageHeader } from "../components/PageHeader";
import type { IndependentReaderSource } from "../components/readers/independent-reader-source";
import { useAuth } from "../auth/AuthContext";
import {
  articles,
  emptyReading,
  type Article,
  type Entry,
  type ReadingState,
} from "../features/content/api";
import { useIndependentReading } from "../features/content/useIndependentReading";
import { articleReaderTarget, buildArticleEpub } from "../features/content/article-document";
import { ReaderWorkspace } from "./ReaderPage";
import type { Annotation } from "../domain/types";
import { randomId } from "../utils/random-id";
import "../features/content/content.css";
const AddToArticleCollectionDialog = lazy(() => import("../features/article-collections/AddToArticleCollectionDialog").then(module => ({ default: module.AddToArticleCollectionDialog })));

interface LoadedArticle {
  article: Article;
  state: ReadingState;
  revision: number;
  warning: string;
}

const entryTypes = new Set<Entry["type"]>(["NOTE", "HIGHLIGHT", "BOOKMARK"]);
const annotationStyles = new Set<NonNullable<Entry["style"]>>([
  "HIGHLIGHT",
  "UNDERLINE",
  "BOLD",
]);
const annotationColors = new Set<NonNullable<Entry["color"]>>([
  "YELLOW",
  "GREEN",
  "PINK",
  "BLUE",
  "ORANGE",
  "CORAL",
  "GOLD",
  "TEAL",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReadingEntry(value: unknown): value is Entry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    entryTypes.has(value.type as Entry["type"]) &&
    typeof value.quote === "string" &&
    typeof value.note === "string" &&
    typeof value.locator === "string" &&
    typeof value.createdAt === "string" &&
    (value.style === undefined ||
      annotationStyles.has(value.style as NonNullable<Entry["style"]>)) &&
    (value.color === undefined ||
      annotationColors.has(value.color as NonNullable<Entry["color"]>))
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function parseReadingState(serialized: string) {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed))
      throw new Error("文章阅读记录格式无效");
    let invalidField = false;
    const defaults = emptyReading();
    const locator = parsed.locator === undefined ? defaults.locator : parsed.locator;
    const progress = parsed.progress === undefined ? defaults.progress : parsed.progress;
    const seconds = parsed.seconds === undefined ? defaults.seconds : parsed.seconds;
    const rawAnnotations =
      parsed.annotations === undefined ? defaults.annotations : parsed.annotations;
    if (typeof locator !== "string") invalidField = true;
    if (
      typeof progress !== "number" ||
      !Number.isFinite(progress) ||
      progress < 0 ||
      progress > 1
    )
      invalidField = true;
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0)
      invalidField = true;
    if (
      !Array.isArray(rawAnnotations) ||
      !rawAnnotations.every(isReadingEntry)
    )
      invalidField = true;
    return {
      state: {
        ...defaults,
        locator: typeof locator === "string" ? locator : defaults.locator,
        progress:
          typeof progress === "number" && Number.isFinite(progress) &&
          progress >= 0 && progress <= 1
            ? progress
            : defaults.progress,
        seconds:
          typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0
            ? seconds
            : defaults.seconds,
        annotations:
          Array.isArray(rawAnnotations) && rawAnnotations.every(isReadingEntry)
            ? rawAnnotations
            : defaults.annotations,
      },
      warning: invalidField
        ? "文章阅读记录包含无法安全处理的数据，当前暂不能保存；原记录保持不变。"
        : "",
    };
  } catch {
    return {
      state: emptyReading(),
      warning: "文章阅读记录无法解析，当前暂不能保存；原记录保持不变。",
    };
  }
}

function mapArticleLocator(locator: string) {
  return articleReaderTarget(locator) ?? locator;
}

function toReaderAnnotation(article: Article, entry: Entry): Annotation {
  return {
    ...entry,
    bookId: article.id,
    bookTitle: article.title,
    bookAuthor: article.author,
    type: entry.type,
    quote: entry.quote,
    note: entry.note,
    locator: mapArticleLocator(entry.locator),
    style: entry.style ?? "HIGHLIGHT",
    createdAt: entry.createdAt,
  };
}

export function ArticleReaderPage() {
  const { user } = useAuth();
  const { articleId = "" } = useParams();
  const [loaded, setLoaded] = useState<LoadedArticle | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    setLoaded(null);
    setError(null);
    const reading = user
      ? articles.reading(articleId)
      : Promise.resolve({ state: "{}", revision: 0 });
    void Promise.all([articles.get(articleId), reading])
      .then(([article, readingState]) => {
        if (!active) return;
        const parsed = parseReadingState(readingState.state);
        setLoaded({
          article,
          state: parsed.state,
          revision: readingState.revision,
          warning: parsed.warning,
        });
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError);
      });
    return () => {
      active = false;
    };
  }, [articleId, user?.id]);

  if (error) return <RequestErrorPage error={error} onRetry={() => window.location.reload()} back={<PageBackAction to="/articles">返回撷文斋</PageBackAction>} />;
  if (!loaded) {
    return (
      <PageContainer>
        <PageBackAction to="/articles">返回撷文斋</PageBackAction>
        <Skeleton active />
      </PageContainer>
    );
  }
  return (
    <ArticleReading
      key={`${loaded.article.id}:${user?.id ?? "anonymous"}`}
      {...loaded}
    />
  );
}

function ArticleReading({
  article,
  state: initialState,
  revision: initialRevision,
  warning: initialWarning,
}: LoadedArticle) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const revision = useRef(initialRevision);
  const [contentUrl, setContentUrl] = useState("");
  const [epubError, setEpubError] = useState("");
  const [actionError, setActionError] = useState("");
  const [visibleSaveError, setVisibleSaveError] = useState("");
  const [readingWarning, setReadingWarning] = useState(initialWarning);
  const [busy, setBusy] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const canOrganizeCollections = can("articles.collections.edit");
  const canAnalyze = can("articles.analyze");
  const {
    state,
    change,
    flush,
  } = useIndependentReading(initialState, async (nextState) => {
    if (!user || readingWarning) return;
    try {
      await articles.saveReading(article.id, nextState, revision.current);
      revision.current += 1;
      setReadingWarning("");
      setVisibleSaveError("");
      setActionError("");
    } catch (saveFailure) {
      setVisibleSaveError(errorMessage(saveFailure, "文章阅读记录保存失败。"));
      throw saveFailure;
    }
  });

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setContentUrl("");
    setEpubError("");
    void buildArticleEpub(article)
      .then((epub) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(epub);
        setContentUrl(objectUrl);
      })
      .catch((buildError: unknown) => {
        if (active)
          setEpubError(errorMessage(buildError, "无法生成文章阅读文件。"));
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [article]);

  const initialLocatorRef = useRef<string | undefined>(undefined);
  if (initialLocatorRef.current === undefined) {
    const requested =
      new URLSearchParams(location.search).get("locator")?.trim() ||
      location.hash.slice(1).trim() ||
      initialState.locator;
    initialLocatorRef.current = requested ? mapArticleLocator(requested) : "";
  }
  const initialLocator = initialLocatorRef.current || undefined;

  const onPosition = useCallback(
    (locator: string, progress: number) => {
      change((previous) => ({ ...previous, locator, progress }));
    },
    [change],
  );

  const createAnnotation = useCallback(
    async (draft: Parameters<IndependentReaderSource["createAnnotation"]>[0]) => {
      if (!user) throw new Error("登录后可以保存文章批注。");
      if (readingWarning)
        throw new Error("文章阅读记录无法安全处理，暂不能保存批注。");
      const entry: Entry = {
        id: randomId(),
        type: draft.type,
        quote: draft.quote,
        note: draft.note,
        locator: draft.locator,
        style: draft.style,
        color: draft.color,
        createdAt: new Date().toISOString(),
      };
      change((previous) => ({
        ...previous,
        annotations: [...previous.annotations, entry],
      }));
      try {
        await flush();
        return toReaderAnnotation(article, entry);
      } catch (saveFailure) {
        change((previous) => ({
          ...previous,
          annotations: previous.annotations.filter((current) => current.id !== entry.id),
        }));
        setActionError(errorMessage(saveFailure, "文章批注保存失败。"));
        throw saveFailure;
      }
    },
    [article, change, flush, readingWarning, user],
  );

  const deleteAnnotation = useCallback(
    async (id: string) => {
      if (!user) throw new Error("登录后可以删除文章批注。");
      if (readingWarning)
        throw new Error("文章阅读记录无法安全处理，暂不能删除批注。");
      const removed = state.annotations.find(entry => entry.id === id);
      change((previous) => ({
        ...previous,
        annotations: previous.annotations.filter((entry) => entry.id !== id),
      }));
      try {
        await flush();
      } catch (saveFailure) {
        if (removed) change(previous => ({
          ...previous,
          annotations: previous.annotations.some(entry => entry.id === id) ? previous.annotations : [...previous.annotations, removed],
        }));
        setActionError(errorMessage(saveFailure, "文章批注保存失败。"));
        throw saveFailure;
      }
    },
    [change, flush, readingWarning, state.annotations, user],
  );

  const handleBack = useCallback(async () => {
    try {
      await flush();
      navigate("/articles");
    } catch (saveFailure) {
      setActionError(errorMessage(saveFailure, "阅读记录保存失败，文章仍保持打开。"));
    }
  }, [flush, navigate]);

  const saveReading = useCallback(() => {
    void flush().catch((saveFailure: unknown) =>
      setActionError(errorMessage(saveFailure, "阅读记录保存失败。")),
    );
  }, [flush]);

  const extraActions = useMemo(
    () => (
      <div className="bk-content-stack" aria-label="文章信息与操作">
        <p>
          {article.author} · {article.published_at}{" "}
          <Tag>{article.visibility === "PUBLIC" ? "公开" : "私有"}</Tag>
        </p>
        {article.source_url.startsWith("https://") && (
          <a href={article.source_url} target="_blank" rel="noreferrer">
            查看原始来源
          </a>
        )}
        {user && (
          <Button disabled={Boolean(readingWarning)} onClick={saveReading}>
            保存记录
          </Button>
        )}
        {user && <Button onClick={() => navigate(`/annotations/articles?write=1&sourceId=${encodeURIComponent(article.id)}`)}>写博文</Button>}
        {canOrganizeCollections && <Button onClick={() => setCollectionOpen(true)}>加入合集</Button>}
        {canAnalyze && (
          <Button
            loading={busy}
            onClick={() => {
              setBusy(true);
              void articles
                .generate(article.id)
                .catch((generateError: unknown) =>
                  setActionError(errorMessage(generateError, "提取知识点失败。")),
                )
                .finally(() => setBusy(false));
            }}
          >
            提取知识点
          </Button>
        )}
      </div>
    ),
    [article, busy, saveReading, user, navigate, readingWarning, canOrganizeCollections, canAnalyze],
  );

  const source = useMemo<IndependentReaderSource>(
    () => ({
      id: article.id,
      title: article.title,
      author: article.author,
      format: "EPUB",
      flow: "scrolled-doc",
      contentUrl,
      label: "文章",
      backLabel: "返回撷文斋",
      initialLocator,
      progress: state.progress,
      annotations: state.annotations.map((entry) =>
        toReaderAnnotation(article, entry),
      ),
      error: actionError || visibleSaveError || readingWarning || undefined,
      extraActions,
      onBack: () => void handleBack(),
      onPosition,
      createAnnotation,
      deleteAnnotation,
    }),
    [
      actionError,
      article,
      contentUrl,
      createAnnotation,
      deleteAnnotation,
      extraActions,
      handleBack,
      onPosition,
      readingWarning,
      state.annotations,
      state.progress,
    ],
  );

  if (epubError) {
    return (
      <PageContainer>
        <PageBackAction to="/articles">返回撷文斋</PageBackAction>
        <PageHeader
          eyebrow="ARTICLE"
          title={article.title}
        />
        <Alert type="error" title={epubError} />
      </PageContainer>
    );
  }
  if (!contentUrl) {
    return (
      <PageContainer>
        <PageBackAction to="/articles">返回撷文斋</PageBackAction>
        <Skeleton active />
      </PageContainer>
    );
  }
  return <><ReaderWorkspace source={source} />
    {collectionOpen && <Suspense fallback={null}><AddToArticleCollectionDialog open articleId={article.id} articleTitle={article.title} articleVisibility={article.visibility} onClose={() => setCollectionOpen(false)} /></Suspense>}
  </>;
}
