import { demoBooks, demoRecycleBin, demoUsers } from "../data/demo";
import type {
  Book,
  BooklistDetail,
  BooklistKind,
  BooklistList,
  BooklistVisibility,
  BookPage,
  BrowseBook,
  BrowseBookPage,
  CategoryDetail,
  CategoryList,
  DisplayBook,
  DisplayBookPage,
  BookMetadata,
  BookMetadataDraft,
  BookUpload,
  FileOperation,
  FileOperationPreview,
  FileOperationType,
  LibraryRoot,
  ManagedUser,
  Annotation,
  AnnotationBookPage,
  ReadingPosition,
  ReaderFont,
  WeeklyReadingStats,
  RecycleBinEntry,
  SessionUser,
  UserRole,
} from "../domain/types";
import { PRESET_READER_FONTS } from "../components/readers/reader-fonts";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

const pause = (duration = 180) => new Promise((resolve) => window.setTimeout(resolve, duration));

let csrfToken: string | undefined;

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  const value = document.cookie.split("; ").find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  return value ? decodeURIComponent(value) : undefined;
}

async function ensureCsrfToken(signal?: AbortSignal): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/v1/auth/csrf", { credentials: "include", signal });
  if (!response.ok) throw new Error("无法建立安全会话");
  const body = await response.json() as { token: string };
  csrfToken = readCookie("XSRF-TOKEN") ?? body.token;
  return csrfToken;
}

