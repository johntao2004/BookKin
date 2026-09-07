import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { FeedbackBubble, FeedbackProvider } from "./notifications";

describe("bubble feedback", () => {
  it("keeps notices outside the page and preserves retry actions", async () => {
    const retry = vi.fn();
    const { unmount } = render(<FeedbackProvider><main data-testid="page">
      <FeedbackBubble severity="error" action={<button onClick={retry}>重试</button>}>保存失败</FeedbackBubble>
    </main></FeedbackProvider>);
    expect(await screen.findByText("保存失败")).toBeInTheDocument();
    expect(within(screen.getByTestId("page")).queryByText("保存失败")).toBeNull();
    fireEvent.click(screen.getByText("重试"));
    expect(retry).toHaveBeenCalledOnce();
    unmount();
    await waitFor(() => expect(screen.queryByText("保存失败")).toBeNull());
  });

  it("updates an existing bubble instead of accumulating duplicates", async () => {
    const view = (text: string) => <FeedbackProvider><FeedbackBubble>{text}</FeedbackBubble></FeedbackProvider>;
    const { rerender } = render(view("第一条"));
    await screen.findByText("第一条");
    rerender(view("第二条"));
    await screen.findByText("第二条");
    expect(screen.queryByText("第一条")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
