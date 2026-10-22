// 应用路由组合层，区分公开页面、认证内容和管理角色入口。
// Composes application routes with distinct public, authenticated and management entry points.
const ArticlesPage = lazy(() => import("./pages/ArticlesPage").then(m => ({default:m.ArticlesPage})));
const ArticleCollectionsPage = lazy(() => import("./pages/ArticleCollectionsPage").then(m => ({ default: m.ArticleCollectionsPage })));
const ArticleCollectionDetailPage = lazy(() => import("./pages/ArticleCollectionDetailPage").then(m => ({ default: m.ArticleCollectionDetailPage })));
const ArticleReaderPage = lazy(() => import("./pages/ArticleReaderPage").then(m => ({default:m.ArticleReaderPage})));
const VaultPage = lazy(() => import("./pages/VaultPage").then(m => ({default:m.VaultPage})));
const SearchPage = lazy(() => import("./pages/SearchPage").then(m => ({ default: m.SearchPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then(m => ({default:m.RegisterPage})));
import { Skeleton } from "@/ui/antd";
import { PageContainer } from "./components/PageHeader";
import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { RequireAuth, useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { VirtualLibraryRoute } from "./pages/VirtualLibraryRoute";

const UsersPage = lazy(() => import("./pages/UserManagementPage").then(module => ({ default: module.UserManagementPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(module => ({ default: module.SettingsPage })));
const BookDetailPage = lazy(() => import("./pages/BookDetailPage").then(module => ({ default: module.BookDetailPage })));
const MetadataEditPage = lazy(() => import("./pages/MetadataEditPage").then(module => ({ default: module.MetadataEditPage })));
const AnnotationsPage = lazy(() => import("./pages/AnnotationsPage").then((module) => ({ default: module.AnnotationsPage })));
const ReadingNotesPage = lazy(() => import("./pages/ReadingNotesPage").then(module => ({ default: module.ReadingNotesPage })));
const ReadingPostPage = lazy(() => import("./features/notes/ReadingPosts").then(module => ({ default: module.ReadingPostPage })));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage").then((module) => ({ default: module.ChangePasswordPage })));
const BooklistsPage = lazy(() => import("./pages/BooklistsPage").then((module) => ({ default: module.BooklistsPage })));
const BooklistDetailPage = lazy(() => import("./pages/BooklistDetailPage").then((module) => ({ default: module.BooklistDetailPage })));
const KnowledgeGraphPage = lazy(() => import("./pages/KnowledgeGraphPage").then(module => ({ default: module.KnowledgeGraphPage })));
const LibraryPage = lazy(() => import("./pages/LibraryPage").then((module) => ({ default: module.LibraryPage })));
const LibraryOverviewPage = lazy(() => import("./pages/LibraryOverviewPage").then(module => ({ default: module.LibraryOverviewPage })));
const RecoveryPage = lazy(() => import("./pages/RecoveryPage").then(m => ({default:m.RecoveryPage})));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const ReaderPage = lazy(() => import("./pages/ReaderPage").then((module) => ({ default: module.ReaderPage })));
const SetupPage = lazy(() => import("./pages/SetupPage").then((module) => ({ default: module.SetupPage })));

function ProtectedShell() {
  return <RequireAuth><AppShell><Outlet /></AppShell></RequireAuth>;
}

function PublicShell() {
  return <AppShell><Outlet /></AppShell>;
}

function LegacyCategoryRedirect() {
  const { ready } = useAuth();
  const location = useLocation();
  const { categoryId } = useParams();
  if (!ready) return null;

  const params = new URLSearchParams(location.search);
  if (categoryId) params.set("category", categoryId);
  params.set("advanced", "1");
  const search = params.toString();
  return <Navigate replace to={{
    pathname: "/library",
    search: search ? `?${search}` : "",
    hash: location.hash,
  }} />;
}

function LegacyLibraryRedirect() {
  const location = useLocation();
  return <Navigate replace to={{ pathname: "/library", search: location.search, hash: location.hash }} state={location.state} />;
}

function ReadingNotesIndex() {
  const params = new URLSearchParams(useLocation().search);
  const legacy = ["type", "bookId", "articleId", "q"].some(key => params.has(key));
  return legacy ? <AnnotationsPage /> : <ReadingNotesPage kind="ALL" />;
}

function LegacyNotesOverviewRedirect() {
  const location = useLocation();
  return <Navigate replace to={{ pathname: "/annotations", search: location.search, hash: location.hash }} state={location.state} />;
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
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/categories" element={<LegacyCategoryRedirect />} />
          <Route path="/categories/:categoryId" element={<LegacyCategoryRedirect />} />
          <Route path="/booklists" element={<BooklistsPage />} />
          <Route path="/booklists/:booklistId" element={<BooklistDetailPage />} />
          <Route path="/reader/:bookId" element={<ReaderPage />} />
        </Route>
        <Route element={<ProtectedShell />}>
          <Route path="/library/overview" element={<LibraryOverviewPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/articles/:articleId" element={<ArticleReaderPage />} />
          <Route path="/article-collections" element={<ArticleCollectionsPage />} />
          <Route path="/article-collections/:collectionId" element={<ArticleCollectionDetailPage />} />
          <Route path="/library/books/:bookId" element={<BookDetailPage />} />
          <Route path="/library/books/:bookId/edit" element={<RequireAuth roles={["OWNER", "ADMIN"]}><MetadataEditPage /></RequireAuth>} />
          <Route path="/library/uploads/:uploadId" element={<RequireAuth roles={["OWNER", "ADMIN"]}><MetadataEditPage /></RequireAuth>} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/library/all" element={<LegacyLibraryRedirect />} />
          <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
          <Route path="/virtual-library" element={<VirtualLibraryRoute />} />
          <Route path="/display-books" element={<LegacyLibraryRedirect />} />
          <Route path="/settings/display-books" element={<LegacyLibraryRedirect />} />
          <Route path="/recycle-bin" element={<RequireAuth roles={["OWNER", "ADMIN"]}><Navigate to="/settings#catalog/recycle-bin" replace /></RequireAuth>} />
          <Route path="/annotations" element={<ReadingNotesIndex />} />
          <Route path="/annotations/books" element={<ReadingNotesPage kind="BOOK" />} />
          <Route path="/annotations/articles" element={<ReadingNotesPage kind="ARTICLE" />} />
          <Route path="/annotations/all" element={<LegacyNotesOverviewRedirect />} />
          <Route path="/annotations/posts/:kind/:postId" element={<ReadingPostPage />} />
          <Route path="/admin/library-roots" element={<Navigate to="/settings#catalog/library-roots" replace />} />
          <Route path="/admin/users" element={<RequireAuth roles={["OWNER", "ADMIN"]}><UsersPage /></RequireAuth>} />
          <Route path="/admin/file-operations" element={<Navigate to="/settings#catalog/operations" replace />} />
          <Route path="/admin/reader-fonts" element={<Navigate to="/settings#services/reader-fonts" replace />} />
          <Route path="/admin/recycle-bin" element={<Navigate to="/recycle-bin" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/library" replace />} />
      </Routes>
    </Suspense>
  );
}
