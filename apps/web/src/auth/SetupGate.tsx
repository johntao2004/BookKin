import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { setupStatusQueryOptions } from "./setup-status";

/** Keeps every SPA route behind the server-confirmed first-run check. */
export function SetupGate({ children }: { children: React.ReactNode }) {
  const status = useQuery(setupStatusQueryOptions);
  const location = useLocation();

  if (location.pathname === "/setup") return <>{children}</>;
  if (status.isPending) return <div role="status" aria-label="正在确认系统初始化状态">正在确认系统初始化状态…</div>;
  if (status.isError) return <Navigate to="/setup" replace />;
  if (!status.data.initialized) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}
