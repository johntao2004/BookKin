import { useEffect, useState } from "react";
import type { TablePaginationConfig } from "antd/es/table";

/** Shared native Ant Design pager for tables and their mobile card presentations. */
export const tablePaginationDefaults: TablePaginationConfig = {
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 50, 100],
  showSizeChanger: true,
  showQuickJumper: true,
  showLessItems: true,
  hideOnSinglePage: false,
  responsive: true,
  placement: ["bottomEnd"],
  showTotal: (total, range) => `第 ${range[0]}–${range[1]} 条，共 ${total} 条`,
};

export function paginationControlProps({ placement: _placement, position: _position, ...props }: TablePaginationConfig) { return props; }

export function useTablePagination(total: number) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const current = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  useEffect(() => { if (page !== current) setPage(current); }, [current, page]);
  const pagination: TablePaginationConfig = { ...tablePaginationDefaults, current, pageSize, total,
    onChange: (next, size) => { setPage(size === pageSize ? next : 1); setPageSize(size); } };
  return { pagination, offset: (current - 1) * pageSize, pageSize };
}
