import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { DataTable, Pagination } from "./antd";
import { paginationControlProps, useTablePagination } from "./table-pagination";
const records = Array.from({ length: 25 }, (_, i) => ({ id: i, title: `测试行 ${i + 1}` }));
it("uses native Ant Design navigation, total, page-size selection and quick jump", () => {
  render(<TestProviders><DataTable rowKey="id" aria-label="测试表" dataSource={records} columns={[{ title: "标题", dataIndex: "title" }]} /></TestProviders>);
  const table = within(screen.getByRole("table", { name: "测试表" }));
  expect(table.getAllByRole("row")).toHaveLength(11); expect(table.queryByText("测试行 11")).not.toBeInTheDocument();
  expect(screen.getByText("第 1–10 条，共 25 条")).toBeInTheDocument();
  expect(screen.getByRole("combobox")).toBeInTheDocument();
  fireEvent.click(screen.getByTitle("2")); expect(table.getByText("测试行 11")).toBeInTheDocument();
  expect(table.queryByText("测试行 1")).not.toBeInTheDocument();
  const jump = screen.getByRole("textbox", { name: /页/ });
  fireEvent.change(jump, { target: { value: "3" } }); fireEvent.keyUp(jump, { key: "Enter", keyCode: 13 });
  expect(table.getByText("测试行 25")).toBeInTheDocument();
});
it("shares mobile page slices, resets page size and clamps a removed last page", () => {
  function Mobile() {
    const [rows, setRows] = useState(records); const { pagination, offset, pageSize } = useTablePagination(rows.length);
    const pager = paginationControlProps(pagination);
    return <><div data-testid="mobile-rows">{rows.slice(offset, offset + pageSize).map(row => <p key={row.id}>{row.title}</p>)}</div><Pagination {...pager} /><button onClick={() => setRows(records.slice(0, 3))}>缩小列表</button></>;
  }
  render(<TestProviders><Mobile /></TestProviders>);
  fireEvent.click(screen.getByTitle("3")); expect(screen.getByText("测试行 25")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "缩小列表" })); expect(screen.getByText("测试行 1")).toBeInTheDocument();
  expect(within(screen.getByTestId("mobile-rows")).getAllByText(/测试行/)).toHaveLength(3);
});
