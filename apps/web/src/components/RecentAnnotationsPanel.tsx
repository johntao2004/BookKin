import { overviewCardSx, overviewContentSpacing } from "./overviewCardLayout";
// 只回顾当前用户的书籍批注；原文入口携带精确定位，不混入文章或禁书区数据。
// Reviews current-user book annotations and links to exact saved locations.
import { Link } from "react-router-dom";
import { NotesOutlined } from "@/ui/icons";
import { Box, Stack, Typography } from "@/ui/primitives";
import { Skeleton } from "@/ui/antd";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Annotation } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { EMPTY_ANNOTATIONS_TITLE } from "../ui/empty-state-copy";
import { OverviewCardHeader } from "./OverviewCardHeader";
import { OverviewEmptyState } from "./OverviewEmptyState";

const annotationTimestamp = (annotation: Annotation) => Date.parse(annotation.updatedAt || annotation.createdAt);

export function RecentAnnotationsPanel({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const annotationsQuery = useQuery({
    queryKey: ["annotations", "review", user?.id],
    queryFn: () => api.listAnnotations(),
    enabled: Boolean(user),
    refetchInterval: 15_000,
  });
  const recentAnnotations = useMemo(() => (annotationsQuery.data ?? [])
    .filter(annotation => annotation.type !== "BOOKMARK" && Boolean(annotation.quote?.trim() || annotation.note?.trim()))
    .sort((left, right) => annotationTimestamp(right) - annotationTimestamp(left) || right.id.localeCompare(left.id))
    .slice(0, 3), [annotationsQuery.data]);

  if (!user) return null;
  return <Box component="section" aria-labelledby="recent-annotations-title" sx={{
    ...overviewCardSx,
    mb: embedded ? 0 : { xs: `${tokens.spacing[12]}px`, md: `${tokens.spacing[16]}px` },
    ...(embedded ? { display: "flex", flexDirection: "column", minHeight: 0, height: "100%" } : {}),
  }}>
    <Box sx={{ flexShrink: 0 }}><OverviewCardHeader id="recent-annotations-title" icon={<NotesOutlined />}>批注回顾</OverviewCardHeader></Box>
    {annotationsQuery.isPending ? <Box role="status" aria-label="正在整理批注回顾" sx={{ mt: overviewContentSpacing }}><Skeleton active paragraph={{ rows: 3 }} /></Box>
      : annotationsQuery.isError ? <Stack sx={{ minHeight: `${tokens.spacing[20]}px`, alignItems: "flex-start", justifyContent: "center", mt: overviewContentSpacing }}>
        <Typography color="text.secondary">暂时无法读取批注，不影响继续阅读。</Typography>
      </Stack>
      : recentAnnotations.length === 0 ? <OverviewEmptyState title={EMPTY_ANNOTATIONS_TITLE} />
      : <Box component="ul" aria-label="批注回顾记录" sx={{ listStyle: "none", p: 0, m: 0, mt: overviewContentSpacing, minHeight: 0, display: "grid", gap: `${tokens.spacing[1]}px` }}>
        {recentAnnotations.map(annotation => {
          const bookTitle = annotation.bookTitle?.trim() || "藏书";
          const quote = annotation.quote?.trim();
          const note = annotation.note?.trim();
          const locator = annotation.locator?.trim();
          const href = locator ? `/reader/${encodeURIComponent(annotation.bookId)}?locator=${encodeURIComponent(locator)}` : undefined;
          return <Box component="li" key={annotation.id} sx={{ minWidth: 0, "&:not(:first-child)": { pt: `${tokens.spacing[1]}px`, borderTop: 1, borderColor: "divider" } }}>
            <Box component="article" aria-label={`《${bookTitle}》的批注`} sx={{ minWidth: 0 }}>
              <Box component={href ? Link : "div"} to={href} aria-label={href ? `返回《${bookTitle}》原文` : undefined} sx={{
                display: "block", minWidth: 0, minHeight: `${tokens.layout.touchTarget}px`,
                color: "inherit", textDecoration: "none", borderRadius: `${tokens.radius.md}px`,
                "&:hover .bk-annotation-return": { textDecoration: "underline" },
                "&:focus-visible": { outline: `${tokens.spacing[1] / 2}px solid ${tokens.color.semantic.primary}`, outlineOffset: `${tokens.spacing[1]}px` },
              }}>
                <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", gap: `${tokens.spacing[2]}px`, minWidth: 0 }}>
                  <Typography component="h3" variant="body2" noWrap title={bookTitle} sx={{ minWidth: 0, flex: 1, fontFamily: tokens.typography.fontFamily.body, fontSize: `${tokens.typography.fontSize.body}px`, lineHeight: tokens.typography.lineHeight.ui, fontWeight: tokens.typography.fontWeight.semibold }}>{bookTitle}</Typography>
                  <Typography component="span" variant="caption" className="bk-annotation-return" sx={{ flexShrink: 0, whiteSpace: "nowrap", color: href ? "primary.main" : "text.secondary" }}>{href ? "返回原文" : "原文位置缺失"}</Typography>
                </Stack>
                {quote && <Typography component="blockquote" variant="body2" noWrap title={quote} sx={{ m: 0 }}>{quote}</Typography>}
                {note && note !== quote && <Typography variant="body2" color="text.secondary" noWrap title={note}>笔记：{note}</Typography>}
              </Box>
            </Box>
          </Box>;
        })}
      </Box>}
  </Box>;
}
