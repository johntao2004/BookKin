import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("近 7 日阅读时长")).toBeInTheDocument();
  });

  it("formats zero-baseline, flat, and declining weekly comparisons", () => {
    expect(formatWeeklyComparison(0, 0)).toBe("较上周上涨 0%");
    expect(formatWeeklyComparison(600, 0)).toBe("较上周上涨 100%");
    expect(formatWeeklyComparison(900, 1_800)).toBe("较上周下降 50%");
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
