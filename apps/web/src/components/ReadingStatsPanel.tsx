import { overviewCardSx, overviewContentSpacing } from "./overviewCardLayout";
// 展示服务端周阅读统计与前周比较，加载或失败不可误显示为已确认零值。
// Presents server weekly reading totals/comparisons, keeping loading or failure distinct from confirmed zero values.
import { AccessTimeRounded } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Skeleton } from "@/ui/antd";
import { Stack } from "@/ui/primitives";
import { Typography } from "@/ui/primitives";
import type { WeeklyReadingStats } from "../domain/types";
import { tokens } from "../theme/generated-tokens";
import { OverviewCardHeader } from "./OverviewCardHeader";

export function ReadingStatsPanel({ stats, loading, error, today: serverToday }: {
  stats?: WeeklyReadingStats;
  today?: string;
  loading: boolean;
  error: boolean;
}) {
  if (loading) return (
    <Box
      component="section"
      aria-labelledby="reading-time-title"
      sx={{
        ...overviewCardSx, height: "100%",
      }}
    >
      <OverviewCardHeader id="reading-time-title" icon={<AccessTimeRounded />}>本周阅读时长</OverviewCardHeader>
      <Box role="status" aria-label="正在加载阅读时长" sx={{ mt: overviewContentSpacing }}><Skeleton active paragraph={{ rows: 4 }} /></Box>
    </Box>
  );
  if (error) return <Box component="section" aria-labelledby="reading-time-title" sx={{ ...overviewCardSx, height: "100%" }}>
    <OverviewCardHeader id="reading-time-title" icon={<AccessTimeRounded />}>本周阅读时长</OverviewCardHeader>
    <Box sx={{ mt: overviewContentSpacing }}><Alert severity="warning">阅读时长暂时无法读取，不影响藏书浏览。</Alert></Box>
  </Box>;
  const days = stats?.days ?? [];
  const maximum = Math.max(1, ...days.map((day) => day.seconds));
  const today = serverToday ?? localDateKey(new Date());
  const todaySeconds = days.find(day => day.date === today)?.seconds ?? 0;
  const activeDays = days.filter(day => day.date <= today && day.seconds > 0).length;

  return (
    <Box
      component="section"
      aria-labelledby="reading-time-title"
      sx={{
        ...overviewCardSx, height: "100%",
      }}
    >
      <OverviewCardHeader id="reading-time-title" icon={<AccessTimeRounded />}>本周阅读时长</OverviewCardHeader>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) repeat(2, minmax(0, 1fr))", gap: `${tokens.spacing[3]}px`, mt: overviewContentSpacing, alignItems: "start" }}>
        <Box aria-label="本周累计时长" sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">累计时长</Typography>
          <Typography component="div" sx={{ fontSize: `${tokens.typography.fontSize.title}px`, lineHeight: tokens.typography.lineHeight.ui, mt: `${tokens.spacing[1]}px`, overflowWrap: "anywhere" }}>{formatDuration(stats?.totalSeconds ?? 0)}</Typography>
        </Box>
        <Box aria-label="今日阅读时长" sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">今日阅读</Typography>
          <Typography sx={{ mt: `${tokens.spacing[1]}px` }}>{formatDuration(todaySeconds)}</Typography>
        </Box>
        <Box aria-label="本周阅读天数" sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">阅读天数</Typography>
          <Typography sx={{ mt: `${tokens.spacing[1]}px` }}>{activeDays} 天</Typography>
        </Box>
      </Box>
      <Box component="figure" aria-label="本周每日阅读" sx={{ m: 0, mt: overviewContentSpacing, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: `${tokens.spacing[2]}px` }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: `${tokens.spacing[1]}px` }}>
          <Typography variant="caption" color="text.secondary">{formatWeeklyComparison(stats?.totalSeconds ?? 0, stats?.previousWeekSeconds ?? 0)}</Typography>
          {stats && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{formatDateRange(stats.weekStart, stats.weekEnd)}</Typography>}
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {days.map(day => (
            <Box key={day.date} title={`${day.date} · ${formatDuration(day.seconds)}`} sx={{ minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", rowGap: `${tokens.spacing[1]}px`, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" noWrap>{day.seconds ? formatCompactDuration(day.seconds) : "0"}</Typography>
              <Box sx={{ minHeight: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", borderBottom: "1px solid", borderColor: "divider" }}>
                {day.seconds > 0 && <Box data-reading-bar={day.date} sx={{
                  width: `${tokens.spacing[4]}px`, maxWidth: "100%", height: `${day.seconds / maximum * 100}%`, minHeight: `${tokens.spacing[1] / 2}px`,
                  bgcolor: day.date === today ? "primary.main" : "secondary.main", borderRadius: `${tokens.radius.sm}px ${tokens.radius.sm}px 0 0`,
                }} />}
              </Box>
              <Typography variant="caption" color={day.date === today ? "primary.main" : "text.secondary"} sx={{ fontWeight: day.date === today ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.regular }}>{weekday(day.date)}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (seconds > 0 && minutes === 0) return "少于 1 分钟";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}

export function formatWeeklyComparison(currentSeconds: number, previousSeconds: number): string {
  if (previousSeconds <= 0) return `较上周上涨 ${currentSeconds > 0 ? 100 : 0}%`;
  const percentage = Math.round((currentSeconds - previousSeconds) / previousSeconds * 100);
  return percentage < 0 ? `较上周下降 ${Math.abs(percentage)}%` : `较上周上涨 ${percentage}%`;
}

function formatCompactDuration(seconds: number): string {
  const minutes = Math.max(1, Math.floor(seconds / 60));
  if (seconds < 60) return "<1m";
  return minutes >= 60 ? `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h` : `${minutes}m`;
}

function weekday(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateRange(start: string, end: string): string {
  const format = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", timeZone: "UTC" });
  return `${format.format(new Date(`${start}T00:00:00Z`))}–${format.format(new Date(`${end}T00:00:00Z`))}`;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
