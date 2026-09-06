import { FormatQuoteRounded } from "@/ui/icons";
import { NotesOutlined } from "@/ui/icons";
import { Box } from "@/ui";
import { Skeleton } from "@/ui";
import { Stack } from "@/ui";
import { Typography } from "@/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { Annotation } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { OverviewCardHeader } from "./OverviewCardHeader";
import { OverviewEmptyState } from "./OverviewEmptyState";

const annotationTimestamp = (annotation: Annotation) => annotation.updatedAt ?? annotation.createdAt;

export function RecentAnnotationsPanel({ embedded = false }: { embedded?: boolean }) {
  const quoteAreaRef = useRef<HTMLDivElement>(null);
  const [quoteLineClamp, setQuoteLineClamp] = useState(2);
  const annotationsQuery = useQuery({
    queryKey: ["annotations", "recent"],
    queryFn: () => api.listAnnotations(),
  });
  const recentAnnotations = useMemo(() => (annotationsQuery.data ?? [])
    .filter((annotation) => annotation.type !== "BOOKMARK" && Boolean(annotation.quote?.trim() || annotation.note?.trim()))
    .sort((left, right) => annotationTimestamp(right).localeCompare(annotationTimestamp(left)))
    .slice(0, 1), [annotationsQuery.data]);
  const recentAnnotationId = recentAnnotations[0]?.id;

  useEffect(() => {
    if (!embedded || !quoteAreaRef.current || typeof ResizeObserver === "undefined") return;
    const quoteArea = quoteAreaRef.current;
    const lineHeight = tokens.typography.fontSize.headingSm * tokens.typography.lineHeight.heading;
    const updateLineClamp = () => {
      const nextLineClamp = Math.max(1, Math.floor(quoteArea.clientHeight / lineHeight));
      setQuoteLineClamp((current) => current === nextLineClamp ? current : nextLineClamp);
    };
    const observer = new ResizeObserver(updateLineClamp);
    observer.observe(quoteArea);
    updateLineClamp();
    return () => observer.disconnect();
  }, [embedded, recentAnnotationId]);

  return (
    <Box
      component="section"
      aria-labelledby="recent-annotations-title"
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: `${tokens.radius.xl}px`,
        p: embedded ? { xs: `${tokens.spacing[6]}px`, lg: `${tokens.spacing[8]}px` } : { xs: `${tokens.spacing[5]}px`, md: `${tokens.spacing[6]}px` },
        mb: embedded ? 0 : { xs: `${tokens.spacing[12]}px`, md: `${tokens.spacing[16]}px` },
        ...(embedded ? { display: "flex", flexDirection: "column", minHeight: 0, height: "100%" } : {}),
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <OverviewCardHeader id="recent-annotations-title" icon={<NotesOutlined />}>最近批注</OverviewCardHeader>
      </Box>

      {annotationsQuery.isPending ? (
        <Box role="status" aria-label="正在整理最近批注" sx={{ mt: 2 }}><Skeleton active paragraph={{ rows: 2 }} /></Box>
      ) : annotationsQuery.isError ? (
        <Stack sx={{ minHeight: `${tokens.spacing[20]}px`, alignItems: "flex-start", justifyContent: "center", mt: `${tokens.spacing[4]}px` }}>
          <Typography color="text.secondary">暂时无法读取批注，不影响继续阅读。</Typography>
        </Stack>
      ) : recentAnnotations.length === 0 ? (
        <OverviewEmptyState
          title="还没有批注"
          description="去书中划下第一句话，它会出现在这里。"
        />
      ) : (
        <Box sx={embedded ? { display: "flex", flex: 1, flexDirection: "column", minHeight: 0, mt: `${tokens.spacing[4]}px` } : { mt: `${tokens.spacing[4]}px` }}>
          {recentAnnotations.map((annotation) => (
            <Box
              component="article"
              aria-label={`《${annotation.bookTitle ?? "藏书"}》的批注`}
              key={annotation.id}
              sx={{
                minWidth: 0,
                ...(embedded ? { display: "flex", flex: 1, flexDirection: "column", minHeight: 0 } : {}),
              }}
            >
              <Box ref={embedded ? quoteAreaRef : undefined} sx={{ flex: embedded ? 1 : undefined, minHeight: 0, overflow: "hidden" }}>
                <Stack direction="row" sx={{ alignItems: "flex-start", gap: `${tokens.spacing[2]}px`, width: "100%" }}>
                  <FormatQuoteRounded color="primary" aria-hidden="true" sx={{ flexShrink: 0 }} />
                  <Typography
                    variant="h4"
                    sx={{
                      minWidth: 0,
                      flex: 1,
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: embedded ? quoteLineClamp : 2,
                      overflow: "hidden",
                    }}
                  >
                    {annotation.quote?.trim() || annotation.note?.trim()}
                  </Typography>
                </Stack>
              </Box>
              <Box
                sx={{
                  minWidth: 0,
                  mt: `${embedded ? tokens.spacing[2] : tokens.spacing[4]}px`,
                  ml: `${tokens.spacing[8]}px`,
                  textAlign: "right",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: tokens.typography.fontFamily.display,
                    fontSize: `${tokens.typography.fontSize.titleSm}px`,
                    lineHeight: tokens.typography.lineHeight.body,
                    fontWeight: tokens.typography.fontWeight.semibold,
                  }}
                  noWrap
                >
                  {annotation.bookTitle ?? "藏书"}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontFamily: tokens.typography.fontFamily.display,
                    fontSize: `${tokens.typography.fontSize.titleSm}px`,
                    lineHeight: tokens.typography.lineHeight.body,
                  }}
                >
                  {new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(annotationTimestamp(annotation)))}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
