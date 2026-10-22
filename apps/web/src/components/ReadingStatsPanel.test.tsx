// 覆盖零基数、持平和下降比较及空图表，避免统计显示制造不存在的阅读数据。
// Covers zero-baseline, flat/declining comparisons and empty charts without inventing reading data.
import { render, screen, within } from "@testing-library/react";
import { TestProviders } from "../test/TestProviders";
import { formatWeeklyComparison, ReadingStatsPanel } from "./ReadingStatsPanel";

describe("ReadingStatsPanel", () => {
  it("renders weekly totals in a standalone statistics section", () => {
    render(
      <TestProviders>
        <ReadingStatsPanel
          loading={false}
          error={false}
          stats={{
            weekStart: "2026-08-17",
            weekEnd: "2026-08-23",
            totalSeconds: 3_900,
            previousWeekSeconds: 1_800,
            days: [
              { date: "2026-08-17", seconds: 600 },
              { date: "2026-08-18", seconds: 900 },
              { date: "2026-08-19", seconds: 0 },
              { date: "2026-08-20", seconds: 1_200 },
              { date: "2026-08-21", seconds: 1_200 },
              { date: "2026-08-22", seconds: 0 },
              { date: "2026-08-23", seconds: 0 },
            ],
          }}
        />
      </TestProviders>,
    );

    expect(screen.getByText("本周阅读时长")).toBeInTheDocument();
    expect(screen.getByText("1 小时 5 分钟")).toBeInTheDocument();
    expect(screen.getByText("较上周上涨 117%")).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "本周每日阅读" })).toBeInTheDocument();
  });

  it("formats zero-baseline, flat, and declining weekly comparisons", () => {
    expect(formatWeeklyComparison(0, 0)).toBe("较上周上涨 0%");
    expect(formatWeeklyComparison(600, 0)).toBe("较上周上涨 100%");
    expect(formatWeeklyComparison(900, 1_800)).toBe("较上周下降 50%");
  });

  it("keeps small durations proportional and leaves zero days without a filled bar", () => {
    const { container } = render(<TestProviders><ReadingStatsPanel loading={false} error={false} today="2026-08-19" stats={{
      weekStart: "2026-08-17", weekEnd: "2026-08-23", totalSeconds: 101, previousWeekSeconds: 0,
      days: [{ date: "2026-08-17", seconds: 100 }, { date: "2026-08-18", seconds: 1 }, { date: "2026-08-19", seconds: 0 }],
    }} /></TestProviders>);
    expect(container.querySelector('[data-reading-bar="2026-08-17"]')).toHaveStyle({ height: "100%" });
    expect(container.querySelector('[data-reading-bar="2026-08-18"]')).toHaveStyle({ height: "1%" });
    expect(container.querySelector('[data-reading-bar="2026-08-19"]')).not.toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "本周每日阅读" })).toHaveTextContent("<1m");
  });

  it("does not add an instructional caption beneath an empty weekly chart", () => {
    render(
      <TestProviders>
        <ReadingStatsPanel
          loading={false}
          error={false}
          stats={{
            weekStart: "2026-08-31",
            weekEnd: "2026-09-06",
            totalSeconds: 0,
            previousWeekSeconds: 0,
            days: ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"]
              .map((date) => ({ date, seconds: 0 })),
          }}
        />
      </TestProviders>,
    );

    expect(screen.queryByText("开始阅读后，这里会自动累计真实时长。")).not.toBeInTheDocument();
  });
});

it("uses the server date for today's duration and counts only days with actual reading", () => {
  render(<TestProviders><ReadingStatsPanel loading={false} error={false} today="2026-08-20" stats={{
    weekStart: "2026-08-17", weekEnd: "2026-08-23", totalSeconds: 3660, previousWeekSeconds: 0,
    days: [{date: "2026-08-17", seconds: 60}, {date: "2026-08-18", seconds: 0}, {date: "2026-08-20", seconds: 1200}, {date: "2026-08-21", seconds: 2400}],
  }} /></TestProviders>);
  expect(within(screen.getByLabelText("今日阅读时长")).getByText("20 分钟")).toBeInTheDocument();
  expect(within(screen.getByLabelText("本周阅读天数")).getByText("2 天")).toBeInTheDocument();
});
it("keeps zero records and sub-minute reading truthful", () => {
  const stats = {weekStart: "2026-08-17", weekEnd: "2026-08-23", totalSeconds: 20, previousWeekSeconds: 0, days: [{date: "2026-08-20", seconds: 20}]};
  const {rerender} = render(<TestProviders><ReadingStatsPanel loading={false} error={false} today="2026-08-20" stats={stats} /></TestProviders>);
  expect(within(screen.getByLabelText("今日阅读时长")).getByText("少于 1 分钟")).toBeInTheDocument();
  expect(within(screen.getByLabelText("本周阅读天数")).getByText("1 天")).toBeInTheDocument();
  rerender(<TestProviders><ReadingStatsPanel loading={false} error={false} today="2026-08-20" stats={{...stats, totalSeconds: 0, days: []}} /></TestProviders>);
  expect(within(screen.getByLabelText("今日阅读时长")).getByText("0 分钟")).toBeInTheDocument();
  expect(within(screen.getByLabelText("本周阅读天数")).getByText("0 天")).toBeInTheDocument();
});
