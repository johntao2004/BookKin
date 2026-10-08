import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { TestProviders } from "../test/TestProviders";
import { SettingsPage } from "./SettingsPage";

const authState = vi.hoisted(() => ({ role: "OWNER" as "OWNER" | "ADMIN" | "MEMBER" }));

vi.mock("../auth/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/AuthContext")>();
  return {
    ...actual,
    useAuth: () => ({ user: { role: authState.role } }),
    RequireAuth: ({ children, roles }: any) => roles?.includes(authState.role) ? children : <p role="alert">权限不足</p>,
  };
});
vi.mock("./LibraryRootsPage", () => ({ LibraryRootsPage: () => <p>书库面板</p> }));
vi.mock("./ReaderFontsPage", () => ({ ReaderFontsPage: () => <p>字体面板</p> }));
vi.mock("./AiSettingsPage", () => ({ AiSettingsPage: () => <p>AI 面板</p> }));
vi.mock("./MailSettingsPage", () => ({ MailSettingsPage: () => <p>邮件面板</p> }));

function History() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output>{location.hash}</output><button onClick={() => navigate(-1)}>后退</button></>;
}

function RouteProbe() {
  const location = useLocation();
  return <output data-testid="destination">{`${location.pathname}${location.hash}`}</output>;
}

function renderSettings(initialPath: string) {
  return render(
    <TestProviders initialPath={initialPath}>
      <Routes>
        <Route path="/settings" element={<><SettingsPage /><History /></>} />
        <Route path="/profile" element={<RouteProbe />} />
        <Route path="/display-books" element={<RouteProbe />} />
        <Route path="/admin/users" element={<RouteProbe />} />
      </Routes>
    </TestProviders>,
  );
}

beforeEach(() => {
  authState.role = "OWNER";
});

it("restores anchored tabs, mounts only the active panel, and supports browser history", async () => {
  renderSettings("/settings#reader-fonts");
  expect(await screen.findByText("字体面板")).toBeInTheDocument();
  expect(screen.queryByText("书库面板")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "书库状态" }));
  expect(await screen.findByText("书库面板")).toBeInTheDocument();
  expect(screen.queryByText("字体面板")).not.toBeInTheDocument();
  expect(screen.getByText("#library-roots")).toBeInTheDocument();

  fireEvent.click(screen.getByText("后退"));
  await waitFor(() => expect(screen.getByText("#reader-fonts")).toBeInTheDocument());
  expect(await screen.findByText("字体面板")).toBeInTheDocument();
  expect(screen.queryByText("书库面板")).not.toBeInTheDocument();
});

it("shows mail only to the owner and returns an admin mail hash to an allowed section", async () => {
  const owner = renderSettings("/settings#mail");
  expect(await screen.findByText("邮件面板")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "邮件服务" })).toBeInTheDocument();
  owner.unmount();

  authState.role = "ADMIN";
  renderSettings("/settings#mail");
  expect(await screen.findByText("书库面板")).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "邮件服务" })).not.toBeInTheDocument();
  expect(screen.queryByText("邮件面板")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("#library-roots")).toBeInTheDocument());
  expect(screen.getByRole("tab", { name: "AI 书目匹配" })).toBeInTheDocument();
});

it("redirects members to personal information without mounting settings panels", async () => {
  authState.role = "MEMBER";
  renderSettings("/settings#reader-fonts");
  await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent("/profile"));
  expect(screen.queryByText("字体面板")).not.toBeInTheDocument();
});

it.each([
  ["#recovery-email", "/profile"],
  ["#users", "/admin/users"],
  ["#file-operations", "/admin/users#operations"],
  ["#display-books", "/display-books"],
])("preserves legacy settings route %s -> %s", async (legacyHash, destination) => {
  renderSettings(`/settings${legacyHash}`);
  await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent(destination));
});
