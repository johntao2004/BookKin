// 应用路由组合层，区分公开页面、认证内容和管理角色入口。
// Composes application routes with distinct public, authenticated and management entry points.
const ArticlesPage = lazy(() => import("./pages/ArticlesPage").then(m => ({default:m.ArticlesPage})));
const ArticleReaderPage = lazy(() => import("./pages/ArticleReaderPage").then(m => ({default:m.ArticleReaderPage})));
const VaultPage = lazy(() => import("./pages/VaultPage").then(m => ({default:m.VaultPage})));
const SearchPage = lazy(() => import("./pages/SearchPage").then(m => ({ default: m.SearchPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then(m => ({default:m.RegisterPage})));
import { Skeleton } from "@/ui/antd";
import { PageContainer } from "./components/PageHeader";
import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { VirtualLibraryRoute } from "./pages/VirtualLibraryRoute";

const UsersPage = lazy(() => import("./pages/UserManagementPage").then(module => ({ default: module.UserManagementPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(module => ({ default: module.SettingsPage })));
const MetadataEditPage = lazy(() => import("./pages/MetadataEditPage").then(module => ({ default: module.MetadataEditPage })));
const AnnotationsPage = lazy(() => import("./pages/AnnotationsPage").then((module) => ({ default: module.AnnotationsPage })));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage").then((module) => ({ default: module.ChangePasswordPage })));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage").then((module) => ({ default: module.CategoriesPage })));
const CategoryDetailPage = lazy(() => import("./pages/CategoryDetailPage").then((module) => ({ default: module.CategoryDetailPage })));
const BooklistsPage = lazy(() => import("./pages/BooklistsPage").then((module) => ({ default: module.BooklistsPage })));
const BooklistDetailPage = lazy(() => import("./pages/BooklistDetailPage").then((module) => ({ default: module.BooklistDetailPage })));
const KnowledgeGraphPage = lazy(() => import("./pages/KnowledgeGraphPage").then(module => ({ default: module.KnowledgeGraphPage })));
const LibraryPage = lazy(() => import("./pages/LibraryPage").then((module) => ({ default: module.LibraryPage })));
const PublicLibraryPage = lazy(() => import("./pages/PublicLibraryPage").then((module) => ({ default: module.PublicLibraryPage })));
const RecoveryPage = lazy(() => import("./pages/RecoveryPage").then(m => ({default:m.RecoveryPage})));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const ReaderPage = lazy(() => import("./pages/ReaderPage").then((module) => ({ default: module.ReaderPage })));
const RecycleBinPage = lazy(() => import("./pages/RecycleBinPage").then((module) => ({ default: module.RecycleBinPage })));
const SetupPage = lazy(() => import("./pages/SetupPage").then((module) => ({ default: module.SetupPage })));

function ProtectedShell() {
  return <RequireAuth><AppShell><Outlet /></AppShell></RequireAuth>;
}

function PublicShell() {
  return <AppShell><Outlet /></AppShell>;
}

export default function App() {
  return (
    <Suspense fallback={<PageContainer><div role="status" aria-label="正在加载页面"><Skeleton active paragraph={{ rows: 8 }} /></div></PageContainer>}>
      <Routes>
        <Route path="/recover" element={<RecoveryPage />} />
        <Route path="/forgot-password" element={<RecoveryPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
        <Route element={<PublicShell />}>
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/articles/:articleId" element={<ArticleReaderPage />} />

          <Route path="/library" element={<PublicLibraryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/categories/:categoryId" element={<CategoryDetailPage />} />
          <Route path="/booklists" element={<BooklistsPage />} />
          <Route path="/booklists/:booklistId" element={<BooklistDetailPage />} />
          <Route path="/reader/:bookId" element={<ReaderPage />} />
        </Route>
        <Route element={<ProtectedShell />}>
          <Route path="/library/books/:bookId/edit" element={<RequireAuth roles={["OWNER", "ADMIN"]}><MetadataEditPage /></RequireAuth>} />
          <Route path="/library/uploads/:uploadId" element={<RequireAuth roles={["OWNER", "ADMIN"]}><MetadataEditPage /></RequireAuth>} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/library/all" element={<LibraryPage />} />
          <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
          <Route path="/virtual-library" element={<VirtualLibraryRoute />} />
          <Route path="/display-books" element={<Navigate to="/library/all" replace />} />
          <Route path="/settings/display-books" element={<Navigate to="/library/all" replace />} />
          <Route path="/recycle-bin" element={<RequireAuth roles={["OWNER", "ADMIN"]}><RecycleBinPage /></RequireAuth>} />
          <Route path="/annotations" element={<AnnotationsPage />} />
          <Route path="/admin/library-roots" element={<Navigate to="/settings#library-roots" replace />} />
          <Route path="/admin/users" element={<RequireAuth roles={["OWNER", "ADMIN"]}><UsersPage /></RequireAuth>} />
          <Route path="/admin/file-operations" element={<Navigate to="/admin/users#operations" replace />} />
          <Route path="/admin/reader-fonts" element={<Navigate to="/settings#reader-fonts" replace />} />
          <Route path="/admin/recycle-bin" element={<Navigate to="/recycle-bin" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/library" replace />} />
      </Routes>
    </Suspense>
  );
}
