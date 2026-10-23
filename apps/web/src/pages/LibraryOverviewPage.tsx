import { usePermissions } from "../auth/permissions";
import { overviewCardSx, overviewContentSpacing } from "../components/overviewCardLayout";
import { BookCover } from "../components/BookCover";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { Skeleton } from "@/ui/antd";
import { AutoAwesomeOutlined } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box, Stack, Typography } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { PageContainer, PageHeader } from "../components/PageHeader";
import { OverviewCardHeader } from "../components/OverviewCardHeader";
import { OverviewEmptyState } from "../components/OverviewEmptyState";
import { RecentReadingPanel } from "../components/RecentReadingPanel";
import { ReadingStatsPanel } from "../components/ReadingStatsPanel";
import { RecentAnnotationsPanel } from "../components/RecentAnnotationsPanel";
import { tokens } from "../theme/generated-tokens";

// Reading overview has its own authenticated route, independent of catalog filters.
export function LibraryOverviewPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const overviewQuery = useQuery({
    queryKey: ["books", "overview", { userId: user?.id }],
    queryFn: ({ signal }) => api.getReadingOverview(signal),
    enabled: Boolean(user),
    refetchInterval: 15_000,
  });
  if (!user) return null;
  const featured = overviewQuery.data?.featuredBook;
  return <PageContainer>
    <PageHeader eyebrow="OVERVIEW" title="楼中一览" action={<Button component={Link} to="/library">全部藏书</Button>} />
    {overviewQuery.isError && !overviewQuery.data ? <Alert severity="error" action={<Button onClick={() => void overviewQuery.refetch()}>重试</Button>}>阅读概览暂时无法读取。</Alert> : (
        <Box
          id="library-overview"
          component="section"
          aria-label="书库概览"
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
            // 宽屏单行布局中卡片保持等高，包括加载与空状态。
            // Keep equal card heights in the wide, single-row layout,
            // including loading and empty states.
            gridAutoRows: `${tokens.spacing[24] * 3.5}px`,
            gap: { xs: `${tokens.spacing[4]}px`, sm: `${tokens.spacing[6]}px` },
            mb: { xs: `${tokens.spacing[6]}px`, md: `${tokens.spacing[8]}px` },
            alignItems: "stretch",
            "& .bk-typography-h4": { fontSize: { xs: `${tokens.typography.fontSize.title}px`, sm: `${tokens.typography.fontSize.headingSm}px` } },
          }}
        >
          {overviewQuery.isPending ? Array.from({ length: 4 }, (_, index) => (
            <Box key={index} role="status" aria-label="正在加载书库概览" sx={overviewCardSx}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Box>
          )) : <>
              <Box
                component="article"
                aria-labelledby="featured-book-title"
                sx={{
                  ...overviewCardSx,
                  gridColumn: { sm: 1 },
                  gridRow: { sm: 1 },
                }}
              >
                <OverviewCardHeader id="featured-card-title" icon={<AutoAwesomeOutlined />}>本周新藏</OverviewCardHeader>
                {featured ? <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "minmax(0, 0.92fr) minmax(0, 1.08fr)", lg: `minmax(0, min(40%, ${tokens.spacing[20] * 2}px)) minmax(0, 1fr)` },
                    gap: { xs: `${tokens.spacing[4]}px`, md: `${tokens.spacing[6]}px` },
                    flex: 1,
                    minHeight: 0,
                    mt: overviewContentSpacing,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-start", minWidth: 0, minHeight: 0, containerType: "size" }}>
                    <BookCover src={featured.coverUrl} alt={`${featured.title}封面`} loading="eager" fetchPriority="high" sx={{ width: "min(100cqw, calc(100cqh * 3 / 4))" }} />
                  </Box>
                  <Stack sx={{ minWidth: 0, minHeight: 0, alignItems: "stretch" }}>
                    <Typography id="featured-book-title" variant="h4" component="h3" title={featured.title} sx={{ overflowWrap: "anywhere", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>{featured.title}</Typography>
                    <Typography color="text.secondary" sx={{ mt: `${tokens.spacing[2]}px` }}>{featured.author}</Typography>
                    <Stack direction="row" sx={{ flexWrap: "wrap", gap: `${tokens.spacing[3]}px`, mt: "auto", pt: `${tokens.spacing[4]}px` }}>
                      <Button fullWidth variant="contained" disabled={!can("reader.read")} onClick={() => navigate(`/reader/${featured.id}`)}>开始阅读</Button>
                    </Stack>
                  </Stack>
                </Box> : <OverviewEmptyState titleId="featured-book-title" title="本周暂无新书" />}
              </Box>

              <Box sx={{ minWidth: 0, gridColumn: { sm: 1, lg: 3 }, gridRow: { sm: 2, lg: 1 }, display: "flex", "& > *": { flex: 1 } }}>
                <RecentAnnotationsPanel embedded />
              </Box>

            <Box sx={{ minWidth: 0, gridColumn: { sm: 2 }, gridRow: { sm: 1 }, display: "flex", "& > *": { flex: 1 } }}>
              <ReadingStatsPanel stats={overviewQuery.data?.stats} today={overviewQuery.data?.today} loading={overviewQuery.isPending} error={overviewQuery.isError} />
            </Box>
            <Box sx={{ minWidth: 0, gridColumn: { sm: 2, lg: 4 }, gridRow: { sm: 2, lg: 1 }, display: "flex", "& > *": { flex: 1 } }}>
              <RecentReadingPanel items={overviewQuery.data?.recentReading ?? []} />
            </Box>
          </>}
        </Box>
    )}
  </PageContainer>;
}
