import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { UserManagementPage } from "./UserManagementPage";
function Destination() { const location = useLocation(); return <output>{location.pathname}{location.search}{location.hash}</output>; }
it.each([
  ["", "#users"], ["#users", "#users"], ["#operations", "#catalog/operations"],
  ["#users/operations", "#catalog/operations"], ["#logins", "#users/logins"],
  ["#sessions", "#users/sessions"], ["#security", "#users/security"],
])("preserves the legacy user-management link %s", async (hash, destination) => {
  render(<TestProviders initialPath={`/admin/users?source=bookmark${hash}`}><Routes>
    <Route path="/admin/users" element={<UserManagementPage />} /><Route path="/settings" element={<Destination />} />
  </Routes></TestProviders>);
  expect(await screen.findByText(`/settings?source=bookmark${destination}`)).toBeInTheDocument();
});
