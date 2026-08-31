import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "../api/client";
import { TestProviders } from "../test/TestProviders";
import { VirtualLibraryExperience as VirtualLibraryPage } from "./VirtualLibraryExperience";
import { VIRTUAL_LIBRARY_SCENE_MODEL_VERSION } from "./virtual-library-scene";

describe("VirtualLibraryPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("bookkin-demo-session", JSON.stringify({
      id: "user-owner", username: "owner", displayName: "林", role: "OWNER", mustChangePassword: false,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the private catalog into a standalone 3D library experience", async () => {
    render(<TestProviders initialPath="/virtual-library"><VirtualLibraryPage /></TestProviders>);

    expect(screen.getByRole("region", { name: "虚拟 3D 图书馆" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回书库" })).toHaveAttribute("href", "/library");
    expect(screen.queryByRole("heading", { name: "虚拟图书馆" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ 本藏书已入架 · 点击书架展开$/)).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "图书馆区域切换" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "禁书区" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "馆长办公室" })).toBeInTheDocument();
    expect(screen.queryByText("360° 环视")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "向左" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "正前" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "向右" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("场景缩放控制")).not.toBeInTheDocument();
    expect(screen.queryByText("悬停查看书架框选 · 点击正面聚焦 · 滚轮缩放场景")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("图书管理员性别")).not.toBeInTheDocument();
    expect(screen.getByLabelText("可 360 度环视的虚拟图书馆 3D 场景")).toHaveAttribute(
      "data-scene-model",
      VIRTUAL_LIBRARY_SCENE_MODEL_VERSION,
    );
    const canvas = screen.getByLabelText("可 360 度环视的虚拟图书馆 3D 场景");
    expect(canvas).toHaveAttribute("data-scene-zoom", "1.00");
    fireEvent.click(screen.getByRole("button", { name: "馆长办公室" }));
    expect(canvas).toHaveAttribute("data-active-room", "director");
    expect(screen.getByRole("heading", { level: 1, name: "馆长办公室" })).toBeInTheDocument();
    expect(screen.queryByText("拖拽查看空间 · 滚轮缩放 · 按 Esc 返回大厅")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回大厅" }));
    expect(canvas).toHaveAttribute("data-active-room", "hall");
  });

  it("keeps the scene UI available when WebGL is unavailable", async () => {
    render(<TestProviders initialPath="/virtual-library"><VirtualLibraryPage /></TestProviders>);

    const canvas = screen.getByLabelText("可 360 度环视的虚拟图书馆 3D 场景");
    expect(canvas).toBeInTheDocument();
    await waitFor(() => expect(Number(canvas.getAttribute("data-book-model-count"))).toBeGreaterThan(0));
  });

  it("offers an in-place retry when the catalog connection fails", async () => {
    const listBooks = vi.spyOn(api, "listBooks").mockRejectedValueOnce(new Error("offline"));
    render(<TestProviders initialPath="/virtual-library"><VirtualLibraryPage /></TestProviders>);

    expect(await screen.findByRole("alert")).toHaveTextContent("藏书数据暂时未连接，书架无法展开。");
    fireEvent.click(screen.getByRole("button", { name: "重新加载藏书" }));

    await waitFor(() => expect(listBooks).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(Number(screen.getByLabelText("可 360 度环视的虚拟图书馆 3D 场景").getAttribute("data-book-model-count"))).toBeGreaterThan(0);
    });
  });
});
