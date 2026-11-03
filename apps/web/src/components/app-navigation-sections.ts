/** Shared labels and paths for AppShell submenus and the role page tree. */
export const libraryNavigationSections = [
  { label: "楼中一览", path: "/library/overview", requiresUser: true },
  { label: "书目", path: "/booklists", requiresUser: false },
  { label: "学脉图", path: "/knowledge-graph", requiresUser: true },
  { label: "书楼漫游", path: "/virtual-library", requiresUser: false },
] as const;

export const articlesNavigationSections = [
  { label: "全部文章", path: "/articles" },
  { label: "选集", path: "/article-collections" },
] as const;

export const notesNavigationSections = [
  { label: "读书札记", path: "/annotations/books" },
  { label: "阅文札记", path: "/annotations/articles" },
] as const;
