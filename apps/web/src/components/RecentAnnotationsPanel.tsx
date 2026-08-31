import { FormatQuoteRounded, NotesOutlined } from "@mui/icons-material";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Annotation } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

const annotationTimestamp = (annotation: Annotation) => annotation.updatedAt ?? annotation.createdAt;

export function RecentAnnotationsPanel({ fallbackBookId, embedded = false }: { fallbackBookId?: string; embedded?: boolean }) {
  const navigate = useNavigate();
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
    const lineHeight = tokens.typography.fontSize.titleSm * tokens.typography.lineHeight.body;
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
        p: embedded ? { xs: `${tokens.spacing[4]}px`, md: `${tokens.spacing[5]}px` } : { xs: `${tokens.spacing[5]}px`, md: `${tokens.spacing[6]}px` },
        mb: embedded ? 0 : { xs: `${tokens.spacing[12]}px`, md: `${tokens.spacing[16]}px` },
        ...(embedded ? { display: "flex", flexDirection: "column", minHeight: 0, height: "100%" } : {}),
      }}
    >
      <Box sx={{ mb: `${tokens.spacing[5]}px`, flexShrink: 0 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: `${tokens.spacing[2]}px` }}>
          <NotesOutlined color="primary" />
          <Typography id="recent-annotations-title" variant="h5" component="h2">最近批注</Typography>
        </Stack>
      </Box>

      {annotationsQuery.isPending ? (
        <Stack role="status" direction="row" sx={{ minHeight: `${tokens.spacing[20]}px`, alignItems: "center", justifyContent: "center", gap: `${tokens.spacing[3]}px`, color: "text.secondary" }}>
          <CircularProgress size={20} />
          <Typography variant="body2">正在整理最近批注…</Typography>
        </Stack>
      ) : annotationsQuery.isError ? (
        <Stack sx={{ minHeight: `${tokens.spacing[20]}px`, alignItems: "flex-start", justifyContent: "center" }}>
          <Typography color="text.secondary">暂时无法读取批注，不影响继续阅读。</Typography>
        </Stack>
      ) : recentAnnotations.length === 0 ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ minHeight: `${tokens.spacing[20]}px`, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: `${tokens.spacing[4]}px` }}
        >
          <Box>
            <Typography sx={{ fontWeight: tokens.typography.fontWeight.semibold }}>还没有批注</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: `${tokens.spacing[1]}px` }}>去书中划下第一句话，它会出现在这里。</Typography>
          </Box>
          {fallbackBookId && <Button variant="outlined" onClick={() => navigate(`/reader/${fallbackBookId}`)}>去阅读</Button>}
        </Stack>
      ) : (
        <Box sx={embedded ? { display: "flex", flex: 1, flexDirection: "column", minHeight: 0 } : undefined}>
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
                    sx={{
                      minWidth: 0,
                      flex: 1,
                      fontFamily: tokens.typography.fontFamily.display,
                      fontSize: `${tokens.typography.fontSize.titleSm}px`,
                      lineHeight: tokens.typography.lineHeight.body,
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
