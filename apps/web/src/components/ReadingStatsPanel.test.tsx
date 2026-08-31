import { render, screen } from "@testing-library/react";
import { TestProviders } from "../test/TestProviders";
import { ReadingStatsPanel } from "./ReadingStatsPanel";

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
    expect(screen.getByText("上周阅读 30 分钟")).toBeInTheDocument();
    expect(screen.getByText("近 7 日阅读时长")).toBeInTheDocument();
  });
});
