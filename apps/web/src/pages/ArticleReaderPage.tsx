import { RequestErrorPage } from "./HttpErrorPage";
// Article content and its private reading state use the shared reader surface.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  _AntAlert as Alert,
  Skeleton,
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
import { safeHtml } from "../features/content/import";
import { ReaderWorkspace } from "./ReaderPage";
import type { Annotation } from "../domain/types";
import { upsertArticleAnnotation } from "../domain/annotation-groups";
import { randomId } from "../utils/random-id";
import "../features/content/content.css";

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

function uniqueArticleId(document: Document, preferred: string) {
  let candidate = preferred;
  let suffix = 2;
  while (document.getElementById(candidate)) {
    candidate = `${preferred}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function normalizedSelectionText(value: string) {
  return value.replace(/\s/gu, "");
}

export function createArticleAnnotationLocatorResolver(
  article: Pick<Article, "html">,
) {
  const document = new DOMParser().parseFromString(safeHtml(article.html), "text/html");
  Array.from(document.body.querySelectorAll("p")).forEach((paragraph, index) => {
    if (!paragraph.id) paragraph.id = uniqueArticleId(document, `p-${index + 1}`);
  });
  const idCounts = new Map<string, number>();
  Array.from(document.querySelectorAll("[id]")).forEach((element) => {
    idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1);
  });
  const paragraphs = new Map(
    Array.from(document.body.querySelectorAll("p[id]"))
      .filter((paragraph) => idCounts.get(paragraph.id) === 1)
      .map((paragraph) => [paragraph.id, paragraph] as const),
  );

  return (locator: string, quote: string) => {
    const existingTarget = articleReaderTarget(locator);
    if (existingTarget?.startsWith("article.xhtml#p-")) return existingTarget;
    const paragraphId = /\[(p-\d+)\]/u.exec(locator)?.[1];
    if (!paragraphId) return locator;
    const paragraph = paragraphs.get(paragraphId);
    const targetText = normalizedSelectionText(quote.trim());
    if (!paragraph || !targetText) return locator;

    const paragraphText = normalizedSelectionText(paragraph.textContent ?? "");
    let occurrence = 0;
    let offset = 0;
    while ((offset = paragraphText.indexOf(targetText, offset)) >= 0) {
      occurrence += 1;
      if (occurrence > 1) return locator;
      offset += 1;
    }
    if (occurrence !== 1) return locator;
    return `article.xhtml#${paragraphId}`;
  };
}

function toReaderAnnotation(
  article: Article,
  entry: Entry,
  resolveLocator: (locator: string, quote: string) => string,
): Annotation {
  return {
    ...entry,
    bookId: article.id,
    bookTitle: article.title,
    bookAuthor: article.author,
    type: entry.type,
    quote: entry.quote,
    note: entry.note,
    locator: resolveLocator(entry.locator, entry.quote),
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

  if (error) return <RequestErrorPage error={error} onRetry={() => window.location.reload()} back={<PageBackAction to="/articles">返回文钞馆</PageBackAction>} />;
  if (!loaded) {
    return (
      <PageContainer>
        <PageBackAction to="/articles">返回文钞馆</PageBackAction>
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
  const navigate = useNavigate();
  const location = useLocation();
  const revision = useRef(initialRevision);
  const resolveAnnotationLocator = useMemo(
    () => createArticleAnnotationLocatorResolver(article),
    [article],
  );
  const [contentUrl, setContentUrl] = useState("");
  const [epubError, setEpubError] = useState("");
  const [actionError, setActionError] = useState("");
  const [visibleSaveError, setVisibleSaveError] = useState("");
  const [readingWarning, setReadingWarning] = useState(initialWarning);
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
        locator: resolveAnnotationLocator(draft.locator, draft.quote),
        style: draft.style,
        color: draft.color,
        createdAt: new Date().toISOString(),
      };
      let rollbackGroup: Entry[] = [];
      let rollbackIds: string[] = [];
      let savedEntry = entry;
      change((previous) => {
        const originalById = new Map(previous.annotations.map((current) => [current.id, current]));
        const normalized = previous.annotations.map((current) => ({
          ...current,
          locator: resolveAnnotationLocator(current.locator, current.quote),
        }));
        const result = upsertArticleAnnotation(normalized, entry);
        const groupIds = new Set(result.groupIds);
        rollbackGroup = previous.annotations.filter((current) => groupIds.has(current.id));
        rollbackIds = result.groupIds;
        savedEntry = result.annotation;
        const annotations = result.annotations.map((current) =>
          groupIds.has(current.id) ? current : originalById.get(current.id) ?? current,
        );
        return { ...previous, annotations };
      });
      try {
        await flush();
        return toReaderAnnotation(article, savedEntry, resolveAnnotationLocator);
      } catch (saveFailure) {
        change((previous) => {
          const rollbackIdsSet = new Set(rollbackIds);
          const previousById = new Map(rollbackGroup.map((current) => [current.id, current]));
          const restoredIds = new Set<string>();
          const annotations = previous.annotations.flatMap((current) => {
            if (!rollbackIdsSet.has(current.id)) return [current];
            const saved = previousById.get(current.id);
            if (!saved) return [];
            restoredIds.add(saved.id);
            return [saved];
          });
          for (const saved of rollbackGroup) {
            if (!restoredIds.has(saved.id)) annotations.push(saved);
          }
          return { ...previous, annotations };
        });
        setActionError(errorMessage(saveFailure, "文章批注保存失败。"));
        throw saveFailure;
      }
    },
    [article, change, flush, readingWarning, resolveAnnotationLocator, user],
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

  const source = useMemo<IndependentReaderSource>(
    () => ({
      id: article.id,
      title: article.title,
      author: article.author,
      format: "EPUB",
      flow: "scrolled-doc",
      contentUrl,
      annotationPermission: "articles.annotate",
      label: "文章",
      backLabel: "返回文钞馆",
      initialLocator,
      progress: state.progress,
      annotations: state.annotations.map((entry) =>
        toReaderAnnotation(article, entry, resolveAnnotationLocator),
      ),
      resolveAnnotationLocator,
      error: actionError || visibleSaveError || readingWarning || undefined,
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
      handleBack,
      onPosition,
      readingWarning,
      resolveAnnotationLocator,
      state.annotations,
      state.progress,
    ],
  );

  if (epubError) {
    return (
      <PageContainer>
        <PageBackAction to="/articles">返回文钞馆</PageBackAction>
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
        <PageBackAction to="/articles">返回文钞馆</PageBackAction>
        <Skeleton active />
      </PageContainer>
    );
  }
  return <ReaderWorkspace source={source} />;
}