async function request<T>(path: string, init: RequestInit = {}, options: { timeoutMs?: number } = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);
  const timeoutSignal = options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined;
  const signal = init.signal && timeoutSignal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : init.signal ?? timeoutSignal;
  let requestCsrfToken: string | undefined;
  const send = (token?: string) => fetch(`/api/v1${path}`, {
    credentials: "include",
    ...init,
    signal,
    headers: {
      ...(!(init.body instanceof Blob) && !(init.body instanceof ArrayBuffer) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-XSRF-TOKEN": token } : {}),
      ...init.headers,
    },
  });
  try {
    requestCsrfToken = needsCsrf ? await ensureCsrfToken(signal) : undefined;
    let response = await send(requestCsrfToken);
    if (response.status === 403 && needsCsrf) {
      csrfToken = undefined;
      requestCsrfToken = await ensureCsrfToken(signal);
      response = await send(requestCsrfToken);
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => ({ title: "请求失败" }));
      throw new Error(problem.detail ?? problem.title ?? `HTTP ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } catch (reason) {
    if (timeoutSignal?.aborted && !init.signal?.aborted) {
      throw new Error("请求超时，未确认文件是否已移动。请刷新书库后重试。", { cause: reason });
    }
    throw reason;
  }
}

let users = [...demoUsers];
let books = [...demoBooks];
let displayBookIds = demoBooks.filter((book) => book.status === "AVAILABLE").map((book) => book.id);
let displayRevision = 0;
interface DemoCategory {
  id: string;
  name: string;
  description?: string;
  bookIds: string[];
}

interface DemoBooklist {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  kind: BooklistKind;
  visibility: BooklistVisibility;
  title: string;
  description?: string;
  bookIds: string[];
  revision: number;
  updatedAt: string;
}

let categories: DemoCategory[] = [
  { id: "category-literature", name: "文学与叙事", description: "小说、散文与那些需要慢慢进入的故事。", bookIds: ["book-1", "book-4", "book-5", "book-7", "book-11"] },
  { id: "category-nature", name: "自然观察", description: "从一片叶到一条海岸线，记录世界细微的变化。", bookIds: ["book-3", "book-6", "book-8", "book-12"] },
  { id: "category-journey", name: "旅行与地方", description: "灯塔、城市、山脉和远方的路径。", bookIds: ["book-2", "book-4", "book-7", "book-9", "book-12"] },
  { id: "category-reading", name: "阅读生活", description: "关于书、时间和阅读方法的私人练习。", bookIds: ["book-8", "book-10", "book-11"] },
];

let booklists: DemoBooklist[] = [
  { id: "booklist-autumn", ownerId: "user-owner", ownerDisplayName: "林", kind: "OFFICIAL", visibility: "PUBLIC", title: "秋日慢读", description: "适合在天色变早的傍晚，慢慢翻开的四本书。", bookIds: ["book-1", "book-3", "book-9", "book-11"], revision: 0, updatedAt: "2026-08-26T09:00:00Z" },
  { id: "booklist-weekend", ownerId: "user-admin", ownerDisplayName: "书库管理员", kind: "OFFICIAL", visibility: "MEMBERS", title: "周末共读", description: "这个周末，从灯塔出发，再回到海岸线。", bookIds: ["book-2", "book-7", "book-12"], revision: 0, updatedAt: "2026-08-25T10:00:00Z" },
  { id: "booklist-private", ownerId: "user-owner", ownerDisplayName: "林", kind: "PERSONAL", visibility: "PRIVATE", title: "想读的自然笔记", description: "先收好，等下一个安静的下午。", bookIds: ["book-3", "book-6", "book-8"], revision: 0, updatedAt: "2026-08-24T08:00:00Z" },
  { id: "booklist-public", ownerId: "user-member", ownerDisplayName: "家庭成员", kind: "PERSONAL", visibility: "PUBLIC", title: "灯塔与远方", description: "几本关于出发、等待与归来的书。", bookIds: ["book-2", "book-7", "book-9"], revision: 0, updatedAt: "2026-08-23T07:00:00Z" },
];
let recycleBin = [...demoRecycleBin];
let operations: FileOperation[] = [];
let annotations: Annotation[] = [];
const readingPositions = new Map<string, ReadingPosition>();
const readingTimeDaily = new Map<string, number>();
let readerFonts: ReaderFont[] = [...PRESET_READER_FONTS];

function displayBook(book: Book, sortOrder: number): DisplayBook {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    format: book.format,
    coverUrl: book.coverUrl,
    available: book.status === "AVAILABLE",
    sortOrder,
  };
}

function demoSessionUser(): SessionUser | null {
  try {
    const value = sessionStorage.getItem("bookkin-demo-session");
    return value ? JSON.parse(value) as SessionUser : null;
  } catch {
    return null;
  }
}

function browseBook(book: Book): BrowseBook {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    format: book.format,
    coverUrl: book.coverUrl,
    available: book.status === "AVAILABLE",
    addedAt: book.addedAt,
  };
}

function canManageDemo(user: SessionUser | null): boolean {
  return user?.role === "OWNER" || user?.role === "ADMIN";
}

function visibleDemoBookIds(user: SessionUser | null): Set<string> {
  return user ? new Set(books.map((book) => book.id)) : new Set(displayBookIds);
}

function demoCategory(category: DemoCategory, user: SessionUser | null): CategoryDetail {
  const visibleIds = visibleDemoBookIds(user);
  const visibleBooks = category.bookIds
    .filter((id) => visibleIds.has(id))
    .map((id) => books.find((book) => book.id === id))
    .filter((book): book is Book => Boolean(book))
    .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    bookCount: visibleBooks.length,
    previewBooks: visibleBooks.slice(0, 3).map(browseBook),
    editable: canManageDemo(user),
  };
}

function canViewDemoBooklist(booklist: DemoBooklist, user: SessionUser | null): boolean {
  if (!user) return booklist.visibility === "PUBLIC";
  return booklist.ownerId === user.id || booklist.visibility !== "PRIVATE";
}

function canEditDemoBooklist(booklist: DemoBooklist, user: SessionUser | null): boolean {
  if (!user) return false;
  if (booklist.visibility === "PRIVATE" && booklist.ownerId !== user.id) return false;
  return booklist.kind === "OFFICIAL" ? canManageDemo(user) : booklist.ownerId === user.id;
}

function demoBooklist(booklist: DemoBooklist, user: SessionUser | null): BooklistDetail {
  const visibleIds = visibleDemoBookIds(user);
  const visibleBooks = booklist.bookIds
    .filter((id) => visibleIds.has(id))
    .map((id) => books.find((book) => book.id === id))
    .filter((book): book is Book => Boolean(book));
  const editable = canEditDemoBooklist(booklist, user);
  return {
    id: booklist.id,
    title: booklist.title,
    description: booklist.description,
    kind: booklist.kind,
    visibility: booklist.visibility,
    ownerDisplayName: booklist.ownerDisplayName,
    bookCount: visibleBooks.length,
    previewBooks: visibleBooks.slice(0, 4).map(browseBook),
    ownedByViewer: user?.id === booklist.ownerId,
    editable,
    revision: booklist.revision,
    hiddenPublicBookCount: editable && booklist.visibility === "PUBLIC"
      ? booklist.bookIds.filter((id) => !displayBookIds.includes(id)).length
      : 0,
    updatedAt: booklist.updatedAt,
  };
}

function demoRenameTarget(book: Book, requestedName: string): string {
  const extension = `.${book.format.toLowerCase()}`;
  const trimmedName = requestedName.trim();
  const name = trimmedName.toLowerCase().endsWith(extension)
    ? trimmedName.slice(0, -extension.length)
    : trimmedName;
  const segments = book.relativePath.split("/");
  segments[segments.length - 1] = `${name}${extension}`;
  return `${book.libraryRoot}/${segments.join("/")}`;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function demoWeeklyReadingStats(): WeeklyReadingStats {
  const today = new Date();
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - day + 1);
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const dateKey = localDateKey(date);
    return { date: dateKey, seconds: readingTimeDaily.get(dateKey) ?? 0 };
  });
  const previousWeekSeconds = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(previousWeekStart);
    date.setDate(date.getDate() + index);
    return readingTimeDaily.get(localDateKey(date)) ?? 0;
  }).reduce((total, seconds) => total + seconds, 0);
  return {
    weekStart: days[0].date,
    weekEnd: days[6].date,
    totalSeconds: days.reduce((total, item) => total + item.seconds, 0),
    previousWeekSeconds,
    days,
  };
}
const libraryRoots: LibraryRoot[] = [
  {
    id: "root-main",
    name: "家庭藏书",
    configuredPath: "/library/main",
    canonicalPath: "/library/main",
    status: "ONLINE",
    canRead: true,
    canWrite: true,
    canAtomicMove: true,
    canStage: true,
    freeBytes: 1_482_400_000_000,
    lastCapabilityCheckAt: "2026-08-20T04:58:00Z",
    lastScanAt: "2026-08-20T04:55:00Z",
  },
  {
    id: "root-archive",
    name: "旧书归档",
    configuredPath: "/library/archive",
    canonicalPath: "/library/archive",
    status: "READ_ONLY",
    canRead: true,
    canWrite: false,
    canAtomicMove: false,
    canStage: false,
    freeBytes: 286_700_000_000,
    lastCapabilityCheckAt: "2026-08-20T04:58:00Z",
    lastScanAt: "2026-08-20T04:40:00Z",
  },
];

export const api = {
  isDemo: demoMode,

  async getSession(): Promise<SessionUser | null> {
    if (demoMode) return null;
    try {
      return await request("/auth/session");
    } catch {
      return null;
    }
  },

  async getSetupStatus(): Promise<{ initialized: boolean }> {
    if (demoMode) return { initialized: users.length > 0 };
    return request("/auth/setup-status");
  },

  async login(username: string, password: string): Promise<SessionUser> {
    if (!demoMode) {
      const session = await request<SessionUser>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      csrfToken = undefined;
      return session;
    }
    await pause();
    const user = users.find((candidate) => candidate.username === username && candidate.status === "ACTIVE");
    if (!user || password.length < 4) throw new Error("用户名或密码不正确");
    return user;
  },

  async setupOwner(input: { username: string; displayName: string; password: string }): Promise<SessionUser> {
    if (!demoMode) {
      const session = await request<SessionUser>("/auth/setup", { method: "POST", body: JSON.stringify(input) });
      csrfToken = undefined;
      return session;
    }
    await pause();
    if (input.password.length < 12) throw new Error("密码至少需要 12 个字符");
    return {
      id: "user-owner",
      username: input.username,
      displayName: input.displayName,
      role: "OWNER",
      mustChangePassword: false,
    };
  },

  async logout(): Promise<void> {
    if (!demoMode) {
      await request("/auth/logout", { method: "POST" });
      csrfToken = undefined;
      return;
    }
    await pause(80);
  },

  async changePassword(_currentPassword: string, newPassword: string): Promise<SessionUser> {
    if (!demoMode) return request("/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword: _currentPassword, newPassword }) });
    await pause();
    if (newPassword.length < 12) throw new Error("新密码至少需要 12 个字符");
    const current = users[0];
    users = users.map((user) => user.id === current.id ? { ...user, mustChangePassword: false } : user);
    return { ...current, mustChangePassword: false };
  },

  async listBooks(input: { q?: string; format?: "EPUB" | "PDF"; sort?: "recent" | "title" | "author"; cursor?: string; limit?: number; signal?: AbortSignal } = {}): Promise<BookPage> {
    if (!demoMode) {
      const params = new URLSearchParams({ limit: String(input.limit ?? 36) });
      if (input.q) params.set("q", input.q);
      if (input.format) params.set("format", input.format);
      if (input.sort) params.set("sort", input.sort.toUpperCase());
      if (input.cursor) params.set("cursor", input.cursor);
      return request(`/books?${params.toString()}`, { signal: input.signal });
    }
    await pause(120);
    if (input.signal?.aborted) throw new DOMException("请求已取消", "AbortError");
    const query = input.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
    const filtered = books.filter((book) => book.status === "AVAILABLE"
      && (!input.format || book.format === input.format)
      && (!query || `${book.title} ${book.author} ${book.tags.join(" ")}`.toLocaleLowerCase("zh-CN").includes(query)));
    filtered.sort((left, right) => {
      if (input.sort === "title") return left.title.localeCompare(right.title, "zh-CN");
      if (input.sort === "author") return left.author.localeCompare(right.author, "zh-CN");
      return right.addedAt.localeCompare(left.addedAt);
    });
    const offset = Math.max(0, Number(input.cursor ?? 0) || 0);
    const limit = input.limit ?? 36;
    const items = filtered.slice(offset, offset + limit);
    return { items, nextCursor: offset + limit < filtered.length ? String(offset + limit) : undefined };
  },

  async listCategories(input: { q?: string; signal?: AbortSignal } = {}): Promise<CategoryList> {
    if (!demoMode) {
      const params = new URLSearchParams();
      if (input.q) params.set("q", input.q);
      const suffix = params.size ? `?${params.toString()}` : "";
      return request(`/categories${suffix}`, { signal: input.signal });
    }
    await pause(80);
    const user = demoSessionUser();
    const query = input.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
    return {
      editable: canManageDemo(user),
      items: categories
        .map((category) => demoCategory(category, user))
        .filter((category) => category.bookCount > 0 || Boolean(user))
        .filter((category) => !query || `${category.name} ${category.description ?? ""}`.toLocaleLowerCase("zh-CN").includes(query)),
    };
  },

  async getCategory(id: string): Promise<CategoryDetail> {
    if (!demoMode) return request(`/categories/${id}`);
    await pause(60);
    const category = categories.find((candidate) => candidate.id === id);
    if (!category) throw new Error("未找到这个分类");
    const result = demoCategory(category, demoSessionUser());
    if (!demoSessionUser() && result.bookCount === 0) throw new Error("未找到这个分类");
    return result;
  },

  async listCategoryBooks(input: { id: string; q?: string; format?: "EPUB" | "PDF"; sort?: "recent" | "title" | "author"; cursor?: string; limit?: number; signal?: AbortSignal }): Promise<BrowseBookPage> {
    if (!demoMode) {
      const params = new URLSearchParams({ limit: String(input.limit ?? 36) });
      if (input.q) params.set("q", input.q);
      if (input.format) params.set("format", input.format);
      if (input.sort) params.set("sort", input.sort.toUpperCase());
      if (input.cursor) params.set("cursor", input.cursor);
      return request(`/categories/${input.id}/books?${params.toString()}`, { signal: input.signal });
    }
    await pause(90);
    const category = categories.find((candidate) => candidate.id === input.id);
    if (!category) throw new Error("未找到这个分类");
    const visibleIds = visibleDemoBookIds(demoSessionUser());
    const query = input.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
    const filtered = category.bookIds
      .filter((id) => visibleIds.has(id))
      .map((id) => books.find((book) => book.id === id))
      .filter((book): book is Book => Boolean(book))
      .filter((book) => !input.format || book.format === input.format)
      .filter((book) => !query || `${book.title} ${book.author} ${book.description}`.toLocaleLowerCase("zh-CN").includes(query));
    filtered.sort((left, right) => {
      if (input.sort === "title") return left.title.localeCompare(right.title, "zh-CN");
      if (input.sort === "author") return left.author.localeCompare(right.author, "zh-CN");
      return right.addedAt.localeCompare(left.addedAt);
    });
    const offset = Math.max(0, Number(input.cursor ?? 0) || 0);
    const limit = input.limit ?? 36;
    return {
      items: filtered.slice(offset, offset + limit).map(browseBook),
      nextCursor: offset + limit < filtered.length ? String(offset + limit) : undefined,
    };
  },

  async createCategory(input: { name: string; description?: string }): Promise<CategoryDetail> {
    if (!demoMode) return request("/categories", { method: "POST", body: JSON.stringify(input) });
    await pause(70);
    if (!canManageDemo(demoSessionUser())) throw new Error("只有主人或管理员可以维护分类");
    if (categories.some((category) => category.name.toLocaleLowerCase("zh-CN") === input.name.trim().toLocaleLowerCase("zh-CN"))) throw new Error("已经存在同名分类");
    const category: DemoCategory = { id: `category-${Date.now()}`, name: input.name.trim(), description: input.description?.trim() || undefined, bookIds: [] };
    categories = [...categories, category];
    return demoCategory(category, demoSessionUser());
  },

  async updateCategory(id: string, input: { name: string; description?: string }): Promise<CategoryDetail> {
    if (!demoMode) return request(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    await pause(70);
    if (!canManageDemo(demoSessionUser())) throw new Error("只有主人或管理员可以维护分类");
    const index = categories.findIndex((category) => category.id === id);
    if (index < 0) throw new Error("未找到这个分类");
    categories = categories.map((category) => category.id === id ? { ...category, name: input.name.trim(), description: input.description?.trim() || undefined } : category);
    return demoCategory(categories[index], demoSessionUser());
  },

  async deleteCategory(id: string): Promise<void> {
    if (!demoMode) return request(`/categories/${id}`, { method: "DELETE" });
    await pause(70);
    if (!canManageDemo(demoSessionUser())) throw new Error("只有主人或管理员可以维护分类");
    categories = categories.filter((category) => category.id !== id);
  },

  async reorderCategories(categoryIds: string[]): Promise<CategoryList> {
    if (!demoMode) return request("/categories/order", { method: "PUT", body: JSON.stringify({ categoryIds }) });
    await pause(70);
    if (categoryIds.length !== categories.length || new Set(categoryIds).size !== categories.length) throw new Error("分类列表已经变化，请刷新后重试");
    const byId = new Map(categories.map((category) => [category.id, category]));
    categories = categoryIds.map((id) => byId.get(id)).filter((category): category is DemoCategory => Boolean(category));
    return this.listCategories();
  },

  async listBookCategories(bookId: string): Promise<CategoryList> {
    if (!demoMode) return request(`/books/${bookId}/categories`);
    await pause(60);
    const user = demoSessionUser();
    return {
      items: categories.filter((category) => category.bookIds.includes(bookId)).map((category) => demoCategory(category, user)),
      editable: canManageDemo(user),
    };
  },

  async replaceBookCategories(bookId: string, categoryIds: string[]): Promise<CategoryList> {
    if (!demoMode) return request(`/books/${bookId}/categories`, { method: "PUT", body: JSON.stringify({ categoryIds }) });
    await pause(70);
    if (!canManageDemo(demoSessionUser())) throw new Error("只有主人或管理员可以维护分类");
    const selected = new Set(categoryIds);
    categories = categories.map((category) => ({
      ...category,
      bookIds: selected.has(category.id)
        ? [...new Set([...category.bookIds, bookId])]
        : category.bookIds.filter((id) => id !== bookId),
    }));
    return this.listBookCategories(bookId);
  },

  async listBooklists(input: { q?: string; signal?: AbortSignal } = {}): Promise<BooklistList> {
    if (!demoMode) {
      const params = new URLSearchParams();
      if (input.q) params.set("q", input.q);
      const suffix = params.size ? `?${params.toString()}` : "";
      return request(`/booklists${suffix}`, { signal: input.signal });
    }
    await pause(80);
    const user = demoSessionUser();
    const query = input.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
    return {
      items: booklists
        .filter((booklist) => canViewDemoBooklist(booklist, user))
        .filter((booklist) => !query || `${booklist.title} ${booklist.description ?? ""}`.toLocaleLowerCase("zh-CN").includes(query))
        .map((booklist) => demoBooklist(booklist, user)),
    };
  },

  async getBooklist(id: string): Promise<BooklistDetail> {
    if (!demoMode) return request(`/booklists/${id}`);
    await pause(60);
    const user = demoSessionUser();
    const booklist = booklists.find((candidate) => candidate.id === id);
    if (!booklist || !canViewDemoBooklist(booklist, user)) throw new Error("未找到这个书单");
    return demoBooklist(booklist, user);
  },

  async listBooklistBooks(input: { id: string; q?: string; format?: "EPUB" | "PDF"; cursor?: string; limit?: number; signal?: AbortSignal }): Promise<BrowseBookPage> {
    if (!demoMode) {
      const params = new URLSearchParams({ limit: String(input.limit ?? 36) });
      if (input.q) params.set("q", input.q);
      if (input.format) params.set("format", input.format);
      if (input.cursor) params.set("cursor", input.cursor);
      return request(`/booklists/${input.id}/books?${params.toString()}`, { signal: input.signal });
    }
    await pause(90);
    const user = demoSessionUser();
    const booklist = booklists.find((candidate) => candidate.id === input.id);
    if (!booklist || !canViewDemoBooklist(booklist, user)) throw new Error("未找到这个书单");
    const visibleIds = visibleDemoBookIds(user);
    const query = input.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
    const filtered = booklist.bookIds
      .filter((id) => visibleIds.has(id))
      .map((id) => books.find((book) => book.id === id))
      .filter((book): book is Book => Boolean(book))
      .filter((book) => !input.format || book.format === input.format)
      .filter((book) => !query || `${book.title} ${book.author} ${book.description}`.toLocaleLowerCase("zh-CN").includes(query));
    const offset = Math.max(0, Number(input.cursor ?? 0) || 0);
    const limit = input.limit ?? 36;
    return {
      items: filtered.slice(offset, offset + limit).map(browseBook),
      nextCursor: offset + limit < filtered.length ? String(offset + limit) : undefined,
    };
  },

  async createBooklist(input: { title: string; description?: string; kind: BooklistKind; visibility: BooklistVisibility }): Promise<BooklistDetail> {
    if (!demoMode) return request("/booklists", { method: "POST", body: JSON.stringify(input) });
    await pause(70);
    const user = demoSessionUser();
    if (!user) throw new Error("请先登录");
    if (input.kind === "OFFICIAL" && !canManageDemo(user)) throw new Error("只有主人或管理员可以创建官方书单");
    const booklist: DemoBooklist = {
      id: `booklist-${Date.now()}`,
      ownerId: user.id,
      ownerDisplayName: user.displayName,
      kind: input.kind,
      visibility: input.visibility,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      bookIds: [],
      revision: 0,
      updatedAt: new Date().toISOString(),
    };
    booklists = [...booklists, booklist];
    return demoBooklist(booklist, user);
  },

  async updateBooklist(id: string, input: { title: string; description?: string; visibility: BooklistVisibility; revision: number }): Promise<BooklistDetail> {
    if (!demoMode) return request(`/booklists/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    await pause(70);
    const user = demoSessionUser();
    const booklist = booklists.find((candidate) => candidate.id === id);
    if (!booklist || !canEditDemoBooklist(booklist, user)) throw new Error("只有书单创建者可以修改这个书单");
    if (booklist.revision !== input.revision) throw new Error("书单已经变化，请刷新后重试");
    if (input.visibility === "PUBLIC") {
      const hidden = booklist.bookIds.filter((bookId) => !displayBookIds.includes(bookId));
      if (hidden.length) throw new Error("公开书单只能包含公共书目，请先移出未公开书籍");
    }
    const updated: DemoBooklist = { ...booklist, title: input.title.trim(), description: input.description?.trim() || undefined, visibility: input.visibility, revision: booklist.revision + 1, updatedAt: new Date().toISOString() };
    booklists = booklists.map((candidate) => candidate.id === id ? updated : candidate);
    return demoBooklist(updated, user);
  },

  async deleteBooklist(id: string, revision: number): Promise<void> {
    if (!demoMode) return request(`/booklists/${id}?revision=${revision}`, { method: "DELETE" });
    await pause(70);
    const user = demoSessionUser();
    const booklist = booklists.find((candidate) => candidate.id === id);
    if (!booklist || !canEditDemoBooklist(booklist, user)) throw new Error("只有书单创建者可以删除这个书单");
    if (booklist.revision !== revision) throw new Error("书单已经变化，请刷新后重试");
    booklists = booklists.filter((candidate) => candidate.id !== id);
  },

  async addBooklistBooks(id: string, bookIds: string[], revision: number): Promise<BooklistDetail> {
    if (!demoMode) return request(`/booklists/${id}/books`, { method: "POST", body: JSON.stringify({ bookIds, revision }) });
    await pause(70);
    const user = demoSessionUser();
    const booklist = booklists.find((candidate) => candidate.id === id);
    if (!booklist || !canEditDemoBooklist(booklist, user)) throw new Error("只有书单创建者可以修改这个书单");
    if (booklist.revision !== revision) throw new Error("书单已经变化，请刷新后重试");
    if (booklist.visibility === "PUBLIC" && bookIds.some((bookId) => !displayBookIds.includes(bookId))) throw new Error("公开书单只能包含公共书目");
    const updated: DemoBooklist = { ...booklist, bookIds: [...new Set([...booklist.bookIds, ...bookIds])], revision: booklist.revision + 1, updatedAt: new Date().toISOString() };
    booklists = booklists.map((candidate) => candidate.id === id ? updated : candidate);
    return demoBooklist(updated, user);
  },

  async removeBooklistBook(id: string, bookId: string, revision: number): Promise<BooklistDetail> {
    if (!demoMode) return request(`/booklists/${id}/books/${bookId}?revision=${revision}`, { method: "DELETE" });
    await pause(70);
    const user = demoSessionUser();
    const booklist = booklists.find((candidate) => candidate.id === id);
    if (!booklist || !canEditDemoBooklist(booklist, user)) throw new Error("只有书单创建者可以修改这个书单");
    if (booklist.revision !== revision) throw new Error("书单已经变化，请刷新后重试");
    const updated: DemoBooklist = { ...booklist, bookIds: booklist.bookIds.filter((candidate) => candidate !== bookId), revision: booklist.revision + 1, updatedAt: new Date().toISOString() };
    booklists = booklists.map((candidate) => candidate.id === id ? updated : candidate);
    return demoBooklist(updated, user);
  },

  async reorderBooklistBooks(id: string, bookIds: string[], revision: number): Promise<BooklistDetail> {
    if (!demoMode) return request(`/booklists/${id}/order`, { method: "PUT", body: JSON.stringify({ bookIds, revision }) });
    await pause(70);
    const user = demoSessionUser();
    const booklist = booklists.find((candidate) => candidate.id === id);
    if (!booklist || !canEditDemoBooklist(booklist, user)) throw new Error("只有书单创建者可以修改这个书单");
    if (booklist.revision !== revision || bookIds.length !== booklist.bookIds.length || new Set(bookIds).size !== bookIds.length || booklist.bookIds.some((bookId) => !bookIds.includes(bookId))) throw new Error("书单已经变化，请刷新后重试");
    const updated: DemoBooklist = { ...booklist, bookIds: [...bookIds], revision: booklist.revision + 1, updatedAt: new Date().toISOString() };
    booklists = booklists.map((candidate) => candidate.id === id ? updated : candidate);
    return demoBooklist(updated, user);
  },

  async listDisplayBooks(input: { q?: string; cursor?: string; limit?: number; signal?: AbortSignal } = {}): Promise<DisplayBookPage> {
    if (!demoMode) {
      const params = new URLSearchParams({ limit: String(input.limit ?? 36) });
      if (input.q) params.set("q", input.q);
      if (input.cursor) params.set("cursor", input.cursor);
      return request(`/display-books?${params.toString()}`, { signal: input.signal });
    }
    await pause(100);
    if (input.signal?.aborted) throw new DOMException("请求已取消", "AbortError");
    const query = input.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
    const displayed = displayBookIds
      .map((id, index) => ({ book: books.find((candidate) => candidate.id === id), index }))
      .filter((item): item is { book: Book; index: number } => Boolean(item.book))
      .filter(({ book }) => !query || `${book.title} ${book.author} ${book.tags.join(" ")}`.toLocaleLowerCase("zh-CN").includes(query));
    const offset = Math.max(0, Number(input.cursor ?? 0) || 0);
    const limit = input.limit ?? 36;
    const items = displayed.slice(offset, offset + limit).map(({ book, index }) => displayBook(book, index + 1));
    return { items, nextCursor: offset + limit < displayed.length ? String(offset + limit) : undefined, revision: displayRevision };
  },

  async getDisplayBook(id: string): Promise<DisplayBook> {
    if (!demoMode) return request(`/display-books/${id}`);
    await pause(60);
    const index = displayBookIds.indexOf(id);
    if (index < 0) throw new Error("这本书不在公共展示书目中");
    const book = books.find((candidate) => candidate.id === id);
    if (!book) throw new Error("未找到这本书");
    return displayBook(book, index + 1);
  },

  async addDisplayBook(bookId: string, revision: number): Promise<DisplayBook> {
    if (!demoMode) return request("/display-books", { method: "POST", body: JSON.stringify({ bookId, revision }) });
    await pause(80);
    if (revision !== displayRevision) throw new Error("公共书单已发生变化，请刷新后重试。");
    if (!books.some((book) => book.id === bookId && book.status === "AVAILABLE")) throw new Error("只能公开已有可用书籍");
    if (!displayBookIds.includes(bookId)) { displayBookIds = [...displayBookIds, bookId]; displayRevision += 1; }
    const book = books.find((candidate) => candidate.id === bookId)!;
    return displayBook(book, displayBookIds.indexOf(bookId) + 1);
  },

  async removeDisplayBook(bookId: string, revision: number): Promise<void> {
    if (!demoMode) return request(`/display-books/${bookId}?revision=${revision}`, { method: "DELETE" });
    await pause(80);
    if (revision !== displayRevision) throw new Error("公共书单已发生变化，请刷新后重试。");
    if (displayBookIds.includes(bookId)) { displayBookIds = displayBookIds.filter((id) => id !== bookId); displayRevision += 1; }
  },

  async reorderDisplayBooks(bookIds: string[], revision: number): Promise<DisplayBookPage> {
    if (!demoMode) return request("/display-books/order", { method: "PUT", body: JSON.stringify({ bookIds, revision }) });
    await pause(80);
    if (revision !== displayRevision || bookIds.length !== displayBookIds.length || new Set(bookIds).size !== displayBookIds.length
      || displayBookIds.some((id) => !bookIds.includes(id))) throw new Error("公共书单已发生变化，请刷新后重试。");
    displayBookIds = [...bookIds];
    displayRevision += 1;
    return this.listDisplayBooks();
  },

  async getBook(id: string): Promise<Book> {
    if (!demoMode) return request(`/books/${id}`);
    await pause(80);
    const book = books.find((candidate) => candidate.id === id);
    if (!book) throw new Error("未找到这本书");
    return book;
  },

  async getReadingPosition(bookId: string): Promise<ReadingPosition | null> {
    if (!demoMode) return (await request<ReadingPosition | undefined>(`/books/${bookId}/position`)) ?? null;
    await pause(40);
    return readingPositions.get(bookId) ?? null;
  },

  async saveReadingPosition(bookId: string, locator: string, progress: number): Promise<ReadingPosition> {
    const normalizedProgress = Math.max(0, Math.min(1, progress));
    if (!demoMode) return request(`/books/${bookId}/position`, {
      method: "PUT",
      body: JSON.stringify({ locator, progress: normalizedProgress, deviceId: "web" }),
    });
    const position: ReadingPosition = {
      bookId,
      locator,
      progress: normalizedProgress,
      deviceId: "web-demo",
      updatedAt: new Date().toISOString(),
    };
    readingPositions.set(bookId, position);
    return position;
  },

  async getWeeklyReadingStats(): Promise<WeeklyReadingStats> {
    if (!demoMode) return request("/reading-stats/weekly");
    await pause(40);
    return demoWeeklyReadingStats();
  },

  async recordReadingTime(bookId: string, seconds: number): Promise<WeeklyReadingStats> {
    const normalizedSeconds = Math.max(1, Math.min(60, Math.round(seconds)));
    if (!demoMode) return request(`/books/${bookId}/reading-time`, {
      method: "POST",
      body: JSON.stringify({ seconds: normalizedSeconds }),
    });
    const date = localDateKey(new Date());
    readingTimeDaily.set(date, Math.min(86_400, (readingTimeDaily.get(date) ?? 0) + normalizedSeconds));
    return demoWeeklyReadingStats();
  },

  async getBookMetadata(bookId: string): Promise<BookMetadata> {
    if (!demoMode) return request(`/books/${bookId}/metadata`);
    await pause(80);
    const book = books.find((candidate) => candidate.id === bookId);
    if (!book) throw new Error("未找到这本书");
    return {
      id: book.id,
      title: book.title,
      authors: [book.author],
      translators: [],
      description: book.description,
      language: "zh-CN",
      publisher: "BookKin典藏",
      publishedDate: "2026",
      isbn: "",
      series: "灯火集",
      tags: book.tags,
      sources: {},
    };
  },

  async updateBookMetadata(book: Book, input: Omit<BookMetadata, "id" | "coverCacheKey" | "coverUrl"> & { writeBack: boolean; manualFields?: string[] }): Promise<{ metadata: BookMetadata; writeBackPreview?: FileOperationPreview }> {
    if (!demoMode) return request(`/books/${book.id}/metadata`, {
      method: "PATCH",
      body: JSON.stringify({ ...input, bookFileId: book.fileId, expectedFingerprint: book.fingerprint }),
    });
    await pause(160);
    books = books.map((candidate) => candidate.id === book.id ? {
      ...candidate,
      title: input.title,
      author: input.authors.join(" / "),
      description: input.description ?? "",
      tags: input.tags,
    } : candidate);
    const metadata: BookMetadata = { id: book.id, ...input };
    return {
      metadata,
      writeBackPreview: input.writeBack ? await this.previewFileOperation({ ...book, ...metadata, description: metadata.description ?? "" }, "WRITE_METADATA") : undefined,
    };
  },

  async updateBookCover(bookId: string, cover: Blob): Promise<void> {
    return request(`/books/${bookId}/cover`, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: cover });
  },

  async resetBookCover(bookId: string): Promise<void> {
    return request(`/books/${bookId}/cover`, { method: "DELETE" });
  },

  async listUsers(): Promise<ManagedUser[]> {
    if (!demoMode) return request<{ items: ManagedUser[] }>("/users").then((result) => result.items);
    await pause();
    return [...users];
  },

  async createUser(input: { username: string; displayName: string; role: UserRole }): Promise<{ user: ManagedUser; temporaryPassword: string }> {
    if (!demoMode) return request("/users", { method: "POST", body: JSON.stringify(input) });
    await pause();
    if (users.some((user) => user.username === input.username)) throw new Error("用户名已存在");
    const user: ManagedUser = {
      id: crypto.randomUUID(),
      ...input,
      status: "ACTIVE",
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };
    users = [user, ...users];
    return { user, temporaryPassword: "BookKin-Temp-7M2K!" };
  },

  async toggleUser(userId: string): Promise<ManagedUser> {
    if (!demoMode) return request(`/users/${userId}/status`, { method: "PATCH" });
    await pause();
    const user = users.find((candidate) => candidate.id === userId);
    if (!user || user.role === "OWNER") throw new Error("主人账户不能被停用");
    const updated = { ...user, status: user.status === "ACTIVE" ? "DISABLED" as const : "ACTIVE" as const };
    users = users.map((candidate) => candidate.id === userId ? updated : candidate);
    return updated;
  },

  async resetTemporaryPassword(userId: string): Promise<{ username: string; temporaryPassword: string }> {
    if (!demoMode) return request(`/users/${userId}/temporary-password`, { method: "POST" });
    await pause();
    const user = users.find((candidate) => candidate.id === userId);
    if (!user || user.role === "OWNER") throw new Error("不能重置主人账户");
    users = users.map((candidate) => candidate.id === userId ? { ...candidate, mustChangePassword: true } : candidate);
    return { username: user.username, temporaryPassword: "BookKin-Reset-8Q4N!" };
  },

  async revokeUserSessions(userId: string): Promise<void> {
    if (!demoMode) return request(`/users/${userId}/sessions/revoke`, { method: "POST" });
    await pause();
  },

  async previewFileOperation(book: Book, type: FileOperationType, targetPath?: string): Promise<FileOperationPreview> {
    if (!demoMode) return request("/file-operations/preview", {
      method: "POST",
      body: JSON.stringify({ bookFileId: book.fileId ?? book.id, type, targetPath, expectedFingerprint: book.fingerprint }),
    }, { timeoutMs: 12_000 });
    await pause();
    const normalizedTarget = type === "RENAME" && targetPath
      ? demoRenameTarget(book, targetPath)
      : targetPath?.replaceAll("//", "/").trim();
    return {
      previewToken: crypto.randomUUID(),
      type,
      sourcePath: `${book.libraryRoot}/${book.relativePath}`,
      targetPath: normalizedTarget,
      requiredBytes: type === "MOVE" ? 8_842_122 : 0,
      expectedFingerprint: book.fingerprint,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      conflicts: normalizedTarget?.includes("已存在") ? [{ code: "TARGET_EXISTS", message: "目标路径已有文件，BookKin不会覆盖它。", path: normalizedTarget }] : [],
      warnings: type === "TRASH"
        ? ["文件将保留 30 天；阅读记录和笔记不会删除。"]
        : type === "MOVE"
          ? ["跨书库根目录时会先复制、刷盘并校验 SHA-256。"]
          : type === "WRITE_METADATA"
            ? ["写回会校验临时文件后直接覆盖当前原文件，不保留历史版本。"]
            : [],
    };
  },

  async previewRecycleOperation(entry: RecycleBinEntry, type: "RESTORE" | "PURGE"): Promise<FileOperationPreview> {
    if (!demoMode) return request("/file-operations/preview", {
      method: "POST",
      body: JSON.stringify({ recycleBinEntryId: entry.id, type, expectedFingerprint: entry.fingerprint }),
    }, { timeoutMs: 12_000 });
    await pause();
    return {
      previewToken: crypto.randomUUID(),
      type,
      sourcePath: entry.trashPath,
      targetPath: type === "RESTORE" ? entry.originalPath : undefined,
      requiredBytes: 0,
      expectedFingerprint: entry.fingerprint,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      conflicts: [],
      warnings: type === "RESTORE"
        ? ["恢复会把文件移回原路径；如果路径已有新文件，操作将被阻止。"]
        : ["永久清理会从 NAS 删除回收文件，且无法通过BookKin恢复。"],
    };
  },

  async executeFileOperation(preview: FileOperationPreview): Promise<FileOperation> {
    if (!demoMode) return request("/file-operations", {
      method: "POST",
      headers: { "Idempotency-Key": `preview:${preview.previewToken}` },
      body: JSON.stringify({ previewToken: preview.previewToken, expectedFingerprint: preview.expectedFingerprint }),
    }, { timeoutMs: 12_000 });
    await pause(400);
    const book = books.find((candidate) => `${candidate.libraryRoot}/${candidate.relativePath}` === preview.sourcePath);
    if (book && preview.type === "RENAME" && preview.targetPath) {
      const prefix = `${book.libraryRoot}/`;
      const relativePath = preview.targetPath.startsWith(prefix) ? preview.targetPath.slice(prefix.length) : preview.targetPath;
      books = books.map((candidate) => candidate.id === book.id ? { ...candidate, relativePath } : candidate);
    }
    if (book && preview.type === "TRASH") {
      books = books.map((candidate) => candidate.id === book.id ? { ...candidate, status: "TRASHED" } : candidate);
      recycleBin = [{
        id: crypto.randomUUID(),
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        format: book.format,
        coverUrl: book.coverUrl,
        originalPath: preview.sourcePath,
        trashPath: `.bookkin-trash/${crypto.randomUUID()}/${book.relativePath.split("/").at(-1)}`,
        sizeBytes: 8_842_122,
        deletedBy: "林",
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
        fingerprint: book.fingerprint,
      }, ...recycleBin];
    }
    const operation: FileOperation = {
      id: crypto.randomUUID(),
      type: preview.type,
      status: "SUCCEEDED",
      sourcePath: preview.sourcePath,
      targetPath: preview.targetPath,
      createdAt: new Date().toISOString(),
      stage: "已校验并提交",
    };
    operations = [operation, ...operations];
    return operation;
  },

  async listFileOperations(): Promise<FileOperation[]> {
    if (!demoMode) return request<{ items: FileOperation[] }>("/file-operations?limit=50").then((result) => result.items);
    await pause();
    return [...operations];
  },

  async listRecycleBin(): Promise<RecycleBinEntry[]> {
    if (!demoMode) return request<{ items: RecycleBinEntry[] }>("/recycle-bin").then((result) => result.items);
    await pause();
    return [...recycleBin];
  },

  async listLibraryRoots(): Promise<LibraryRoot[]> {
    if (!demoMode) return request<{ items: LibraryRoot[] }>("/library-roots").then((result) => result.items);
    await pause();
    return [...libraryRoots];
  },

  async listBookUploads(): Promise<BookUpload[]> {
    return request<{ items: BookUpload[] }>("/book-uploads").then((result) => result.items);
  },

  async createBookUpload(input: { libraryRootId: string; filename: string; sizeBytes: number }): Promise<BookUpload> {
    return request("/book-uploads", { method: "POST", body: JSON.stringify(input) });
  },

  async uploadBookContent(uploadId: string, file: File, onProgress: (progress: number) => void): Promise<BookUpload> {
    const token = await ensureCsrfToken();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/v1/book-uploads/${uploadId}/content`);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.setRequestHeader("X-XSRF-TOKEN", token);
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText) as BookUpload);
        else {
          try { const problem = JSON.parse(xhr.responseText) as { detail?: string; title?: string }; reject(new Error(problem.detail ?? problem.title ?? "上传失败")); }
          catch { reject(new Error("上传失败")); }
        }
      });
      xhr.addEventListener("error", () => reject(new Error("网络中断，上传未完成")));
      xhr.send(file);
    });
  },

  async getBookUpload(uploadId: string): Promise<BookUpload> {
    return request(`/book-uploads/${uploadId}`);
  },

  async updateBookUploadMetadata(uploadId: string, draft: BookMetadataDraft): Promise<BookUpload> {
    return request(`/book-uploads/${uploadId}/metadata`, { method: "PATCH", body: JSON.stringify(draft) });
  },

  async enrichBookUpload(uploadId: string): Promise<BookUpload> {
    return request(`/book-uploads/${uploadId}/enrich`, { method: "POST" });
  },

  async uploadBookCover(uploadId: string, cover: Blob): Promise<BookUpload> {
    return request(`/book-uploads/${uploadId}/cover`, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: cover });
  },

  async selectBookUploadCover(uploadId: string, candidateId: string): Promise<BookUpload> {
    return request(`/book-uploads/${uploadId}/cover-selection`, { method: "POST", body: JSON.stringify({ candidateId }) });
  },

  async commitBookUpload(uploadId: string, publishToDisplay = false): Promise<BookUpload> {
    return request(`/book-uploads/${uploadId}/commit`, {
      method: "POST",
      headers: { "Idempotency-Key": `upload:${uploadId}` },
      body: JSON.stringify({ publishToDisplay }),
    });
  },

  async cancelBookUpload(uploadId: string): Promise<void> {
    return request(`/book-uploads/${uploadId}`, { method: "DELETE" });
  },

  async listReaderFonts(): Promise<ReaderFont[]> {
    if (!demoMode) return request<{ items: ReaderFont[] }>("/reader-fonts").then((result) => [...PRESET_READER_FONTS, ...result.items]);
    await pause(80);
    return readerFonts.filter((font) => font.status === "ENABLED");
  },

  async listReaderFontsForAdmin(): Promise<ReaderFont[]> {
    if (!demoMode) return request<{ items: ReaderFont[] }>("/reader-fonts?includeDisabled=true").then((result) => [...PRESET_READER_FONTS, ...result.items]);
    await pause(80);
    return [...readerFonts];
  },

  async createReaderFont(input: { displayName: string; kind: "SERIF" | "SANS"; filename: string; sizeBytes: number; licenseNote?: string }): Promise<ReaderFont> {
    if (!demoMode) return request("/reader-fonts", { method: "POST", body: JSON.stringify(input) });
    await pause(220);
    const extension = input.filename.split(".").at(-1)?.toUpperCase() as ReaderFont["format"];
    const font: ReaderFont = {
      id: crypto.randomUUID(),
      displayName: input.displayName || input.filename,
      familyName: input.displayName || input.filename,
      kind: input.kind,
      source: "CUSTOM",
      status: "ENABLED",
      format: ["WOFF2", "WOFF", "TTF", "OTF"].includes(extension ?? "") ? extension : "WOFF2",
      licenseNote: input.licenseNote,
      createdAt: new Date().toISOString(),
    };
    readerFonts = [...readerFonts, font];
    return font;
  },

  async uploadReaderFontContent(fontId: string, file: File, onProgress: (progress: number) => void): Promise<ReaderFont> {
    if (!demoMode) {
      const token = await ensureCsrfToken();
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `/api/v1/reader-fonts/${fontId}/content`);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.setRequestHeader("X-XSRF-TOKEN", token);
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText) as ReaderFont);
          else {
            try { const problem = JSON.parse(xhr.responseText) as { detail?: string; title?: string }; reject(new Error(problem.detail ?? problem.title ?? "字体上传失败")); }
            catch { reject(new Error("字体上传失败")); }
          }
        });
        xhr.addEventListener("error", () => reject(new Error("网络中断，字体上传未完成")));
        xhr.send(file);
      });
    }
    onProgress(100);
    await pause(80);
    return readerFonts.find((font) => font.id === fontId) ?? PRESET_READER_FONTS[0];
  },

  async setReaderFontStatus(fontId: string, status: "ENABLED" | "DISABLED"): Promise<ReaderFont> {
    if (!demoMode) return request(`/reader-fonts/${fontId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await pause(120);
    readerFonts = readerFonts.map((font) => font.id === fontId ? { ...font, status } : font);
    return readerFonts.find((font) => font.id === fontId) ?? PRESET_READER_FONTS[0];
  },

  async executeRecycleOperation(entry: RecycleBinEntry, preview: FileOperationPreview): Promise<FileOperation> {
    if (!demoMode) return request(preview.type === "RESTORE" ? `/recycle-bin/${entry.id}/restore` : `/recycle-bin/${entry.id}`, {
      method: preview.type === "RESTORE" ? "POST" : "DELETE",
      headers: { "Idempotency-Key": `preview:${preview.previewToken}` },
      body: JSON.stringify({ previewToken: preview.previewToken, expectedFingerprint: preview.expectedFingerprint }),
    });
    await pause(300);
    recycleBin = recycleBin.filter((candidate) => candidate.id !== entry.id);
    if (preview.type === "RESTORE") {
      books = books.map((book) => book.id === entry.bookId ? { ...book, status: "AVAILABLE" } : book);
    }
    const operation: FileOperation = {
      id: crypto.randomUUID(),
      type: preview.type,
      status: "SUCCEEDED",
      sourcePath: preview.sourcePath,
      targetPath: preview.targetPath,
      createdAt: new Date().toISOString(),
      stage: "已校验并提交",
    };
    operations = [operation, ...operations];
    return operation;
  },

  async listAnnotations(bookId?: string): Promise<Annotation[]> {
    if (!demoMode) return request<{ items: Annotation[] }>(`/annotations${bookId ? `?bookId=${encodeURIComponent(bookId)}` : ""}`).then((result) => result.items);
    await pause(100);
    return annotations.filter((annotation) => !bookId || annotation.bookId === bookId);
  },

  async listAnnotationBooks(input: { q?: string; cursor?: string; limit?: number } = {}): Promise<AnnotationBookPage> {
    if (!demoMode) {
      const params = new URLSearchParams({ limit: String(input.limit ?? 36) });
      if (input.q) params.set("q", input.q);
      if (input.cursor) params.set("cursor", input.cursor);
      return request(`/annotations/books?${params.toString()}`);
    }
    await pause(100);
    const grouped = new Map<string, Annotation[]>();
    annotations.filter((annotation) => annotation.type !== "BOOKMARK").forEach((annotation) => {
      grouped.set(annotation.bookId, [...(grouped.get(annotation.bookId) ?? []), annotation]);
    });
    const query = input.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
    const items = Array.from(grouped.entries()).map(([bookId, items]) => {
      const book = books.find((candidate) => candidate.id === bookId);
      return {
        bookId,
        bookTitle: book?.title ?? items[0].bookTitle ?? "藏书",
        bookAuthor: book?.author ?? items[0].bookAuthor ?? "未知作者",
        coverUrl: book?.coverUrl ?? "",
        annotationCount: items.length,
        noteCount: items.filter((item) => item.type === "NOTE").length,
        highlightCount: items.filter((item) => item.style === "HIGHLIGHT").length,
        underlineCount: items.filter((item) => item.style === "UNDERLINE").length,
        boldCount: items.filter((item) => item.style === "BOLD").length,
        latestAt: items.map((item) => item.updatedAt ?? item.createdAt).sort().at(-1) ?? new Date().toISOString(),
      };
    }).filter((item) => !query || `${item.bookTitle} ${item.bookAuthor}`.toLocaleLowerCase("zh-CN").includes(query));
    return { items };
  },

  async downloadAnnotationExport(bookId: string, format: "DOCX" | "XLSX"): Promise<string> {
    if (demoMode) throw new Error("演示模式不提供文件导出");
    const response = await fetch(`/api/v1/annotations/books/${bookId}/export/${format}`, { credentials: "include" });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({ title: "导出失败" }));
      throw new Error(problem.detail ?? problem.title ?? `HTTP ${response.status}`);
    }
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
    const filename = encodedName ? decodeURIComponent(encodedName) : quotedName ?? `阅读笔记.${format.toLowerCase()}`;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return filename;
  },

  async createAnnotation(input: Omit<Annotation, "id" | "createdAt" | "updatedAt">): Promise<Annotation> {
    if (!demoMode) {
      const { bookTitle, ...payload } = input;
      void bookTitle;
      return request("/annotations", { method: "POST", body: JSON.stringify(payload) });
    }
    await pause(100);
    const now = new Date().toISOString();
    const annotation: Annotation = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    annotations = [annotation, ...annotations];
    return annotation;
  },

  async deleteAnnotation(id: string): Promise<void> {
    if (!demoMode) return request(`/annotations/${id}`, { method: "DELETE" });
    await pause(80);
    annotations = annotations.filter((annotation) => annotation.id !== id);
  },
};
