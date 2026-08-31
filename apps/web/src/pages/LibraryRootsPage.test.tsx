import { render, screen } from "@testing-library/react";
import { TestProviders } from "../test/TestProviders";
import { LibraryRootsPage } from "./LibraryRootsPage";

describe("LibraryRootsPage", () => {
  it("surfaces dynamic access states for each root", async () => {
    render(<TestProviders><LibraryRootsPage /></TestProviders>);

    expect(await screen.findByText("家庭藏书")).toBeInTheDocument();
    expect(screen.getByText("旧书归档")).toBeInTheDocument();
    expect(screen.getByText("可读可写")).toBeInTheDocument();
    expect(screen.getByText("只读")).toBeInTheDocument();
    expect(screen.getByText(/当前不可写/)).toBeInTheDocument();
    expect(screen.queryByText(/容器不能自行新增宿主机挂载/)).not.toBeInTheDocument();
  });
});
