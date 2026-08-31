import { AccessTimeRounded, TrendingUpRounded } from "@mui/icons-material";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import type { WeeklyReadingStats } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

export function ReadingStatsPanel({ stats, loading, error }: {
  stats?: WeeklyReadingStats;
  loading: boolean;
  error: boolean;
}) {
  if (error) return <Alert severity="warning">阅读时长暂时无法读取，不影响藏书浏览。</Alert>;
  const days = stats?.days ?? [];
  const maximum = Math.max(1, ...days.map((day) => day.seconds));
  const today = localDateKey(new Date());

  return (
    <Box
      component="section"
      aria-labelledby="reading-time-title"
      sx={{
        height: "100%",
        border: 1,
        borderColor: "divider",
        borderRadius: `${tokens.radius.xl}px`,
        bgcolor: "background.paper",
        p: { xs: `${tokens.spacing[6]}px`, lg: `${tokens.spacing[8]}px` },
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: `${tokens.spacing[3]}px` }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: `${tokens.spacing[2]}px`, color: "primary.main" }}>
          <AccessTimeRounded fontSize="small" />
          <Typography id="reading-time-title" variant="h5" component="h2">本周阅读时长</Typography>
        </Stack>
        {stats && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{formatDateRange(stats.weekStart, stats.weekEnd)}</Typography>}
      </Stack>

      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-end", gap: `${tokens.spacing[4]}px`, mt: `${tokens.spacing[2]}px` }}>
        {loading ? <CircularProgress size={tokens.spacing[6]} /> : <Typography variant="h3">{formatDuration(stats?.totalSeconds ?? 0)}</Typography>}
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "flex-end", gap: `${tokens.spacing[1]}px`, color: "text.secondary", textAlign: "right" }}>
          <TrendingUpRounded fontSize="small" />
          <Typography variant="caption">上周阅读 {formatDuration(stats?.previousWeekSeconds ?? 0)}</Typography>
        </Stack>
      </Stack>

      <Typography variant="body1" sx={{ fontWeight: tokens.typography.fontWeight.semibold, mt: `${tokens.spacing[5]}px`, mb: `${tokens.spacing[2]}px` }}>近 7 日阅读时长</Typography>
      <Box sx={{ flex: 1, minHeight: `${tokens.spacing[24]}px`, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: { xs: `${tokens.spacing[1]}px`, sm: `${tokens.spacing[2]}px` }, alignItems: "stretch" }}>
        {days.map((day) => (
          <Stack key={day.date} sx={{ minWidth: 0, minHeight: 0, height: "100%", alignItems: "center", justifyContent: "flex-end" }}>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>{day.seconds ? formatCompactDuration(day.seconds) : "0"}</Typography>
            <Box sx={{ width: "100%", maxWidth: `${tokens.spacing[10]}px`, flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", bgcolor: "background.default", borderRadius: `${tokens.radius.sm}px`, overflow: "hidden", mt: `${tokens.spacing[1]}px` }}>
              <Box sx={{ width: "100%", height: `${day.seconds ? Math.max(tokens.spacing[2], Math.round(day.seconds / maximum * 100)) : 0}%`, bgcolor: day.date === today ? "primary.main" : "secondary.main", borderRadius: `${tokens.radius.sm}px` }} />
            </Box>
            <Typography variant="caption" color={day.date === today ? "primary.main" : "text.secondary"} sx={{ flexShrink: 0, mt: `${tokens.spacing[1]}px`, fontWeight: day.date === today ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.regular }}>{weekday(day.date)}</Typography>
          </Stack>
        ))}
      </Box>
      {!loading && stats?.totalSeconds === 0 && <Typography variant="caption" color="text.disabled" sx={{ mt: `${tokens.spacing[2]}px` }}>开始阅读后，这里会自动累计真实时长。</Typography>}
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
