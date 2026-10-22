import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ArticleCoverField } from "./ArticleCoverField";

afterEach(cleanup);
const cover = "/api/v1/articles/assets/56c307d8-d160-497c-96f1-17bab1e3f9c4";

it("makes the whole cover preview replaceable while removal stays independent", () => {
  const onRemove = vi.fn();
  render(<ArticleCoverField value={cover} disabled={false} readOnly={false} onImport={vi.fn()} onRemove={onRemove} />);
  const field = screen.getByRole("region", { name: "封面" });
  expect(within(field).getByRole("img", { name: "文章封面预览" })).toHaveAttribute("src", cover);
  const inputClick = vi.spyOn(screen.getByLabelText("上传文章封面"), "click");
  const replace = within(field).getByRole("button", { name: "替换封面" });
  expect(replace).toContainElement(within(field).getByRole("img", { name: "文章封面预览" }));
  fireEvent.click(within(field).getByRole("img", { name: "文章封面预览" }));
  expect(inputClick).toHaveBeenCalledOnce();
  fireEvent.click(within(field).getByRole("button", { name: "移除封面" }));
  expect(onRemove).toHaveBeenCalledOnce();
  expect(inputClick).toHaveBeenCalledOnce();
});

it("allows selecting the same cover file again and hides edit actions in preview", async () => {
  const onImport = vi.fn().mockResolvedValue(undefined);
  const view = render(<ArticleCoverField value="" disabled={false} readOnly={false} onImport={onImport} onRemove={vi.fn()} />);
  const input = screen.getByLabelText("上传文章封面");
  const click = vi.spyOn(input, "click");
  expect(screen.getAllByRole("button")).toHaveLength(1);
  fireEvent.click(screen.getByText("点击上传封面"));
  expect(click).toHaveBeenCalledOnce();
  const file = new File(["image"], "封面.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(onImport).toHaveBeenCalledWith(file));
  expect(input).toHaveValue("");
  view.rerender(<ArticleCoverField value={cover} disabled={false} readOnly onImport={onImport} onRemove={vi.fn()} />);
  expect(screen.getByRole("img", { name: "文章封面预览" })).toHaveAttribute("src", cover);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("does not load an untrusted external cover URL", () => {
  const onImport = vi.fn();
  render(<ArticleCoverField value="https://outside.example/pixel.png" disabled readOnly={false} onImport={onImport} onRemove={vi.fn()} />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "上传封面" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("上传文章封面"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
  expect(onImport).not.toHaveBeenCalled();
});
