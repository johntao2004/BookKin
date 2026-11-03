import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { AppLoading } from "../components/AppLoading";
import { RequestErrorPage } from "../pages/HttpErrorPage";
import { setupStatusQueryOptions } from "./setup-status";

/** Keeps every SPA route behind the server-confirmed first-run check. */
export function SetupGate({ children }: { children: React.ReactNode }) {
  const status = useQuery(setupStatusQueryOptions);
  const location = useLocation();

  if (location.pathname === "/setup") return <>{children}</>;
  if (status.isPending) return <AppLoading label="正在确认系统初始化状态" />;
  if (status.isError) return <RequestErrorPage error={status.error} retrying={status.isFetching} onRetry={() => void status.refetch()} />;
  if (!status.data.initialized) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}
