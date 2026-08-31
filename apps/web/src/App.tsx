import { CircularProgress, Stack } from "@mui/material";
import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";

const AnnotationsPage = lazy(() => import("./pages/AnnotationsPage").then((module) => ({ default: module.AnnotationsPage })));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage").then((module) => ({ default: module.ChangePasswordPage })));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage").then((module) => ({ default: module.CategoriesPage })));
const CategoryDetailPage = lazy(() => import("./pages/CategoryDetailPage").then((module) => ({ default: module.CategoryDetailPage })));
const BooklistsPage = lazy(() => import("./pages/BooklistsPage").then((module) => ({ default: module.BooklistsPage })));
const BooklistDetailPage = lazy(() => import("./pages/BooklistDetailPage").then((module) => ({ default: module.BooklistDetailPage })));
const FileOperationsPage = lazy(() => import("./pages/FileOperationsPage").then((module) => ({ default: module.FileOperationsPage })));
const LibraryPage = lazy(() => import("./pages/LibraryPage").then((module) => ({ default: module.LibraryPage })));
const PublicLibraryPage = lazy(() => import("./pages/PublicLibraryPage").then((module) => ({ default: module.PublicLibraryPage })));
const DisplayBooksSettingsPage = lazy(() => import("./pages/DisplayBooksSettingsPage").then((module) => ({ default: module.DisplayBooksSettingsPage })));
const LibraryRootsPage = lazy(() => import("./pages/LibraryRootsPage").then((module) => ({ default: module.LibraryRootsPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const ReaderPage = lazy(() => import("./pages/ReaderPage").then((module) => ({ default: module.ReaderPage })));
const RecycleBinPage = lazy(() => import("./pages/RecycleBinPage").then((module) => ({ default: module.RecycleBinPage })));
const ReaderFontsPage = lazy(() => import("./pages/ReaderFontsPage").then((module) => ({ default: module.ReaderFontsPage })));
const SetupPage = lazy(() => import("./pages/SetupPage").then((module) => ({ default: module.SetupPage })));
const UsersPage = lazy(() => import("./pages/UsersPage").then((module) => ({ default: module.UsersPage })));
const VirtualLibraryPage = lazy(() => import("./pages/VirtualLibraryExperience").then((module) => ({ default: module.VirtualLibraryExperience })));

function ProtectedShell() {
  return <RequireAuth><AppShell><Outlet /></AppShell></RequireAuth>;
}

function PublicShell() {
  return <AppShell><Outlet /></AppShell>;
}

export default function App() {
  return (
    <Suspense fallback={<Stack sx={{ minHeight: "100vh", alignItems: "center", justifyContent: "center" }}><CircularProgress /></Stack>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
        <Route element={<PublicShell />}>
          <Route path="/library" element={<PublicLibraryPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/categories/:categoryId" element={<CategoryDetailPage />} />
          <Route path="/booklists" element={<BooklistsPage />} />
          <Route path="/booklists/:booklistId" element={<BooklistDetailPage />} />
          <Route path="/reader/:bookId" element={<ReaderPage />} />
        </Route>
        <Route element={<ProtectedShell />}>
          <Route path="/library/all" element={<LibraryPage />} />
          <Route path="/virtual-library" element={<VirtualLibraryPage />} />
          <Route path="/settings/display-books" element={<DisplayBooksSettingsPage />} />
          <Route path="/recycle-bin" element={<RequireAuth roles={["OWNER", "ADMIN"]}><RecycleBinPage /></RequireAuth>} />
          <Route path="/annotations" element={<AnnotationsPage />} />
          <Route path="/admin/library-roots" element={<RequireAuth roles={["OWNER", "ADMIN"]}><LibraryRootsPage /></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth roles={["OWNER", "ADMIN"]}><UsersPage /></RequireAuth>} />
          <Route path="/admin/file-operations" element={<RequireAuth roles={["OWNER", "ADMIN"]}><FileOperationsPage /></RequireAuth>} />
          <Route path="/admin/reader-fonts" element={<RequireAuth roles={["OWNER", "ADMIN"]}><ReaderFontsPage /></RequireAuth>} />
          <Route path="/admin/recycle-bin" element={<Navigate to="/recycle-bin" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/library" replace />} />
      </Routes>
    </Suspense>
  );
}
