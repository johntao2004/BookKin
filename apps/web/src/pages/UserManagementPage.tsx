import { Navigate, useLocation } from "react-router-dom";
import { normalizeSettingsHash } from "./settings-navigation";

// Old administration URLs now open the corresponding grouped settings panel.
export function UserManagementPage() {
  const location = useLocation();
  const hash = normalizeSettingsHash(location.hash || "#users");
  return <Navigate replace to={{ pathname: "/settings", search: location.search, hash }} />;
}
