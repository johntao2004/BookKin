import type { Book } from "../domain/types";

export interface LibrarySubcategory {
  id: string;
  label: string;
  subtitle: string;
  keywords: readonly string[];
}

export interface LibraryCategory {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  keywords: readonly string[];
  subcategories: readonly [LibrarySubcategory, LibrarySubcategory, LibrarySubcategory];
}

export interface CatalogClassification {
  category: LibraryCategory;
  subcategory: LibrarySubcategory;
}

export const LIBRARY_CATEGORIES: readonly LibraryCategory[] = [
  {
    id: "literature",
    label: "文学创作",
    subtitle: "LITERATURE",
    description: "小说、散文与诗歌戏剧",
    keywords: ["文学", "小说", "散文", "随笔", "诗", "戏剧", "幻想", "故事"],
    subcategories: [
      { id: "fiction", label: "小说", subtitle: "FICTION", keywords: ["小说", "幻想", "故事", "长篇", "中篇", "短篇"] },
      { id: "essays", label: "散文与随笔", subtitle: "ESSAYS", keywords: ["散文", "随笔", "笔记", "书信"] },
      { id: "poetry", label: "诗歌戏剧", subtitle: "POETRY & DRAMA", keywords: ["诗", "诗歌", "戏剧", "剧本"] },
    ],
  },
  {
    id: "humanities",
    label: "人文社科",
    subtitle: "HUMANITIES",
    description: "历史、思想与社会观察",
    keywords: ["历史", "传记", "哲学", "思想", "社会", "文化", "人文", "阅读", "方法"],
    subcategories: [
      { id: "history", label: "历史传记", subtitle: "HISTORY", keywords: ["历史", "传记", "家书", "旧地图"] },
      { id: "thought", label: "思想与社会", subtitle: "THOUGHT", keywords: ["哲学", "思想", "社会", "文化", "人文"] },
      { id: "reading", label: "阅读与方法", subtitle: "READING", keywords: ["阅读", "方法", "写作", "教育"] },
    ],
  },
  {
    id: "nature",
    label: "自然科学",
    subtitle: "NATURAL SCIENCE",
    description: "生命、地理与科学技术",
    keywords: ["自然", "科学", "地理", "植物", "动物", "海洋", "生命", "天文", "技术"],
    subcategories: [
      { id: "life", label: "生命自然", subtitle: "LIFE", keywords: ["自然", "植物", "动物", "生命", "海洋"] },
      { id: "geography", label: "地理探索", subtitle: "GEOGRAPHY", keywords: ["地理", "旅行", "海岸", "山川", "城市"] },
      { id: "science", label: "科学技术", subtitle: "SCIENCE", keywords: ["科学", "技术", "天文", "数学", "物理"] },
    ],
  },
  {
    id: "arts",
    label: "艺术生活",
    subtitle: "ARTS & LIFE",
    description: "艺术、设计与日常生活",
    keywords: ["艺术", "设计", "图文", "摄影", "建筑", "音乐", "生活", "美学"],
    subcategories: [
      { id: "visual-arts", label: "视觉艺术", subtitle: "VISUAL ARTS", keywords: ["艺术", "图文", "摄影", "绘画"] },
      { id: "design", label: "设计建筑", subtitle: "DESIGN", keywords: ["设计", "建筑", "城市"] },
      { id: "lifestyle", label: "生活美学", subtitle: "LIFESTYLE", keywords: ["生活", "美学", "手作", "饮食"] },
    ],
  },
  {
    id: "reference",
    label: "专藏文献",
    subtitle: "REFERENCE",
    description: "工具书、档案与珍贵专藏",
    keywords: ["文献", "档案", "工具", "收藏", "手册", "资料", "年鉴", "参考"],
    subcategories: [
      { id: "collections", label: "珍贵专藏", subtitle: "COLLECTIONS", keywords: ["收藏", "珍贵", "善本"] },
      { id: "archives", label: "档案文献", subtitle: "ARCHIVES", keywords: ["档案", "文献", "资料", "年鉴"] },
      { id: "reference-books", label: "工具参考", subtitle: "REFERENCE", keywords: ["工具", "手册", "参考", "指南"] },
    ],
  },
] as const;

function searchableBookText(book: Pick<Book, "title" | "author" | "series" | "description" | "tags" | "wordCount">) {
  return [book.title, book.author, book.series, book.description, book.wordCount, ...book.tags]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

function keywordScore(text: string, keywords: readonly string[]) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword.toLocaleLowerCase("zh-CN")) ? 1 : 0), 0);
}

export function classifyCatalogBook(book: Book): CatalogClassification {
  const text = searchableBookText(book);
  const rankedCategories = LIBRARY_CATEGORIES
    .map((category, index) => ({ category, index, score: keywordScore(text, category.keywords) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const category = rankedCategories[0]?.score
    ? rankedCategories[0].category
    : book.format === "PDF"
      ? LIBRARY_CATEGORIES[4]
      : LIBRARY_CATEGORIES[0];
  const rankedSubcategories = category.subcategories
    .map((subcategory, index) => ({ subcategory, index, score: keywordScore(text, subcategory.keywords) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return {
    category,
    subcategory: rankedSubcategories[0]?.subcategory ?? category.subcategories[0],
  };
}

export function sortCatalogBooksByClassification(books: Book[]) {
  const categoryOrder = new Map(LIBRARY_CATEGORIES.map((category, index) => [category.id, index]));
  return books
    .map((book, originalIndex) => ({ book, originalIndex, classification: classifyCatalogBook(book) }))
    .sort((left, right) => {
      const categoryDifference = (categoryOrder.get(left.classification.category.id) ?? 0)
        - (categoryOrder.get(right.classification.category.id) ?? 0);
      if (categoryDifference !== 0) return categoryDifference;
      const leftSubcategory = left.classification.category.subcategories.findIndex(
        (subcategory) => subcategory.id === left.classification.subcategory.id,
      );
      const rightSubcategory = right.classification.category.subcategories.findIndex(
        (subcategory) => subcategory.id === right.classification.subcategory.id,
      );
      return leftSubcategory - rightSubcategory || left.originalIndex - right.originalIndex;
    });
}

export function defaultCategoryForShelf(sectionId: number) {
  return LIBRARY_CATEGORIES[Math.abs(sectionId) % LIBRARY_CATEGORIES.length];
}
