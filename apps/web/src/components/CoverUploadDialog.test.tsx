import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { demoBooks } from "../data/demo";
import { TestProviders } from "../test/TestProviders";
import { CoverUploadDialog } from "./CoverUploadDialog";

vi.mock("./BookUploadDialog", () => ({
  cropCover: vi.fn(async () => new Blob(["normalized-cover"], { type: "image/jpeg" })),
}));

describe("CoverUploadDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("选择图片并确认后上传自定义封面", async () => {
    const completed = vi.fn();
    const closed = vi.fn();
    const upload = vi.spyOn(api, "updateBookCover").mockResolvedValue();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:cover-preview"),
      revokeObjectURL: vi.fn(),
    });

    render(
      <TestProviders>
        <CoverUploadDialog book={demoBooks[0]} onClose={closed} onCompleted={completed} />
      </TestProviders>,
    );

    expect(screen.getByRole("button", { name: "确认更换" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("选择封面图片"), {
      target: { files: [new File(["cover"], "cover.png", { type: "image/png" })] },
    });

    await screen.findByRole("img", { name: "新封面预览" });
    fireEvent.click(screen.getByRole("button", { name: "确认更换" }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith(demoBooks[0].id, expect.any(Blob)));
    expect(completed).toHaveBeenCalledWith("书籍封面已更新");
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
